import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { sendSubscriptionExpiredEmail } from "@/lib/email";
import { saveSystemSettings } from "@/lib/admin-settings";
import { logAdminActivity } from "@/lib/admin-activity";

const PAID_PLANS = ["solo", "studio", "team", "nano", "ultra"];

function planDisplayName(plan: string) {
  if (plan === "solo" || plan === "studio" || plan === "nano") return "Solo";
  if (plan === "team" || plan === "ultra") return "Team";
  return plan;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("Authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      const { isAdminUiRequest } = await import("@/lib/admin");
      if (!(await isAdminUiRequest(request))) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
  }

  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const snapshot = await db.collection("users").get();

    let expiredCount = 0;
    let trialExpiredCount = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const email = doc.id;
      const plan = data.subscriptionPlan || "none";

      if (PAID_PLANS.includes(plan) && data.subscriptionExpiresAt) {
        const expiryDate = new Date(data.subscriptionExpiresAt);
        if (expiryDate < now && data.expirationEmailSent !== true) {
          try {
            await sendSubscriptionExpiredEmail(email, planDisplayName(plan));
            batch.update(doc.ref, {
              expirationEmailSent: true,
              subscriptionPlan: "none",
            });
            expiredCount++;
          } catch (emailErr) {
            console.error("Failed to send expiration email to", email, emailErr);
          }
        }
      } else if (plan === "trial" && data.trialExpiresAt) {
        const trialExpiry = new Date(data.trialExpiresAt);
        if (trialExpiry < startOfToday && !data.trialExpiredProcessed) {
          batch.update(doc.ref, {
            trialExpiredProcessed: true,
            subscriptionPlan: "none",
          });
          trialExpiredCount++;
        }
      }
    }

    if (expiredCount + trialExpiredCount > 0) {
      await batch.commit();
    }

    await saveSystemSettings({
      cronLastRun: now.toISOString(),
      cronLastResult: "success",
    });
    await logAdminActivity({
      action: "cron_run",
      detail: `Processed ${expiredCount} expired subs, ${trialExpiredCount} expired trials`,
    });

    return NextResponse.json({
      success: true,
      message: `Checked expirations. Processed ${expiredCount} expired subscriptions and ${trialExpiredCount} expired trials.`,
      expiredCount,
      trialExpiredCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Cron Error:", error);
    await saveSystemSettings({ cronLastRun: new Date().toISOString(), cronLastResult: "failed" });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
