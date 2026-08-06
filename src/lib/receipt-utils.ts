import type { PricingPlan } from "./pricing-config";

export function planDisplayName(planId: string) {
  if (planId === "solo" || planId === "studio" || planId === "nano") return "Solo";
  if (planId === "team" || planId === "ultra") return "Team";
  if (planId === "trial") return "Trial";
  return planId.charAt(0).toUpperCase() + planId.slice(1);
}

export function formatPkr(amount: number) {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

export function generateReceiptNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCP-${ymd}-${rand}`;
}

export function generateRefundReceiptNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RFD-${ymd}-${rand}`;
}

export function planAmountPkr(planId: string, plans: PricingPlan[]) {
  const plan = plans.find((p) => p.id === planId);
  if (plan) return plan.priceMonthlyPkr;
  if (planId === "team") return 1999;
  if (planId === "solo") return 999;
  return 0;
}

/** Use stored payment amount when present; otherwise derive from plan pricing. */
export function normalizePlanIdForPricing(planId: string) {
  if (planId === "studio" || planId === "nano") return "solo";
  if (planId === "ultra") return "team";
  return planId;
}

export function resolvePaymentAmountPkr(
  planId: string,
  storedAmount: unknown,
  plans: PricingPlan[],
) {
  const stored = Number(storedAmount || 0);
  if (Number.isFinite(stored) && stored > 0) return stored;
  return planAmountPkr(normalizePlanIdForPricing(planId), plans);
}

export function formatReceiptDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
