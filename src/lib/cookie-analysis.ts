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

export function analyzeCookieCoverage(cookies: FlowCookie[]): CookieCoverage {
  const names = new Set(cookies.map((cookie) => cookie.name));
  const hosts = cookies.map((cookie) =>
    String(cookie.domain || "").replace(/^\./, "").toLowerCase(),
  );
  const hasGoogleSid = [...GOOGLE_IDENTITY_NAMES].some((name) => names.has(name));
  const hasLabsSession = [...LABS_SESSION_NAMES].some((name) => names.has(name));
  const hasLabsHost = hosts.some(
    (host) => host === "labs.google" || host.endsWith(".labs.google"),
  );
  const warnings: string[] = [];

  if (!hasLabsHost && !hasLabsSession && !hasGoogleSid) {
    warnings.push("No labs.google cookies found. Flow will not stay signed in.");
  }
  if (hasLabsSession && !hasGoogleSid) {
    warnings.push(
      "Missing Google account cookies (SID / __Secure-1PSID). Flow may open but projects may not save.",
    );
  }
  if (hasGoogleSid && !hasLabsSession) {
    warnings.push(
      "Missing labs.google session token. Flow will not stay signed in or save projects.",
    );
  }

  return { hasGoogleSid, hasLabsSession, warnings };
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
  const warnings = [...coverage.warnings, ...freshness.warnings];
  if (!accountFingerprint) {
    warnings.push(
      "No SID / __Secure-1PSID found. Export google.com cookies from the same account that owns the Flow projects.",
    );
  }
  return {
    ...coverage,
    freshness,
    accountFingerprint,
    warnings,
  };
}
