"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Radio, RefreshCw } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { AdminFilterPills } from "@/components/admin-filter-pills";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin-data-table";
import { AdminTablePagination } from "@/components/admin-table-pagination";
import { SyncMobileCard } from "@/components/admin-mobile-cards";
import { useAdminLiveRefresh } from "@/hooks/use-admin-live-refresh";

const PAGE_SIZE = 50;

type SyncClient = {
  email: string;
  name: string;
  subscriptionPlan: string;
  suspended: boolean;
  assignedSlot: string;
  lastSyncAt: string | null;
  lastSyncSlot: string | null;
  extensionVersion: string | null;
  syncHealth: string | null;
  syncStatus: "never" | "stale" | "active" | "expired" | "suspended";
  active: boolean;
};

const FILTERS = ["all", "active", "stale", "never", "expired", "suspended"] as const;
type Filter = (typeof FILTERS)[number];

function StatusBadge({ status }: { status: SyncClient["syncStatus"] }) {
  const styles = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    stale: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    never: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    expired: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    suspended: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function SyncStatusPage() {
  const [clients, setClients] = useState<SyncClient[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async (page = 1, opts: { silent?: boolean; initial?: boolean } = {}) => {
    const silent = Boolean(opts.silent);
    const initial = Boolean(opts.initial);
    if (initial) setInitialLoading(true);
    else if (!silent) setPageLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("page", String(page));
      const res = await fetch(`/api/admin/sync-status?${params}`, { credentials: "same-origin" });
      const data = await res.json();
      if (data.success) {
        setClients(data.clients || []);
        setTotalCount(typeof data.totalCount === "number" ? data.totalCount : (data.clients || []).length);
        setCurrentPage(page);
      }
    } finally {
      setInitialLoading(false);
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1, { initial: !hasLoadedOnce.current, silent: hasLoadedOnce.current });
    hasLoadedOnce.current = true;
  }, [load]);

  useAdminLiveRefresh(
    async (event) => {
      if (event.type === "resync") {
        void load(currentPage, { silent: true });
        return;
      }
      const id = String(event.userId || event.id || "").toLowerCase();
      if (!id) {
        void load(currentPage, { silent: true });
        return;
      }
      try {
        const res = await fetch(`/api/admin/sync-status?email=${encodeURIComponent(id)}`, {
          credentials: "same-origin",
        });
        const data = await res.json();
        if (!data.success || !data.client) {
          setClients((prev) => prev.filter((c) => c.email !== id));
          return;
        }
        const row = data.client as SyncClient;
        setClients((prev) => {
          const exists = prev.some((c) => c.email === row.email);
          if (exists) return prev.map((c) => (c.email === row.email ? row : c));
          return [row, ...prev];
        });
      } catch {
        // keep current page
      }
    },
    [load, currentPage],
    { topics: ["user", "extension"] },
  );

  const filtered = clients.filter((c) => filter === "all" || c.syncStatus === filter);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const tableCount = totalCount > 0 ? totalCount : filtered.length;

  const columns: AdminTableColumn<SyncClient>[] = [
    {
      key: "name",
      header: "Client",
      render: (c) => (
        <div>
          <Link href={`/admin/clients/${encodeURIComponent(c.email)}`} className="font-semibold text-cyan-400 hover:underline">
            {c.name || c.email}
          </Link>
          <p className="text-xs text-slate-500">{c.email}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Sync Status",
      render: (c) => <StatusBadge status={c.syncStatus} />,
    },
    {
      key: "lastSync",
      header: "Last Sync",
      render: (c) => (
        <span className="text-sm text-slate-400">
          {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : "Never"}
        </span>
      ),
    },
    {
      key: "slot",
      header: "Slot",
      render: (c) => (
        <span className="font-mono text-xs text-slate-400">{c.lastSyncSlot || c.assignedSlot || "—"}</span>
      ),
    },
    {
      key: "ext",
      header: "Extension",
      render: (c) => <span className="text-sm text-slate-400">{c.extensionVersion || "—"}</span>,
    },
    {
      key: "plan",
      header: "Plan",
      render: (c) => <span className="capitalize text-sm text-slate-300">{c.subscriptionPlan}</span>,
    },
  ];

  function goToPage(page: number) {
    if (page < 1 || page > totalPages || pageLoading || page === currentPage) return;
    void load(page);
  }

  if (initialLoading) return <AdminLoadingState label="Loading sync status..." />;

  return (
    <AdminPageLayout
      header={
        <AdminPageHeader
          title="Sync Status"
          description={
            <>
              <span className="font-semibold text-cyan-300">{totalCount.toLocaleString()} clients total</span>
              {" · "}
              Monitor which clients are connected and syncing via the extension.
            </>
          }
          actions={
            <button
              type="button"
              onClick={() => void load(currentPage)}
              disabled={pageLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/5 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${pageLoading ? "animate-spin" : ""}`} /> Refresh
            </button>
          }
        />
      }
    >
      <AdminFilterPills options={FILTERS} value={filter} onChange={setFilter} />

      <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4 sm:p-6">
        {filtered.length === 0 && !pageLoading ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Radio className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-slate-400">No clients match this filter.</p>
          </div>
        ) : (
          <>
            <AdminDataTable
              title="Clients"
              count={tableCount}
              loading={pageLoading}
              columns={columns}
              data={filtered}
              rowKey={(c) => c.email}
              emptyState={<p className="text-slate-500 text-center py-8">No clients</p>}
              renderMobileCard={(c) => (
                <SyncMobileCard client={c} statusBadge={<StatusBadge status={c.syncStatus} />} />
              )}
            />
            {totalCount > PAGE_SIZE ? (
              <AdminTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={PAGE_SIZE}
                loading={pageLoading}
                onPageChange={goToPage}
              />
            ) : null}
          </>
        )}
      </div>
    </AdminPageLayout>
  );
}
