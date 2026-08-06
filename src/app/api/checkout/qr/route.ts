import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { RECEIPT_THEME as T } from "@/lib/receipt-theme";

export const dynamic = "force-dynamic";

/** Temporary checkout QR — encodes account number until real wallet QR images are uploaded. */
export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text")?.trim();
  if (!text) {
    return NextResponse.json({ success: false, error: "Missing text" }, { status: 400 });
  }

  const png = await QRCode.toBuffer(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 180,
    color: {
      dark: T.barcode,
      light: T.paper,
    },
    type: "png",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
