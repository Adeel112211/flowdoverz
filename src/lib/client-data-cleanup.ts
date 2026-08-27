import type { Query } from "firebase-admin/firestore";
import { getAdminAuth, getDb } from "@/lib/firebase-admin";
import {
  invalidateUserDocCache,
  isPaidPlan,
  normalizeEmail,
} from "@/lib/user-store";

export type DeleteClientResult = {
  email: string;
  deletedPayments: number;
  deletedSignupVerification: boolean;
  deletedEmailLogs: number;
  deletedUser: boolean;
};

async function deleteQueryDocs(query: Query, batchSize = 400): Promise<number> {
  const db = getDb();
  if (!db) return 0;

  let deleted = 0;
  for (;;) {
    const snap = await query.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      deleted += 1;
    }
    await batch.commit();
    if (snap.size < batchSize) break;
  }
  return deleted;
}

/** Remove Firestore data tied to one client email. Does not touch shared cookie slots. */
export async function deleteClientCompletely(email: string): Promise<DeleteClientResult> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) {
    throw new Error("Valid email is required.");
  }

  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const deletedPayments = await deleteQueryDocs(
    db.collection("manual_payments").where("userEmail", "==", normalized),
  );

  let deletedSignupVerification = false;
  try {
    const signupRef = db.collection("signup_verifications").doc(normalized);
    const signupSnap = await signupRef.get();
    if (signupSnap.exists) {
      await signupRef.delete();
      deletedSignupVerification = true;
    }
  } catch {
    // non-blocking
  }

  const deletedEmailLogs = await deleteQueryDocs(
    db.collection("email_log").where("to", "==", normalized),
  );

  const userRef = db.collection("users").doc(normalized);
  const userSnap = await userRef.get();
  let deletedUser = false;
  if (userSnap.exists) {
    await userRef.delete();
    deletedUser = true;
  }

  invalidateUserDocCache(normalized);

  const adminAuth = await getAdminAuth();
  if (adminAuth) {
    try {
      const userRecord = await adminAuth.getUserByEmail(normalized);
      await adminAuth.deleteUser(userRecord.uid);
    } catch {
      // user may never have existed in Firebase Auth
    }
  }

  return {
    email: normalized,
    deletedPayments,
    deletedSignupVerification,
    deletedEmailLogs,
    deletedUser,
  };
}

/** True when the account never finished signup or has no active trial/subscription. */
export function isStaleClientRecord(data: Record<string, unknown>): boolean {
  const emailVerified = data.emailVerified !== false;
  if (!emailVerified) return true;

  const now = Date.now();
  const plan = String(data.subscriptionPlan || "none").toLowerCase();
  const trialExpiresAt = data.trialExpiresAt ? new Date(String(data.trialExpiresAt)).getTime() : 0;
  const subscriptionExpiresAt = data.subscriptionExpiresAt
    ? new Date(String(data.subscriptionExpiresAt)).getTime()
    : 0;

  const trialActive = emailVerified && Number.isFinite(trialExpiresAt) && trialExpiresAt > now;
  const subscriptionActive =
    isPaidPlan(plan) && Number.isFinite(subscriptionExpiresAt) && subscriptionExpiresAt > now;

  return !(trialActive || subscriptionActive);
}

export type PurgeStaleClientsResult = {
  scanned: number;
  deleted: number;
  kept: number;
  deletedEmails: string[];
};

/** Delete inactive / unverified clients and their payments, logs, and signup codes. */
export async function purgeStaleClients(): Promise<PurgeStaleClientsResult> {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const snap = await db.collection("users").get();
  const deletedEmails: string[] = [];
  let kept = 0;

  for (const doc of snap.docs) {
    const data = (doc.data() || {}) as Record<string, unknown>;
    if (!isStaleClientRecord(data)) {
      kept += 1;
      continue;
    }
    await deleteClientCompletely(doc.id);
    deletedEmails.push(doc.id);
  }

  return {
    scanned: snap.size,
    deleted: deletedEmails.length,
    kept,
    deletedEmails,
  };
}

async function deleteSubcollection(
  parentCollection: string,
  parentId: string,
  subcollection: string,
): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const ref = db.collection(parentCollection).doc(parentId).collection(subcollection);
  return deleteQueryDocs(ref);
}

/** Delete every client belonging to a reseller, then reseller docs + extension pack. */
export async function deleteResellerCompletely(resellerId: string): Promise<{
  resellerId: string;
  deletedClients: number;
  deletedApiUsage: number;
  deletedSeatGrants: number;
}> {
  const id = String(resellerId || "").trim();
  if (!id) throw new Error("Reseller id is required.");

  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const usersSnap = await db.collection("users").where("resellerId", "==", id).get();
  let deletedClients = 0;
  for (const doc of usersSnap.docs) {
    await deleteClientCompletely(doc.id);
    deletedClients += 1;
  }

  const deletedApiUsage = await deleteSubcollection("resellers", id, "api_usage");
  const deletedSeatGrants = await deleteSubcollection("resellers", id, "seat_grants");

  const { deleteResellerExtensionPack } = await import("./extension-reseller-pack");
  await deleteResellerExtensionPack(id);

  await db.collection("resellers").doc(id).delete();

  return {
    resellerId: id,
    deletedClients,
    deletedApiUsage,
    deletedSeatGrants,
  };
}

/** Delete rejected/approved manual payments older than the given age. Active clients are kept. */
export async function purgeOldPaymentRecords(maxAgeDays = 90): Promise<{
  deleted: number;
  statuses: string[];
}> {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const snap = await db.collection("manual_payments").get();
  let deleted = 0;
  const statuses = new Set<string>();

  for (const doc of snap.docs) {
    const data = doc.data() as { status?: string; createdAt?: string };
    const status = String(data.status || "").toLowerCase();
    if (status === "pending") continue;
    const createdAt = data.createdAt ? new Date(data.createdAt).getTime() : 0;
    if (!createdAt || createdAt > cutoff) continue;
    await doc.ref.delete();
    deleted += 1;
    statuses.add(status || "unknown");
  }

  return { deleted, statuses: [...statuses] };
}

export async function purgeDatabaseStorage(options?: {
  purgeStaleClients?: boolean;
  purgeOldPayments?: boolean;
  purgeOldExtensions?: boolean;
  purgeEmptyCookieSlots?: boolean;
  paymentMaxAgeDays?: number;
}) {
  const {
    purgeStaleClients: doStaleClients = true,
    purgeOldPayments = true,
    purgeOldExtensions = true,
    purgeEmptyCookieSlots = true,
    paymentMaxAgeDays = 90,
  } = options || {};

  const result: Record<string, unknown> = {};

  if (purgeOldExtensions || purgeEmptyCookieSlots) {
    const { purgeOldExtensionReleases, purgeEmptyCookieSlots: clearEmptySlots } = await import(
      "./storage-cleanup"
    );
    if (purgeOldExtensions) {
      result.extension = await purgeOldExtensionReleases();
    }
    if (purgeEmptyCookieSlots) {
      result.cookies = await clearEmptySlots();
    }
  }

  if (doStaleClients) {
    result.staleClients = await purgeStaleClients();
  }

  if (purgeOldPayments) {
    result.oldPayments = await purgeOldPaymentRecords(paymentMaxAgeDays);
  }

  return result;
}
