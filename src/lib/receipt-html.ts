/** Shared thermal-receipt markup + helpers (dashboard + email). */

import type { EmailTemplateStyle, EmailThemeColors } from "./email-theme";
import { resolveReceiptTheme, RECEIPT_THEME, type ReceiptTheme } from "./receipt-theme";

export type ThermalReceiptFields = {
  receiptNumber: string;
  planName: string;
  amountLabel: string;
  transactionId: string;
  paymentDateLabel: string;
  expiryDateLabel?: string;
  userName?: string;
  accountNumber?: string;
  brandName?: string;
};

export type ReceiptTemplateText = {
  brandName?: string;
  receiptLabel?: string;
  footerNote?: string;
};

export type ReceiptVariant = "payment" | "refund";

export const DEFAULT_RECEIPT_TEXT: Required<ReceiptTemplateText> = {
  brandName: "FLOWDOVERZ",
  receiptLabel: "RECEIPT",
  footerNote: "Thank you for your payment. Keep this receipt for your records.",
};

export const DEFAULT_REFUND_RECEIPT_TEXT: Required<ReceiptTemplateText> = {
  brandName: "FLOWDOVERZ",
  receiptLabel: "REFUND",
  footerNote: "This confirms your payment was refunded. Keep this receipt for your records.",
};

function metaRow(
  label: string,
  value: string,
  theme: ReceiptTheme,
  valueColor: string = theme.text,
  labelColor: string = theme.textMuted,
  valueSize = "12px",
) {
  return `<tr>
  <td style="padding:9px 0;color:${labelColor};font-family:'Courier New',Courier,monospace;font-size:12px;white-space:nowrap;vertical-align:top;">${label}</td>
  <td style="padding:9px 0 9px 16px;color:${valueColor};font-family:'Courier New',Courier,monospace;font-size:${valueSize};font-weight:700;text-align:right;word-break:break-word;vertical-align:top;">${value}</td>
</tr>`;
}

export function buildThermalReceiptEmailHtml(options?: {
  variant?: ReceiptVariant;
  theme?: ReceiptTheme;
  emailColors?: Partial<EmailThemeColors>;
  style?: EmailTemplateStyle;
  text?: ReceiptTemplateText;
}) {
  const variant = options?.variant || "payment";
  const baseTheme =
    options?.theme || resolveReceiptTheme(options?.emailColors, options?.style || "modern");
  const T =
    variant === "refund"
      ? { ...baseTheme, total: "#f87171", accent: "#fb7185" }
      : baseTheme;
  const defaults = variant === "refund" ? DEFAULT_REFUND_RECEIPT_TEXT : DEFAULT_RECEIPT_TEXT;
  const text = { ...defaults, ...options?.text };
  const totalLabel = variant === "refund" ? "Refunded" : "Total";
  const metaRows =
    variant === "refund"
      ? `${metaRow("Refund receipt", "{{refundReceiptNumber}}", T)}
        ${metaRow("Original receipt", "{{receiptNumber}}", T)}
        ${metaRow("Paid on", "{{paymentDate}}", T)}
        ${metaRow("Refunded on", "{{refundDate}}", T, "#f87171")}`
      : `${metaRow("Receipt", "{{receiptNumber}}", T)}
        ${metaRow("Paid on", "{{paymentDate}}", T)}
        ${metaRow("Valid until", "{{expiryDate}}", T)}`;

  return `<div style="margin:0;text-align:center;">
  <div style="display:inline-block;max-width:380px;width:100%;filter:drop-shadow(${T.glow});border-radius:16px;overflow:hidden;">
    <div style="background:${T.paper};padding:32px 28px 28px;text-align:center;min-height:420px;">
      <p style="margin:0 0 10px 0;font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:4px;color:${T.textMuted};">***</p>
      <p style="margin:0 0 8px 0;font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:700;letter-spacing:5px;color:${T.text};">${text.receiptLabel}</p>
      <p style="margin:0 0 16px 0;font-family:'Courier New',Courier,monospace;font-size:17px;font-weight:800;letter-spacing:3px;color:${T.accent};">${text.brandName}</p>
      <div style="height:4px;margin:0 auto 22px;max-width:140px;background:${T.gradient};border-radius:999px;"></div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;text-align:left;margin:0 0 20px;">
        ${metaRow("Name", "{{userName}}", T)}
        ${metaRow("Account#", "{{accountNumber}}", T, T.accent)}
      </table>
      <div style="border-top:1px solid ${T.divider};margin:0 0 18px;"></div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;text-align:left;margin:0 0 6px;">
        ${metaRow("{{planName}} plan", "{{amountPkr}}", T, T.accent, T.textSoft)}
        ${metaRow(totalLabel, "{{amountPkr}}", T, T.total, T.text, "15px")}
      </table>
      <div style="border-top:1px solid ${T.divider};margin:18px 0;"></div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;text-align:left;">
        ${metaRows}
      </table>
      <p style="margin:24px 0 0;font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:4px;color:${T.textMuted};">***</p>
      {{receiptBarcode}}
    </div>
  </div>
</div>
<p style="margin:20px 0 0;color:${T.textSoft};font-size:12px;text-align:center;font-family:'Courier New',Courier,monospace;">${text.footerNote}</p>`;
}

export function buildReceiptHtmlForTemplate(
  emailColors?: Partial<EmailThemeColors>,
  style: EmailTemplateStyle = "modern",
  text?: ReceiptTemplateText,
  variant: ReceiptVariant = "payment",
) {
  return buildThermalReceiptEmailHtml({ emailColors, style, text, variant });
}

export function receiptTextFromTemplateFields(fields: {
  heading?: string;
  badge?: string;
  footerText?: string;
}): ReceiptTemplateText {
  return {
    brandName: fields.heading?.trim() || DEFAULT_RECEIPT_TEXT.brandName,
    receiptLabel: fields.badge?.trim() || DEFAULT_RECEIPT_TEXT.receiptLabel,
    footerNote: fields.footerText?.trim() || DEFAULT_RECEIPT_TEXT.footerNote,
  };
}
