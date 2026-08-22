import { FieldPath, type Firestore, type Query } from "firebase-admin/firestore";
import { clientMatchesFilter, publicClientRecord } from "./admin-client-view";

export const CLIENT_PAGE_SIZE = 50;
const SEARCH_LIMIT = 20;
const BATCH_LIMIT = 25;

function clampLimit(raw: string | null | undefined, fallback = CLIENT_PAGE_SIZE, max = 100) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

async function namesForEmails(db: Firestore, emails: string[]) {
  const unique = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))].slice(
    0,
    100,
  );
  const names = new Map<string, string>();
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snaps = await db.getAll(...chunk.map((email) => db.collection("users").doc(email)));
    for (const snap of snaps) {
      const name = snap.data()?.name;
      if (snap.exists && name) names.set(snap.id, String(name));
    }
  }
  return names;
}

export async function getUserNamesByEmail(db: Firestore, emails: string[]) {
  return namesForEmails(db, emails);
}

export async function listAdminClients(
  db: Firestore,
  params: {
    email?: string | null;
    emails?: string | null;
    q?: string | null;
    filter?: string | null;
    cursor?: string | null;
    limit?: string | null;
  },
) {
  const email = params.email?.trim().toLowerCase();
  if (email) {
    const doc = await db.collection("users").doc(email).get();
    if (!doc.exists) return { client: null as null, clients: [] as ReturnType<typeof publicClientRecord>[] };
    const client = publicClientRecord(doc.id, (doc.data() || {}) as Record<string, unknown>);
    return { client, clients: [client], nextCursor: null as string | null };
  }

  const emails = String(params.emails || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, BATCH_LIMIT);
  if (emails.length > 0) {
    const snaps = await db.getAll(...emails.map((id) => db.collection("users").doc(id)));
    const clients = snaps
      .filter((snap) => snap.exists)
      .map((snap) => publicClientRecord(snap.id, (snap.data() || {}) as Record<string, unknown>));
    return { clients, nextCursor: null as string | null };
  }

  const q = String(params.q || "").trim().toLowerCase();
  const filter = String(params.filter || "all");
  const limit = clampLimit(params.limit);
  const cursor = String(params.cursor || "").trim().toLowerCase();

  if (q) {
    const hits = new Map<string, ReturnType<typeof publicClientRecord>>();
    if (q.includes("@") || q.includes(".")) {
      const exact = await db.collection("users").doc(q).get();
      if (exact.exists) {
        hits.set(q, publicClientRecord(exact.id, (exact.data() || {}) as Record<string, unknown>));
      }
      const prefix = await db
        .collection("users")
        .orderBy(FieldPath.documentId())
        .startAt(q)
        .endAt(`${q}\uf8ff`)
        .limit(SEARCH_LIMIT)
        .get();
      prefix.docs.forEach((doc) => {
        hits.set(doc.id, publicClientRecord(doc.id, (doc.data() || {}) as Record<string, unknown>));
      });
    }

    try {
      const nameSnap = await db
        .collection("users")
        .orderBy("nameLower")
        .startAt(q)
        .endAt(`${q}\uf8ff`)
        .limit(SEARCH_LIMIT)
        .get();
      nameSnap.docs.forEach((doc) => {
        hits.set(doc.id, publicClientRecord(doc.id, (doc.data() || {}) as Record<string, unknown>));
      });
    } catch {
      // nameLower prefix index may still be building
    }

    const clients = [...hits.values()].filter((client) => clientMatchesFilter(client, filter)).slice(0, limit);
    return { clients, nextCursor: null as string | null };
  }

  try {
    let query: Query = db.collection("users");
    if (filter === "pending") query = query.where("subscriptionPlan", "==", "pending");
    else if (filter === "paid") {
      query = query.where("subscriptionPlan", "in", ["solo", "studio", "team", "nano", "ultra"]);
    } else if (filter === "trial") query = query.where("subscriptionPlan", "in", ["none", "trial"]);
    else if (filter === "suspended") query = query.where("suspended", "==", true);
    query = query.orderBy(FieldPath.documentId());
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.limit(limit + 1).get();
    const docs = snap.docs.slice(0, limit);
    const clients = docs.map((doc) => publicClientRecord(doc.id, (doc.data() || {}) as Record<string, unknown>));
    const nextCursor = snap.docs.length > limit ? docs[docs.length - 1]?.id || null : null;
    return { clients, nextCursor };
  } catch {
    const clients: ReturnType<typeof publicClientRecord>[] = [];
    let last = cursor;
    for (let page = 0; page < 20 && clients.length <= limit; page += 1) {
      let query = db.collection("users").orderBy(FieldPath.documentId()).limit(50);
      if (last) query = query.startAfter(last);
      const snap = await query.get();
      if (snap.empty) break;
      for (const doc of snap.docs) {
        const rec = publicClientRecord(doc.id, (doc.data() || {}) as Record<string, unknown>);
        if (filter === "all" || clientMatchesFilter(rec, filter)) clients.push(rec);
        if (clients.length > limit) break;
      }
      last = snap.docs[snap.docs.length - 1]?.id || last;
      if (snap.size < 50) break;
    }
    const page = clients.slice(0, limit);
    return { clients: page, nextCursor: clients.length > limit ? page[page.length - 1]?.id || null : null };
  }
}
