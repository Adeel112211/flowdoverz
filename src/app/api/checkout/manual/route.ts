import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { sendPaymentPendingEmail, sendAdminNotificationEmail } from "@/lib/email";
import { senderPaymentLabel, SENDER_PAYMENT_OPTIONS } from "@/lib/sender-payment-options";
import { CHECKOUT_PAYMENT_METHODS } from "@/lib/payment-methods-config";
import { validateSenderAccountNumber } from "@/lib/sender-account-validation";
import { requireActiveClientSession } from "@/lib/require-client-session";
import { getPlanActivationBlock } from "@/lib/user-store";
import { publicMaintenanceResponse } from "@/lib/maintenance";

export async function POST(request: NextRequest) {
  const maintenance = await publicMaintenanceResponse();
  if (maintenance) return maintenance;

  try {
    const gate = await requireActiveClientSession();
    if (!gate.ok) return gate.response;

    const email = gate.email;

    const db = getDb();
    if (!email || !db) {
      return NextResponse.json(
        { success: false, error: "Database not available or invalid session." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { planId, transactionId, screenshot, senderPaymentSource, payToMethodId } = body;

    if (!["solo", "team"].includes(planId)) {
      return NextResponse.json({ success: false, error: "Invalid plan selected." }, { status: 400 });
    }

    if (!payToMethodId || typeof payToMethodId !== "string") {
      return NextResponse.json(
        { success: false, error: "Please select a payment account in Step 1." },
        { status: 400 }
      );
    }

    const payToMethod = CHECKOUT_PAYMENT_METHODS.find((method) => method.id === payToMethodId);
    if (!payToMethod) {
      return NextResponse.json({ success: false, error: "Invalid payment account selected." }, { status: 400 });
    }

    if (!senderPaymentSource || typeof senderPaymentSource !== "string") {
      return NextResponse.json(
        { success: false, error: "Please select the account or app you sent payment from." },
        { status: 400 }
      );
    }

    if (!SENDER_PAYMENT_OPTIONS.some((option) => option.id === senderPaymentSource)) {
      return NextResponse.json({ success: false, error: "Invalid payment source selected." }, { status: 400 });
    }

    if (!transactionId || typeof transactionId !== "string") {
      return NextResponse.json({ success: false, error: "Transaction ID is required." }, { status: 400 });
    }

    const accountCheck = validateSenderAccountNumber(transactionId, senderPaymentSource);
    if (!accountCheck.ok) {
      return NextResponse.json({ success: false, error: accountCheck.error }, { status: 400 });
    }

    if (!screenshot || typeof screenshot !== "string") {
      return NextResponse.json({ success: false, error: "Payment screenshot is required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const activationBlock = await getPlanActivationBlock(normalizedEmail);
    if (activationBlock) {
      return NextResponse.json(
        { success: false, code: activationBlock.code, error: activationBlock.error },
        { status: 400 },
      );
    }
    
    const paymentsRef = db.collection("manual_payments");
    const paymentRef = paymentsRef.doc();
    const payload: Record<string, string | boolean> = {
      userEmail: normalizedEmail,
      planId,
      transactionId: accountCheck.normalized,
      senderPaymentSource,
      senderPaymentSourceLabel: senderPaymentLabel(senderPaymentSource),
      payToMethodId,
      payToMethodLabel: payToMethod.name,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const {
      shouldStorePaymentScreenshotInStorage,
      savePaymentScreenshot,
      preparePaymentScreenshot,
    } = await import("@/lib/payment-screenshot-storage");

    const compressedScreenshot = await preparePaymentScreenshot(screenshot);

    if (shouldStorePaymentScreenshotInStorage()) {
      payload.storagePath = await savePaymentScreenshot(paymentRef.id, compressedScreenshot);
      payload.hasScreenshot = true;
    } else {
      payload.screenshot = compressedScreenshot;
      payload.hasScreenshot = true;
    }

    await paymentRef.set(payload);

    const added = paymentRef;

    // Update user to pending status
    const userRef = db.collection("users").doc(normalizedEmail);
    await userRef.update({
      subscriptionPlan: "pending",
    });

    const { touchLive } = await import("@/lib/live-tick");
    void touchLive({ topic: "payment", action: "created", id: added.id, userId: normalizedEmail });
    void touchLive({ topic: "user", action: "updated", id: normalizedEmail, userId: normalizedEmail });
    const { recordPaymentStatusChange } = await import("@/lib/admin-metrics");
    void recordPaymentStatusChange({ to: "pending", planId });

    // Send emails synchronously to prevent Next.js from terminating the request early
    await sendPaymentPendingEmail(normalizedEmail).catch(console.error);
    await sendAdminNotificationEmail(normalizedEmail, planId).catch(console.error);

    return NextResponse.json({
      success: true,
      message: "Payment submitted successfully. Pending verification.",
    });
  } catch (error: any) {
    console.error("Manual Checkout Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
