import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest, verifyAdminPassword } from "@/lib/admin";
import {
  getAdminAuthMode,
  getAdminRecoveryEmail,
  maskEmail,
  normalizeAdminAuthMode,
  setAdminPassword,
  validateAdminCredential,
  type AdminAuthMode,
} from "@/lib/admin-password-reset";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const recoveryEmail = await getAdminRecoveryEmail();
  const authMode = await getAdminAuthMode();
  return NextResponse.json({
    success: true,
    maskedEmail: recoveryEmail ? maskEmail(recoveryEmail) : "",
    authMode,
  });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const authMode: AdminAuthMode =
      normalizeAdminAuthMode(body.authMode) ||
      (await getAdminAuthMode());

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    if (!(await verifyAdminPassword(currentPassword))) {
      return NextResponse.json({ success: false, error: "Incorrect current password" }, { status: 400 });
    }

    const check = validateAdminCredential(newPassword, authMode);
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: 400 });
    }

    await setAdminPassword(newPassword, authMode);

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
      authMode,
    });
  } catch (error) {
    console.error("Admin password update error:", error);
    return NextResponse.json(
      { success: false, error: "Could not update password. Try again." },
      { status: 500 },
    );
  }
}
