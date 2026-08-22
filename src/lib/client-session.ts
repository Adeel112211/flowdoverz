import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const CLIENT_SID_COOKIE = "flowdoverz_sid";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  const configured = process.env.FLOWBRIDGE_SESSION_SECRET?.trim();
  if (configured) return configured;

  const adminPassword = process.env.FLOWBRIDGE_ADMIN_PASSWORD?.trim();
  if (adminPassword) {
    return createHmac("sha256", "flowdoverz-client-session").update(adminPassword).digest("hex");
  }

  const fallback =
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "flowdoverz-client-session";
  return createHmac("sha256", "flowdoverz-client-session").update(fallback).digest("hex");
}

export type VerifiedClientSession = {
  email: string;
  issuedAt: number;
  sessionId: string;
};

/** Solo / trial = 1 browser. Team = up to 3. */
export function maxClientSessionsForPlan(plan: string | null | undefined): number {
  const normalized = String(plan || "").trim().toLowerCase();
  if (normalized === "team") return 3;
  return 1;
}

export function createClientSession(email: string): { sid: string; sessionId: string } {
  const normalized = email.trim().toLowerCase();
  const issuedAt = Date.now().toString();
  const sessionId = randomBytes(16).toString("hex");
  const payload = `${issuedAt}|${normalized}|${sessionId}`;
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  return {
    sid: `${payload}|${sig}`,
    sessionId,
  };
}

export function verifyClientSession(
  token: string | undefined | null,
): VerifiedClientSession | null {
  if (!token || token === "admin-local") return null;

  const parts = token.split("|");
  // New format: issuedAt|email|sessionId|sig
  if (parts.length !== 4) return null;

  const [issuedAt, email, sessionId, sig] = parts;
  if (
    !issuedAt ||
    !email ||
    !sessionId ||
    !sig ||
    !email.includes("@") ||
    sessionId.length < 16
  ) {
    return null;
  }

  const payload = `${issuedAt}|${email}|${sessionId}`;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const issuedMs = Number(issuedAt);
  const age = Date.now() - issuedMs;
  if (!Number.isFinite(age) || age < 0 || age > SESSION_TTL_MS) return null;

  return { email, issuedAt: issuedMs, sessionId };
}

export async function getClientSessionFromCookies(): Promise<{
  email: string;
  sid: string;
  sessionId: string;
} | null> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(CLIENT_SID_COOKIE)?.value;
  const verified = verifyClientSession(sid);
  if (!verified || !sid) return null;
  return { email: verified.email, sid, sessionId: verified.sessionId };
}

export function getClientSessionFromRequest(
  request: NextRequest,
): { email: string; sid: string; sessionId: string } | null {
  const sid = request.cookies.get(CLIENT_SID_COOKIE)?.value;
  const verified = verifyClientSession(sid);
  if (!verified || !sid) return null;
  return { email: verified.email, sid, sessionId: verified.sessionId };
}
