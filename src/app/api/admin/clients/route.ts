import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest } from "@/lib/admin";
import { getDb, getAdminAuth } from "@/lib/firebase-admin";
import { sendAccountActivatedEmail } from "@/lib/email";

export async function GET() {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
  }

  try {
    const snapshot = await db.collection("users").get();
    const clients = snapshot.docs.map(doc => ({
      email: doc.id,
      ...doc.data()
    }));
    return NextResponse.json({ success: true, clients });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { email, subscriptionPlan, trialExpiresAt, subscriptionExpiresAt } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (subscriptionPlan !== undefined) {
      updateData.subscriptionPlan = subscriptionPlan;
      if (["studio", "team"].includes(subscriptionPlan)) {
        updateData.expirationEmailSent = false;
      }
    }
    if (trialExpiresAt !== undefined) updateData.trialExpiresAt = trialExpiresAt;
    if (subscriptionExpiresAt !== undefined) updateData.subscriptionExpiresAt = subscriptionExpiresAt;

    await db.collection("users").doc(email).update(updateData);

    // If we manually upgraded them to a paid plan, send the activation email
    if (subscriptionPlan && ["studio", "team"].includes(subscriptionPlan)) {
      const planName = subscriptionPlan === "studio" ? "Studio" : "Team";
      await sendAccountActivatedEmail(email, planName).catch(console.error);
    }

    return NextResponse.json({ success: true, message: "Client updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
  }

  try {
    const email = request.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    await db.collection("users").doc(email).delete();

    const adminAuth = getAdminAuth();
    if (adminAuth) {
      try {
        const userRecord = await adminAuth.getUserByEmail(email);
        await adminAuth.deleteUser(userRecord.uid);
      } catch (authError: any) {
        console.warn("Auth deletion failed or user not found:", authError.message);
      }
    }

    return NextResponse.json({ success: true, message: "Client deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
