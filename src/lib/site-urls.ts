/** Multi-domain config: marketing site, client app, admin, and reseller panel on separate hosts. */

/** Dedicated official reseller panel. Not served on flow.doverz.com. */
export const DEFAULT_RESELLER_HOST = "resellerflow.doverz.com";
export const DEFAULT_RESELLER_URL = `https://${DEFAULT_RESELLER_HOST}`;

function normalizeHost(host: string): string {
  return host.toLowerCase().split(":")[0];
}

function parseHosts(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((entry) => normalizeHost(entry.trim()))
    .filter(Boolean);
}

function hostsFromUrl(url: string | undefined): string[] {
  if (!url?.trim()) return [];
  try {
    return [normalizeHost(new URL(url.trim()).hostname)];
  } catch {
    return [];
  }
}

function mergeHosts(...groups: string[][]): string[] {
  return [...new Set(groups.flat())];
}

export function getMarketingHosts(): string[] {
  return mergeHosts(
    parseHosts(process.env.MARKETING_HOSTS || process.env.MARKETING_HOST),
    hostsFromUrl(process.env.NEXT_PUBLIC_MARKETING_URL),
  );
}

export function getAppHosts(): string[] {
  return mergeHosts(
    parseHosts(process.env.APP_HOSTS || process.env.APP_HOST),
    hostsFromUrl(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL),
  );
}

export function getAdminHosts(): string[] {
  return mergeHosts(
    parseHosts(process.env.ADMIN_HOSTS || process.env.ADMIN_HOST),
    hostsFromUrl(process.env.NEXT_PUBLIC_ADMIN_URL || process.env.ADMIN_URL),
  );
}

export function getResellerHosts(): string[] {
  return mergeHosts(
    parseHosts(process.env.RESELLER_HOSTS || process.env.RESELLER_HOST),
    hostsFromUrl(process.env.NEXT_PUBLIC_RESELLER_URL || process.env.RESELLER_URL),
    [DEFAULT_RESELLER_HOST],
  );
}

export function isLocalRequestHost(host: string): boolean {
  const normalized = normalizeHost(host);
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized.endsWith(".local")
  );
}

export function isResellerPanelHost(host: string): boolean {
  return getResellerHosts().includes(normalizeHost(host));
}

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

export function getMarketingUrl(): string {
  return stripTrailingSlash(
    process.env.NEXT_PUBLIC_MARKETING_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "http://localhost:3000",
  );
}

export function getAppUrl(): string {
  return stripTrailingSlash(
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || getMarketingUrl(),
  );
}

export function getAdminUrl(): string {
  const configured = process.env.NEXT_PUBLIC_ADMIN_URL || process.env.ADMIN_URL;
  if (configured) return stripTrailingSlash(configured);
  return `${getMarketingUrl()}/admin`;
}

/** Origin of the dedicated reseller panel (no /reseller path). */
export function getResellerOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_RESELLER_URL || process.env.RESELLER_URL;
  if (configured?.trim()) return stripTrailingSlash(configured);
  return DEFAULT_RESELLER_URL;
}

/** Link to send resellers. Production uses the dedicated host; local stays on /reseller. */
export function getResellerUrl(): string {
  const configured = process.env.NEXT_PUBLIC_RESELLER_URL || process.env.RESELLER_URL;
  if (configured?.trim()) return stripTrailingSlash(configured);
  if (process.env.NODE_ENV === "production") return DEFAULT_RESELLER_URL;
  return `${getAppUrl()}/reseller`;
}

/** Optional: `.flowdoverz.app` — only set if you need cookies shared across subdomains. */
export function getCookieDomain(): string | undefined {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  return domain || undefined;
}

/** Client session cookie — 24h, matching the signed token TTL. */
export function clientSessionCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60,
    ...(getCookieDomain() ? { domain: getCookieDomain() } : {}),
  };
}

export function sessionCookieOptions(maxAge: number) {
  return {
    path: "/",
    sameSite: "lax" as const,
    maxAge,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    ...(getCookieDomain() ? { domain: getCookieDomain() } : {}),
  };
}

export function classifyHost(host: string): "client" | "admin" | "reseller" | "unknown" {
  const normalized = normalizeHost(host);
  if (getResellerHosts().includes(normalized)) return "reseller";
  if (getAdminHosts().includes(normalized)) return "admin";
  if (getAppHosts().includes(normalized) || getMarketingHosts().includes(normalized)) {
    return "client";
  }
  return "unknown";
}

export function isMultiDomainEnabled(): boolean {
  return getAdminHosts().length > 0 && getAppHosts().length > 0;
}

export function appPath(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function adminPath(path: string): string {
  const base = process.env.NEXT_PUBLIC_ADMIN_URL?.replace(/\/$/, "");
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function marketingPath(path: string): string {
  const base = process.env.NEXT_PUBLIC_MARKETING_URL?.replace(/\/$/, "");
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
