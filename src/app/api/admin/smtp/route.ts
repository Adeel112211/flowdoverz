import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { isAdminUiRequest } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { EMAIL_TEMPLATE_DEFINITIONS } from "@/lib/email-templates-defaults";
import {
  getMergedTemplate,
  getSmtpConfig,
  getSmtpStatus,
  getStoredTemplates,
  maskSmtpForClient,
  saveSmtpConfig,
  saveStoredTemplates,
  type StoredEmailTemplate,
  type EmailTemplateId,
} from "@/lib/smtp-store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const config = await getSmtpConfig();
  const stored = await getStoredTemplates();
  const status = await getSmtpStatus();

  const templates = EMAIL_TEMPLATE_DEFINITIONS.map((def) => {
    const override = stored[def.id] || {};
    return {
      ...def,
      ...override,
      id: def.id,
      name: def.name,
      audience: def.audience,
      description: def.description,
      placeholders: def.placeholders,
      isCustomized: Boolean(
        override.subject ||
          override.textBody ||
          override.htmlBody ||
          override.style ||
          override.logoUrl ||
          override.headerImageUrl ||
          (override.colors && Object.keys(override.colors).length),
      ),
    };
  });

  return NextResponse.json({
    success: true,
    smtp: maskSmtpForClient(config),
    status,
    templates,
  });
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.smtp) {
      await saveSmtpConfig(body.smtp);
    }

    if (body.templates && typeof body.templates === "object") {
      const stored = await getStoredTemplates();
      for (const [id, partial] of Object.entries(body.templates as Record<string, StoredEmailTemplate>)) {
        stored[id] = { ...stored[id], ...(partial as StoredEmailTemplate) };
      }
      await saveStoredTemplates(stored);
    }

    if (body.templateId && body.template) {
      const { saveStoredTemplate } = await import("@/lib/smtp-store");
      await saveStoredTemplate(String(body.templateId), body.template as StoredEmailTemplate);
    }

    await logAdminActivity({ action: "settings_updated", detail: "SMTP settings or templates updated" });

    const config = await getSmtpConfig();
    return NextResponse.json({
      success: true,
      smtp: maskSmtpForClient(config),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save SMTP settings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "test_connection") {
    const config = await getSmtpConfig();
    if (!config.host || !config.user || !config.pass) {
      return NextResponse.json(
        { success: false, error: "SMTP host, user, and password are required." },
        { status: 400 },
      );
    }

    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port || 587,
        secure: config.port === 465,
        auth: { user: config.user, pass: config.pass },
      });
      await transporter.verify();
      return NextResponse.json({ success: true, message: "SMTP connection successful." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  }

  if (action === "send_test") {
    const to = String(body.to || "").trim();
    if (!to) {
      return NextResponse.json({ success: false, error: "Recipient email required." }, { status: 400 });
    }

    const { sendRawEmail } = await import("@/lib/email");
    const ok = await sendRawEmail({
      to,
      subject: "FlowDoverz — SMTP Test",
      text: "This is a test email from your FlowDoverz SMTP settings page.",
      html: "<p>This is a <strong>test email</strong> from your FlowDoverz SMTP settings page.</p>",
      type: "test",
    });

    return NextResponse.json({
      success: ok,
      message: ok ? "Test email sent." : "Failed to send test email. Check SMTP settings.",
    });
  }

  if (action === "send_template_preview") {
    const to = String(body.to || "").trim();
    const templateId = String(body.templateId || "") as EmailTemplateId;
    if (!to || !templateId) {
      return NextResponse.json({ success: false, error: "Email and template ID required." }, { status: 400 });
    }

    const { sendTemplateEmail } = await import("@/lib/email");
    const { SAMPLE_TEMPLATE_VARS } = await import("@/lib/email-theme");
    const previewVars: Record<string, string> = {
      email: to,
      clientEmail: "client@example.com",
      planName: "Solo",
      planId: "solo",
      activationDate: new Date().toLocaleDateString(),
      expiryDate: new Date(Date.now() + 30 * 86400000).toLocaleDateString(),
      receiptNumber: SAMPLE_TEMPLATE_VARS["{{receiptNumber}}"],
      refundReceiptNumber: SAMPLE_TEMPLATE_VARS["{{refundReceiptNumber}}"],
      refundDate: SAMPLE_TEMPLATE_VARS["{{refundDate}}"],
      amountPkr: SAMPLE_TEMPLATE_VARS["{{amountPkr}}"],
      transactionId: SAMPLE_TEMPLATE_VARS["{{transactionId}}"],
      paymentDate: SAMPLE_TEMPLATE_VARS["{{paymentDate}}"],
      userName: SAMPLE_TEMPLATE_VARS["{{userName}}"],
      accountNumber: SAMPLE_TEMPLATE_VARS["{{accountNumber}}"],
    };
    const ok = await sendTemplateEmail(templateId, to, previewVars);

    return NextResponse.json({
      success: ok,
      message: ok ? "Template preview sent." : "Failed to send preview.",
    });
  }

  if (action === "reset_template") {
    const templateId = String(body.templateId || "");
    if (!templateId) {
      return NextResponse.json({ success: false, error: "Template ID required." }, { status: 400 });
    }
    const { deleteStoredTemplate, getMergedTemplate } = await import("@/lib/smtp-store");
    await deleteStoredTemplate(templateId);
    const template = await getMergedTemplate(templateId as EmailTemplateId);
    return NextResponse.json({ success: true, template });
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}
