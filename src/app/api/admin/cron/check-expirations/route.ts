import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase-admin";
import { sendSubscriptionExpiredEmail } from "@/lib/email";
import { saveSystemSettings } from "@/lib/admin-settings";
import { logAdminActivity } from "@/lib/admin-activity";

const PAID_PLANS = ["solo", "studio", "team", "nano", "ultra"];
const PAGE_SIZE = 200;
const LOCK_TTL_MS = 10 * 60 * 1000;
const LOCK_REF = { collection: "settings", id: "cron_lock" };

function planDisplayName(plan: string) {
  if (plan === "solo" || plan === "studio" || plan === "nano") return "Solo";
  if (plan === "team" || plan === "ultra") return "Team";
  return plan;
}

async function acquireCronLock(db: Firestore) {
  const owner = randomBytes(8).toString("hex");
  const ref = db.collection(LOCK_REF.collection).doc(LOCK_REF.id);
  const acquired = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};
    const started = Date.parse(String(data.startedAt || "")) || 0;
    if (data.running === true && Date.now() - started < LOCK_TTL_MS) return false;
    tx.set(ref, { running: true, startedAt: new Date().toISOString(), owner });
    return true;
  });
  return acquired ? owner : null;
}

async function releaseCronLock(db: Firestore, owner: string) {
  const ref = db.collection(LOCK_REF.collection).doc(LOCK_REF.id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.data()?.owner !== owner) return;
    tx.set(ref, { running: false, owner: null, finishedAt: new Date().toISOString() }, { merge: true });
  });
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "CRON_SECRET is not configured." },
        { status: 503 },
      );
    }
  } else {
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

  const owner = await acquireCronLock(db);
  if (!owner) {
    return NextResponse.json({
      success: true,
      skipped: true,
      message: "Expiration job already running.",
    });
  }

  try {
    const now = new Date();
    const nowIso = now.toISOString();
    let expiredCount = 0;
    let trialExpiredCount = 0;

    const paidSnap = await db
      .collection("users")
      .where("subscriptionPlan", "in", PAID_PLANS)
      .where("subscriptionExpiresAt", "<", nowIso)
      .limit(PAGE_SIZE)
      .get();

    for (const doc of paidSnap.docs) {
      const claimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        const data = fresh.data();
        if (!data || data.expirationEmailSent === true) return null;
        const plan = String(data.subscriptionPlan || "none");
        if (!PAID_PLANS.includes(plan)) return null;
        if (!data.subscriptionExpiresAt || new Date(String(data.subscriptionExpiresAt)) >= now) return null;
        tx.update(doc.ref, {
          expirationEmailSent: true,
          subscriptionPlan: "none",
        });
        return { email: fresh.id, plan };
      });
      if (!claimed) continue;
      expiredCount += 1;
      await sendSubscriptionExpiredEmail(claimed.email, planDisplayName(claimed.plan)).catch((emailErr) => {
        console.error("Failed to send expiration email to", claimed.email, emailErr);
      });
    }

    const trialSnap = await db
      .collection("users")
      .where("subscriptionPlan", "==", "trial")
      .where("trialExpiresAt", "<", nowIso)
      .limit(PAGE_SIZE)
      .get();

    for (const doc of trialSnap.docs) {
      const claimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        const data = fresh.data();
        if (!data || data.trialExpiredProcessed === true) return false;
        if (String(data.subscriptionPlan || "") !== "trial") return false;
        if (!data.trialExpiresAt || new Date(String(data.trialExpiresAt)) >= now) return false;
        tx.update(doc.ref, {
          trialExpiredProcessed: true,
          subscriptionPlan: "none",
        });
        return true;
      });
      if (claimed) trialExpiredCount += 1;
    }

    if (expiredCount + trialExpiredCount > 0) {
      const { touchLive } = await import("@/lib/live-tick");
      void touchLive({ topic: "user", action: "updated" });
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
  } finally {
    await releaseCronLock(db, owner).catch(() => undefined);
  }
}
