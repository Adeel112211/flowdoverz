import { NextRequest, NextResponse } from "next/server";
import { canResendVerification, issueEmailVerification } from "@/lib/email-verification";
import { getDb } from "@/lib/firebase-admin";
import { normalizeEmail } from "@/lib/user-store";
import {
  checkSignupRateLimit,
  clientIpFromRequest,
  getSignupSecuritySettings,
} from "@/lib/signup-security";
import { getClientSessionFromCookies } from "@/lib/client-session";

export async function POST(request: NextRequest) {
  const security = await getSignupSecuritySettings();
  const ip = clientIpFromRequest(request);
  const rateCheck = await checkSignupRateLimit(ip, security.rateLimitPerHour, "send_code");
  if (!rateCheck.ok) {
    return NextResponse.json(
      { success: false, error: rateCheck.error },
      { status: 429 },
    );
  }

  const session = await getClientSessionFromCookies();
  if (!session) {
    return NextResponse.json({ success: false, error: "Sign in first." }, { status: 401 });
  }

  const email = normalizeEmail(session.email);
  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not configured." }, { status: 503 });
  }

  const userDoc = await db.collection("users").doc(email).get();
  if (!userDoc.exists) {
    return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
  }

  const user = userDoc.data();
  if (user?.emailVerified !== false) {
    return NextResponse.json({ success: true, message: "Email is already verified." });
  }

  const cooldown = await canResendVerification(email);
  if (!cooldown.ok) {
    return NextResponse.json(
      {
        success: false,
        error: `Please wait ${cooldown.waitSeconds}s before requesting another email.`,
      },
      { status: 429 },
    );
  }

  try {
    await issueEmailVerification(email, String(user?.name || email));
    return NextResponse.json({ success: true, message: "Verification email sent." });
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not send verification email." },
      { status: 503 },
    );
  }
}
