import { getDb } from "./firebase-admin";
import { getTrialDurationMs as trialDurationFromConfig } from "./pricing-config";

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
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
  maintenanceUntil: string;
};

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  soloPricePkr: 999,
  teamPricePkr: 1999,
  trialDays: 14,
  trialMinutes: 0,
  subscriptionDays: 30,
  adminNotificationEmail: "",
  minExtensionVersion: "1.0.0",
  cronLastRun: null,
  cronLastResult: null,
  signupRequireEmailVerification: true,
  signupAllowedDomains: "",
  signupRateLimitPerHour: 20,
  trialOnePerIp: true,
  maintenanceEnabled: false,
  maintenanceMessage: "",
  maintenanceUntil: "",
};

const DOC_PATH = { collection: "settings", id: "system" };
const SETTINGS_TTL_MS = 10 * 60 * 1000;

let settingsCache: { value: SystemSettings; at: number } | null = null;

export async function getSystemSettings(): Promise<SystemSettings> {
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS) {
    return settingsCache.value;
  }

  const db = getDb();
  if (!db) return DEFAULT_SYSTEM_SETTINGS;

  try {
    const doc = await db.collection(DOC_PATH.collection).doc(DOC_PATH.id).get();
    const value = !doc.exists
      ? DEFAULT_SYSTEM_SETTINGS
      : { ...DEFAULT_SYSTEM_SETTINGS, ...(doc.data() as Partial<SystemSettings>) };
    settingsCache = { value, at: Date.now() };
    return value;
  } catch {
    return settingsCache?.value || DEFAULT_SYSTEM_SETTINGS;
  }
}

export async function saveSystemSettings(partial: Partial<SystemSettings>) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const current = await getSystemSettings();
  const next = { ...current, ...partial };
  await db.collection(DOC_PATH.collection).doc(DOC_PATH.id).set(next, { merge: true });
  settingsCache = { value: next, at: Date.now() };
  const silent = Object.keys(partial).every((key) => key === "cronLastRun" || key === "cronLastResult");
  if (!silent) {
    const { touchLive } = await import("./live-tick");
    const topic = "maintenanceEnabled" in partial || "maintenanceMessage" in partial || "maintenanceUntil" in partial
      ? "maintenance"
      : "settings";
    void touchLive({
      topic,
      action: "updated",
      id: topic === "maintenance" ? "maintenance" : "settings",
    });
  }
  return next;
}

export function getTrialDurationMs(settings: SystemSettings): number {
  return trialDurationFromConfig(settings);
}

export function planPricePkr(planId: string | undefined, settings: SystemSettings) {
  if (!planId) return 0;
  if (planId === "team" || planId === "ultra") return settings.teamPricePkr;
  if (planId === "solo" || planId === "studio" || planId === "nano") return settings.soloPricePkr;
  return 0;
}
