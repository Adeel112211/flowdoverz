import { createHash } from "crypto";
import { clientIpFromRequest } from "./signup-security";

export type AuthRateLimitScope =
  | "admin_login"
  | "admin_reset_confirm"
  | "client_login"
  | "reseller_login";

type RateLimitResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSeconds?: number };

const LIMITS: Record<
  AuthRateLimitScope,
  { max: number; windowMs: number }
> = {
  admin_login: { max: 8, windowMs: 15 * 60 * 1000 },
  admin_reset_confirm: { max: 8, windowMs: 15 * 60 * 1000 },
  client_login: { max: 30, windowMs: 60 * 60 * 1000 },
  reseller_login: { max: 12, windowMs: 15 * 60 * 1000 },
};

const memoryWindows = new Map<string, { windowStart: number; count: number }>();

function pepper() {
  return (
    process.env.FLOWBRIDGE_ADMIN_PASSWORD?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "flowdoverz-rate"
  );
}

function hashKey(value: string) {
  return createHash("sha256").update(`${value}:${pepper()}`).digest("hex");
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

  const key = hashKey(`${scope}:${ip}`);
  const now = Date.now();
  const prev = memoryWindows.get(key);

  if (!prev || now - prev.windowStart >= config.windowMs) {
    memoryWindows.set(key, { windowStart: now, count: 1 });
    return { ok: true };
  }

  if (prev.count >= config.max) {
    const retryAfterSeconds = Math.ceil((config.windowMs - (now - prev.windowStart)) / 1000);
    return {
      ok: false,
      error: "Too many attempts. Please wait and try again.",
      retryAfterSeconds,
    };
  }

  prev.count += 1;
  return { ok: true };
}
