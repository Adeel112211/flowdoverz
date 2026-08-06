"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthBridge } from "@/components/auth-bridge";
import { BrandLogo } from "@/components/brand-logo";
import { getSession, signOut, type Session } from "@/lib/auth";
import { DownloadCloud, ExternalLink, Timer, Rocket, CheckCircle2, AlertCircle, User, LogOut, MonitorSmartphone, Receipt, X, Sparkles } from "lucide-react";

type UserStatus = {
  active: boolean;
  trialActive: boolean;
  subscriptionActive: boolean;
  trialExpiresAt: string | null;
  subscriptionPlan: string;
  subscriptionExpiresAt: string | null;
};

type ClientReceipt = {
  id: string;
  receiptNumber: string;
  planName: string;
  amountLabel: string;
  transactionId: string;
  paymentDateLabel: string;
  expiryDateLabel?: string;
  refundDateLabel?: string;
  originalReceiptNumber?: string;
  userName: string;
  accountNumber: string;
  scanUrl?: string;
  status?: "paid" | "refunded";
};

export function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [extensionDownloadUrl, setExtensionDownloadUrl] = useState<string | null>(null);
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [installSteps, setInstallSteps] = useState<string[]>([]);
  const [mobileInstallSteps, setMobileInstallSteps] = useState<string[]>([]);
  const [installView, setInstallView] = useState<"desktop" | "mobile">("desktop");
  const [receipts, setReceipts] = useState<ClientReceipt[]>([]);
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace("/login");
      return;
    }
    setSession(current);

    fetch("/api/user/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus(data.status);
        } else {
          signOut();
          router.push("/login");
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch("/api/extension")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setExtensionDownloadUrl(data.extension.downloadUrl);
          setExtensionVersion(data.extension.activeVersion);
          setInstallSteps(data.extension.installSteps || []);
          setMobileInstallSteps(data.extension.mobileInstallSteps || []);
        }
      })
      .catch(console.error);

    fetch("/api/user/receipts")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.receipts)) {
          setReceipts(data.receipts);
        }
      })
      .catch(console.error);
  }, [router]);

  useEffect(() => {
    if (!loading && status && !status.active) {
      setShowExpiredModal(true);
    }
  }, [loading, status]);

  function handleSignOut() {
    signOut();
    router.push("/login");
  }

  function getRemainingText() {
    if (!status) return "Calculating...";
    
    const expiryDateStr = status.subscriptionActive && status.subscriptionExpiresAt 
      ? status.subscriptionExpiresAt 
      : status.trialExpiresAt;

    if (!expiryDateStr) return "Expired";

    const expiry = new Date(expiryDateStr).getTime();
    const now = new Date().getTime();
    const diff = expiry - now;

    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes} minutes left`;
  }

  if (!session || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400 bg-[#080810]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <p>Loading workspace…</p>
        </div>
      </div>
    );
  }

  const isTrial = status?.trialActive && !status?.subscriptionActive;
  const isExpired = !status?.active;
  const maxDevices = isTrial ? 1 : status?.subscriptionPlan?.toLowerCase() === "team" ? 3 : 1;

  return (
    <div className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#080810] text-slate-100 font-sans selection:bg-cyan-500/30 flex flex-col">
      <AuthBridge session={session} daysRemaining={14} />

      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/4 h-[500px] w-[min(800px,100vw)] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <header className="relative z-50 border-b border-white/5 bg-[#080810]/80 backdrop-blur-md sticky top-0">
        <div className="mx-auto flex h-16 sm:h-20 w-full items-center justify-between px-4 sm:px-8 lg:px-24 xl:px-32 2xl:px-64">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <BrandLogo size="md" />
          </Link>
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-all shadow-inner"
            >
              <User size={18} />
            </button>

            {isDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-white/10 bg-[#0c0c16]/95 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden transform origin-top-right transition-all">
                  <div className="p-4 border-b border-white/5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center text-slate-950 font-black shrink-0 shadow-[0_0_15px_rgba(34,211,238,0.3)] text-lg uppercase">
                      {session.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate text-sm">{session.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">{session.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-rose-400 transition-all hover:bg-rose-500/10 hover:shadow-[inset_0_0_10px_rgba(225,29,72,0.1)] group"
                    >
                      <LogOut size={16} className="transition-transform group-hover:-translate-x-1" /> Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full px-4 sm:px-8 lg:px-24 xl:px-32 2xl:px-64 pt-6 sm:pt-8 pb-6 sm:pb-8 flex-1 flex flex-col min-w-0">
        {isExpired && (
          <div className="mb-6 sm:mb-8 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-4 backdrop-blur-xl">
            <AlertCircle className="text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-rose-200 text-lg mb-1">Your access has expired</h3>
              <p className="text-rose-200/80 text-sm">
                Your trial or subscription has ended. You will not be able to connect to Google Flow until you activate a plan.
              </p>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:-translate-y-0.5 transition-all"
            >
              View plans
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 flex-1">
          {/* Left Column (Command Center) */}
          <div className="lg:col-span-7 flex flex-col gap-4 min-w-0">
            
            {/* Massive Welcome Bento */}
            <div className="rounded-2xl sm:rounded-3xl border border-white/5 bg-white/[0.02] p-5 sm:p-8 backdrop-blur-xl relative overflow-hidden group hover:bg-white/[0.03] transition-all flex flex-col justify-center gap-8 min-h-[220px] sm:min-h-[260px] lg:flex-1">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px] -mr-20 -mt-20 transition-all group-hover:bg-cyan-500/20 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold mb-6">
                  <Rocket size={14} />
                  <span>{status?.subscriptionActive ? status.subscriptionPlan : isTrial ? "Free Trial" : "No Active Plan"}</span>
                </div>
                
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400 mb-2 leading-tight break-words">
                  Welcome back,<br/>{session.name.split(" ")[0]}.
                </h1>
                <p className="text-slate-400 text-base max-w-md">
                  Manage your Google Flow bridge connection and securely generate AI videos.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 relative z-10">
                <a
                  href={extensionDownloadUrl || "#"}
                  download
                  className={`flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-black tracking-wide text-slate-950 transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] w-full sm:w-auto ${!extensionDownloadUrl ? "pointer-events-none opacity-50" : ""}`}
                >
                  <DownloadCloud size={20} /> Download Extension{extensionVersion ? ` v${extensionVersion}` : ""}
                </a>
                <a
                  href="https://labs.google/fx/tools/flow"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-bold text-slate-300 transition-all hover:bg-white/10 hover:text-white w-full sm:w-auto"
                >
                  Open Flow <ExternalLink size={18} />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Connection Status Bento */}
              <div className="rounded-2xl sm:rounded-3xl border border-white/5 bg-white/[0.02] p-5 sm:p-6 backdrop-blur-xl relative overflow-hidden group hover:bg-white/[0.03] transition-all flex flex-col justify-center min-h-[160px] sm:min-h-[180px] min-w-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[50px] -mr-10 -mt-10 transition-all group-hover:bg-emerald-500/20 pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-110 ${isExpired ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.15)]' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'}`}>
                      {isExpired ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold tracking-wide uppercase text-slate-400 mb-1">Connection Status</p>
                      <p className={`text-2xl font-black ${isExpired ? "text-rose-400" : "text-white"}`}>
                        {isExpired ? "Inactive" : "Ready"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Device Logins Bento */}
              <div className="rounded-2xl sm:rounded-3xl border border-white/5 bg-white/[0.02] p-5 sm:p-6 backdrop-blur-xl relative overflow-hidden group hover:bg-white/[0.03] transition-all flex flex-col justify-center min-h-[160px] sm:min-h-[180px] min-w-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-[50px] -mr-10 -mt-10 transition-all group-hover:bg-cyan-500/20 pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-110 bg-cyan-500/10 border-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
                      <MonitorSmartphone size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold tracking-wide uppercase text-slate-400 mb-1">Device Logins</p>
                      <p className="text-2xl font-black text-white">
                        1 <span className="text-slate-500 text-lg">/ {maxDevices}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Receipts */}
            <div className="min-w-0 rounded-2xl sm:rounded-3xl border border-white/5 bg-white/[0.02] p-5 sm:p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-cyan-500/10 border-cyan-500/20 text-cyan-400">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Receipts</h3>
                    <p className="text-xs text-slate-500">
                      {receipts.length > 0
                        ? `${receipts.length} receipt${receipts.length === 1 ? "" : "s"} available`
                        : "Payment & refund receipts"}
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/receipts"
                  className="shrink-0 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                >
                  View all
                </Link>
              </div>

              {receipts.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">
                  No receipts yet. They appear after your payment is approved.
                </p>
              ) : (
                <p className="text-sm text-slate-400">
                  Open the receipts page to view account details, payment & refund receipts, and download them as PNG images.
                </p>
              )}
            </div>

          </div>

          {/* Right Column (Status & Instructions) */}
          <div className="lg:col-span-5 flex flex-col gap-4 min-w-0">
            
            {/* Time Remaining Mini-Bento */}
            <div className="rounded-2xl sm:rounded-3xl border border-white/5 bg-white/[0.02] p-5 sm:p-6 backdrop-blur-xl relative overflow-hidden group hover:bg-white/[0.03] transition-all text-center flex flex-col items-center justify-center min-h-[140px] sm:min-h-[160px] lg:flex-1">
              <div className="absolute inset-0 bg-gradient-to-b from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="w-16 h-16 rounded-3xl bg-teal-500/10 border border-teal-500/20 text-teal-400 shadow-[0_0_30px_rgba(20,184,166,0.2)] group-hover:shadow-[0_0_40px_rgba(20,184,166,0.4)] flex items-center justify-center mb-4 relative z-10 transition-shadow">
                <Timer size={32} />
              </div>
              <p className="text-xs font-bold tracking-wide uppercase text-slate-400 mb-1 relative z-10">Time Remaining</p>
              <h2 className={`text-2xl sm:text-3xl font-black relative z-10 ${isExpired ? "text-rose-400" : "text-white"}`}>
                {getRemainingText()}
              </h2>
            </div>

            {/* How to Connect Timeline Bento */}
            <div className="rounded-2xl sm:rounded-3xl border border-white/5 bg-white/[0.02] p-5 sm:p-6 backdrop-blur-xl relative overflow-hidden min-w-0 lg:flex-1 flex flex-col justify-center">
              <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/5 blur-[80px] pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-bold text-white">How to Connect</h3>
                  <div className="flex rounded-lg border border-white/10 bg-[#080810]/80 p-0.5">
                    <button
                      type="button"
                      onClick={() => setInstallView("desktop")}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        installView === "desktop"
                          ? "bg-cyan-500/20 text-cyan-400"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <MonitorSmartphone className="h-3 w-3" /> Desktop
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallView("mobile")}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        installView === "mobile"
                          ? "bg-cyan-500/20 text-cyan-400"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      Mobile
                    </button>
                  </div>
                </div>

                <div className="relative pl-6 border-l-2 border-white/10 space-y-4">
                  {(() => {
                    const steps =
                      installView === "mobile"
                        ? mobileInstallSteps.length
                          ? mobileInstallSteps
                          : [
                              "Open this dashboard on your phone or tablet.",
                              "Tap Download to save the extension ZIP.",
                              "Transfer to desktop or use a mobile browser with extension support.",
                              "Install, tap Connect Now, and open Google Flow.",
                            ]
                        : installSteps.length
                          ? installSteps
                          : [
                              "Download the latest extension ZIP from the button on the left.",
                              "Unzip the folder, open chrome://extensions, enable Developer mode, and load unpacked.",
                              "Click the extension icon, press Connect Now, and open Google Flow!",
                            ];
                    return steps.map((step, index) => (
                  <div key={index} className="relative">
                    <div className={`absolute -left-[35px] top-1 w-6 h-6 rounded-full bg-[#080810] border-2 ${index === 0 ? "border-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]" : "border-white/20"} flex items-center justify-center`}>
                      <span className={`text-[10px] font-black ${index === 0 ? "text-cyan-400" : "text-slate-400"}`}>{index + 1}</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{step}</p>
                  </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {showExpiredModal && isExpired && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Close expired plan dialog"
            className="absolute inset-0 bg-[#030308]/80 backdrop-blur-sm"
            onClick={() => setShowExpiredModal(false)}
          />
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c16] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expired-plan-title"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-[80px] -ml-16 -mb-16 pointer-events-none" />

            <div className="relative p-6 sm:p-8">
              <button
                type="button"
                onClick={() => setShowExpiredModal(false)}
                className="absolute right-4 top-4 rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.15)]">
                <AlertCircle size={32} />
              </div>

              <h2 id="expired-plan-title" className="text-center text-2xl font-black text-white mb-2">
                {status?.subscriptionExpiresAt && !status.subscriptionActive
                  ? "Your plan has expired"
                  : "Your trial has ended"}
              </h2>
              <p className="text-center text-sm text-slate-400 mb-6 leading-relaxed">
                Activate a plan to restore access and keep using FlowBridge with Google Flow.
              </p>

              <div className="flex flex-col gap-3">
                <Link
                  href="/pricing"
                  onClick={() => setShowExpiredModal(false)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-3.5 text-sm font-black text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] transition-all"
                >
                  <Sparkles size={18} />
                  View plans & activate
                </Link>
                <button
                  type="button"
                  onClick={() => setShowExpiredModal(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
