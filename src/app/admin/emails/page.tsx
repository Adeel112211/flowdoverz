"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Mail, Search, XCircle } from "lucide-react";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin-data-table";
import { AdminFilterPills } from "@/components/admin-filter-pills";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { EmailMobileCard } from "@/components/admin-mobile-cards";

type EmailItem = {
  id: string;
  to: string;
  subject: string;
  type: string;
  status: "sent" | "failed";
  error?: string;
  createdAt: string;
};

const FILTERS = ["all", "sent", "failed"] as const;
type Filter = (typeof FILTERS)[number];

function EmailStatus({ status }: { status: EmailItem["status"] }) {
  if (status === "sent") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
        <CheckCircle2 size={12} /> Sent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-400">
      <XCircle size={12} /> Failed
    </span>
  );
}

function EmptyEmails() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10">
        <Mail className="h-8 w-8 text-cyan-400" />
      </div>
      <h3 className="text-xl font-black text-slate-200 sm:text-2xl">No emails logged</h3>
      <p className="max-w-sm text-sm text-slate-400">
        System emails sent to clients will appear here after delivery attempts.
      </p>
    </div>
  );
}

function formatEmailType(type: string) {
  return type.replace(/_/g, " ");
}

export default function EmailsPage() {
  const [items, setItems] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/emails?limit=200", { credentials: "same-origin" });
      const raw = await res.text();
      let data: { success?: boolean; items?: EmailItem[]; error?: string } = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setError(raw.trim().slice(0, 180) || `Failed to fetch emails (HTTP ${res.status}).`);
        return;
      }

      if (data.success && data.items) {
        setItems(data.items);
        setError("");
      } else {
        setError(data.error || `Failed to fetch emails (HTTP ${res.status}).`);
      }
    } catch {
      setError("Failed to fetch email history.");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter !== "all" && item.status !== filter) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.to.toLowerCase().includes(q) ||
      item.subject.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q) ||
      (item.error || "").toLowerCase().includes(q)
    );
  });

  const getTableTitle = () => {
    if (filter === "all") return "All Emails";
    if (filter === "sent") return "Sent Emails";
    if (filter === "failed") return "Failed Emails";
    return "Emails";
  };

  const columns: AdminTableColumn<EmailItem>[] = [
    {
      key: "subject",
      header: "Subject",
      render: (item) => (
        <span className="block max-w-[200px] truncate font-medium text-slate-200 md:max-w-[280px]" title={item.subject}>
          {item.subject}
        </span>
      ),
    },
    {
      key: "to",
      header: "Recipient",
      className: "min-w-[180px] max-w-[280px]",
      render: (item) => (
        <span className="block truncate font-mono text-sm text-slate-400" title={item.to}>
          {item.to}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (item) => (
        <span className="whitespace-nowrap capitalize text-xs font-bold uppercase tracking-wider text-cyan-400/90">
          {formatEmailType(item.type)}
        </span>
      ),
    },
    {
      key: "date",
      header: "Sent",
      mobileLabel: "Sent at",
      render: (item) => (
        <span className="whitespace-nowrap text-slate-400">
          {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <EmailStatus status={item.status} />,
    },
    {
      key: "error",
      header: "Error",
      hideOnMobile: true,
      render: (item) =>
        item.error ? (
          <span className="block max-w-[220px] truncate text-xs text-rose-400" title={item.error}>
            {item.error}
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
  ];

  if (loading) {
    return <AdminLoadingState label="Loading email history..." />;
  }

  return (
    <AdminPageLayout
      scrollContent={false}
      header={
        <AdminPageHeader
          title="Email History"
          description="View emails sent to clients from the system."
          actions={
            <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
              <AdminFilterPills options={FILTERS} value={filter} onChange={setFilter} />
            </div>
          }
        />
      }
    >
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
          <AlertCircle size={20} className="shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <AdminDataTable
        title={getTableTitle()}
        count={filteredItems.length}
        columns={columns}
        data={filteredItems}
        rowKey={(item) => item.id}
        emptyState={<EmptyEmails />}
        renderMobileCard={(item) => (
          <EmailMobileCard
            item={item}
            statusBadge={<EmailStatus status={item.status} />}
            formatType={formatEmailType}
          />
        )}
        headerActions={
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search emails..."
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
