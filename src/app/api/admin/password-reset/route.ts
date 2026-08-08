import { NextRequest, NextResponse } from "next/server";
import { sendAdminPasswordResetEmail } from "@/lib/email";
import {
  ADMIN_RESET_CODE_LENGTH,
  canRequestPasswordReset,
  clearPasswordResetCode,
  generateResetCode,
  getAdminAuthMode,
  getAdminRecoveryEmail,
  maskEmail,
  normalizeAdminAuthMode,
  setAdminPassword,
  storePasswordResetCode,
  validateAdminCredential,
  verifyPasswordResetCode,
  type AdminAuthMode,
} from "@/lib/admin-password-reset";
import { checkAuthRateLimit, clientIpFromRequest } from "@/lib/auth-rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const recoveryEmail = await getAdminRecoveryEmail();
  const authMode = await getAdminAuthMode();
  return NextResponse.json({
    success: true,
    maskedEmail: recoveryEmail ? maskEmail(recoveryEmail) : "",
    authMode,
    resetCodeLength: ADMIN_RESET_CODE_LENGTH,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "request_code") {
      const recoveryEmail = await getAdminRecoveryEmail();
      if (!recoveryEmail) {
        return NextResponse.json(
          {
            success: false,
            error: "Recovery email is not configured. Set ADMIN_RECOVERY_EMAIL.",
          },
          { status: 503 },
        );
      }

      const rate = await canRequestPasswordReset();
      if (!rate.ok) {
        return NextResponse.json(
          {
            success: false,
            error: `Please wait ${rate.waitSeconds}s before requesting another code.`,
          },
          { status: 429 },
        );
      }

      const code = generateResetCode();
      await storePasswordResetCode(code);

      const sent = await sendAdminPasswordResetEmail(recoveryEmail, code);
      if (!sent) {
        await clearPasswordResetCode();
        return NextResponse.json(
          {
            success: false,
            error: "Could not send email. Configure SMTP on the server first.",
          },
          { status: 503 },
        );
      }

      return NextResponse.json({
        success: true,
        message: `Reset code sent to ${maskEmail(recoveryEmail)}.`,
        maskedEmail: maskEmail(recoveryEmail),
        authMode: await getAdminAuthMode(),
        resetCodeLength: ADMIN_RESET_CODE_LENGTH,
      });
    }

    if (action === "confirm_reset") {
      const ip = clientIpFromRequest(request);
      const rate = await checkAuthRateLimit("admin_reset_confirm", ip);
      if (!rate.ok) {
        return NextResponse.json(
          { success: false, error: rate.error },
          {
            status: 429,
            headers: rate.retryAfterSeconds
              ? { "Retry-After": String(rate.retryAfterSeconds) }
              : undefined,
          },
        );
      }

      const code = String(body.code || "").trim();
      const newPassword = String(body.newPassword || "");
      const authMode: AdminAuthMode =
        normalizeAdminAuthMode(body.authMode) || (await getAdminAuthMode());

      const digits = code.replace(/\D/g, "");
      if (!digits || digits.length !== ADMIN_RESET_CODE_LENGTH) {
        return NextResponse.json(
          {
            success: false,
            error: `Enter the ${ADMIN_RESET_CODE_LENGTH}-digit code from your email.`,
          },
          { status: 400 },
        );
      }

      const check = validateAdminCredential(newPassword, authMode);
      if (!check.ok) {
        return NextResponse.json({ success: false, error: check.error }, { status: 400 });
      }

      if (String(body.confirmPassword || "") !== newPassword) {
        return NextResponse.json(
          { success: false, error: "Passwords do not match." },
          { status: 400 },
        );
      }

      const valid = await verifyPasswordResetCode(digits);
      if (!valid.ok) {
        return NextResponse.json(
          {
            success: false,
            error: valid.locked
              ? "Too many invalid attempts. Request a new code."
              : "Invalid or expired code. Request a new one.",
          },
          { status: 400 },
        );
      }

      await setAdminPassword(newPassword, authMode);
      await clearPasswordResetCode();

      return NextResponse.json({
        success: true,
        message:
          authMode === "pin"
            ? "PIN reset successfully. You can log in now."
            : "Password reset successfully. You can log in now.",
        authMode,
      });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Admin password reset error:", error);
    return NextResponse.json(
      { success: false, error: "Password reset failed. Try again." },
      { status: 500 },
    );
  }
}
