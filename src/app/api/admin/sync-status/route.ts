import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { isAdminUiRequest } from "@/lib/admin";
import { getDb } from "@/lib/firebase-admin";
import { publicClientRecord, syncStatusFromUserData } from "@/lib/admin-client-view";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
  }

  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const cursor = request.nextUrl.searchParams.get("cursor")?.trim().toLowerCase() || "";
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || PAGE_SIZE) || PAGE_SIZE, 100);
  const now = Date.now();

  const toRow = (id: string, data: Record<string, unknown>) => {
    const rec = publicClientRecord(id, data);
    const derived = syncStatusFromUserData(data, now);
    return {
      email: rec.email,
      name: String(rec.name || ""),
      subscriptionPlan: String(rec.subscriptionPlan || "none"),
      suspended: Boolean(rec.suspended),
      assignedSlot: String(rec.assignedSlot || "C1"),
      lastSyncAt: rec.lastSyncAt || null,
      lastSyncSlot: rec.lastSyncSlot || null,
      extensionVersion: rec.extensionVersion || null,
      syncHealth: rec.syncHealth || null,
      trialExpiresAt: rec.trialExpiresAt || null,
      subscriptionExpiresAt: rec.subscriptionExpiresAt || null,
      syncStatus: derived.syncStatus,
      active: derived.active,
    };
  };

  if (email) {
    const doc = await db.collection("users").doc(email).get();
    if (!doc.exists) {
      return NextResponse.json({ success: false, error: "Client not found" }, { status: 404 });
    }
    const row = toRow(doc.id, (doc.data() || {}) as Record<string, unknown>);
    return NextResponse.json({ success: true, client: row, clients: [row] });
  }

  let query = db.collection("users").orderBy(FieldPath.documentId()).limit(limit + 1);
  if (cursor) query = query.startAfter(cursor);
  const snap = await query.get();
  const docs = snap.docs.slice(0, limit);
  const rows = docs.map((doc) => toRow(doc.id, (doc.data() || {}) as Record<string, unknown>));
  const nextCursor = snap.docs.length > limit ? docs[docs.length - 1]?.id || null : null;

  return NextResponse.json({ success: true, clients: rows, nextCursor });
}
