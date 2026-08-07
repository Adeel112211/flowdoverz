import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { getSystemSettings, saveSystemSettings, type SystemSettings } from "@/lib/admin-settings";
import { getDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSystemSettings();
  return NextResponse.json({ success: true, settings });
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const allowed: (keyof SystemSettings)[] = [
      "soloPricePkr",
      "teamPricePkr",
      "trialDays",
      "trialMinutes",
      "subscriptionDays",
      "adminNotificationEmail",
      "minExtensionVersion",
      "signupRequireEmailVerification",
      "signupAllowedDomains",
      "signupRateLimitPerHour",
      "trialOnePerIp",
    ];

    const partial: Partial<SystemSettings> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) partial[key] = body[key];
    }

    const settings = await saveSystemSettings(partial);
    await logAdminActivity({ action: "settings_updated", detail: "System settings updated" });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.action === "test_email") {
    const db = getDb();
    const to = String(body.to || "").trim();
    if (!to) {
      return NextResponse.json({ success: false, error: "Email address required" }, { status: 400 });
    }

    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: parseInt(process.env.SMTP_PORT || "587", 10) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: "FlowDoverz Admin — Test Email",
        text: "This is a test email from your FlowDoverz admin panel. SMTP is working.",
      });

      if (db) {
        await db.collection("email_log").add({
          to,
          subject: "FlowDoverz Admin — Test Email",
          type: "test",
          status: "sent",
          createdAt: new Date().toISOString(),
        });
      }

      return NextResponse.json({ success: true, message: "Test email sent." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMTP failed";
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  }

  if (body.action === "run_cron") {
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cronSecret = process.env.CRON_SECRET;

    try {
      const res = await fetch(`${baseUrl}/api/admin/cron/check-expirations`, {
        headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
      });
      const data = await res.json();
      await saveSystemSettings({
        cronLastRun: new Date().toISOString(),
        cronLastResult: data.success ? "success" : "failed",
      });
      await logAdminActivity({ action: "cron_run", detail: "Manual cron trigger" });
      return NextResponse.json({ success: data.success, result: data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cron failed";
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}
