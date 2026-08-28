import { NextRequest, NextResponse } from "next/server";
import { getResellerBySignupCode } from "@/lib/reseller-store";
import { resellerBrandLogoPath } from "@/lib/extension-reseller-lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = String(request.nextUrl.searchParams.get("ref") || request.nextUrl.searchParams.get("code") || "").trim();
  if (!code) {
    return NextResponse.json({ success: false, error: "Missing partner code." }, { status: 400 });
  }

  const reseller = await getResellerBySignupCode(code);
  if (!reseller || reseller.status === "disabled") {
    return NextResponse.json({ success: false, error: "Partner not found." }, { status: 404 });
  }

  const displayName = String(reseller.brandedExtension?.displayName || reseller.brandName || "").trim();
  if (!displayName) {
    return NextResponse.json({ success: false, error: "Partner not found." }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    brand: {
      name: displayName,
      logoUrl: reseller.brandedExtension?.hasLogo ? resellerBrandLogoPath(reseller.id) : null,
      resellerId: reseller.id,
    },
  });
}
