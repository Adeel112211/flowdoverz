import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { getDb } from "@/lib/firebase-admin";
import { deleteClientCompletely } from "@/lib/client-data-cleanup";

export const dynamic = "force-dynamic";

const PAID_PLANS = ["solo", "studio", "team"];

export async function POST(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
  }

  const body = await request.json();
  const emails: string[] = Array.isArray(body.emails) ? body.emails : [];
  const action = String(body.action || "");

  if (action === "delete") {
    if (!emails.length) {
      return NextResponse.json({ success: false, error: "No clients selected" }, { status: 400 });
    }
    const removed: Array<Awaited<ReturnType<typeof deleteClientCompletely>>> = [];
    for (const email of emails) {
      removed.push(await deleteClientCompletely(String(email || "")));
    }
    const { touchLive } = await import("@/lib/live-tick");
    for (const email of emails) {
      void touchLive({ topic: "user", action: "deleted", id: email, userId: email });
    }
    await logAdminActivity({
      action: "client_deleted",
      detail: `Bulk deleted ${removed.length} client(s) with related payments and logs.`,
    });
    return NextResponse.json({
      success: true,
      message: `Deleted ${removed.length} client(s) and related data.`,
      removed,
    });
  }

  if (!emails.length) {
    return NextResponse.json({ success: false, error: "No clients selected" }, { status: 400 });
  }

  const batch = db.batch();
  const now = Date.now();

  for (const email of emails) {
    const ref = db.collection("users").doc(email);
    const doc = await ref.get();
    if (!doc.exists) continue;
    const data = doc.data()!;

    if (action === "extend_trial_7") {
      const base = data.trialExpiresAt ? new Date(data.trialExpiresAt).getTime() : now;
      batch.update(ref, { trialExpiresAt: new Date(Math.max(base, now) + 7 * 86400000).toISOString() });
    } else if (action === "extend_sub_30") {
      const base = data.subscriptionExpiresAt ? new Date(data.subscriptionExpiresAt).getTime() : now;
      batch.update(ref, {
        subscriptionExpiresAt: new Date(Math.max(base, now) + 30 * 86400000).toISOString(),
        expirationEmailSent: false,
      });
    } else if (action === "set_plan_solo" || action === "set_plan_team") {
      const plan = action === "set_plan_solo" ? "solo" : "team";
      batch.update(ref, {
        subscriptionPlan: plan,
        subscriptionExpiresAt: new Date(now + 30 * 86400000).toISOString(),
        expirationEmailSent: false,
      });
    } else if (action === "suspend") {
      batch.update(ref, { suspended: true });
    } else if (action === "unsuspend") {
      batch.update(ref, { suspended: false });
    }
  }

  await batch.commit();
  await logAdminActivity({
    action: "client_updated",
    detail: `Bulk action: ${action} on ${emails.length} client(s)`,
  });

  return NextResponse.json({ success: true, message: `Updated ${emails.length} client(s).` });
}
