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

function daysLeft(iso: string | null | undefined) {
  if (!iso) return { label: "No timer", className: "text-slate-500" };
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return { label: "No timer", className: "text-slate-500" };
  if (ms <= 0) return { label: "Expired", className: "text-rose-400" };
  const days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  return { label: `${days}d left`, className: "text-emerald-400" };
}

function planLabel(plan?: string) {
  if (plan === "team") return "Team";
  if (plan === "solo") return "Solo";
  return plan || "—";
}

export default function ResellerClientsPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ClientRow[]>([]);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [subscriptionPlan, setSubscriptionPlan] = useState<"solo" | "team">("solo");
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
    const options = (data.planOptions || []) as PlanOption[];
    setPlanOptions(options);
    const defaultPlan = data.defaultSeatPlan === "team" ? "team" : "solo";
    const firstPlan = options[0]?.id || defaultPlan;
    setSubscriptionPlan(options.some((item) => item.id === defaultPlan) ? defaultPlan : firstPlan);
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

  const selectedPlan = planOptions.find((option) => option.id === subscriptionPlan);

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
        body: JSON.stringify({ name, email, password, subscriptionPlan }),
      });
      const data = await res.json();
      if (!data.success) {
        setFormError(data.error || "Could not register this client.");
        return;
      }
      setNotice(
        `${email.trim().toLowerCase()} registered on ${planLabel(subscriptionPlan)}. They sign in on FlowDoverz with this email and password.`,
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
          description="Register your clients here. Each new client uses one paid seat, starts their timer, and gets the plan you choose."
        />
      }
    >
      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      ) : null}

      <div className="mb-6 rounded-2xl border border-white/10 bg-[#0F172A]/80 p-5">
        <h2 className="text-lg font-black text-white">Register a client</h2>
        <p className="mt-1 text-sm text-slate-400">They log in on the FlowDoverz website, not this reseller panel.</p>
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
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Plan</label>
            <select
              required
              value={subscriptionPlan}
              onChange={(e) => setSubscriptionPlan(e.target.value === "team" ? "team" : "solo")}
              className={INPUT_CLASS}
            >
              {planOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                  {option.pricePerSeatPkr > 0 ? ` · ${formatPkr(option.pricePerSeatPkr)} / seat` : ""}
                </option>
              ))}
            </select>
            {selectedPlan && selectedPlan.pricePerSeatPkr > 0 ? (
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
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-60 sm:col-span-2"
          >
            {saving ? "Registering..." : "Register client"}
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
                <p className={`shrink-0 text-xs font-semibold ${daysLeft(user.subscriptionExpiresAt).className}`}>
                  {daysLeft(user.subscriptionExpiresAt).label}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminPageLayout>
  );
}
