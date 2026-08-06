import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getDb } from "./firebase-admin";

export type StoredUser = {
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  trialExpiresAt: string;
  subscriptionPlan: string;
  subscriptionExpiresAt: string | null;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function makeSid(email: string) {
  return Buffer.from(`fb:${email}:${Date.now()}`)
    .toString("base64")
    .replace(/=+$/, "");
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
): Promise<{ ok: true; user: { email: string; name: string; sid: string } } | { ok: false; error: string }> {
  const db = getDb();
  if (!db) {
    return { ok: false, error: "Database not configured." };
  }

  const normalized = normalizeEmail(email);
  const trimmedName = name.trim();

  if (!normalized || !normalized.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (trimmedName.length < 2) {
    return { ok: false, error: "Enter your full name." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const usersRef = db.collection("users");
  const existingUserDoc = await usersRef.doc(normalized).get();
  
  if (existingUserDoc.exists) {
    return { ok: false, error: "An account with this email already exists. Sign in instead." };
  }

  const salt = randomBytes(16).toString("hex");
  const now = new Date();
  const trialExpiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 minutes from now

  const newUser: StoredUser = {
    email: normalized,
    name: trimmedName,
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: now.toISOString(),
    trialExpiresAt,
    subscriptionPlan: "none",
    subscriptionExpiresAt: null,
  };

  await usersRef.doc(normalized).set(newUser);

  return {
    ok: true,
    user: {
      email: normalized,
      name: trimmedName,
      sid: makeSid(normalized),
    },
  };
}

const PAID_PLANS = ["solo", "studio", "team"];

export async function createUserByAdmin(input: {
  email: string;
  name: string;
  password: string;
  subscriptionPlan: string;
  trialExpiresAt?: string;
  subscriptionExpiresAt?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  if (!db) {
    return { ok: false, error: "Database not configured." };
  }

  const normalized = normalizeEmail(input.email);
  const trimmedName = input.name.trim();
  const subscriptionPlan = input.subscriptionPlan || "trial";

  if (!normalized || !normalized.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (trimmedName.length < 2) {
    return { ok: false, error: "Enter the client's name." };
  }
  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const usersRef = db.collection("users");
  const existingUserDoc = await usersRef.doc(normalized).get();
  if (existingUserDoc.exists) {
    return { ok: false, error: "A client with this email already exists." };
  }

  const salt = randomBytes(16).toString("hex");
  const now = new Date();
  const defaultTrialExpiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const defaultSubExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const trialExpiresAt =
    input.trialExpiresAt ||
    (PAID_PLANS.includes(subscriptionPlan) ? now.toISOString() : defaultTrialExpiry);
  const subscriptionExpiresAt = PAID_PLANS.includes(subscriptionPlan)
    ? input.subscriptionExpiresAt || defaultSubExpiry
    : null;

  const newUser: StoredUser = {
    email: normalized,
    name: trimmedName,
    salt,
    passwordHash: hashPassword(input.password, salt),
    createdAt: now.toISOString(),
    trialExpiresAt,
    subscriptionPlan,
    subscriptionExpiresAt,
  };

  await usersRef.doc(normalized).set(newUser);
  return { ok: true };
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<{ ok: true; user: { email: string; name: string; sid: string } } | { ok: false; error: string }> {
  const db = getDb();
  if (!db) {
    return { ok: false, error: "Database not configured." };
  }

  const normalized = normalizeEmail(email);
  const userDoc = await db.collection("users").doc(normalized).get();

  if (!userDoc.exists) {
    return { ok: false, error: "Invalid email or password." };
  }

  const user = userDoc.data() as StoredUser;
  const nextHash = hashPassword(password, user.salt);
  const a = Buffer.from(user.passwordHash, "hex");
  const b = Buffer.from(nextHash, "hex");
  
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "Invalid email or password." };
  }

  return {
    ok: true,
    user: {
      email: user.email,
      name: user.name,
      sid: makeSid(user.email),
    },
  };
}

export async function getUserStatus(email: string): Promise<{
  active: boolean;
  trialActive: boolean;
  subscriptionActive: boolean;
  trialExpiresAt: string | null;
  subscriptionPlan: string;
  subscriptionExpiresAt: string | null;
} | null> {
  const db = getDb();
  if (!db) return null;
  
  const normalized = normalizeEmail(email);
  const userDoc = await db.collection("users").doc(normalized).get();
  
  if (!userDoc.exists) return null;
  
  const user = userDoc.data() as StoredUser;
  const now = new Date();
  
  const trialActive = user.trialExpiresAt ? new Date(user.trialExpiresAt) > now : false;
  const subscriptionActive = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) > now : false;
  
  return {
    active: trialActive || subscriptionActive,
    trialActive,
    subscriptionActive,
    trialExpiresAt: user.trialExpiresAt || null,
    subscriptionPlan: user.subscriptionPlan || "none",
    subscriptionExpiresAt: user.subscriptionExpiresAt || null,
  };
}
