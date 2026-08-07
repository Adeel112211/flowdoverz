"use client";

import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

/** Must match server `ADMIN_RESET_CODE_LENGTH` in admin-password-reset.ts */
const CODE_LENGTH = 4;

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
  const [codeDigits, setCodeDigits] = useState<string[]>(() =>
    Array.from({ length: CODE_LENGTH }, () => ""),
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);

  const resetCode = codeDigits.join("");

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
        setCodeDigits(Array.from({ length: CODE_LENGTH }, () => ""));
        setMode("reset-confirm");
        requestAnimationFrame(() => codeRefs.current[0]?.focus());
      } else {
        setError(data.error || "Could not send reset code.");
      }
    } catch {
      setError("Could not send reset code.");
    } finally {
      setSendingCode(false);
    }
  };

  const setDigitAt = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setCodeDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < CODE_LENGTH - 1) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      codeRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      e.preventDefault();
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] || "");
    setCodeDigits(next);
    const focusAt = Math.min(pasted.length, CODE_LENGTH - 1);
    codeRefs.current[focusAt]?.focus();
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
        setCodeDigits(Array.from({ length: CODE_LENGTH }, () => ""));
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
    <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl group sm:p-8 md:p-10">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      <div className="mb-5 flex justify-center sm:mb-8">
        <BrandLogo className="h-9 text-cyan-400 sm:h-10" stacked />
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
              We&apos;ll email a {CODE_LENGTH}-digit code to your recovery address
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
              Check {maskedEmail || "your recovery email"} for the {CODE_LENGTH}-digit code.
            </p>
          </div>

          <form onSubmit={confirmReset} className="space-y-4">
            <div className="flex justify-center gap-2.5 sm:gap-3" onPaste={handleCodePaste}>
              {codeDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    codeRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  value={digit}
                  onChange={(e) => setDigitAt(index, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(index, e)}
                  aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
                  className="h-14 w-12 sm:h-16 sm:w-14 rounded-2xl border border-white/10 bg-black/40 text-center text-2xl font-black text-white outline-none transition-all focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                />
              ))}
            </div>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              placeholder="New password"
              minLength={4}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="Confirm new password"
              minLength={4}
            />

            {error && <p className="text-sm text-rose-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={resetting || resetCode.length !== CODE_LENGTH || newPassword.length < 4}
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
