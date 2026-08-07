import { NextRequest, NextResponse } from "next/server";
import { sendAdminPasswordResetEmail } from "@/lib/email";
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_RESET_CODE_LENGTH,
  canRequestPasswordReset,
  clearPasswordResetCode,
  generateResetCode,
  getAdminRecoveryEmail,
  maskEmail,
  setAdminPassword,
  storePasswordResetCode,
  verifyPasswordResetCode,
} from "@/lib/admin-password-reset";

export const dynamic = "force-dynamic";

export async function GET() {
  const recoveryEmail = await getAdminRecoveryEmail();
  return NextResponse.json({
    success: true,
    maskedEmail: maskEmail(recoveryEmail),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "request_code") {
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

      const recoveryEmail = await getAdminRecoveryEmail();
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
      });
    }

    if (action === "confirm_reset") {
      const code = String(body.code || "").trim();
      const newPassword = String(body.newPassword || "");

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

      if (newPassword.length < ADMIN_PASSWORD_MIN_LENGTH) {
        return NextResponse.json(
          {
            success: false,
            error: `New password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`,
          },
          { status: 400 },
        );
      }

      if (String(body.confirmPassword || "") !== newPassword) {
        return NextResponse.json(
          { success: false, error: "Passwords do not match." },
          { status: 400 },
        );
      }

      const valid = await verifyPasswordResetCode(digits);
      if (!valid) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired code. Request a new one." },
          { status: 400 },
        );
      }

      await setAdminPassword(newPassword);
      await clearPasswordResetCode();

      return NextResponse.json({
        success: true,
        message: "Password reset successfully. You can log in now.",
      });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password reset failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
