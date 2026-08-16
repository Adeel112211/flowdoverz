import { getDb } from "./firebase-admin";
import {
  mergePricingConfig,
  withLivePlanLabels,
  type PricingConfig,
} from "./pricing-config";

const DOC_PATH = { collection: "settings", id: "pricing" };

async function readPricingDoc(): Promise<Partial<PricingConfig> | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const doc = await db.collection(DOC_PATH.collection).doc(DOC_PATH.id).get();
    if (!doc.exists) return null;
    return doc.data() as Partial<PricingConfig>;
  } catch {
    return null;
  }
}

function toStoredConfig(config: PricingConfig): PricingConfig {
  return JSON.parse(JSON.stringify(config)) as PricingConfig;
}

export async function getPricingConfig(): Promise<PricingConfig> {
  return withLivePlanLabels(mergePricingConfig(await readPricingDoc()));
}

export async function savePricingConfig(partial: Partial<PricingConfig>) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const current = mergePricingConfig(await readPricingDoc());
  const next = toStoredConfig(mergePricingConfig({ ...current, ...partial }));

  await db.collection(DOC_PATH.collection).doc(DOC_PATH.id).set(next);

  const { saveSystemSettings } = await import("./admin-settings");
  const solo = next.plans.find((p) => p.id === "solo");
  const team = next.plans.find((p) => p.id === "team");
  await saveSystemSettings({
    soloPricePkr: solo?.priceMonthlyPkr ?? 999,
    teamPricePkr: team?.priceMonthlyPkr ?? 1999,
    trialDays: next.trialDays,
    trialMinutes: next.trialMinutes,
    trialOnePerIp: next.trialOnePerIp,
    subscriptionDays: next.subscriptionDays,
  });

  return withLivePlanLabels(next);
}
