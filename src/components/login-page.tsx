"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthBridge } from "@/components/auth-bridge";
import { AuthPageBackground } from "@/components/auth-page-background";
import { BrandLogo } from "@/components/brand-logo";
import { appPath, marketingPath } from "@/lib/site-urls";
import { useClientSession } from "@/hooks/use-client-session";
import { signIn } from "@/lib/auth";
import { Eye, EyeOff, AlertCircle, X } from "lucide-react";

export function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const session = useClientSession();

  useEffect(() => {
    const notice = window.sessionStorage.getItem("flowdoverz_session_notice");
    if (!notice) return;
    window.sessionStorage.removeItem("flowdoverz_session_notice");
    setError(notice);
  }, []);

  useEffect(() => {
    if (session && !error) router.replace("/dashboard");
  }, [session, error, router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const result = await signIn(email, password);
    if (!result.ok) {
      if (result.code === "MAINTENANCE") {
        setLoading(false);
        return;
      }
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="relative flex min-h-dvh w-full max-w-full items-start justify-center overflow-x-hidden overflow-y-auto px-4 py-10 sm:py-12 max-md:pt-8 max-md:pb-10 md:items-center">
      <AuthPageBackground />
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
      <AuthBridge session={session} />

      <div className="animate-fade-up relative w-full max-w-xl">
        <div className="mb-4 flex flex-col items-center overflow-visible pt-2 text-center max-md:mb-3 sm:pt-3">
          <Link href={marketingPath("/")} className="inline-flex overflow-visible">
            <BrandLogo size="xl" stacked showTagline={false} />
          </Link>
          <h1 className="mt-3 max-md:mt-2 text-3xl md:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400">
            Welcome back
          </h1>
          <p className="mt-1 text-base text-slate-400 mx-auto sm:mt-1.5">
            Enter your FlowDoverz workspace credentials to continue generating.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#06080d]/80 p-6 sm:p-8 md:p-10 shadow-[0_0_60px_rgba(34,211,238,0.15)] backdrop-blur-3xl group max-md:shadow-[0_10px_40px_rgba(34,211,238,0.2)]">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />


          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Email
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
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Enter password"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 pr-12 text-sm text-white outline-none transition-all duration-300 placeholder:text-slate-500 focus:border-cyan-400 focus:bg-white/10 focus:shadow-[0_0_20px_rgba(34,211,238,0.25)] focus:ring-2 focus:ring-cyan-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-xs text-slate-500 hover:text-slate-300"
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

            <button
              type="submit"
              disabled={loading}
              className="relative z-10 mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-4 text-sm font-black tracking-wide text-slate-950 transition-all duration-300 hover:scale-[1.02] shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:shadow-[0_0_35px_rgba(34,211,238,0.6)] disabled:opacity-60 disabled:hover:scale-100 max-md:hover:scale-100 max-md:shadow-[0_8px_24px_rgba(34,211,238,0.35)]"
            >
              {loading ? "Authenticating..." : "Login"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            No account yet?{" "}
            <Link href={appPath("/signup")} className="font-semibold text-cyan-300 hover:text-cyan-200">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
