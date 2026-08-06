import { NextResponse } from "next/server";
import { isAdminUiRequest, WORKSPACE_OWNER } from "@/lib/admin";
import { listSlots } from "@/lib/cookie-store";
import { getDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const PAID_PLANS = new Set(["solo", "studio", "team", "nano", "ultra"]);

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

  let pendingPayments = 0;
  let trialsExpiringToday = 0;
  let subsExpiringThisWeek = 0;

  const paymentsSnap = await db.collection("manual_payments").where("status", "==", "pending").get();
  pendingPayments = paymentsSnap.size;

  const usersSnap = await db.collection("users").get();
  usersSnap.forEach((doc) => {
    const data = doc.data();
    const plan = data.subscriptionPlan || "none";
    const trialExp = data.trialExpiresAt ? new Date(data.trialExpiresAt) : null;
    const subExp = data.subscriptionExpiresAt ? new Date(data.subscriptionExpiresAt) : null;

    if (!PAID_PLANS.has(plan) && trialExp && trialExp >= startOfToday && trialExp < endOfToday) {
      trialsExpiringToday++;
    }
    if (PAID_PLANS.has(plan) && subExp && subExp >= now && subExp <= weekFromNow) {
      subsExpiringThisWeek++;
    }
  });

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
