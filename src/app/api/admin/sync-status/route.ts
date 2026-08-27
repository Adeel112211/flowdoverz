import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest } from "@/lib/admin";
import { publicClientRecord, sortClientsNewestFirst, syncStatusFromUserData } from "@/lib/admin-client-view";
import { getDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function clampPage(raw: string | null | undefined) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export async function GET(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
  }

  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const page = clampPage(request.nextUrl.searchParams.get("page") || request.nextUrl.searchParams.get("cursor"));
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
      createdAt: rec.createdAt || null,
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

  const snap = await db.collection("users").get();
  const allRows = sortClientsNewestFirst(
    snap.docs.map((doc) => toRow(doc.id, (doc.data() || {}) as Record<string, unknown>)),
  );
  const offset = (page - 1) * limit;
  const rows = allRows.slice(offset, offset + limit);
  const nextCursor = offset + limit < allRows.length ? String(page + 1) : null;

  return NextResponse.json({ success: true, clients: rows, nextCursor, totalCount: allRows.length });
}
