import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getReceiptWebsiteUrl } from "@/lib/receipt-barcode";
import { RECEIPT_THEME as T } from "@/lib/receipt-theme";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")?.trim();
  const target = raw || getReceiptWebsiteUrl();

  if (!/^https?:\/\//i.test(target)) {
    return NextResponse.json({ success: false, error: "Invalid URL" }, { status: 400 });
  }

  const png = await QRCode.toBuffer(target, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 168,
    color: {
      dark: T.barcode,
      light: T.paper,
    },
    type: "png",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
