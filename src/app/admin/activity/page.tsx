"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertCircle, Search } from "lucide-react";
import {
  AdminActivityFilters,
  formatActivityAction,
  matchesActivityFilter,
  type ActivityGroup,
} from "@/components/admin-activity-filters";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin-data-table";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { ActivityMobileCard } from "@/components/admin-mobile-cards";
import { useAdminLiveRefresh } from "@/hooks/use-admin-live-refresh";

type ActivityItem = {
  id: string;
  action: string;
  detail?: string;
  targetEmail?: string;
  createdAt: string;
};

function actionTone(action: string) {
  if (action.includes("approved") || action.includes("created") || action.includes("unsuspend")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (action.includes("rejected") || action.includes("deleted") || action.includes("suspend")) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }
  if (action.includes("refunded") || action.includes("cleared") || action.includes("logout")) {
    return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }
  if (action.includes("payment") || action.includes("cookie")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
}

function ActionBadge({ action }: { action: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${actionTone(action)}`}
    >
      {formatActivityAction(action)}
    </span>
  );
}

function EmptyActivity() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10">
        <Activity className="h-8 w-8 text-cyan-400" />
      </div>
      <h3 className="text-xl font-black text-slate-200 sm:text-2xl">No activity recorded</h3>
      <p className="max-w-sm text-sm text-slate-400">
        Admin actions across clients, payments, and settings will show up here.
      </p>
    </div>
  );
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [group, setGroup] = useState<ActivityGroup>("all");
  const [action, setAction] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchActivity = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/admin/activity?limit=200", {
        credentials: "same-origin",
      });
      const raw = await res.text();
      let data: { success?: boolean; items?: ActivityItem[]; error?: string } = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        if (!silent) {
          setError(raw.trim().slice(0, 180) || `Failed to fetch activity (HTTP ${res.status}).`);
        }
        return;
      }

      if (data.success && data.items) {
        setItems(data.items);
        setError("");
      } else if (!silent) {
        setError(data.error || `Failed to fetch activity (HTTP ${res.status}).`);
      }
    } catch {
      if (!silent) setError("Failed to fetch activity log.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchActivity(false);
  }, [fetchActivity]);

  useAdminLiveRefresh(() => fetchActivity(true), [fetchActivity], {
    topics: ["user", "payment", "activity"],
    ignoreActions: ["synced"],
  });

  const filteredItems = items.filter((item) => {
    if (!matchesActivityFilter(item.action, group, action)) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.action.toLowerCase().includes(q) ||
      (item.detail || "").toLowerCase().includes(q) ||
      (item.targetEmail || "").toLowerCase().includes(q)
    );
  });

  const getTableTitle = () => {
    if (group === "all") return "All Activity";
    if (action === "all") {
      return `${group.charAt(0).toUpperCase()}${group.slice(1)} Activity`;
    }
    return formatActivityAction(action);
  };

  const columns: AdminTableColumn<ActivityItem>[] = [
    {
      key: "action",
      header: "Action",
      render: (item) => <ActionBadge action={item.action} />,
    },
    {
      key: "detail",
      header: "Detail",
      className: "min-w-[180px] max-w-[320px]",
      render: (item) => (
        <span className="block truncate text-sm text-slate-400" title={item.detail || ""}>
          {item.detail || "—"}
        </span>
      ),
    },
    {
      key: "email",
      header: "Target",
      className: "min-w-[180px] max-w-[280px]",
      render: (item) =>
        item.targetEmail ? (
          <span className="block truncate font-mono text-sm text-cyan-400/90" title={item.targetEmail}>
            {item.targetEmail}
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
    {
      key: "date",
      header: "When",
      mobileLabel: "Date",
      render: (item) => (
        <span className="whitespace-nowrap text-slate-400">
          {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
        </span>
      ),
    },
  ];

  if (loading) {
    return <AdminLoadingState label="Loading activity..." />;
  }

  return (
    <AdminPageLayout
      scrollContent={false}
      header={
        <AdminPageHeader
          title="Activity Log"
          description="Track admin actions across clients, payments, and cookies."
        />
      }
    >
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
          <AlertCircle size={20} className="shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="mb-4 sm:mb-6">
        <AdminActivityFilters
          group={group}
          action={action}
          onGroupChange={setGroup}
          onActionChange={setAction}
        />
      </div>

      <AdminDataTable
        title={getTableTitle()}
        count={filteredItems.length}
        columns={columns}
        data={filteredItems}
        rowKey={(item) => item.id}
        emptyState={<EmptyActivity />}
        renderMobileCard={(item) => <ActivityMobileCard item={item} />}
        headerActions={
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900/50 py-2 pl-9 pr-4 text-sm text-slate-200 placeholder:text-slate-500 transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
          </div>
        }
      />
    </AdminPageLayout>
  );
}
