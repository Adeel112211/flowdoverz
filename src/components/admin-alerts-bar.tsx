"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, CreditCard, Cookie } from "lucide-react";

type Alerts = {
  pendingPayments: number;
  trialsExpiringToday: number;
  subsExpiringThisWeek: number;
  emptyCookieSlots: number;
};

export function AdminAlertsBar() {
  const [alerts, setAlerts] = useState<Alerts | null>(null);

  useEffect(() => {
    fetch("/api/admin/alerts", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setAlerts(d.alerts);
      })
      .catch(() => {});
  }, []);

  if (!alerts) return null;

  const items = [
    alerts.pendingPayments > 0 && {
      href: "/admin/payments?filter=pending",
      icon: CreditCard,
      label: `${alerts.pendingPayments} pending payment${alerts.pendingPayments > 1 ? "s" : ""}`,
      tone: "amber",
    },
    alerts.trialsExpiringToday > 0 && {
      href: "/admin/clients?filter=trial",
      icon: Clock,
      label: `${alerts.trialsExpiringToday} trial${alerts.trialsExpiringToday > 1 ? "s" : ""} expiring today`,
      tone: "rose",
    },
    alerts.subsExpiringThisWeek > 0 && {
      href: "/admin/clients?filter=paid",
      icon: AlertTriangle,
      label: `${alerts.subsExpiringThisWeek} sub${alerts.subsExpiringThisWeek > 1 ? "s" : ""} expiring this week`,
      tone: "amber",
    },
    alerts.emptyCookieSlots > 0 && {
      href: "/admin/cookies",
      icon: Cookie,
      label: `${alerts.emptyCookieSlots} empty cookie slot${alerts.emptyCookieSlots > 1 ? "s" : ""}`,
      tone: "cyan",
    },
  ].filter(Boolean) as Array<{ href: string; icon: typeof CreditCard; label: string; tone: string }>;

  if (!items.length) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors hover:brightness-110 ${
              item.tone === "amber"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                : item.tone === "rose"
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                  : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
