import { createHash, randomInt, timingSafeEqual } from "crypto";
import { getDb } from "./firebase-admin";
import { validateSignupEmail } from "./signup-email-policy";
import { sendSignupVerificationCodeEmail } from "./email";
import { normalizeEmail } from "./user-store";

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const COLLECTION = "signup_verifications";

type SignupVerificationDoc = {
  codeHash: string;
  expiresAt: string;
  sentAt: string;
  verifiedAt?: string | null;
};

function hashSignupCode(code: string) {
  const secret =
    process.env.FLOWBRIDGE_ADMIN_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "flowdoverz-signup-code";
  return createHash("sha256").update(`${code.trim()}:${secret}`).digest("hex");
}

export function generateSignupCode() {
  return String(randomInt(100000, 999999));
}

export async function sendSignupVerificationCode(
  email: string,
  allowedDomains: string[] = [],
): Promise<{ ok: true } | { ok: false; error: string; waitSeconds?: number }> {
  const db = getDb();
  if (!db) return { ok: false, error: "Service unavailable." };

  const emailCheck = await validateSignupEmail(normalizeEmail(email), { allowedDomains });
  if (!emailCheck.ok) {
    return { ok: false, error: emailCheck.error };
  }

  const normalized = emailCheck.email;
  const existing = await db.collection("users").doc(normalized).get();
  if (existing.exists) {
    return { ok: false, error: "An account with this email already exists. Sign in instead." };
  }

  const ref = db.collection(COLLECTION).doc(normalized);
  const current = await ref.get();
  const sentAt = current.data()?.sentAt;
  if (sentAt) {
    const elapsed = Date.now() - new Date(String(sentAt)).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        error: "Please wait before requesting another code.",
        waitSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
      };
    }
  }

  const code = generateSignupCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  await ref.set({
    codeHash: hashSignupCode(code),
    expiresAt,
    sentAt: new Date().toISOString(),
    verifiedAt: null,
  } satisfies SignupVerificationDoc);

  try {
    await sendSignupVerificationCodeEmail(normalized, code);
    return { ok: true };
  } catch {
    await ref.delete();
    return { ok: false, error: "Could not send verification email. Try again later." };
  }
}

export async function verifySignupVerificationCode(
  email: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: "Service unavailable." };

  const normalized = normalizeEmail(email);
  const ref = db.collection(COLLECTION).doc(normalized);
  const doc = await ref.get();
  if (!doc.exists) {
    return { ok: false, error: "Request a verification code first." };
  }

  const data = doc.data() as SignupVerificationDoc;
  if (Date.now() > new Date(data.expiresAt).getTime()) {
    return { ok: false, error: "Code expired. Send a new one." };
  }

  const incoming = hashSignupCode(code);
  try {
    const a = Buffer.from(incoming);
    const b = Buffer.from(String(data.codeHash));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "Invalid verification code." };
    }
  } catch {
    return { ok: false, error: "Invalid verification code." };
  }

  await ref.update({ verifiedAt: new Date().toISOString() });
  return { ok: true };
}

export async function consumeSignupVerification(
  email: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await verifySignupVerificationCode(email, code);
  if (!result.ok) return result;

  const db = getDb();
  if (!db) return { ok: false, error: "Service unavailable." };

  await db.collection(COLLECTION).doc(normalizeEmail(email)).delete();
  return { ok: true };
}
