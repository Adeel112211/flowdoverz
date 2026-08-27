"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Zap, Shield, Users, Sparkles, ArrowRight, Menu, X, Star } from "lucide-react";
import { formatPkr, formatTrialDurationLabel, mergePricingConfig, type PricingConfig, type PricingPlan } from "@/lib/pricing-config";
import { useClientSession } from "@/hooks/use-client-session";
import { UserMenuButton } from "@/components/user-menu-button";
import { BrandLogo } from "@/components/brand-logo";
import { applyMaintenanceFromPayload } from "@/lib/maintenance-client";

function planVisuals(planId: PricingPlan["id"]) {
  if (planId === "solo") {
    return {
      accentFrom: "from-cyan-400",
      accentTo: "to-emerald-400",
      borderColor: "border-cyan-500/40",
      checkBg: "bg-cyan-500 border-cyan-400",
      checkColor: "text-white",
      btnClass: "",
      glowGradient: "from-cyan-400 to-emerald-400",
    };
  }
  if (planId === "team") {
    return {
      accentFrom: "from-violet-400",
      accentTo: "to-purple-600",
      borderColor: "border-violet-500/20",
      checkBg: "bg-violet-600 border-violet-500",
      checkColor: "text-white",
      btnClass: "bg-violet-600 text-white hover:bg-violet-500",
      glowGradient: "from-violet-400 to-purple-600",
    };
  }
  return {
    accentFrom: "from-slate-400",
    accentTo: "to-slate-600",
    borderColor: "border-white/8",
    checkBg: "bg-slate-600 border-slate-500",
    checkColor: "text-white",
    btnClass: "bg-slate-600 text-white hover:bg-slate-500",
    glowGradient: "from-slate-400 to-slate-600",
  };
}

function pricingFaqs(trialLabel: string) {
  return [
    {
      q: "What happens after the free trial?",
      a: `After your ${trialLabel} trial, cookies are removed and the extension pauses. Upgrade to Solo or Team to instantly re-activate — no setup required.`,
    },
    { q: "Is there an annual discount?", a: "Yes! Switch to annual billing and save over 20% compared to monthly pricing. The discount is applied automatically at checkout." },
    { q: "Can I switch plans later?", a: "Absolutely. Upgrade or downgrade at any time. Upgrades apply immediately; downgrades take effect at the next billing cycle." },
    { q: "Is the extension safe to install?", a: "Yes. Our extension is strictly scoped to labs.google.com only. It never accesses, modifies, or tracks any other site or personal data." },
  ];
}


export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricing, setPricing] = useState<PricingConfig>(() => mergePricingConfig(null));
  const [activationBlock, setActivationBlock] = useState<{ code: string; error: string } | null>(null);
  const [noTrialNotice, setNoTrialNotice] = useState(false);
  const session = useClientSession();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNoTrialNotice(params.get("reason") === "no_trial");
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/api/pricing", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d.success) setPricing(d.config);
      })
      .catch((err) => {
        if (!active) return;
        console.error(err);
      });

    if (session) {
      fetch("/api/user/status?billing=1")
        .then((r) => r.json())
        .then((d) => {
          if (!active) return;
          if (applyMaintenanceFromPayload(d)) return;
          if (d.success && d.activationBlock) {
            setActivationBlock(d.activationBlock);
          }
        })
        .catch((err) => {
          if (!active) return;
          console.error(err);
        });
    }

    return () => {
      active = false;
    };
  }, [session]);

  const plans = pricing.plans.filter((p) => p.enabled);

  return (
    <div className="min-h-screen bg-[#030308] text-slate-100 font-sans selection:bg-cyan-500/30 overflow-x-hidden">
      {/* Layered Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-cyan-600/10 blur-[160px]" />
        <div className="absolute top-[30%] left-[-15%] w-[500px] h-[500px] rounded-full bg-violet-600/8 blur-[140px]" />
        <div className="absolute top-[30%] right-[-15%] w-[500px] h-[500px] rounded-full bg-emerald-600/8 blur-[140px]" />
        {/* Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_50%,transparent_100%)]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-20 bg-[#030308]/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto w-full h-full flex items-center justify-between px-4 sm:px-6 md:px-12">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <BrandLogo size="lg" />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {["Features", "Platform", "Workflow"].map((item) => (
              <Link key={item} href={`/#${item.toLowerCase()}`} className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">{item}</Link>
            ))}
            <Link href="/#faq" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">FAQ</Link>
            <Link href="/pricing" className="text-sm font-semibold text-cyan-400">Pricing</Link>
            <Link href="/resellers" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">Resellers</Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {session ? (
              <>
                <Link
                  href="/dashboard"
                  className="px-5 py-2.5 text-sm font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.35)] hover:scale-105 hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] transition-all duration-300"
                >
                  Dashboard
                </Link>
                <UserMenuButton session={session} />
              </>
            ) : (
              <>
                <Link href="/login" className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">Login</Link>
                <Link href="/signup" className="px-5 py-2.5 text-sm font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.35)] hover:scale-105 hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] transition-all duration-300">
                  Get Started
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 md:hidden">
            {session ? <UserMenuButton session={session} /> : null}
            <button type="button" className="text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/95 backdrop-blur-2xl flex flex-col pt-24 px-6 gap-5 md:hidden">
          {["Features", "Platform", "Workflow", "FAQ", "Pricing", "Resellers"].map((item) => (
            <Link
              key={item}
              href={
                item === "Pricing"
                  ? "/pricing"
                  : item === "Resellers"
                    ? "/resellers"
                    : `/#${item.toLowerCase()}`
              }
              onClick={() => setMobileMenuOpen(false)}
              className={`text-2xl font-bold border-b border-white/10 pb-4 ${item === "Pricing" ? "text-cyan-400" : item === "Resellers" ? "text-fuchsia-300" : "text-white"}`}
            >
              {item}
            </Link>
          ))}
          <div className="mt-6 flex flex-col gap-4">
            {session ? (
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="text-center py-4 font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-2xl">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-center py-4 font-bold text-slate-300 border border-white/10 rounded-2xl">Login</Link>
                <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="text-center py-4 font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-2xl">Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}

      <main className="relative z-10 pt-20 sm:pt-24 pb-12 px-4 sm:px-6 w-full max-w-full min-w-0">

        {noTrialNotice && (
          <div className="max-w-3xl mx-auto mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            A free trial was already used on this network. Choose Solo or Team below to activate your account.
          </div>
        )}

        {/* ─── HERO ─── */}
        <div className="text-center max-w-4xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-slate-300 text-xs font-semibold mb-5 backdrop-blur-md">
            <Sparkles size={13} className="text-cyan-400" />
            {pricing.heroEyebrow}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-black leading-[1.0] tracking-tighter mb-3 text-white">
            {pricing.heroTitle.includes("plan") ? (
              <>
                Pick your{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-400">
                  plan.
                </span>
              </>
            ) : (
              pricing.heroTitle
            )}
          </h1>
          <p className="text-base text-slate-400 max-w-xl mx-auto">
            {pricing.heroSubtitle}
          </p>
        </div>

        {activationBlock ? (
          <div className="mx-auto mb-8 max-w-3xl rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-center">
            <p className="text-sm text-rose-100">{activationBlock.error}</p>
            <Link
              href="/dashboard"
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : null}

        {/* ─── PRICING CARDS ─── */}
        <div className="max-w-6xl mx-auto mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {plans.map((plan) => {
              const visuals = planVisuals(plan.id);
              const monthlyPrice = formatPkr(plan.priceMonthlyPkr);
              return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl sm:rounded-3xl border p-5 sm:p-8 transition-all duration-500 group min-w-0 ${
                  plan.featured
                    ? "bg-gradient-to-b from-[#0a1a20] to-[#030308] border-cyan-500/40 shadow-[0_0_80px_rgba(34,211,238,0.12),0_0_0_1px_rgba(34,211,238,0.1)]"
                    : `bg-[#07070f] ${visuals.borderColor} hover:border-white/15`
                }`}
              >
                {/* Top gradient line */}
                <div className={`absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r ${visuals.accentFrom} ${visuals.accentTo} opacity-${plan.featured ? "80" : "0 group-hover:opacity-40"} transition-opacity rounded-full`} />

                {/* Most Popular badge */}
                {plan.featured && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 text-xs font-black shadow-[0_0_30px_rgba(34,211,238,0.5)] whitespace-nowrap">
                    <Star size={12} className="fill-slate-950" />
                    MOST POPULAR
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-5">
                  <div className={`inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase mb-2 text-transparent bg-clip-text bg-gradient-to-r ${visuals.accentFrom} ${visuals.accentTo}`}>
                    {plan.tagline}
                  </div>
                  <h2 className="text-2xl font-black text-white">{plan.name}</h2>
                  <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-5 pb-5 border-b border-white/[0.06]">
                  {plan.originalPricePkr && plan.originalPricePkr > plan.priceMonthlyPkr && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-slate-500 text-sm line-through">{formatPkr(plan.originalPricePkr)}</span>
                      {plan.saveBadge && (
                        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white tracking-wide">{plan.saveBadge}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <span className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
                      {monthlyPrice}
                    </span>
                    {monthlyPrice !== "Free" && (
                      <div className="mb-2">
                        <span className="text-slate-400 text-sm block">/month</span>
                      </div>
                    )}
                  </div>
                  {monthlyPrice === "Free" && <p className="text-slate-500 text-sm mt-1">{plan.periodLabel}</p>}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-7 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature.text} className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${visuals.checkBg}`}>
                        <Check size={10} strokeWidth={3} className={visuals.checkColor} />
                      </div>
                      <span className={`text-sm leading-relaxed ${feature.highlight ? "text-white font-semibold" : "text-slate-400"}`}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {plan.id === "trial" ? (
                  <div className="relative group/btn">
                    <div className={`absolute -inset-[1px] rounded-xl bg-gradient-to-r ${visuals.glowGradient} opacity-60 blur-sm group-hover/btn:opacity-90 group-hover/btn:blur-md transition-all duration-300`} />
                    <div className="relative">
                      <Link href="/signup" className={`block w-full text-center rounded-xl px-6 py-3 text-sm font-bold transition-all ${visuals.btnClass}`}>
                        {plan.btnLabel}
                      </Link>
                    </div>
                  </div>
                ) : activationBlock ? (
                  <div className="relative">
                    <span className="block w-full cursor-not-allowed rounded-xl px-6 py-3 text-center text-sm font-bold opacity-50 bg-white/10 text-slate-400">
                      {activationBlock.code === "PENDING_PAYMENT" ? "Payment pending" : "Plan active"}
                    </span>
                  </div>
                ) : plan.featured ? (
                  <div className="relative group/btn">
                    <div className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-r ${visuals.glowGradient} opacity-80 blur-sm group-hover/btn:opacity-100 group-hover/btn:blur-md transition-all duration-300`} />
                    <div className="relative">
                      <Link
                        href={`/checkout/${plan.id}`}
                        className="block w-full text-center rounded-lg px-4 py-3 text-sm font-semibold transition-transform hover:-translate-y-px bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950"
                      >
                        {plan.btnLabel}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="relative group/btn">
                    <div className={`absolute -inset-[1px] rounded-xl bg-gradient-to-r ${visuals.glowGradient} opacity-60 blur-sm group-hover/btn:opacity-90 group-hover/btn:blur-md transition-all duration-300`} />
                    <div className="relative">
                      <Link href={`/checkout/${plan.id}`} className={`block w-full text-center rounded-xl px-6 py-3 text-sm font-bold transition-all ${visuals.btnClass}`}>
                        {plan.btnLabel}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
            })}
          </div>


        </div>

        <div className="mx-auto mb-10 max-w-4xl">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-fuchsia-300">Selling to clients?</p>
              <p className="mt-1 text-sm text-slate-300">Wholesale Solo & Team seats with your own reseller panel.</p>
            </div>
            <Link
              href="/resellers"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-400 to-violet-400 px-4 py-2.5 text-sm font-bold text-slate-950"
            >
              Reseller program
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* ─── FEATURE COMPARISON BANNER ─── */}
        <div className="max-w-5xl mx-auto mt-16 mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                icon: <Shield size={22} className="text-emerald-400" />,
                glow: "from-emerald-500/5",
                border: "border-emerald-500/15",
                title: "Private & Secure",
                desc: "Extension strictly scoped to labs.google.com. Zero data collection from other sites.",
              },
              {
                icon: <Zap size={22} className="text-cyan-400" />,
                glow: "from-cyan-500/5",
                border: "border-cyan-500/15",
                title: "Instant Activation",
                desc: "Purchase a plan and your extension re-activates within seconds. No setup calls, no waiting.",
              },
              {
                icon: <Users size={22} className="text-violet-400" />,
                glow: "from-violet-500/5",
                border: "border-violet-500/15",
                title: "2,000+ Creators",
                desc: "Trusted by filmmakers, directors, content creators, and studios worldwide.",
              },
            ].map((item) => (
              <div key={item.title} className={`flex flex-col items-center text-center p-8 rounded-3xl bg-gradient-to-b ${item.glow} to-transparent border ${item.border} hover:border-opacity-40 transition-all group`}>
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/8 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <h3 className="font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── FAQ ─── */}
        <div className="max-w-2xl mx-auto mt-20 mb-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">Common questions</h2>
            <p className="text-slate-400">Everything you need to know before subscribing.</p>
          </div>
          <div className="space-y-3">
            {pricingFaqs(formatTrialDurationLabel(pricing)).map((faq, i) => (
              <div
                key={i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className={`rounded-2xl border cursor-pointer overflow-hidden transition-all duration-300 ${
                  openFaq === i
                    ? "border-cyan-500/25 bg-gradient-to-r from-cyan-500/6 to-transparent shadow-[0_0_30px_rgba(34,211,238,0.06)]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.03]"
                }`}
              >
                <div className="p-5 md:p-6 flex items-center justify-between gap-4">
                  <p className={`font-semibold text-sm md:text-base transition-colors ${openFaq === i ? "text-white" : "text-slate-300"}`}>
                    {faq.q}
                  </p>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${openFaq === i ? "bg-cyan-500 text-black rotate-45" : "bg-white/[0.05] text-slate-400"}`}>
                    <ArrowRight size={14} className="rotate-[-45deg]" />
                  </div>
                </div>
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${openFaq === i ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
                  <p className="px-5 md:px-6 pb-6 text-sm text-slate-400 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── BOTTOM CTA ─── */}
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a1f25] via-[#07070f] to-[#0a0a1a]" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] bg-cyan-500/10 blur-[80px] pointer-events-none" />
            <div className="absolute inset-0 border border-white/8 rounded-3xl" />
            {/* Grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />

            <div className="relative z-10 py-20 px-8 md:px-16 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-slate-300 text-sm font-semibold mb-8">
                <Sparkles size={14} className="text-cyan-400" /> Start for free, no card required
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-white mb-5 tracking-tight leading-tight">
                Ready to create?
              </h2>
              <p className="text-slate-400 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
                Try FlowDoverz free for 24 hours. No credit card, no commitment — just pure AI video generation.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/signup" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-black rounded-2xl hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:shadow-[0_0_40px_rgba(34,211,238,0.6)] text-base">
                  Start Free Trial <ArrowRight size={18} />
                </Link>
                <Link href="/login" className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-white/[0.04] border border-white/10 text-slate-300 font-bold rounded-2xl hover:bg-white/8 hover:text-white transition-all text-base">
                  I already have an account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-[#020205] pt-16 pb-12 px-6 border-t border-white/[0.06] overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/8 blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
            <div className="md:col-span-5">
              <Link href="/" className="mb-5 w-fit block hover:opacity-90 transition-opacity">
                <BrandLogo size="md" stacked showTagline />
              </Link>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                Your secure bridge to Google Flow — AI video generation without the waitlist.
              </p>
            </div>
            <div className="md:col-span-3 md:col-start-8">
              <h4 className="text-white font-black text-sm tracking-widest uppercase mb-5">Product</h4>
              <div className="flex flex-col gap-3">
                {[["/#features","Features"],["/#workflow","How It Works"],["/pricing","Pricing"],["/resellers","Resellers"],["/#faq","FAQ"]].map(([href,label]) => (
                  <Link key={label} href={href} className="text-slate-500 hover:text-white text-sm transition-colors">{label}</Link>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <h4 className="text-white font-black text-sm tracking-widest uppercase mb-5">Support</h4>
              <div className="flex flex-col gap-3">
                <a href="https://wa.me/0000000000" className="text-slate-500 hover:text-white text-sm transition-colors">WhatsApp</a>
                <a href="mailto:support@flowdoverz.app" className="text-slate-500 hover:text-white text-sm transition-colors">Email Us</a>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-600 text-sm">© {new Date().getFullYear()} FlowDoverz. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-slate-600 text-sm hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="text-slate-600 text-sm hover:text-white transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
