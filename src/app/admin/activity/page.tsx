"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { AdminFilterPills } from "@/components/admin-filter-pills";

type ActivityItem = {
  id: string;
  action: string;
  detail?: string;
  targetEmail?: string;
  createdAt: string;
};

const ACTION_FILTERS = [
  "all",
  "client_created",
  "client_updated",
  "client_deleted",
  "payment_approved",
  "payment_rejected",
  "cookies_saved",
  "admin_login",
] as const;

type ActionFilter = (typeof ACTION_FILTERS)[number];

function formatAction(action: string) {
  return action.replace(/_/g, " ");
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActionFilter>("all");

  useEffect(() => {
    const url =
      filter === "all"
        ? "/api/admin/activity?limit=200"
        : `/api/admin/activity?limit=200&action=${filter}`;
    setLoading(true);
    fetch(url, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.items);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  if (loading) return <AdminLoadingState label="Loading activity..." />;

  return (
    <AdminPageLayout
      header={
        <AdminPageHeader
          title="Activity Log"
          description="Track admin actions across clients, payments, and cookies."
        />
      }
    >
      <AdminFilterPills
        options={ACTION_FILTERS}
        value={filter}
        onChange={setFilter}
        formatLabel={(v) => (v === "all" ? "All" : formatAction(v))}
      />

      <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
        {items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Activity className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-slate-400">No activity recorded yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((item) => (
              <li key={item.id} className="px-4 sm:px-6 py-4 hover:bg-white/[0.02]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-200 capitalize">
                      {formatAction(item.action)}
                    </p>
                    {item.detail && <p className="text-sm text-slate-400 mt-0.5">{item.detail}</p>}
                    {item.targetEmail && (
                      <p className="text-xs text-cyan-400/80 mt-1 font-mono">{item.targetEmail}</p>
                    )}
                  </div>
                  <time className="text-xs text-slate-500 whitespace-nowrap">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminPageLayout>
  );
}
