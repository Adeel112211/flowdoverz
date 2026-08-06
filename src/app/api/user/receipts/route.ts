import { NextRequest, NextResponse } from "next/server";
import { getClientPurchasesPayload } from "@/lib/client-receipts";

function emailFromSid(sid: string): string | null {
  try {
    const padded = sid + "=".repeat((4 - (sid.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const parts = decoded.split(":");
    if (parts[0] === "fb" && parts[1]) {
      return parts[1].toLowerCase();
    }
  } catch {
    // fall through
  }
  return null;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sid = request.cookies.get("flowdoverz_sid")?.value;
  if (!sid) {
    return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
  }

  const email = emailFromSid(sid);
  if (!email) {
    return NextResponse.json({ success: false, error: "Invalid session" }, { status: 401 });
  }

  const { getDb } = await import("@/lib/firebase-admin");
  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
  }

  const { getReceiptWebsiteUrl } = await import("@/lib/receipt-barcode");
  const payload = await getClientPurchasesPayload(db, email, getReceiptWebsiteUrl());

  return NextResponse.json({ success: true, ...payload });
}
