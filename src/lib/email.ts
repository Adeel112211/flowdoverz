import nodemailer from "nodemailer";
import { randomBytes } from "crypto";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const APP_URL = (
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://flowdoverz.app"
).replace(/\/$/, "");

const COLORS = {
  bg: "#080810",
  card: "#0c1018",
  cardBorder: "rgba(34,211,238,0.12)",
  text: "#94a3b8",
  textBright: "#e2e8f0",
  heading: "#f8fafc",
  cyan: "#22d3ee",
  emerald: "#34d399",
  rose: "#f87171",
  muted: "#64748b",
};

function senderAddress(): string {
  if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
  if (SMTP_USER) return `"FlowDoverz" <${SMTP_USER}>`;
  return '"FlowDoverz" <noreply@flowdoverz.app>';
}

function replyToAddress(): string {
  return process.env.SMTP_REPLY_TO || SMTP_USER;
}

function senderDomain(): string {
  const from = process.env.SMTP_FROM || SMTP_USER;
  const match = from.match(/@([\w.-]+)/);
  return match?.[1] || "flowdoverz.app";
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  requireTLS: SMTP_PORT !== 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    minVersion: "TLSv1.2",
  },
});

function emailLogo() {
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
    <tr>
      <td style="vertical-align:middle;padding-right:12px;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#22d3ee,#34d399);box-shadow:0 0 24px rgba(34,211,238,0.35);">
          <tr>
            <td align="center" valign="middle" style="width:44px;height:44px;border-radius:12px;background:#000000;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:linear-gradient(135deg,#ffffff,#a5f3fc);"></span>
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:middle;">
        <span style="font-size:22px;font-weight:800;color:#f8fafc;letter-spacing:-0.03em;">FlowDoverz</span>
      </td>
    </tr>
  </table>`;
}

type BadgeTone = "info" | "success" | "warning" | "error";

function statusBadge(label: string, tone: BadgeTone = "info") {
  const styles: Record<BadgeTone, { bg: string; border: string; color: string }> = {
    info: { bg: "rgba(34,211,238,0.1)", border: "rgba(34,211,238,0.25)", color: "#67e8f9" },
    success: { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.25)", color: "#6ee7b7" },
    warning: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.25)", color: "#fcd34d" },
    error: { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)", color: "#fca5a5" },
  };
  const s = styles[tone];
  return `<span style="display:inline-block;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;background:${s.bg};border:1px solid ${s.border};color:${s.color};">${label}</span>`;
}

function infoCard(rows: { label: string; value: string; valueColor?: string }[]) {
  const rowHtml = rows
    .map(
      (row, i) => `
      <tr>
        <td style="padding:14px 20px;${i > 0 ? "border-top:1px solid rgba(255,255,255,0.06);" : ""}">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="font-size:13px;color:#64748b;font-weight:600;width:42%;">${row.label}</td>
              <td style="font-size:15px;color:${row.valueColor || "#f8fafc"};font-weight:700;text-align:right;">${row.value}</td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join("");

  return `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;">
    ${rowHtml}
  </table>`;
}

function alertBox(message: string, tone: BadgeTone = "info") {
  const accents: Record<BadgeTone, string> = {
    info: COLORS.cyan,
    success: COLORS.emerald,
    warning: "#fbbf24",
    error: COLORS.rose,
  };
  const color = accents[tone];
  return `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;">
    <tr>
      <td style="padding:16px 18px;background:rgba(255,255,255,0.02);border-left:4px solid ${color};border-radius:0 12px 12px 0;border-top:1px solid rgba(255,255,255,0.05);border-right:1px solid rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.05);color:#cbd5e1;font-size:15px;line-height:1.65;">
        ${message}
      </td>
    </tr>
  </table>`;
}

function ctaButton(href: string, label: string) {
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 8px 0;">
    <tr>
      <td style="border-radius:999px;background:linear-gradient(90deg,#22d3ee,#34d399);box-shadow:0 4px 24px rgba(34,211,238,0.25);">
        <a href="${href}" style="display:inline-block;padding:14px 28px;color:#020617;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:0.01em;">${label}</a>
      </td>
    </tr>
  </table>`;
}

type TemplateOptions = {
  preheader?: string;
  badge?: { label: string; tone: BadgeTone };
  ctaHref?: string;
  ctaLabel?: string;
  showCta?: boolean;
};

function getHtmlTemplate(title: string, content: string, options: TemplateOptions = {}) {
  const {
    preheader = "",
    badge,
    ctaHref = `${APP_URL}/dashboard`,
    ctaLabel = "Open dashboard",
    showCta = true,
  } = options;

  const badgeHtml = badge ? `<div style="margin-bottom:16px;">${statusBadge(badge.label, badge.tone)}</div>` : "";
  const ctaHtml = showCta ? ctaButton(ctaHref, ctaLabel) : "";
  const supportEmail = replyToAddress() || "support@flowdoverz.app";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${COLORS.bg};background-image:radial-gradient(circle at 15% 10%,rgba(6,182,212,0.14) 0%,transparent 35%),radial-gradient(circle at 85% 90%,rgba(20,184,166,0.1) 0%,transparent 35%);">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              ${emailLogo()}
            </td>
          </tr>
          <tr>
            <td style="background:${COLORS.card};border:1px solid ${COLORS.cardBorder};border-radius:24px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.03) inset;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="height:3px;background:linear-gradient(90deg,#22d3ee,#34d399,#22d3ee);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:36px 32px 8px 32px;">
                    ${badgeHtml}
                    <h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:800;color:${COLORS.heading};letter-spacing:-0.03em;">${title}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 32px 32px 32px;color:${COLORS.text};font-size:16px;line-height:1.75;">
                    ${content}
                    ${ctaHtml}
                    <p style="margin:12px 0 0 0;font-size:13px;color:${COLORS.muted};">
                      Or visit <a href="${APP_URL}" style="color:${COLORS.cyan};text-decoration:none;font-weight:600;">flowdoverz.app</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 32px 28px 32px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.2);">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align:top;">
                          <p style="margin:0 0 6px 0;font-size:14px;color:${COLORS.textBright};font-weight:700;">The FlowDoverz Team</p>
                          <p style="margin:0;font-size:13px;color:${COLORS.muted};line-height:1.6;">
                            Need help? <a href="mailto:${supportEmail}" style="color:${COLORS.cyan};text-decoration:none;">${supportEmail}</a>
                          </p>
                        </td>
                        <td align="right" style="vertical-align:top;">
                          <a href="${APP_URL}/dashboard" style="font-size:13px;color:${COLORS.muted};text-decoration:none;">Dashboard</a>
                          <span style="color:rgba(255,255,255,0.15);margin:0 8px;">|</span>
                          <a href="${APP_URL}/pricing" style="font-size:13px;color:${COLORS.muted};text-decoration:none;">Pricing</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 8px 0 8px;">
              <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">
                You received this email because of activity on your FlowDoverz account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildMessageId(): string {
  const domain = senderDomain();
  return `<${Date.now()}.${randomBytes(8).toString("hex")}@${domain}>`;
}

async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("Email config missing. Skipping sending email to:", to);
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: senderAddress(),
      replyTo: replyToAddress(),
      to,
      subject,
      text,
      html,
      date: new Date(),
      headers: {
        "Message-ID": buildMessageId(),
      },
    });
    console.log("Message sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

export async function sendPaymentPendingEmail(email: string) {
  return sendEmail({
    to: email,
    subject: "FlowDoverz - Payment Pending Approval",
    text: [
      "Hello,",
      "",
      "We have received your payment submission for FlowDoverz.",
      "Your payment is currently pending approval by our team.",
      "You will receive another email as soon as your account is activated.",
      "",
      `Dashboard: ${APP_URL}/dashboard`,
      "",
      "Thank you,",
      "The FlowDoverz Team",
    ].join("\n"),
    html: getHtmlTemplate(
      "Payment Received",
      `
      <p style="margin:0 0 16px 0;color:${COLORS.textBright};">Hello,</p>
      <p style="margin:0 0 4px 0;">We have successfully received your payment submission. Our team is reviewing it now.</p>
      ${alertBox("Your payment is <strong style=\"color:#f8fafc;\">pending approval</strong>. Most requests are processed within a few hours.", "info")}
      <p style="margin:0;">We will send you another email as soon as your account is activated and ready to use.</p>
      `,
      {
        preheader: "Your payment was received and is being reviewed by our team.",
        badge: { label: "Pending review", tone: "warning" },
        ctaLabel: "View dashboard",
      },
    ),
  });
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

  const activationDate = formatDate(activationDateStr);
  const expiryDate = formatDate(expiryDateStr);

  return sendEmail({
    to: email,
    subject: "FlowDoverz - Your Account is Activated",
    text: [
      "Hello,",
      "",
      `Your payment has been approved and your ${planName} plan is now active.`,
      "",
      `Activation Date: ${activationDate}`,
      `Expiry Date: ${expiryDate}`,
      "",
      `Dashboard: ${APP_URL}/dashboard`,
      "",
      "Thank you for choosing us!",
      "The FlowDoverz Team",
    ].join("\n"),
    html: getHtmlTemplate(
      "Account Activated",
      `
      <p style="margin:0 0 16px 0;color:${COLORS.textBright};">Hello,</p>
      <p style="margin:0 0 4px 0;">Great news — your payment was approved and your <strong style="color:${COLORS.emerald};">${planName}</strong> plan is now live.</p>
      ${infoCard([
        { label: "Plan", value: planName, valueColor: COLORS.emerald },
        { label: "Activation date", value: activationDate, valueColor: COLORS.cyan },
        { label: "Expiry date", value: expiryDate, valueColor: COLORS.rose },
      ])}
      <p style="margin:0;">Sign in to your dashboard to start using all premium features right away.</p>
      `,
      {
        preheader: `Your ${planName} plan is active until ${expiryDate}.`,
        badge: { label: "Active", tone: "success" },
        ctaLabel: "Start using FlowDoverz",
      },
    ),
  });
}

export async function sendAdminNotificationEmail(clientEmail: string, planId: string) {
  const adminEmail = SMTP_USER;
  if (!adminEmail) return false;

  const planLabel = planId === "solo" ? "Solo" : planId === "team" ? "Team" : planId;

  return sendEmail({
    to: adminEmail,
    subject: `FlowDoverz - New Payment Pending for ${clientEmail}`,
    text: [
      "Hello Admin,",
      "",
      "A user has submitted a manual payment request.",
      "",
      `Email: ${clientEmail}`,
      `Plan: ${planLabel}`,
      "",
      `Admin panel: ${APP_URL}/admin/payments`,
    ].join("\n"),
    html: getHtmlTemplate(
      "New Payment Pending",
      `
      <p style="margin:0 0 16px 0;color:${COLORS.textBright};">Hello Admin,</p>
      <p style="margin:0 0 4px 0;">A user submitted a manual payment that needs your review.</p>
      ${infoCard([
        { label: "User email", value: clientEmail },
        { label: "Requested plan", value: planLabel, valueColor: COLORS.cyan },
        { label: "Status", value: "Awaiting review", valueColor: "#fcd34d" },
      ])}
      <p style="margin:0;">Open the admin panel to verify the transaction ID and screenshot, then approve or reject the payment.</p>
      `,
      {
        preheader: `New payment from ${clientEmail} for the ${planLabel} plan.`,
        badge: { label: "Action required", tone: "warning" },
        ctaHref: `${APP_URL}/admin/payments`,
        ctaLabel: "Review in admin panel",
      },
    ),
  });
}

export async function sendSubscriptionExpiredEmail(email: string, planName: string) {
  return sendEmail({
    to: email,
    subject: "FlowDoverz - Your Subscription has Expired",
    text: [
      "Hello,",
      "",
      `Your ${planName} subscription has expired.`,
      "Please log in and renew your plan to continue using our premium features.",
      "",
      `Dashboard: ${APP_URL}/dashboard`,
      "",
      "The FlowDoverz Team",
    ].join("\n"),
    html: getHtmlTemplate(
      "Subscription Expired",
      `
      <p style="margin:0 0 16px 0;color:${COLORS.textBright};">Hello,</p>
      <p style="margin:0 0 4px 0;">Your <strong style="color:${COLORS.rose};">${planName}</strong> subscription has expired.</p>
      ${alertBox("Renew your plan to keep access to premium features without interruption.", "error")}
      <p style="margin:0;">If you already submitted a new payment, you can ignore this email while we process it.</p>
      `,
      {
        preheader: `Your ${planName} subscription has expired. Renew to continue.`,
        badge: { label: "Expired", tone: "error" },
        ctaHref: `${APP_URL}/pricing`,
        ctaLabel: "Renew subscription",
      },
    ),
  });
}

export async function sendPaymentRejectedEmail(email: string, planName: string) {
  return sendEmail({
    to: email,
    subject: "FlowDoverz - Payment Verification Failed",
    text: [
      "Hello,",
      "",
      `We were unable to verify your payment for the ${planName} plan.`,
      "Your account has not been activated. Please log in and submit a new, valid payment request.",
      "",
      `Dashboard: ${APP_URL}/dashboard`,
      "",
      "The FlowDoverz Team",
    ].join("\n"),
    html: getHtmlTemplate(
      "Payment Not Verified",
      `
      <p style="margin:0 0 16px 0;color:${COLORS.textBright};">Hello,</p>
      <p style="margin:0 0 4px 0;">We could not verify your recent payment for the <strong style="color:${COLORS.textBright};">${planName}</strong> plan.</p>
      ${alertBox("<strong style=\"color:#fecaca;\">Reason:</strong> The screenshot or transaction ID was invalid, unreadable, or could not be confirmed by our billing team.", "error")}
      <p style="margin:0 0 12px 0;">Your account was not upgraded. If this was a mistake, submit a new payment with a clear screenshot and valid transaction ID.</p>
      `,
      {
        preheader: "We could not verify your payment. Please submit again.",
        badge: { label: "Verification failed", tone: "error" },
        ctaHref: `${APP_URL}/checkout/${planName.toLowerCase()}`,
        ctaLabel: "Submit payment again",
      },
    ),
  });
}
