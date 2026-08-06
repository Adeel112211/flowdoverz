"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ImageIcon,
  X,
} from "lucide-react";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin-data-table";
import { AdminFilterPills } from "@/components/admin-filter-pills";
import { AdminPageHeader } from "@/components/admin-page-header";

type Payment = {
  id: string;
  userEmail: string;
  planId: string;
  transactionId: string;
  status: "pending" | "approved" | "rejected" | "refunded";
  createdAt: string;
  processedAt?: string;
  screenshot?: string;
  hasScreenshot?: boolean;
};

const FILTERS = ["all", "pending", "approved", "rejected", "refunded"] as const;
type Filter = (typeof FILTERS)[number];

function PaymentStatus({ status }: { status: Payment["status"] }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full text-xs font-semibold">
        <Clock size={12} /> Pending
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full text-xs font-semibold">
        <CheckCircle2 size={12} /> Approved
      </span>
    );
  }
  if (status === "refunded") {
    return (
      <span className="inline-flex items-center gap-1.5 text-slate-400 bg-slate-400/10 px-2.5 py-1 rounded-full text-xs font-semibold">
        <AlertCircle size={12} /> Refunded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full text-xs font-semibold">
      <XCircle size={12} /> Rejected
    </span>
  );
}

function PlanBadge({ planId }: { planId: string }) {
  const normalized = (planId || "").toLowerCase();
  
  let label = planId;
  let bgClass = "bg-white/5";
  let borderClass = "border-white/10";
  let textClass = "text-slate-300";

  // Trial / Free
  if (normalized.includes("trial") || normalized === "free") {
    label = "Trial";
    bgClass = "bg-slate-500/10";
    borderClass = "border-slate-500/20";
    textClass = "text-slate-300";
  } 
  // Solo / Nano / Studio
  else if (normalized.includes("solo") || normalized === "nano" || normalized === "studio") {
    label = "Solo";
    bgClass = "bg-cyan-500/10";
    borderClass = "border-cyan-500/20";
    textClass = "text-cyan-400";
  } 
  // Team
  else if (normalized.includes("ultra") || normalized === "team") {
    label = "Team";
    bgClass = "bg-violet-500/10";
    borderClass = "border-violet-500/20";
    textClass = "text-violet-400";
  }

  return (
    <span className={`inline-flex px-2.5 py-1 rounded-md border text-xs font-bold uppercase tracking-wider ${bgClass} ${borderClass} ${textClass}`}>
      {label}
    </span>
  );
}

function EmptyPayments() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center">
      <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4 border border-cyan-500/20">
        <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-xl sm:text-2xl font-black text-slate-200">No manual payments</h3>
      <p className="text-sm text-slate-400 max-w-sm">
        There are currently no manual payments to review.
      </p>
    </div>
  );
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const filteredPayments = payments.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  const getTableTitle = () => {
    if (filter === "all") return "All Payments";
    if (filter === "pending") return "Pending Payments";
    if (filter === "approved") return "Approved Payments";
    if (filter === "rejected") return "Rejected Payments";
    if (filter === "refunded") return "Refunded Payments";
    return "Payments";
  };

  const fetchPayments = async () => {
    try {
      const res = await fetch("/api/admin/payments", { credentials: "same-origin" });
      let data: { success?: boolean; payments?: Payment[]; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        setError(`Failed to fetch payments (HTTP ${res.status}).`);
        return;
      }
      if (data.success && data.payments) {
        setPayments(data.payments);
        setError("");
      } else {
        setError(data.error || `Failed to fetch payments (HTTP ${res.status}).`);
      }
    } catch {
      setError("Failed to fetch payments. Check your connection and redeploy.");
    } finally {
      setLoading(false);
    }
  };

  const openScreenshot = async (payment: Payment) => {
    if (payment.screenshot) {
      setSelectedScreenshot(payment.screenshot);
      return;
    }
    if (!payment.hasScreenshot) return;

    try {
      const res = await fetch(`/api/admin/payments?id=${encodeURIComponent(payment.id)}`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.success && data.payment?.screenshot) {
        setSelectedScreenshot(data.payment.screenshot);
        setPayments((current) =>
          current.map((row) =>
            row.id === payment.id
              ? { ...row, screenshot: data.payment.screenshot }
              : row,
          ),
        );
      } else {
        setError(data.error || "Could not load payment screenshot.");
      }
    } catch {
      setError("Could not load payment screenshot.");
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleAction = async (paymentId: string, action: "approve" | "reject" | "refund") => {
    if (!confirm(`Are you sure you want to ${action} this payment?`)) return;

    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, action }),
      });
      const data = await res.json();

      if (data.success) {
        alert(`Payment ${action}d successfully`);
        fetchPayments();
      } else {
        alert(data.error || "Something went wrong");
      }
    } catch {
      alert("Failed to process payment");
    }
  };



  const renderActions = (payment: Payment) => {
    if (payment.status === "pending") {
      return (
        <>
          <button
            type="button"
            onClick={() => handleAction(payment.id, "approve")}
            className="flex-1 sm:flex-none px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition-colors"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => handleAction(payment.id, "reject")}
            className="flex-1 sm:flex-none px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition-colors"
          >
            Reject
          </button>
        </>
      );
    }

    if (payment.status === "approved") {
      return (
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-xs hidden md:inline">
            Processed on {new Date(payment.processedAt!).toLocaleDateString()}
          </span>
          <button
            type="button"
            onClick={() => handleAction(payment.id, "refund")}
            className="px-3 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/20 rounded-lg text-xs font-bold transition-colors"
          >
            Refund
          </button>
        </div>
      );
    }

    return (
      <span className="text-slate-500 text-xs">
        Processed on {new Date(payment.processedAt!).toLocaleDateString()}
      </span>
    );
  };

  const columns: AdminTableColumn<Payment>[] = [
    {
      key: "date",
      header: "Date",
      render: (payment) => (
        <span className="text-slate-400 whitespace-nowrap">
          {new Date(payment.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "user",
      header: "User",
      className: "w-full",
      render: (payment) => (
        <span className="text-white font-medium block truncate max-w-[200px] md:max-w-[300px]" title={payment.userEmail}>{payment.userEmail}</span>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      render: (payment) => <PlanBadge planId={payment.planId} />,
    },
    {
      key: "account",
      header: "Account Number",
      mobileLabel: "Account",
      render: (payment) => (
        <span className="font-mono break-all text-slate-300">{payment.transactionId}</span>
      ),
    },
    {
      key: "image",
      header: "Image",
      mobileLabel: "Image",
      className: "text-center",
      headerClassName: "text-center",
      render: (payment) => 
        payment.screenshot || payment.hasScreenshot ? (
          <button
            type="button"
            onClick={() => openScreenshot(payment)}
            className="text-cyan-400 hover:text-cyan-300 transition-colors p-1.5 bg-cyan-400/10 hover:bg-cyan-400/20 rounded-md inline-flex items-center justify-center"
            title="View Screenshot"
          >
            <ImageIcon size={16} />
          </button>
        ) : (
          <span className="text-slate-600">-</span>
        )
      ,
    },
    {
      key: "status",
      header: "Status",
      render: (payment) => <PaymentStatus status={payment.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      headerClassName: "text-right",
      className: "text-right",
      hideOnMobile: true,
      render: (payment) => (
        <div className="flex justify-end gap-2 md:gap-3">{renderActions(payment)}</div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
        <span className="text-sm font-bold tracking-widest text-cyan-400 uppercase animate-pulse">Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0 min-w-0 max-w-full overflow-x-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      <AdminPageHeader
        title="Manual Payments"
        description="Approve or reject payments made via JazzCash, EasyPaisa, or Bank Transfer."
        actions={
          <AdminFilterPills options={FILTERS} value={filter} onChange={setFilter} />
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <AdminDataTable
        title={getTableTitle()}
        count={filteredPayments.length}
        columns={columns}
        data={filteredPayments}
        rowKey={(payment) => payment.id}
        emptyState={<EmptyPayments />}
        renderMobileActions={renderActions}
      />

      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-4 right-4 z-10">
              <button
                type="button"
                onClick={() => setSelectedScreenshot(null)}
                className="p-2 bg-black/50 hover:bg-red-500/80 text-white rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <img
              src={selectedScreenshot}
              alt="Payment Screenshot"
              className="w-full h-full object-contain bg-[#080810]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
