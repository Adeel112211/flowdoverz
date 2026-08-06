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
    periodLabel: "1-day trial",
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
    originalPricePkr: 1499,
    saveBadge: "SAVE 33%",
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
    originalPricePkr: 2999,
    saveBadge: "SAVE 33%",
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

export function mergePricingConfig(partial?: Partial<PricingConfig> | null): PricingConfig {
  if (!partial) {
    return {
      ...DEFAULT_PRICING_CONFIG,
      plans: DEFAULT_PRICING_PLANS.map((p) => ({ ...p, features: [...p.features] })),
    };
  }

  const planMap = new Map(DEFAULT_PRICING_PLANS.map((p) => [p.id, { ...p, features: [...p.features] }]));
  for (const plan of partial.plans || []) {
    const base = planMap.get(plan.id);
    if (base) {
      planMap.set(plan.id, {
        ...base,
        ...plan,
        features: plan.features?.length ? plan.features : base.features,
      });
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
