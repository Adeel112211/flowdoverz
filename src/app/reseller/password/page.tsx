"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";

const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400";

export default function ResellerPasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/reseller-panel/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not update password.");
        return;
      }
      setMessage(data.message || "Password updated. Sign in again.");
      setTimeout(() => {
        window.location.href = "/reseller";
      }, 800);
    } catch {
      setError("Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageLayout
      header={
        <AdminPageHeader
          title="Password"
          description="Change the password you use to open this reseller panel."
        />
      }
    >
      <form onSubmit={handleSubmit} className="w-full min-w-0 max-w-lg space-y-4 rounded-2xl border border-white/10 bg-[#0F172A]/80 p-4 sm:p-5">
        {error ? (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>
        ) : null}
        {message ? (
          <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{message}</p>
        ) : null}
        {[
          { label: "Current password", value: currentPassword, set: setCurrentPassword },
          { label: "New password", value: newPassword, set: setNewPassword },
          { label: "Confirm new password", value: confirmPassword, set: setConfirmPassword },
        ].map((field) => (
          <div key={field.label}>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">{field.label}</label>
            <div className="relative">
              <input
                required
                minLength={8}
                type={show ? "text" : "password"}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                className={`${INPUT_CLASS} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShow((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ))}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Update password"}
        </button>
      </form>
    </AdminPageLayout>
  );
}
