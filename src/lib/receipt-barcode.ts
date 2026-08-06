import QRCode from "qrcode";
import { buildReceiptScanCodeHtmlFromDataUrl, buildReceiptScanCodeHtmlWithCid } from "./receipt-barcode-html";
import { RECEIPT_THEME as T } from "./receipt-theme";
import { getAppUrl } from "@/lib/site-urls";

export const RECEIPT_QR_CID = "receipt-qr@flowdoverz";

export function getReceiptWebsiteUrl() {
  return getAppUrl();
}

export async function buildReceiptScanCodePngBuffer(url?: string) {
  const target = url || getReceiptWebsiteUrl();
  return QRCode.toBuffer(target, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 168,
    color: {
      dark: T.barcode,
      light: T.paper,
    },
    type: "png",
  });
}

export async function buildReceiptScanCodeDataUrl(url?: string) {
  const target = url || getReceiptWebsiteUrl();
  return QRCode.toDataURL(target, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 168,
    color: {
      dark: T.barcode,
      light: T.paper,
    },
  });
}

/** Inline QR for real emails — uses CID attachment (data URLs are blocked by Gmail/Outlook). */
export async function buildReceiptScanCodeHtmlForEmail(url?: string) {
  const target = url || getReceiptWebsiteUrl();
  return buildReceiptScanCodeHtmlWithCid(RECEIPT_QR_CID, target);
}

export async function buildReceiptScanCodeHtml(url?: string) {
  const target = url || getReceiptWebsiteUrl();
  const dataUrl = await buildReceiptScanCodeDataUrl(target);
  return buildReceiptScanCodeHtmlFromDataUrl(dataUrl, target);
}

/** @deprecated Use buildReceiptScanCodeHtml — kept for template placeholder name. */
export async function buildReceiptBarcodeHtml(_receiptNumber?: string, url?: string) {
  return buildReceiptScanCodeHtml(url);
}

export { buildReceiptScanCodeHtmlFromDataUrl } from "./receipt-barcode-html";
