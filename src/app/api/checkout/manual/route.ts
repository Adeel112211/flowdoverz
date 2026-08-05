import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { emailFromSid } from "@/lib/cookie-store";
import { getDb } from "@/lib/firebase-admin";
import { sendPaymentPendingEmail, sendAdminNotificationEmail } from "@/lib/email";

const SID_COOKIE = "flowdoverz_sid";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SID_COOKIE)?.value;

    if (!sid) {
      return NextResponse.json(
        { success: false, code: "NOT_LOGGED_IN", error: "You must be signed in to purchase a plan." },
        { status: 401 }
      );
    }

    const email = emailFromSid(sid).startsWith("sid:")
      ? emailFromSid(sid).slice(4)
      : emailFromSid(sid);

    const db = getDb();
    if (!email || !db) {
      return NextResponse.json(
        { success: false, error: "Database not available or invalid session." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { planId, transactionId, screenshot } = body;

    if (!["solo", "team"].includes(planId)) {
      return NextResponse.json({ success: false, error: "Invalid plan selected." }, { status: 400 });
    }

    if (!transactionId || typeof transactionId !== "string") {
      return NextResponse.json({ success: false, error: "Transaction ID is required." }, { status: 400 });
    }

    if (!screenshot || typeof screenshot !== "string") {
      return NextResponse.json({ success: false, error: "Payment screenshot is required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    // Save to manual_payments collection
    const paymentsRef = db.collection("manual_payments");
    const payload: any = {
      userEmail: normalizedEmail,
      planId,
      transactionId,
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
