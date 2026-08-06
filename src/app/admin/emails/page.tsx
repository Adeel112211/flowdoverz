"use client";

import { useEffect, useState } from "react";
import { Mail, CheckCircle2, XCircle } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminLoadingState } from "@/components/admin-loading-state";

type EmailItem = {
  id: string;
  to: string;
  subject: string;
  type: string;
  status: "sent" | "failed";
  error?: string;
  createdAt: string;
};

export default function EmailsPage() {
  const [items, setItems] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/emails?limit=200", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.items);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AdminLoadingState label="Loading email history..." />;

  return (
    <AdminPageLayout
      header={
        <AdminPageHeader
          title="Email History"
          description="View emails sent to clients from the system."
        />
      }
    >
      <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
        {items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Mail className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-slate-400">No emails logged yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((item) => (
              <li key={item.id} className="px-4 sm:px-6 py-4 hover:bg-white/[0.02]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {item.status === "sent" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <p className="text-sm font-semibold text-slate-200 truncate">{item.subject}</p>
                    </div>
                    <p className="text-xs text-cyan-400/80 mt-1 font-mono">{item.to}</p>
                    <p className="text-xs text-slate-500 mt-1 capitalize">Type: {item.type}</p>
                    {item.error && <p className="text-xs text-rose-400 mt-1">{item.error}</p>}
                  </div>
                  <time className="text-xs text-slate-500 whitespace-nowrap">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminPageLayout>
  );
}
