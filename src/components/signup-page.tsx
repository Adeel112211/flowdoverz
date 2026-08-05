"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { signUp } from "@/lib/auth";
import { Eye, EyeOff, ChevronDown, AlertCircle, X } from "lucide-react";

export function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("trial");
  const [planDropdownOpen, setPlanDropdownOpen] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const plan = selectedPlan;

    const result = await signUp(email, password, name);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (plan === "trial") {
      router.push("/dashboard");
    } else {
      router.push("/pricing");
    }
  }

  return (
    <div className="relative flex h-dvh w-full max-w-full overflow-hidden items-center justify-center px-4 py-10 sm:py-12">
      {/* Error Modal */}
      {error && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#080810]/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-gradient-to-b from-[#131320] to-[#0c0c16] border border-white/10 rounded-[2rem] p-8 max-w-sm w-full shadow-[0_0_80px_rgba(225,29,72,0.15)] relative flex flex-col items-center text-center animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
            {/* Ambient Red Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-rose-500/20 blur-[50px] rounded-full pointer-events-none" />
            
            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-6 relative z-10 shadow-[0_0_20px_rgba(225,29,72,0.2)]">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-white mb-3 relative z-10 tracking-tight">Oops!</h3>
            <p className="text-base text-slate-300 mb-8 relative z-10">{error}</p>
            <button
              onClick={() => setError("")}
              type="button"
              className="w-full rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 py-4 text-sm font-black tracking-wide text-rose-400 transition-all hover:scale-[1.02] active:scale-[0.98] relative z-10 shadow-[0_0_20px_rgba(225,29,72,0.1)] hover:shadow-[0_0_30px_rgba(225,29,72,0.2)]"
            >
              TRY AGAIN
            </button>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/4 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <div className="animate-fade-up relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/">
            <BrandLogo size="lg" stacked />
          </Link>
          <h1 className="mt-8 text-3xl md:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400">Create workspace</h1>
          <p className="mt-3 text-base text-slate-400 max-w-sm mx-auto">
            Start your free trial today — no credit card required.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#06080d]/80 p-6 sm:p-8 md:p-10 shadow-[0_0_60px_rgba(34,211,238,0.15)] backdrop-blur-3xl group">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />


          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-300">
                Full name
              </label>
              <input
                id="name"
                name="name"
                required
                placeholder="Alex Rivera"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white outline-none transition-all duration-300 placeholder:text-slate-500 focus:border-cyan-400 focus:bg-white/10 focus:shadow-[0_0_20px_rgba(34,211,238,0.25)] focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white outline-none transition-all duration-300 placeholder:text-slate-500 focus:border-cyan-400 focus:bg-white/10 focus:shadow-[0_0_20px_rgba(34,211,238,0.25)] focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

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
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
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
                  <span>{selectedPlan === "trial" ? "Free Trial (1 Day)" : "Paid Plan (Solo / Team)"}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${planDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {planDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setPlanDropdownOpen(false)} />
                    <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0c0c16]/95 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                      <button
                        type="button"
                        onClick={() => { setSelectedPlan("trial"); setPlanDropdownOpen(false); }}
                        className="w-full px-5 py-3.5 text-left text-sm text-slate-200 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        Free Trial (1 Day)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSelectedPlan("paid"); setPlanDropdownOpen(false); }}
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
              disabled={loading}
              className="relative z-10 mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-4 text-sm font-black tracking-wide text-slate-950 transition-all duration-300 hover:scale-[1.02] shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:shadow-[0_0_35px_rgba(34,211,238,0.6)] disabled:opacity-60 disabled:hover:scale-100"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
