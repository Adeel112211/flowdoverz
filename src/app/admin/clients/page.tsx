"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  ImageIcon,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin-data-table";
import { AdminFilterPills } from "@/components/admin-filter-pills";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPlanSelect, normalizePlanValue } from "@/components/admin-plan-select";
import { AdminDateTimeInput } from "@/components/admin-datetime-input";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { AdminGlassModal, AdminGlassPanel } from "@/components/admin-glass-modal";
import { useAdminToast } from "@/components/admin-toast";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { ClientMobileCard } from "@/components/admin-mobile-cards";

type Client = {
  email: string;
  name?: string;
  subscriptionPlan?: string;
  trialExpiresAt?: string;
  subscriptionExpiresAt?: string;
  createdAt?: string;
  suspended?: boolean;
  adminNotes?: string;
  assignedSlot?: string;
  lastSyncAt?: string;
};

type ClientPayment = {
  id: string;
  userEmail: string;
  planId: string;
  transactionId: string;
  status: "pending" | "approved" | "rejected" | "refunded";
  createdAt: string;
  processedAt?: string;
  hasScreenshot?: boolean;
};

const FILTERS = ["all", "pending", "paid", "trial", "suspended"] as const;
type Filter = (typeof FILTERS)[number];

const PAID_PLANS = ["solo", "team"];

type NewClientForm = {
  email: string;
  name: string;
  password: string;
  subscriptionPlan: string;
  trialExpiresAt: string;
  subscriptionExpiresAt: string;
};

function defaultExpiryForPlan(plan: string) {
  const now = Date.now();
  if (PAID_PLANS.includes(plan)) {
    return {
      trialExpiresAt: new Date(now).toISOString(),
      subscriptionExpiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  return {
    trialExpiresAt: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
    subscriptionExpiresAt: "",
  };
}

function emptyNewClient(): NewClientForm {
  const defaults = defaultExpiryForPlan("trial");
  return {
    email: "",
    name: "",
    password: "",
    subscriptionPlan: "trial",
    trialExpiresAt: defaults.trialExpiresAt,
    subscriptionExpiresAt: defaults.subscriptionExpiresAt,
  };
}

function ActionIconButton({
  label,
  icon: Icon,
  onClick,
  bgClass,
  colorClass,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  bgClass: string;
  colorClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`shrink-0 rounded-lg p-2 transition-colors hover:brightness-125 ${bgClass} ${colorClass}`}
    >
      <Icon size={16} strokeWidth={2.25} />
    </button>
  );
}

function PaymentStatusBadge({ status }: { status: ClientPayment["status"] }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-400">
        <Clock size={12} /> Pending
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
        <CheckCircle2 size={12} /> Approved
      </span>
    );
  }
  if (status === "refunded") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-400/10 px-2.5 py-1 text-xs font-semibold text-slate-400">
        <AlertCircle size={12} /> Refunded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-400">
      <XCircle size={12} /> Rejected
    </span>
  );
}

function EmptyClients() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center">
      <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4 border border-cyan-500/20">
        <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      </div>
      <h3 className="text-xl sm:text-2xl font-black text-slate-200">No clients registered</h3>
      <p className="text-sm text-slate-400 max-w-sm">
        There are currently no clients matching this category.
      </p>
    </div>
  );
}

export default function ClientsPage() {
  const { toast } = useAdminToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [newClient, setNewClient] = useState<NewClientForm>(emptyNewClient);
  const [passwordClient, setPasswordClient] = useState<Client | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [paymentScreenshot, setPaymentScreenshot] = useState<string | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/admin/clients", { credentials: "same-origin" });
      const raw = await res.text();
      let data: { success?: boolean; clients?: Client[]; error?: string } = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setError(raw.trim().slice(0, 180) || `Failed to fetch clients (HTTP ${res.status}).`);
        return;
      }

      if (data.success && data.clients) {
        setClients(data.clients);
        setError("");
      } else {
        setError(data.error || `Failed to fetch clients (HTTP ${res.status}).`);
      }
    } catch {
      setError("Failed to fetch clients. Check Firebase env vars on Vercel.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      const res = await fetch("/api/admin/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const data = await res.json();
      if (data.success) {
        toast("Client updated");
        setEditing(null);
        fetchClients();
      } else {
        toast(data.error || "Update failed", "error");
      }
    } catch {
      toast("Error updating client", "error");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      });
      const data = await res.json();
      if (data.success) {
        alert("Client created successfully");
        setCreating(false);
        setNewClient(emptyNewClient());
        fetchClients();
      } else {
        alert("Create failed: " + data.error);
      }
    } catch {
      alert("Error creating client");
    }
  };

  const handlePlanChange = (plan: string, target: "edit" | "create") => {
    const defaults = defaultExpiryForPlan(plan);
    if (target === "edit" && editing) {
      setEditing({
        ...editing,
        subscriptionPlan: plan,
        trialExpiresAt: defaults.trialExpiresAt,
        subscriptionExpiresAt: defaults.subscriptionExpiresAt || editing.subscriptionExpiresAt,
      });
      return;
    }
    setNewClient({
      ...newClient,
      subscriptionPlan: plan,
      trialExpiresAt: defaults.trialExpiresAt,
      subscriptionExpiresAt: defaults.subscriptionExpiresAt,
    });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordClient) return;

    if (newPassword.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    try {
      const res = await fetch("/api/admin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: passwordClient.email,
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Password updated successfully");
        setPasswordClient(null);
        setNewPassword("");
        setConfirmPassword("");
        setShowNewPassword(false);
        setShowConfirmPassword(false);
      } else {
        alert("Password update failed: " + data.error);
      }
    } catch {
      alert("Error updating password");
    }
  };

  const openPasswordModal = (client: Client) => {
    setPasswordClient(client);
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const openPaymentModal = async (client: Client) => {
    setPaymentClient(client);
    setClientPayments([]);
    setPaymentsError("");
    setPaymentScreenshot(null);
    setPaymentsLoading(true);

    try {
      const res = await fetch(
        `/api/admin/payments?email=${encodeURIComponent(client.email)}`,
        { credentials: "same-origin" },
      );
      const raw = await res.text();
      let data: { success?: boolean; payments?: ClientPayment[]; error?: string } = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setPaymentsError(raw.trim().slice(0, 180) || "Failed to load payments.");
        return;
      }

      if (data.success && data.payments) {
        setClientPayments(data.payments);
      } else {
        setPaymentsError(data.error || "Failed to load payments.");
      }
    } catch {
      setPaymentsError("Failed to load payments.");
    } finally {
      setPaymentsLoading(false);
    }
  };

  const loadPaymentScreenshot = async (payment: ClientPayment) => {
    if (!payment.hasScreenshot) return;

    try {
      const res = await fetch(`/api/admin/payments?id=${encodeURIComponent(payment.id)}`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.success && data.payment?.screenshot) {
        setPaymentScreenshot(String(data.payment.screenshot));
      } else {
        alert(data.error || "Could not load payment screenshot.");
      }
    } catch {
      alert("Could not load payment screenshot.");
    }
  };

  const confirmDeleteClient = async () => {
    if (!deleteClient) return;

    setDeletingClient(true);
    try {
      const res = await fetch(
        `/api/admin/clients?email=${encodeURIComponent(deleteClient.email)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (data.success) {
        setDeleteClient(null);
        fetchClients();
      } else {
        alert("Delete failed: " + data.error);
      }
    } catch {
      alert("Error deleting client");
    } finally {
      setDeletingClient(false);
    }
  };

  if (loading) {
    return <AdminLoadingState />;
  }

  const filteredClients = clients.filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.email.toLowerCase().includes(q)) return false;
    }

    if (filter === "all") return true;
    if (filter === "pending") return c.subscriptionPlan === "pending";
    if (filter === "paid") {
      return c.subscriptionPlan && !["none", "trial", "pending"].includes(c.subscriptionPlan);
    }
    if (filter === "trial") {
      return !c.subscriptionPlan || c.subscriptionPlan === "none" || c.subscriptionPlan === "trial";
    }
    if (filter === "suspended") return Boolean(c.suspended);
    return true;
  });

  const getTableTitle = () => {
    if (filter === "all") return "All Clients";
    if (filter === "pending") return "Pending Approvals";
    if (filter === "paid") return "Paid Accounts";
    if (filter === "trial") return "Trial Accounts";
    if (filter === "suspended") return "Suspended Clients";
    return "Clients";
  };

  const renderActions = (client: Client) => (
    <div className="inline-flex flex-nowrap items-center justify-end gap-1.5 shrink-0">
      <ActionIconButton
        label="Edit client"
        icon={Pencil}
        onClick={() =>
          setEditing({
            ...client,
            subscriptionPlan: normalizePlanValue(client.subscriptionPlan),
          })
        }
        bgClass="bg-cyan-500/10 hover:bg-cyan-500/20"
        colorClass="text-cyan-400"
      />
      <ActionIconButton
        label="Change password"
        icon={KeyRound}
        onClick={() => openPasswordModal(client)}
        bgClass="bg-violet-500/10 hover:bg-violet-500/20"
        colorClass="text-violet-400"
      />
      <ActionIconButton
        label="View payments"
        icon={CreditCard}
        onClick={() => openPaymentModal(client)}
        bgClass="bg-emerald-500/10 hover:bg-emerald-500/20"
        colorClass="text-emerald-400"
      />
      <ActionIconButton
        label="Delete client"
        icon={Trash2}
        onClick={() => setDeleteClient(client)}
        bgClass="bg-rose-500/10 hover:bg-rose-500/20"
        colorClass="text-rose-400"
      />
    </div>
  );

  const columns: AdminTableColumn<Client>[] = [
    {
      key: "name",
      header: "Name",
      render: (client) => (
        <Link
          href={`/admin/clients/${encodeURIComponent(client.email)}`}
          className="font-medium text-cyan-400 hover:underline block truncate max-w-[150px] md:max-w-[200px]"
          title={client.name}
        >
          {client.name || "N/A"}
        </Link>
      ),
    },
    {
      key: "email",
      header: "Email",
      className: "min-w-[180px] max-w-[280px]",
      render: (client) => (
        <Link
          href={`/admin/clients/${encodeURIComponent(client.email)}`}
          className="text-slate-400 hover:text-cyan-400 block truncate max-w-[200px] md:max-w-[300px]"
          title={client.email}
        >
          {client.email}
        </Link>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      mobileLabel: "Joined",
      render: (client) => (
        <span className="whitespace-nowrap text-slate-400 font-medium">
          {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : "N/A"}
        </span>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      className: "uppercase font-bold text-xs tracking-wider",
      render: (client) => {
        const plan = normalizePlanValue(client.subscriptionPlan);
        return plan;
      },
    },
    {
      key: "trial",
      header: "Trial Expiry",
      render: (client) => (
        <span className="whitespace-nowrap text-rose-400 font-medium">
          {client.trialExpiresAt ? new Date(client.trialExpiresAt).toLocaleDateString() : "N/A"}
        </span>
      ),
    },
    {
      key: "sub",
      header: "Plan Expiry",
      render: (client) => (
        <span className="whitespace-nowrap text-rose-400 font-medium">
          {client.subscriptionExpiresAt
            ? new Date(client.subscriptionExpiresAt).toLocaleDateString()
            : "N/A"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      headerClassName: "text-right",
      className: "text-right whitespace-nowrap w-[1%]",
      hideOnMobile: true,
      render: (client) => renderActions(client),
    },
  ];

  return (
    <AdminPageLayout
      scrollContent={false}
      header={
        <AdminPageHeader
          title="Client Manager"
          description="Manage all of your active, pending, and trial client accounts."
          actions={
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setNewClient(emptyNewClient());
                  setCreating(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_20px_rgba(34,211,238,0.5)]"
              >
                <Plus size={16} />
                Add Client
              </button>
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
        count={filteredClients.length}
        columns={columns}
        data={filteredClients}
        rowKey={(client) => client.email}
        emptyState={<EmptyClients />}
        renderMobileActions={renderActions}
        renderMobileCard={(client) => (
          <ClientMobileCard
            client={client}
            onEdit={() =>
              setEditing({
                ...client,
                subscriptionPlan: normalizePlanValue(client.subscriptionPlan),
              })
            }
            onPassword={() => openPasswordModal(client)}
            onPayments={() => openPaymentModal(client)}
            onDelete={() => setDeleteClient(client)}
          />
        )}
        headerActions={
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
            />
          </div>
        }
      />

      {deleteClient && (
        <AdminGlassModal open={Boolean(deleteClient)} maxWidth="md">
          <AdminGlassPanel accent="rose">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/25 backdrop-blur-sm">
                <Trash2 className="h-7 w-7 text-rose-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Delete Client?</h2>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Are you sure you want to completely delete the account for
              </p>
              <p className="mt-2 text-sm font-semibold text-white break-all">{deleteClient.email}</p>
              <p className="mt-3 text-sm text-rose-300/90">This action cannot be undone.</p>

              <div className="mt-8 flex w-full flex-col-reverse sm:flex-row gap-3">
                <button
                  type="button"
                  disabled={deletingClient}
                  onClick={() => setDeleteClient(null)}
                  className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-bold text-slate-300 backdrop-blur-sm transition-all hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingClient}
                  onClick={confirmDeleteClient}
                  className="flex-1 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-3 text-sm font-bold text-white transition-all shadow-[0_0_20px_rgba(244,63,94,0.35)] hover:shadow-[0_0_28px_rgba(244,63,94,0.5)] disabled:opacity-60"
                >
                  {deletingClient ? "Deleting..." : "Delete Client"}
                </button>
              </div>
            </div>
          </AdminGlassPanel>
        </AdminGlassModal>
      )}

      {creating && (
        <AdminGlassModal open={creating} align="end" scrollable onClose={() => setCreating(false)} closeOnBackdrop>
          <AdminGlassPanel accent="emerald">
            <h2 className="mb-6 text-xl sm:text-2xl font-black text-white relative z-10">
              Add New Client
            </h2>
            <form onSubmit={handleCreate} className="space-y-4 relative z-10">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Email</label>
                <input
                  type="email"
                  required
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Full Name</label>
                <input
                  type="text"
                  required
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  placeholder="Client name"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newClient.password}
                  onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Plan</label>
                <AdminPlanSelect
                  value={newClient.subscriptionPlan}
                  onChange={(plan) => handlePlanChange(plan, "create")}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Trial Expiry</label>
                <AdminDateTimeInput
                  value={newClient.trialExpiresAt}
                  onChange={(trialExpiresAt) => setNewClient({ ...newClient, trialExpiresAt })}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Subscription Expiry</label>
                <AdminDateTimeInput
                  value={newClient.subscriptionExpiresAt}
                  onChange={(subscriptionExpiresAt) =>
                    setNewClient({ ...newClient, subscriptionExpiresAt })
                  }
                  disabled={!PAID_PLANS.includes(newClient.subscriptionPlan)}
                />
              </div>

              <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setNewClient(emptyNewClient());
                  }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300 transition-all hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_20px_rgba(34,211,238,0.5)]"
                >
                  Create Client
                </button>
              </div>
            </form>
          </AdminGlassPanel>
        </AdminGlassModal>
      )}

      {passwordClient && (
        <AdminGlassModal
          open={Boolean(passwordClient)}
          align="end"
          scrollable
          onClose={() => setPasswordClient(null)}
          closeOnBackdrop
        >
          <AdminGlassPanel accent="violet">
            <h2 className="mb-2 text-xl sm:text-2xl font-black text-white relative z-10">
              Change Password
            </h2>
            <p className="mb-6 text-sm text-slate-400 relative z-10 break-all">
              Set a new login password for {passwordClient.email}
            </p>
            <form onSubmit={handlePasswordChange} className="space-y-4 relative z-10">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 pr-11 text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-300"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 pr-11 text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-300"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordClient(null);
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300 transition-all hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-gradient-to-r from-violet-400 to-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_20px_rgba(139,92,246,0.5)]"
                >
                  Update Password
                </button>
              </div>
            </form>
          </AdminGlassPanel>
        </AdminGlassModal>
      )}

      {paymentClient && (
        <AdminGlassModal
          open={Boolean(paymentClient)}
          maxWidth="2xl"
          align="end"
          scrollable
          onClose={() => {
            setPaymentClient(null);
            setClientPayments([]);
            setPaymentsError("");
            setPaymentScreenshot(null);
          }}
          closeOnBackdrop
        >
          <AdminGlassPanel accent="emerald">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black text-white">Payment Details</h2>
                <p className="mt-1 text-sm text-slate-400 break-all">{paymentClient.email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPaymentClient(null);
                  setClientPayments([]);
                  setPaymentsError("");
                  setPaymentScreenshot(null);
                }}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Close payment details"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative z-10 space-y-4">
              {paymentsLoading && (
                <div className="flex items-center justify-center py-10">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500/20 border-t-emerald-400" />
                </div>
              )}

              {!paymentsLoading && paymentsError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                  {paymentsError}
                </div>
              )}

              {!paymentsLoading && !paymentsError && clientPayments.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
                  <CreditCard className="mx-auto mb-3 h-8 w-8 text-slate-500" />
                  <p className="font-semibold text-slate-300">No payments found</p>
                  <p className="mt-1 text-sm text-slate-500">This client has not submitted any manual payments yet.</p>
                </div>
              )}

              {!paymentsLoading &&
                clientPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-2xl border border-white/10 bg-[#080810]/80 p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <PaymentStatusBadge status={payment.status} />
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                        {normalizePlanValue(payment.planId)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Transaction ID</p>
                        <p className="mt-1 font-mono text-slate-200 break-all">{payment.transactionId || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Submitted</p>
                        <p className="mt-1 text-slate-200">
                          {payment.createdAt ? new Date(payment.createdAt).toLocaleString() : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Processed</p>
                        <p className="mt-1 text-slate-200">
                          {payment.processedAt ? new Date(payment.processedAt).toLocaleString() : "Not processed"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Amount</p>
                        <p className="mt-1 font-semibold text-emerald-400">
                          {payment.planId === "team" ? "1,999 PKR" : payment.planId === "solo" ? "999 PKR" : "—"}
                        </p>
                      </div>
                    </div>

                    {payment.hasScreenshot && (
                      <button
                        type="button"
                        onClick={() => loadPaymentScreenshot(payment)}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-500/20"
                      >
                        <ImageIcon size={14} />
                        View Screenshot
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </AdminGlassPanel>
        </AdminGlassModal>
      )}

      {paymentScreenshot && (
        <AdminGlassModal
          open={Boolean(paymentScreenshot)}
          maxWidth="lg"
          zIndexClass="z-[80]"
          onClose={() => setPaymentScreenshot(null)}
          closeOnBackdrop
        >
          <AdminGlassPanel accent="slate" className="p-3 sm:p-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setPaymentScreenshot(null)}
                className="absolute -top-2 -right-2 z-10 rounded-full border border-white/10 bg-black/60 p-2 text-white backdrop-blur-md hover:bg-black/80"
                aria-label="Close screenshot"
              >
                <X size={18} />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={paymentScreenshot}
                alt="Payment screenshot"
                className="max-h-[85dvh] w-full rounded-2xl border border-white/10 object-contain bg-black/40"
              />
            </div>
          </AdminGlassPanel>
        </AdminGlassModal>
      )}

      {editing && (
        <AdminGlassModal
          open={Boolean(editing)}
          align="end"
          onClose={() => setEditing(null)}
          closeOnBackdrop
        >
          <AdminGlassPanel accent="cyan">
            <h2 className="mb-6 text-xl sm:text-2xl font-black text-white">
              Edit Client
            </h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Email</label>
                <input
                  type="text"
                  value={editing.email}
                  disabled
                  className="w-full rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-slate-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Name</label>
                <input
                  type="text"
                  value={editing.name || ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-slate-200 outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Plan</label>
                <AdminPlanSelect
                  value={editing.subscriptionPlan || "trial"}
                  onChange={(plan) => handlePlanChange(plan, "edit")}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">
                  Trial Expiry
                </label>
                <AdminDateTimeInput
                  value={editing.trialExpiresAt || ""}
                  onChange={(trialExpiresAt) => setEditing({ ...editing, trialExpiresAt })}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">
                  Subscription Expiry
                </label>
                <AdminDateTimeInput
                  value={editing.subscriptionExpiresAt || ""}
                  onChange={(subscriptionExpiresAt) =>
                    setEditing({ ...editing, subscriptionExpiresAt })
                  }
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Assigned Slot</label>
                <select
                  value={editing.assignedSlot || "C1"}
                  onChange={(e) => setEditing({ ...editing, assignedSlot: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-slate-200"
                >
                  {["C1", "C2", "C3", "C4", "C5"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Admin Notes</label>
                <textarea
                  value={editing.adminNotes || ""}
                  onChange={(e) => setEditing({ ...editing, adminNotes: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-slate-200 resize-none outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(editing.suspended)}
                  onChange={(e) => setEditing({ ...editing, suspended: e.target.checked })}
                />
                Suspended
              </label>

              <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300 transition-all hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_20px_rgba(34,211,238,0.5)]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </AdminGlassPanel>
        </AdminGlassModal>
      )}
    </AdminPageLayout>
  );
}
