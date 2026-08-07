"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ImageIcon,
  X,
  Search,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin-data-table";
import { AdminFilterPills } from "@/components/admin-filter-pills";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { AdminGlassModal, AdminGlassPanel } from "@/components/admin-glass-modal";
import { PlanBadge } from "@/components/plan-badge";
import { PayToMethodBadge } from "@/components/pay-to-method-badge";
import { PaymentMobileCard } from "@/components/admin-mobile-cards";
import { senderPaymentLabel } from "@/lib/sender-payment-options";
import { payToMethodDisplayLabel } from "@/lib/payment-methods-config";
import { useAdminLiveRefresh } from "@/hooks/use-admin-live-refresh";

type Payment = {
  id: string;
  userEmail: string;
  userName?: string | null;
  planId: string;
  transactionId: string;
  senderPaymentSource?: string;
  senderPaymentSourceLabel?: string;
  payToMethodId?: string;
  payToMethodLabel?: string;
  status: "pending" | "approved" | "rejected" | "refunded";
  createdAt: string;
  processedAt?: string;
  screenshot?: string;
  hasScreenshot?: boolean;
};

const FILTERS = ["all", "pending", "approved", "rejected", "refunded"] as const;
type Filter = (typeof FILTERS)[number];
type PaymentAction = "approve" | "reject" | "refund";

const PAYMENT_ACTION_CONFIG: Record<
  PaymentAction,
  {
    title: string;
    description: string;
    confirmLabel: string;
    processingLabel: string;
    icon: LucideIcon;
    iconWrapClass: string;
    iconClass: string;
    buttonClass: string;
  }
> = {
  approve: {
    title: "Approve Payment?",
    description: "This will activate the client's subscription plan.",
    confirmLabel: "Approve Payment",
    processingLabel: "Approving...",
    icon: CheckCircle2,
    iconWrapClass: "bg-emerald-500/10 ring-emerald-500/20",
    iconClass: "text-emerald-400",
    buttonClass: "from-emerald-500 to-green-500",
  },
  reject: {
    title: "Reject Payment?",
    description: "The client will be notified that their payment was rejected.",
    confirmLabel: "Reject Payment",
    processingLabel: "Rejecting...",
    icon: XCircle,
    iconWrapClass: "bg-rose-500/10 ring-rose-500/20",
    iconClass: "text-rose-400",
    buttonClass: "from-rose-500 to-red-500",
  },
  refund: {
    title: "Refund Payment?",
    description: "This will revoke the client's subscription access.",
    confirmLabel: "Refund Payment",
    processingLabel: "Refunding...",
    icon: RotateCcw,
    iconWrapClass: "bg-slate-500/10 ring-slate-500/20",
    iconClass: "text-slate-300",
    buttonClass: "from-slate-500 to-slate-600",
  },
};

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
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    payment: Payment;
    action: PaymentAction;
  } | null>(null);
  const [processingAction, setProcessingAction] = useState(false);
  const [actionError, setActionError] = useState("");

  const filteredPayments = payments.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesEmail = p.userEmail?.toLowerCase().includes(q);
      const matchesTransaction = p.transactionId?.toLowerCase().includes(q);
      const senderLabel = (p.senderPaymentSourceLabel || senderPaymentLabel(p.senderPaymentSource)).toLowerCase();
      const payToLabel = (payToMethodDisplayLabel(p.payToMethodId, p.payToMethodLabel) || "").toLowerCase();
      const matchesSender = senderLabel.includes(q);
      const matchesPayTo = payToLabel.includes(q);
      if (!matchesEmail && !matchesTransaction && !matchesSender && !matchesPayTo) return false;
    }

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

  const fetchPayments = useCallback(async (silent = false) => {
    try {
      const res = await fetch("/api/admin/payments", { credentials: "same-origin" });
      const raw = await res.text();
      let data: { success?: boolean; payments?: Payment[]; error?: string } = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        if (!silent) {
          const looksLikeHtml =
            raw.includes("__next_error__") || raw.trimStart().startsWith("<!DOCTYPE");
          setError(
            looksLikeHtml
              ? "Server error on Vercel. Check Firebase env vars in Project Settings, then redeploy."
              : raw.trim().slice(0, 180) || `Failed to fetch payments (HTTP ${res.status}).`,
          );
        }
        return;
      }

      if (data.success && data.payments) {
        setPayments(data.payments);
        setError("");
      } else if (!silent) {
        setError(data.error || `Failed to fetch payments (HTTP ${res.status}).`);
      }
    } catch {
      if (!silent) {
        setError("Failed to fetch payments. Check your connection and redeploy.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPayments(false);
  }, [fetchPayments]);

  useAdminLiveRefresh(() => fetchPayments(true), [fetchPayments]);

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

  const openActionConfirm = (payment: Payment, action: PaymentAction) => {
    setActionError("");
    setPendingAction({ payment, action });
  };

  const confirmPaymentAction = async () => {
    if (!pendingAction) return;

    setProcessingAction(true);
    setActionError("");

    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: pendingAction.payment.id,
          action: pendingAction.action,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setPendingAction(null);
        fetchPayments();
      } else {
        setActionError(data.error || "Something went wrong");
      }
    } catch {
      setActionError("Failed to process payment");
    } finally {
      setProcessingAction(false);
    }
  };



  const renderActions = (payment: Payment) => {
    if (payment.status === "pending") {
      return (
        <>
          <button
            type="button"
            onClick={() => openActionConfirm(payment, "approve")}
            className="flex-1 sm:flex-none px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition-colors"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => openActionConfirm(payment, "reject")}
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
          <span className="hidden md:inline-block text-right text-xs leading-tight text-slate-500">
            <span className="block whitespace-nowrap">Processed on</span>
            <span className="block whitespace-nowrap">
              {new Date(payment.processedAt!).toLocaleDateString()}
            </span>
          </span>
          <button
            type="button"
            onClick={() => openActionConfirm(payment, "refund")}
            className="px-3 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/20 rounded-lg text-xs font-bold transition-colors"
          >
            Refund
          </button>
        </div>
      );
    }

    return (
      <span className="inline-block text-right text-xs leading-tight text-slate-500">
        <span className="block whitespace-nowrap">Processed on</span>
        <span className="block whitespace-nowrap">
          {new Date(payment.processedAt!).toLocaleDateString()}
        </span>
      </span>
    );
  };

  const columns: AdminTableColumn<Payment>[] = [
    {
      key: "name",
      header: "Name",
      render: (payment) => (
        <span className="font-medium text-slate-200 block truncate max-w-[150px] md:max-w-[200px]" title={payment.userName || ""}>
          {payment.userName || "N/A"}
        </span>
      ),
    },
    {
      key: "user",
      header: "Email",
      className: "min-w-[180px] max-w-[280px]",
      render: (payment) => (
        <span className="text-slate-400 block truncate max-w-[200px] md:max-w-[300px]" title={payment.userEmail}>{payment.userEmail}</span>
      ),
    },
    {
      key: "date",
      header: "Submitted",
      mobileLabel: "Submitted",
      render: (payment) => (
        <span className="text-slate-400 whitespace-nowrap">
          {new Date(payment.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      render: (payment) => <PlanBadge planId={payment.planId} />,
    },
    {
      key: "sender",
      header: "Sent From",
      mobileLabel: "Sent from",
      render: (payment) => (
        <span className="text-slate-300 whitespace-nowrap">
          {payment.senderPaymentSourceLabel || senderPaymentLabel(payment.senderPaymentSource)}
        </span>
      ),
    },
    {
      key: "payTo",
      header: "Paid To",
      mobileLabel: "Paid to",
      render: (payment) => (
        <PayToMethodBadge
          methodId={payment.payToMethodId}
          label={payment.payToMethodLabel}
        />
      ),
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
    return <AdminLoadingState />;
  }

  return (
    <AdminPageLayout
      scrollContent={false}
      header={
        <AdminPageHeader
          title="Manual Payments"
          description="Approve or reject payments made via JazzCash, EasyPaisa, or NayaPay."
          actions={
            <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
              <AdminFilterPills options={FILTERS} value={filter} onChange={setFilter} />
            </div>
          }
        />
      }
    >

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
        renderMobileCard={(payment) => (
          <PaymentMobileCard
            payment={payment}
            statusBadge={<PaymentStatus status={payment.status} />}
            planBadge={<PlanBadge planId={payment.planId} />}
            onApprove={() => openActionConfirm(payment, "approve")}
            onReject={() => openActionConfirm(payment, "reject")}
            onRefund={() => openActionConfirm(payment, "refund")}
            onScreenshot={() => openScreenshot(payment)}
          />
        )}
        headerActions={
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search payments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
            />
          </div>
        }
      />

      {pendingAction && (() => {
        const config = PAYMENT_ACTION_CONFIG[pendingAction.action];
        const ActionIcon = config.icon;
        const accent =
          pendingAction.action === "approve"
            ? "emerald"
            : pendingAction.action === "reject"
              ? "rose"
              : "slate";

        return (
          <AdminGlassModal open={Boolean(pendingAction)} maxWidth="md">
            <AdminGlassPanel accent={accent} sheet>
              <div className="flex flex-col items-center text-center">
                <div
                  className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ring-1 backdrop-blur-sm ${config.iconWrapClass}`}
                >
                  <ActionIcon className={`h-7 w-7 ${config.iconClass}`} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">{config.title}</h2>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">{config.description}</p>
                <p className="mt-2 text-sm font-semibold text-white break-all">
                  {pendingAction.payment.userEmail}
                </p>
                <p className="mt-1 text-xs font-mono text-slate-500 break-all">
                  {pendingAction.payment.transactionId}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Sent from:{" "}
                  <span className="font-semibold text-slate-300">
                    {pendingAction.payment.senderPaymentSourceLabel ||
                      senderPaymentLabel(pendingAction.payment.senderPaymentSource)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Paid to:{" "}
                  <span className="inline-flex align-middle">
                    <PayToMethodBadge
                      methodId={pendingAction.payment.payToMethodId}
                      label={pendingAction.payment.payToMethodLabel}
                    />
                  </span>
                </p>

                {actionError && (
                  <div className="mt-4 w-full rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 backdrop-blur-sm">
                    {actionError}
                  </div>
                )}

                <div className="mt-8 flex w-full flex-col-reverse sm:flex-row gap-3">
                  <button
                    type="button"
                    disabled={processingAction}
                    onClick={() => {
                      setPendingAction(null);
                      setActionError("");
                    }}
                    className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-bold text-slate-300 backdrop-blur-sm transition-all hover:bg-white/10 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={processingAction}
                    onClick={confirmPaymentAction}
                    className={`flex-1 rounded-xl bg-gradient-to-r ${config.buttonClass} px-4 py-3 text-sm font-bold text-white transition-all disabled:opacity-60 shadow-[0_0_20px_rgba(255,255,255,0.08)]`}
                  >
                    {processingAction ? config.processingLabel : config.confirmLabel}
                  </button>
                </div>
              </div>
            </AdminGlassPanel>
          </AdminGlassModal>
        );
      })()}

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
    </AdminPageLayout>
  );
}
