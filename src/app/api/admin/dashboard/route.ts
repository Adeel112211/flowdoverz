import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const isAdmin = await isAdminRequest();
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
  }

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
    case "all_time":
      startDate = null;
      endDate = null;
      break;
    default:
      // Check for YYYY-MM format
      if (/^\d{4}-\d{2}$/.test(range)) {
        const [y, m] = range.split("-").map(Number);
        startDate = new Date(y, m - 1, 1);
        // End date is the last day of that month
        endDate = new Date(y, m, 0, 23, 59, 59, 999);
      } else {
        startDate = null;
        endDate = null;
      }
      break;
  }

  const isWithinRange = (dateStr: string | undefined | null) => {
    if (!startDate && !endDate) return true; // all_time includes everything
    if (!dateStr) return true; // Include items without dates just in case, or maybe false? Let's assume if it has no date, we only include it in all_time. Wait, actually if no date is present, and we selected a specific range, we should return false.
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  try {
    // 1. Fetch Users Data
    const usersSnapshot = await db.collection("users").get();
    let totalUsers = 0;
    let activeSubscriptions = 0;

    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt || data.created_at;
      if (!startDate && !endDate) {
        // all time
        totalUsers++;
        if (data.subscriptionPlan === "studio" || data.subscriptionPlan === "team") {
          activeSubscriptions++;
        }
      } else if (createdAt && isWithinRange(createdAt)) {
        totalUsers++;
        if (data.subscriptionPlan === "studio" || data.subscriptionPlan === "team") {
          activeSubscriptions++;
        }
      }
    });

    // 2. Fetch Payments Data for Revenue and Stats
    const paymentsSnapshot = await db.collection("manual_payments").get();
    let totalRevenue = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let refundedCount = 0;

    // Monthly Data Aggregation
    const monthlyDataMap = new Map<string, { month: string; revenue: number; signups: number }>();

    // Helper to get Year-Month string e.g. "2026-08"
    const getMonthKey = (dateString: string) => {
      const d = new Date(dateString);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    // Helper to get formatted month name e.g. "Aug 2026"
    const getMonthName = (dateString: string) => {
      const d = new Date(dateString);
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    };

    paymentsSnapshot.forEach((doc) => {
      const data = doc.data();
      const planId = data.planId;
      const status = data.status;
      const dateStr = data.processedAt || data.createdAt; 
      
      // If we have a specific range filter, and the payment has no date, exclude it
      if ((startDate || endDate) && !isWithinRange(dateStr)) return;

      if (status === "approved") {
        approvedCount++;
        // Calculate Revenue
        const planRevenue = planId === "studio" ? 29 : planId === "team" ? 79 : 0;
        totalRevenue += planRevenue;

        // Add to monthly revenue (Only if we are in 'all_time' or if we want to show a chart, wait the chart shows monthly trends. If we filter by 'today', chart only has 1 column. That's fine)
        if (dateStr) {
          const monthKey = getMonthKey(dateStr);
          if (!monthlyDataMap.has(monthKey)) {
            monthlyDataMap.set(monthKey, { month: getMonthName(dateStr), revenue: 0, signups: 0 });
          }
          monthlyDataMap.get(monthKey)!.revenue += planRevenue;
          monthlyDataMap.get(monthKey)!.signups += 1;
        }
      } else if (status === "rejected") {
        rejectedCount++;
      } else if (status === "pending") {
        pendingCount++;
      } else if (status === "refunded") {
        refundedCount++;
      }
    });

    // Sort monthly data chronologically
    const chartData = Array.from(monthlyDataMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map((entry) => entry[1]);

    return NextResponse.json({
      success: true,
      metrics: {
        totalUsers,
        activeSubscriptions,
        totalRevenue,
        pendingApprovals: pendingCount,
        refundedPayments: refundedCount,
        stats: {
          approved: approvedCount,
          rejected: rejectedCount,
          pending: pendingCount,
          refunded: refundedCount
        },
        chartData
      }
    });
  } catch (error: any) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
