import { createHash } from "crypto";
import { getDb } from "./firebase-admin";
import { getSystemSettings } from "./admin-settings";

export type SignupSecuritySettings = {
  requireEmailVerification: boolean;
  allowedDomains: string[];
  rateLimitPerHour: number;
};

export type SignupRateLimitScope = "send_code" | "register";

function parseDomainList(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : raw.split(",");
  return items.map((d) => d.trim().toLowerCase()).filter(Boolean);
}

export async function getSignupSecuritySettings(): Promise<SignupSecuritySettings> {
  const system = await getSystemSettings();
  const envDomains = parseDomainList(process.env.SIGNUP_ALLOWED_DOMAINS);
  const storedDomains = parseDomainList(system.signupAllowedDomains);

  const envRate = parseInt(process.env.SIGNUP_RATE_LIMIT_PER_HOUR || "", 10);
  const rateLimitPerHour = Number.isFinite(envRate) && envRate > 0
    ? envRate
    : system.signupRateLimitPerHour ?? 20;

  const requireVerification =
    process.env.SIGNUP_REQUIRE_EMAIL_VERIFICATION !== "false" &&
    (process.env.SIGNUP_REQUIRE_EMAIL_VERIFICATION === "true" ||
      system.signupRequireEmailVerification !== false);

  return {
    requireEmailVerification: requireVerification,
    allowedDomains: envDomains.length > 0 ? envDomains : storedDomains,
    rateLimitPerHour,
  };
}

function hashIp(key: string) {
  const pepper =
    process.env.FLOWBRIDGE_ADMIN_PASSWORD?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "flowdoverz-signup-rate";
  return createHash("sha256").update(`${key}:${pepper}`).digest("hex");
}

export function clientIpFromRequest(request: Request): string {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0],
    request.headers.get("x-forwarded-for")?.split(",")[0],
  ];

  for (const raw of candidates) {
    const value = raw?.trim();
    if (value) return value;
  }

  return "unknown";
}

function isUnreliableIp(ip: string) {
  const value = ip.toLowerCase().trim();
  return !value || value === "unknown" || value === "0.0.0.0" || value === "::";
}

function isLocalIp(ip: string) {
  const value = ip.toLowerCase();
  return (
    value === "127.0.0.1" ||
    value === "::1" ||
    value === "localhost" ||
    value.startsWith("192.168.") ||
    value.startsWith("10.")
  );
}

function limitForScope(scope: SignupRateLimitScope, limitPerHour: number) {
  if (scope === "send_code") {
    return Math.max(limitPerHour, 20);
  }
  return Math.max(limitPerHour, 10);
}

export async function checkSignupRateLimit(
  ip: string,
  limitPerHour: number,
  scope: SignupRateLimitScope = "register",
): Promise<{ ok: true } | { ok: false; error: string; retryAfterSeconds?: number }> {
  if (limitPerHour <= 0) return { ok: true };

  if (isLocalIp(ip) && process.env.NODE_ENV !== "production") {
    return { ok: true };
  }

  const db = getDb();
  if (!db) return { ok: true };

  const effectiveLimit = limitForScope(scope, limitPerHour);
  const docId = hashIp(`${scope}:${ip}`);
  const ref = db.collection("signup_rate_limits").doc(docId);
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;

  const doc = await ref.get();
  const data = doc.data();
  const windowStart = Number(data?.windowStart || 0);
  const count = Number(data?.count || 0);

  if (!windowStart || now - windowStart >= windowMs) {
    await ref.set({ windowStart: now, count: 1, scope }, { merge: true });
    return { ok: true };
  }

  if (count >= effectiveLimit) {
    const retryAfterSeconds = Math.ceil((windowMs - (now - windowStart)) / 1000);
    return {
      ok: false,
      error: "Too many attempts. Please wait a few minutes and try again.",
      retryAfterSeconds,
    };
  }

  await ref.set({ windowStart, count: count + 1, scope }, { merge: true });
  return { ok: true };
}

export function isDomainAllowed(emailDomain: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true;
  const domain = emailDomain.toLowerCase();
  return allowedDomains.some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
  );
}

export function hashSignupIp(ip: string): string {
  return hashIp(`trial:${ip}`);
}

export async function isTrialEligibleForIp(ip: string | null | undefined): Promise<boolean> {
  const settings = await getSystemSettings();
  if (settings.trialOnePerIp === false) return true;

  const cleaned = String(ip || "").trim();

  // Fail closed in production when IP cannot be trusted.
  if (isUnreliableIp(cleaned)) {
    return process.env.NODE_ENV !== "production";
  }

  if (isLocalIp(cleaned) && process.env.NODE_ENV !== "production") {
    return true;
  }

  const db = getDb();
  if (!db) {
    return process.env.NODE_ENV !== "production";
  }

  const ref = db.collection("trial_ip_usage").doc(hashSignupIp(cleaned));
  const doc = await ref.get();
  if (!doc.exists) return true;

  const count = Number(doc.data()?.trialCount || 0);
  return count < 1;
}

export async function recordTrialIpUsage(ip: string, email: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const ref = db.collection("trial_ip_usage").doc(hashSignupIp(ip));
  const now = new Date().toISOString();

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    const data = doc.data();
    const emails = Array.isArray(data?.emails) ? [...data.emails] : [];
    if (!emails.includes(email)) emails.push(email);

    transaction.set(
      ref,
      {
        trialCount: Number(data?.trialCount || 0) + 1,
        firstEmail: data?.firstEmail || email,
        firstUsedAt: data?.firstUsedAt || now,
        lastUsedAt: now,
        emails: emails.slice(-20),
      },
      { merge: true },
    );
  });
}
