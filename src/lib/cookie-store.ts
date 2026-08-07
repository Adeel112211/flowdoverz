import { createHash } from "crypto";
import { getDb } from "@/lib/firebase-admin";
import { verifyClientSession } from "@/lib/client-session";

export type FlowCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
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

function buildCookie(row: Record<string, unknown>): FlowCookie {
  const cookie: FlowCookie = {
    name: row.name as string,
    value: row.value as string,
    path: typeof row.path === "string" ? row.path : "/",
    secure: Boolean(row.secure),
    httpOnly: Boolean(row.httpOnly),
  };

  if (typeof row.domain === "string") cookie.domain = row.domain;
  if (typeof row.sameSite === "string") cookie.sameSite = row.sameSite;
  if (typeof row.expirationDate === "number") cookie.expirationDate = row.expirationDate;
  if (typeof row.hostOnly === "boolean") cookie.hostOnly = row.hostOnly;
  if (typeof row.session === "boolean") cookie.session = row.session;
  if (typeof row.storeId === "string") cookie.storeId = row.storeId;
  if (row.partitionKey !== undefined && row.partitionKey !== null) {
    cookie.partitionKey = row.partitionKey;
  }

  return cookie;
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
    if (typeof row.name !== "string" || typeof row.value !== "string") {
      throw new Error("Each cookie needs string name and value fields.");
    }
    cookies.push(buildCookie(row));
  }

  return cookies;
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

  return record;
}

export async function getSlotCookies(ownerKey: string, slot: string): Promise<SlotRecord | null> {
  const db = getDb();
  if (!db) return null;
  const doc = await db.collection("cookies").doc(ownerKey).get();
  if (!doc.exists) return null;
  const data = doc.data();
  return data?.slots?.[slot] ?? null;
}

export async function listSlots(ownerKey: string): Promise<Array<{ key: string; record: SlotRecord }>> {
  const db = getDb();
  if (!db) return [];
  const doc = await db.collection("cookies").doc(ownerKey).get();
  if (!doc.exists) return [];
  const data = doc.data();
  const slots = data?.slots || {};
  return Object.entries(slots).map(([key, record]) => ({ key, record: record as SlotRecord }));
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
}

export function emailFromSid(sid: string): string {
  return verifyClientSession(sid)?.email ?? "";
}
