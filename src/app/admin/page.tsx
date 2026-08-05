"use client";

import { useEffect, useRef, useState } from "react";
import {
  Users,
  CreditCard,
  Activity,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { AdminPageHeader } from "@/components/admin-page-header";

type DashboardMetrics = {
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
  pendingApprovals: number;
  refundedPayments: number;
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
    <div className="relative z-30 w-full sm:w-auto sm:min-w-[12rem]">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((open) => !open);
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`flex w-full sm:w-48 md:w-56 items-center justify-between gap-2 bg-[#0F172A]/95 border text-white font-semibold rounded-xl p-3 backdrop-blur-xl shadow-lg transition-all cursor-pointer hover:bg-white/5 ${
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
      className={`flex max-sm:flex-col max-sm:items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-xl bg-gradient-to-r from-white/5 to-transparent border border-white/5 border-l-4 ${borderColor} shadow-sm transition-all hover:-translate-y-1 hover:bg-white/10`}
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className={`p-2.5 sm:p-3 ${iconBg} rounded-xl shadow-inner ring-1 ring-white/10 shrink-0`}>
          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor} drop-shadow-md`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">
            {title}
          </p>
          <p className="text-xs font-medium text-slate-500 mt-1">{subtitle}</p>
        </div>
      </div>
      <div className="text-3xl sm:text-4xl font-black text-white shrink-0">{value}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("all_time");

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
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
        setLoading(false);
      }
    };
    fetchMetrics();
  }, [timeRange]);

  if (loading || !metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
        <span className="text-sm font-bold tracking-widest text-cyan-400 uppercase animate-pulse">Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-w-0 max-w-full overflow-x-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      <AdminPageHeader
        title="Admin Dashboard"
        description="Welcome back. Here is what is happening with FlowDoverz today."
        actions={<DateRangeDropdown value={timeRange} onChange={setTimeRange} />}
      />

      <div className="flex flex-col gap-6 lg:gap-8 min-w-0 max-w-full w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
          <MetricCard
            title="Total Users"
            value={metrics.totalUsers}
            icon={Users}
            color="text-emerald-400"
            bg="bg-emerald-400/10"
          />
          <MetricCard
            title="Active Subscriptions"
            value={metrics.activeSubscriptions}
            icon={Activity}
            color="text-cyan-400"
            bg="bg-cyan-400/10"
          />
          <MetricCard
            title="Total Revenue"
            value={`$${metrics.totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            color="text-purple-400"
            bg="bg-purple-400/10"
          />
          <MetricCard
            title="Pending Approvals"
            value={metrics.pendingApprovals}
            icon={Clock}
            color="text-amber-400"
            bg="bg-amber-400/10"
          />
          <MetricCard
            title="Refunded Payments"
            value={metrics.refundedPayments}
            icon={RotateCcw}
            color="text-slate-400"
            bg="bg-slate-400/10"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          <div className="xl:col-span-2 flex flex-col">
            <div className="flex flex-col rounded-xl border border-white/10 bg-[#0F172A]/80 backdrop-blur-xl p-4 sm:p-6 lg:p-8 shadow-2xl">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Revenue Overview
              </h2>
              <div className="w-full min-h-[280px] sm:min-h-[320px] lg:min-h-[360px]">
                {metrics.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
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
                        tickFormatter={(val) => `$${val}`}
                        width={48}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                        }}
                        itemStyle={{ color: "#22d3ee" }}
                        cursor={{ fill: "rgba(255,255,255,0.02)" }}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="url(#colorRevenue)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={60}
                      />
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full min-h-[280px] items-center justify-center text-slate-500 text-sm">
                    No revenue data available yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="rounded-xl border border-white/10 bg-[#0F172A]/80 backdrop-blur-xl p-4 sm:p-6 lg:p-8 shadow-2xl flex flex-col min-h-[420px] sm:min-h-[480px]">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                Payment Approvals
              </h2>

              <div className="space-y-3 sm:space-y-4">
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
    </div>
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
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[#0F172A]/90 to-[#1e293b]/50 backdrop-blur-md p-4 sm:p-6 shadow-2xl relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-[0_10px_40px_-10px_rgba(34,211,238,0.25)] flex flex-col justify-between min-h-[120px] sm:min-h-[150px]">
      <div className="absolute -top-20 -right-20 w-48 h-48 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl transition-transform group-hover:scale-150 duration-700" />

      <div className="flex justify-between items-start relative z-10 gap-3">
        <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider">
          {title}
        </p>
        <div className={`p-2 sm:p-3 rounded-xl ${bg} shadow-inner ring-1 ring-white/10 shrink-0`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color}`} />
        </div>
      </div>

      <div className="relative z-10 mt-4 sm:mt-6">
        <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-md break-words">
          {value}
        </p>
      </div>
    </div>
  );
}
