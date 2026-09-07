import { createHash } from "crypto";
import { getDb } from "@/lib/firebase-admin";
import { verifyClientSession } from "@/lib/client-session";
import {
  analyzeCookieCoverage,
  googleAccountFingerprint,
  type FlowCookie,
} from "@/lib/cookie-analysis";
import { normalizeFlowCookies } from "@/lib/cookie-normalize";

export type { FlowCookie } from "@/lib/cookie-analysis";
export {
  analyzeCookieCoverage,
  analyzeCookieFreshness,
  analyzeCookies,
  compareAccountFingerprints,
  googleAccountFingerprint,
} from "@/lib/cookie-analysis";

export type SlotRecord = {
  cookies: FlowCookie[];
  hash: string;
  updatedAt: string;
  label?: string;
  /** Stable hash of SID / __Secure-1PSID — same value means same Google account. */
  accountFingerprint?: string | null;
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

function cookieMergeKey(cookie: FlowCookie): string {
  return `${cookie.name}@${cookie.domain || ""}@${cookie.path || "/"}`;
}

function extractCookieList(parsed: unknown, sourceLabel: string): unknown[] | null {
  const list = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { cookies?: unknown }).cookies)
      ? (parsed as { cookies: unknown[] }).cookies
      : null;

  if (!list) {
    throw new Error(
      `${sourceLabel}: expected a JSON array of cookies, or { "cookies": [...] }.`,
    );
  }
  return list;
}

/** Parse one Cookie Editor export without merge/normalize (empty input → []). */
export function parseCookieJsonPart(input: string, sourceLabel = "Export"): FlowCookie[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`${sourceLabel}: invalid JSON. Paste a Cookie Editor export.`);
  }

  const list = extractCookieList(parsed, sourceLabel);
  if (!list || list.length === 0) return [];

  const cookies: FlowCookie[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") {
      throw new Error(`${sourceLabel}: each cookie must be an object.`);
    }
    cookies.push(buildCookie(item as Record<string, unknown>));
  }
  return cookies;
}

/** Merge google + flow + labs exports; later parts win on duplicate name/domain/path. */
export function mergeCookieExportParts(parts: {
  google?: string;
  flow?: string;
  labs?: string;
}): FlowCookie[] {
  const segments = [
    { raw: parts.google, label: ".google.com export" },
    { raw: parts.flow, label: "flow.google.com export" },
    { raw: parts.labs, label: "labs.google export" },
  ];

  const byKey = new Map<string, FlowCookie>();
  let nonEmptyParts = 0;

  for (const { raw, label } of segments) {
    const cookies = parseCookieJsonPart(raw || "", label);
    if (cookies.length > 0) nonEmptyParts += 1;
    for (const cookie of cookies) {
      byKey.set(cookieMergeKey(cookie), cookie);
    }
  }

  if (nonEmptyParts === 0) {
    throw new Error(
      "Paste at least one export — .google.com, flow.google.com, or labs.google.",
    );
  }

  const merged = [...byKey.values()];
  if (merged.length === 0) {
    throw new Error("No cookies found in the pasted exports.");
  }
  if (merged.length > 500) {
    throw new Error("Maximum 500 cookies per save.");
  }

  return normalizeFlowCookies(merged);
}

export function parseCookieJson(input: string): FlowCookie[] {
  const cookies = parseCookieJsonPart(input, "Cookies");
  if (cookies.length === 0) throw new Error("Paste a JSON cookie array first.");
  if (cookies.length > 500) throw new Error("Maximum 500 cookies per save.");
  return normalizeFlowCookies(cookies);
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
    accountFingerprint: googleAccountFingerprint(cookies),
    ...(label ? { label } : {}),
  };

  const firestoreRecord = sanitizeForFirestore(record);
  const docRef = db.collection("cookies").doc(ownerKey);

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    const slots: Record<string, SlotRecord> = doc.exists
      ? { ...(((doc.data()?.slots as Record<string, SlotRecord> | undefined) || {})) }
      : {};

    // Full replace — old cookies for this slot are not kept.
    slots[slot] = firestoreRecord as SlotRecord;

    // Remove empty slots so cleared cookie sets do not linger in the database.
    for (const [key, entry] of Object.entries(slots)) {
      if (!Array.isArray(entry?.cookies) || entry.cookies.length === 0) {
        delete slots[key];
      }
    }

    transaction.set(docRef, sanitizeForFirestore({ slots }), { merge: false });
  });

  invalidateSlotsCache();
  const { touchLive } = await import("./live-tick");
  void touchLive({ topic: "cookies", action: "updated", id: slot });
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

export async function clearAllCookieSlots(ownerKey: string): Promise<string[]> {
  const slots = await listSlots(ownerKey);
  const cleared = slots.map((item) => item.key);
  if (!cleared.length) return [];

  const db = getDb();
  if (!db) return cleared;

  await db.collection("cookies").doc(ownerKey).delete();
  invalidateSlotsCache();
  const { touchLive } = await import("./live-tick");
  void touchLive({ topic: "cookies", action: "cleared_all", id: ownerKey });
  return cleared;
}

export async function clearSlotCookies(ownerKey: string, slot: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const docRef = db.collection("cookies").doc(ownerKey);
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (!doc.exists) return;
    const data = doc.data();
    if (!data?.slots?.[slot]) return;
    const slots = { ...(data.slots as Record<string, SlotRecord>) };
    delete slots[slot];
    if (Object.keys(slots).length === 0) {
      transaction.delete(docRef);
      return;
    }
    transaction.set(docRef, sanitizeForFirestore({ slots }), { merge: false });
  });
  invalidateSlotsCache();
  const { touchLive } = await import("./live-tick");
  void touchLive({ topic: "cookies", action: "cleared", id: slot });
}

export function emailFromSid(sid: string): string {
  return verifyClientSession(sid)?.email ?? "";
}
