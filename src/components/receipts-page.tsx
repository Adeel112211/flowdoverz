"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  LogOut,
  Receipt,
  RotateCcw,
  Search,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PlanAmount, PlanBadge } from "@/components/plan-badge";
import { ReceiptPreviewModal } from "@/components/receipt-preview-modal";
import { useClientSession } from "@/hooks/use-client-session";
import { signOut } from "@/lib/auth";
import type { PurchaseRecord } from "@/lib/client-receipts";

type ReceiptAccount = {
  userName: string;
  email: string;
  planName: string;
  activationDateLabel: string;
  expiryDateLabel: string;
  subscriptionActive: boolean;
};

const FILTERS = ["all", "approved", "refunded"] as const;
type Filter = (typeof FILTERS)[number];

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/5 bg-[#080810]/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-100 break-all text-left sm:text-right">{value}</span>
    </div>
  );
}

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
      <CheckCircle2 size={12} /> Paid
    </span>
  );
}

export function ReceiptsPage() {
  const router = useRouter();
  const session = useClientSession();
  const [account, setAccount] = useState<ReceiptAccount | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewPurchase, setPreviewPurchase] = useState<PurchaseRecord | null>(null);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }

    let active = true;

    fetch("/api/user/receipts")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (!data.success) {
          signOut();
          router.push("/login");
          return;
        }
        setAccount(data.account);
        setPurchases(data.purchases || []);
      })
      .catch((err) => {
        if (!active) return;
        console.error(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router, session]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.receiptNumber.toLowerCase().includes(q) ||
        (p.refundReceiptNumber || "").toLowerCase().includes(q) ||
        p.planName.toLowerCase().includes(q)
      );
    });
  }, [purchases, filter, searchQuery]);

  if (!session || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080810] text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p>Loading receipts…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#080810] text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[420px] w-[min(900px,100vw)] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <header className="relative z-10 border-b border-white/5 bg-[#080810]/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="hover:opacity-80 transition-opacity">
            <BrandLogo size="lg" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:border-cyan-500/30 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <button
              type="button"
              onClick={() => {
                signOut();
                router.push("/login");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white sm:text-3xl">My Receipts</h1>
            <p className="mt-1 text-sm text-slate-400">
              Each purchase is listed separately by date. Tap View Receipt to open and download.
            </p>
          </div>
        </div>

        <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-sm font-black text-slate-950">
              {account?.userName?.charAt(0) || session.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Account Details</h2>
              <p className="text-xs text-slate-500">Your subscription and billing profile</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <AccountRow label="Client name" value={account?.userName || session.name} />
            <AccountRow label="Email" value={account?.email || session.email} />
            <AccountRow label="Plan" value={account?.planName || "—"} />
            <AccountRow label="Activation date" value={account?.activationDateLabel || "—"} />
            <AccountRow label="Plan expiry date" value={account?.expiryDateLabel || "—"} />
            <AccountRow
              label="Status"
              value={account?.subscriptionActive ? "Active" : "Inactive / Expired"}
            />
          </div>
        </section>

        <section className="flex flex-col min-h-0">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="m-0 text-lg font-black text-white sm:text-xl md:text-2xl">
              Purchases ({filteredPurchases.length})
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search receipts..."
                className="w-full rounded-xl border border-white/10 bg-slate-900/50 py-2 pl-9 pr-4 text-sm text-slate-200 placeholder:text-slate-500 transition-all focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
            </div>
          </div>

          <div className="mb-4 flex w-full overflow-x-auto gap-1.5 rounded-2xl border border-white/10 bg-[#0F172A]/80 p-1 shadow-2xl backdrop-blur-xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {FILTERS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`flex-none whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold capitalize leading-tight transition-all sm:px-4 sm:py-2.5 sm:text-sm ${
                  filter === tab
                    ? "bg-cyan-500 text-slate-900 shadow-[0_0_20px_-3px_rgba(34,211,238,0.4)]"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {tab === "approved" ? "Approved" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {filteredPurchases.length === 0 ? (
            <div className="border-t border-white/10 bg-[#0F172A]/40 px-0 py-16 backdrop-blur-xl sm:px-4">
              <div className="flex flex-col items-center justify-center gap-2 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10">
                  <Receipt className="h-8 w-8 text-cyan-400" />
                </div>
                <h3 className="text-xl font-black text-slate-200 sm:text-2xl">No receipts yet</h3>
                <p className="max-w-sm text-sm text-slate-400">Your payment receipts will appear here after approval.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 pb-4 xl:hidden">
                {filteredPurchases.map((purchase) => (
                  <article
                    key={purchase.paymentId}
                    className="w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0F172A]/80 p-4 shadow-lg backdrop-blur-xl"
                  >
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Paid on</dt>
                        <dd className="mt-1 text-sm text-slate-400">{purchase.paymentDateLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Plan</dt>
                        <dd className="mt-1"><PlanBadge planId={purchase.planId} /></dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount</dt>
                        <dd className="mt-1"><PlanAmount planId={purchase.planId} amount={purchase.amountLabel} /></dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Receipt #</dt>
                        <dd className="mt-1 whitespace-nowrap font-mono text-sm text-slate-300">{purchase.receiptNumber}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</dt>
                        <dd className="mt-1"><PurchaseStatus status={purchase.status} /></dd>
                      </div>
                    </dl>
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <button
                        type="button"
                        onClick={() => setPreviewPurchase(purchase)}
                        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-cyan-500/20 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-400 transition-colors hover:bg-cyan-400/20 hover:text-cyan-300"
                      >
                        <Eye size={14} /> View Receipt
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden xl:flex min-h-0 w-full max-w-full min-w-0 flex-col overflow-hidden border-t border-white/10 bg-[#0F172A]/40 shadow-2xl backdrop-blur-xl">
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <table className="w-full table-auto text-left text-sm text-slate-300">
                    <thead className="sticky top-0 z-10 border-b border-cyan-500/20 bg-[#0F172A] text-xs uppercase tracking-widest text-cyan-400 md:text-sm">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-4 font-black">Paid on</th>
                        <th className="whitespace-nowrap px-4 py-4 font-black">Plan</th>
                        <th className="whitespace-nowrap px-4 py-4 font-black">Amount</th>
                        <th className="whitespace-nowrap px-4 py-4 font-black">Receipt #</th>
                        <th className="whitespace-nowrap px-4 py-4 font-black">Status</th>
                        <th className="whitespace-nowrap px-4 py-4 font-black text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {filteredPurchases.map((purchase) => (
                        <tr key={purchase.paymentId} className="transition-colors hover:bg-white/[0.04]">
                          <td className="whitespace-nowrap px-4 py-4 text-slate-400">{purchase.paymentDateLabel}</td>
                          <td className="px-4 py-4"><PlanBadge planId={purchase.planId} /></td>
                          <td className="px-4 py-4"><PlanAmount planId={purchase.planId} amount={purchase.amountLabel} /></td>
                          <td className="whitespace-nowrap px-4 py-4 font-mono text-slate-300">{purchase.receiptNumber}</td>
                          <td className="px-4 py-4"><PurchaseStatus status={purchase.status} /></td>
                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setPreviewPurchase(purchase)}
                              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-cyan-500/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-400 transition-colors hover:bg-cyan-400/20 hover:text-cyan-300"
                            >
                              <Eye size={14} /> View Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      <ReceiptPreviewModal
        open={Boolean(previewPurchase)}
        onClose={() => setPreviewPurchase(null)}
        purchase={previewPurchase}
        variant="client"
      />
    </div>
  );
}
