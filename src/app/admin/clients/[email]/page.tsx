"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  KeyRound,
  Pencil,
  Radio,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { AdminGlassModal, AdminGlassPanel } from "@/components/admin-glass-modal";
import { AdminPlanSelect, normalizePlanValue } from "@/components/admin-plan-select";
import { AdminDateTimeInput } from "@/components/admin-datetime-input";
import { useAdminToast } from "@/components/admin-toast";
import { useAdminLiveRefresh } from "@/hooks/use-admin-live-refresh";
import { formatPhoneDisplay } from "@/lib/phone";

type Client = {
  email: string;
  name?: string;
  phone?: string;
  phoneCountryCode?: string;
  phoneNational?: string;
  subscriptionPlan?: string;
  trialExpiresAt?: string;
  subscriptionExpiresAt?: string;
  createdAt?: string;
  suspended?: boolean;
  adminNotes?: string;
  assignedSlot?: string;
  lastSyncAt?: string;
  lastSyncSlot?: string;
  extensionVersion?: string;
};

const SLOTS = ["C1", "C2", "C3", "C4", "C5"];

export default function ClientDetailPage() {
  const params = useParams();
  const email = decodeURIComponent(String(params.email || ""));
  const { toast } = useAdminToast();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/admin/clients?email=${encodeURIComponent(email)}`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.success) {
        setClient(data.client);
        if (!editing) setEditForm(data.client);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (email) void load();
  }, [email]);

  useAdminLiveRefresh(
    (event) => {
      const id = String(event.userId || event.id || "").toLowerCase();
      if (event.type === "resync" || id === email.toLowerCase()) void load(true);
    },
    [email],
    { topics: ["user"] },
  );

  const saveClient = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: editForm.name,
          subscriptionPlan: editForm.subscriptionPlan,
          trialExpiresAt: editForm.trialExpiresAt,
          subscriptionExpiresAt: editForm.subscriptionExpiresAt,
          suspended: editForm.suspended,
          assignedSlot: editForm.assignedSlot,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast("Client updated");
        setEditing(false);
        load();
      } else {
        toast(data.error || "Update failed", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleSuspend = async () => {
    if (!client) return;
    const res = await fetch("/api/admin/clients", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, suspended: !client.suspended }),
    });
    const data = await res.json();
    if (data.success) {
      toast(client.suspended ? "Client unsuspended" : "Client suspended");
      load();
    }
  };

  if (loading) return <AdminLoadingState label="Loading client..." />;
  if (!client) {
    return (
      <div className="text-center py-20 text-slate-400">
        Client not found.{" "}
        <Link href="/admin/clients" className="text-cyan-400 hover:underline">
          Back to clients
        </Link>
      </div>
    );
  }

  return (
    <AdminPageLayout
      header={
        <AdminPageHeader
          title={client.name || email}
          description={client.email}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/clients"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/5"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Link>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-bold text-cyan-300 hover:bg-cyan-500/15"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button
                type="button"
                onClick={toggleSuspend}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold ${
                  client.suspended
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                }`}
              >
                <Ban className="w-4 h-4" /> {client.suspended ? "Unsuspend" : "Suspend"}
              </button>
            </div>
          }
        />
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminGlassPanel className="p-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-4">Profile</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-mono text-slate-200">{formatPhoneDisplay(client) || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Plan</dt>
              <dd className="font-semibold text-slate-200 capitalize">{client.subscriptionPlan || "none"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd>
                {client.suspended ? (
                  <span className="text-rose-400 font-semibold">Suspended</span>
                ) : (
                  <span className="text-emerald-400 font-semibold">Active</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Trial expires</dt>
              <dd className="text-slate-300">
                {client.trialExpiresAt ? new Date(client.trialExpiresAt).toLocaleString() : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Plan expires</dt>
              <dd className="text-slate-300">
                {client.subscriptionExpiresAt
                  ? new Date(client.subscriptionExpiresAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Joined</dt>
              <dd className="text-slate-300">
                {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Assigned slot</dt>
              <dd className="font-mono text-cyan-400">{client.assignedSlot || "C1"}</dd>
            </div>
          </dl>
        </AdminGlassPanel>

        <AdminGlassPanel className="p-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-4 flex items-center gap-2">
            <Radio className="w-4 h-4" /> Sync
          </h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Last sync</dt>
              <dd className="text-slate-300">
                {client.lastSyncAt ? new Date(client.lastSyncAt).toLocaleString() : "Never"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Last slot</dt>
              <dd className="font-mono text-slate-300">{client.lastSyncSlot || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Extension</dt>
              <dd className="text-slate-300">{client.extensionVersion || "—"}</dd>
            </div>
          </dl>
          <Link
            href="/admin/sync"
            className="mt-4 inline-flex text-sm text-cyan-400 hover:underline"
          >
            View all sync status →
          </Link>
        </AdminGlassPanel>

      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/admin/payments?email=${encodeURIComponent(email)}`}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/5"
        >
          <CreditCard className="w-4 h-4" /> Payments
        </Link>
        <Link
          href={`/admin/emails?email=${encodeURIComponent(email)}`}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/5"
        >
          <Clock className="w-4 h-4" /> Emails
        </Link>
      </div>

      {editing && (
        <AdminGlassModal
          open={editing}
          align="end"
          scrollable
          onClose={() => setEditing(false)}
          closeOnBackdrop
          maxWidth="lg"
        >
          <AdminGlassPanel accent="cyan" sheet>
            <h2 className="mb-6 text-xl sm:text-2xl font-black text-white">Edit Client</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Name</label>
                <input
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-sm text-slate-200 outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Plan</label>
                <AdminPlanSelect
                  value={normalizePlanValue(editForm.subscriptionPlan || "trial")}
                  onChange={(plan) => setEditForm({ ...editForm, subscriptionPlan: plan })}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Trial Expiry</label>
                <AdminDateTimeInput
                  value={editForm.trialExpiresAt || ""}
                  onChange={(v) => setEditForm({ ...editForm, trialExpiresAt: v })}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Plan Expiry</label>
                <AdminDateTimeInput
                  value={editForm.subscriptionExpiresAt || ""}
                  onChange={(v) => setEditForm({ ...editForm, subscriptionExpiresAt: v })}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-slate-400">
                  Assigned Slot
                </label>
                <div className="relative">
                  <select
                    value={editForm.assignedSlot || "C1"}
                    onChange={(e) => setEditForm({ ...editForm, assignedSlot: e.target.value })}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-[#080810] px-4 py-3 pr-11 text-sm text-slate-200 outline-none transition-all hover:border-white/20 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  >
                    {SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(editForm.suspended)}
                  onChange={(e) => setEditForm({ ...editForm, suspended: e.target.checked })}
                  className="rounded"
                />
                Suspended
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={saveClient}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </AdminGlassPanel>
        </AdminGlassModal>
      )}
    </AdminPageLayout>
  );
}
