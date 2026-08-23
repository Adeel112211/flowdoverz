"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { AuthPageBackground } from "@/components/auth-page-background";
import { appPath } from "@/lib/site-urls";

type PartnerUser = {
  email: string;
  name: string;
  subscriptionExpiresAt: string | null;
  createdAt: string | null;
};

type PanelInfo = {
  partnerName: string;
  contactName: string;
  seatDays: number;
  seatsPurchased: number;
  userCount: number;
  remainingSeats: number;
  loginUrl: string;
};

function daysLeft(iso: string | null | undefined) {
  if (!iso) return { label: "No timer", className: "text-slate-500" };
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return { label: "No timer", className: "text-slate-500" };
  if (ms <= 0) return { label: "Expired", className: "text-rose-400" };
  const days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  return { label: `${days}d left`, className: "text-emerald-400" };
}

const INPUT_CLASS =
  "w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-cyan-400 focus:bg-white/10 focus:ring-2 focus:ring-cyan-500/20";

export function PartnerPanel() {
  const params = useParams<{ slug: string }>();
  const slug = String(params.slug || "");
  const [panel, setPanel] = useState<PanelInfo | null>(null);
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!slug) return;
    const res = await fetch(`/api/partner/${encodeURIComponent(slug)}`, { cache: "no-store" });
    const data = await res.json();
    if (!data.success) {
      setError(data.error || "This partner panel is not available.");
      setPanel(null);
      return;
    }
    setError("");
    setPanel(data.panel);
    setUsers(data.users || []);
  }, [slug]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void load().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setNotice("");
    setSaving(true);
    try {
      const res = await fetch(`/api/partner/${encodeURIComponent(slug)}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setFormError(data.error || "Could not register this client.");
        return;
      }
      setNotice(`${email.trim().toLowerCase()} registered. They log in on FlowDoverz with this email and password.`);
      setName("");
      setEmail("");
      setPassword("");
      await load();
    } catch {
      setFormError("Could not register this client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden px-4 py-10 sm:py-12">
      <AuthPageBackground />
      <div className="relative mx-auto w-full max-w-3xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href={appPath("/")} className="inline-flex">
            <BrandLogo size="lg" stacked showTagline={false} />
          </Link>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Partner panel</h1>
          <p className="mt-2 max-w-lg text-sm text-slate-400">
            Register your clients on FlowDoverz. Each new client uses one paid seat. Their 30-day timer starts when you register them.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-sm text-slate-400">Loading panel...</p>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
            <div className="mb-2 flex items-center gap-2 font-bold">
              <AlertCircle size={16} />
              Panel unavailable
            </div>
            {error}
          </div>
        ) : panel ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Partner", value: panel.partnerName },
                { label: "Paid seats", value: String(panel.seatsPurchased) },
                { label: "Registered", value: String(panel.userCount) },
                { label: "Seats left", value: String(panel.remainingSeats) },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-[#06080d]/80 px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
                  <p className="mt-1 truncate text-lg font-black text-white">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#06080d]/80 p-6 shadow-[0_0_60px_rgba(34,211,238,0.12)] sm:p-8">
              <h2 className="text-xl font-black text-white">Register a client</h2>
              <p className="mt-1 text-sm text-slate-400">
                They will sign in at FlowDoverz login. Unused seats stay until you register someone.
              </p>
              {formError ? (
                <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{formError}</p>
              ) : null}
              {notice ? (
                <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{notice}</p>
              ) : null}
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Client name</label>
                  <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} placeholder="Full name" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Client email</label>
                  <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} placeholder="client@email.com" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
                  <div className="relative">
                    <input
                      required
                      minLength={8}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${INPUT_CLASS} pr-12`}
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={saving || panel.remainingSeats <= 0}
                  className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-8 py-4 text-sm font-black text-slate-950 disabled:opacity-60"
                >
                  {panel.remainingSeats <= 0 ? "No seats left" : saving ? "Registering..." : "Register client"}
                </button>
              </form>
              <p className="mt-4 text-center text-xs text-slate-500">
                Clients log in here:{" "}
                <Link href={appPath("/login")} className="font-semibold text-cyan-300 hover:text-cyan-200">
                  FlowDoverz login
                </Link>
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#06080d]/80 p-6 sm:p-8">
              <h2 className="text-xl font-black text-white">Your clients</h2>
              {users.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">No clients registered yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">
                  {users.map((user) => (
                    <li key={user.email} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{user.name || "—"}</p>
                        <p className="truncate font-mono text-xs text-cyan-300">{user.email}</p>
                      </div>
                      <p className={`shrink-0 text-xs font-semibold ${daysLeft(user.subscriptionExpiresAt).className}`}>
                        {daysLeft(user.subscriptionExpiresAt).label}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
