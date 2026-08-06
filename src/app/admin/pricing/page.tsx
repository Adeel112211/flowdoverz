"use client";

import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminPanel } from "@/components/admin-glass-modal";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { useAdminToast } from "@/components/admin-toast";
import { AdminPricingEditor } from "@/components/admin-pricing-editor";
import type { PricingConfig } from "@/lib/pricing-config";

export default function AdminPricingPage() {
  const { toast } = useAdminToast();
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pricing", { credentials: "same-origin" });
      const data = await res.json();
      if (data.success) setConfig(data.config);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        toast("Pricing saved");
        setConfig(data.config);
      } else {
        toast(data.error || "Save failed", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoadingState label="Loading pricing..." />;

  if (!config) {
    return (
      <div className="p-8 text-center text-slate-400">
        Failed to load pricing.{" "}
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
          title="Pricing"
          description="Manage plans, prices, features and what customers see on the pricing page."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/pricing"
                target="_blank"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F172A] px-4 py-2.5 text-sm font-bold text-slate-300 hover:border-cyan-500/30"
              >
                <ExternalLink className="h-4 w-4" /> View live page
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
                onClick={save}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save pricing"}
              </button>
            </div>
          }
        />
      }
    >
      <AdminPanel>
        <AdminPricingEditor config={config} onChange={setConfig} />
      </AdminPanel>
    </AdminPageLayout>
  );
}
