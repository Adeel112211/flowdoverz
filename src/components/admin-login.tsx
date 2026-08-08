"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_PIN_LENGTH,
  ADMIN_RESET_CODE_LENGTH,
  type AdminAuthMode,
} from "@/lib/admin-auth-mode";

type Mode = "login" | "reset-request" | "reset-confirm";

function emptyDigits(length = ADMIN_PIN_LENGTH) {
  return Array.from({ length }, () => "");
}

export function AdminLogin() {
  const [authMode, setAuthMode] = useState<AdminAuthMode | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pinDigits, setPinDigits] = useState(() => emptyDigits());
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [maskedEmail, setMaskedEmail] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [resetAuthMode, setResetAuthMode] = useState<AdminAuthMode>("password");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPinDigits, setNewPinDigits] = useState(() => emptyDigits());
  const [confirmPinDigits, setConfirmPinDigits] = useState(() => emptyDigits());
  const [resetting, setResetting] = useState(false);

  const pinRefs = useRef<Array<HTMLInputElement | null>>([]);
  const newPinRefs = useRef<Array<HTMLInputElement | null>>([]);
  const confirmPinRefs = useRef<Array<HTMLInputElement | null>>([]);
  const loginAttemptRef = useRef<string | null>(null);

  const pin = pinDigits.join("");
  const newPin = newPinDigits.join("");
  const confirmPin = confirmPinDigits.join("");

  useEffect(() => {
    fetch("/api/admin/password-reset")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.maskedEmail) setMaskedEmail(data.maskedEmail);
        if (data.success && (data.authMode === "pin" || data.authMode === "password")) {
          setAuthMode(data.authMode);
          setResetAuthMode(data.authMode);
        } else {
          setAuthMode("password");
        }
      })
      .catch(() => setAuthMode("password"));
  }, []);

  useEffect(() => {
    if (mode === "login" && authMode === "pin") {
      requestAnimationFrame(() => pinRefs.current[0]?.focus());
    }
  }, [mode, authMode]);

  const unlock = async (secret: string) => {
    if (!secret || unlocking) return;
    if (loginAttemptRef.current === secret) return;
    loginAttemptRef.current = secret;

    setUnlocking(true);
    setError(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: secret }),
      });
      let data: { success?: boolean; admin?: boolean; sync_key?: string; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        setError("Server error. Check Vercel env vars and redeploy.");
        clearLoginInputs();
        return;
      }
      if (data.success && data.admin) {
        if (data.sync_key) {
          sessionStorage.setItem("flowdoverz_admin_sync_key", data.sync_key);
        }
        window.location.reload();
        return;
      }
      setError(data.error || (authMode === "pin" ? "Wrong PIN." : "Wrong password."));
      clearLoginInputs();
    } catch {
      setError("An error occurred. Try again.");
      clearLoginInputs();
    } finally {
      setUnlocking(false);
    }
  };

  const clearLoginInputs = () => {
    loginAttemptRef.current = null;
    setPassword("");
    setPinDigits(emptyDigits());
    if (authMode === "pin") {
      requestAnimationFrame(() => pinRefs.current[0]?.focus());
    }
  };

  // Auto-login when 4-digit PIN is complete
  useEffect(() => {
    if (mode !== "login" || authMode !== "pin") return;
    if (pin.length !== ADMIN_PIN_LENGTH || unlocking) return;
    void unlock(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, mode, authMode]);

  const handlePasswordLogin = (e: FormEvent) => {
    e.preventDefault();
    void unlock(password);
  };

  const handlePinLoginClick = () => {
    if (pin.length === ADMIN_PIN_LENGTH) void unlock(pin);
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
        if (data.authMode === "pin" || data.authMode === "password") {
          setResetAuthMode(data.authMode);
        }
        setResetCode("");
        setNewPassword("");
        setConfirmPassword("");
        setNewPinDigits(emptyDigits());
        setConfirmPinDigits(emptyDigits());
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

  const applyDigit = (
    index: number,
    raw: string,
    setter: Dispatch<SetStateAction<string[]>>,
    refs: MutableRefObject<Array<HTMLInputElement | null>>,
  ) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setter((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < ADMIN_PIN_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (
    index: number,
    e: KeyboardEvent<HTMLInputElement>,
    digits: string[],
    refs: MutableRefObject<Array<HTMLInputElement | null>>,
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < ADMIN_PIN_LENGTH - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  const handleDigitPaste = (
    e: ClipboardEvent<HTMLElement>,
    setter: Dispatch<SetStateAction<string[]>>,
    refs: MutableRefObject<Array<HTMLInputElement | null>>,
  ) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, ADMIN_PIN_LENGTH);
    if (!pasted) return;
    setter(Array.from({ length: ADMIN_PIN_LENGTH }, (_, i) => pasted[i] || ""));
    refs.current[Math.min(pasted.length, ADMIN_PIN_LENGTH - 1)]?.focus();
  };

  const confirmReset = async (e: FormEvent) => {
    e.preventDefault();
    const nextSecret = resetAuthMode === "pin" ? newPin : newPassword;
    const nextConfirm = resetAuthMode === "pin" ? confirmPin : confirmPassword;

    if (nextSecret !== nextConfirm) {
      setError(resetAuthMode === "pin" ? "PINs do not match." : "Passwords do not match.");
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
          newPassword: nextSecret,
          confirmPassword: nextConfirm,
          authMode: resetAuthMode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message || "Updated. Log in now.");
        if (data.authMode === "pin" || data.authMode === "password") {
          setAuthMode(data.authMode);
        }
        setMode("login");
        clearLoginInputs();
        setResetCode("");
        setNewPassword("");
        setConfirmPassword("");
        setNewPinDigits(emptyDigits());
        setConfirmPinDigits(emptyDigits());
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

  const digitInputClass =
    "h-14 w-12 sm:h-16 sm:w-14 rounded-2xl border border-white/10 bg-black/40 text-center text-2xl font-black text-white outline-none transition-all focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(34,211,238,0.25)] disabled:opacity-60";

  const renderDigitRow = (
    digits: string[],
    setter: Dispatch<SetStateAction<string[]>>,
    refs: MutableRefObject<Array<HTMLInputElement | null>>,
    opts?: { disabled?: boolean; autoFocusFirst?: boolean; label?: string },
  ) => (
    <div
      className="flex justify-center gap-2.5 sm:gap-3"
      onPaste={(e) => handleDigitPaste(e, setter, refs)}
      role="group"
      aria-label={opts?.label || "PIN"}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={opts?.disabled}
          autoFocus={opts?.autoFocusFirst && index === 0}
          onChange={(e) => applyDigit(index, e.target.value, setter, refs)}
          onKeyDown={(e) => handleDigitKeyDown(index, e, digits, refs)}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${index + 1} of ${ADMIN_PIN_LENGTH}`}
          className={digitInputClass}
        />
      ))}
    </div>
  );

  const unlockButtonClass =
    "relative z-10 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-4 text-sm font-black tracking-wide text-slate-950 transition-all duration-300 hover:scale-[1.02] shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:shadow-[0_0_35px_rgba(34,211,238,0.6)] disabled:opacity-60 disabled:hover:scale-100";

  const unlockButtonLabel = unlocking ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      Unlocking...
    </>
  ) : (
    "Unlock Admin"
  );

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
            <p className="mt-3 text-sm text-slate-400">
              {authMode === "pin"
                ? "Enter your 4-digit PIN to unlock"
                : "Enter the admin password to continue"}
            </p>
          </div>

          {!authMode ? (
            <p className="text-center text-sm text-slate-500">Loading...</p>
          ) : authMode === "pin" ? (
            <div className="space-y-5">
              {renderDigitRow(pinDigits, setPinDigits, pinRefs, {
                disabled: unlocking,
                autoFocusFirst: true,
                label: "Admin PIN",
              })}
              {error && <p className="text-sm text-rose-400 text-center">{error}</p>}
              {message && <p className="text-sm text-emerald-400 text-center">{message}</p>}
              <button
                type="button"
                disabled={unlocking || pin.length !== ADMIN_PIN_LENGTH}
                onClick={handlePinLoginClick}
                className={unlockButtonClass}
                aria-busy={unlocking}
              >
                {unlockButtonLabel}
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Admin password"
                  autoFocus
                  autoComplete="current-password"
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
                className={unlockButtonClass}
                aria-busy={unlocking}
              >
                {unlockButtonLabel}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => {
              setError(null);
              setMessage(null);
              setMode("reset-request");
            }}
            className="mt-4 w-full text-center text-sm font-bold text-cyan-400 hover:text-cyan-300"
          >
            {authMode === "pin" ? "Forgot PIN?" : "Forgot password?"}
          </button>
        </>
      )}

      {mode === "reset-request" && (
        <>
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-black text-white">
              {authMode === "pin" ? "Reset PIN" : "Reset password"}
            </h1>
            <p className="mt-3 text-sm text-slate-400">
              We&apos;ll email an {ADMIN_RESET_CODE_LENGTH}-digit code to your recovery address
              {maskedEmail ? ` (${maskedEmail})` : ""}.
            </p>
          </div>

          {error && <p className="mb-4 text-sm text-rose-400 text-center">{error}</p>}

          <button
            type="button"
            disabled={sendingCode}
            onClick={sendResetCode}
            className={unlockButtonClass}
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
            <h1 className="text-2xl font-black text-white">Set new login</h1>
            <p className="mt-3 text-sm text-slate-400">
              Enter the email code, choose login type, then set your new PIN or password.
            </p>
          </div>

          <form onSubmit={confirmReset} className="space-y-5">
            <div>
              <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                Email code
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={ADMIN_RESET_CODE_LENGTH}
                value={resetCode}
                onChange={(e) =>
                  setResetCode(e.target.value.replace(/\D/g, "").slice(0, ADMIN_RESET_CODE_LENGTH))
                }
                className={`${inputClass} text-center text-xl tracking-[0.35em] font-bold`}
                placeholder={"0".repeat(ADMIN_RESET_CODE_LENGTH)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setResetAuthMode("pin")}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-bold transition-colors ${
                  resetAuthMode === "pin"
                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                    : "border-white/10 text-slate-400"
                }`}
              >
                4-digit PIN
              </button>
              <button
                type="button"
                onClick={() => setResetAuthMode("password")}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-bold transition-colors ${
                  resetAuthMode === "password"
                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                    : "border-white/10 text-slate-400"
                }`}
              >
                Password
              </button>
            </div>

            {resetAuthMode === "pin" ? (
              <>
                <div>
                  <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                    New PIN
                  </p>
                  {renderDigitRow(newPinDigits, setNewPinDigits, newPinRefs, { label: "New PIN" })}
                </div>
                <div>
                  <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                    Confirm PIN
                  </p>
                  {renderDigitRow(confirmPinDigits, setConfirmPinDigits, confirmPinRefs, {
                    label: "Confirm PIN",
                  })}
                </div>
              </>
            ) : (
              <>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  placeholder={`New password (min ${ADMIN_PASSWORD_MIN_LENGTH})`}
                  minLength={ADMIN_PASSWORD_MIN_LENGTH}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Confirm new password"
                  minLength={ADMIN_PASSWORD_MIN_LENGTH}
                />
              </>
            )}

            {error && <p className="text-sm text-rose-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={
                resetting ||
                resetCode.length !== ADMIN_RESET_CODE_LENGTH ||
                (resetAuthMode === "pin"
                  ? newPin.length !== ADMIN_PIN_LENGTH || confirmPin.length !== ADMIN_PIN_LENGTH
                  : newPassword.length < ADMIN_PASSWORD_MIN_LENGTH)
              }
              className={unlockButtonClass}
            >
              {resetting ? "Saving..." : "Save & continue"}
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
