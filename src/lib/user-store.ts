import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getDb } from "./firebase-admin";
import { validateSignupEmail } from "./signup-email-policy";
import { getSignupSecuritySettings } from "./signup-security";
import { getSystemSettings } from "./admin-settings";
import { createClientSession } from "./client-session";

export type StoredUser = {
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  trialExpiresAt: string | null;
  subscriptionPlan: string;
  subscriptionExpiresAt: string | null;
  emailVerified?: boolean;
  emailVerificationTokenHash?: string | null;
  emailVerificationExpiresAt?: string | null;
  emailVerificationSentAt?: string | null;
  signupIpHash?: string | null;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function makeSid(email: string) {
  return createClientSession(email);
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

/** Public client self-signup at /signup — requires email verification code. */
export async function registerClientUser(
  email: string,
  password: string,
  name: string,
  verificationCode: string,
  signupIp?: string,
): Promise<
  | { ok: true; user: { email: string; name: string; sid: string }; trialGranted: boolean }
  | { ok: false; error: string }
> {
  const db = getDb();
  if (!db) {
    return { ok: false, error: "Database not configured." };
  }

  const { consumeSignupVerification } = await import("./signup-verification-code");
  const codeCheck = await consumeSignupVerification(email, verificationCode);
  if (!codeCheck.ok) {
    return { ok: false, error: codeCheck.error };
  }

  const normalized = normalizeEmail(email);
  const trimmedName = name.trim();
  const security = await getSignupSecuritySettings();

  const emailCheck = await validateSignupEmail(normalized, {
    allowedDomains: security.allowedDomains,
  });
  if (!emailCheck.ok) {
    return { ok: false, error: emailCheck.error };
  }

  if (trimmedName.length < 2) {
    return { ok: false, error: "Enter your full name." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const usersRef = db.collection("users");
  const existingUserDoc = await usersRef.doc(emailCheck.email).get();

  if (existingUserDoc.exists) {
    return { ok: false, error: "An account with this email already exists. Sign in instead." };
  }

  const salt = randomBytes(16).toString("hex");
  const now = new Date();
  const settings = await getSystemSettings();
  const { getTrialDurationMs } = await import("./admin-settings");
  const { hashSignupIp, isTrialEligibleForIp, recordTrialIpUsage } = await import(
    "./signup-security"
  );

  const trialGranted = await isTrialEligibleForIp(signupIp);
  const trialExpiresAt = trialGranted
    ? new Date(now.getTime() + getTrialDurationMs(settings)).toISOString()
    : null;

  const newUser: StoredUser = {
    email: emailCheck.email,
    name: trimmedName,
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: now.toISOString(),
    trialExpiresAt,
    subscriptionPlan: "none",
    subscriptionExpiresAt: null,
    emailVerified: true,
    signupIpHash: signupIp ? hashSignupIp(signupIp) : null,
  };

  await usersRef.doc(emailCheck.email).set(newUser);

  if (trialGranted && signupIp) {
    await recordTrialIpUsage(signupIp, emailCheck.email);
  }

  return {
    ok: true,
    trialGranted,
    user: {
      email: emailCheck.email,
      name: trimmedName,
      sid: makeSid(emailCheck.email),
    },
  };
}

const PAID_PLANS = ["solo", "studio", "team"];

export function isPaidPlan(plan?: string | null) {
  return PAID_PLANS.includes(String(plan || ""));
}

export function planDisplayName(plan?: string | null): string {
  if (!plan || plan === "none") return "No plan";
  if (plan === "trial") return "Free Trial";
  if (plan === "solo" || plan === "studio" || plan === "nano") return "Solo";
  if (plan === "team" || plan === "ultra") return "Team";
  if (plan === "pending") return "Pending";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function resolveBillingPresentation(status: {
  trialActive: boolean;
  subscriptionActive: boolean;
  trialExpiresAt: string | null;
  subscriptionExpiresAt: string | null;
  subscriptionPlan: string;
}) {
  if (status.subscriptionActive && isPaidPlan(status.subscriptionPlan)) {
    return {
      expiryAt: status.subscriptionExpiresAt,
      planName: planDisplayName(status.subscriptionPlan),
      userType: status.subscriptionPlan,
    };
  }
  if (status.trialActive) {
    return {
      expiryAt: status.trialExpiresAt,
      planName: "Free Trial",
      userType: "trial",
    };
  }
  return {
    expiryAt: status.trialExpiresAt || status.subscriptionExpiresAt,
    planName: planDisplayName(status.subscriptionPlan),
    userType: status.subscriptionPlan === "trial" ? "trial" : "none",
  };
}

/** Admin panel — bypasses public client signup security rules. */
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
  const { getSystemSettings, getTrialDurationMs } = await import("./admin-settings");
  const settings = await getSystemSettings();
  const defaultTrialExpiry = new Date(now.getTime() + getTrialDurationMs(settings)).toISOString();
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
    emailVerified: true,
  };

  await usersRef.doc(normalized).set(newUser);
  return { ok: true };
}

export async function updateUserPasswordByAdmin(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  if (!db) {
    return { ok: false, error: "Database not configured." };
  }

  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const userRef = db.collection("users").doc(normalized);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    return { ok: false, error: "Client not found." };
  }

  const salt = randomBytes(16).toString("hex");
  await userRef.update({
    salt,
    passwordHash: hashPassword(password, salt),
  });

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
  emailVerified: boolean;
} | null> {
  const db = getDb();
  if (!db) return null;
  
  const normalized = normalizeEmail(email);
  const userDoc = await db.collection("users").doc(normalized).get();
  
  if (!userDoc.exists) return null;
  
  const user = userDoc.data() as StoredUser;
  const now = new Date();
  const emailVerified = user.emailVerified !== false;

  const trialActive =
    emailVerified && user.trialExpiresAt ? new Date(user.trialExpiresAt) > now : false;
  const subscriptionActive =
    isPaidPlan(user.subscriptionPlan) && user.subscriptionExpiresAt
      ? new Date(user.subscriptionExpiresAt) > now
      : false;

  return {
    active: trialActive || subscriptionActive,
    trialActive,
    subscriptionActive,
    trialExpiresAt: user.trialExpiresAt || null,
    subscriptionPlan: user.subscriptionPlan || "none",
    subscriptionExpiresAt: user.subscriptionExpiresAt || null,
    emailVerified,
  };
}

export type PlanActivationBlock = {
  code: "ACTIVE_PLAN" | "PENDING_PAYMENT";
  error: string;
};

export async function getPlanActivationBlock(
  email: string,
  options?: { excludePaymentId?: string },
): Promise<PlanActivationBlock | null> {
  const db = getDb();
  if (!db) return null;

  const normalized = normalizeEmail(email);
  const status = await getUserStatus(normalized);
  if (!status) {
    return { code: "ACTIVE_PLAN", error: "Account not found." };
  }

  if (status.subscriptionActive) {
    const expiryLabel = status.subscriptionExpiresAt
      ? new Date(status.subscriptionExpiresAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;
    return {
      code: "ACTIVE_PLAN",
      error: expiryLabel
        ? `You already have an active plan until ${expiryLabel}. You can purchase again after it expires.`
        : "You already have an active plan. You can purchase again after it expires.",
    };
  }

  const pendingSnap = await db
    .collection("manual_payments")
    .where("userEmail", "==", normalized)
    .where("status", "==", "pending")
    .get();

  const hasOtherPending = pendingSnap.docs.some(
    (doc) => doc.id !== options?.excludePaymentId,
  );

  if (hasOtherPending) {
    return {
      code: "PENDING_PAYMENT",
      error:
        "You already have a payment pending verification. Please wait for approval before submitting another.",
    };
  }

  return null;
}
