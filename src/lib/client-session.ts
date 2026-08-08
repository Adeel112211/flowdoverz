import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const CLIENT_SID_COOKIE = "flowdoverz_sid";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  const configured = process.env.FLOWBRIDGE_SESSION_SECRET?.trim();
  if (configured) return configured;

  const adminPassword = process.env.FLOWBRIDGE_ADMIN_PASSWORD?.trim();
  if (adminPassword) {
    return createHmac("sha256", "flowdoverz-client-session").update(adminPassword).digest("hex");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Set FLOWBRIDGE_SESSION_SECRET or FLOWBRIDGE_ADMIN_PASSWORD for client sessions.",
    );
  }

  return "flowdoverz-dev-session-secret";
}

export function createClientSession(email: string): string {
  const normalized = email.trim().toLowerCase();
  const issuedAt = Date.now().toString();
  const payload = `${issuedAt}|${normalized}`;
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  return `${payload}|${sig}`;
}

export function verifyClientSession(
  token: string | undefined | null,
): { email: string; issuedAt: number } | null {
  if (!token || token === "admin-local") return null;

  const parts = token.split("|");
  if (parts.length !== 3) return null;

  const [issuedAt, email, sig] = parts;
  if (!issuedAt || !email || !sig || !email.includes("@")) return null;

  const payload = `${issuedAt}|${email}`;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const issuedMs = Number(issuedAt);
  const age = Date.now() - issuedMs;
  if (!Number.isFinite(age) || age < 0 || age > SESSION_TTL_MS) return null;

  return { email, issuedAt: issuedMs };
}

export async function getClientSessionFromCookies(): Promise<{
  email: string;
  sid: string;
} | null> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(CLIENT_SID_COOKIE)?.value;
  const verified = verifyClientSession(sid);
  if (!verified || !sid) return null;
  return { email: verified.email, sid };
}

export function getClientSessionFromRequest(
  request: NextRequest,
): { email: string; sid: string } | null {
  const sid = request.cookies.get(CLIENT_SID_COOKIE)?.value;
  const verified = verifyClientSession(sid);
  if (!verified || !sid) return null;
  return { email: verified.email, sid };
}
