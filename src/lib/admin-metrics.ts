import { getDb } from "./firebase-admin";
import { planPricePkr } from "./admin-settings";
import { isPaidPlanId } from "./admin-client-view";

const METRICS_DOC = { collection: "settings", id: "metrics" };
const METRICS_VERSION = 2;

type MonthBucket = {
  month: string;
  revenue: number;
  signups: number;
  approved: number;
  rejected: number;
  pending: number;
  refunded: number;
  soloRevenue: number;
  teamRevenue: number;
};

export type StoredAdminMetrics = {
  version: number;
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
  soloRevenue: number;
  teamRevenue: number;
  signupsToday: number;
  signupsTodayDate: string;
  pendingApprovals: number;
  refundedPayments: number;
  stats: {
    approved: number;
    rejected: number;
    pending: number;
    refunded: number;
  };
  monthly: Record<string, MonthBucket>;
  updatedAt: string;
};

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function emptyMetrics(): StoredAdminMetrics {
  return {
    version: METRICS_VERSION,
    totalUsers: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    soloRevenue: 0,
    teamRevenue: 0,
    signupsToday: 0,
    signupsTodayDate: todayKey(),
    pendingApprovals: 0,
    refundedPayments: 0,
    stats: { approved: 0, rejected: 0, pending: 0, refunded: 0 },
    monthly: {},
    updatedAt: new Date().toISOString(),
  };
}

function normalizeMetrics(raw: Partial<StoredAdminMetrics> | undefined): StoredAdminMetrics {
  const base = emptyMetrics();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    stats: { ...base.stats, ...(raw.stats || {}) },
    monthly: raw.monthly || {},
  };
}

function rollSignupsToday(metrics: StoredAdminMetrics) {
  const today = todayKey();
  if (metrics.signupsTodayDate !== today) {
    metrics.signupsToday = 0;
    metrics.signupsTodayDate = today;
  }
}

function ensureMonth(metrics: StoredAdminMetrics, date: Date) {
  const key = monthKey(date);
  if (!metrics.monthly[key]) {
    metrics.monthly[key] = {
      month: monthName(date),
      revenue: 0,
      signups: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      refunded: 0,
      soloRevenue: 0,
      teamRevenue: 0,
    };
  }
  return metrics.monthly[key];
}

async function writeMetrics(metrics: StoredAdminMetrics) {
  const db = getDb();
  if (!db) return;
  metrics.version = METRICS_VERSION;
  metrics.updatedAt = new Date().toISOString();
  await db.collection(METRICS_DOC.collection).doc(METRICS_DOC.id).set(metrics);
}

export async function getStoredAdminMetrics(): Promise<StoredAdminMetrics | null> {
  const db = getDb();
  if (!db) return null;
  const snap = await db.collection(METRICS_DOC.collection).doc(METRICS_DOC.id).get();
  if (!snap.exists) return null;
  const value = normalizeMetrics(snap.data() as Partial<StoredAdminMetrics>);
  if (value.version !== METRICS_VERSION) return null;
  rollSignupsToday(value);
  return value;
}

export async function backfillAdminMetrics(): Promise<StoredAdminMetrics> {
  const db = getDb();
  const metrics = emptyMetrics();
  if (!db) return metrics;

  const { getSystemSettings } = await import("./admin-settings");
  const settings = await getSystemSettings();
  const now = new Date();
  const usersSnap = await db.collection("users").get();
  const paymentsSnap = await db.collection("manual_payments").get();

  usersSnap.forEach((doc) => {
    const data = doc.data();
    metrics.totalUsers += 1;
    const created = data.createdAt ? new Date(String(data.createdAt)) : null;
    if (created && !Number.isNaN(created.getTime())) {
      if (todayKey(created) === todayKey(now)) metrics.signupsToday += 1;
      ensureMonth(metrics, created).signups += 1;
    }
    const plan = String(data.subscriptionPlan || "none");
    const subExp = data.subscriptionExpiresAt ? new Date(String(data.subscriptionExpiresAt)) : null;
    if (isPaidPlanId(plan) && subExp && subExp > now) metrics.activeSubscriptions += 1;
  });

  paymentsSnap.forEach((doc) => {
    const data = doc.data();
    const status = String(data.status || "");
    const dateStr = String(data.processedAt || data.createdAt || "");
    const date = dateStr ? new Date(dateStr) : now;
    const bucket = ensureMonth(metrics, Number.isNaN(date.getTime()) ? now : date);
    const revenue = planPricePkr(String(data.planId || ""), settings);
    if (status === "approved") {
      metrics.stats.approved += 1;
      metrics.totalRevenue += revenue;
      bucket.approved += 1;
      bucket.revenue += revenue;
      if (data.planId === "team" || data.planId === "ultra") {
        metrics.teamRevenue += revenue;
        bucket.teamRevenue += revenue;
      } else {
        metrics.soloRevenue += revenue;
        bucket.soloRevenue += revenue;
      }
    } else if (status === "rejected") {
      metrics.stats.rejected += 1;
      bucket.rejected += 1;
    } else if (status === "pending") {
      metrics.stats.pending += 1;
      metrics.pendingApprovals += 1;
      bucket.pending += 1;
    } else if (status === "refunded") {
      metrics.stats.refunded += 1;
      metrics.refundedPayments += 1;
      bucket.refunded += 1;
    }
  });

  await writeMetrics(metrics);
  return metrics;
}

export async function getOrBackfillAdminMetrics() {
  const existing = await getStoredAdminMetrics();
  if (existing) return existing;
  return backfillAdminMetrics();
}

export async function patchAdminMetrics(
  mutator: (metrics: StoredAdminMetrics) => void,
) {
  const db = getDb();
  if (!db) return;
  try {
    const current = (await getStoredAdminMetrics()) || emptyMetrics();
    rollSignupsToday(current);
    mutator(current);
    await writeMetrics(current);
  } catch {
    // metrics must never fail the original write
  }
}

export async function recordUserCreated(createdAt = new Date(), activePaid = false) {
  await patchAdminMetrics((metrics) => {
    metrics.totalUsers += 1;
    metrics.signupsToday += 1;
    ensureMonth(metrics, createdAt).signups += 1;
    if (activePaid) metrics.activeSubscriptions += 1;
  });
}

export async function recordUserDeleted(wasActivePaid = false) {
  await patchAdminMetrics((metrics) => {
    metrics.totalUsers = Math.max(0, metrics.totalUsers - 1);
    if (wasActivePaid) metrics.activeSubscriptions = Math.max(0, metrics.activeSubscriptions - 1);
  });
}

export async function recordActiveSubscriptionDelta(delta: number) {
  if (!delta) return;
  await patchAdminMetrics((metrics) => {
    metrics.activeSubscriptions = Math.max(0, metrics.activeSubscriptions + delta);
  });
}

export async function recordPaymentStatusChange(input: {
  from?: string | null;
  to: string;
  planId?: string;
  at?: Date;
}) {
  const { getSystemSettings } = await import("./admin-settings");
  const settings = await getSystemSettings();
  const revenue = planPricePkr(input.planId, settings);
  const at = input.at || new Date();
  await patchAdminMetrics((metrics) => {
    const bucket = ensureMonth(metrics, at);
    const from = String(input.from || "");
    if (from === "pending") {
      metrics.stats.pending = Math.max(0, metrics.stats.pending - 1);
      metrics.pendingApprovals = Math.max(0, metrics.pendingApprovals - 1);
      bucket.pending = Math.max(0, bucket.pending - 1);
    } else if (from === "approved") {
      metrics.stats.approved = Math.max(0, metrics.stats.approved - 1);
      metrics.totalRevenue = Math.max(0, metrics.totalRevenue - revenue);
      bucket.approved = Math.max(0, bucket.approved - 1);
      bucket.revenue = Math.max(0, bucket.revenue - revenue);
    } else if (from === "rejected") {
      metrics.stats.rejected = Math.max(0, metrics.stats.rejected - 1);
      bucket.rejected = Math.max(0, bucket.rejected - 1);
    } else if (from === "refunded") {
      metrics.stats.refunded = Math.max(0, metrics.stats.refunded - 1);
      metrics.refundedPayments = Math.max(0, metrics.refundedPayments - 1);
      bucket.refunded = Math.max(0, bucket.refunded - 1);
    }

    if (input.to === "pending") {
      metrics.stats.pending += 1;
      metrics.pendingApprovals += 1;
      bucket.pending += 1;
    } else if (input.to === "approved") {
      metrics.stats.approved += 1;
      metrics.totalRevenue += revenue;
      bucket.approved += 1;
      bucket.revenue += revenue;
      if (input.planId === "team" || input.planId === "ultra") {
        metrics.teamRevenue += revenue;
        bucket.teamRevenue += revenue;
      } else {
        metrics.soloRevenue += revenue;
        bucket.soloRevenue += revenue;
      }
    } else if (input.to === "rejected") {
      metrics.stats.rejected += 1;
      bucket.rejected += 1;
    } else if (input.to === "refunded") {
      metrics.stats.refunded += 1;
      metrics.refundedPayments += 1;
      bucket.refunded += 1;
    }
  });
}

export function metricsToDashboard(metrics: StoredAdminMetrics, range: string) {
  rollSignupsToday(metrics);
  const allMonths = Object.keys(metrics.monthly).sort();
  let keys = allMonths;
  if (range !== "all_time" && /^\d{4}-\d{2}$/.test(range)) {
    keys = allMonths.filter((key) => key === range);
  } else if (range === "this_year") {
    const year = String(new Date().getFullYear());
    keys = allMonths.filter((key) => key.startsWith(`${year}-`));
  } else if (range === "this_month") {
    keys = allMonths.filter((key) => key === monthKey(new Date()));
  } else if (range === "last_month") {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    keys = allMonths.filter((key) => key === monthKey(d));
  }

  const useRange = range !== "all_time" && range !== "today" && range !== "last_7_days";
  const chartData = (useRange ? keys : allMonths).map((key) => ({
    month: metrics.monthly[key].month,
    revenue: metrics.monthly[key].revenue,
    signups: metrics.monthly[key].signups,
  }));

  if (useRange) {
    const sliced = keys.reduce(
      (acc, key) => {
        const bucket = metrics.monthly[key];
        acc.totalUsers += bucket.signups;
        acc.totalRevenue += bucket.revenue;
        acc.soloRevenue += bucket.soloRevenue;
        acc.teamRevenue += bucket.teamRevenue;
        acc.stats.approved += bucket.approved;
        acc.stats.rejected += bucket.rejected;
        acc.stats.pending += bucket.pending;
        acc.stats.refunded += bucket.refunded;
        return acc;
      },
      {
        totalUsers: 0,
        totalRevenue: 0,
        soloRevenue: 0,
        teamRevenue: 0,
        stats: { approved: 0, rejected: 0, pending: 0, refunded: 0 },
      },
    );
    return {
      totalUsers: sliced.totalUsers,
      activeSubscriptions: metrics.activeSubscriptions,
      totalRevenue: sliced.totalRevenue,
      pendingApprovals: metrics.pendingApprovals,
      refundedPayments: sliced.stats.refunded,
      signupsToday: metrics.signupsToday,
      soloRevenue: sliced.soloRevenue,
      teamRevenue: sliced.teamRevenue,
      stats: { ...sliced.stats, pending: metrics.pendingApprovals },
      chartData,
    };
  }

  return {
    totalUsers: range === "today" ? metrics.signupsToday : metrics.totalUsers,
    activeSubscriptions: metrics.activeSubscriptions,
    totalRevenue: metrics.totalRevenue,
    pendingApprovals: metrics.pendingApprovals,
    refundedPayments: metrics.refundedPayments,
    signupsToday: metrics.signupsToday,
    soloRevenue: metrics.soloRevenue,
    teamRevenue: metrics.teamRevenue,
    stats: metrics.stats,
    chartData,
  };
}
