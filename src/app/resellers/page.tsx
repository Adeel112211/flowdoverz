"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Menu,
  MessageCircle,
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
    a: "No. Official resellers use our panel at resellerflow.doverz.com to register and manage clients. You can sell through WhatsApp, social media, or your own brand.",
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
  const [openFaq, setOpenFaq] = useState<number | null>(0);
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
    { label: "Pricing", href: "/pricing" },
    { label: "Resellers", href: "/resellers", active: true },
    { label: "FAQ", href: "/#faq" },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#030308] font-sans text-slate-100 selection:bg-cyan-500/30">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/2 top-0 h-[620px] w-[900px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[160px]" />
        <div className="absolute bottom-[10%] right-[-10%] h-[420px] w-[420px] rounded-full bg-cyan-600/10 blur-[140px]" />
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
                  item.active ? "text-fuchsia-300" : "text-slate-400 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            {session ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.35)] transition-all hover:scale-105"
                >
                  Dashboard
                </Link>
                <UserMenuButton session={session} />
              </>
            ) : (
              <>
                <Link href={panelUrl} className="text-sm font-bold text-slate-400 transition-colors hover:text-white">
                  Reseller login
                </Link>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_15px_rgba(217,70,239,0.35)] transition-all hover:scale-105"
                >
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
              className={`border-b border-white/10 pb-4 text-2xl font-bold ${item.active ? "text-fuchsia-300" : "text-white"}`}
            >
              {item.label}
            </Link>
          ))}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 rounded-2xl bg-gradient-to-r from-fuchsia-400 to-violet-400 py-4 text-center text-base font-bold text-slate-950"
          >
            Contact on WhatsApp
          </a>
          <Link href={panelUrl} onClick={() => setMobileMenuOpen(false)} className="rounded-2xl border border-white/10 py-4 text-center text-base font-bold text-white">
            Reseller panel login
          </Link>
        </div>
      ) : null}

      <main className="relative z-10 w-full max-w-full min-w-0 px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <section className="mx-auto max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-slate-300 backdrop-blur-md">
            <Store size={13} className="text-fuchsia-400" />
            Wholesale for sellers & agencies
          </div>
          <h1 className="mb-4 text-4xl font-black tracking-tighter text-white sm:text-5xl md:text-6xl">
            Sell FlowDoverz{" "}
            <span className="bg-gradient-to-br from-fuchsia-400 via-violet-300 to-cyan-400 bg-clip-text text-transparent">
              to your clients
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Buy paid seats at wholesale rates, register clients on Solo or Team plans, and manage everything from your own reseller panel.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-400 to-violet-400 px-8 py-4 text-base font-black text-slate-950 shadow-[0_0_30px_rgba(217,70,239,0.35)] transition-all hover:scale-105 sm:w-auto"
            >
              <MessageCircle size={18} />
              Get wholesale pricing
            </a>
            <Link
              href={panelUrl}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-4 text-base font-bold text-white transition-all hover:bg-white/[0.08] sm:w-auto"
            >
              Already a reseller? Login
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <section className="mx-auto mt-16 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Wallet, title: "Wholesale seats", desc: "Buy Solo or Team seats in bulk at reseller pricing." },
            { icon: Users, title: "Your clients", desc: "Register unlimited clients until your paid seat balance runs out." },
            { icon: Shield, title: "Private panel", desc: "Only you see your clients, seats left, and pricing." },
            { icon: Zap, title: "Fast setup", desc: "We activate your panel after payment — usually same day." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-3xl border border-white/10 bg-[#07070f]/80 p-6 backdrop-blur-xl">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <Icon className="h-5 w-5 text-fuchsia-300" />
                </div>
                <h2 className="text-lg font-black text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.desc}</p>
              </div>
            );
          })}
        </section>

        <section className="mx-auto mt-20 max-w-6xl">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Plans you can sell</h2>
            <p className="mt-3 text-slate-400">Retail prices below are what end-users pay direct. Resellers get lower wholesale seat pricing — contact us for your rate.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                id: "solo",
                name: "Solo seat",
                retail: soloRetail,
                desc: "One private login for a single creator. Best for individuals you sell to directly.",
                features: ["1 client login", "30-day access per registration", "Full Google Flow access", "Chrome extension included"],
                accent: "from-cyan-400 to-emerald-400",
              },
              {
                id: "team",
                name: "Team seat",
                retail: teamRetail,
                desc: "Three private logins for a small team. Best for agencies and groups.",
                features: ["3 client logins", "30-day access per registration", "Everything in Solo", "Priority support tier"],
                accent: "from-violet-400 to-fuchsia-400",
              },
            ].map((plan) => (
              <div key={plan.id} className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#0a1020] to-[#030308] p-6 sm:p-8">
                <div className={`absolute inset-x-8 top-0 h-px bg-gradient-to-r ${plan.accent} opacity-70`} />
                <p className={`text-xs font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r ${plan.accent}`}>
                  Reseller plan
                </p>
                <h3 className="mt-2 text-2xl font-black text-white">{plan.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{plan.desc}</p>
                <div className="mt-5 border-y border-white/[0.06] py-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Direct retail reference</p>
                  <p className="mt-1 text-3xl font-black text-white">{formatPkr(plan.retail)}</p>
                  <p className="mt-1 text-sm text-fuchsia-300">Wholesale price on request</p>
                </div>
                <ul className="mt-5 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10">
                        <Check size={10} className="text-fuchsia-200" />
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
            <h2 className="text-3xl font-black text-white sm:text-4xl">How it works</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-500/15 text-sm font-black text-fuchsia-300">
                  {index + 1}
                </div>
                <h3 className="text-lg font-bold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-3xl">
          <div className="relative overflow-hidden rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-[#1a0f24] via-[#07070f] to-[#081018] p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.12),transparent_55%)]" />
            <div className="relative z-10 text-center">
              <Sparkles className="mx-auto mb-4 h-6 w-6 text-fuchsia-300" />
              <h2 className="text-3xl font-black text-white sm:text-4xl">Ready to start selling?</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
                Message us on WhatsApp or email with how many Solo and Team seats you want. We will send pricing, payment details, and your panel login.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-400 to-violet-400 px-6 py-3.5 text-sm font-black text-slate-950 sm:w-auto"
                >
                  <MessageCircle size={16} />
                  WhatsApp us
                </a>
                <a
                  href={`mailto:${supportEmail}?subject=${encodeURIComponent("Reseller program inquiry")}`}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-bold text-white sm:w-auto"
                >
                  Email {supportEmail}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-2xl">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-black text-white">Reseller FAQ</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((item, index) => (
              <div
                key={item.q}
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className={`cursor-pointer overflow-hidden rounded-2xl border transition-all ${
                  openFaq === index
                    ? "border-fuchsia-500/25 bg-fuchsia-500/[0.06]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/12"
                }`}
              >
                <div className="flex items-center justify-between gap-4 p-5">
                  <p className="text-sm font-semibold text-white sm:text-base">{item.q}</p>
                  <ArrowRight size={14} className={`shrink-0 text-fuchsia-300 transition-transform ${openFaq === index ? "rotate-90" : ""}`} />
                </div>
                {openFaq === index ? (
                  <div className="border-t border-white/[0.06] px-5 pb-5 pt-4">
                    <p className="text-sm leading-relaxed text-slate-400">{item.a}</p>
                  </div>
                ) : null}
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

      <footer className="relative z-10 border-t border-white/[0.06] bg-[#020205] px-6 pb-12 pt-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-slate-600">© {new Date().getFullYear()} FlowDoverz. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-5 text-sm">
            <Link href="/pricing" className="text-slate-500 transition-colors hover:text-white">
              Consumer pricing
            </Link>
            <Link href={panelUrl} className="text-slate-500 transition-colors hover:text-white">
              Reseller panel
            </Link>
            <Link href="/privacy" className="text-slate-500 transition-colors hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="text-slate-500 transition-colors hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
