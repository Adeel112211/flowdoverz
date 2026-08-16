import { NextRequest, NextResponse } from "next/server";
import { sendSignupVerificationCode } from "@/lib/signup-verification-code";
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
  const rateCheck = await checkSignupRateLimit(ip, security.rateLimitPerHour, "send_code");
  if (!rateCheck.ok) {
    return NextResponse.json(
      { success: false, error: rateCheck.error },
      { status: 429 },
    );
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }

  const result = await sendSignupVerificationCode(
    String(body.email || ""),
    security.allowedDomains,
  );

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, waitSeconds: result.waitSeconds },
      { status: result.waitSeconds ? 429 : 400 },
    );
  }

  return NextResponse.json({ success: true });
}
