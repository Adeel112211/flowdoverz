"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Receipt,
  RotateCcw,
  Search,
} from "lucide-react";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin-data-table";
import { AdminFilterPills } from "@/components/admin-filter-pills";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { PlanAmount, PlanBadge } from "@/components/plan-badge";
import { ReceiptPreviewModal } from "@/components/receipt-preview-modal";
import { ReceiptMobileCard } from "@/components/admin-mobile-cards";
import type { PurchaseRecord } from "@/lib/client-receipts";

const FILTERS = ["all", "approved", "refunded"] as const;
type Filter = (typeof FILTERS)[number];

function PurchaseStatus({ status }: { status: PurchaseRecord["status"] }) {
  if (status === "refunded") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-400/10 px-2.5 py-1 text-xs font-semibold text-slate-400">
        <RotateCcw size={12} /> Refunded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
      <CheckCircle2 size={12} /> Approved
    </span>
  );
}

function EmptyReceipts() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10">
        <Receipt className="h-8 w-8 text-cyan-400" />
      </div>
      <h3 className="text-xl sm:text-2xl font-black text-slate-200">No receipts yet</h3>
      <p className="max-w-sm text-sm text-slate-400">
        Receipts appear here after payments are approved on the Manual Payments page.
      </p>
    </div>
  );
}

export default function AdminReceiptsPage() {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewPurchase, setPreviewPurchase] = useState<PurchaseRecord | null>(null);

  useEffect(() => {
    fetch("/api/admin/receipts", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.purchases)) {
          setPurchases(data.purchases);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.email.toLowerCase().includes(q) ||
        p.userName.toLowerCase().includes(q) ||
        p.receiptNumber.toLowerCase().includes(q) ||
        (p.refundReceiptNumber || "").toLowerCase().includes(q) ||
        p.accountNumber.toLowerCase().includes(q)
      );
    });
  }, [purchases, filter, searchQuery]);

  const getTableTitle = () => {
    if (filter === "all") return "All Receipts";
    if (filter === "approved") return "Approved Receipts";
    if (filter === "refunded") return "Refunded Receipts";
    return "Receipts";
  };

  const renderViewReceipt = (p: PurchaseRecord) => (
    <button
      type="button"
      onClick={() => setPreviewPurchase(p)}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-cyan-500/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-400 transition-colors hover:bg-cyan-400/20 hover:text-cyan-300"
    >
      <Eye size={14} /> View Receipt
    </button>
  );

  const columns: AdminTableColumn<PurchaseRecord>[] = [
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <span
          className="block max-w-[150px] truncate font-medium text-slate-200 md:max-w-[200px]"
          title={p.userName}
        >
          {p.userName || "N/A"}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      className: "min-w-[180px] max-w-[280px]",
      render: (p) => (
        <span className="block max-w-[200px] truncate text-slate-400 md:max-w-[300px]" title={p.email}>
          {p.email}
        </span>
      ),
    },
    {
      key: "date",
      header: "Paid on",
      render: (p) => (
        <span className="whitespace-nowrap text-slate-400">{p.paymentDateLabel}</span>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      render: (p) => <PlanBadge planId={p.planId} />,
    },
    {
      key: "amount",
      header: "Amount",
      render: (p) => <PlanAmount planId={p.planId} amount={p.amountLabel} />,
    },
    {
      key: "receipt",
      header: "Receipt #",
      mobileLabel: "Receipt",
      hideOnMobile: true,
      render: (p) => (
        <span className="whitespace-nowrap font-mono text-slate-300">{p.receiptNumber}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <PurchaseStatus status={p.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      headerClassName: "text-right",
      className: "text-right",
      hideOnMobile: true,
      render: (p) => (
        <div className="flex justify-end gap-2 md:gap-3">{renderViewReceipt(p)}</div>
      ),
    },
  ];

  if (loading) {
    return <AdminLoadingState />;
  }

  return (
    <AdminPageLayout
      scrollContent={false}
      header={
        <AdminPageHeader
          title="Client Receipts"
          description="Each row is one purchase. Open a receipt to view or download payment and refund copies."
          actions={
            <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
              <AdminFilterPills
                options={FILTERS}
                value={filter}
                onChange={setFilter}
                formatLabel={(f) => (f === "approved" ? "Approved" : f.charAt(0).toUpperCase() + f.slice(1))}
              />
            </div>
          }
        />
      }
    >

      <AdminDataTable
        title={getTableTitle()}
        count={filteredPurchases.length}
        columns={columns}
        data={filteredPurchases}
        rowKey={(p) => p.paymentId}
        emptyState={<EmptyReceipts />}
        renderMobileActions={renderViewReceipt}
        renderMobileCard={(p) => (
          <ReceiptMobileCard
            purchase={{
              paymentId: p.paymentId,
              userName: p.userName,
              email: p.email,
              planId: p.planId,
              amountLabel: p.amountLabel,
              paymentDateLabel: p.paymentDateLabel,
              receiptNumber: p.receiptNumber,
              status: p.status,
            }}
            statusBadge={<PurchaseStatus status={p.status} />}
            planBadge={<PlanBadge planId={p.planId} />}
            amountLabel={<PlanAmount planId={p.planId} amount={p.amountLabel} />}
            onView={() => setPreviewPurchase(p)}
          />
        )}
        headerActions={
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search receipts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900/50 py-2 pl-9 pr-4 text-sm text-slate-200 placeholder:text-slate-500 transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
          </div>
        }
      />

      <ReceiptPreviewModal
        open={Boolean(previewPurchase)}
        onClose={() => setPreviewPurchase(null)}
        purchase={previewPurchase}
        variant="admin"
      />
    </AdminPageLayout>
  );
}
