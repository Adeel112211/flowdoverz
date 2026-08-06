import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest } from "@/lib/admin";
import { getDb } from "@/lib/firebase-admin";
import { normalizeFirestoreDoc } from "@/lib/firestore-utils";
import { sendAccountActivatedEmail, sendPaymentRejectedEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializePayment(id: string, raw: Record<string, unknown>, includeScreenshot = false) {
  const data = normalizeFirestoreDoc(raw);
  const screenshot = data.screenshot;
  const rest = { ...data };
  delete rest.screenshot;

  return {
    id,
    ...rest,
    hasScreenshot: Boolean(screenshot),
    ...(includeScreenshot && screenshot ? { screenshot: String(screenshot) } : {}),
  };
}

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

// GET all payments (or one payment when ?id= is provided)
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminUiRequest(request))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database not available. Check Firebase env vars on Vercel." },
        { status: 503 },
      );
    }

    const paymentId = request.nextUrl.searchParams.get("id");

    if (paymentId) {
      const doc = await db.collection("manual_payments").doc(paymentId).get();
      if (!doc.exists) {
        return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        payment: serializePayment(doc.id, doc.data() as Record<string, unknown>, true),
      });
    }

    const snapshot = await db.collection("manual_payments").get();
    const payments = snapshot.docs
      .map((doc) => serializePayment(doc.id, (doc.data() || {}) as Record<string, unknown>))
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

// POST to approve or reject a payment
export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminUiRequest(request))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database not available. Check Firebase env vars on Vercel." },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { paymentId, action } = body;

    if (!paymentId || !["approve", "reject", "refund"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
    }

    const paymentRef = db.collection("manual_payments").doc(paymentId);
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

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const userRef = db.collection("users").doc(userEmail);
      await userRef.update({
        subscriptionPlan: planId,
        subscriptionExpiresAt: expiresAt,
        expirationEmailSent: false,
      });

      await paymentRef.update({
        status: "approved",
        processedAt: new Date().toISOString(),
      });

      const planName = planId === "solo" ? "Solo" : planId === "team" ? "Team" : "Premium";
      await sendAccountActivatedEmail(userEmail, planName, now.toISOString(), expiresAt).catch(console.error);

      return NextResponse.json({ success: true, message: "Payment approved and subscription activated." });
    }

    if (action === "reject") {
      await paymentRef.update({
        status: "rejected",
        processedAt: new Date().toISOString(),
      });

      const userEmail = paymentData.userEmail;
      const planId = paymentData.planId;
      const planName = planId === "solo" ? "Solo" : planId === "team" ? "Team" : "Premium";
      await sendPaymentRejectedEmail(userEmail, planName).catch(console.error);

      return NextResponse.json({ success: true, message: "Payment rejected." });
    }

    await paymentRef.update({
      status: "refunded",
      processedAt: new Date().toISOString(),
    });

    const userEmail = paymentData.userEmail;
    const userRef = db.collection("users").doc(userEmail);
    await userRef.update({
      subscriptionPlan: "trial",
    });

    return NextResponse.json({ success: true, message: "Payment refunded and subscription revoked." });
  } catch (error) {
    return errorResponse(error, "Failed to process payment");
  }
}
