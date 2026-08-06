import { getDb } from "./firebase-admin";
import {
  mergePricingConfig,
  type PricingConfig,
} from "./pricing-config";

const DOC_PATH = { collection: "settings", id: "pricing" };

export async function getPricingConfig(): Promise<PricingConfig> {
  const db = getDb();
  if (!db) return mergePricingConfig(null);

  try {
    const doc = await db.collection(DOC_PATH.collection).doc(DOC_PATH.id).get();
    if (!doc.exists) return mergePricingConfig(null);
    return mergePricingConfig(doc.data() as Partial<PricingConfig>);
  } catch {
    return mergePricingConfig(null);
  }
}

export async function savePricingConfig(partial: Partial<PricingConfig>) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const current = await getPricingConfig();
  const next = mergePricingConfig({ ...current, ...partial });

  await db.collection(DOC_PATH.collection).doc(DOC_PATH.id).set(next, { merge: true });

  const { saveSystemSettings } = await import("./admin-settings");
  const solo = next.plans.find((p) => p.id === "solo");
  const team = next.plans.find((p) => p.id === "team");
  await saveSystemSettings({
    soloPricePkr: solo?.priceMonthlyPkr ?? 999,
    teamPricePkr: team?.priceMonthlyPkr ?? 1999,
    trialDays: next.trialDays,
    subscriptionDays: next.subscriptionDays,
  });

  return next;
}
