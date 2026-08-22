import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { getDb } from "@/lib/firebase-admin";
import { getOrBackfillAdminMetrics, metricsToDashboard } from "@/lib/admin-metrics";
import { isPaidPlanId } from "@/lib/admin-client-view";

export async function GET(request: NextRequest) {
  const isAdmin = await isAdminRequest();
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
  }

  const range = request.nextUrl.searchParams.get("range") || "all_time";
  const rebuild = request.nextUrl.searchParams.get("rebuild") === "1";
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    const metrics = rebuild
      ? await (await import("@/lib/admin-metrics")).backfillAdminMetrics()
      : await getOrBackfillAdminMetrics();
    const dashboard = metricsToDashboard(metrics, range);
    if (range === "last_7_days") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      try {
        const usersSnap = await db
          .collection("users")
          .where("createdAt", ">=", start.toISOString())
          .get();
        dashboard.totalUsers = usersSnap.size;
      } catch {
        // keep counter estimate
      }
    }

    let expiringThisWeek = 0;
    try {
      const subSnap = await db
        .collection("users")
        .where("subscriptionExpiresAt", ">=", now.toISOString())
        .where("subscriptionExpiresAt", "<=", weekFromNow.toISOString())
        .get();
      subSnap.forEach((doc) => {
        if (isPaidPlanId(String(doc.data().subscriptionPlan || ""))) expiringThisWeek += 1;
      });
    } catch {
      expiringThisWeek = 0;
    }

    let pendingCount = dashboard.pendingApprovals;
    try {
      const pendingSnap = await db.collection("manual_payments").where("status", "==", "pending").get();
      pendingCount = pendingSnap.size;
    } catch {
      // keep counter
    }

    return NextResponse.json({
      success: true,
      metrics: {
        ...dashboard,
        expiringThisWeek,
        pendingApprovals: pendingCount,
        stats: { ...dashboard.stats, pending: pendingCount },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch dashboard data";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
