import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { emailFromSid } from "@/lib/cookie-store";
import { getDb } from "@/lib/firebase-admin";

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
    const { planId } = body;

    if (!["studio", "team"].includes(planId)) {
      return NextResponse.json({ success: false, error: "Invalid plan selected." }, { status: 400 });
    }

    // Mock checkout: immediately grant 30 days of access
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const normalizedEmail = email.trim().toLowerCase();
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
