"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Globe,
  Menu,
  MessageCircle,
  Palette,
  Shield,
  Sparkles,
  Store,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { UserMenuButton } from "@/components/user-menu-button";
import { useClientSession } from "@/hooks/use-client-session";
import { formatPkr, mergePricingConfig, type PricingConfig } from "@/lib/pricing-config";
import {
  getPublicSupportEmail,
  getPublicWhatsAppUrl,
  getResellerContactWhatsAppMessage,
} from "@/lib/public-contact";
import { getResellerUrl } from "@/lib/site-urls";

const dashboardBtnClass =
  "px-5 py-2.5 text-sm font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.35)] hover:scale-105 hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] transition-all duration-300";

const STEPS = [
  {
    title: "Contact us",
    desc: "Tell us how many Solo or Team seats you need. We agree wholesale pricing with you.",
  },
  {
    title: "Get your panel",
    desc: "We create your reseller account with email, password, and paid seats on your balance.",
  },
  {
    title: "Register clients",
    desc: "Log in to your panel, pick Solo or Team for each client, and register them in seconds.",
  },
  {
    title: "Clients use FlowDoverz",
    desc: "Each client signs in on flow.doverz.com with the email and password you set. Access runs for 30 days per seat.",
  },
];

const FAQ = [
  {
    q: "What is the difference between Solo and Team seats?",
    a: "Solo gives one private login for an individual creator. Team gives three logins for a small group. You choose the plan when registering each client.",
  },
  {
    q: "Do I need my own website?",
    a: "No — you can sell under FlowDoverz branding through WhatsApp, social media, or your own channels. If you prefer your own brand, we also support white-label resellers with your website, your pricing, and a branded Chrome extension.",
  },
  {
    q: "Can I use my own branding and pricing?",
    a: "Yes. White-label partners sell under their own name, on their own website, at retail prices they choose. We provide wholesale seats, an API, and a branded extension. Official resellers sell under the FlowDoverz name — both options are available.",
  },
  {
    q: "How do I pay for more seats?",
    a: "When your seat balance runs low, contact us on WhatsApp or email. After payment we add seats to your panel instantly.",
  },
  {
    q: "Can I set my own retail price?",
    a: "Yes. You buy wholesale seats from us and charge your clients whatever retail price works for your market.",
  },
];

export default function ResellersPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [pricing, setPricing] = useState<PricingConfig>(() => mergePricingConfig(null));
  const session = useClientSession();
  const supportEmail = getPublicSupportEmail();
  const whatsappUrl =
    getPublicWhatsAppUrl(getResellerContactWhatsAppMessage()) ||
    `mailto:${supportEmail}?subject=${encodeURIComponent("Reseller inquiry")}`;
  const panelUrl = getResellerUrl();

  useEffect(() => {
    document.title = "Reseller Program | FlowDoverz";
  }, []);

  useEffect(() => {
    fetch("/api/pricing", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) setPricing(data.config);
      })
      .catch(() => {});
  }, []);

  const soloRetail = pricing.plans.find((plan) => plan.id === "solo")?.priceMonthlyPkr || 999;
  const teamRetail = pricing.plans.find((plan) => plan.id === "team")?.priceMonthlyPkr || 1999;

  const navItems = [
    { label: "Features", href: "/#features" },
    { label: "Platform", href: "/#platform" },
    { label: "Workflow", href: "/#workflow" },
    { label: "FAQ", href: "/#faq" },
    { label: "Pricing", href: "/pricing" },
    { label: "Resellers", href: "/resellers", active: true },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#030308] font-sans text-slate-100 selection:bg-cyan-500/30">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-cyan-600/10 blur-[160px]" />
        <div className="absolute left-[-15%] top-[30%] h-[500px] w-[500px] rounded-full bg-violet-600/8 blur-[140px]" />
        <div className="absolute right-[-15%] top-[30%] h-[500px] w-[500px] rounded-full bg-emerald-600/8 blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_50%,transparent_100%)]" />
      </div>

      <header className="fixed left-0 right-0 top-0 z-50 h-20 border-b border-white/[0.06] bg-[#030308]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 md:px-12">
          <Link href="/" className="transition-opacity hover:opacity-90">
            <BrandLogo size="lg" />
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`text-sm font-semibold transition-colors ${
                  item.active ? "text-cyan-400" : "text-slate-400 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            {session ? (
              <>
                <Link href="/dashboard" className={dashboardBtnClass}>
                  Dashboard
                </Link>
                <UserMenuButton session={session} />
              </>
            ) : (
              <>
                <Link href={panelUrl} className="px-4 py-2 text-sm font-bold text-slate-400 transition-colors hover:text-white">
                  Reseller login
                </Link>
                <Link href="/login" className="px-4 py-2 text-sm font-bold text-slate-400 transition-colors hover:text-white">
                  Login
                </Link>
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className={dashboardBtnClass}>
                  Contact us
                </a>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 md:hidden">
            {session ? <UserMenuButton session={session} /> : null}
            <button type="button" className="text-white" onClick={() => setMobileMenuOpen((open) => !open)}>
              {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 flex flex-col gap-5 bg-black/95 px-6 pb-8 pt-24 backdrop-blur-2xl md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`border-b border-white/10 pb-4 text-2xl font-bold ${item.active ? "text-cyan-400" : "text-white"}`}
            >
              {item.label}
            </Link>
          ))}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-4 text-center text-base font-bold text-slate-950"
          >
            Contact on WhatsApp
          </a>
          <Link
            href={panelUrl}
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-2xl border border-white/10 py-4 text-center text-base font-bold text-white"
          >
            Reseller panel login
          </Link>
        </div>
      ) : null}

      <main className="relative z-10 w-full max-w-full min-w-0 px-4 pb-12 pt-24 sm:px-6 sm:pt-28">
        <section className="mx-auto max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-slate-300 backdrop-blur-md">
            <Sparkles size={13} className="text-cyan-400" />
            Wholesale for sellers & agencies
          </div>
          <h1 className="mb-4 text-3xl font-black leading-[1.0] tracking-tighter text-white sm:text-4xl md:text-6xl">
            Sell FlowDoverz{" "}
            <span className="bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              to your clients
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-400 sm:text-lg">
            Buy paid seats at wholesale rates and sell on your terms — with your own branding, website, and pricing, or under the FlowDoverz brand. Both options are available.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-4 text-base font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(34,211,238,0.6)] sm:w-auto"
            >
              <MessageCircle size={18} />
              Get wholesale pricing
            </a>
            <Link
              href={panelUrl}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-4 text-base font-bold text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white sm:w-auto"
            >
              Already a reseller? Login
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Your brand or ours</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-400">
              Choose how you want to sell. Many partners start with FlowDoverz branding and move to white-label as they grow.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                icon: Palette,
                title: "Your branding",
                badge: "White-label",
                desc: "Sell under your own name with your website, your retail pricing, and a branded Chrome extension for your clients.",
                points: ["Your brand name & colors", "Your website & checkout flow", "Set your own retail prices", "Branded extension for clients"],
                accentFrom: "from-cyan-400",
                accentTo: "to-emerald-400",
                border: "border-cyan-500/25",
                bg: "from-[#0a1a20] to-[#030308]",
                iconColor: "text-cyan-400",
              },
              {
                icon: Globe,
                title: "FlowDoverz branding",
                badge: "Official reseller",
                desc: "Sell under the FlowDoverz name without building your own site. Use our brand, our pricing as a reference, and your reseller panel.",
                points: ["FlowDoverz name & trust", "No website required", "Sell via WhatsApp or social", "Reseller panel included"],
                accentFrom: "from-violet-400",
                accentTo: "to-purple-600",
                border: "border-violet-500/20",
                bg: "from-[#0a0a1a] to-[#030308]",
                iconColor: "text-violet-400",
              },
            ].map((option) => {
              const Icon = option.icon;
              return (
                <div
                  key={option.title}
                  className={`relative flex flex-col overflow-hidden rounded-3xl border ${option.border} bg-gradient-to-b ${option.bg} p-6 sm:p-8`}
                >
                  <div className={`absolute inset-x-6 top-0 h-px bg-gradient-to-r ${option.accentFrom} ${option.accentTo} opacity-80`} />
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04]">
                      <Icon className={`h-5 w-5 ${option.iconColor}`} />
                    </div>
                    <span className={`rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r ${option.accentFrom} ${option.accentTo}`}>
                      {option.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white">{option.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{option.desc}</p>
                  <ul className="mt-5 space-y-2.5">
                    {option.points.map((point) => (
                      <li key={point} className="flex items-center gap-2.5 text-sm text-slate-300">
                        <Check size={14} className={`shrink-0 ${option.iconColor}`} />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-5xl">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Wallet, title: "Wholesale seats", desc: "Buy Solo or Team seats in bulk at reseller pricing.", color: "text-cyan-400", border: "border-cyan-500/15", glow: "from-cyan-500/5" },
              { icon: Users, title: "Your clients", desc: "Register clients until your paid seat balance runs out.", color: "text-emerald-400", border: "border-emerald-500/15", glow: "from-emerald-500/5" },
              { icon: Shield, title: "Private panel", desc: "Only you see your clients, seats left, and pricing.", color: "text-cyan-300", border: "border-cyan-500/15", glow: "from-cyan-500/5" },
              { icon: Zap, title: "Fast setup", desc: "We activate your panel after payment — usually same day.", color: "text-violet-400", border: "border-violet-500/15", glow: "from-violet-500/5" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className={`flex flex-col items-center rounded-3xl border ${item.border} bg-gradient-to-b ${item.glow} to-transparent p-6 text-center transition-all hover:border-opacity-40`}
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04]">
                    <Icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <h2 className="text-lg font-bold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-6xl">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">Plans you can sell</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-400">
              Retail prices below are what end-users pay direct. Resellers get lower wholesale seat pricing — contact us for your rate.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                id: "solo",
                name: "Solo seat",
                retail: soloRetail,
                desc: "One private login for a single creator. Best for individuals you sell to directly.",
                features: ["1 client login", "30-day access per registration", "Full Google Flow access", "Chrome extension included"],
                accentFrom: "from-cyan-400",
                accentTo: "to-emerald-400",
                border: "border-cyan-500/40",
                bg: "from-[#0a1a20] to-[#030308]",
                checkBg: "bg-cyan-500 border-cyan-400",
              },
              {
                id: "team",
                name: "Team seat",
                retail: teamRetail,
                desc: "Three private logins for a small team. Best for agencies and groups.",
                features: ["3 client logins", "30-day access per registration", "Everything in Solo", "Priority support tier"],
                accentFrom: "from-violet-400",
                accentTo: "to-purple-600",
                border: "border-violet-500/20",
                bg: "from-[#0a0a1a] to-[#030308]",
                checkBg: "bg-violet-600 border-violet-500",
              },
            ].map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col overflow-hidden rounded-3xl border ${plan.border} bg-gradient-to-b ${plan.bg} p-6 sm:p-8`}
              >
                <div className={`absolute inset-x-6 top-0 h-px bg-gradient-to-r ${plan.accentFrom} ${plan.accentTo} opacity-80`} />
                <p className={`text-xs font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r ${plan.accentFrom} ${plan.accentTo}`}>
                  Reseller plan
                </p>
                <h3 className="mt-2 text-2xl font-black text-white">{plan.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{plan.desc}</p>
                <div className="mt-5 border-y border-white/[0.06] py-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Direct retail reference</p>
                  <p className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">{formatPkr(plan.retail)}</p>
                  <p className="mt-1 text-sm font-semibold text-cyan-400">Wholesale price on request</p>
                </div>
                <ul className="mt-5 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${plan.checkBg}`}>
                        <Check size={10} strokeWidth={3} className="text-white" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">How it works</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:border-white/12 hover:bg-white/[0.03]">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-black text-cyan-400">
                  {index + 1}
                </div>
                <h3 className="text-lg font-bold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-4xl">
          <div className="relative overflow-hidden rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a1f25] via-[#07070f] to-[#0a0a1a]" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-full -translate-x-1/2 bg-cyan-500/10 blur-[80px]" />
            <div className="absolute inset-0 rounded-3xl border border-white/8" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
            <div className="relative z-10 px-8 py-16 text-center sm:px-12 sm:py-20">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300">
                <Store size={14} className="text-cyan-400" />
                Partner with FlowDoverz
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">Ready to start selling?</h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-400">
                Tell us whether you want your own branding or FlowDoverz branding, how many Solo and Team seats you need, and your target retail pricing. We will send wholesale rates, payment details, and setup steps.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-4 text-base font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all hover:scale-105 sm:w-auto"
                >
                  <MessageCircle size={18} />
                  WhatsApp us
                </a>
                <a
                  href={`mailto:${supportEmail}?subject=${encodeURIComponent("Reseller program inquiry")}`}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-4 text-base font-bold text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white sm:w-auto"
                >
                  Email {supportEmail}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-2xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Common questions</h2>
            <p className="mt-3 text-slate-400">Everything you need to know before becoming a reseller.</p>
          </div>
          <div className="space-y-3">
            {FAQ.map((item, index) => (
              <div
                key={item.q}
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className={`cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 ${
                  openFaq === index
                    ? "border-cyan-500/25 bg-gradient-to-r from-cyan-500/6 to-transparent shadow-[0_0_30px_rgba(34,211,238,0.06)]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between gap-4 p-5 md:p-6">
                  <p className={`text-sm font-semibold md:text-base transition-colors ${openFaq === index ? "text-white" : "text-slate-300"}`}>
                    {item.q}
                  </p>
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                      openFaq === index ? "rotate-45 bg-cyan-500 text-black" : "bg-white/[0.05] text-slate-400"
                    }`}
                  >
                    <ArrowRight size={14} className="rotate-[-45deg]" />
                  </div>
                </div>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === index ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
                  <p className="px-5 pb-6 text-sm leading-relaxed text-slate-400 md:px-6">{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl text-center">
          <p className="text-sm text-slate-500">
            Looking for personal use instead?{" "}
            <Link href="/pricing" className="font-semibold text-cyan-400 hover:text-cyan-300">
              See consumer pricing
            </Link>
          </p>
        </section>
      </main>

      <footer className="relative z-10 overflow-hidden border-t border-white/[0.06] bg-[#020205] px-6 pb-12 pt-16">
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 bg-cyan-500/8 blur-[120px]" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-12">
            <div className="md:col-span-5">
              <Link href="/" className="mb-5 block w-fit transition-opacity hover:opacity-90">
                <BrandLogo size="md" stacked showTagline />
              </Link>
              <p className="max-w-xs text-sm leading-relaxed text-slate-500">
                Your secure bridge to Google Flow — AI video generation without the waitlist.
              </p>
            </div>
            <div className="md:col-span-3 md:col-start-8">
              <h4 className="mb-5 text-sm font-black uppercase tracking-widest text-white">Product</h4>
              <div className="flex flex-col gap-3">
                {[["/#features", "Features"], ["/#workflow", "How It Works"], ["/pricing", "Pricing"], ["/resellers", "Resellers"], ["/#faq", "FAQ"]].map(
                  ([href, label]) => (
                    <Link key={label} href={href} className="text-sm text-slate-500 transition-colors hover:text-white">
                      {label}
                    </Link>
                  ),
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <h4 className="mb-5 text-sm font-black uppercase tracking-widest text-white">Support</h4>
              <div className="flex flex-col gap-3">
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="text-sm text-slate-500 transition-colors hover:text-white">
                  WhatsApp
                </a>
                <a href={`mailto:${supportEmail}`} className="text-sm text-slate-500 transition-colors hover:text-white">
                  Email Us
                </a>
                <Link href={panelUrl} className="text-sm text-slate-500 transition-colors hover:text-white">
                  Reseller panel
                </Link>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 md:flex-row">
            <p className="text-sm text-slate-600">© {new Date().getFullYear()} FlowDoverz. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-sm text-slate-600 transition-colors hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-slate-600 transition-colors hover:text-white">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
