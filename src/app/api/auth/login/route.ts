import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, normalizeEmail } from "@/lib/user-store";
import { CLIENT_SID_COOKIE, getClientSessionFromRequest } from "@/lib/client-session";
import { clientSessionCookieOptions } from "@/lib/site-urls";
import { checkAuthRateLimit, clientIpFromRequest } from "@/lib/auth-rate-limit";
import { publicMaintenanceResponse } from "@/lib/maintenance";

export async function POST(request: NextRequest) {
  const maintenance = await publicMaintenanceResponse();
  if (maintenance) return maintenance;

  const ip = clientIpFromRequest(request);
  const rate = await checkAuthRateLimit("client_login", ip);
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

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const email = String(body.email || "");
  const existing = getClientSessionFromRequest(request);
  const sameAccount =
    existing?.email && normalizeEmail(existing.email) === normalizeEmail(email);

  const result = await authenticateUser(email, String(body.password || ""), {
    existingSessionId: sameAccount ? existing?.sessionId : undefined,
  });

  if (!result.ok) {
    const status = result.code === "MULTI_DEVICE_BLOCKED" ? 403 : 401;
    return NextResponse.json(
      { success: false, error: result.error, code: result.code || "AUTH_FAILED" },
      { status },
    );
  }

  const response = NextResponse.json({
    success: true,
    user: {
      email: result.user.email,
      name: result.user.name,
      sid: result.user.sid,
    },
  });

  response.cookies.set(CLIENT_SID_COOKIE, result.user.sid, clientSessionCookieOptions());

  return response;
}
