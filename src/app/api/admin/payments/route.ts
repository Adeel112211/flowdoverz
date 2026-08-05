import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/firebase-admin";
import { sendAccountActivatedEmail, sendPaymentRejectedEmail } from "@/lib/email";

// GET all payments
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await isAdminRequest(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    const snapshot = await db.collection("manual_payments")
      .orderBy("createdAt", "desc")
      .get();
      
    const payments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ success: true, payments });
  } catch (error: any) {
    console.error("Fetch Manual Payments Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST to approve or reject a payment
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await isAdminRequest(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    const body = await request.json();
    const { paymentId, action } = body;

    if (!paymentId || !["approve", "reject", "refund"].includes(action)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const paymentRef = db.collection("manual_payments").doc(paymentId);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const paymentData = paymentDoc.data();
    if (!paymentData) {
      return NextResponse.json({ error: "Payment data missing" }, { status: 500 });
    }
    
    // For approve/reject, it must be pending. For refund, it can be approved.
    if ((action === "approve" || action === "reject") && paymentData?.status !== "pending") {
      return NextResponse.json({ error: "Payment is already processed" }, { status: 400 });
    }
    
    if (action === "refund" && paymentData?.status !== "approved") {
      return NextResponse.json({ error: "Only approved payments can be refunded" }, { status: 400 });
    }

    if (action === "approve") {
      // 1. Update user subscription
      const userEmail = paymentData.userEmail;
      const planId = paymentData.planId;
      
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const userRef = db.collection("users").doc(userEmail);
      await userRef.update({
        subscriptionPlan: planId,
        subscriptionExpiresAt: expiresAt,
        expirationEmailSent: false, // Reset this so they get notified next time they expire
      });

      // 2. Mark payment as approved
      await paymentRef.update({
        status: "approved",
        processedAt: new Date().toISOString()
      });

      // 3. Send activation email
      const planName = planId === "solo" ? "Solo" : planId === "team" ? "Team" : "Premium";
      await sendAccountActivatedEmail(userEmail, planName, now.toISOString(), expiresAt).catch(console.error);

      return NextResponse.json({ success: true, message: "Payment approved and subscription activated." });
    } else if (action === "reject") {
      // Reject
      await paymentRef.update({
        status: "rejected",
        processedAt: new Date().toISOString()
      });

      // Send rejection email
      const userEmail = paymentData.userEmail;
      const planId = paymentData.planId;
      const planName = planId === "solo" ? "Solo" : planId === "team" ? "Team" : "Premium";
      await sendPaymentRejectedEmail(userEmail, planName).catch(console.error);

      return NextResponse.json({ success: true, message: "Payment rejected." });
    } else if (action === "refund") {
      // Refund
      await paymentRef.update({
        status: "refunded",
        processedAt: new Date().toISOString()
      });

      // Revoke subscription
      const userEmail = paymentData.userEmail;
      const userRef = db.collection("users").doc(userEmail);
      await userRef.update({
        subscriptionPlan: "trial", // Revert back to trial
      });

      return NextResponse.json({ success: true, message: "Payment refunded and subscription revoked." });
    }
  } catch (error: any) {
    console.error("Process Manual Payment Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
