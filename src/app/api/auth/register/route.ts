import { NextRequest, NextResponse } from "next/server";
import { registerClientUser } from "@/lib/user-store";
import { CLIENT_SID_COOKIE } from "@/lib/client-session";
import { clientSessionCookieOptions } from "@/lib/site-urls";
import {
  checkSignupRateLimit,
  clientIpFromRequest,
  getSignupSecuritySettings,
} from "@/lib/signup-security";
import { publicMaintenanceResponse } from "@/lib/maintenance";

export async function POST(request: NextRequest) {
  const maintenance = await publicMaintenanceResponse();
  if (maintenance) return maintenance;

  const security = await getSignupSecuritySettings();
  const ip = clientIpFromRequest(request);
  const rateCheck = await checkSignupRateLimit(ip, security.rateLimitPerHour, "register");
  if (!rateCheck.ok) {
    return NextResponse.json(
      { success: false, error: rateCheck.error },
      {
        status: 429,
        headers: rateCheck.retryAfterSeconds
          ? { "Retry-After": String(rateCheck.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  let body: {
    email?: string;
    password?: string;
    name?: string;
    verificationCode?: string;
    partnerCode?: string;
    ref?: string;
    phoneCountryIso?: string;
    phoneNational?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await registerClientUser(
    String(body.email || ""),
    String(body.password || ""),
    String(body.name || ""),
    String(body.verificationCode || ""),
    ip,
    String(body.partnerCode || body.ref || ""),
    {
      countryIso: String(body.phoneCountryIso || ""),
      nationalNumber: String(body.phoneNational || ""),
    },
  );

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 },
    );
  }

  const response = NextResponse.json({
    success: true,
    trialGranted: result.trialGranted,
    notice:
      result.trialGranted || Boolean(String(body.partnerCode || body.ref || "").trim())
        ? undefined
        : "A free trial was already used on this network. Upgrade to Solo or Team to activate FlowDoverz.",
    user: {
      email: result.user.email,
      name: result.user.name,
      sid: result.user.sid,
    },
  });

  response.cookies.set(CLIENT_SID_COOKIE, result.user.sid, clientSessionCookieOptions());

  return response;
}
