import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { purgeDatabaseStorage } from "@/lib/client-data-cleanup";
import { FIREBASE_QUOTA_MESSAGE, isFirebaseQuotaError } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "purge_all");

  try {
    if (action === "purge_stale_clients") {
      const { purgeStaleClients } = await import("@/lib/client-data-cleanup");
      const result = await purgeStaleClients();
      await logAdminActivity({
        action: "client_deleted",
        detail: `Purged ${result.deleted} inactive/unverified client(s). Kept ${result.kept} active.`,
      });
      return NextResponse.json({ success: true, result });
    }

    if (action === "purge_old_payments") {
      const { purgeOldPaymentRecords } = await import("@/lib/client-data-cleanup");
      const maxAgeDays = Math.max(7, Math.floor(Number(body.maxAgeDays) || 90));
      const result = await purgeOldPaymentRecords(maxAgeDays);
      await logAdminActivity({
        action: "settings_updated",
        detail: `Purged ${result.deleted} old payment record(s) older than ${maxAgeDays} days.`,
      });
      return NextResponse.json({ success: true, result });
    }

    if (action === "purge_old_logs") {
      const { purgeOldLogRecords } = await import("@/lib/client-data-cleanup");
      const maxAgeDays = Math.max(7, Math.floor(Number(body.maxAgeDays) || 90));
      const result = await purgeOldLogRecords(maxAgeDays);
      await logAdminActivity({
        action: "settings_updated",
        detail: `Purged old logs older than ${maxAgeDays} days.`,
      });
      return NextResponse.json({ success: true, result });
    }

    const result = await purgeDatabaseStorage({
      purgeStaleClients: action === "purge_all" || body.purgeStaleClients !== false,
      purgeOldPayments: action === "purge_all" || body.purgeOldPayments !== false,
      purgeOldExtensions: action === "purge_all" || action === "purge_extensions" || body.purgeOldExtensions !== false,
      purgeEmptyCookieSlots: action === "purge_all" || action === "purge_extensions" || body.purgeEmptyCookieSlots !== false,
      purgeOldLogs: action === "purge_all" || body.purgeOldLogs !== false,
      paymentMaxAgeDays: Math.max(7, Math.floor(Number(body.paymentMaxAgeDays) || 90)),
      logMaxAgeDays: Math.max(7, Math.floor(Number(body.logMaxAgeDays) || 90)),
    });

    await logAdminActivity({
      action: "settings_updated",
      detail: `Database storage purge (${action}) completed.`,
    });

    return NextResponse.json({
      success: true,
      result,
      message:
        "Storage purge completed. Active user accounts, live cookie slots, and the latest extension were kept.",
    });
  } catch (error) {
    console.error("Storage purge failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: isFirebaseQuotaError(error) ? FIREBASE_QUOTA_MESSAGE : "Storage purge failed.",
      },
      { status: isFirebaseQuotaError(error) ? 503 : 500 },
    );
  }
}
