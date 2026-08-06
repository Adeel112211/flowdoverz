import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "flowdoverz_admin";
export const WORKSPACE_OWNER = "workspace";

const DATA_DIR = path.join(process.cwd(), ".data");
const SYNC_KEY_PATH = path.join(DATA_DIR, "admin-sync.json");

async function adminPassword(): Promise<string | null> {
  try {
    const { getDb } = await import("@/lib/firebase-admin");
    const db = getDb();
    if (db) {
      const doc = await db.collection("settings").doc("admin").get();
      if (doc.exists) {
        const data = doc.data();
        if (data?.password) {
          return String(data.password);
        }
      }
    }
  } catch (err) {
    console.error("Error reading admin password from Firestore:", err);
  }

  const fromEnv = process.env.FLOWBRIDGE_ADMIN_PASSWORD?.trim();
  return fromEnv || null;
}

async function signingSecret(): Promise<string | null> {
  const configured = process.env.FLOWBRIDGE_ADMIN_SECRET?.trim();
  if (configured) return configured;

  const pwd = await adminPassword();
  if (!pwd) return null;

  return createHmac("sha256", "flowdoverz-admin-token").update(pwd).digest("hex");
}

export async function isAdminPasswordConfigured() {
  return Boolean(await adminPassword());
}

export async function verifyAdminPassword(password: string) {
  const expected = await adminPassword();
  if (!expected) {
    console.error("Admin password is not configured. Set FLOWBRIDGE_ADMIN_PASSWORD in Vercel.");
    return false;
  }
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function createAdminToken() {
  const secret = await signingSecret();
  if (!secret) {
    throw new Error("Admin signing secret is not configured.");
  }
  const issuedAt = Date.now().toString();
  const sig = createHmac("sha256", secret)
    .update(`admin:${issuedAt}`)
    .digest("hex");
  return `${issuedAt}.${sig}`;
}

export async function verifyAdminToken(token: string | undefined | null) {
  if (!token) return false;
  const [issuedAt, sig] = token.split(".");
  if (!issuedAt || !sig) return false;

  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > 7 * 24 * 60 * 60 * 1000) {
    return false;
  }

  const secret = await signingSecret();
  if (!secret) return false;

  const expected = createHmac("sha256", secret)
    .update(`admin:${issuedAt}`)
    .digest("hex");

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function hashSyncKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

type SyncKeyFile = {
  keyHash: string;
  createdAt: number;
};

let memorySyncKey: SyncKeyFile | null = null;

function readSyncKeyFromDisk(): SyncKeyFile | null {
  try {
    if (!existsSync(SYNC_KEY_PATH)) return null;
    const parsed = JSON.parse(readFileSync(SYNC_KEY_PATH, "utf8")) as SyncKeyFile;
    return parsed?.keyHash ? parsed : null;
  } catch {
    return null;
  }
}

function writeSyncKeyToDisk(data: SyncKeyFile | null) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (!data) {
      writeFileSync(SYNC_KEY_PATH, JSON.stringify({ revoked: true }), "utf8");
      return;
    }
    writeFileSync(SYNC_KEY_PATH, JSON.stringify(data), "utf8");
  } catch (err) {
    console.warn("Admin sync key disk write failed:", err);
  }
}

async function writeSyncKeyToFirestore(data: SyncKeyFile | null) {
  try {
    const { getDb } = await import("@/lib/firebase-admin");
    const db = getDb();
    if (!db) return;
    const ref = db.collection("settings").doc("admin_sync");
    if (data) {
      await ref.set(data);
    } else {
      await ref.delete();
    }
  } catch (err) {
    console.warn("Admin sync key Firestore write failed:", err);
  }
}

async function readSyncKeyRecord(): Promise<SyncKeyFile | null> {
  if (memorySyncKey) return memorySyncKey;

  const fromDisk = readSyncKeyFromDisk();
  if (fromDisk) {
    memorySyncKey = fromDisk;
    return fromDisk;
  }

  try {
    const { getDb } = await import("@/lib/firebase-admin");
    const db = getDb();
    if (db) {
      const doc = await db.collection("settings").doc("admin_sync").get();
      if (doc.exists) {
        const data = doc.data() as SyncKeyFile;
        if (data?.keyHash) {
          memorySyncKey = data;
          return data;
        }
      }
    }
  } catch (err) {
    console.warn("Admin sync key Firestore read failed:", err);
  }

  return null;
}

/** Create a one-time extension sync key (only returned on admin unlock). */
export async function issueAdminSyncKey() {
  const key = `fbsk_${randomBytes(32).toString("hex")}`;
  const record: SyncKeyFile = {
    keyHash: hashSyncKey(key),
    createdAt: Date.now(),
  };
  memorySyncKey = record;
  writeSyncKeyToDisk(record);
  await writeSyncKeyToFirestore(record);
  return key;
}

export async function revokeAdminSyncKey() {
  memorySyncKey = null;
  writeSyncKeyToDisk(null);
  await writeSyncKeyToFirestore(null);
}

export async function verifyAdminSyncKey(key: string | undefined | null) {
  if (!key || !key.startsWith("fbsk_")) return false;
  const stored = await readSyncKeyRecord();
  if (!stored?.keyHash) return false;
  // 12 hour max lifetime for sync key
  if (Date.now() - stored.createdAt > 12 * 60 * 60 * 1000) return false;

  const incoming = hashSyncKey(key);
  try {
    const a = Buffer.from(incoming);
    const b = Buffer.from(stored.keyHash);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** UI admin session (cookie manager page) — does NOT grant cookie download by itself. */
export async function isAdminUiRequest(request?: Request | { headers: Headers }) {
  const jar = await cookies();
  if (await verifyAdminToken(jar.get(ADMIN_COOKIE)?.value)) return true;

  const headerToken =
    request && "headers" in request
      ? request.headers.get("x-admin-token")
      : null;
  return await verifyAdminToken(headerToken);
}

/**
 * Cookie delivery to extension — ONLY via extension sync key.
 * Visiting /login with a leftover admin cookie cannot download cookies.
 */
export async function canDeliverCookies(request: Request | { headers: Headers }) {
  const syncKey = request.headers.get("x-admin-sync-key");
  return verifyAdminSyncKey(syncKey);
}

/** @deprecated use isAdminUiRequest or canDeliverCookies */
export async function isAdminRequest(request?: Request | { headers: Headers }) {
  if (request && (await canDeliverCookies(request))) return true;
  return isAdminUiRequest(request);
}

export function adminCookieOptions(token: string) {
  return {
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  };
}
