import { NextRequest, NextResponse } from "next/server";
import { resolveResellerPortalBrand } from "@/lib/extension-reseller-lookup";
import { originFromUrl } from "@/lib/reseller-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestOrigin(request: NextRequest) {
  const forwardedHost = String(request.headers.get("x-forwarded-host") || "").split(",")[0]?.trim();
  const host = forwardedHost || String(request.headers.get("host") || "").split(",")[0]?.trim();
  if (!host) return "";
  const forwardedProto = String(request.headers.get("x-forwarded-proto") || "").split(",")[0]?.trim();
  const proto = forwardedProto || (host.includes("localhost") ? "http" : "https");
  return originFromUrl(`${proto}://${host}`) || "";
}

export async function GET(request: NextRequest) {
  const ref =
    request.nextUrl.searchParams.get("ref") ||
    request.nextUrl.searchParams.get("partner") ||
    request.nextUrl.searchParams.get("reseller") ||
    "";
  const brand = await resolveResellerPortalBrand({
    origin: requestOrigin(request),
    ref: String(ref || ""),
  });

  return NextResponse.json({
    success: true,
    brand,
  });
}
