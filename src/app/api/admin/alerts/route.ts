import { NextResponse } from "next/server";
import { isAdminUiRequest, WORKSPACE_OWNER } from "@/lib/admin";
import { listSlots } from "@/lib/cookie-store";
import { getDb } from "@/lib/firebase-admin";
import { isPaidPlanId } from "@/lib/admin-client-view";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
  }

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startIso = startOfToday.toISOString();
  const endIso = endOfToday.toISOString();

  let pendingPayments = 0;
  let trialsExpiringToday = 0;
  let subsExpiringThisWeek = 0;

  const paymentsSnap = await db.collection("manual_payments").where("status", "==", "pending").get();
  pendingPayments = paymentsSnap.size;

  try {
    const trialSnap = await db
      .collection("users")
      .where("trialExpiresAt", ">=", startIso)
      .where("trialExpiresAt", "<", endIso)
      .get();
    trialSnap.forEach((doc) => {
      const plan = String(doc.data().subscriptionPlan || "none");
      if (!isPaidPlanId(plan) && plan !== "pending") trialsExpiringToday += 1;
    });
  } catch {
    trialsExpiringToday = 0;
  }

  try {
    const subSnap = await db
      .collection("users")
      .where("subscriptionExpiresAt", ">=", now.toISOString())
      .where("subscriptionExpiresAt", "<=", weekFromNow.toISOString())
      .get();
    subSnap.forEach((doc) => {
      if (isPaidPlanId(String(doc.data().subscriptionPlan || ""))) subsExpiringThisWeek += 1;
    });
  } catch {
    subsExpiringThisWeek = 0;
  }

  const slots = await listSlots(WORKSPACE_OWNER);
  const emptySlots = ["C1", "C2", "C3", "C4", "C5"].filter(
    (key) => !slots.find((s) => s.key === key)?.record?.cookies?.length,
  );

  return NextResponse.json({
    success: true,
    alerts: {
      pendingPayments,
      trialsExpiringToday,
      subsExpiringThisWeek,
      emptyCookieSlots: emptySlots.length,
      emptySlotKeys: emptySlots,
    },
  });
}
