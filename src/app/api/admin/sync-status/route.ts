import { NextResponse } from "next/server";
import { isAdminUiRequest } from "@/lib/admin";
import { getDb } from "@/lib/firebase-admin";
import { getUserStatus } from "@/lib/user-store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
  }

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const snap = await db.collection("users").get();
  const rows = await Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data();
      const email = doc.id;
      const status = await getUserStatus(email);
      const lastSyncAt = data.lastSyncAt ? new Date(data.lastSyncAt).getTime() : null;
      const neverSynced = !lastSyncAt;
      const staleSync = lastSyncAt ? lastSyncAt < sevenDaysAgo : true;

      let syncStatus: "never" | "stale" | "active" | "expired" | "suspended" = "never";
      if (data.suspended) syncStatus = "suspended";
      else if (!status?.active) syncStatus = "expired";
      else if (neverSynced) syncStatus = "never";
      else if (staleSync) syncStatus = "stale";
      else syncStatus = "active";

      return {
        email,
        name: data.name || "",
        subscriptionPlan: data.subscriptionPlan || "none",
        suspended: Boolean(data.suspended),
        assignedSlot: data.assignedSlot || "C1",
        lastSyncAt: data.lastSyncAt || null,
        lastSyncSlot: data.lastSyncSlot || null,
        extensionVersion: data.extensionVersion || null,
        syncHealth: data.syncHealth || null,
        trialExpiresAt: data.trialExpiresAt || null,
        subscriptionExpiresAt: data.subscriptionExpiresAt || null,
        syncStatus,
        active: status?.active ?? false,
      };
    }),
  );

  rows.sort((a, b) => {
    const aTime = a.lastSyncAt ? new Date(a.lastSyncAt).getTime() : 0;
    const bTime = b.lastSyncAt ? new Date(b.lastSyncAt).getTime() : 0;
    return bTime - aTime;
  });

  return NextResponse.json({ success: true, clients: rows });
}
