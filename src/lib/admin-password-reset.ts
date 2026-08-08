import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";
import { getDb } from "./firebase-admin";
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_PIN_LENGTH,
  ADMIN_RESET_CODE_LENGTH,
  normalizeAdminAuthMode,
  type AdminAuthMode,
} from "./admin-auth-mode";

export type { AdminAuthMode } from "./admin-auth-mode";
export {
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_PIN_LENGTH,
  ADMIN_RESET_CODE_LENGTH,
  normalizeAdminAuthMode,
} from "./admin-auth-mode";

const RESET_TTL_MS = 15 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 2 * 60 * 1000;
const MAX_RESET_VERIFY_ATTEMPTS = 5;

type AdminSettingsData = {
  password?: string;
  passwordHash?: string;
  passwordSalt?: string;
  authMode?: string;
  sessionVersion?: number;
  resetCodeHash?: string | null;
  resetCodeExpiresAt?: number | null;
  resetRequestedAt?: number | null;
  resetAttempts?: number | null;
};

function hashPepper() {
  return (
    process.env.FLOWBRIDGE_ADMIN_PASSWORD?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "flowdoverz-admin-reset"
  );
}

function hashResetCode(code: string) {
  return createHash("sha256")
    .update(`${code.trim()}:${hashPepper()}`)
    .digest("hex");
}

function hashAdminSecret(secret: string, salt: string) {
  return scryptSync(secret, salt, 64).toString("hex");
}

function safeEqualHex(a: string, b: string) {
  try {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
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
  const fromEnv = process.env.ADMIN_RECOVERY_EMAIL?.trim().toLowerCase();
  return fromEnv || "";
}

export function isFourDigitPin(value: string) {
  return /^\d{4}$/.test(value);
}

async function readAdminSettingsDoc(): Promise<AdminSettingsData | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const doc = await db.collection("settings").doc("admin").get();
    return doc.exists ? (doc.data() as AdminSettingsData) : null;
  } catch {
    return null;
  }
}

export async function getAdminSessionVersion(): Promise<number> {
  const data = await readAdminSettingsDoc();
  const version = Number(data?.sessionVersion || 0);
  return Number.isFinite(version) && version > 0 ? version : 1;
}

export async function getAdminPasswordMaterial(): Promise<{
  configured: boolean;
  passwordHash?: string;
  passwordSalt?: string;
  legacyPlaintext?: string;
  envPlaintext?: string;
  sessionVersion: number;
  authMode: AdminAuthMode;
}> {
  const data = await readAdminSettingsDoc();
  const envPlaintext = process.env.FLOWBRIDGE_ADMIN_PASSWORD?.trim() || "";
  const sessionVersion = Number(data?.sessionVersion || 0);
  const resolvedVersion =
    Number.isFinite(sessionVersion) && sessionVersion > 0 ? sessionVersion : 1;

  const storedMode = normalizeAdminAuthMode(data?.authMode);
  const legacyPlaintext =
    data?.password && !data?.passwordHash ? String(data.password) : "";

  let authMode: AdminAuthMode = storedMode || "password";
  if (!storedMode) {
    const probe = legacyPlaintext || envPlaintext;
    if (probe && isFourDigitPin(probe)) authMode = "pin";
  }

  if (data?.passwordHash && data?.passwordSalt) {
    return {
      configured: true,
      passwordHash: String(data.passwordHash),
      passwordSalt: String(data.passwordSalt),
      sessionVersion: resolvedVersion,
      authMode,
    };
  }

  if (legacyPlaintext) {
    return {
      configured: true,
      legacyPlaintext,
      sessionVersion: resolvedVersion,
      authMode,
    };
  }

  if (envPlaintext) {
    return {
      configured: true,
      envPlaintext,
      sessionVersion: resolvedVersion,
      authMode,
    };
  }

  return { configured: false, sessionVersion: resolvedVersion, authMode };
}

/** Public-safe login UI mode. Never exposes the secret itself. */
export async function getAdminAuthMode(): Promise<AdminAuthMode> {
  const material = await getAdminPasswordMaterial();
  return material.authMode;
}

export function generateResetCode() {
  const min = 10 ** (ADMIN_RESET_CODE_LENGTH - 1);
  const max = 10 ** ADMIN_RESET_CODE_LENGTH;
  return String(randomInt(min, max));
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
      resetAttempts: 0,
    },
    { merge: true },
  );
}

export async function verifyPasswordResetCode(code: string): Promise<{
  ok: boolean;
  locked?: boolean;
}> {
  const db = getDb();
  if (!db) return { ok: false };

  const ref = db.collection("settings").doc("admin");
  const doc = await ref.get();
  const data = doc.data() as AdminSettingsData | undefined;
  if (!data?.resetCodeHash || !data?.resetCodeExpiresAt) return { ok: false };
  if (Date.now() > Number(data.resetCodeExpiresAt)) {
    await clearPasswordResetCode();
    return { ok: false };
  }

  const attempts = Number(data.resetAttempts || 0);
  if (attempts >= MAX_RESET_VERIFY_ATTEMPTS) {
    await clearPasswordResetCode();
    return { ok: false, locked: true };
  }

  const incoming = hashResetCode(String(code).trim());
  const matched = safeEqualHex(incoming, String(data.resetCodeHash));

  if (!matched) {
    const nextAttempts = attempts + 1;
    if (nextAttempts >= MAX_RESET_VERIFY_ATTEMPTS) {
      await clearPasswordResetCode();
      return { ok: false, locked: true };
    }
    await ref.set({ resetAttempts: nextAttempts }, { merge: true });
    return { ok: false };
  }

  return { ok: true };
}

export async function clearPasswordResetCode() {
  const db = getDb();
  if (!db) return;

  await db.collection("settings").doc("admin").set(
    {
      resetCodeHash: null,
      resetCodeExpiresAt: null,
      resetAttempts: 0,
    },
    { merge: true },
  );
}

export function validateAdminCredential(
  newPassword: string,
  mode: AdminAuthMode,
): { ok: true } | { ok: false; error: string } {
  if (mode === "pin") {
    if (!isFourDigitPin(newPassword)) {
      return { ok: false, error: `PIN must be exactly ${ADMIN_PIN_LENGTH} digits.` };
    }
    return { ok: true };
  }

  if (newPassword.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  return { ok: true };
}

export async function setAdminPassword(
  newPassword: string,
  mode?: AdminAuthMode,
) {
  const db = getDb();
  if (!db) throw new Error("Database not available.");

  const resolvedMode: AdminAuthMode =
    mode || (isFourDigitPin(newPassword) ? "pin" : "password");
  const check = validateAdminCredential(newPassword, resolvedMode);
  if (!check.ok) {
    throw new Error(check.error);
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashAdminSecret(newPassword, salt);
  const current = await readAdminSettingsDoc();
  const prevVersion = Number(current?.sessionVersion || 0);
  const sessionVersion =
    Number.isFinite(prevVersion) && prevVersion > 0 ? prevVersion + 1 : 1;

  await db.collection("settings").doc("admin").set(
    {
      passwordHash,
      passwordSalt: salt,
      password: null,
      authMode: resolvedMode,
      sessionVersion,
    },
    { merge: true },
  );
}

/** Verify candidate against hashed / legacy / env secret. Migrates plaintext on success. */
export async function matchAdminPassword(candidate: string): Promise<boolean> {
  const material = await getAdminPasswordMaterial();
  if (!material.configured) return false;

  if (material.passwordHash && material.passwordSalt) {
    const incoming = hashAdminSecret(candidate, material.passwordSalt);
    return safeEqualHex(incoming, material.passwordHash);
  }

  const expected = material.legacyPlaintext || material.envPlaintext || "";
  if (!expected) return false;

  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  const ok = timingSafeEqual(a, b);

  // Upgrade legacy Firestore plaintext to a hash after a successful login.
  if (ok && material.legacyPlaintext) {
    try {
      await setAdminPassword(candidate, material.authMode);
    } catch (err) {
      console.error("Failed to migrate admin password to hash:", err);
    }
  }

  return ok;
}
