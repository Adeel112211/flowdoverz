import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { getDb } from "./firebase-admin";
import { getSystemSettings } from "./admin-settings";
import { getAppUrl } from "./site-urls";
import { sendSignupVerificationEmail } from "./email";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type VerificationUser = {
  emailVerified?: boolean;
  emailVerificationTokenHash?: string | null;
  emailVerificationExpiresAt?: string | null;
  emailVerificationSentAt?: string | null;
};

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

function hashVerificationToken(token: string) {
  const secret =
    process.env.FLOWBRIDGE_ADMIN_PASSWORD?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "flowdoverz-email-verify";
  return createHash("sha256").update(`${token}:${secret}`).digest("hex");
}

export function generateVerificationToken() {
  return randomBytes(32).toString("hex");
}

export function buildVerificationLink(token: string, email: string) {
  const base = getAppUrl();
  const params = new URLSearchParams({ token, email });
  return `${base}/verify-email?${params.toString()}`;
}

export async function issueEmailVerification(email: string, name: string) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const normalized = normalizeEmail(email);
  const token = generateVerificationToken();
  const tokenHash = hashVerificationToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  await db.collection("users").doc(normalized).set(
    {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: expiresAt,
      emailVerificationSentAt: new Date().toISOString(),
    },
    { merge: true },
  );

  const verifyUrl = buildVerificationLink(token, normalized);
  await sendSignupVerificationEmail(normalized, name, verifyUrl);

  return { ok: true as const };
}

export async function canResendVerification(email: string) {
  const db = getDb();
  if (!db) return { ok: true as const };

  const doc = await db.collection("users").doc(normalizeEmail(email)).get();
  const sentAt = doc.data()?.emailVerificationSentAt;
  if (!sentAt) return { ok: true as const };

  const elapsed = Date.now() - new Date(String(sentAt)).getTime();
  if (elapsed < RESEND_COOLDOWN_MS) {
    return {
      ok: false as const,
      waitSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
    };
  }

  return { ok: true as const };
}

export async function verifyEmailToken(
  email: string,
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: "Database not configured." };

  const normalized = normalizeEmail(email);
  const userRef = db.collection("users").doc(normalized);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return { ok: false, error: "Account not found." };
  }

  const user = userDoc.data() as VerificationUser;

  if (user.emailVerified !== false) {
    return { ok: true };
  }

  if (!user.emailVerificationTokenHash || !user.emailVerificationExpiresAt) {
    return { ok: false, error: "Verification link is invalid or expired. Request a new one." };
  }

  if (Date.now() > new Date(user.emailVerificationExpiresAt).getTime()) {
    return { ok: false, error: "Verification link has expired. Request a new one." };
  }

  const incoming = hashVerificationToken(token.trim());
  try {
    const a = Buffer.from(incoming);
    const b = Buffer.from(String(user.emailVerificationTokenHash));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "Verification link is invalid." };
    }
  } catch {
    return { ok: false, error: "Verification link is invalid." };
  }

  const settings = await getSystemSettings();
  const { getTrialDurationMs } = await import("./admin-settings");
  const trialExpiresAt = new Date(Date.now() + getTrialDurationMs(settings)).toISOString();

  await userRef.update({
    emailVerified: true,
    trialExpiresAt,
    emailVerificationTokenHash: null,
    emailVerificationExpiresAt: null,
  });

  return { ok: true };
}
