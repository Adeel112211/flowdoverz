import { NextRequest, NextResponse } from "next/server";
import { getClientPurchasesPayload } from "@/lib/client-receipts";
import { requireActiveClientSession } from "@/lib/require-client-session";
import { publicMaintenanceResponse } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const maintenance = await publicMaintenanceResponse();
  if (maintenance) return maintenance;

  const gate = await requireActiveClientSession(request);
  if (!gate.ok) return gate.response;

  const { getDb } = await import("@/lib/firebase-admin");
  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
  }

  const { getReceiptWebsiteUrl } = await import("@/lib/receipt-barcode");
  const payload = await getClientPurchasesPayload(db, gate.email, getReceiptWebsiteUrl());

  return NextResponse.json({ success: true, ...payload });
}
