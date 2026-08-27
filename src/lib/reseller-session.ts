import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getReseller, type ResellerRecord } from "@/lib/reseller-store";

export const RESELLER_COOKIE = "flowdoverz_reseller";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function signingSecret() {
  return (
    process.env.FLOWBRIDGE_ADMIN_PASSWORD?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "flowdoverz-reseller-session"
  );
}

function sign(payload: string) {
  return createHmac("sha256", signingSecret()).update(`reseller:${payload}`).digest("hex");
}

function signaturesMatch(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createResellerToken(resellerId: string, sessionVersion: number) {
  const issuedAt = Date.now().toString();
  const payload = `${issuedAt}.${resellerId}.${sessionVersion}`;
  return `${payload}.${sign(payload)}`;
}

export async function verifyResellerToken(token: string | undefined | null): Promise<ResellerRecord | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [issuedAt, resellerId, versionPart, signature] = parts;
  if (!issuedAt || !resellerId || !versionPart || !signature) return null;

  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > TOKEN_TTL_MS) return null;

  const payload = `${issuedAt}.${resellerId}.${versionPart}`;
  if (!signaturesMatch(signature, sign(payload))) return null;

  const reseller = await getReseller(resellerId);
  if (!reseller) return null;
  if (reseller.status === "disabled") return null;
  if ((reseller.sessionVersion || 0) !== Number(versionPart)) return null;
  return reseller;
}

export function resellerCookieOptions(token: string) {
  return {
    name: RESELLER_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  };
}

export function clearResellerCookieOptions() {
  return {
    name: RESELLER_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function getResellerSession() {
  const jar = await cookies();
  return verifyResellerToken(jar.get(RESELLER_COOKIE)?.value);
}

export function publicResellerSession(record: ResellerRecord) {
  return {
    id: record.id,
    brandName: record.brandName,
    contactName: record.contactName,
    contactEmail: record.contactEmail,
    status: record.status,
    kind: record.kind,
    seatsPurchased: record.seatsPurchased,
    seatDays: record.seatDays,
    pricePerSeatPkr: record.pricePerSeatPkr,
    assignedSlots: record.assignedSlots,
  };
}
