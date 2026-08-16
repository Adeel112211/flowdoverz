"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, Construction, Save } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminPanel } from "@/components/admin-glass-modal";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { AdminDateTimeInput } from "@/components/admin-datetime-input";
import { useAdminToast } from "@/components/admin-toast";
import type { MaintenanceSettings } from "@/lib/maintenance";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-sm text-slate-200 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors";

const DURATION_PRESETS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "6 hours", minutes: 360 },
  { label: "12 hours", minutes: 720 },
  { label: "24 hours", minutes: 1440 },
];

function hoursFromNowIso(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function formatUntil(iso: string) {
  if (!iso) return "No end time set";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No end time set";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminMaintenancePage() {
  const { toast } = useAdminToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [until, setUntil] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/maintenance", { credentials: "same-origin" });
      const data = await res.json();
      if (data.success && data.settings) {
        const settings = data.settings as MaintenanceSettings;
        setEnabled(Boolean(settings.enabled));
        setMessage(settings.message || "");
        setUntil(settings.until || "");
      } else {
        toast(data.error || "Failed to load maintenance", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const remainingLabel = useMemo(() => {
    if (!enabled || !until) return "";
    const untilMs = Date.parse(until);
    if (Number.isNaN(untilMs)) return "";
    const diff = untilMs - Date.now();
    if (diff <= 0) return "Time already ended — the website is live.";
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${Math.max(1, minutes)}m remaining`;
  }, [enabled, until]);

  const toggleEnabled = (next: boolean) => {
    setEnabled(next);
    if (next && !until) {
      setUntil(hoursFromNowIso(120));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ enabled, message, until }),
      });
      const data = await res.json();
      if (data.success) {
        toast(
          data.settings?.enabled
            ? "Maintenance is on — flow.doverz.com will show the popup"
            : "Maintenance is off — flow.doverz.com is live",
        );
        setEnabled(Boolean(data.settings.enabled));
        setMessage(data.settings.message || "");
        setUntil(data.settings.until || "");
      } else {
        toast(data.error || "Save failed", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoadingState label="Loading maintenance..." />;

  return (
    <AdminPageLayout
      header={
        <AdminPageHeader
          title="Maintenance"
          description="Turn flow.doverz.com off for visitors. The admin panel stays available."
          actions={
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </button>
          }
        />
      }
    >
      <div className="space-y-4">
        <AdminPanel>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                  enabled
                    ? "border-amber-400/40 bg-amber-500/15 text-amber-300"
                    : "border-white/10 bg-white/5 text-slate-400"
                }`}
              >
                <Construction className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Website maintenance</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  When this is on, visitors on flow.doverz.com only see a maintenance popup. Login,
                  signup, dashboard, and pricing are blocked. This admin panel is not affected.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => toggleEnabled(!enabled)}
              className={`relative h-9 w-16 shrink-0 rounded-full transition-colors ${
                enabled ? "bg-amber-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-7 w-7 rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-7" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div
            className={`mt-6 rounded-xl border px-4 py-3 text-sm font-medium ${
              enabled
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {enabled
              ? `On — flow.doverz.com will show the popup until ${formatUntil(until)}.`
              : "Off — flow.doverz.com works normally."}
            {remainingLabel ? ` ${remainingLabel}` : ""}
          </div>
        </AdminPanel>

        <AdminPanel>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Why the website is in maintenance
          </label>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            placeholder="We're upgrading servers. FlowDoverz will be back shortly."
            className={`${inputClass} min-h-[140px] resize-y`}
          />
          <p className="mt-2 text-xs text-slate-500">This message appears on the visitor popup.</p>
        </AdminPanel>

        <AdminPanel>
          <div className="mb-4 flex items-center gap-3">
            <Clock className="h-4 w-4 text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white">Duration</h3>
              <p className="text-sm text-slate-500">
                Choose how long flow.doverz.com stays on maintenance. After this time it turns itself
                off.
              </p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setUntil(hoursFromNowIso(preset.minutes))}
                className="rounded-lg border border-white/10 bg-[#080810] px-3 py-2 text-xs font-bold text-slate-300 hover:border-amber-400/40 hover:text-white"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            End time
          </label>
          <AdminDateTimeInput value={until} onChange={setUntil} />
        </AdminPanel>

        {enabled && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/80">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            Visitors cannot use the website until you turn this off or the end time is reached.
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}
