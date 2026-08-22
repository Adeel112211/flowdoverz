import { createHash } from "crypto";
import { getDb } from "@/lib/firebase-admin";
import { verifyClientSession } from "@/lib/client-session";

export type FlowCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  url?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  expirationDate?: number;
  hostOnly?: boolean;
  session?: boolean;
  storeId?: string;
  partitionKey?: unknown;
};

export type SlotRecord = {
  cookies: FlowCookie[];
  hash: string;
  updatedAt: string;
  label?: string;
};

export function hashCookies(cookies: FlowCookie[]): string {
  return createHash("sha256").update(JSON.stringify(cookies)).digest("hex").slice(0, 24);
}

/** Firestore rejects undefined — strip recursively before writes. */
export function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) {
        out[key] = sanitizeForFirestore(entry);
      }
    }
    return out as T;
  }
  return value;
}

function asPositiveNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function hostnameFromUrl(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host || undefined;
  } catch {
    return undefined;
  }
}

function cookieValue(row: Record<string, unknown>): string | null {
  if (typeof row.value === "string") return row.value;
  if (typeof row.value === "number" && Number.isFinite(row.value)) return String(row.value);
  if (row.value === null || row.value === undefined) return "";
  return null;
}

function buildCookie(row: Record<string, unknown>): FlowCookie {
  const value = cookieValue(row);
  if (typeof row.name !== "string" || value === null) {
    throw new Error("Each cookie needs string name and value fields.");
  }

  const cookie: FlowCookie = {
    name: row.name,
    value,
    path: typeof row.path === "string" && row.path.startsWith("/") ? row.path : "/",
    secure: Boolean(row.secure),
    httpOnly: Boolean(row.httpOnly),
  };

  const domain =
    typeof row.domain === "string" && row.domain.trim()
      ? row.domain.trim()
      : typeof row.url === "string"
        ? hostnameFromUrl(row.url)
        : undefined;
  if (domain) cookie.domain = domain;
  if (typeof row.url === "string" && row.url.trim()) cookie.url = row.url.trim();
  if (typeof row.sameSite === "string" && row.sameSite.trim()) cookie.sameSite = row.sameSite.trim();
  const expirationDate = asPositiveNumber(row.expirationDate);
  if (expirationDate !== undefined) cookie.expirationDate = expirationDate;
  if (typeof row.hostOnly === "boolean") cookie.hostOnly = row.hostOnly;
  if (typeof row.session === "boolean") cookie.session = row.session;
  if (typeof row.storeId === "string") cookie.storeId = row.storeId;
  if (row.partitionKey !== undefined && row.partitionKey !== null) {
    cookie.partitionKey = row.partitionKey;
  }

  return cookie;
}

const GOOGLE_IDENTITY_NAMES = new Set(["SID", "__Secure-1PSID", "__Secure-3PSID"]);
const LABS_SESSION_NAMES = new Set([
  "OSID",
  "__Secure-OSID",
  "__Host-next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
]);

export function analyzeCookieCoverage(cookies: FlowCookie[]): {
  hasGoogleSid: boolean;
  hasLabsSession: boolean;
  warnings: string[];
} {
  const names = new Set(cookies.map((cookie) => cookie.name));
  const hosts = cookies.map((cookie) => String(cookie.domain || "").replace(/^\./, "").toLowerCase());
  const hasGoogleSid = [...GOOGLE_IDENTITY_NAMES].some((name) => names.has(name));
  const hasLabsSession = [...LABS_SESSION_NAMES].some((name) => names.has(name));
  const hasLabsHost = hosts.some((host) => host === "labs.google" || host.endsWith(".labs.google"));
  const warnings: string[] = [];

  if (!hasLabsHost && !hasLabsSession && !hasGoogleSid) {
    warnings.push("No labs.google cookies found. Flow will not stay signed in.");
  }

  return { hasGoogleSid, hasLabsSession, warnings };
}

export function parseCookieJson(input: string): FlowCookie[] {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste a JSON cookie array first.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Invalid JSON. Paste a Cookie Editor / EditThisCookie export.");
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { cookies?: unknown }).cookies)
      ? (parsed as { cookies: unknown[] }).cookies
      : null;

  if (!list) {
    throw new Error("Expected a JSON array of cookies, or { \"cookies\": [...] }.");
  }
  if (list.length === 0) throw new Error("The cookie list is empty.");
  if (list.length > 500) throw new Error("Maximum 500 cookies per save.");

  const cookies: FlowCookie[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") {
      throw new Error("Each cookie must be an object.");
    }
    const row = item as Record<string, unknown>;
    cookies.push(buildCookie(row));
  }

  return cookies;
}

const SLOTS_TTL_MS = 30 * 1000;
let slotsCache: { ownerKey: string; at: number; value: Array<{ key: string; record: SlotRecord }> } | null =
  null;

function invalidateSlotsCache() {
  slotsCache = null;
}

export async function saveSlotCookies(
  ownerKey: string,
  slot: string,
  cookies: FlowCookie[],
  label?: string,
): Promise<SlotRecord> {
  const db = getDb();
  if (!db) throw new Error("Database not initialized");
  
  const record: SlotRecord = {
    cookies,
    hash: hashCookies(cookies),
    updatedAt: new Date().toISOString(),
    ...(label ? { label } : {}),
  };

  const firestoreRecord = sanitizeForFirestore(record);
  
  const docRef = db.collection("cookies").doc(ownerKey);
  
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    let data = doc.exists ? doc.data() : { slots: {} };
    if (!data!.slots) data!.slots = {};
    data!.slots[slot] = firestoreRecord;
    transaction.set(docRef, sanitizeForFirestore(data!), { merge: true });
  });

  invalidateSlotsCache();
  const { touchLive } = await import("./live-tick");
  void touchLive("cookies");
  return record;
}

export async function getSlotCookies(ownerKey: string, slot: string): Promise<SlotRecord | null> {
  const slots = await listSlots(ownerKey);
  return slots.find((item) => item.key === slot)?.record ?? null;
}

export async function listSlots(ownerKey: string): Promise<Array<{ key: string; record: SlotRecord }>> {
  if (
    slotsCache &&
    slotsCache.ownerKey === ownerKey &&
    Date.now() - slotsCache.at < SLOTS_TTL_MS
  ) {
    return slotsCache.value;
  }

  const db = getDb();
  if (!db) return [];
  const doc = await db.collection("cookies").doc(ownerKey).get();
  if (!doc.exists) {
    slotsCache = { ownerKey, at: Date.now(), value: [] };
    return [];
  }
  const data = doc.data();
  const slots = data?.slots || {};
  const value = Object.entries(slots).map(([key, record]) => ({ key, record: record as SlotRecord }));
  slotsCache = { ownerKey, at: Date.now(), value };
  return value;
}

export async function clearSlotCookies(ownerKey: string, slot: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const docRef = db.collection("cookies").doc(ownerKey);
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (!doc.exists) return;
    const data = doc.data();
    if (data?.slots?.[slot]) {
      delete data.slots[slot];
      transaction.set(docRef, data);
    }
  });
  invalidateSlotsCache();
  const { touchLive } = await import("./live-tick");
  void touchLive("cookies");
}

export function emailFromSid(sid: string): string {
  return verifyClientSession(sid)?.email ?? "";
}
