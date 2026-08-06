import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { getSystemSettings, planPricePkr } from "@/lib/admin-settings";
import { getDb } from "@/lib/firebase-admin";

const PAID_PLANS = new Set(["solo", "studio", "team", "nano", "ultra"]);

export async function GET(request: NextRequest) {
  const isAdmin = await isAdminRequest();
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
  }

  const settings = await getSystemSettings();
  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get("range") || "all_time";

  let startDate: Date | null = null;
  let endDate: Date | null = null;
  const now = new Date();

  switch (range) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "last_7_days":
      startDate = new Date();
      startDate.setDate(now.getDate() - 7);
      break;
    case "this_month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last_month":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case "this_year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      if (/^\d{4}-\d{2}$/.test(range)) {
        const [y, m] = range.split("-").map(Number);
        startDate = new Date(y, m - 1, 1);
        endDate = new Date(y, m, 0, 23, 59, 59, 999);
      }
      break;
  }

  const isWithinRange = (dateStr: string | undefined | null) => {
    if (!startDate && !endDate) return true;
    if (!dateStr) return !startDate && !endDate;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    const usersSnapshot = await db.collection("users").get();
    let totalUsers = 0;
    let activeSubscriptions = 0;
    let signupsToday = 0;
    let expiringThisWeek = 0;
    let soloRevenue = 0;
    let teamRevenue = 0;

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt;
      const plan = data.subscriptionPlan || "none";

      if (!startDate && !endDate) {
        totalUsers++;
      } else if (createdAt && isWithinRange(createdAt)) {
        totalUsers++;
      }

      if (createdAt && new Date(createdAt) >= startOfToday) {
        signupsToday++;
      }

      const subExp = data.subscriptionExpiresAt ? new Date(data.subscriptionExpiresAt) : null;
      if (PAID_PLANS.has(plan) && subExp && subExp > now) {
        activeSubscriptions++;
        if (subExp <= weekFromNow) expiringThisWeek++;
      }
    });

    const paymentsSnapshot = await db.collection("manual_payments").get();
    let totalRevenue = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let refundedCount = 0;

    const monthlyRevenue = new Map<string, { month: string; revenue: number }>();
    const monthlySignups = new Map<string, { month: string; signups: number }>();

    const getMonthKey = (dateString: string) => {
      const d = new Date(dateString);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    const getMonthName = (dateString: string) => {
      const d = new Date(dateString);
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    };

    usersSnapshot.forEach((doc) => {
      const createdAt = doc.data().createdAt;
      if (!createdAt) return;
      if ((startDate || endDate) && !isWithinRange(createdAt)) return;
      const monthKey = getMonthKey(createdAt);
      if (!monthlySignups.has(monthKey)) {
        monthlySignups.set(monthKey, { month: getMonthName(createdAt), signups: 0 });
      }
      monthlySignups.get(monthKey)!.signups += 1;
    });

    paymentsSnapshot.forEach((doc) => {
      const data = doc.data();
      const planId = data.planId as string | undefined;
      const status = data.status;
      const dateStr = data.processedAt || data.createdAt;

      if ((startDate || endDate) && !isWithinRange(dateStr)) return;

      if (status === "approved") {
        approvedCount++;
        const planRevenue = planPricePkr(planId, settings);
        totalRevenue += planRevenue;
        if (planId === "team" || planId === "ultra") teamRevenue += planRevenue;
        else soloRevenue += planRevenue;

        if (dateStr) {
          const monthKey = getMonthKey(dateStr);
          if (!monthlyRevenue.has(monthKey)) {
            monthlyRevenue.set(monthKey, { month: getMonthName(dateStr), revenue: 0 });
          }
          monthlyRevenue.get(monthKey)!.revenue += planRevenue;
        }
      } else if (status === "rejected") {
        rejectedCount++;
      } else if (status === "pending") {
        pendingCount++;
      } else if (status === "refunded") {
        refundedCount++;
      }
    });

    const allMonths = new Set([...monthlyRevenue.keys(), ...monthlySignups.keys()]);
    const chartData = Array.from(allMonths)
      .sort()
      .map((key) => ({
        month: monthlyRevenue.get(key)?.month || monthlySignups.get(key)!.month,
        revenue: monthlyRevenue.get(key)?.revenue || 0,
        signups: monthlySignups.get(key)?.signups || 0,
      }));

    return NextResponse.json({
      success: true,
      metrics: {
        totalUsers,
        activeSubscriptions,
        totalRevenue,
        pendingApprovals: pendingCount,
        refundedPayments: refundedCount,
        signupsToday,
        expiringThisWeek,
        soloRevenue,
        teamRevenue,
        stats: {
          approved: approvedCount,
          rejected: rejectedCount,
          pending: pendingCount,
          refunded: refundedCount,
        },
        chartData,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch dashboard data";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
