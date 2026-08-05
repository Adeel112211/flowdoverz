import { NextRequest, NextResponse } from "next/server";
import {
  adminCookieOptions,
  createAdminToken,
  isAdminUiRequest,
  issueAdminSyncKey,
  revokeAdminSyncKey,
  verifyAdminPassword,
  ADMIN_COOKIE,
} from "@/lib/admin";

export async function GET() {
  const ok = await isAdminUiRequest();
  return NextResponse.json({ success: true, admin: ok });
}

export async function POST(request: NextRequest) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 },
    );
  }

  if (!(await verifyAdminPassword(String(body.password || "")))) {
    return NextResponse.json(
      { success: false, error: "Wrong admin password." },
      { status: 401 },
    );
  }

  const token = await createAdminToken();
  const syncKey = issueAdminSyncKey();
  const response = NextResponse.json({
    success: true,
    admin: true,
    // Extension-only secret — never shown in UI; content script picks it up from the bridge
    sync_key: syncKey,
  });
  response.cookies.set(adminCookieOptions(token));
  return response;
}

export async function DELETE() {
  revokeAdminSyncKey();
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
}
