import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest, verifyAdminPassword } from "@/lib/admin";
import {
  getAdminRecoveryEmail,
  maskEmail,
  setAdminPassword,
} from "@/lib/admin-password-reset";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const recoveryEmail = await getAdminRecoveryEmail();
  return NextResponse.json({
    success: true,
    maskedEmail: maskEmail(recoveryEmail),
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

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    if (!(await verifyAdminPassword(currentPassword))) {
      return NextResponse.json({ success: false, error: "Incorrect current password" }, { status: 400 });
    }

    await setAdminPassword(newPassword);

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
