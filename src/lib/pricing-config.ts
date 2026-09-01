export type PricingFeature = {
  text: string;
  highlight?: boolean;
};

export type PricingPlan = {
  id: "trial" | "solo" | "team";
  name: string;
  tagline: string;
  description: string;
  priceMonthlyPkr: number;
  priceAnnualPkr: number;
  periodLabel: string;
  originalPricePkr?: number;
  saveBadge?: string;
  btnLabel: string;
  featured: boolean;
  enabled: boolean;
  seats: number;
  features: PricingFeature[];
};

export type PricingConfig = {
  trialDays: number;
  trialMinutes: number;
  trialOnePerIp: boolean;
  subscriptionDays: number;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  plans: PricingPlan[];
};

export const DEFAULT_PRICING_PLANS: PricingPlan[] = [
  {
    id: "trial",
    name: "Trial",
    tagline: "Try before you buy",
    description:
      "Experience the full power of Google Flow with no commitment. Perfect for testing before you subscribe.",
    priceMonthlyPkr: 0,
    priceAnnualPkr: 0,
    periodLabel: "14-day trial",
    btnLabel: "Start Free Trial",
    featured: false,
    enabled: true,
    seats: 1,
    features: [
      { text: "1 Login (1 seat)" },
      { text: "Google Flow Access" },
      { text: "720p Outputs" },
      { text: "Chrome Extension" },
      { text: "Community support" },
    ],
  },
  {
    id: "solo",
    name: "Solo",
    tagline: "For solo creators",
    description:
      "Full Google Flow access for individual creators. One private account, no distractions, no limits.",
    priceMonthlyPkr: 999,
    priceAnnualPkr: 799,
    periodLabel: "per month · 30 days",
    btnLabel: "Get Solo Plan",
    featured: true,
    enabled: true,
    seats: 1,
    features: [
      { text: "1 Login (1 seat)" },
      { text: "Private Account", highlight: true },
      { text: "Parallel Generations", highlight: true },
      { text: "720p & 1080p Outputs", highlight: true },
      { text: "Ad-Free Experience" },
      { text: "Priority Support" },
    ],
  },
  {
    id: "team",
    name: "Team",
    tagline: "Built for teams",
    description:
      "Everything in Solo, scaled up for your whole team. 3 private accounts, full power unlocked.",
    priceMonthlyPkr: 1999,
    priceAnnualPkr: 1599,
    periodLabel: "per month · 30 days",
    btnLabel: "Get Team Plan",
    featured: false,
    enabled: true,
    seats: 3,
    features: [
      { text: "3 Logins (3 seats)" },
      { text: "Private Account", highlight: true },
      { text: "Parallel Generations", highlight: true },
      { text: "720p & 1080p Outputs", highlight: true },
      { text: "Ad-Free Experience" },
      { text: "Priority Support", highlight: true },
    ],
  },
];

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  trialDays: 14,
  trialMinutes: 0,
  trialOnePerIp: true,
  subscriptionDays: 30,
  heroEyebrow: "Transparent pricing · No hidden fees",
  heroTitle: "Pick your plan.",
  heroSubtitle:
    "No API costs. No waitlists. Full access to Google's most powerful AI video models.",
  plans: DEFAULT_PRICING_PLANS,
};

export function formatPkr(amount: number) {
  if (amount <= 0) return "Free";
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

function clonePlanWithoutDummyCompare(plan: PricingPlan): PricingPlan {
  const next: PricingPlan = { ...plan, features: [...plan.features] };
  delete next.originalPricePkr;
  delete next.saveBadge;
  return next;
}

function isStockDummyCompareAt(plan: PricingPlan) {
  if (plan.saveBadge !== "SAVE 33%") return false;
  if (plan.id === "solo" && Number(plan.originalPricePkr) === 1499) return true;
  if (plan.id === "team" && Number(plan.originalPricePkr) === 2999) return true;
  return false;
}

function mergePlan(base: PricingPlan, plan: Partial<PricingPlan>): PricingPlan {
  const merged: PricingPlan = {
    ...base,
    ...plan,
    features: plan.features?.length ? plan.features : [...base.features],
  };

  const original = Number(plan.originalPricePkr);
  if (Number.isFinite(original) && original > 0) {
    merged.originalPricePkr = original;
  } else {
    delete merged.originalPricePkr;
  }

  if (plan.saveBadge) {
    merged.saveBadge = plan.saveBadge;
  } else {
    delete merged.saveBadge;
  }

  if (isStockDummyCompareAt(merged)) {
    delete merged.originalPricePkr;
    delete merged.saveBadge;
  }

  if (merged.originalPricePkr && merged.originalPricePkr <= merged.priceMonthlyPkr) {
    delete merged.originalPricePkr;
    delete merged.saveBadge;
  }

  return merged;
}

export function mergePricingConfig(partial?: Partial<PricingConfig> | null): PricingConfig {
  const defaults = DEFAULT_PRICING_PLANS.map((p) => clonePlanWithoutDummyCompare(p));

  if (!partial) {
    return {
      ...DEFAULT_PRICING_CONFIG,
      plans: defaults,
    };
  }

  const planMap = new Map(defaults.map((p) => [p.id, { ...p, features: [...p.features] }]));
  for (const plan of partial.plans || []) {
    const base = planMap.get(plan.id);
    if (base) {
      planMap.set(plan.id, mergePlan(base, plan));
    }
  }

  return {
    ...DEFAULT_PRICING_CONFIG,
    ...partial,
    plans: DEFAULT_PRICING_PLANS.map((p) => planMap.get(p.id)!),
  };
}

export function planFromConfig(config: PricingConfig, planId: string) {
  return config.plans.find((p) => p.id === planId && p.enabled);
}

export function planPriceFromConfig(planId: string, config: PricingConfig) {
  const plan = config.plans.find((p) => p.id === planId);
  return plan?.priceMonthlyPkr ?? 0;
}

export const DEFAULT_SUBSCRIPTION_DAYS = DEFAULT_PRICING_CONFIG.subscriptionDays;

export function getSubscriptionDays(settings?: { subscriptionDays?: number }) {
  const days = Math.floor(Number(settings?.subscriptionDays));
  if (!Number.isFinite(days) || days < 1) return DEFAULT_SUBSCRIPTION_DAYS;
  return days;
}

export function getSubscriptionDurationMs(settings?: { subscriptionDays?: number }) {
  return getSubscriptionDays(settings) * 24 * 60 * 60 * 1000;
}

export function subscriptionExpiresAtFromNow(
  settings?: { subscriptionDays?: number },
  now = Date.now(),
) {
  return new Date(now + getSubscriptionDurationMs(settings)).toISOString();
}

/** Days win when set so a 14-day trial is not overridden by leftover minutes. */
export function getTrialDurationMs(settings: { trialDays?: number; trialMinutes?: number }) {
  const days = Math.max(0, Number(settings.trialDays) || 0);
  const minutes = Math.max(0, Number(settings.trialMinutes) || 0);
  if (days > 0) return days * 24 * 60 * 60 * 1000;
  if (minutes > 0) return minutes * 60 * 1000;
  return 14 * 24 * 60 * 60 * 1000;
}

export function formatTrialDurationLabel(settings: { trialDays?: number; trialMinutes?: number }) {
  const days = Math.max(0, Number(settings.trialDays) || 0);
  const minutes = Math.max(0, Number(settings.trialMinutes) || 0);
  if (days > 0) return days === 1 ? "1 day" : `${days} days`;
  if (minutes > 0) return minutes === 1 ? "1 min" : `${minutes} min`;
  return "14 days";
}

export function withLivePlanLabels(config: PricingConfig): PricingConfig {
  const trialLabel = formatTrialDurationLabel(config);
  return {
    ...config,
    plans: config.plans.map((plan) => {
      if (plan.id === "trial") {
        return { ...plan, periodLabel: `${trialLabel} trial` };
      }
      return plan;
    }),
  };
}
