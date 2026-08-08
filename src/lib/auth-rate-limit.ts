import { createHash } from "crypto";
import { getDb } from "./firebase-admin";
import { clientIpFromRequest } from "./signup-security";

export type AuthRateLimitScope =
  | "admin_login"
  | "admin_reset_confirm"
  | "client_login";

type RateLimitResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSeconds?: number };

const LIMITS: Record<
  AuthRateLimitScope,
  { max: number; windowMs: number; failClosedInProduction: boolean }
> = {
  admin_login: { max: 8, windowMs: 15 * 60 * 1000, failClosedInProduction: true },
  admin_reset_confirm: { max: 8, windowMs: 15 * 60 * 1000, failClosedInProduction: true },
  client_login: { max: 30, windowMs: 60 * 60 * 1000, failClosedInProduction: false },
};

function pepper() {
  return (
    process.env.FLOWBRIDGE_ADMIN_PASSWORD?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "flowdoverz-rate"
  );
}

function hashKey(value: string) {
  const secret = pepper();
  if (!secret && process.env.NODE_ENV === "production") {
    return createHash("sha256").update(value).digest("hex");
  }
  return createHash("sha256").update(`${value}:${secret}`).digest("hex");
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

export { clientIpFromRequest };

export async function checkAuthRateLimit(
  scope: AuthRateLimitScope,
  ip: string,
): Promise<RateLimitResult> {
  const config = LIMITS[scope];

  if (isLocalIp(ip) && process.env.NODE_ENV !== "production") {
    return { ok: true };
  }

  const db = getDb();
  if (!db) {
    if (config.failClosedInProduction && process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error: "Service temporarily unavailable. Try again shortly.",
      };
    }
    return { ok: true };
  }

  const docId = hashKey(`${scope}:${ip}`);
  const ref = db.collection("auth_rate_limits").doc(docId);
  const now = Date.now();

  const doc = await ref.get();
  const data = doc.data();
  const windowStart = Number(data?.windowStart || 0);
  const count = Number(data?.count || 0);

  if (!windowStart || now - windowStart >= config.windowMs) {
    await ref.set({ windowStart: now, count: 1, scope }, { merge: true });
    return { ok: true };
  }

  if (count >= config.max) {
    const retryAfterSeconds = Math.ceil((config.windowMs - (now - windowStart)) / 1000);
    return {
      ok: false,
      error: "Too many attempts. Please wait and try again.",
      retryAfterSeconds,
    };
  }

  await ref.set({ windowStart, count: count + 1, scope }, { merge: true });
  return { ok: true };
}
