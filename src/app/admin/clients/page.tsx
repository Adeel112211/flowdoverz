"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin-data-table";
import { AdminFilterPills } from "@/components/admin-filter-pills";
import { AdminPageHeader } from "@/components/admin-page-header";

type Client = {
  email: string;
  subscriptionPlan?: string;
  trialExpiresAt?: string;
  subscriptionExpiresAt?: string;
};

const FILTERS = ["all", "pending", "paid", "trial"] as const;
type Filter = (typeof FILTERS)[number];

const PLAN_OPTIONS = [
  { value: "trial", label: "Trial" },
  { value: "pending", label: "Pending" },
  { value: "solo", label: "Solo" },
  { value: "studio", label: "Studio" },
  { value: "team", label: "Team" },
] as const;

const PAID_PLANS = ["solo", "studio", "team"];

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
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [newClient, setNewClient] = useState<NewClientForm>(emptyNewClient);
  const [filter, setFilter] = useState<Filter>("all");

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
        alert("Client updated successfully");
        setEditing(null);
        fetchClients();
      } else {
        alert("Update failed: " + data.error);
      }
    } catch {
      alert("Error updating client");
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

  const handleDelete = async (email: string) => {
    if (
      !confirm(
        `Are you sure you want to completely delete the account for ${email}? This cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/clients?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        alert("Client deleted successfully");
        fetchClients();
      } else {
        alert("Delete failed: " + data.error);
      }
    } catch {
      alert("Error deleting client");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
        <span className="text-sm font-bold tracking-widest text-cyan-400 uppercase animate-pulse">Loading...</span>
      </div>
    );
  }

  const filteredClients = clients.filter((c) => {
    if (filter === "all") return true;
    if (filter === "pending") return c.subscriptionPlan === "pending";
    if (filter === "paid") {
      return c.subscriptionPlan && !["none", "trial", "pending"].includes(c.subscriptionPlan);
    }
    if (filter === "trial") {
      return !c.subscriptionPlan || c.subscriptionPlan === "none" || c.subscriptionPlan === "trial";
    }
    return true;
  });

  const getTableTitle = () => {
    if (filter === "all") return "All Clients";
    if (filter === "pending") return "Pending Approvals";
    if (filter === "paid") return "Paid Accounts";
    if (filter === "trial") return "Trial Accounts";
    return "Clients";
  };

  const renderActions = (client: Client) => (
    <>
      <button
        type="button"
        onClick={() => setEditing(client)}
        className="flex-1 sm:flex-none rounded-lg bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-400 transition-colors hover:bg-cyan-500/20"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => handleDelete(client.email)}
        className="flex-1 sm:flex-none rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-400 transition-colors hover:bg-rose-500/20"
      >
        Delete
      </button>
    </>
  );

  const columns: AdminTableColumn<Client>[] = [
    {
      key: "email",
      header: "Email",
      className: "w-full",
      render: (client) => (
        <span className="font-medium text-slate-200 block truncate max-w-[200px] md:max-w-[300px]" title={client.email}>{client.email}</span>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      className: "uppercase font-bold text-xs tracking-wider",
      render: (client) => {
        let plan = client.subscriptionPlan || "trial";
        if (plan === "nano") plan = "solo";
        if (plan === "ultra") plan = "team";
        return plan;
      },
    },
    {
      key: "trial",
      header: "Trial Expiry",
      render: (client) => (
        <span className="whitespace-nowrap text-slate-400">
          {client.trialExpiresAt ? new Date(client.trialExpiresAt).toLocaleDateString() : "N/A"}
        </span>
      ),
    },
    {
      key: "sub",
      header: "Sub Expiry",
      render: (client) => (
        <span className="whitespace-nowrap text-slate-400">
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
      className: "text-right",
      hideOnMobile: true,
      render: (client) => (
        <div className="flex justify-end gap-2 md:gap-3">{renderActions(client)}</div>
      ),
    },
  ];

  return (
    <div className="relative flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      <AdminPageHeader
        title="Client Manager"
        description="Manage all of your active, pending, and trial client accounts."
        actions={
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
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
      />

      {creating && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#080810]/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl border border-white/5 bg-white/[0.02] p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-x-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
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
                <select
                  value={newClient.subscriptionPlan}
                  onChange={(e) => handlePlanChange(e.target.value, "create")}
                  className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all appearance-none"
                >
                  {PLAN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Trial Expiry</label>
                <input
                  type="datetime-local"
                  value={
                    newClient.trialExpiresAt
                      ? new Date(newClient.trialExpiresAt).toISOString().slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    setNewClient({
                      ...newClient,
                      trialExpiresAt: isNaN(d.getTime()) ? "" : d.toISOString(),
                    });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Subscription Expiry</label>
                <input
                  type="datetime-local"
                  value={
                    newClient.subscriptionExpiresAt
                      ? new Date(newClient.subscriptionExpiresAt).toISOString().slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    setNewClient({
                      ...newClient,
                      subscriptionExpiresAt: isNaN(d.getTime()) ? "" : d.toISOString(),
                    });
                  }}
                  disabled={!PAID_PLANS.includes(newClient.subscriptionPlan)}
                  className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#080810]/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl border border-white/5 bg-white/[0.02] p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-x-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <h2 className="mb-6 text-xl sm:text-2xl font-black text-white relative z-10">
              Edit Client
            </h2>
            <form onSubmit={handleUpdate} className="space-y-4 relative z-10">
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
                <label className="mb-2 block text-sm font-bold text-slate-400">Plan</label>
                <select
                  value={editing.subscriptionPlan || "trial"}
                  onChange={(e) => handlePlanChange(e.target.value, "edit")}
                  className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all appearance-none"
                >
                  {PLAN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">
                  Trial Expiry
                </label>
                <input
                  type="datetime-local"
                  value={
                    editing.trialExpiresAt
                      ? new Date(editing.trialExpiresAt).toISOString().slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    setEditing({
                      ...editing,
                      trialExpiresAt: isNaN(d.getTime()) ? "" : d.toISOString(),
                    });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">
                  Subscription Expiry
                </label>
                <input
                  type="datetime-local"
                  value={
                    editing.subscriptionExpiresAt
                      ? new Date(editing.subscriptionExpiresAt).toISOString().slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    setEditing({
                      ...editing,
                      subscriptionExpiresAt: isNaN(d.getTime()) ? "" : d.toISOString(),
                    });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                />
              </div>

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
          </div>
        </div>
      )}
    </div>
  );
}
