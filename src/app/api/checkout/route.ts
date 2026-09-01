import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
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
    const { planId } = body;

    if (!["studio", "team"].includes(planId)) {
      return NextResponse.json({ success: false, error: "Invalid plan selected." }, { status: 400 });
    }

    const { getSystemSettings, getSubscriptionDurationMs } = await import("@/lib/admin-settings");
    const settings = await getSystemSettings();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + getSubscriptionDurationMs(settings)).toISOString();

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
