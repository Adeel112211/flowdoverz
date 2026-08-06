"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

type Mode = "login" | "reset-request" | "reset-confirm";

export function AdminLogin() {
  const [mode, setMode] = useState<Mode>("login");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [maskedEmail, setMaskedEmail] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (mode === "reset-request" && !maskedEmail) {
      fetch("/api/admin/password-reset")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setMaskedEmail(data.maskedEmail);
        })
        .catch(() => {});
    }
  }, [mode, maskedEmail]);

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
      let data: { success?: boolean; admin?: boolean; sync_key?: string; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        setError("Server error. Check Vercel env vars and redeploy.");
        return;
      }
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

  const sendResetCode = async () => {
    setSendingCode(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_code" }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message || "Reset code sent.");
        if (data.maskedEmail) setMaskedEmail(data.maskedEmail);
        setMode("reset-confirm");
      } else {
        setError(data.error || "Could not send reset code.");
      }
    } catch {
      setError("Could not send reset code.");
    } finally {
      setSendingCode(false);
    }
  };

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setResetting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_reset",
          code: resetCode,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message || "Password reset. Log in with your new password.");
        setMode("login");
        setPassword("");
        setResetCode("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(data.error || "Reset failed.");
      }
    } catch {
      setError("Reset failed. Try again.");
    } finally {
      setResetting(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all duration-300 focus:border-cyan-400 focus:bg-black/60 focus:shadow-[0_0_15px_rgba(34,211,238,0.2)] focus:outline-none";

  return (
    <div className="relative overflow-hidden mx-auto w-full max-w-sm rounded-3xl border border-white/5 bg-white/[0.02] p-6 sm:p-8 md:p-10 shadow-2xl backdrop-blur-xl group">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      <div className="mb-8 flex justify-center">
        <BrandLogo className="h-10 text-cyan-400" stacked />
      </div>

      {mode === "login" && (
        <>
          <div className="mb-6 text-center">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400">
              Admin access
            </h1>
            <p className="mt-3 text-sm text-slate-400">Enter the manager password to continue.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Admin password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && <p className="text-sm text-rose-400 text-center">{error}</p>}
            {message && <p className="text-sm text-emerald-400 text-center">{message}</p>}

            <button
              type="submit"
              disabled={!password || unlocking}
              className="relative z-10 mt-2 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-4 text-sm font-black tracking-wide text-slate-950 transition-all duration-300 hover:scale-[1.02] shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:shadow-[0_0_35px_rgba(34,211,238,0.6)] disabled:opacity-60 disabled:hover:scale-100"
            >
              {unlocking ? "Unlocking..." : "Unlock Admin"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setMessage(null);
              setMode("reset-request");
            }}
            className="mt-4 w-full text-center text-sm font-bold text-cyan-400 hover:text-cyan-300"
          >
            Forgot password?
          </button>
        </>
      )}

      {mode === "reset-request" && (
        <>
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-black text-white">Reset password</h1>
            <p className="mt-3 text-sm text-slate-400">
              We&apos;ll email a 6-digit code to your recovery address
              {maskedEmail ? ` (${maskedEmail})` : ""}.
            </p>
          </div>

          {error && <p className="mb-4 text-sm text-rose-400 text-center">{error}</p>}

          <button
            type="button"
            disabled={sendingCode}
            onClick={sendResetCode}
            className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-4 text-sm font-black text-slate-950 disabled:opacity-60"
          >
            {sendingCode ? "Sending..." : "Send reset code"}
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("login");
            }}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" /> Back to login
          </button>
        </>
      )}

      {mode === "reset-confirm" && (
        <>
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-black text-white">Enter reset code</h1>
            <p className="mt-3 text-sm text-slate-400">
              Check {maskedEmail || "your recovery email"} for the 6-digit code.
            </p>
          </div>

          <form onSubmit={confirmReset} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={`${inputClass} text-center text-lg tracking-[0.4em] font-bold`}
              placeholder="000000"
              autoFocus
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              placeholder="New password"
              minLength={8}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="Confirm new password"
              minLength={8}
            />

            {error && <p className="text-sm text-rose-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={resetting || resetCode.length !== 6 || newPassword.length < 8}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-4 text-sm font-black text-slate-950 disabled:opacity-60"
            >
              {resetting ? "Resetting..." : "Reset password"}
            </button>
          </form>

          <button
            type="button"
            disabled={sendingCode}
            onClick={sendResetCode}
            className="mt-3 w-full text-center text-sm font-bold text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
          >
            {sendingCode ? "Sending..." : "Resend code"}
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("reset-request");
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </>
      )}
    </div>
  );
}
