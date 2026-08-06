import nodemailer from "nodemailer";
import { randomBytes } from "crypto";
import { type EmailTemplateId } from "@/lib/email-templates-defaults";
import { renderTemplateEmail } from "@/lib/email-render";
import { applyTemplatePlaceholders } from "@/lib/email-templates-defaults";
import { getMergedTemplate, getSmtpConfig } from "@/lib/smtp-store";

const APP_URL = (
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://flowdoverz.app"
).replace(/\/$/, "");

async function resolveMailConfig() {
  const stored = await getSmtpConfig();
  return {
    host: stored.host || process.env.SMTP_HOST || "",
    port: stored.port || parseInt(process.env.SMTP_PORT || "587", 10),
    user: stored.user || process.env.SMTP_USER || "",
    pass: stored.pass || process.env.SMTP_PASS || "",
    from: stored.from || process.env.SMTP_FROM || "",
    replyTo: stored.replyTo || process.env.SMTP_REPLY_TO || stored.user || process.env.SMTP_USER || "",
    adminEmail: stored.adminEmail || stored.user || process.env.SMTP_USER || "",
    enabled: stored.enabled !== false,
    brandName: stored.brandName || "FlowDoverz",
    logoUrl: stored.logoUrl,
    defaultStyle: stored.defaultStyle,
    defaultColors: stored.defaultColors,
  };
}

async function createTransporter() {
  const cfg = await resolveMailConfig();
  return {
    cfg,
    transporter: nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      requireTLS: cfg.port !== 465,
      auth: { user: cfg.user, pass: cfg.pass },
      tls: { minVersion: "TLSv1.2" },
    }),
  };
}

async function senderAddress() {
  const cfg = await resolveMailConfig();
  if (cfg.from) return cfg.from;
  if (cfg.user) return `"FlowDoverz" <${cfg.user}>`;
  return '"FlowDoverz" <noreply@flowdoverz.app>';
}

async function replyToAddress() {
  const cfg = await resolveMailConfig();
  return cfg.replyTo || cfg.user || "support@flowdoverz.app";
}

function senderDomain(from: string, user: string) {
  const match = (from || user).match(/@([\w.-]+)/);
  return match?.[1] || "flowdoverz.app";
}

async function buildMessageId(from: string, user: string) {
  const domain = senderDomain(from, user);
  return `<${Date.now()}.${randomBytes(8).toString("hex")}@${domain}>`;
}

export async function sendRawEmail({
  to,
  subject,
  html,
  text,
  type = "general",
  attachments,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  type?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    cid: string;
    contentDisposition?: "inline" | "attachment";
  }>;
}) {
  const { cfg, transporter } = await createTransporter();
  if (!cfg.enabled || !cfg.host || !cfg.user || !cfg.pass) {
    console.warn("Email config missing. Skipping sending email to:", to);
    return false;
  }

  try {
    const from = await senderAddress();
    const replyTo = await replyToAddress();
    const info = await transporter.sendMail({
      from,
      replyTo,
      to,
      subject,
      text,
      html,
      attachments,
      date: new Date(),
      headers: {
        "Message-ID": await buildMessageId(from, cfg.user),
      },
    });
    console.log("Message sent: %s", info.messageId);
    const { logEmailSent } = await import("@/lib/email-log");
    await logEmailSent({ to, subject, type, status: "sent" });
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    const { logEmailSent } = await import("@/lib/email-log");
    await logEmailSent({
      to,
      subject,
      type,
      status: "failed",
      error: error instanceof Error ? error.message : "Send failed",
    });
    return false;
  }
}

function buildTemplateVars(input: Record<string, string>) {
  const vars: Record<string, string> = { "{{appUrl}}": APP_URL };
  for (const [key, value] of Object.entries(input)) {
    const token = key.startsWith("{{") ? key : `{{${key}}}`;
    vars[token] = value;
  }
  return vars;
}

export async function sendTemplateEmail(
  templateId: EmailTemplateId,
  to: string,
  input: Record<string, string>,
) {
  const template = await getMergedTemplate(templateId);
  const cfg = await resolveMailConfig();
  const vars = buildTemplateVars({ ...input, email: input.email || to });
  const replyTo = await replyToAddress();
  const isReceiptEmail =
    templateId === "payment_receipt" || templateId === "payment_refund_receipt";

  let attachments:
    | Array<{
        filename: string;
        content: Buffer;
        cid: string;
        contentDisposition: "inline";
      }>
    | undefined;

  if (isReceiptEmail) {
    const {
      buildReceiptScanCodeHtmlForEmail,
      buildReceiptScanCodePngBuffer,
      RECEIPT_QR_CID,
    } = await import("@/lib/receipt-barcode");
    vars["{{receiptBarcode}}"] = await buildReceiptScanCodeHtmlForEmail();
    attachments = [
      {
        filename: "receipt-qr.png",
        content: await buildReceiptScanCodePngBuffer(),
        cid: RECEIPT_QR_CID,
        contentDisposition: "inline",
      },
    ];
  }

  const { subject, text, html } = renderTemplateEmail(template, vars, {
    supportEmail: replyTo,
    appUrl: APP_URL,
    brandName: cfg.brandName,
    defaultStyle: cfg.defaultStyle,
    defaultLogoUrl: cfg.logoUrl,
    defaultColors: cfg.defaultColors,
  });

  return sendRawEmail({ to, subject, text, html, type: templateId, attachments });
}

export async function sendPaymentPendingEmail(email: string) {
  return sendTemplateEmail("payment_pending", email, { email });
}

export async function sendAccountActivatedEmail(
  email: string,
  planName: string,
  activationDateStr: string = new Date().toISOString(),
  expiryDateStr: string = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
) {
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  return sendTemplateEmail("account_activated", email, {
    email,
    planName,
    activationDate: formatDate(activationDateStr),
    expiryDate: formatDate(expiryDateStr),
  });
}

export async function sendPaymentReceiptEmail(input: {
  email: string;
  userName: string;
  accountNumber: string;
  receiptNumber: string;
  planName: string;
  amountPkr: number;
  transactionId: string;
  paymentDate: string;
  expiryDate: string;
}) {
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-PK", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const { formatPkr } = await import("@/lib/receipt-utils");

  return sendTemplateEmail("payment_receipt", input.email, {
    email: input.email,
    userName: input.userName,
    accountNumber: input.accountNumber,
    receiptNumber: input.receiptNumber,
    planName: input.planName,
    amountPkr: formatPkr(input.amountPkr),
    transactionId: input.transactionId,
    paymentDate: formatDate(input.paymentDate),
    expiryDate: formatDate(input.expiryDate),
  });
}

export async function sendPaymentRefundReceiptEmail(input: {
  email: string;
  userName: string;
  accountNumber: string;
  receiptNumber: string;
  refundReceiptNumber: string;
  planName: string;
  amountPkr: number;
  transactionId: string;
  paymentDate: string;
  refundDate: string;
}) {
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-PK", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const { formatPkr } = await import("@/lib/receipt-utils");

  return sendTemplateEmail("payment_refund_receipt", input.email, {
    email: input.email,
    userName: input.userName,
    accountNumber: input.accountNumber,
    receiptNumber: input.receiptNumber,
    refundReceiptNumber: input.refundReceiptNumber,
    planName: input.planName,
    amountPkr: formatPkr(input.amountPkr),
    transactionId: input.transactionId,
    paymentDate: formatDate(input.paymentDate),
    refundDate: formatDate(input.refundDate),
  });
}

export async function sendAdminNotificationEmail(clientEmail: string, planId: string) {
  const cfg = await resolveMailConfig();
  const { getSystemSettings } = await import("@/lib/admin-settings");
  const system = await getSystemSettings();
  const adminEmail = cfg.adminEmail || system.adminNotificationEmail;
  if (!adminEmail) return false;

  const planLabel = planId === "solo" ? "Solo" : planId === "team" ? "Team" : planId;

  return sendTemplateEmail("admin_new_payment", adminEmail, {
    clientEmail,
    planId,
    planName: planLabel,
    email: adminEmail,
  });
}

export async function sendSubscriptionExpiredEmail(email: string, planName: string) {
  return sendTemplateEmail("subscription_expired", email, { email, planName });
}

export async function sendPaymentRejectedEmail(email: string, planName: string) {
  return sendTemplateEmail("payment_rejected", email, { email, planName });
}

export async function sendAdminPasswordResetEmail(email: string, code: string) {
  const cfg = await resolveMailConfig();
  const brand = cfg.brandName || "FlowDoverz";
  const subject = `${brand} — Admin password reset code`;
  const text = [
    `Your admin password reset code is: ${code}`,
    "",
    "This code expires in 15 minutes.",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 12px;color:#0f172a;">Admin password reset</h2>
      <p style="margin:0 0 16px;color:#475569;">Use this code to reset your admin panel password:</p>
      <div style="display:inline-block;padding:14px 22px;border-radius:12px;background:#ecfeff;border:1px solid #06b6d4;font-size:28px;font-weight:800;letter-spacing:6px;color:#0891b2;">
        ${code}
      </div>
      <p style="margin:16px 0 0;color:#64748b;font-size:14px;">Expires in 15 minutes. If you did not request this, ignore this email.</p>
    </div>
  `;

  return sendRawEmail({
    to: email,
    subject,
    text,
    html,
    type: "admin_password_reset",
  });
}

export { renderTemplateEmail, applyTemplatePlaceholders };
