import { createHash } from "crypto";

export type FlowCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  url?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  expirationDate?: number;
  hostOnly?: boolean;
  session?: boolean;
  storeId?: string;
  partitionKey?: unknown;
};

const GOOGLE_IDENTITY_NAMES = new Set(["SID", "__Secure-1PSID", "__Secure-3PSID"]);
const LABS_SESSION_NAMES = new Set([
  "OSID",
  "__Secure-OSID",
  "__Host-next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
]);

const CRITICAL_COOKIE_NAMES = new Set([...GOOGLE_IDENTITY_NAMES, ...LABS_SESSION_NAMES]);
const EXPIRING_SOON_MS = 24 * 60 * 60 * 1000;

function expirationMs(cookie: FlowCookie): number | null {
  if (!cookie.expirationDate || cookie.expirationDate <= 0) return null;
  return cookie.expirationDate > 1e12 ? cookie.expirationDate : cookie.expirationDate * 1000;
}

export type CookieCoverage = {
  hasGoogleSid: boolean;
  hasLabsSession: boolean;
  hasFlowHost: boolean;
  hasLabsHost: boolean;
  hasNextAuth: boolean;
  hasSid: boolean;
  warnings: string[];
};

export type CookieFreshness = {
  status: "healthy" | "expiring_soon" | "expired" | "unknown";
  earliestExpiry: string | null;
  hoursRemaining: number | null;
  expiredCount: number;
  expiringSoonCount: number;
  sessionOnlyCount: number;
  warnings: string[];
};

const NEXT_AUTH_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "__Host-next-auth.session-token",
] as const;

function hostFromDomain(domain: string | undefined): string | null {
  if (!domain) return null;
  const host = domain.replace(/^\./, "").toLowerCase();
  return host || null;
}

function cookieHosts(cookies: FlowCookie[]): Set<string> {
  const hosts = new Set<string>();
  for (const cookie of cookies) {
    const domain = cookie.domain?.replace(/^\./, "").toLowerCase();
    if (domain) hosts.add(domain);
    if (cookie.url) {
      try {
        hosts.add(new URL(cookie.url).hostname.toLowerCase());
      } catch {
        // ignore bad url
      }
    }
  }
  return hosts;
}

export function analyzeCookieCoverage(cookies: FlowCookie[]): CookieCoverage {
  const names = new Set(cookies.map((cookie) => cookie.name));
  const hosts = cookieHosts(cookies);
  const hasGoogleSid = [...GOOGLE_IDENTITY_NAMES].some((name) => names.has(name));
  const hasLabsSession = [...LABS_SESSION_NAMES].some((name) => names.has(name));
  const hasFlowHost = hosts.has("flow.google.com");
  const hasLabsHost = hosts.has("labs.google.com");
  const hasNextAuth = NEXT_AUTH_NAMES.some((name) => names.has(name));
  const hasSid = names.has("SID");
  const warnings: string[] = [];

  if (!hasGoogleSid) {
    warnings.push("Missing Google login cookies (SID / __Secure-1PSID). Export all .google.com cookies.");
  } else if (!hasSid) {
    warnings.push(
      "SID is missing — you only exported part of .google.com. In Cookie Editor, export the full .google.com domain.",
    );
  }

  if (!hasLabsSession) {
    warnings.push(
      "No Flow session cookie (OSID or next-auth). Sign into flow.google.com, open a project in the editor, then export again.",
    );
  }

  if (!hasNextAuth) {
    warnings.push(
      "No next-auth.session-token — you may have exported from the landing page only. Open a project inside Flow, wait until it loads, then re-export.",
    );
  }

  if (!names.has("HSID") || !names.has("APISID")) {
    warnings.push("Missing HSID or APISID — include the full .google.com cookie set, not just flow.google.com.");
  }

  if (hasFlowHost && !hasLabsHost) {
    warnings.push(
      "Export is from flow.google.com only. OSID was mirrored to labs.google.com on save, but the browser extension must also allow flow.google.com.",
    );
  }

  if (cookies.length < 20) {
    warnings.push(
      `Only ${cookies.length} cookies — a working Flow session usually has 25–40+. Export all cookies for .google.com and flow.google.com.`,
    );
  }

  const flowOsid = cookies.find((c) => c.name === "OSID" && hostFromDomain(c.domain) === "flow.google.com")?.value;
  const labsOsid = cookies.find((c) => c.name === "OSID" && hostFromDomain(c.domain) === "labs.google")?.value;
  if (flowOsid && labsOsid && flowOsid !== labsOsid) {
    warnings.push(
      "labs.google and flow.google.com OSID do not match — mixed exports from different times. Re-export all three domains within 2 minutes in one browser session.",
    );
  }

  return {
    hasGoogleSid,
    hasLabsSession,
    hasFlowHost,
    hasLabsHost,
    hasNextAuth,
    hasSid,
    warnings,
  };
}

export function analyzeCookieFreshness(cookies: FlowCookie[]): CookieFreshness {
  const now = Date.now();
  const critical = cookies.filter((cookie) => CRITICAL_COOKIE_NAMES.has(cookie.name));

  let earliest: number | null = null;
  let expiredCount = 0;
  let expiringSoonCount = 0;
  let sessionOnlyCount = 0;
  const warnings: string[] = [];

  for (const cookie of critical) {
    const exp = expirationMs(cookie);
    if (exp === null) {
      sessionOnlyCount += 1;
      continue;
    }
    if (exp <= now) {
      expiredCount += 1;
    } else if (exp - now <= EXPIRING_SOON_MS) {
      expiringSoonCount += 1;
    }
    if (exp > now && (earliest === null || exp < earliest)) {
      earliest = exp;
    }
  }

  if (expiredCount > 0) {
    warnings.push(
      `${expiredCount} critical cookie(s) already expired. Google Flow projects will not save until you paste fresh cookies from an active Flow session.`,
    );
  } else if (expiringSoonCount > 0 && earliest !== null) {
    const hours = Math.max(1, Math.round((earliest - now) / (3600 * 1000)));
    warnings.push(
      `Session expires in ~${hours}h. Refresh cookies before projects stop saving on Google Flow.`,
    );
  } else if (sessionOnlyCount > 0 && critical.length > 0 && earliest === null) {
    warnings.push(
      "Critical cookies have no expiry date in the export. If projects stop saving, export fresh cookies while logged into Flow.",
    );
  }

  let status: CookieFreshness["status"] = "unknown";
  if (expiredCount > 0) status = "expired";
  else if (expiringSoonCount > 0) status = "expiring_soon";
  else if (earliest !== null) status = "healthy";

  return {
    status,
    earliestExpiry: earliest ? new Date(earliest).toISOString() : null,
    hoursRemaining:
      earliest !== null ? Math.max(0, Math.round((earliest - now) / (3600 * 1000))) : null,
    expiredCount,
    expiringSoonCount,
    sessionOnlyCount,
    warnings,
  };
}

export function googleAccountFingerprint(cookies: FlowCookie[]): string | null {
  const sid = cookies.find((cookie) => cookie.name === "SID")?.value;
  if (typeof sid === "string" && sid.length > 8) {
    return createHash("sha256").update(sid).digest("hex").slice(0, 16);
  }
  const psid = cookies.find((cookie) => cookie.name === "__Secure-1PSID")?.value;
  if (typeof psid === "string" && psid.length > 8) {
    return createHash("sha256").update(psid).digest("hex").slice(0, 16);
  }
  return null;
}

export function compareAccountFingerprints(
  previous: string | null | undefined,
  next: string | null,
): "same" | "different" | "unknown" {
  if (!previous || !next) return "unknown";
  return previous === next ? "same" : "different";
}

export function analyzeCookies(cookies: FlowCookie[]) {
  const coverage = analyzeCookieCoverage(cookies);
  const freshness = analyzeCookieFreshness(cookies);
  const accountFingerprint = googleAccountFingerprint(cookies);
  return {
    ...coverage,
    freshness,
    accountFingerprint,
    warnings: [...coverage.warnings, ...freshness.warnings],
  };
}
