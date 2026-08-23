import { NextRequest, NextResponse } from "next/server";
import { publicMaintenanceResponse } from "@/lib/maintenance";
import { checkAuthRateLimit, clientIpFromRequest } from "@/lib/auth-rate-limit";
import { authenticateResellerPanel } from "@/lib/reseller-store";
import {
  clearResellerCookieOptions,
  createResellerToken,
  getResellerSession,
  publicResellerSession,
  resellerCookieOptions,
} from "@/lib/reseller-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const maintenance = await publicMaintenanceResponse();
  if (maintenance) return maintenance;

  const reseller = await getResellerSession();
  if (!reseller) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ success: true, reseller: publicResellerSession(reseller) });
}

export async function POST(request: NextRequest) {
  const maintenance = await publicMaintenanceResponse();
  if (maintenance) return maintenance;

  const ip = clientIpFromRequest(request);
  const rate = await checkAuthRateLimit("reseller_login", ip);
  if (!rate.ok) {
    return NextResponse.json(
      { success: false, error: rate.error },
      {
        status: 429,
        headers: rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined,
      },
    );
  }

  let body: { email?: string; password?: string } = {};
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }

  const result = await authenticateResellerPanel(String(body.email || ""), String(body.password || ""));
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 401 });
  }

  const token = createResellerToken(result.reseller.id, result.reseller.sessionVersion || 0);
  const response = NextResponse.json({
    success: true,
    reseller: publicResellerSession(result.reseller),
  });
  response.cookies.set(resellerCookieOptions(token));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(clearResellerCookieOptions());
  return response;
}
