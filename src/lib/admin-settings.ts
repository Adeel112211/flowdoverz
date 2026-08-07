import { getDb } from "./firebase-admin";

export type SystemSettings = {
  soloPricePkr: number;
  teamPricePkr: number;
  trialDays: number;
  trialMinutes: number;
  subscriptionDays: number;
  adminNotificationEmail: string;
  minExtensionVersion: string;
  cronLastRun: string | null;
  cronLastResult: string | null;
  signupRequireEmailVerification: boolean;
  signupAllowedDomains: string;
  signupRateLimitPerHour: number;
  trialOnePerIp: boolean;
};

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  soloPricePkr: 999,
  teamPricePkr: 1999,
  trialDays: 14,
  trialMinutes: 10,
  subscriptionDays: 30,
  adminNotificationEmail: "",
  minExtensionVersion: "1.0.0",
  cronLastRun: null,
  cronLastResult: null,
  signupRequireEmailVerification: true,
  signupAllowedDomains: "",
  signupRateLimitPerHour: 20,
  trialOnePerIp: true,
};

const DOC_PATH = { collection: "settings", id: "system" };

export async function getSystemSettings(): Promise<SystemSettings> {
  const db = getDb();
  if (!db) return DEFAULT_SYSTEM_SETTINGS;

  try {
    const doc = await db.collection(DOC_PATH.collection).doc(DOC_PATH.id).get();
    if (!doc.exists) return DEFAULT_SYSTEM_SETTINGS;
    return { ...DEFAULT_SYSTEM_SETTINGS, ...(doc.data() as Partial<SystemSettings>) };
  } catch {
    return DEFAULT_SYSTEM_SETTINGS;
  }
}

export async function saveSystemSettings(partial: Partial<SystemSettings>) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const current = await getSystemSettings();
  const next = { ...current, ...partial };
  await db.collection(DOC_PATH.collection).doc(DOC_PATH.id).set(next, { merge: true });
  return next;
}

export function getTrialDurationMs(settings: SystemSettings): number {
  if (settings.trialMinutes > 0) {
    return settings.trialMinutes * 60 * 1000;
  }
  return Math.max(settings.trialDays, 1) * 24 * 60 * 60 * 1000;
}

export function planPricePkr(planId: string | undefined, settings: SystemSettings) {
  if (!planId) return 0;
  if (planId === "team" || planId === "ultra") return settings.teamPricePkr;
  if (planId === "solo" || planId === "studio" || planId === "nano") return settings.soloPricePkr;
  return 0;
}
