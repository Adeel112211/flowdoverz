"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { formatPkr } from "@/lib/pricing-config";
import { trialSeatHoursLabel, resellerClientActiveExpiry } from "@/lib/reseller-trial";

type ClientRow = {
  email: string;
  name: string;
  subscriptionPlan?: string;
  trialExpiresAt?: string | null;
  subscriptionExpiresAt: string | null;
  createdAt: string | null;
};

type PlanOption = {
  id: "solo" | "team" | "trial";
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
  return timeLeft(resellerClientActiveExpiry(user));
}

function planLabel(plan?: string, trialHours = 5) {
  if (plan === "team") return "Team";
  if (plan === "solo") return "Solo";
  if (plan === "trial") return `${trialSeatHoursLabel(trialHours)} trial`;
  return plan || "—";
}

function pickDefaultSubscriptionPlan(
  options: PlanOption[],
  args: {
    defaultSeatPlan?: string;
    trialSeatsEnabled: boolean;
    remainingTrialSeats: number;
    remainingPaidSeats: number;
  },
): "solo" | "team" | "trial" {
  const trialDisabled = !args.trialSeatsEnabled || args.remainingTrialSeats <= 0;
  const paidDisabled = args.remainingPaidSeats <= 0;

  const firstEnabled = options.find((option) => {
    if (option.id === "trial") return !trialDisabled;
    return !paidDisabled;
  })?.id;
  if (firstEnabled) return firstEnabled;

  const preferred =
    args.defaultSeatPlan === "team" ? "team" : args.defaultSeatPlan === "trial" ? "trial" : "solo";
  if (options.some((item) => item.id === preferred)) return preferred;
  return options[0]?.id || "solo";
}

function isPlanOptionDisabled(
  optionId: PlanOption["id"],
  trialOptionDisabled: boolean,
  paidOptionDisabled: boolean,
) {
  return (optionId === "trial" && trialOptionDisabled) || (optionId !== "trial" && paidOptionDisabled);
}

export default function ResellerClientsPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ClientRow[]>([]);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [subscriptionPlan, setSubscriptionPlan] = useState<"solo" | "team" | "trial">("trial");
  const [remainingPaidSeats, setRemainingPaidSeats] = useState(0);
  const [remainingTrialSeats, setRemainingTrialSeats] = useState(0);
  const [trialSeatsEnabled, setTrialSeatsEnabled] = useState(false);
  const [trialSeatHours, setTrialSeatHours] = useState(5);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const planTouchedRef = useRef(false);

  const load = useCallback(async (resetPlan = true) => {
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
    setRemainingPaidSeats(Number(data.remainingPaidSeats) || 0);
    setRemainingTrialSeats(Number(data.remainingTrialSeats) || 0);
    setTrialSeatsEnabled(Boolean(data.trialSeatsEnabled));
    setTrialSeatHours(Number(data.trialSeatHours) || 5);
    if (resetPlan && !planTouchedRef.current) {
      const trialLeft = Number(data.remainingTrialSeats) || 0;
      const trialEnabled = Boolean(data.trialSeatsEnabled);
      if (trialEnabled && trialLeft > 0) {
        setSubscriptionPlan("trial");
      } else {
        setSubscriptionPlan(
          pickDefaultSubscriptionPlan(options, {
            defaultSeatPlan: data.defaultSeatPlan,
            trialSeatsEnabled: trialEnabled,
            remainingTrialSeats: trialLeft,
            remainingPaidSeats: Number(data.remainingPaidSeats) || 0,
          }),
        );
      }
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

  const selectedPlan = planOptions.find((option) => option.id === subscriptionPlan);
  const trialOptionDisabled = !trialSeatsEnabled || remainingTrialSeats <= 0;
  const paidOptionDisabled = remainingPaidSeats <= 0;

  useEffect(() => {
    if (loading || planOptions.length === 0 || planTouchedRef.current) return;
    if (!isPlanOptionDisabled(subscriptionPlan, trialOptionDisabled, paidOptionDisabled)) return;
    setSubscriptionPlan(
      pickDefaultSubscriptionPlan(planOptions, {
        trialSeatsEnabled,
        remainingTrialSeats,
        remainingPaidSeats,
      }),
    );
  }, [
    loading,
    planOptions,
    subscriptionPlan,
    trialOptionDisabled,
    paidOptionDisabled,
    trialSeatsEnabled,
    remainingTrialSeats,
    remainingPaidSeats,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loading) return;
    setFormError("");
    setNotice("");
    setSaving(true);
    try {
      const formData = new FormData(event.currentTarget);
      const rawPlan = String(formData.get("subscriptionPlan") || subscriptionPlan);
      const planToRegister =
        rawPlan === "team" ? "team" : rawPlan === "trial" ? "trial" : "solo";
      const res = await fetch("/api/reseller-panel/clients", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          subscriptionPlan: planToRegister,
          plan: planToRegister,
          isTrial: planToRegister === "trial",
          trialSeat: planToRegister === "trial",
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setFormError(data.error || "Could not register this client.");
        return;
      }
      const registeredPlan = String(data.user?.subscriptionPlan || planToRegister);
      if (registeredPlan !== planToRegister) {
        setFormError(
          `Registered as ${planLabel(registeredPlan, trialSeatHours)} instead of ${planLabel(planToRegister, trialSeatHours)}. Contact support if this keeps happening.`,
        );
        await load(false);
        return;
      }
      setNotice(
        `${email.trim().toLowerCase()} registered on ${planLabel(registeredPlan, trialSeatHours)}. They sign in with this email and password.`,
      );
      setName("");
      setEmail("");
      setPassword("");
      planTouchedRef.current = false;
      await load(true);
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
          description="Register clients on a paid Solo/Team seat or a short trial seat when your owner enabled trials."
        />
      }
    >
      {error ? (
        <p className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0F172A]/80 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Paid seats left</p>
          <p className="mt-1 text-lg font-black text-emerald-300">{remainingPaidSeats}</p>
        </div>
        {trialSeatsEnabled ? (
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/80">
              {trialSeatHoursLabel(trialSeatHours)} trial seats left
            </p>
            <p className="mt-1 text-lg font-black text-cyan-200">{remainingTrialSeats}</p>
          </div>
        ) : null}
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
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Plan</label>
            <select
              required
              name="subscriptionPlan"
              value={subscriptionPlan}
              onChange={(e) => {
                planTouchedRef.current = true;
                const value = e.target.value;
                setSubscriptionPlan(value === "team" ? "team" : value === "trial" ? "trial" : "solo");
              }}
              className={INPUT_CLASS}
            >
              {planOptions.map((option) => {
                const disabled = isPlanOptionDisabled(option.id, trialOptionDisabled, paidOptionDisabled);
                return (
                  <option key={option.id} value={option.id} disabled={disabled}>
                    {option.label}
                    {option.pricePerSeatPkr > 0 ? ` · ${formatPkr(option.pricePerSeatPkr)} / seat` : ""}
                    {disabled ? " (none left)" : ""}
                  </option>
                );
              })}
            </select>
            {selectedPlan && selectedPlan.pricePerSeatPkr > 0 ? (
              <p className="mt-1 text-xs font-semibold text-fuchsia-300">
                Seat price: {formatPkr(selectedPlan.pricePerSeatPkr)}
              </p>
            ) : null}
            {subscriptionPlan === "trial" ? (
              <p className="mt-1 text-xs text-cyan-300">
                Uses one trial seat. Timer starts now for {trialSeatHoursLabel(trialSeatHours)}.
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
                className={`${INPUT_CLASS} pr-11`}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving || loading || (subscriptionPlan === "trial" ? trialOptionDisabled : paidOptionDisabled)}
              className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
            >
              {saving ? "Registering..." : "Register client"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0F172A]/80 p-5">
        <h2 className="text-lg font-black text-white">Registered clients</h2>
        {users.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No clients registered yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Timer</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const timer = clientTimer(user);
                  return (
                    <tr key={user.email} className="border-b border-white/5">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-white">{user.name || "—"}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-3 py-3 capitalize text-slate-300">
                        {planLabel(user.subscriptionPlan, trialSeatHours)}
                      </td>
                      <td className={`px-3 py-3 font-medium ${timer.className}`}>{timer.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}
