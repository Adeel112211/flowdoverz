import { FieldPath, type Firestore, type Query } from "firebase-admin/firestore";
import { CLIENT_PAGE_SIZE } from "./admin-client-constants";
import { clientMatchesFilter, publicClientRecord, sortClientsNewestFirst } from "./admin-client-view";

export { CLIENT_PAGE_SIZE } from "./admin-client-constants";
const SEARCH_LIMIT = 20;
const BATCH_LIMIT = 25;

function clampLimit(raw: string | null | undefined, fallback = CLIENT_PAGE_SIZE, max = 100) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function clampPage(raw: string | null | undefined) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
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

async function fetchAllFilteredClients(db: Firestore, filter: string) {
  try {
    let query: Query = db.collection("users");
    if (filter === "pending") query = query.where("subscriptionPlan", "==", "pending");
    else if (filter === "paid") {
      query = query.where("subscriptionPlan", "in", ["solo", "studio", "team", "nano", "ultra"]);
    } else if (filter === "trial") query = query.where("subscriptionPlan", "in", ["none", "trial"]);
    else if (filter === "suspended") query = query.where("suspended", "==", true);
    else if (filter === "reseller") query = query.where("resellerId", ">", "");
    const snap = await query.get();
    return snap.docs
      .map((doc) => publicClientRecord(doc.id, (doc.data() || {}) as Record<string, unknown>))
      .filter((client) => clientMatchesFilter(client, filter));
  } catch {
    const clients: ReturnType<typeof publicClientRecord>[] = [];
    let last = "";
    for (let scan = 0; scan < 100; scan += 1) {
      let query = db.collection("users").orderBy(FieldPath.documentId()).limit(100);
      if (last) query = query.startAfter(last);
      const snap = await query.get();
      if (snap.empty) break;
      for (const doc of snap.docs) {
        const rec = publicClientRecord(doc.id, (doc.data() || {}) as Record<string, unknown>);
        if (clientMatchesFilter(rec, filter)) clients.push(rec);
      }
      last = snap.docs[snap.docs.length - 1]?.id || last;
      if (snap.size < 100) break;
    }
    return clients;
  }
}

export async function listAdminClients(
  db: Firestore,
  params: {
    email?: string | null;
    emails?: string | null;
    q?: string | null;
    filter?: string | null;
    page?: string | null;
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
    const clients = sortClientsNewestFirst(
      snaps
        .filter((snap) => snap.exists)
        .map((snap) => publicClientRecord(snap.id, (snap.data() || {}) as Record<string, unknown>)),
    );
    return { clients, nextCursor: null as string | null };
  }

  const q = String(params.q || "").trim().toLowerCase();
  const filter = String(params.filter || "all");
  const limit = clampLimit(params.limit);
  const pageNum = clampPage(params.page || params.cursor);

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

    const clients = sortClientsNewestFirst(
      [...hits.values()].filter((client) => clientMatchesFilter(client, filter)),
    ).slice(0, limit);
    return { clients, nextCursor: null as string | null };
  }

  const allClients = sortClientsNewestFirst(await fetchAllFilteredClients(db, filter));
  const offset = (pageNum - 1) * limit;
  const pageClients = allClients.slice(offset, offset + limit);
  const hasNext = offset + limit < allClients.length;
  return {
    clients: pageClients,
    nextCursor: hasNext ? String(pageNum + 1) : null,
    totalCount: allClients.length,
  };
}

export async function countAdminClients(
  db: Firestore,
  params: { q?: string | null; filter?: string | null },
) {
  const q = String(params.q || "").trim().toLowerCase();
  const filter = String(params.filter || "all");

  if (q) {
    const { clients } = await listAdminClients(db, { q, filter, limit: "100" });
    return clients.length;
  }

  const allClients = await fetchAllFilteredClients(db, filter);
  return allClients.length;
}
