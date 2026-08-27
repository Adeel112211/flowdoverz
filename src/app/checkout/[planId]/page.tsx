"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ShieldCheck, Upload, X, ArrowRight, AlertTriangle, ChevronDown } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { PlanBadge, getPlanStyles } from "@/components/plan-badge";
import { CheckoutPaymentMethods } from "@/components/checkout-payment-method-card";
import { getSession } from "@/lib/auth";
import { applyMaintenanceFromPayload } from "@/lib/maintenance-client";
import { formatPkr } from "@/lib/pricing-config";
import { CHECKOUT_PAYMENT_METHODS } from "@/lib/payment-methods-config";
import { SENDER_PAYMENT_OPTIONS } from "@/lib/sender-payment-options";
import { whatsAppLink } from "@/lib/contact-config";
import { validateSenderAccountNumber, normalizeSenderAccountInput } from "@/lib/sender-account-validation";

type CheckoutPlan = {
  name: string;
  price: string;
};

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.planId as string;
  const [plan, setPlan] = useState<CheckoutPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  const [transactionId, setTransactionId] = useState("");
  const [senderPaymentSource, setSenderPaymentSource] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [accountNumberError, setAccountNumberError] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(CHECKOUT_PAYMENT_METHODS[0]?.id ?? null);
  const [activationBlock, setActivationBlock] = useState<{ code: string; error: string } | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace(`/login?callbackUrl=/checkout/${planId}`);
      return;
    }

    fetch("/api/pricing", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const found = d.config.plans.find((p: { id: string }) => p.id === planId);
          if (found) {
            setPlan({ name: found.name, price: formatPkr(found.priceMonthlyPkr) });
          } else {
            router.push("/pricing");
          }
        } else {
          router.push("/pricing");
        }
      })
      .catch(() => router.push("/pricing"))
      .finally(() => setPlanLoading(false));

    fetch("/api/user/status?billing=1")
      .then((r) => r.json())
      .then((data) => {
        if (applyMaintenanceFromPayload(data)) return;
        if (data.success && data.activationBlock) {
          setActivationBlock(data.activationBlock);
        }
      })
      .catch(console.error)
      .finally(() => setStatusLoading(false));
  }, [planId, router]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { compressPaymentScreenshotFile } = await import("@/lib/compress-image-client");
      setScreenshot(await compressPaymentScreenshotFile(file));
      setError("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not process image.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (activationBlock) {
      setError(activationBlock.error);
      return;
    }

    if (!selectedMethodId) {
      setError("Please select a payment account in Step 1 (JazzCash, EasyPaisa, or NayaPay).");
      return;
    }

    if (!senderPaymentSource) {
      setError("Please select the account or app you sent payment from.");
      return;
    }

    if (!transactionId.trim()) {
      setError("Please enter your sender account number.");
      return;
    }

    const accountCheck = validateSenderAccountNumber(transactionId, senderPaymentSource);
    if (!accountCheck.ok) {
      setAccountNumberError(accountCheck.error);
      setError(accountCheck.error);
      return;
    }

    if (!screenshot) {
      setError("Please upload a screenshot of your payment.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkout/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          transactionId: accountCheck.normalized,
          senderPaymentSource,
          payToMethodId: selectedMethodId,
          screenshot,
        }),
      });
      const data = await res.json();

      if (applyMaintenanceFromPayload(data)) return;
      if (data.success) {
        setSuccess(true);
      } else if (data.code === "NOT_LOGGED_IN") {
        router.push(`/login?callbackUrl=/checkout/${planId}`);
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Failed to submit payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (planLoading || statusLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#030308] text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (!plan) return null;

  const planStyles = getPlanStyles(planId);

  if (success) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#030308] p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a10] p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-400" />
          <h1 className="mb-2 text-2xl font-black text-white">Payment submitted</h1>
          <p className="mb-6 text-sm text-slate-400">We will verify and activate your plan shortly.</p>
          <Link
            href="/dashboard"
            className="block rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3 text-sm font-bold text-slate-950"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-[#030308] text-slate-200 lg:h-dvh lg:overflow-hidden">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-0 h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <header className="relative z-40 shrink-0 border-b border-white/[0.06] bg-[#030308]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-20 sm:px-6">
          <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to Pricing
          </Link>
          <BrandLogo size="lg" />
        </div>
      </header>

      <main className="relative mx-auto flex w-full min-h-0 max-w-6xl flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4 lg:overflow-hidden">
        <div className="mb-3 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-[#0c0c16] via-[#080810] to-[#06060c] p-3 shadow-[0_8px_40px_rgba(0,0,0,0.35)] sm:p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-0.5">
                <ShieldCheck className="h-3 w-3 text-cyan-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-400">Secure checkout</span>
              </div>
              <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Complete Payment</h1>
              <p className="mt-1 hidden text-xs text-slate-400 sm:block">
                Send <span className={`font-bold ${planStyles.textClass}`}>{plan.price}</span> via JazzCash, EasyPaisa, or
                NayaPay
              </p>
            </div>

            <div
              className={`relative shrink-0 overflow-hidden rounded-xl border px-3 py-2 text-right sm:px-4 sm:py-3 ${planStyles.borderClass} ${planStyles.bgClass}`}
            >
              <PlanBadge planId={planId} />
              <p className={`mt-1.5 text-2xl font-black tracking-tight sm:text-3xl ${planStyles.textClass}`}>{plan.price}</p>
            </div>
          </div>
        </div>

        <div className="mb-4 shrink-0 space-y-3">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          {activationBlock ? (
            <div className="flex flex-col gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <p className="text-xs leading-relaxed text-rose-100 sm:text-sm">{activationBlock.error}</p>
              </div>
              <Link
                href="/dashboard"
                className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-center text-xs font-bold text-white hover:bg-white/10"
              >
                Go to Dashboard
              </Link>
            </div>
          ) : null}
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 shadow-[0_0_24px_rgba(245,158,11,0.08)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-xs leading-relaxed text-amber-100 sm:text-sm">
              <span className="font-bold text-amber-300">Important:</span> Please enter all details correctly.
              Otherwise, your plan will{" "}
              <span className="font-bold text-amber-200">not be activated</span> on your account.
            </p>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6 lg:overflow-hidden">
          <section className="flex min-h-0 flex-col lg:overflow-hidden">
            <h2 className="mb-2 shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
              Step 1 · Pay exact amount to any account <span className="text-red-400">*</span>
            </h2>
            {!selectedMethodId && error.includes("Step 1") ? (
              <p className="mb-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                Select JazzCash, EasyPaisa, or NayaPay to continue.
              </p>
            ) : null}
            <div className="min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">
              <CheckoutPaymentMethods
                methods={CHECKOUT_PAYMENT_METHODS}
                amountLabel={plan.price}
                selectedId={selectedMethodId}
                onSelect={(id) => {
                  setSelectedMethodId(id);
                  if (error.includes("Step 1")) setError("");
                }}
                compact
              />
            </div>
          </section>

          <section className="self-start">
            <h2 className="mb-2 shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:text-xs">
              Step 2 · Submit proof
            </h2>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c0c14] to-[#06060c] shadow-xl">
              <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 p-4">
                <fieldset disabled={Boolean(activationBlock)} className="flex flex-col gap-2.5 disabled:opacity-60">
                <div>
                  <label htmlFor="sender-source" className="mb-1 block text-xs font-semibold text-slate-300">
                    Sender account name <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="sender-source"
                      required
                      value={senderPaymentSource}
                      onChange={(e) => {
                        setSenderPaymentSource(e.target.value);
                        setAccountNumberError("");
                        if (error && !error.includes("Step 1")) setError("");
                      }}
                      className="w-full appearance-none rounded-lg border border-white/10 bg-black/40 py-2 pl-3 pr-10 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                    >
                      <option value="" disabled className="bg-[#0a0a10] text-slate-500">
                        Select JazzCash, EasyPaisa, bank, etc.
                      </option>
                      {SENDER_PAYMENT_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id} className="bg-[#0a0a10]">
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label htmlFor="tid" className="mb-1 block text-xs font-semibold text-slate-300">
                    Sender account number <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="tid"
                    type="text"
                    required
                    value={transactionId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTransactionId(val);
                      if (error && !error.includes("Step 1")) setError("");

                      const normalized = normalizeSenderAccountInput(val);
                      if (!normalized) {
                        setAccountNumberError("");
                        return;
                      }

                      // Wait until mobile number could be complete before showing errors
                      if (/^[0-9]+$/.test(normalized) && normalized.length < 11) {
                        setAccountNumberError("");
                        return;
                      }

                      const result = validateSenderAccountNumber(val, senderPaymentSource);
                      setAccountNumberError(result.ok ? "" : result.error);
                    }}
                    onBlur={() => {
                      if (!transactionId.trim()) return;
                      const result = validateSenderAccountNumber(transactionId, senderPaymentSource);
                      setAccountNumberError(result.ok ? "" : result.error);
                    }}
                    placeholder="e.g. 03001234567 / account number"
                    className={`w-full rounded-lg border bg-black/40 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 ${
                      accountNumberError
                        ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/30"
                        : "border-white/10 focus:border-cyan-500 focus:ring-cyan-500/30"
                    }`}
                  />
                  {accountNumberError ? (
                    <p className="mt-1.5 text-xs text-red-400">{accountNumberError}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Payment screenshot <span className="text-red-400">*</span>
                  </label>
                  {screenshot ? (
                    <div className="relative h-24 overflow-hidden rounded-lg border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={screenshot} alt="Screenshot" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setScreenshot(null)}
                        className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white hover:bg-red-500/80"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/10 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/5">
                      <Upload className="mb-1 h-4 w-4 text-slate-500" />
                      <p className="text-xs text-slate-400">Click to upload screenshot</p>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>

                {error ? (
                  <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading || Boolean(activationBlock)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 to-emerald-400 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-transform hover:-translate-y-0.5 disabled:transform-none disabled:opacity-50"
                >
                  {loading ? "Submitting…" : activationBlock ? "Purchase unavailable" : "Submit Payment"}
                  {!loading && !activationBlock ? <ArrowRight className="h-4 w-4" /> : null}
                </button>
                </fieldset>
              </form>
            </div>
          </section>
        </div>

        <div className="mt-4 flex shrink-0 flex-col items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0a0a10]/90 px-4 py-4 sm:flex-row sm:gap-4">
          <p className="max-w-xl text-center text-xs leading-relaxed text-slate-400 sm:text-left sm:text-sm">
            <span className="font-semibold text-slate-300">Buying through WhatsApp?</span> If you chat with us and
            purchase your account on WhatsApp, click the button below to open a conversation with our team.
          </p>
          <a
            href={whatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full shrink-0 items-center justify-center gap-2.5 rounded-lg bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(37,211,102,0.25)] transition-transform hover:-translate-y-0.5 hover:bg-[#20bd5a] sm:w-auto"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Chat on WhatsApp
          </a>
        </div>
      </main>
    </div>
  );
}
