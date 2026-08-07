"use client";

import { useEffect, useState, type ReactNode } from "react";
import { KeyRound, Lock, Mail, Send, type LucideIcon } from "lucide-react";

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
    <section
      className={`rounded-xl border border-white/10 bg-[#080810] ${className}`}
    >
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

export function AdminSettingsClient() {
  const [mounted, setMounted] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [maskedEmail, setMaskedEmail] = useState("adee**610@gmail.com");
  const [sendingCode, setSendingCode] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [emailNewPassword, setEmailNewPassword] = useState("");
  const [emailConfirmPassword, setEmailConfirmPassword] = useState("");
  const [resettingViaEmail, setResettingViaEmail] = useState(false);
  const [emailResetStatus, setEmailResetStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/admin/settings/password", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.maskedEmail) setMaskedEmail(data.maskedEmail);
      })
      .catch(() => {});

    fetch("/api/admin/password-reset")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.maskedEmail) setMaskedEmail(data.maskedEmail);
      })
      .catch(() => {});
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus({ type: "error", message: "New passwords do not match" });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/admin/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setStatus({
          type: "success",
          message: "Password updated. You will be logged out in 3 seconds...",
        });
        setTimeout(async () => {
          await fetch("/api/admin", { method: "DELETE" });
          window.location.reload();
        }, 3000);
      } else {
        setStatus({ type: "error", message: data.error || "Failed to update password" });
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
      setEmailResetStatus({ type: "error", message: "Passwords do not match." });
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
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailResetStatus({
          type: "success",
          message: "Password reset. You will be logged out in 3 seconds...",
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
        <div className="h-52 rounded-xl border border-white/10 bg-[#0F172A] animate-pulse" />
        <div className="h-96 rounded-xl border border-white/10 bg-[#0F172A] animate-pulse" />
        <div className="h-80 rounded-xl border border-white/10 bg-[#0F172A] animate-pulse lg:col-span-2 lg:max-w-xl" />
      </div>
    );
  }

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
          title="Change admin password"
          description="Use this when you know your current password. Minimum 4 characters."
          icon={Lock}
        >
          {status && <StatusBanner type={status.type} message={status.message} />}

          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div>
              <label className={labelClass}>Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={4}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={4}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        </SectionCard>
      </div>

      <SectionCard
        title="Reset password via email"
        description={
          maskedEmail
            ? `Send a 4-digit code to ${maskedEmail}, then set a new password. Code expires in 15 minutes.`
            : "Send a 4-digit code to your recovery email, then set a new password."
        }
        icon={Send}
        className="lg:sticky lg:top-4"
      >
        {emailResetStatus && <StatusBanner type={emailResetStatus.type} message={emailResetStatus.message} />}

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
          <div>
            <label className={labelClass}>4-digit code from email</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className={`${inputClass} text-center text-xl tracking-[0.45em] font-bold`}
              placeholder="0000"
            />
          </div>
          <div>
            <label className={labelClass}>New password</label>
            <input
              type="password"
              value={emailNewPassword}
              onChange={(e) => setEmailNewPassword(e.target.value)}
              required
              minLength={4}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Confirm new password</label>
            <input
              type="password"
              value={emailConfirmPassword}
              onChange={(e) => setEmailConfirmPassword(e.target.value)}
              required
              minLength={4}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={resettingViaEmail || resetCode.length !== 4 || emailNewPassword.length < 4}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {resettingViaEmail ? "Resetting..." : "Reset password with code"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
