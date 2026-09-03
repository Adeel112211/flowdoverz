import { NextRequest, NextResponse } from "next/server";
import { resolveResellerPortalBrand } from "@/lib/extension-reseller-lookup";
import { requestOriginFromNextRequest } from "@/lib/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ref =
    request.nextUrl.searchParams.get("ref") ||
    request.nextUrl.searchParams.get("partner") ||
    request.nextUrl.searchParams.get("reseller") ||
    "";
  const brand = await resolveResellerPortalBrand({
    origin: requestOriginFromNextRequest(request),
    ref: String(ref || ""),
  });

  return NextResponse.json({
    success: true,
    brand,
  });
}
