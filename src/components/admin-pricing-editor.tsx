"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Plus, Star, Trash2, CreditCard, LayoutTemplate } from "lucide-react";
import {
  formatPkr,
  type PricingConfig,
  type PricingFeature,
  type PricingPlan,
} from "@/lib/pricing-config";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-colors";

const labelClass = "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500";

function AccordionSection({
  title,
  description,
  icon: Icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  icon: typeof CreditCard;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-all duration-300 ${
        isOpen
          ? "border-cyan-500/30 bg-[#080810] ring-1 ring-cyan-500/20"
          : "border-white/10 bg-[#0F172A] hover:border-cyan-500/20"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 p-5 text-left md:p-6"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
              isOpen
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                : "border-white/10 bg-[#080810] text-slate-400"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className={`text-base font-bold md:text-lg ${isOpen ? "text-white" : "text-slate-300"}`}>
              {title}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 md:text-sm">{description}</p>
          </div>
        </div>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
            isOpen ? "rotate-45 bg-cyan-500 text-slate-950" : "border border-white/10 bg-[#080810] text-slate-400"
          }`}
        >
          <Plus className="h-4 w-4" />
        </div>
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-white/10 px-5 pb-6 pt-5 md:px-6 md:pb-7 md:pt-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function planAccent(planId: PricingPlan["id"]) {
  if (planId === "solo") {
    return {
      border: "border-cyan-500/40",
      gradient: "from-cyan-400 to-emerald-400",
      check: "bg-cyan-500 border-cyan-400",
      card: "from-[#0a1a20] to-[#030308]",
    };
  }
  if (planId === "team") {
    return {
      border: "border-violet-500/30",
      gradient: "from-violet-400 to-purple-600",
      check: "bg-violet-600 border-violet-500",
      card: "bg-[#07070f]",
    };
  }
  return {
    border: "border-white/10",
    gradient: "from-slate-400 to-slate-600",
    check: "bg-slate-600 border-slate-500",
    card: "bg-[#07070f]",
  };
}

export function PricingPlanPreview({ plan }: { plan: PricingPlan }) {
  const accent = planAccent(plan.id);
  const isFeatured = plan.featured;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-5 sm:p-6 ${
        isFeatured
          ? `bg-gradient-to-b ${accent.card} ${accent.border} shadow-[0_0_40px_rgba(6,182,212,0.12)]`
          : `${accent.card} ${accent.border}`
      }`}
    >
      <div className={`absolute top-0 left-6 right-6 h-px bg-gradient-to-r ${accent.gradient} opacity-70 rounded-full`} />
      {isFeatured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 text-[10px] font-black">
          <Star size={10} className="fill-slate-950" />
          MOST POPULAR
        </div>
      )}
      <div className="mb-4 mt-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{plan.tagline}</p>
        <h3 className="text-xl font-black text-white">{plan.name}</h3>
      </div>
      <div className="mb-3">
        <div className="flex items-end gap-2">
          <span className="text-3xl font-black text-white">{formatPkr(plan.priceMonthlyPkr)}</span>
          {plan.originalPricePkr && plan.originalPricePkr > plan.priceMonthlyPkr && (
            <span className="text-sm text-slate-500 line-through mb-1">
              {formatPkr(plan.originalPricePkr)}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">{plan.periodLabel}</p>
        {plan.saveBadge && (
          <span className="inline-block mt-2 rounded-md bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-400">
            {plan.saveBadge}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-400 mb-4 leading-relaxed">{plan.description}</p>
      <ul className="space-y-2 mb-5 flex-1">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${accent.check}`}>
              <Check className="h-2.5 w-2.5 text-white" />
            </span>
            <span className={f.highlight ? "text-white font-semibold" : "text-slate-400"}>{f.text}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`w-full rounded-xl py-2.5 text-sm font-bold ${
          isFeatured
            ? "bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950"
            : plan.id === "team"
              ? "bg-violet-600 text-white"
              : "bg-slate-600 text-white"
        }`}
      >
        {plan.btnLabel}
      </button>
    </div>
  );
}

type Props = {
  config: PricingConfig;
  onChange: (next: PricingConfig) => void;
};

export function AdminPricingEditor({ config, onChange }: Props) {
  const [activePlanId, setActivePlanId] = useState<PricingPlan["id"]>("solo");
  const [openSections, setOpenSections] = useState({
    page: true,
    billing: true,
    plan: true,
    pricing: true,
  });

  const activePlan = config.plans.find((p) => p.id === activePlanId)!;

  const updatePlan = (patch: Partial<PricingPlan>) => {
    onChange({
      ...config,
      plans: config.plans.map((p) => (p.id === activePlanId ? { ...p, ...patch } : p)),
    });
  };

  const updateFeature = (index: number, patch: Partial<PricingFeature>) => {
    const features = activePlan.features.map((f, i) => (i === index ? { ...f, ...patch } : f));
    updatePlan({ features });
  };

  const addFeature = () => {
    updatePlan({ features: [...activePlan.features, { text: "New feature" }] });
  };

  const removeFeature = (index: number) => {
    updatePlan({ features: activePlan.features.filter((_, i) => i !== index) });
  };

  const enabledPlans = useMemo(() => config.plans.filter((p) => p.enabled), [config.plans]);

  return (
    <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
      <div className="space-y-3 min-w-0">
        <AccordionSection
          title="Page header"
          description="Hero text shown on the public pricing page"
          icon={LayoutTemplate}
          isOpen={openSections.page}
          onToggle={() => setOpenSections((s) => ({ ...s, page: !s.page }))}
        >
          <div>
            <label className={labelClass}>Eyebrow</label>
            <input
              className={inputClass}
              value={config.heroEyebrow}
              onChange={(e) => onChange({ ...config, heroEyebrow: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Title</label>
            <input
              className={inputClass}
              value={config.heroTitle}
              onChange={(e) => onChange({ ...config, heroTitle: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>Subtitle</label>
            <textarea
              rows={2}
              className={`${inputClass} resize-y`}
              value={config.heroSubtitle}
              onChange={(e) => onChange({ ...config, heroSubtitle: e.target.value })}
            />
          </div>
        </AccordionSection>

        <AccordionSection
          title="Billing defaults"
          description="Trial length and subscription period used across the app"
          icon={CreditCard}
          isOpen={openSections.billing}
          onToggle={() => setOpenSections((s) => ({ ...s, billing: !s.billing }))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Default trial days</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={config.trialDays}
                onChange={(e) => onChange({ ...config, trialDays: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelClass}>Subscription days</label>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={config.subscriptionDays}
                onChange={(e) => onChange({ ...config, subscriptionDays: Number(e.target.value) })}
              />
            </div>
          </div>
        </AccordionSection>

        <div className="flex flex-wrap gap-2 pt-1">
          {config.plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setActivePlanId(plan.id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                activePlanId === plan.id
                  ? "border border-cyan-500 bg-cyan-500/10 text-cyan-300"
                  : "border border-white/10 bg-[#0F172A] text-slate-400 hover:border-cyan-500/30"
              }`}
            >
              {plan.name}
              {!plan.enabled && <span className="ml-1 text-[10px] text-rose-400">off</span>}
            </button>
          ))}
        </div>

        <AccordionSection
          title="Plan content"
          description={`Name, description and features for ${activePlan.name}`}
          icon={LayoutTemplate}
          isOpen={openSections.plan}
          onToggle={() => setOpenSections((s) => ({ ...s, plan: !s.plan }))}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Plan name</label>
              <input className={inputClass} value={activePlan.name} onChange={(e) => updatePlan({ name: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Tagline</label>
              <input className={inputClass} value={activePlan.tagline} onChange={(e) => updatePlan({ tagline: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              rows={3}
              className={`${inputClass} resize-y`}
              value={activePlan.description}
              onChange={(e) => updatePlan({ description: e.target.value })}
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={labelClass}>Features</label>
              <button type="button" onClick={addFeature} className="text-xs font-bold text-cyan-400 hover:text-cyan-300">
                + Add feature
              </button>
            </div>
            <div className="space-y-2">
              {activePlan.features.map((feature, index) => (
                <div key={index} className="flex gap-2 rounded-xl border border-white/10 bg-[#0F172A] p-2.5">
                  <input
                    className={`${inputClass} flex-1`}
                    value={feature.text}
                    onChange={(e) => updateFeature(index, { text: e.target.value })}
                  />
                  <label className="flex shrink-0 items-center gap-1.5 px-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={Boolean(feature.highlight)}
                      onChange={(e) => updateFeature(index, { highlight: e.target.checked })}
                    />
                    Highlight
                  </label>
                  <button
                    type="button"
                    onClick={() => removeFeature(index)}
                    className="rounded-lg border border-white/10 p-2 text-slate-500 hover:border-rose-500/30 hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </AccordionSection>

        <AccordionSection
          title="Pricing & display"
          description="Prices, seats, badges and visibility"
          icon={CreditCard}
          isOpen={openSections.pricing}
          onToggle={() => setOpenSections((s) => ({ ...s, pricing: !s.pricing }))}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Monthly price (PKR)</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={activePlan.priceMonthlyPkr}
                onChange={(e) => updatePlan({ priceMonthlyPkr: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelClass}>Annual price (PKR)</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={activePlan.priceAnnualPkr}
                onChange={(e) => updatePlan({ priceAnnualPkr: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelClass}>Original price (PKR)</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={activePlan.originalPricePkr ?? ""}
                onChange={(e) =>
                  updatePlan({ originalPricePkr: e.target.value ? Number(e.target.value) : undefined })
                }
                placeholder="Optional strikethrough"
              />
            </div>
            <div>
              <label className={labelClass}>Seats</label>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={activePlan.seats}
                onChange={(e) => updatePlan({ seats: Number(e.target.value) })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Period label</label>
              <input
                className={inputClass}
                value={activePlan.periodLabel}
                onChange={(e) => updatePlan({ periodLabel: e.target.value })}
                placeholder="per month · 30 days"
              />
            </div>
            <div>
              <label className={labelClass}>Save badge</label>
              <input
                className={inputClass}
                value={activePlan.saveBadge || ""}
                onChange={(e) => updatePlan({ saveBadge: e.target.value || undefined })}
                placeholder="SAVE 33%"
              />
            </div>
            <div>
              <label className={labelClass}>Button label</label>
              <input
                className={inputClass}
                value={activePlan.btnLabel}
                onChange={(e) => updatePlan({ btnLabel: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={activePlan.featured}
                onChange={(e) => updatePlan({ featured: e.target.checked })}
              />
              Mark as most popular
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={activePlan.enabled}
                onChange={(e) => updatePlan({ enabled: e.target.checked })}
              />
              Show on pricing page
            </label>
          </div>
        </AccordionSection>
      </div>

      <div className="min-w-0 xl:sticky xl:top-4 space-y-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Selected plan preview
          </p>
          <PricingPlanPreview plan={activePlan} />
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            All visible plans ({enabledPlans.length})
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {enabledPlans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setActivePlanId(plan.id)}
                className={`text-left rounded-xl border p-3 transition-colors ${
                  activePlanId === plan.id
                    ? "border-cyan-500/40 bg-cyan-500/5"
                    : "border-white/10 bg-[#0F172A] hover:border-cyan-500/20"
                }`}
              >
                <p className="text-xs font-bold text-white">{plan.name}</p>
                <p className="text-[10px] text-cyan-400 mt-0.5">{formatPkr(plan.priceMonthlyPkr)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
