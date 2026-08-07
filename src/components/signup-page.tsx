"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { AuthPageBackground } from "@/components/auth-page-background";
import { appPath, marketingPath } from "@/lib/site-urls";
import { signUp } from "@/lib/auth";
import { validateSignupEmailClient, SIGNUP_EMAIL_REJECTED } from "@/lib/signup-email-rules";
import { Eye, EyeOff, ChevronDown, AlertCircle } from "lucide-react";

export function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("trial");
  const [planDropdownOpen, setPlanDropdownOpen] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  function checkEmail(value: string) {
    if (!value.trim()) {
      setEmailInvalid(false);
      return true;
    }
    const ok = validateSignupEmailClient(value).ok;
    setEmailInvalid(!ok);
    return ok;
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    setCodeSent(false);
    setVerificationCode("");
    checkEmail(value);
  }

  async function sendCode() {
    setError("");
    if (!checkEmail(email)) {
      setError(SIGNUP_EMAIL_REJECTED);
      return;
    }

    setSendingCode(true);
    try {
      const res = await fetch("/api/auth/send-signup-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not send code.");
        if (data.waitSeconds) setResendSeconds(Number(data.waitSeconds));
        return;
      }
      setCodeSent(true);
      setResendSeconds(60);
    } catch {
      setError("Could not send verification code.");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "");
    const formEmail = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const plan = selectedPlan;

    if (!checkEmail(formEmail)) {
      setError(SIGNUP_EMAIL_REJECTED);
      return;
    }
    if (!codeSent) {
      setError("Send a verification code to your email first.");
      return;
    }
    if (verificationCode.replace(/\D/g, "").length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);

    const result = await signUp(formEmail, password, name, verificationCode);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (plan === "trial") {
      if (result.trialGranted === false) {
        router.push("/pricing?reason=no_trial");
      } else {
        router.push("/dashboard");
      }
    } else {
      router.push("/pricing");
    }
  }

  const canCreate =
    !loading &&
    !emailInvalid &&
    codeSent &&
    verificationCode.replace(/\D/g, "").length === 6;

  return (
    <div className="relative flex min-h-dvh w-full max-w-full items-start justify-center overflow-x-hidden overflow-y-auto px-4 py-10 pb-14 sm:py-12 md:items-center">
      <AuthPageBackground />
      {error && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#080810]/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-gradient-to-b from-[#131320] to-[#0c0c16] border border-white/10 rounded-[2rem] p-8 max-w-sm w-full shadow-[0_0_80px_rgba(225,29,72,0.15)] relative flex flex-col items-center text-center animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-rose-500/20 blur-[50px] rounded-full pointer-events-none" />
            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-6 relative z-10 shadow-[0_0_20px_rgba(225,29,72,0.2)]">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-white mb-3 relative z-10 tracking-tight">Oops!</h3>
            <p className="text-base text-slate-300 mb-8 relative z-10">{error}</p>
            <button
              onClick={() => setError("")}
              type="button"
              className="w-full rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 py-4 text-sm font-black tracking-wide text-rose-400 transition-all hover:scale-[1.02] active:scale-[0.98] relative z-10"
            >
              TRY AGAIN
            </button>
          </div>
        </div>
      )}
      <div className="animate-fade-up relative z-10 mx-auto w-full max-w-lg py-2 sm:py-4">
        <div className="mb-4 flex flex-col items-center overflow-visible pt-2 text-center sm:mb-5 sm:pt-3">
          <Link href={marketingPath("/")} className="inline-flex overflow-visible">
            <BrandLogo size="xl" stacked showTagline={false} />
          </Link>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400 sm:mt-4 md:text-4xl">
            Create workspace
          </h1>
          <p className="mt-1 text-sm text-slate-400 mx-auto sm:mt-2 sm:text-base">
            Start your free trial today — no credit card required.
          </p>
        </div>

        <div className="relative rounded-[2rem] border border-white/10 bg-[#06080d]/80 p-5 shadow-[0_0_60px_rgba(34,211,238,0.15)] backdrop-blur-3xl sm:p-8 md:p-10">
          <form onSubmit={handleSubmit} className="relative z-10 space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-300">
                Full name
              </label>
              <input
                id="name"
                name="name"
                required
                autoComplete="name"
                placeholder="Alex Rivera"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white outline-none transition-all duration-300 placeholder:text-slate-500 focus:border-cyan-400 focus:bg-white/10 focus:shadow-[0_0_20px_rgba(34,211,238,0.25)] focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
                Work email
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={(e) => checkEmail(e.target.value)}
                  placeholder="you@company.com"
                  aria-invalid={emailInvalid}
                  className={`min-w-0 flex-1 rounded-2xl border bg-white/5 px-5 py-3.5 text-sm text-white outline-none transition-all duration-300 placeholder:text-slate-500 focus:bg-white/10 focus:ring-2 ${
                    emailInvalid
                      ? "border-rose-500/60 focus:border-rose-400 focus:ring-rose-500/20"
                      : "border-white/10 focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(34,211,238,0.25)] focus:ring-cyan-500/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={sendingCode || emailInvalid || !email.trim() || resendSeconds > 0}
                  className="shrink-0 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3.5 text-sm font-bold text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50 sm:min-w-[7.5rem]"
                >
                  {sendingCode ? "Sending..." : resendSeconds > 0 ? `${resendSeconds}s` : codeSent ? "Resend" : "Send code"}
                </button>
              </div>
              {emailInvalid && (
                <p className="mt-2 text-xs font-medium text-rose-400">
                  Temp / disposable emails are blocked. Use Gmail, Outlook, Yahoo, or another real inbox.
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                One free trial per network IP. Extra accounts from the same IP must choose a paid plan.
              </p>
            </div>

            {codeSent && (
              <div>
                <label htmlFor="verificationCode" className="mb-1.5 block text-sm font-medium text-slate-300">
                  Verification code
                </label>
                <input
                  id="verificationCode"
                  name="verificationCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-center text-lg font-bold tracking-[0.45em] text-white outline-none transition-all duration-300 placeholder:text-slate-600 focus:border-cyan-400 focus:bg-white/10 focus:shadow-[0_0_20px_rgba(34,211,238,0.25)] focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 pr-12 text-sm text-white outline-none transition-all duration-300 placeholder:text-slate-500 focus:border-cyan-400 focus:bg-white/10 focus:shadow-[0_0_20px_rgba(34,211,238,0.25)] focus:ring-2 focus:ring-cyan-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Choose a plan
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPlanDropdownOpen(!planDropdownOpen)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white outline-none transition-all duration-300 hover:bg-white/10 focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(34,211,238,0.25)] focus:ring-2 focus:ring-cyan-500/20"
                >
                  <span>
                    {selectedPlan === "trial" ? "Free Trial (10 min)" : "Paid Plan (Solo / Team)"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${planDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {planDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setPlanDropdownOpen(false)} />
                    <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0c0c16]/95 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlan("trial");
                          setPlanDropdownOpen(false);
                        }}
                        className="w-full px-5 py-3.5 text-left text-sm text-slate-200 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        Free Trial (10 min)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlan("paid");
                          setPlanDropdownOpen(false);
                        }}
                        className="w-full px-5 py-3.5 text-left text-sm text-slate-200 transition-colors hover:bg-white/5 hover:text-white border-t border-white/5"
                      >
                        Paid Plan (Solo / Team)
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={!canCreate}
              className="relative z-10 mt-2 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-4 text-sm font-black tracking-wide text-slate-950 transition-all duration-300 hover:scale-[1.02] shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:shadow-[0_0_35px_rgba(34,211,238,0.6)] disabled:opacity-60 disabled:hover:scale-100 sm:mt-4"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </form>

          <p className="relative z-10 mt-5 text-center text-sm text-slate-400 sm:mt-6">
            Already have an account?{" "}
            <Link href={appPath("/login")} className="font-semibold text-cyan-300 hover:text-cyan-200">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
