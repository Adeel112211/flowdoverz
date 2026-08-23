"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, UserPlus, Timer, Wallet } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { useResellerNav } from "@/components/reseller-nav";

type Stats = {
  seatsPurchased: number;
  userCount: number;
  remainingSeats: number;
  activeClients: number;
  expiredClients: number;
  seatDays: number;
};

type RecentClient = {
  email: string;
  name: string;
  subscriptionExpiresAt: string | null;
  createdAt: string | null;
};

function daysLeft(iso: string | null | undefined) {
  if (!iso) return { label: "No timer", className: "text-slate-500" };
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return { label: "No timer", className: "text-slate-500" };
  if (ms <= 0) return { label: "Expired", className: "text-rose-400" };
  const days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  return { label: `${days}d left`, className: "text-emerald-400" };
}

export default function ResellerDashboardPage() {
  const nav = useResellerNav();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brandName, setBrandName] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentClient[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/reseller-panel/me", { credentials: "include", cache: "no-store" });
    const data = await res.json();
    if (!data.success) {
      setError(data.error || "Could not load dashboard.");
      return;
    }
    setError("");
    setBrandName(data.reseller?.brandName || "");
    setStats(data.stats);
    setRecent(data.recentClients || []);
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

  if (loading) {
    return <AdminLoadingState />;
  }

  return (
    <AdminPageLayout
      header={
        <AdminPageHeader
          title="Dashboard"
          description={brandName ? `Welcome back, ${brandName}.` : "Your reseller overview."}
        />
      }
    >
      {error ? (
        <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      ) : null}
      {stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Paid seats", value: stats.seatsPurchased, icon: Wallet, color: "text-cyan-400" },
            { label: "Registered", value: stats.userCount, icon: Users, color: "text-emerald-400" },
            { label: "Seats left", value: stats.remainingSeats, icon: UserPlus, color: "text-amber-400" },
            { label: "Active now", value: stats.activeClients, icon: Timer, color: "text-cyan-300" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="min-w-0 rounded-2xl border border-white/10 bg-[#0F172A]/80 p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
                  <Icon className={`h-4 w-4 shrink-0 ${item.color}`} />
                </div>
                <p className="text-2xl font-black tabular-nums text-white sm:text-3xl">{item.value}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-white/10 bg-[#0F172A]/80 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-white">Recent clients</h2>
          <Link href={nav.clients} className="shrink-0 text-sm font-semibold text-cyan-400 hover:text-cyan-300">
            Open clients
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400">No clients yet. Register them from the Clients page.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {recent.map((user) => (
              <li key={user.email} className="flex items-center justify-between gap-3 py-3">
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
    </AdminPageLayout>
  );
}
