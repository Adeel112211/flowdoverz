import { NextRequest, NextResponse } from "next/server";
import { getClientPurchasesPayload, listAllPurchases } from "@/lib/client-receipts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { isAdminUiRequest } = await import("@/lib/admin");
  if (!(await isAdminUiRequest(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { getDb } = await import("@/lib/firebase-admin");
  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
  }

  const { getReceiptWebsiteUrl } = await import("@/lib/receipt-barcode");
  const scanUrl = getReceiptWebsiteUrl();
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();

  if (email) {
    const payload = await getClientPurchasesPayload(db, email, scanUrl);
    return NextResponse.json({ success: true, ...payload });
  }

  const purchases = await listAllPurchases(db, scanUrl);
  return NextResponse.json({ success: true, purchases });
}
