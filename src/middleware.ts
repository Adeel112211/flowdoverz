import { NextRequest, NextResponse } from "next/server";
import {
  classifyHost,
  getAdminUrl,
  getAppUrl,
  isMultiDomainEnabled,
} from "@/lib/site-urls";

const ADMIN_PREFIXES = ["/admin", "/api/admin"];

function matchesPrefix(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function externalRedirect(base: string, path: string, request: NextRequest): NextResponse {
  const target = new URL(path, `${base}/`);
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target);
}

export function middleware(request: NextRequest) {
  if (!isMultiDomainEnabled()) {
    return NextResponse.next();
  }

  const host = request.headers.get("host") ?? "";
  const zone = classifyHost(host);
  if (zone === "unknown") {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;

  if (
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    /\.[a-z0-9]+$/i.test(path)
  ) {
    return NextResponse.next();
  }

  const isAdminRoute = matchesPrefix(path, ADMIN_PREFIXES) || path === "/api/cookies";

  if (zone === "admin") {
    if (path === "/") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    if (!isAdminRoute) {
      return externalRedirect(getAppUrl(), path, request);
    }
    return NextResponse.next();
  }

  if (zone === "client") {
    if (isAdminRoute) {
      return externalRedirect(getAdminUrl(), path, request);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
