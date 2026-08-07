import { NextRequest, NextResponse } from "next/server";
import { getClientPurchasesPayload } from "@/lib/client-receipts";
import { getClientSessionFromRequest } from "@/lib/client-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = getClientSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
  }

  const { getDb } = await import("@/lib/firebase-admin");
  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
  }

  const { getReceiptWebsiteUrl } = await import("@/lib/receipt-barcode");
  const payload = await getClientPurchasesPayload(db, session.email, getReceiptWebsiteUrl());

  return NextResponse.json({ success: true, ...payload });
}
