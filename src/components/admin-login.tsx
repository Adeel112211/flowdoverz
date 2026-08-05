"use client";

import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Eye, EyeOff } from "lucide-react";

export function AdminLogin() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setUnlocking(true);
    setError(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success && data.admin) {
        if (data.sync_key) {
          sessionStorage.setItem("flowdoverz_admin_sync_key", data.sync_key);
        }
        window.location.reload();
      } else {
        setError(data.error || "Wrong admin password.");
      }
    } catch {
      setError("An error occurred. Try again.");
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="relative overflow-hidden mx-auto w-full max-w-sm rounded-3xl border border-white/5 bg-white/[0.02] p-6 sm:p-8 md:p-10 shadow-2xl backdrop-blur-xl group">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      <div className="mb-8 flex justify-center">
        <BrandLogo className="h-10 text-cyan-400" stacked />
      </div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400">
          Admin access
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Enter the manager password to continue.
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="sr-only">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all duration-300 focus:border-cyan-400 focus:bg-black/60 focus:shadow-[0_0_15px_rgba(34,211,238,0.2)] focus:outline-none"
              placeholder="Admin password"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-300"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-rose-400 text-center">{error}</p>}

        <button
          type="submit"
          disabled={!password || unlocking}
          className="relative z-10 mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-4 text-sm font-black tracking-wide text-slate-950 transition-all duration-300 hover:scale-[1.02] shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:shadow-[0_0_35px_rgba(34,211,238,0.6)] disabled:opacity-60 disabled:hover:scale-100"
        >
          {unlocking ? "Unlocking..." : "Unlock Admin"}
        </button>
      </form>
    </div>
  );
}
