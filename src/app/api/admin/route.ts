import { NextRequest, NextResponse } from "next/server";
import {
  adminCookieOptions,
  createAdminToken,
  isAdminPasswordConfigured,
  isAdminUiRequest,
  issueAdminSyncKey,
  revokeAdminSyncKey,
  verifyAdminPassword,
  ADMIN_COOKIE,
} from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";

export async function GET() {
  const ok = await isAdminUiRequest();
  return NextResponse.json({ success: true, admin: ok });
}

export async function POST(request: NextRequest) {
  try {
    let body: { password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request" },
        { status: 400 },
      );
    }

    if (!(await isAdminPasswordConfigured())) {
      return NextResponse.json(
        {
          success: false,
          error: "Admin password is not configured. Add FLOWBRIDGE_ADMIN_PASSWORD in Vercel.",
        },
        { status: 503 },
      );
    }

    if (!(await verifyAdminPassword(String(body.password || "")))) {
      return NextResponse.json(
        { success: false, error: "Wrong admin password." },
        { status: 401 },
      );
    }

    const token = await createAdminToken();
    const syncKey = await issueAdminSyncKey();
    const response = NextResponse.json({
      success: true,
      admin: true,
      sync_key: syncKey,
    });
    response.cookies.set(adminCookieOptions(token));
    await logAdminActivity({ action: "admin_login" });
    return response;
  } catch (error) {
    console.error("Admin unlock error:", error);
    return NextResponse.json(
      { success: false, error: "Server error during admin unlock." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    await revokeAdminSyncKey();
    await logAdminActivity({ action: "admin_logout" });
    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: ADMIN_COOKIE,
      value: "",
      httpOnly: true,
      path: "/",
      maxAge: 0,
      sameSite: "strict",
    });
    return response;
  } catch (error) {
    console.error("Admin logout error:", error);
    return NextResponse.json(
      { success: false, error: "Server error during admin logout." },
      { status: 500 },
    );
  }
}
