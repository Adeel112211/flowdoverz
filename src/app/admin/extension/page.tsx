"use client";

import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminPanel } from "@/components/admin-glass-modal";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { useAdminToast } from "@/components/admin-toast";
import { AdminExtensionEditor } from "@/components/admin-extension-editor";
import type { ExtensionConfig } from "@/lib/extension-config";

export default function AdminExtensionPage() {
  const { toast } = useAdminToast();
  const [config, setConfig] = useState<ExtensionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncKey, setSyncKey] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/extension", { credentials: "same-origin" });
      const data = await res.json();
      if (data.success) setConfig(data.config);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const stored = sessionStorage.getItem("flowdoverz_admin_sync_key");
    if (stored) setSyncKey(stored);
  }, []);

  const saveDetails = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/extension", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        toast("Extension settings saved");
        setConfig(data.config);
      } else {
        toast(data.error || "Save failed", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const uploadRelease = async (payload: {
    version: string;
    versionName: string;
    changelog: string;
    fileName: string;
    zipBase64: string;
  }) => {
    const res = await fetch("/api/admin/extension", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upload_release", ...payload }),
    });
    const data = await res.json();
    if (data.success) {
      toast(data.message || "Release uploaded and marked official");
      setConfig(data.config);
    } else {
      toast(data.error || "Upload failed", "error");
      throw new Error(data.error);
    }
  };

  const setActive = async (version: string) => {
    const res = await fetch("/api/admin/extension", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_active", version }),
    });
    const data = await res.json();
    if (data.success) {
      toast(`v${version} is now active`);
      setConfig(data.config);
    } else {
      toast(data.error || "Failed", "error");
    }
  };

  const deleteRelease = async (version: string) => {
    if (!confirm(`Delete extension release v${version}?`)) return;
    const res = await fetch("/api/admin/extension", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_release", version }),
    });
    const data = await res.json();
    if (data.success) {
      toast("Release deleted");
      setConfig(data.config);
    } else {
      toast(data.error || "Delete failed", "error");
    }
  };

  if (loading) return <AdminLoadingState label="Loading extension settings..." />;

  if (!config) {
    return (
      <div className="p-8 text-center text-slate-400">
        Failed to load extension settings.{" "}
        <button type="button" onClick={load} className="text-cyan-400 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <AdminPageLayout
      header={
        <AdminPageHeader
          title="Extension Manager"
          description="Upload a new ZIP to make it official. Older installed copies stop working until users download this version."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard"
                target="_blank"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F172A] px-4 py-2.5 text-sm font-bold text-slate-300 hover:border-cyan-500/30"
              >
                <ExternalLink className="h-4 w-4" /> User dashboard
              </Link>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F172A] px-4 py-2.5 text-sm font-bold text-slate-300 hover:border-cyan-500/30"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveDetails}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save details"}
              </button>
            </div>
          }
        />
      }
    >
      <AdminPanel className="p-5 sm:p-6">
        <AdminExtensionEditor
          config={config}
          syncKey={syncKey}
          onChange={setConfig}
          onUpload={uploadRelease}
          onSetActive={setActive}
          onDelete={deleteRelease}
          onCopySyncKey={() => {
            navigator.clipboard.writeText(syncKey);
            toast("Copied sync key");
          }}
        />
      </AdminPanel>
    </AdminPageLayout>
  );
}
