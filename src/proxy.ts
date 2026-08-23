import { NextRequest, NextResponse } from "next/server";
import {
  classifyHost,
  getAdminUrl,
  getAppUrl,
  getResellerOrigin,
  isLocalRequestHost,
  isMultiDomainEnabled,
  isResellerPanelHost,
} from "@/lib/site-urls";
import {
  dedicatedPathFromResellerAppPath,
  isResellerAppPath,
  resellerAppPathFromDedicated,
} from "@/lib/reseller-panel-paths";

const ADMIN_PREFIXES = ["/admin", "/api/admin"];

function matchesPrefix(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function externalRedirect(
  base: string,
  path: string,
  request: NextRequest,
  status: 307 | 308 = 307,
): NextResponse {
  const target = new URL(path, `${base}/`);
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, status);
}

function rewritePath(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.rewrite(url);
}

function adminHostFromUrl(): string {
  try {
    return new URL(getAdminUrl()).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isStaticPath(path: string): boolean {
  return path.startsWith("/_next") || path.startsWith("/favicon") || /\.[a-z0-9]+$/i.test(path);
}

function handleResellerHost(request: NextRequest, path: string): NextResponse {
  if (path.startsWith("/api/") || isStaticPath(path)) {
    return NextResponse.next();
  }

  if (isResellerAppPath(path)) {
    const clean = dedicatedPathFromResellerAppPath(path);
    return externalRedirect(getResellerOrigin(), clean, request, 308);
  }

  const rewritten = resellerAppPathFromDedicated(path);
  if (rewritten) {
    return rewritePath(request, rewritten);
  }

  if (matchesPrefix(path, ADMIN_PREFIXES) && !path.startsWith("/api/")) {
    return externalRedirect(getAdminUrl(), path, request);
  }

  return externalRedirect(getAppUrl(), path, request);
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (isStaticPath(path)) {
    return NextResponse.next();
  }

  const host = request.headers.get("host") ?? "";

  if (isResellerPanelHost(host)) {
    return handleResellerHost(request, path);
  }

  if (isResellerAppPath(path) && !isLocalRequestHost(host)) {
    return externalRedirect(getResellerOrigin(), dedicatedPathFromResellerAppPath(path), request, 308);
  }

  if (!isMultiDomainEnabled()) {
    return NextResponse.next();
  }

  const zone = classifyHost(host);
  if (zone === "unknown" || zone === "reseller") {
    return NextResponse.next();
  }

  const isAdminRoute = matchesPrefix(path, ADMIN_PREFIXES) || path === "/api/cookies";

  if (zone === "admin") {
    if (path === "/" || path === "/login" || path === "/signup") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    if (!isAdminRoute) {
      return externalRedirect(getAppUrl(), path, request);
    }
    return NextResponse.next();
  }

  if (zone === "client") {
    if (isAdminRoute && !path.startsWith("/api/")) {
      const adminHost = adminHostFromUrl();
      const currentHost = host.split(":")[0].toLowerCase();
      if (adminHost && adminHost !== currentHost) {
        return externalRedirect(getAdminUrl(), path, request);
      }
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
