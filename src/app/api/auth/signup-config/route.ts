import { NextResponse } from "next/server";
import { getSignupSecuritySettings } from "@/lib/signup-security";

export async function GET() {
  const security = await getSignupSecuritySettings();
  return NextResponse.json({
    success: true,
    requireEmailVerification: security.requireEmailVerification,
    allowedDomains: security.allowedDomains,
  });
}
