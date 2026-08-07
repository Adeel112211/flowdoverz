import { NextRequest, NextResponse } from "next/server";
import { getClientSessionFromCookies } from "@/lib/client-session";
import { getDb } from "@/lib/firebase-admin";
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
    const { planId } = body;

    if (!["studio", "team"].includes(planId)) {
      return NextResponse.json({ success: false, error: "Invalid plan selected." }, { status: 400 });
    }

    // Mock checkout: immediately grant 30 days of access
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const normalizedEmail = email.trim().toLowerCase();

    const activationBlock = await getPlanActivationBlock(normalizedEmail);
    if (activationBlock) {
      return NextResponse.json(
        { success: false, code: activationBlock.code, error: activationBlock.error },
        { status: 400 },
      );
    }

    const usersRef = db.collection("users");
    
    await usersRef.doc(normalizedEmail).update({
      subscriptionPlan: planId,
      subscriptionExpiresAt: expiresAt,
    });

    return NextResponse.json({
      success: true,
      message: "Subscription activated successfully.",
    });
  } catch (error: any) {
    console.error("Checkout Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
