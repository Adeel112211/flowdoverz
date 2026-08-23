import { NextRequest, NextResponse } from "next/server";
import { publicMaintenanceResponse } from "@/lib/maintenance";
import { changeResellerPanelPassword } from "@/lib/reseller-store";
import { clearResellerCookieOptions, getResellerSession } from "@/lib/reseller-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const maintenance = await publicMaintenanceResponse();
  if (maintenance) return maintenance;

  const reseller = await getResellerSession();
  if (!reseller) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string } = {};
  try {
    body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }

  const result = await changeResellerPanelPassword(
    reseller.id,
    String(body.currentPassword || ""),
    String(body.newPassword || ""),
  );
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  const response = NextResponse.json({
    success: true,
    message: "Password updated. Sign in again with the new password.",
  });
  response.cookies.set(clearResellerCookieOptions());
  return response;
}
