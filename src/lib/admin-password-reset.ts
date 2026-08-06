import { createHash, randomInt, timingSafeEqual } from "crypto";
import { getDb } from "./firebase-admin";

export const DEFAULT_ADMIN_RECOVERY_EMAIL =
  process.env.ADMIN_RECOVERY_EMAIL?.trim().toLowerCase() || "adeelshamshad610@gmail.com";

const RESET_TTL_MS = 15 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 2 * 60 * 1000;

function hashResetCode(code: string) {
  const secret =
    process.env.FLOWBRIDGE_ADMIN_SECRET?.trim() ||
    process.env.FLOWBRIDGE_ADMIN_PASSWORD?.trim() ||
    "flowdoverz-admin-reset";
  return createHash("sha256").update(`${code}:${secret}`).digest("hex");
}

export function maskEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return "***";

  if (local.length <= 5) {
    return `${local.slice(0, 1)}**@${domain}`;
  }

  const start = local.slice(0, 4);
  const end = local.slice(-3);
  return `${start}**${end}@${domain}`;
}

export async function getAdminRecoveryEmail(): Promise<string> {
  return DEFAULT_ADMIN_RECOVERY_EMAIL;
}

export function generateResetCode() {
  return String(randomInt(100000, 999999));
}

export async function canRequestPasswordReset() {
  const db = getDb();
  if (!db) return { ok: true as const };

  const doc = await db.collection("settings").doc("admin").get();
  const last = doc.data()?.resetRequestedAt;
  if (!last) return { ok: true as const };

  const elapsed = Date.now() - Number(last);
  if (elapsed < REQUEST_COOLDOWN_MS) {
    return {
      ok: false as const,
      waitSeconds: Math.ceil((REQUEST_COOLDOWN_MS - elapsed) / 1000),
    };
  }

  return { ok: true as const };
}

export async function storePasswordResetCode(code: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available.");

  await db.collection("settings").doc("admin").set(
    {
      resetCodeHash: hashResetCode(code),
      resetCodeExpiresAt: Date.now() + RESET_TTL_MS,
      resetRequestedAt: Date.now(),
    },
    { merge: true },
  );
}

export async function verifyPasswordResetCode(code: string) {
  const db = getDb();
  if (!db) return false;

  const doc = await db.collection("settings").doc("admin").get();
  const data = doc.data();
  if (!data?.resetCodeHash || !data?.resetCodeExpiresAt) return false;
  if (Date.now() > Number(data.resetCodeExpiresAt)) return false;

  const incoming = hashResetCode(String(code).trim());
  try {
    const a = Buffer.from(incoming);
    const b = Buffer.from(String(data.resetCodeHash));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function clearPasswordResetCode() {
  const db = getDb();
  if (!db) return;

  await db.collection("settings").doc("admin").set(
    {
      resetCodeHash: null,
      resetCodeExpiresAt: null,
    },
    { merge: true },
  );
}

export async function setAdminPassword(newPassword: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available.");

  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  await db.collection("settings").doc("admin").set({ password: newPassword }, { merge: true });
}
