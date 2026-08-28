"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { formatPkr } from "@/lib/pricing-config";

type ClientRow = {
  email: string;
  name: string;
  subscriptionPlan?: string;
  trialExpiresAt?: string | null;
  subscriptionExpiresAt: string | null;
  createdAt: string | null;
};

type PlanOption = {
  id: "solo" | "team";
  label: string;
  pricePerSeatPkr: number;
};

const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-sm text-white outline-none transition-all focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400";

function timeLeft(iso: string | null | undefined) {
  if (!iso) return { label: "No timer", className: "text-slate-500" };
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return { label: "No timer", className: "text-slate-500" };
  if (ms <= 0) return { label: "Expired", className: "text-rose-400" };
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.max(1, Math.ceil((ms % (60 * 60 * 1000)) / (60 * 1000)));
  if (hours >= 24) {
    const days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    return { label: `${days}d left`, className: "text-emerald-400" };
  }
  if (hours > 0) return { label: `${hours}h ${minutes}m left`, className: "text-emerald-400" };
  return { label: `${minutes}m left`, className: "text-emerald-400" };
}

function clientTimer(user: ClientRow) {
  return timeLeft(user.subscriptionExpiresAt || user.trialExpiresAt);
}

function planLabel(plan?: string) {
  if (plan === "team") return "Team";
  if (plan === "solo") return "Solo";
  if (plan === "trial") return "5h Trial";
  return plan || "—";
}

export default function ResellerClientsPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ClientRow[]>([]);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [accessType, setAccessType] = useState<"trial" | "solo" | "team">("trial");
  const [remainingTrialSeats, setRemainingTrialSeats] = useState(0);
  const [remainingPaidSeats, setRemainingPaidSeats] = useState(0);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/reseller-panel/clients", { credentials: "include", cache: "no-store" });
    const data = await res.json();
    if (!data.success) {
      setError(data.error || "Could not load clients.");
      return;
    }
    setError("");
    setUsers(data.users || []);
    setPlanOptions((data.planOptions || []) as PlanOption[]);
    setRemainingTrialSeats(Number(data.remainingTrialSeats) || 0);
    setRemainingPaidSeats(Number(data.remainingPaidSeats) || 0);
    const trialLeft = Number(data.remainingTrialSeats) || 0;
    if (trialLeft > 0) setAccessType("trial");
    else {
      const defaultPlan = data.defaultSeatPlan === "team" ? "team" : "solo";
      const options = (data.planOptions || []) as PlanOption[];
      setAccessType(options.some((item) => item.id === defaultPlan) ? defaultPlan : options[0]?.id || "solo");
    }
  }, []);

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

  const selectedPlan = planOptions.find((option) => option.id === accessType);
  const canSubmit =
    accessType === "trial" ? remainingTrialSeats > 0 : remainingPaidSeats > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setNotice("");
    setSaving(true);
    try {
      const res = await fetch("/api/reseller-panel/clients", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, subscriptionPlan: accessType }),
      });
      const data = await res.json();
      if (!data.success) {
        setFormError(data.error || "Could not register this client.");
        return;
      }
      setNotice(
        accessType === "trial"
          ? `${email.trim().toLowerCase()} registered with a 5-hour free trial under your brand.`
          : `${email.trim().toLowerCase()} registered on ${planLabel(accessType)}.`,
      );
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

  if (loading) return <AdminLoadingState />;

  return (
    <AdminPageLayout
      header={
        <AdminPageHeader
          title="Clients"
          description="Register clients on a free 5-hour trial seat or a paid Solo/Team seat."
        />
      }
    >
      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0F172A]/80 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Free trial seats</p>
          <p className="mt-1 text-lg font-black text-cyan-300">{remainingTrialSeats} left</p>
          <p className="text-xs text-slate-500">Each uses 5 hours</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0F172A]/80 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Paid seats</p>
          <p className="mt-1 text-lg font-black text-emerald-300">{remainingPaidSeats} left</p>
          <p className="text-xs text-slate-500">Solo / Team after payment</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-[#0F172A]/80 p-5">
        <h2 className="text-lg font-black text-white">Register a client</h2>
        <p className="mt-1 text-sm text-slate-400">
          They log in on your branded client site, not this reseller panel.
        </p>
        {formError ? (
          <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{formError}</p>
        ) : null}
        {notice ? (
          <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{notice}</p>
        ) : null}
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Client name</label>
            <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} placeholder="Full name" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Client email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} placeholder="client@email.com" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Access</label>
            <select
              required
              value={accessType}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "trial" || value === "solo" || value === "team") setAccessType(value);
              }}
              className={INPUT_CLASS}
            >
              <option value="trial" disabled={remainingTrialSeats <= 0}>
                Free 5h trial{remainingTrialSeats > 0 ? ` · ${remainingTrialSeats} left` : " · none left"}
              </option>
              {planOptions.map((option) => (
                <option key={option.id} value={option.id} disabled={remainingPaidSeats <= 0}>
                  {option.label}
                  {option.pricePerSeatPkr > 0 ? ` · ${formatPkr(option.pricePerSeatPkr)} / seat` : ""}
                  {remainingPaidSeats > 0 ? "" : " · none left"}
                </option>
              ))}
            </select>
            {accessType === "trial" ? (
              <p className="mt-1 text-xs font-semibold text-cyan-300">Uses one free trial seat · 5 hours</p>
            ) : selectedPlan && selectedPlan.pricePerSeatPkr > 0 ? (
              <p className="mt-1 text-xs font-semibold text-fuchsia-300">
                Seat price: {formatPkr(selectedPlan.pricePerSeatPkr)}
              </p>
            ) : null}
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
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving || !canSubmit}
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-60 sm:col-span-2"
          >
            {!canSubmit
              ? accessType === "trial"
                ? "No trial seats left"
                : "No paid seats left"
              : saving
                ? "Registering..."
                : "Register client"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0F172A]/80 p-5">
        <h2 className="text-lg font-black text-white">Your clients</h2>
        {users.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No clients registered yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">
            {users.map((user) => (
              <li key={user.email} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{user.name || "—"}</p>
                  <p className="truncate font-mono text-xs text-cyan-300">{user.email}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-fuchsia-300">
                    {planLabel(user.subscriptionPlan)}
                  </p>
                </div>
                <p className={`shrink-0 text-xs font-semibold ${clientTimer(user).className}`}>
                  {clientTimer(user).label}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminPageLayout>
  );
}
