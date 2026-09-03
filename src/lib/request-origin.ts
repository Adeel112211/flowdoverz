import type { NextRequest } from "next/server";
import { originFromUrl } from "@/lib/reseller-store";

/** Public page origin from proxy headers (custom domains / Vercel). */
export function requestOriginFromNextRequest(request: NextRequest): string {
  const forwardedHost = String(request.headers.get("x-forwarded-host") || "")
    .split(",")[0]
    ?.trim();
  const host = forwardedHost || String(request.headers.get("host") || "").split(",")[0]?.trim();
  if (!host) return "";
  const forwardedProto = String(request.headers.get("x-forwarded-proto") || "")
    .split(",")[0]
    ?.trim();
  const proto = forwardedProto || (host.includes("localhost") ? "http" : "https");
  return originFromUrl(`${proto}://${host}`) || "";
}
