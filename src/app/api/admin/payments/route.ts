import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function errorResponse(error: unknown, fallback: string, status = 500) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : fallback;

  console.error(fallback, error);
  return NextResponse.json({ success: false, error: message || fallback }, { status });
}

async function requireFirebaseDb() {
  const { getDb, isFirebaseConfigured, getFirebaseInitError } = await import("@/lib/firebase-admin");

  if (!isFirebaseConfigured()) {
    return {
      db: null,
      response: NextResponse.json(
        {
          success: false,
          error:
            "Firebase is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY on Vercel.",
        },
        { status: 503 },
      ),
    };
  }

  const db = getDb();
  if (!db) {
    return {
      db: null,
      response: NextResponse.json(
        {
          success: false,
          error:
            getFirebaseInitError() ||
            "Firebase failed to initialize. Paste the full service account JSON into FIREBASE_SERVICE_ACCOUNT_JSON on Vercel.",
        },
        { status: 503 },
      ),
    };
  }

  return { db, response: null };
}

function serializePayment(
  normalizeFirestoreDoc: (data: Record<string, unknown> | undefined) => Record<string, unknown>,
  id: string,
  raw: Record<string, unknown>,
  includeScreenshot = false,
  screenshotDataUrl: string | null = null,
) {
  const data = normalizeFirestoreDoc(raw);
  const screenshot = screenshotDataUrl ?? data.screenshot;
  const rest = { ...data };
  delete rest.screenshot;

  return {
    id,
    ...rest,
    hasScreenshot: Boolean(screenshot || data.storagePath || data.hasScreenshot),
    ...(includeScreenshot && screenshot ? { screenshot: String(screenshot) } : {}),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { isAdminUiRequest } = await import("@/lib/admin");
    const { normalizeFirestoreDoc } = await import("@/lib/firestore-utils");

    if (!(await isAdminUiRequest(request))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { db, response } = await requireFirebaseDb();
    if (response) return response;

    const paymentId = request.nextUrl.searchParams.get("id");
    const userEmail = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();

    if (paymentId) {
      const doc = await db!.collection("manual_payments").doc(paymentId).get();
      if (!doc.exists) {
        return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
      }

      const raw = (doc.data() || {}) as Record<string, unknown>;
      const { loadPaymentScreenshotDataUrl } = await import("@/lib/payment-screenshot-storage");
      const screenshotDataUrl = await loadPaymentScreenshotDataUrl(raw);

      return NextResponse.json({
        success: true,
        payment: serializePayment(
          normalizeFirestoreDoc,
          doc.id,
          raw,
          true,
          screenshotDataUrl,
        ),
      });
    }

    const status = request.nextUrl.searchParams.get("status")?.trim();
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 100) || 100, 200);

    let paymentsQuery = userEmail
      ? db!.collection("manual_payments").where("userEmail", "==", userEmail)
      : db!.collection("manual_payments");
    if (status && ["pending", "approved", "rejected", "refunded"].includes(status)) {
      paymentsQuery = paymentsQuery.where("status", "==", status);
    }

    let snapshot;
    try {
      snapshot = await paymentsQuery.orderBy("createdAt", "desc").limit(limit).get();
    } catch {
      snapshot = await paymentsQuery.limit(limit).get();
    }

    const { getUserNamesByEmail } = await import("@/lib/admin-users-query");
    const emails = snapshot.docs
      .map((doc) => String((doc.data() || {}).userEmail || "").toLowerCase())
      .filter(Boolean);
    const userNames = await getUserNamesByEmail(db!, emails);

    const payments = snapshot.docs
      .map((doc) => {
        const raw = (doc.data() || {}) as Record<string, unknown>;
        const p = serializePayment(
          normalizeFirestoreDoc,
          doc.id,
          raw,
        );
        return {
          ...p,
          userName: typeof raw.userEmail === "string" ? userNames.get(raw.userEmail.toLowerCase()) || null : null,
        };
      })
      .sort((a, b) => {
        const aTime = Date.parse(String((a as { createdAt?: string }).createdAt || 0));
        const bTime = Date.parse(String((b as { createdAt?: string }).createdAt || 0));
        return bTime - aTime;
      });

    return NextResponse.json({ success: true, payments });
  } catch (error) {
    return errorResponse(error, "Failed to fetch payments");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { isAdminUiRequest } = await import("@/lib/admin");
    const { sendAccountActivatedEmail, sendPaymentReceiptEmail, sendPaymentRefundReceiptEmail, sendPaymentRejectedEmail } = await import("@/lib/email");
    const { generateReceiptNumber, generateRefundReceiptNumber, planAmountPkr, planDisplayName } = await import("@/lib/receipt-utils");
    const { getPricingConfig } = await import("@/lib/pricing-store");

    if (!(await isAdminUiRequest(request))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { db, response } = await requireFirebaseDb();
    if (response) return response;

    const body = await request.json();
    const { paymentId, action } = body;

    if (!paymentId || !["approve", "reject", "refund"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
    }

    const paymentRef = db!.collection("manual_payments").doc(paymentId);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
    }

    const paymentData = paymentDoc.data();
    if (!paymentData) {
      return NextResponse.json({ success: false, error: "Payment data missing" }, { status: 500 });
    }

    if ((action === "approve" || action === "reject") && paymentData.status !== "pending") {
      return NextResponse.json({ success: false, error: "Payment is already processed" }, { status: 400 });
    }

    if (action === "refund" && paymentData.status !== "approved") {
      return NextResponse.json({ success: false, error: "Only approved payments can be refunded" }, { status: 400 });
    }

    if (action === "approve") {
      const userEmail = paymentData.userEmail;
      const planId = paymentData.planId;

      const { getPlanActivationBlock } = await import("@/lib/user-store");
      const activationBlock = await getPlanActivationBlock(String(userEmail), {
        excludePaymentId: paymentId,
      });
      if (activationBlock) {
        return NextResponse.json({ success: false, error: activationBlock.error }, { status: 400 });
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const receiptNumber = generateReceiptNumber();
      const pricing = await getPricingConfig();
      const amountPkr = planAmountPkr(String(planId), pricing.plans);
      const planName = planDisplayName(String(planId));

      const userDoc = await db!.collection("users").doc(userEmail).get();
      const userData = userDoc.data() || {};
      const userName = String(userData.name || userEmail.split("@")[0] || "Customer");
      const accountNumber = String(paymentData.transactionId || "N/A");

      await db!.collection("users").doc(userEmail).update({
        subscriptionPlan: planId,
        subscriptionExpiresAt: expiresAt,
        expirationEmailSent: false,
      });

      await paymentRef.update({
        status: "approved",
        processedAt: now.toISOString(),
        receiptNumber,
        amountPkr,
        expiryAt: expiresAt,
      });

      const { stripPaymentScreenshotFields } = await import("@/lib/payment-screenshot-storage");
      await stripPaymentScreenshotFields(paymentRef, paymentData as Record<string, unknown>);

      await sendAccountActivatedEmail(userEmail, planName, now.toISOString(), expiresAt).catch(console.error);
      await sendPaymentReceiptEmail({
        email: userEmail,
        userName,
        accountNumber,
        receiptNumber,
        planName,
        amountPkr,
        transactionId: String(paymentData.transactionId || "N/A"),
        paymentDate: now.toISOString(),
        expiryDate: expiresAt,
      }).catch(console.error);

      const { logAdminActivity } = await import("@/lib/admin-activity");
      await logAdminActivity({ action: "payment_approved", targetEmail: userEmail, detail: `Approved ${planId} payment` });
      const { touchLive } = await import("@/lib/live-tick");
      void touchLive({ topic: "payment", action: "approved", id: paymentId, userId: userEmail });
      void touchLive({ topic: "user", action: "updated", id: userEmail, userId: userEmail });
      const { recordPaymentStatusChange, recordActiveSubscriptionDelta } = await import("@/lib/admin-metrics");
      void recordPaymentStatusChange({ from: paymentData.status, to: "approved", planId: String(planId || "") });
      void recordActiveSubscriptionDelta(1);

      return NextResponse.json({ success: true, message: "Payment approved and subscription activated." });
    }

    if (action === "reject") {
      await paymentRef.update({
        status: "rejected",
        processedAt: new Date().toISOString(),
      });

      const { stripPaymentScreenshotFields } = await import("@/lib/payment-screenshot-storage");
      await stripPaymentScreenshotFields(paymentRef, paymentData as Record<string, unknown>);

      const userEmail = paymentData.userEmail;
      const planId = paymentData.planId;
      const planName = planId === "solo" ? "Solo" : planId === "team" ? "Team" : "Premium";
      await sendPaymentRejectedEmail(userEmail, planName).catch(console.error);

      const { logAdminActivity } = await import("@/lib/admin-activity");
      await logAdminActivity({ action: "payment_rejected", targetEmail: userEmail });
      const { touchLive } = await import("@/lib/live-tick");
      void touchLive({ topic: "payment", action: "rejected", id: paymentId, userId: userEmail });
      void touchLive({ topic: "user", action: "updated", id: userEmail, userId: userEmail });
      const { recordPaymentStatusChange } = await import("@/lib/admin-metrics");
      void recordPaymentStatusChange({ from: paymentData.status, to: "rejected", planId: String(planId || "") });

      return NextResponse.json({ success: true, message: "Payment rejected." });
    }

    const userEmail = paymentData.userEmail;
    const planId = String(paymentData.planId || "");
    const now = new Date();
    const refundReceiptNumber = generateRefundReceiptNumber();
    const pricing = await getPricingConfig();
    const amountPkr = Number(paymentData.amountPkr) || planAmountPkr(planId, pricing.plans);
    const planName = planDisplayName(planId);
    const receiptNumber = String(paymentData.receiptNumber || "N/A");
    const paymentDate = String(paymentData.processedAt || paymentData.createdAt || now.toISOString());

    const userDoc = await db!.collection("users").doc(userEmail).get();
    const userData = userDoc.data() || {};
    const userName = String(userData.name || userEmail.split("@")[0] || "Customer");
    const accountNumber = String(paymentData.transactionId || "N/A");

    await paymentRef.update({
      status: "refunded",
      refundedAt: now.toISOString(),
      refundReceiptNumber,
    });

    await db!.collection("users").doc(userEmail).update({
      subscriptionPlan: "none",
      subscriptionExpiresAt: null,
    });

    await sendPaymentRefundReceiptEmail({
      email: userEmail,
      userName,
      accountNumber,
      receiptNumber,
      refundReceiptNumber,
      planName,
      amountPkr,
      transactionId: accountNumber,
      paymentDate,
      refundDate: now.toISOString(),
    }).catch(console.error);

    const { logAdminActivity } = await import("@/lib/admin-activity");
    await logAdminActivity({ action: "payment_refunded", targetEmail: userEmail });
    const { touchLive } = await import("@/lib/live-tick");
    void touchLive({ topic: "payment", action: "refunded", id: paymentId, userId: userEmail });
    void touchLive({ topic: "user", action: "updated", id: userEmail, userId: userEmail });
    const { recordPaymentStatusChange, recordActiveSubscriptionDelta } = await import("@/lib/admin-metrics");
    void recordPaymentStatusChange({ from: "approved", to: "refunded", planId });
    void recordActiveSubscriptionDelta(-1);

    return NextResponse.json({ success: true, message: "Payment refunded, subscription revoked, and refund receipt sent." });
  } catch (error) {
    return errorResponse(error, "Failed to process payment");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { isAdminUiRequest } = await import("@/lib/admin");

    if (!(await isAdminUiRequest(request))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { db, response } = await requireFirebaseDb();
    if (response) return response;

    const paymentId = request.nextUrl.searchParams.get("id")?.trim();
    if (!paymentId) {
      return NextResponse.json({ success: false, error: "Payment id is required." }, { status: 400 });
    }

    const ref = db!.collection("manual_payments").doc(paymentId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: "Payment not found." }, { status: 404 });
    }

    const data = (snap.data() || {}) as { userEmail?: string; status?: string; storagePath?: string; screenshot?: string };
    const { deletePaymentScreenshotBlob } = await import("@/lib/payment-screenshot-storage");
    await deletePaymentScreenshotBlob(data);
    await ref.delete();

    const { logAdminActivity } = await import("@/lib/admin-activity");
    await logAdminActivity({
      action: "payment_rejected",
      targetEmail: String(data.userEmail || ""),
      detail: `Deleted payment record ${paymentId} (${String(data.status || "unknown")}).`,
    });

    const { touchLive } = await import("@/lib/live-tick");
    void touchLive({
      topic: "payment",
      action: "deleted",
      id: paymentId,
      userId: String(data.userEmail || ""),
    });

    return NextResponse.json({ success: true, message: "Payment record deleted from database." });
  } catch (error) {
    return errorResponse(error, "Failed to delete payment");
  }
}
