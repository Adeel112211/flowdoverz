"use client";

import { useEffect, useState, type ReactNode } from "react";
import { KeyRound, Lock, Mail, Send, type LucideIcon } from "lucide-react";
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_PIN_LENGTH,
  ADMIN_RESET_CODE_LENGTH,
  type AdminAuthMode,
} from "@/lib/admin-auth-mode";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-sm text-slate-200 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-colors";

const labelClass = "mb-2 block text-[11px] font-bold uppercase tracking-wide text-slate-500";

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-white/10 bg-[#080810] ${className}`}>
      <div className="flex items-start gap-3 border-b border-white/10 px-6 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-base font-bold text-white">{title}</h2>
          {description && <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="space-y-5 px-6 py-6">{children}</div>
    </section>
  );
}

function StatusBanner({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm font-medium ${
        type === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-rose-500/30 bg-rose-500/10 text-rose-300"
      }`}
    >
      {message}
    </div>
  );
}

function AuthModePicker({
  value,
  onChange,
}: {
  value: AdminAuthMode;
  onChange: (mode: AdminAuthMode) => void;
}) {
  return (
    <div>
      <label className={labelClass}>Login type</label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange("pin")}
          className={`rounded-xl border px-3 py-3 text-left transition-colors ${
            value === "pin"
              ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
              : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20"
          }`}
        >
          <div className="text-sm font-bold">4-digit PIN</div>
          <div className="mt-1 text-[11px] leading-snug opacity-80">Number boxes on login</div>
        </button>
        <button
          type="button"
          onClick={() => onChange("password")}
          className={`rounded-xl border px-3 py-3 text-left transition-colors ${
            value === "password"
              ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
              : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20"
          }`}
        >
          <div className="text-sm font-bold">Password</div>
          <div className="mt-1 text-[11px] leading-snug opacity-80">Letters & numbers</div>
        </button>
      </div>
    </div>
  );
}

export function AdminSettingsClient() {
  const [mounted, setMounted] = useState(false);
  const [authMode, setAuthMode] = useState<AdminAuthMode>("password");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [maskedEmail, setMaskedEmail] = useState("adee**610@gmail.com");
  const [sendingCode, setSendingCode] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [emailAuthMode, setEmailAuthMode] = useState<AdminAuthMode>("password");
  const [emailNewPassword, setEmailNewPassword] = useState("");
  const [emailConfirmPassword, setEmailConfirmPassword] = useState("");
  const [resettingViaEmail, setResettingViaEmail] = useState(false);
  const [emailResetStatus, setEmailResetStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/admin/settings/password", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.maskedEmail) setMaskedEmail(data.maskedEmail);
        if (data.success && (data.authMode === "pin" || data.authMode === "password")) {
          setAuthMode(data.authMode);
          setEmailAuthMode(data.authMode);
        }
      })
      .catch(() => {});

    fetch("/api/admin/password-reset")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.maskedEmail) setMaskedEmail(data.maskedEmail);
        if (data.success && (data.authMode === "pin" || data.authMode === "password")) {
          setAuthMode(data.authMode);
          setEmailAuthMode(data.authMode);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setNewPassword("");
    setConfirmPassword("");
  }, [authMode]);

  useEffect(() => {
    setEmailNewPassword("");
    setEmailConfirmPassword("");
  }, [emailAuthMode]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus({ type: "error", message: "New values do not match" });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/admin/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, authMode }),
      });
      const data = await res.json();

      if (data.success) {
        setStatus({
          type: "success",
          message: "Updated. You will be logged out in 3 seconds...",
        });
        setTimeout(async () => {
          await fetch("/api/admin", { method: "DELETE" });
          window.location.reload();
        }, 3000);
      } else {
        setStatus({ type: "error", message: data.error || "Failed to update" });
      }
    } catch {
      setStatus({ type: "error", message: "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  const sendResetCode = async () => {
    setSendingCode(true);
    setEmailResetStatus(null);
    try {
      const res = await fetch("/api/admin/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_code" }),
      });
      const data = await res.json();
      if (data.success) {
        setCodeSent(true);
        setEmailResetStatus({ type: "success", message: data.message || "Reset code sent." });
        if (data.maskedEmail) setMaskedEmail(data.maskedEmail);
      } else {
        setEmailResetStatus({ type: "error", message: data.error || "Could not send code." });
      }
    } catch {
      setEmailResetStatus({ type: "error", message: "Could not send reset code." });
    } finally {
      setSendingCode(false);
    }
  };

  const resetPasswordViaEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailNewPassword !== emailConfirmPassword) {
      setEmailResetStatus({ type: "error", message: "Values do not match." });
      return;
    }

    setResettingViaEmail(true);
    setEmailResetStatus(null);
    try {
      const res = await fetch("/api/admin/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_reset",
          code: resetCode,
          newPassword: emailNewPassword,
          confirmPassword: emailConfirmPassword,
          authMode: emailAuthMode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailResetStatus({
          type: "success",
          message: "Reset complete. You will be logged out in 3 seconds...",
        });
        setResetCode("");
        setEmailNewPassword("");
        setEmailConfirmPassword("");
        setCodeSent(false);
        setTimeout(async () => {
          await fetch("/api/admin", { method: "DELETE" });
          window.location.reload();
        }, 3000);
      } else {
        setEmailResetStatus({ type: "error", message: data.error || "Reset failed." });
      }
    } catch {
      setEmailResetStatus({ type: "error", message: "Reset failed." });
    } finally {
      setResettingViaEmail(false);
    }
  };

  if (!mounted) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-xl border border-white/10 bg-[#0F172A] animate-pulse" />
        <div className="h-80 rounded-xl border border-white/10 bg-[#0F172A] animate-pulse lg:col-span-2 lg:max-w-xl" />
      </div>
    );
  }

  const newLabel = authMode === "pin" ? "New 4-digit PIN" : "New password";
  const confirmLabel = authMode === "pin" ? "Confirm PIN" : "Confirm new password";
  const emailNewLabel = emailAuthMode === "pin" ? "New 4-digit PIN" : "New password";
  const emailConfirmLabel = emailAuthMode === "pin" ? "Confirm PIN" : "Confirm new password";

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="space-y-6">
        <SectionCard
          title="Password recovery email"
          description="Reset codes are always sent to this fixed address. It cannot be changed from the admin panel."
          icon={Mail}
        >
          <div>
            <label className={labelClass}>Recovery email</label>
            <div
              className="rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3.5 text-base font-semibold tracking-wide text-cyan-300"
              aria-readonly="true"
            >
              {maskedEmail}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Password reset codes are delivered to this email only. The full address is hidden for security.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Change admin login"
          description="Choose 4-digit PIN (number boxes) or a normal password (letters & numbers, min 8)."
          icon={Lock}
        >
          {status && <StatusBanner type={status.type} message={status.message} />}

          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <AuthModePicker value={authMode} onChange={setAuthMode} />

            <div>
              <label className={labelClass}>Current password / PIN</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className={inputClass}
                inputMode={authMode === "pin" ? "numeric" : "text"}
              />
            </div>
            <div>
              <label className={labelClass}>{newLabel}</label>
              <input
                type={authMode === "pin" ? "text" : "password"}
                inputMode={authMode === "pin" ? "numeric" : "text"}
                pattern={authMode === "pin" ? `[0-9]{${ADMIN_PIN_LENGTH}}` : undefined}
                maxLength={authMode === "pin" ? ADMIN_PIN_LENGTH : undefined}
                value={newPassword}
                onChange={(e) =>
                  setNewPassword(
                    authMode === "pin"
                      ? e.target.value.replace(/\D/g, "").slice(0, ADMIN_PIN_LENGTH)
                      : e.target.value,
                  )
                }
                required
                minLength={authMode === "pin" ? ADMIN_PIN_LENGTH : ADMIN_PASSWORD_MIN_LENGTH}
                className={
                  authMode === "pin"
                    ? `${inputClass} text-center text-xl tracking-[0.45em] font-bold`
                    : inputClass
                }
                placeholder={authMode === "pin" ? "0000" : `At least ${ADMIN_PASSWORD_MIN_LENGTH} characters`}
              />
            </div>
            <div>
              <label className={labelClass}>{confirmLabel}</label>
              <input
                type={authMode === "pin" ? "text" : "password"}
                inputMode={authMode === "pin" ? "numeric" : "text"}
                pattern={authMode === "pin" ? `[0-9]{${ADMIN_PIN_LENGTH}}` : undefined}
                maxLength={authMode === "pin" ? ADMIN_PIN_LENGTH : undefined}
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(
                    authMode === "pin"
                      ? e.target.value.replace(/\D/g, "").slice(0, ADMIN_PIN_LENGTH)
                      : e.target.value,
                  )
                }
                required
                minLength={authMode === "pin" ? ADMIN_PIN_LENGTH : ADMIN_PASSWORD_MIN_LENGTH}
                className={
                  authMode === "pin"
                    ? `${inputClass} text-center text-xl tracking-[0.45em] font-bold`
                    : inputClass
                }
                placeholder={authMode === "pin" ? "0000" : undefined}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              {loading ? "Updating..." : authMode === "pin" ? "Update PIN" : "Update password"}
            </button>
          </form>
        </SectionCard>
      </div>

      <SectionCard
        title="Reset via email"
        description={
          maskedEmail
            ? `Send an ${ADMIN_RESET_CODE_LENGTH}-digit code to ${maskedEmail}, then set a new PIN or password. Code expires in 15 minutes.`
            : `Send an ${ADMIN_RESET_CODE_LENGTH}-digit code to your recovery email, then set a new PIN or password.`
        }
        icon={Send}
        className="lg:sticky lg:top-4"
      >
        {emailResetStatus && (
          <StatusBanner type={emailResetStatus.type} message={emailResetStatus.message} />
        )}

        <button
          type="button"
          disabled={sendingCode}
          onClick={sendResetCode}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-3 text-sm font-bold text-cyan-300 hover:bg-cyan-500/15 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {sendingCode ? "Sending..." : codeSent ? "Resend reset code" : "Send reset code"}
        </button>

        <form onSubmit={resetPasswordViaEmail} className="space-y-5 border-t border-white/10 pt-6">
          <AuthModePicker value={emailAuthMode} onChange={setEmailAuthMode} />

          <div>
            <label className={labelClass}>{ADMIN_RESET_CODE_LENGTH}-digit code from email</label>
            <input
              type="text"
              inputMode="numeric"
              pattern={`[0-9]{${ADMIN_RESET_CODE_LENGTH}}`}
              maxLength={ADMIN_RESET_CODE_LENGTH}
              value={resetCode}
              onChange={(e) =>
                setResetCode(
                  e.target.value.replace(/\D/g, "").slice(0, ADMIN_RESET_CODE_LENGTH),
                )
              }
              className={`${inputClass} text-center text-xl tracking-[0.35em] font-bold`}
              placeholder={"0".repeat(ADMIN_RESET_CODE_LENGTH)}
            />
          </div>
          <div>
            <label className={labelClass}>{emailNewLabel}</label>
            <input
              type={emailAuthMode === "pin" ? "text" : "password"}
              inputMode={emailAuthMode === "pin" ? "numeric" : "text"}
              pattern={emailAuthMode === "pin" ? `[0-9]{${ADMIN_PIN_LENGTH}}` : undefined}
              maxLength={emailAuthMode === "pin" ? ADMIN_PIN_LENGTH : undefined}
              value={emailNewPassword}
              onChange={(e) =>
                setEmailNewPassword(
                  emailAuthMode === "pin"
                    ? e.target.value.replace(/\D/g, "").slice(0, ADMIN_PIN_LENGTH)
                    : e.target.value,
                )
              }
              required
              minLength={
                emailAuthMode === "pin" ? ADMIN_PIN_LENGTH : ADMIN_PASSWORD_MIN_LENGTH
              }
              className={
                emailAuthMode === "pin"
                  ? `${inputClass} text-center text-xl tracking-[0.45em] font-bold`
                  : inputClass
              }
              placeholder={emailAuthMode === "pin" ? "0000" : undefined}
            />
          </div>
          <div>
            <label className={labelClass}>{emailConfirmLabel}</label>
            <input
              type={emailAuthMode === "pin" ? "text" : "password"}
              inputMode={emailAuthMode === "pin" ? "numeric" : "text"}
              pattern={emailAuthMode === "pin" ? `[0-9]{${ADMIN_PIN_LENGTH}}` : undefined}
              maxLength={emailAuthMode === "pin" ? ADMIN_PIN_LENGTH : undefined}
              value={emailConfirmPassword}
              onChange={(e) =>
                setEmailConfirmPassword(
                  emailAuthMode === "pin"
                    ? e.target.value.replace(/\D/g, "").slice(0, ADMIN_PIN_LENGTH)
                    : e.target.value,
                )
              }
              required
              minLength={
                emailAuthMode === "pin" ? ADMIN_PIN_LENGTH : ADMIN_PASSWORD_MIN_LENGTH
              }
              className={
                emailAuthMode === "pin"
                  ? `${inputClass} text-center text-xl tracking-[0.45em] font-bold`
                  : inputClass
              }
              placeholder={emailAuthMode === "pin" ? "0000" : undefined}
            />
          </div>
          <button
            type="submit"
            disabled={
              resettingViaEmail ||
              resetCode.length !== ADMIN_RESET_CODE_LENGTH ||
              emailNewPassword.length <
                (emailAuthMode === "pin" ? ADMIN_PIN_LENGTH : ADMIN_PASSWORD_MIN_LENGTH) ||
              (emailAuthMode === "pin" && emailNewPassword.length !== ADMIN_PIN_LENGTH)
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {resettingViaEmail
              ? "Resetting..."
              : emailAuthMode === "pin"
                ? "Reset PIN with code"
                : "Reset password with code"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
