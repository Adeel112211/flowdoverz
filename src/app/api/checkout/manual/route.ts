import { NextRequest, NextResponse } from "next/server";
import { getClientSessionFromCookies } from "@/lib/client-session";
import { getDb } from "@/lib/firebase-admin";
import { sendPaymentPendingEmail, sendAdminNotificationEmail } from "@/lib/email";
import { senderPaymentLabel, SENDER_PAYMENT_OPTIONS } from "@/lib/sender-payment-options";
import { CHECKOUT_PAYMENT_METHODS } from "@/lib/payment-methods-config";
import { validateSenderAccountNumber } from "@/lib/sender-account-validation";
import { getPlanActivationBlock } from "@/lib/user-store";

export async function POST(request: NextRequest) {
  try {
    const session = await getClientSessionFromCookies();
    if (!session) {
      return NextResponse.json(
        { success: false, code: "NOT_LOGGED_IN", error: "You must be signed in to purchase a plan." },
        { status: 401 }
      );
    }

    const email = session.email;

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
    
    // Save to manual_payments collection
    const paymentsRef = db.collection("manual_payments");
    const payload: Record<string, string> = {
      userEmail: normalizedEmail,
      planId,
      transactionId: accountCheck.normalized,
      senderPaymentSource,
      senderPaymentSourceLabel: senderPaymentLabel(senderPaymentSource),
      payToMethodId,
      payToMethodLabel: payToMethod.name,
      screenshot,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    
    await paymentsRef.add(payload);

    // Update user to pending status
    const userRef = db.collection("users").doc(normalizedEmail);
    await userRef.update({
      subscriptionPlan: "pending",
    });

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
