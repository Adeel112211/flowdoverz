import type { EmailBranding } from "./email-theme";
import { buildThermalReceiptEmailHtml } from "./receipt-html";

export type EmailTemplateId =
  | "payment_pending"
  | "account_activated"
  | "payment_receipt"
  | "payment_refund_receipt"
  | "payment_rejected"
  | "subscription_expired"
  | "admin_new_payment"
  | "email_verification";

export type TemplateAudience = "client" | "owner";

export type EmailTemplateDef = EmailBranding & {
  id: EmailTemplateId;
  name: string;
  audience: TemplateAudience;
  description: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  preheader?: string;
  badge?: string;
  badgeTone?: "info" | "success" | "warning" | "error";
  ctaLabel?: string;
  ctaHref?: string;
  heading?: string;
  footerText?: string;
  placeholders: string[];
  /** Structured HTML layout — hide the plain-text message editor. */
  layoutLocked?: boolean;
};

export const EMAIL_TEMPLATE_DEFINITIONS: EmailTemplateDef[] = [
  {
    id: "payment_pending",
    name: "Payment Pending",
    audience: "client",
    description: "Sent to the client when they submit a manual payment.",
    subject: "FlowDoverz - Payment Pending Approval",
    preheader: "Your payment was received and is being reviewed by our team.",
    badge: "Pending review",
    badgeTone: "warning",
    ctaLabel: "View dashboard",
    placeholders: ["{{email}}", "{{appUrl}}"],
    textBody: `Hello,

We have received your payment submission for FlowDoverz.
Your payment is currently pending approval by our team.
You will receive another email as soon as your account is activated.

Dashboard: {{appUrl}}/dashboard

Thank you,
The FlowDoverz Team`,
    htmlBody: `<p style="margin:0 0 16px 0;color:#e2e8f0;">Hello,</p>
<p style="margin:0 0 4px 0;">We have successfully received your payment submission. Our team is reviewing it now.</p>
<p style="margin:0;">We will send you another email as soon as your account is activated and ready to use.</p>`,
  },
  {
    id: "account_activated",
    name: "Account Activated",
    audience: "client",
    description: "Sent when a payment is approved or admin assigns a paid plan.",
    subject: "FlowDoverz - Your Account is Activated",
    preheader: "Your {{planName}} plan is now active.",
    badge: "Active",
    badgeTone: "success",
    ctaLabel: "Start using FlowDoverz",
    placeholders: ["{{email}}", "{{planName}}", "{{activationDate}}", "{{expiryDate}}", "{{appUrl}}"],
    textBody: `Hello,

Your payment has been approved and your {{planName}} plan is now active.

Activation Date: {{activationDate}}
Expiry Date: {{expiryDate}}

Dashboard: {{appUrl}}/dashboard

Thank you for choosing us!
The FlowDoverz Team`,
    htmlBody: `<p style="margin:0 0 16px 0;color:#e2e8f0;">Hello,</p>
<p style="margin:0 0 4px 0;">Great news — your payment was approved and your <strong style="color:#34d399;">{{planName}}</strong> plan is now live.</p>
<p style="margin:0;">Sign in to your dashboard to start using all premium features right away.</p>`,
  },
  {
    id: "payment_receipt",
    name: "Payment Receipt",
    audience: "client",
    description: "Official payment receipt sent to the client when a payment is approved.",
    subject: "FlowDoverz - Payment Receipt {{receiptNumber}}",
    preheader: "Your {{planName}} payment of {{amountPkr}} was confirmed.",
    heading: "FLOWDOVERZ",
    badge: "RECEIPT",
    badgeTone: "success",
    footerText: "Thank you for your payment. Keep this receipt for your records.",
    ctaLabel: "View dashboard",
    layoutLocked: true,
    placeholders: [
      "{{email}}",
      "{{userName}}",
      "{{accountNumber}}",
      "{{receiptNumber}}",
      "{{planName}}",
      "{{amountPkr}}",
      "{{transactionId}}",
      "{{paymentDate}}",
      "{{expiryDate}}",
      "{{receiptBarcode}}",
      "{{appUrl}}",
    ],
    textBody: `Hello {{userName}},

Thank you for your payment. This is your official receipt.

Account #: {{accountNumber}}
Receipt No: {{receiptNumber}}
Plan: {{planName}}
Amount: {{amountPkr}}
Payment Date: {{paymentDate}}
Valid Until: {{expiryDate}}

Dashboard: {{appUrl}}/dashboard

Thank you,
The FlowDoverz Team`,
    htmlBody: buildThermalReceiptEmailHtml(),
  },
  {
    id: "payment_refund_receipt",
    name: "Refund Receipt",
    audience: "client",
    description: "Official refund receipt sent to the client when a payment is refunded.",
    subject: "FlowDoverz - Refund Receipt {{refundReceiptNumber}}",
    preheader: "Your {{planName}} payment of {{amountPkr}} was refunded.",
    heading: "FLOWDOVERZ",
    badge: "REFUND",
    badgeTone: "error",
    footerText: "This confirms your payment was refunded. Keep this receipt for your records.",
    ctaLabel: "View dashboard",
    layoutLocked: true,
    placeholders: [
      "{{email}}",
      "{{userName}}",
      "{{accountNumber}}",
      "{{receiptNumber}}",
      "{{refundReceiptNumber}}",
      "{{planName}}",
      "{{amountPkr}}",
      "{{transactionId}}",
      "{{paymentDate}}",
      "{{refundDate}}",
      "{{receiptBarcode}}",
      "{{appUrl}}",
    ],
    textBody: `Hello {{userName}},

Your payment has been refunded. This is your official refund receipt.

Account #: {{accountNumber}}
Refund Receipt No: {{refundReceiptNumber}}
Original Receipt No: {{receiptNumber}}
Plan: {{planName}}
Amount Refunded: {{amountPkr}}
Paid on: {{paymentDate}}
Refunded on: {{refundDate}}

Dashboard: {{appUrl}}/dashboard

Thank you,
The FlowDoverz Team`,
    htmlBody: buildThermalReceiptEmailHtml({ variant: "refund" }),
  },
  {
    id: "payment_rejected",
    name: "Payment Rejected",
    audience: "client",
    description: "Sent when admin rejects a manual payment.",
    subject: "FlowDoverz - Payment Verification Failed",
    preheader: "We could not verify your payment. Please submit again.",
    badge: "Verification failed",
    badgeTone: "error",
    ctaLabel: "Submit payment again",
    placeholders: ["{{email}}", "{{planName}}", "{{appUrl}}"],
    textBody: `Hello,

We were unable to verify your payment for the {{planName}} plan.
Your account has not been activated. Please log in and submit a new, valid payment request.

Dashboard: {{appUrl}}/dashboard

The FlowDoverz Team`,
    htmlBody: `<p style="margin:0 0 16px 0;color:#e2e8f0;">Hello,</p>
<p style="margin:0 0 4px 0;">We could not verify your recent payment for the <strong style="color:#f8fafc;">{{planName}}</strong> plan.</p>
<p style="margin:0;">If this was a mistake, submit a new payment with a clear screenshot and valid transaction ID.</p>`,
  },
  {
    id: "subscription_expired",
    name: "Subscription Expired",
    audience: "client",
    description: "Sent when a paid subscription expires.",
    subject: "FlowDoverz - Your Subscription has Expired",
    preheader: "Your {{planName}} subscription has expired. Renew to continue.",
    badge: "Expired",
    badgeTone: "error",
    ctaLabel: "Renew subscription",
    placeholders: ["{{email}}", "{{planName}}", "{{appUrl}}"],
    textBody: `Hello,

Your {{planName}} subscription has expired.
Please log in and renew your plan to continue using our premium features.

Dashboard: {{appUrl}}/dashboard

The FlowDoverz Team`,
    htmlBody: `<p style="margin:0 0 16px 0;color:#e2e8f0;">Hello,</p>
<p style="margin:0 0 4px 0;">Your <strong style="color:#f87171;">{{planName}}</strong> subscription has expired.</p>
<p style="margin:0;">Renew your plan to keep access to premium features without interruption.</p>`,
  },
  {
    id: "admin_new_payment",
    name: "New Payment (Admin)",
    audience: "owner",
    description: "Sent to the owner/admin when a client submits a payment.",
    subject: "FlowDoverz - New Payment Pending for {{clientEmail}}",
    preheader: "New payment from {{clientEmail}} for the {{planName}} plan.",
    badge: "Action required",
    badgeTone: "warning",
    ctaLabel: "Review in admin panel",
    ctaHref: "{{appUrl}}/admin/payments",
    placeholders: ["{{clientEmail}}", "{{planName}}", "{{planId}}", "{{appUrl}}"],
    textBody: `Hello Admin,

A user has submitted a manual payment request.

Email: {{clientEmail}}
Plan: {{planName}}

Admin panel: {{appUrl}}/admin/payments`,
    htmlBody: `<p style="margin:0 0 16px 0;color:#e2e8f0;">Hello Admin,</p>
<p style="margin:0 0 4px 0;">A user submitted a manual payment that needs your review.</p>
<p style="margin:0;">Open the admin panel to verify the transaction ID and screenshot, then approve or reject the payment.</p>`,
  },
  {
    id: "email_verification",
    name: "Email Verification",
    audience: "client",
    description: "Sent with a 6-digit code when a user signs up.",
    subject: "FlowDoverz - Your verification code",
    preheader: "Your verification code is {{code}}",
    badge: "Verification",
    badgeTone: "info",
    placeholders: ["{{email}}", "{{code}}", "{{appUrl}}"],
    textBody: `Your FlowDoverz verification code is: {{code}}

This code expires in 15 minutes.

If you did not request this, you can ignore this email.`,
    htmlBody: `<p style="margin:0 0 16px 0;color:#e2e8f0;">Your verification code:</p>
<p style="margin:0;font-size:32px;font-weight:800;letter-spacing:8px;color:#22d3ee;">{{code}}</p>
<p style="margin:16px 0 0;color:#94a3b8;font-size:14px;">Expires in 15 minutes.</p>`,
  },
];

export function getTemplateDefinition(id: EmailTemplateId): EmailTemplateDef {
  const found = EMAIL_TEMPLATE_DEFINITIONS.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown template: ${id}`);
  return found;
}

export function applyTemplatePlaceholders(
  input: string,
  vars: Record<string, string>,
) {
  let out = input;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(key).join(value);
  }
  return out;
}
