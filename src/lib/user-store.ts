import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, FIREBASE_QUOTA_MESSAGE, isFirebaseQuotaError, isSupabaseBackend } from "./firebase-admin";
import { validateSignupEmail } from "./signup-email-policy";
import { canonicalizeMailboxEmail } from "./signup-email-rules";
import { getSignupSecuritySettings } from "./signup-security";
import { createClientSession, maxClientSessionsForPlan, verifyClientSession } from "./client-session";

export type StoredUser = {
  email: string;
  name: string;
  /** Lowercased / normalized name for uniqueness checks. */
  nameLower?: string;
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
  resellerId?: string;
  assignedSlot?: string;
  /** E.164 phone, e.g. +923001234567 */
  phone?: string;
  phoneCountryIso?: string;
  phoneCountryCode?: string;
  phoneNational?: string;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Case-insensitive name key used to prevent duplicate display names. */
export function normalizeClientNameKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Returns true if another client already uses this display name.
 * Checks `nameLower` (preferred) and exact `name` for older documents.
 */
export async function isClientNameTaken(
  name: string,
  excludeEmail?: string,
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const nameKey = normalizeClientNameKey(name);
  if (!nameKey) return false;

  const exclude = excludeEmail ? normalizeEmail(excludeEmail) : "";
  const usersRef = db.collection("users");

  const byLower = await usersRef.where("nameLower", "==", nameKey).limit(5).get();
  for (const doc of byLower.docs) {
    if (exclude && doc.id === exclude) continue;
    return true;
  }

  // Legacy docs without nameLower: exact trimmed match only.
  const trimmed = name.trim().replace(/\s+/g, " ");
  const byExact = await usersRef.where("name", "==", trimmed).limit(5).get();
  for (const doc of byExact.docs) {
    if (exclude && doc.id === exclude) continue;
    const data = doc.data();
    const existingKey =
      typeof data.nameLower === "string"
        ? data.nameLower
        : normalizeClientNameKey(String(data.name || ""));
    if (existingKey === nameKey) return true;
  }

  return false;
}

export function makeSid(email: string) {
  return createClientSession(email).sid;
}

function isSingleDeviceAccount(data: Record<string, unknown>) {
  const plan = String(data.subscriptionPlan || "none").toLowerCase();
  if (plan === "team") return false;
  if (plan === "solo" || plan === "studio" || plan === "nano" || plan === "trial") return true;
  const trialExpiresAt = data.trialExpiresAt ? new Date(String(data.trialExpiresAt)).getTime() : 0;
  return Number.isFinite(trialExpiresAt) && trialExpiresAt > Date.now();
}

function readActiveSessionIds(data: Record<string, unknown>): string[] {
  if (Array.isArray(data.activeClientSessionIds)) {
    return data.activeClientSessionIds.map(String).filter(Boolean);
  }
  const legacy = data.activeClientSessionId ? String(data.activeClientSessionId) : "";
  return legacy && legacy !== "null" && legacy !== "undefined" ? [legacy] : [];
}

function singleDeviceBlockedMessage(plan: string) {
  const normalized = String(plan || "").toLowerCase();
  if (normalized === "solo" || normalized === "studio" || normalized === "nano") {
    return "This email has an active Solo plan and cannot be used on multiple devices. Sign out on the other device, browser, or profile first.";
  }
  return "This email has an active trial and cannot be used on multiple devices. Sign out on the other device, browser, or profile first.";
}

/** Seat is live only while a portal/extension heartbeat is recent. */
const SOLO_SEAT_STALE_MS = 4 * 60 * 1000;

function isSoloSeatFresh(data: Record<string, unknown>): boolean {
  const seen = data.lastClientSeenAt ? Date.parse(String(data.lastClientSeenAt)) : 0;
  if (!Number.isFinite(seen) || seen <= 0) return false;
  return Date.now() - seen < SOLO_SEAT_STALE_MS;
}

/**
 * Solo/trial seat is held only while soloSeatActive is true AND the
 * previous browser was seen recently. Closed/crashed sessions (logout
 * beacon missed) must not block the next login.
 */
function isSoloSeatHeld(data: Record<string, unknown>): boolean {
  if (data.soloSeatActive !== true) return false;
  if (readActiveSessionIds(data).length === 0) return false;
  return isSoloSeatFresh(data);
}

function clearedSoloSeatFields() {
  return {
    activeClientSessionIds: [] as string[],
    activeClientSessionId: null as string | null,
    lastClientSeenAt: null as string | null,
    activeClientSessionAt: null as string | null,
    soloSeatActive: false,
    clientSessionLock: false,
    portalSid: null as string | null,
  };
}

/**
 * Drop one browser seat. Logout frees Solo/trial instantly (no timer).
 */
export async function releaseClientSession(email: string, sessionId: string) {
  const db = getDb();
  if (!db || !sessionId) return;

  const userRef = db.collection("users").doc(normalizeEmail(email));
  const snap = await userRef.get();
  if (!snap.exists) return;

  const data = (snap.data() || {}) as Record<string, unknown>;

  // Solo/trial: any logout frees the only seat immediately.
  if (isSingleDeviceAccount(data)) {
    await userRef.set(clearedSoloSeatFields(), { merge: true });
    invalidateUserDocCache(email);
    return;
  }

  const previous = readActiveSessionIds(data);
  const next = previous.filter((id) => id !== sessionId);

  if (next.length === 0) {
    await userRef.set(clearedSoloSeatFields(), { merge: true });
    invalidateUserDocCache(email);
    return;
  }

  await userRef.set(
    {
      activeClientSessionIds: next,
      activeClientSessionId: next[0] || null,
    },
    { merge: true },
  );
  invalidateUserDocCache(email);
}

/**
 * Claim a browser seat.
 * Solo/trial: block second device while seat is active; free instantly after logout.
 * Team: up to 3 browsers.
 */
export async function claimClientSession(
  email: string,
  sessionId: string,
  options?: { existingSessionId?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  if (!db || !sessionId) return { ok: false, error: "Database not configured." };

  const normalized = normalizeEmail(email);
  const userRef = db.collection("users").doc(normalized);
  const snap = await userRef.get();
  if (!snap.exists) return { ok: false, error: "User not found." };

  const data = (snap.data() || {}) as Record<string, unknown>;
  const plan = String(data.subscriptionPlan || "none");
  const nowIso = new Date().toISOString();
  const singleDevice = isSingleDeviceAccount(data);
  const previous = readActiveSessionIds(data);
  const existingSessionId = String(options?.existingSessionId || "");

  if (singleDevice) {
    const currentId = previous[0] || "";
    const sameBrowser =
      Boolean(currentId) &&
      (currentId === sessionId || (existingSessionId && existingSessionId === currentId));
    // Same browser can sign in again. A different live browser stays blocked.
    if (currentId && currentId !== sessionId && isSoloSeatHeld(data) && !sameBrowser) {
      return { ok: false, error: singleDeviceBlockedMessage(plan) };
    }

    await userRef.set(
      {
        activeClientSessionId: sessionId,
        activeClientSessionIds: [sessionId],
        activeClientSessionAt: nowIso,
        lastClientSeenAt: nowIso,
        soloSeatActive: true,
        clientSessionLock: false,
      },
      { merge: true },
    );
    invalidateUserDocCache(normalized);
    return { ok: true };
  }

  const max = maxClientSessionsForPlan(plan);
  if (previous.includes(sessionId)) {
    await userRef.set({ lastClientSeenAt: nowIso }, { merge: true });
    invalidateUserDocCache(normalized);
    return { ok: true };
  }

  if (previous.length >= max) {
    return {
      ok: false,
      error: `This Team plan already has ${max} active browsers. Sign out on another device first.`,
    };
  }

  const next = [sessionId, ...previous.filter((id) => id !== sessionId)];
  await userRef.set(
    {
      activeClientSessionId: next[0] || sessionId,
      activeClientSessionIds: next,
      activeClientSessionAt: nowIso,
      lastClientSeenAt: nowIso,
      soloSeatActive: true,
      clientSessionLock: false,
    },
    { merge: true },
  );
  invalidateUserDocCache(normalized);
  return { ok: true };
}

export async function bindActiveClientSession(email: string, sessionId: string) {
  await claimClientSession(email, sessionId);
}

const lastSeatTouchAt = new Map<string, number>();
const SEAT_TOUCH_MIN_MS = 10 * 60 * 1000;
const USER_DOC_TTL_MS = 20 * 1000;
const userDocCache = new Map<
  string,
  { at: number; exists: boolean; data: Record<string, unknown> | null }
>();

function invalidateUserDocCache(email?: string) {
  if (!email) {
    userDocCache.clear();
    return;
  }
  userDocCache.delete(normalizeEmail(email));
}

export { invalidateUserDocCache };

export async function getUserRecord(email: string): Promise<Record<string, unknown> | null> {
  const doc = await readUserDoc(email);
  return doc.exists ? doc.data : null;
}

async function readUserDoc(email: string): Promise<{
  exists: boolean;
  data: Record<string, unknown> | null;
}> {
  const db = getDb();
  const key = normalizeEmail(email);
  if (!db) return { exists: false, data: null };
  const cached = userDocCache.get(key);
  if (cached && Date.now() - cached.at < USER_DOC_TTL_MS) {
    return { exists: cached.exists, data: cached.data };
  }
  const snap = await db.collection("users").doc(key).get();
  const entry = {
    at: Date.now(),
    exists: snap.exists,
    data: snap.exists ? ((snap.data() || {}) as Record<string, unknown>) : null,
  };
  userDocCache.set(key, entry);
  return entry;
}

export async function touchClientSessionActivity(email: string) {
  const db = getDb();
  if (!db) return;
  const key = normalizeEmail(email);
  const now = Date.now();
  const prev = lastSeatTouchAt.get(key) || 0;
  if (now - prev < SEAT_TOUCH_MIN_MS) return;
  lastSeatTouchAt.set(key, now);
  await db.collection("users").doc(key).set(
    { lastClientSeenAt: new Date().toISOString() },
    { merge: true },
  );
  invalidateUserDocCache(key);
}

/** Returns false when this browser is not the allowed Solo/trial session. */
export async function isActiveClientSession(
  email: string,
  sessionId: string,
): Promise<boolean> {
  const db = getDb();
  if (!db || !sessionId) return false;

  const snap = await readUserDoc(email);
  if (!snap.exists || !snap.data) return false;

  const data = snap.data;
  const plan = String(data.subscriptionPlan || "none");
  const max = maxClientSessionsForPlan(plan);
  const singleDevice = isSingleDeviceAccount(data);
  const ids = readActiveSessionIds(data);

  if (ids.length === 0) {
    // After logout the seat is empty — require a fresh login, do not auto-reclaim.
    if (singleDevice) return false;
    const claimed = await claimClientSession(email, sessionId);
    return claimed.ok;
  }

  if (singleDevice || max <= 1) {
    // Logout clears soloSeatActive immediately — treat as signed out.
    if (singleDevice && data.soloSeatActive !== true) return false;
    const ok = ids[0] === sessionId || data.activeClientSessionId === sessionId;
    if (ok) void touchClientSessionActivity(email);
    return Boolean(ok);
  }

  const ok = ids.includes(sessionId);
  if (ok) void touchClientSessionActivity(email);
  return ok;
}

export const SESSION_REPLACED_MESSAGE =
  "This email has an active Solo plan and cannot be used on multiple devices. Sign out on the other device first.";

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
  partnerCode?: string,
  phoneInput?: { countryIso?: string; nationalNumber?: string },
): Promise<
  | { ok: true; user: { email: string; name: string; sid: string }; trialGranted: boolean }
  | { ok: false; error: string }
> {
  const db = getDb();
  if (!db) {
    return { ok: false, error: "Database not configured." };
  }

  const { consumeSignupVerification } = await import("./signup-verification-code");
  const { normalizePhoneInput } = await import("./phone");
  const normalized = normalizeEmail(email);
  const trimmedName = name.trim();
  const security = await getSignupSecuritySettings();

  const emailCheck = await validateSignupEmail(normalized, {
    allowedDomains: security.allowedDomains,
  });
  if (!emailCheck.ok) {
    return { ok: false, error: emailCheck.error };
  }

  const phoneCheck = normalizePhoneInput(
    String(phoneInput?.countryIso || ""),
    String(phoneInput?.nationalNumber || ""),
  );
  if (!phoneCheck.ok) {
    return { ok: false, error: phoneCheck.error };
  }

  const { hashSignupIp, isSignupIpAvailable, recordSignupIpUsage, SIGNUP_IP_REJECTED } = await import(
    "./signup-security"
  );

  if (!(await isSignupIpAvailable(signupIp))) {
    return { ok: false, error: SIGNUP_IP_REJECTED };
  }

  const codeCheck = await consumeSignupVerification(emailCheck.email, verificationCode);
  if (!codeCheck.ok) {
    return { ok: false, error: codeCheck.error };
  }

  const displayName = trimmedName.replace(/\s+/g, " ");
  if (displayName.length < 2) {
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

  const typedEmail = normalizeEmail(email);
  if (typedEmail !== emailCheck.email) {
    const typedDoc = await usersRef.doc(typedEmail).get();
    if (typedDoc.exists) {
      return { ok: false, error: "An account with this email already exists. Sign in instead." };
    }
  }

  if (await isClientNameTaken(displayName)) {
    return { ok: false, error: "This name is already used. Choose a different name." };
  }

  const salt = randomBytes(16).toString("hex");
  const now = new Date();

  const partner = String(partnerCode || "").trim();
  let trialGranted = false;
  let trialExpiresAt: string | null = null;
  let subscriptionPlan = "none";
  let subscriptionExpiresAt: string | null = null;
  let resellerId: string | undefined;
  let assignedSlot: string | undefined;

  if (partner) {
    const { resolveOfficialSignup, subscriptionExpiryFromNow } = await import("./reseller-store");
    const resolved = await resolveOfficialSignup(partner);
    if (!resolved.ok) {
      return { ok: false, error: resolved.error };
    }
    trialGranted = false;
    trialExpiresAt = now.toISOString();
    subscriptionPlan = "solo";
    subscriptionExpiresAt = subscriptionExpiryFromNow(resolved.reseller.seatDays);
    resellerId = resolved.reseller.id;
    assignedSlot = resolved.slot;
  }
  // Public signup: no free trial — account starts with plan "none" until they pay.

  const newUser: StoredUser = {
    email: emailCheck.email,
    name: displayName,
    nameLower: normalizeClientNameKey(displayName),
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: now.toISOString(),
    trialExpiresAt,
    subscriptionPlan,
    subscriptionExpiresAt,
    emailVerified: true,
    phone: phoneCheck.phone.e164,
    phoneCountryIso: phoneCheck.phone.countryIso,
    phoneCountryCode: phoneCheck.phone.countryCode,
    phoneNational: phoneCheck.phone.nationalNumber,
    signupIpHash: signupIp ? hashSignupIp(signupIp) : null,
    ...(resellerId ? { resellerId } : {}),
    ...(assignedSlot ? { assignedSlot } : {}),
  };

  await usersRef.doc(emailCheck.email).set(newUser);
  const { touchLive } = await import("./live-tick");
  void touchLive({ topic: "user", action: "created", id: emailCheck.email, userId: emailCheck.email });
  const { recordUserCreated } = await import("./admin-metrics");
  void recordUserCreated(now, Boolean(partner));

  if (signupIp) {
    await recordSignupIpUsage(signupIp, emailCheck.email);
  }

  const created = createClientSession(emailCheck.email);
  const claimed = await claimClientSession(emailCheck.email, created.sessionId);
  if (!claimed.ok) {
    return { ok: false, error: claimed.error };
  }

  return {
    ok: true,
    trialGranted,
    user: {
      email: emailCheck.email,
      name: displayName,
      sid: created.sid,
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
  const plan = String(status.subscriptionPlan || "none").trim().toLowerCase();
  if (plan === "trial") {
    return {
      expiryAt: status.trialExpiresAt,
      planName: "Free Trial",
      userType: "trial",
    };
  }
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
  resellerId?: string;
  assignedSlot?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  if (!db) {
    return { ok: false, error: "Database not configured." };
  }

  const normalized = normalizeEmail(input.email);
  const displayName = input.name.trim().replace(/\s+/g, " ");
  const subscriptionPlan = String(input.subscriptionPlan || "trial").trim().toLowerCase();
  const isTrialPlan = subscriptionPlan === "trial";

  if (!normalized || !normalized.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (displayName.length < 2) {
    return { ok: false, error: "Enter the client's name." };
  }
  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const usersRef = db.collection("users");

  if (await isClientNameTaken(displayName)) {
    return { ok: false, error: "This name is already used. Choose a different name." };
  }

  const salt = randomBytes(16).toString("hex");
  const now = new Date();
  const { getSystemSettings, getSubscriptionDurationMs, getTrialDurationMs } = await import(
    "./admin-settings"
  );
  const settings = await getSystemSettings();
  const defaultTrialExpiry = new Date(now.getTime() + getTrialDurationMs(settings)).toISOString();
  const defaultSubExpiry = new Date(now.getTime() + getSubscriptionDurationMs(settings)).toISOString();

  const trialExpiresAt = isTrialPlan
    ? input.trialExpiresAt || defaultTrialExpiry
    : input.trialExpiresAt ||
      (PAID_PLANS.includes(subscriptionPlan) ? now.toISOString() : defaultTrialExpiry);
  const subscriptionExpiresAt = PAID_PLANS.includes(subscriptionPlan)
    ? input.subscriptionExpiresAt || defaultSubExpiry
    : null;

  const userDoc: Record<string, unknown> = {
    email: normalized,
    name: displayName,
    nameLower: normalizeClientNameKey(displayName),
    salt,
    passwordHash: hashPassword(input.password, salt),
    createdAt: now.toISOString(),
    trialExpiresAt,
    subscriptionPlan: isTrialPlan ? "trial" : subscriptionPlan,
    emailVerified: true,
    ...(input.resellerId ? { resellerId: input.resellerId } : {}),
    ...(input.assignedSlot ? { assignedSlot: input.assignedSlot } : {}),
    ...(PAID_PLANS.includes(subscriptionPlan) && subscriptionExpiresAt
      ? { subscriptionExpiresAt: subscriptionExpiresAt }
      : {}),
  };

  const ref = usersRef.doc(normalized);
  try {
    if (isSupabaseBackend()) {
      const { SupabaseDocumentAlreadyExistsError } = await import("./supabase-firestore");
      const existing = await ref.get();
      if (existing.exists) {
        return { ok: false, error: "A client with this email already exists." };
      }
      try {
        const { supabaseCreateDocOnly } = await import("./supabase-firestore");
        await supabaseCreateDocOnly("users", normalized, userDoc);
      } catch (error) {
        if (error instanceof SupabaseDocumentAlreadyExistsError) {
          return { ok: false, error: "A client with this email already exists." };
        }
        throw error;
      }
    } else {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (snap.exists) {
          throw new Error("DUPLICATE_EMAIL");
        }
        transaction.set(ref, userDoc);
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_EMAIL") {
      return { ok: false, error: "A client with this email already exists." };
    }
    throw error;
  }
  invalidateUserDocCache(normalized);
  const { touchLive } = await import("./live-tick");
  void touchLive({ topic: "user", action: "created", id: normalized, userId: normalized });
  return { ok: true };
}

/** Force trial fields after create — restores pre-removal reseller trial behavior on Supabase/Firestore. */
export async function persistResellerTrialUserDoc(
  email: string,
  input: {
    trialExpiresAt: string;
    resellerId: string;
    assignedSlot: string;
  },
) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");
  const normalized = normalizeEmail(email);
  await db.collection("users").doc(normalized).set(
    {
      subscriptionPlan: "trial",
      trialExpiresAt: input.trialExpiresAt,
      resellerId: input.resellerId,
      assignedSlot: input.assignedSlot,
      subscriptionExpiresAt: FieldValue.delete(),
    },
    { merge: true },
  );
  invalidateUserDocCache(normalized);
}

/** Force paid Solo/Team fields after create — never leave as trial. */
export async function persistResellerPaidUserDoc(
  email: string,
  input: {
    subscriptionPlan: string;
    subscriptionExpiresAt: string;
    resellerId: string;
    assignedSlot: string;
  },
) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");
  const normalized = normalizeEmail(email);
  const plan = String(input.subscriptionPlan || "solo").trim().toLowerCase();
  await db.collection("users").doc(normalized).set(
    {
      subscriptionPlan: plan,
      subscriptionExpiresAt: input.subscriptionExpiresAt,
      resellerId: input.resellerId,
      assignedSlot: input.assignedSlot,
      trialExpiresAt: new Date().toISOString(),
    },
    { merge: true },
  );
  invalidateUserDocCache(normalized);
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
  options?: { existingSessionId?: string },
): Promise<
  | { ok: true; user: { email: string; name: string; sid: string } }
  | { ok: false; error: string; code?: string }
> {
  const db = getDb();
  if (!db) {
    return { ok: false, error: "Database not configured." };
  }

  try {
    const normalized = normalizeEmail(email);
    const users = db.collection("users");
    let userDoc = await users.doc(normalized).get();
    if (!userDoc.exists) {
      const canonical = canonicalizeMailboxEmail(normalized);
      if (canonical !== normalized) {
        userDoc = await users.doc(canonical).get();
      }
    }

    if (!userDoc.exists) {
      return { ok: false, error: "Invalid email or password." };
    }

    const user = userDoc.data() as StoredUser;
    if (!user?.salt || !user?.passwordHash) {
      return { ok: false, error: "Invalid email or password." };
    }

    const nextHash = hashPassword(password, user.salt);
    const a = Buffer.from(user.passwordHash, "hex");
    const b = Buffer.from(nextHash, "hex");

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "Invalid email or password." };
    }

    const created = createClientSession(user.email || normalized);
    const claimed = await claimClientSession(user.email || normalized, created.sessionId, {
      existingSessionId: options?.existingSessionId,
    });
    if (!claimed.ok) {
      return { ok: false, error: claimed.error, code: "MULTI_DEVICE_BLOCKED" };
    }

    await db.collection("users").doc(normalizeEmail(user.email || normalized)).set(
      { portalSid: created.sid },
      { merge: true },
    );
    invalidateUserDocCache(normalizeEmail(user.email || normalized));

    return {
      ok: true,
      user: {
        email: user.email || normalized,
        name: user.name,
        sid: created.sid,
      },
    };
  } catch (error) {
    console.error("authenticateUser failed:", error);
    return {
      ok: false,
      error: isFirebaseQuotaError(error)
        ? FIREBASE_QUOTA_MESSAGE
        : "Could not sign in. Try again.",
      code: isFirebaseQuotaError(error) ? "QUOTA" : "AUTH_FAILED",
    };
  }
}

export async function getUserStatus(email: string): Promise<{
  active: boolean;
  trialActive: boolean;
  subscriptionActive: boolean;
  trialExpiresAt: string | null;
  subscriptionPlan: string;
  subscriptionExpiresAt: string | null;
  emailVerified: boolean;
  extensionTampered: boolean;
  extensionTamperMessage: string | null;
  extensionUpdateRequired: boolean;
  extensionRequiredVersion: string | null;
  brand: { name: string; logoUrl: string | null; resellerId: string } | null;
} | null> {
  const db = getDb();
  if (!db) return null;
  
  const normalized = normalizeEmail(email);
  const userDoc = await readUserDoc(normalized);
  
  if (!userDoc.exists || !userDoc.data) return null;
  
  const user = userDoc.data as StoredUser & {
    extensionTampered?: boolean;
    extensionTamperMessage?: string | null;
    extensionTamperedAt?: string | null;
    extensionUpdateRequired?: boolean;
    extensionRequiredVersion?: string | null;
  };
  const now = new Date();
  const emailVerified = user.emailVerified !== false;

  const plan = String(user.subscriptionPlan || "none").trim().toLowerCase();
  const trialEndMs = user.trialExpiresAt ? Date.parse(String(user.trialExpiresAt)) : NaN;
  const trialActive =
    plan === "trial"
      ? emailVerified && Number.isFinite(trialEndMs) && trialEndMs > now.getTime()
      : emailVerified && user.trialExpiresAt
        ? new Date(user.trialExpiresAt) > now && !isPaidPlan(plan)
        : false;
  const subscriptionActive =
    plan !== "trial" &&
    isPaidPlan(user.subscriptionPlan) &&
    user.subscriptionExpiresAt
      ? new Date(user.subscriptionExpiresAt) > now
      : false;

  // Sticky until cleared: extension removed, healthy official bridge, or successful sync.
  const extensionTampered = user.extensionTampered === true;

  let brand: { name: string; logoUrl: string | null; resellerId: string } | null = null;
  try {
    const { getResellerBrandForUserEmail } = await import("./extension-reseller-lookup");
    const resellerBrand = await getResellerBrandForUserEmail(normalized);
    if (resellerBrand) {
      brand = {
        name: resellerBrand.displayName,
        logoUrl: resellerBrand.logoUrl,
        resellerId: resellerBrand.resellerId,
      };
    }
  } catch {
    brand = null;
  }

  return {
    active: trialActive || subscriptionActive,
    trialActive,
    subscriptionActive,
    trialExpiresAt: user.trialExpiresAt || null,
    subscriptionPlan: user.subscriptionPlan || "none",
    subscriptionExpiresAt:
      plan === "trial" ? null : user.subscriptionExpiresAt || null,
    emailVerified,
    extensionTampered,
    extensionTamperMessage: extensionTampered ? user.extensionTamperMessage || null : null,
    extensionUpdateRequired: user.extensionUpdateRequired === true,
    extensionRequiredVersion: String(user.extensionRequiredVersion || "") || null,
    brand,
  };
}

/** Flag account when a modified / unprotected extension is detected. */
export async function markExtensionTampered(email: string, message?: string) {
  const db = getDb();
  if (!db) return;
  const normalized = normalizeEmail(email);
  await db.collection("users").doc(normalized).set(
    {
      extensionTampered: true,
      extensionTamperedAt: new Date().toISOString(),
      extensionTamperMessage:
        String(message || "").trim() ||
        "Modified extension. Download the official FlowDoverz build from your dashboard.",
    },
    { merge: true },
  );
  invalidateUserDocCache(normalized);
  const { touchLive } = await import("./live-tick");
  void touchLive({ topic: "user", action: "updated", id: normalized, userId: normalized });
}
export async function clearExtensionTampered(email: string) {
  const db = getDb();
  if (!db) return;
  const normalized = normalizeEmail(email);
  await db.collection("users").doc(normalized).set(
    {
      extensionTampered: false,
      extensionTamperedAt: null,
      extensionTamperMessage: null,
    },
    { merge: true },
  );
  invalidateUserDocCache(normalized);
}

export async function markExtensionUpdateRequired(email: string, latestVersion?: string) {
  const db = getDb();
  if (!db) return;
  const { EXTENSION_UPDATE_MESSAGE } = await import("./extension-version");
  const normalized = normalizeEmail(email);
  await db.collection("users").doc(normalized).set(
    {
      extensionUpdateRequired: true,
      extensionRequiredVersion: String(latestVersion || "").trim() || null,
      extensionUpdateRequiredAt: new Date().toISOString(),
      extensionUpdateMessage: EXTENSION_UPDATE_MESSAGE,
    },
    { merge: true },
  );
  invalidateUserDocCache(normalized);
  const { touchLive } = await import("./live-tick");
  void touchLive({ topic: "user", action: "updated", id: normalized, userId: normalized });
  if (latestVersion) {
    void touchLive({ topic: "extension", action: "updated", id: String(latestVersion) });
  }
}

export async function clearExtensionUpdateRequired(email: string) {
  const db = getDb();
  if (!db) return;
  const normalized = normalizeEmail(email);
  await db.collection("users").doc(normalized).set(
    {
      extensionUpdateRequired: false,
      extensionRequiredVersion: null,
      extensionUpdateRequiredAt: null,
      extensionUpdateMessage: null,
    },
    { merge: true },
  );
  invalidateUserDocCache(normalized);
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

/** Reseller API: mint a portal SID for a client that already belongs to this reseller. */
export async function issueResellerClientSession(
  resellerId: string,
  email: string,
  options?: { force?: boolean },
) {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) {
    return { ok: false as const, error: "Enter a valid email address.", status: 400 };
  }

  const record = await getUserRecord(normalized);
  if (!record) {
    return { ok: false as const, error: "Client not found.", status: 404 };
  }
  if (String(record.resellerId || "") !== resellerId) {
    return { ok: false as const, error: "This client does not belong to this reseller.", status: 403 };
  }

  const status = await getUserStatus(normalized);
  if (!status?.active) {
    return { ok: false as const, error: "This client has no active FlowDoverz access.", status: 403 };
  }

  const userEmail = String(record.email || normalized);

  if (!options?.force) {
    const storedSid = String(record.portalSid || "");
    if (storedSid) {
      const verified = verifyClientSession(storedSid);
      if (verified?.email === normalizeEmail(userEmail) && verified.sessionId) {
        const active = await isActiveClientSession(userEmail, verified.sessionId);
        if (active) {
          return {
            ok: true as const,
            email: userEmail,
            sid: storedSid,
            assignedSlot: String(record.assignedSlot || "") || null,
            subscriptionExpiresAt: status.subscriptionExpiresAt,
            reused: true as const,
          };
        }
      }
    }
  }

  const created = createClientSession(userEmail);
  const claimed = await claimClientSession(userEmail, created.sessionId);
  if (!claimed.ok) {
    return { ok: false as const, error: claimed.error, status: 403 };
  }

  const db = getDb();
  if (db) {
    await db.collection("users").doc(normalized).set({ portalSid: created.sid }, { merge: true });
    invalidateUserDocCache(normalized);
  }

  return {
    ok: true as const,
    email: userEmail,
    sid: created.sid,
    assignedSlot: String(record.assignedSlot || "") || null,
    subscriptionExpiresAt: status.subscriptionExpiresAt,
  };
}
