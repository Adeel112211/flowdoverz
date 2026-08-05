"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin-page-header";

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const handleSubmit = async (e: React.FormEvent) => {
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
          message: "Password updated successfully. You will be logged out in 3 seconds...",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");

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

  return (
    <div className="relative flex flex-col min-w-0 max-w-full overflow-x-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      <AdminPageHeader
        title="Settings"
        description="Manage your admin credentials and system preferences."
      />

      <div className="max-w-xl w-full mx-auto pb-8 sm:pb-12">
        <div className="rounded-xl sm:rounded-2xl border border-white/5 bg-white/[0.02] p-4 sm:p-8 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          <h2 className="mb-6 text-lg sm:text-xl font-bold text-slate-200 relative z-10">
            Change Admin Password
          </h2>

          {status && (
            <div
              className={`mb-6 relative z-10 rounded-xl border px-4 py-3 text-sm font-medium ${
                status.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300"
              }`}
            >
              {status.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-white/5 bg-[#080810]/50 px-4 py-3 text-sm font-medium text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-white/5 bg-[#080810]/50 px-4 py-3 text-sm font-medium text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-white/5 bg-[#080810]/50 px-4 py-3 text-sm font-medium text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              className="mt-4 sm:mt-8 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-3.5 text-sm font-bold text-slate-950 transition-all hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
