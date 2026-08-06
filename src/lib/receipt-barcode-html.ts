import { RECEIPT_THEME as T } from "./receipt-theme";

export function getReceiptWebsiteUrlClient(fallback = "https://flowdoverz.app") {
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }
  return fallback.replace(/\/$/, "");
}

export function buildReceiptScanCodeHtmlFromDataUrl(dataUrl: string, url: string) {
  const label = url.replace(/^https?:\/\//, "");

  return `<div style="margin:16px auto 0;text-align:center;">
  <img src="${dataUrl}" alt="Scan to visit ${label}" width="168" height="168" style="display:block;margin:0 auto;border:0;" />
  <p style="margin:8px 0 0;font-family:'Courier New',Courier,monospace;font-size:10px;color:${T.textMuted};">Scan to visit ${label}</p>
</div>`;
}

/** CID reference for nodemailer inline attachments (works in Gmail, Outlook, etc.). */
export function buildReceiptScanCodeHtmlWithCid(cid: string, url: string) {
  const label = url.replace(/^https?:\/\//, "");

  return `<div style="margin:16px auto 0;text-align:center;">
  <img src="cid:${cid}" alt="Scan to visit ${label}" width="168" height="168" style="display:block;margin:0 auto;border:0;" />
  <p style="margin:8px 0 0;font-family:'Courier New',Courier,monospace;font-size:10px;color:${T.textMuted};">Scan to visit ${label}</p>
</div>`;
}

/** Fetch QR PNG from the app API and return embeddable receipt HTML (works in email preview iframes). */
export async function fetchReceiptScanCodeHtml(scanUrl: string) {
  const res = await fetch(`/api/receipt/qr?url=${encodeURIComponent(scanUrl)}`);
  if (!res.ok) throw new Error("Failed to load receipt QR code");
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return buildReceiptScanCodeHtmlFromDataUrl(dataUrl, scanUrl);
}
