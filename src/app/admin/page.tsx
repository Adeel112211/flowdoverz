"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Users,
  CreditCard,
  Activity,
  Banknote,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  UserPlus,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
} from "recharts";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { useAdminLiveRefresh } from "@/hooks/use-admin-live-refresh";

function formatPkr(amount: number) {
  return `${amount.toLocaleString("en-PK")} PKR`;
}

function formatPkrDisplay(amount: number) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-2xl sm:text-3xl lg:text-4xl font-black tabular-nums">
        {amount.toLocaleString("en-PK")}
      </span>
      <span className="text-sm sm:text-base font-bold tracking-wide text-cyan-400">PKR</span>
    </span>
  );
}

type DashboardMetrics = {
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
  pendingApprovals: number;
  refundedPayments: number;
  signupsToday?: number;
  expiringThisWeek?: number;
  soloRevenue?: number;
  teamRevenue?: number;
  stats: {
    approved: number;
    rejected: number;
    pending: number;
    refunded: number;
  };
  chartData: { month: string; revenue: number; signups: number }[];
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function DateRangeDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);

  let selectedLabel = "All Time";
  if (value === "today") selectedLabel = "Today";
  else if (value === "last_7_days") selectedLabel = "Last 7 Days";
  else if (value === "this_month") selectedLabel = "This Month";
  else if (value === "this_year") selectedLabel = "This Year";
  else if (/^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-");
    selectedLabel = `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
  }

  useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      setTimeout(() => document.addEventListener("click", handleClickOutside), 0);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) {
      setMenuStyle(null);
      return;
    }

    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const panelWidth = Math.max(rect.width, 288);
      const maxLeft = window.innerWidth - panelWidth - 16;
      const left = Math.min(Math.max(16, rect.left), maxLeft);

      setMenuStyle({
        top: rect.bottom + 8,
        left,
        width: panelWidth,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  return (
    <div className="relative z-30 w-fit max-w-full sm:min-w-[12rem]">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((open) => !open);
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`flex w-auto min-w-[10.5rem] max-w-full sm:w-48 md:w-56 items-center justify-between gap-2 bg-[#0F172A]/95 border text-white font-semibold rounded-xl p-3 backdrop-blur-xl shadow-lg transition-all cursor-pointer hover:bg-white/5 ${
          isOpen
            ? "border-cyan-400/60 ring-2 ring-cyan-500/40"
            : "border-white/10 hover:border-white/20"
        }`}
      >
        <span className="truncate text-sm">{selectedLabel}</span>
        <svg
          className={`w-4 h-4 shrink-0 text-cyan-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && menuStyle && (
        <div
          role="listbox"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: menuStyle.top,
            left: menuStyle.left,
            width: menuStyle.width,
          }}
          className="z-[200] rounded-xl border border-white/10 bg-[#0F172A] shadow-[0_16px_48px_-12px_rgba(0,0,0,0.8)] p-3 flex flex-col gap-3"
        >
          <div className="grid grid-cols-2 gap-2">
            {[
              ["all_time", "All Time"],
              ["today", "Today"],
              ["last_7_days", "Last 7 Days"],
              ["this_year", "This Year"],
            ].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  onChange(val);
                  setIsOpen(false);
                }}
                className={`p-2 rounded-lg text-sm transition-colors ${
                  value === val
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "text-slate-300 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <button
                type="button"
                onClick={() => setViewYear((v) => v - 1)}
                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
              >
                &lt;
              </button>
              <span className="font-bold text-white tracking-wide">{viewYear}</span>
              <button
                type="button"
                onClick={() => setViewYear((v) => v + 1)}
                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
              >
                &gt;
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {MONTHS.map((m, i) => {
                const monthVal = `${viewYear}-${String(i + 1).padStart(2, "0")}`;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onChange(monthVal);
                      setIsOpen(false);
                    }}
                    className={`p-2 text-xs font-semibold rounded-lg transition-colors ${
                      value === monthVal
                        ? "bg-cyan-500 text-slate-900"
                        : "text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({
  icon: Icon,
  iconBg,
  iconColor,
  borderColor,
  title,
  subtitle,
  value,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  title: string;
  subtitle: string;
  value: number;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-white/5 to-transparent border border-white/5 border-l-4 ${borderColor} shadow-sm`}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className={`p-2 ${iconBg} rounded-lg shadow-inner ring-1 ring-white/10 shrink-0`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">{title}</p>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">{subtitle}</p>
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-black text-white shrink-0 tabular-nums">{value}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("all_time");

  const fetchMetrics = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`/api/admin/dashboard?range=${timeRange}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setMetrics(data.metrics);
          }
        }
      } catch (error) {
        console.error("Failed to load dashboard metrics", error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [timeRange],
  );

  useEffect(() => {
    void fetchMetrics(false);
  }, [fetchMetrics]);

  useAdminLiveRefresh(() => fetchMetrics(true), [fetchMetrics], {
    topics: ["user", "payment"],
    debounceMs: 200,
    ignoreActions: ["synced"],
  });

  if (loading || !metrics) {
    return <AdminLoadingState />;
  }

  return (
    <AdminPageLayout
      scrollContent
      header={
        <AdminPageHeader
          title="Admin Dashboard"
          description="Welcome back. Here is what is happening with FlowDoverz today."
          actions={<DateRangeDropdown value={timeRange} onChange={setTimeRange} />}
          actionsClassName="relative z-30 flex w-full justify-end sm:block sm:w-auto"
        />
      }
    >
      <div className="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-visible lg:gap-5">
        <div className="flex flex-col gap-3 overflow-visible pt-1 sm:gap-4 sm:pt-2">
          <div className="grid grid-cols-1 gap-3 overflow-visible sm:grid-cols-3 sm:gap-4">
            <MetricCard title="Total Users" value={metrics.totalUsers} icon={Users} color="text-emerald-400" bg="bg-emerald-400/10" />
            <MetricCard title="Active Plan" value={metrics.activeSubscriptions} icon={Activity} color="text-cyan-400" bg="bg-cyan-400/10" />
            <MetricCard title="Total Revenue" value={formatPkrDisplay(metrics.totalRevenue)} icon={Banknote} color="text-purple-400" bg="bg-purple-400/10" />
          </div>
          <div className="grid grid-cols-2 gap-3 overflow-visible sm:grid-cols-4 sm:gap-4">
            <MetricCard title="Pending" value={metrics.pendingApprovals} icon={Clock} color="text-amber-400" bg="bg-amber-400/10" />
            <MetricCard title="Signups Today" value={metrics.signupsToday ?? 0} icon={UserPlus} color="text-teal-400" bg="bg-teal-400/10" />
            <MetricCard title="Expiring Week" value={metrics.expiringThisWeek ?? 0} icon={AlertTriangle} color="text-rose-400" bg="bg-rose-400/10" />
            <MetricCard title="Refunded" value={metrics.refundedPayments} icon={RotateCcw} color="text-slate-400" bg="bg-slate-400/10" />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-5 items-start">
          <div className="xl:col-span-2">
            <div className="rounded-xl border border-white/10 bg-[#0F172A]/80 backdrop-blur-xl p-4 sm:p-5 shadow-2xl overflow-hidden">
              <h2 className="text-base sm:text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Revenue & Signups
              </h2>
              <div className="w-full h-[200px] sm:h-[220px]">
                {metrics.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={metrics.chartData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.05)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        stroke="#64748b"
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => formatPkr(Number(val))}
                        width={72}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                        }}
                        itemStyle={{ color: "#22d3ee" }}
                        cursor={{ fill: "rgba(255,255,255,0.02)" }}
                        formatter={(value) => [formatPkr(Number(value)), "Revenue"]}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="url(#colorRevenue)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={60}
                      />
                      <Line
                        type="monotone"
                        dataKey="signups"
                        stroke="#a78bfa"
                        strokeWidth={2}
                        dot={{ fill: "#a78bfa", r: 3 }}
                        yAxisId="right"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#64748b"
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                    No revenue data available yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="rounded-xl border border-white/10 bg-[#0F172A]/80 backdrop-blur-xl p-4 sm:p-5 shadow-2xl overflow-hidden">
              <h2 className="text-base sm:text-lg font-bold text-white mb-3 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                Payment Approvals
              </h2>

              <div className="space-y-2.5">
                <StatRow
                  icon={CheckCircle2}
                  iconBg="bg-emerald-500/10 ring-emerald-500/20"
                  iconColor="text-emerald-400"
                  borderColor="border-l-emerald-500"
                  title="Accepted"
                  subtitle="Total approved payments"
                  value={metrics.stats.approved}
                />
                <StatRow
                  icon={XCircle}
                  iconBg="bg-rose-500/10 ring-rose-500/20"
                  iconColor="text-rose-400"
                  borderColor="border-l-rose-500"
                  title="Rejected"
                  subtitle="Failed verifications"
                  value={metrics.stats.rejected}
                />
                <StatRow
                  icon={Clock}
                  iconBg="bg-amber-500/10 ring-amber-500/20"
                  iconColor="text-amber-400"
                  borderColor="border-l-amber-500"
                  title="Pending"
                  subtitle="Awaiting your review"
                  value={metrics.stats.pending}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminPageLayout>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  color,
  bg,
}: {
  title: string;
  value: string | number | ReactNode;
  icon: LucideIcon;
  color: string;
  bg: string;
}) {
  const valueNode =
    typeof value === "string" || typeof value === "number" ? (
      <p className="text-2xl max-md:leading-none sm:text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-md tabular-nums">
        {value}
      </p>
    ) : (
      <div className="text-white drop-shadow-md max-md:[&_span]:text-xl max-md:[&_span:first-child]:text-2xl sm:[&_span:first-child]:text-3xl lg:[&_span:first-child]:text-4xl">
        {value}
      </div>
    );

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#0F172A]/90 to-[#1e293b]/50 p-3.5 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-cyan-500/30 hover:shadow-[0_10px_40px_-10px_rgba(34,211,238,0.25)] sm:min-h-[150px] sm:p-6">
      <div className="absolute -top-20 -right-20 w-48 h-48 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl transition-transform group-hover:scale-150 duration-700" />

      {/* Mobile: compact grid — icon beside title/value, no wide empty gap */}
      <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] gap-x-2.5 gap-y-1 sm:hidden">
        <p className="col-start-1 row-start-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">
          {title}
        </p>
        <div
          className={`col-start-2 row-start-1 row-span-2 self-center rounded-lg p-1.5 shadow-inner ring-1 ring-white/10 ${bg}`}
        >
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className="col-start-1 row-start-2 min-w-0">{valueNode}</div>
      </div>

      {/* sm+: original layout */}
      <div className="relative z-10 hidden min-h-[102px] flex-col justify-between sm:flex">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 sm:text-sm">{title}</p>
          <div className={`shrink-0 rounded-xl p-2 shadow-inner ring-1 ring-white/10 sm:p-3 ${bg}`}>
            <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${color}`} />
          </div>
        </div>
        <div className="mt-4 min-w-0 sm:mt-6">
          {typeof value === "string" || typeof value === "number" ? (
            <p className="text-3xl font-black tracking-tight text-white drop-shadow-md tabular-nums sm:text-4xl lg:text-5xl">
              {value}
            </p>
          ) : (
            <div className="text-white drop-shadow-md">{value}</div>
          )}
        </div>
      </div>
    </div>
  );
}
