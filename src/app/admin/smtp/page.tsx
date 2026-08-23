"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, Play, RefreshCw, Send, Server, RotateCcw, Save, Zap } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminPanel } from "@/components/admin-glass-modal";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { useAdminToast } from "@/components/admin-toast";
import {
  EmailTemplateEditor,
  ImageDropZone,
  editorValueToSavePayload,
  templateToEditorValue,
  type TemplateEditorValue,
} from "@/components/email-template-editor";
import type { EmailTemplateStyle, EmailThemeColors } from "@/lib/email-theme";

type SmtpForm = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  replyTo: string;
  adminEmail: string;
  enabled: boolean;
  brandName?: string;
  logoUrl?: string;
  defaultStyle?: EmailTemplateStyle;
  defaultColors?: Partial<EmailThemeColors>;
  hasPassword?: boolean;
};

type TemplateForm = TemplateEditorValue & {
  name: string;
  audience: "client" | "owner";
  description: string;
  isCustomized?: boolean;
  layoutLocked?: boolean;
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-sm text-slate-200 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-colors";

export default function SmtpPage() {
  const { toast } = useAdminToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"config" | "client" | "owner">("config");
  const [smtp, setSmtp] = useState<SmtpForm>({
    host: "",
    port: 587,
    user: "",
    pass: "",
    from: "",
    replyTo: "",
    adminEmail: "",
    enabled: true,
    brandName: "FlowDoverz",
  });
  const [status, setStatus] = useState<{ configured: boolean; source: string; enabled: boolean } | null>(null);
  const [templates, setTemplates] = useState<TemplateForm[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<string>("payment_pending");
  const [testEmail, setTestEmail] = useState("");
  const [cronLastRun, setCronLastRun] = useState<string | null>(null);
  const [cronLastResult, setCronLastResult] = useState<string | null>(null);
  const [cronRunning, setCronRunning] = useState(false);

  const loadCronStatus = async () => {
    const res = await fetch("/api/admin/settings", { credentials: "same-origin" });
    const data = await res.json();
    if (data.success) {
      setCronLastRun(data.settings.cronLastRun ?? null);
      setCronLastResult(data.settings.cronLastResult ?? null);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [smtpRes] = await Promise.all([
        fetch("/api/admin/smtp", { credentials: "same-origin" }),
        loadCronStatus(),
      ]);
      const data = await smtpRes.json();
      if (data.success) {
        setSmtp(data.smtp);
        setStatus(data.status);
        setTemplates(
          (data.templates as Omit<TemplateForm, "message">[]).map((t) => ({
            ...templateToEditorValue(t),
            name: t.name,
            audience: t.audience,
            description: t.description,
            isCustomized: t.isCustomized,
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveSmtp = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/smtp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtp }),
      });
      const data = await res.json();
      if (data.success) {
        toast("SMTP settings saved");
        setSmtp(data.smtp);
      } else {
        toast(data.error || "Save failed", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async () => {
    const t = templates.find((x) => x.id === activeTemplate);
    if (!t) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/smtp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: t.id,
          template: editorValueToSavePayload(t),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast("Template saved");
        load();
      } else {
        toast(data.error || "Save failed", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const resetTemplate = async (id: string) => {
    const res = await fetch("/api/admin/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_template", templateId: id }),
    });
    const data = await res.json();
    if (data.success) {
      toast("Template reset to default");
      load();
    }
  };

  const testConnection = async () => {
    const res = await fetch("/api/admin/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test_connection" }),
    });
    const data = await res.json();
    toast(data.message || data.error, data.success ? "success" : "error");
  };

  const sendTest = async () => {
    const res = await fetch("/api/admin/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send_test", to: testEmail }),
    });
    const data = await res.json();
    toast(data.message || data.error, data.success ? "success" : "error");
  };

  const sendPreview = async () => {
    const res = await fetch("/api/admin/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send_template_preview",
        to: testEmail,
        templateId: activeTemplate,
      }),
    });
    const data = await res.json();
    toast(data.message || data.error, data.success ? "success" : "error");
  };

  const runExpirationCron = async () => {
    setCronRunning(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_cron" }),
      });
      const data = await res.json();
      toast(data.success ? "Expiration cron completed" : data.error || "Cron failed", data.success ? "success" : "error");
      if (data.success) await loadCronStatus();
    } finally {
      setCronRunning(false);
    }
  };

  const updateTemplate = (patch: Partial<TemplateEditorValue>) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === activeTemplate ? { ...t, ...patch } : t)),
    );
  };

  const current = templates.find((t) => t.id === activeTemplate);
  const clientTemplates = templates.filter((t) => t.audience === "client");
  const ownerTemplates = templates.filter((t) => t.audience === "owner");
  const visibleTemplates = tab === "client" ? clientTemplates : ownerTemplates;

  const editorValue = useMemo(() => {
    if (!current) return null;
    return current;
  }, [current]);

  if (loading) return <AdminLoadingState label="Loading SMTP settings..." />;

  return (
    <AdminPageLayout
      header={
        <AdminPageHeader
          title="SMTP & Email Templates"
          description="Configure mail delivery, upload images, pick styles, customize colors, and edit email content."
          actions={
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/5"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          }
        />
      }
    >
      {status && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            status.configured
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          {status.configured
            ? `SMTP configured via ${status.source}. Emails ${status.enabled ? "enabled" : "disabled"}.`
            : "SMTP not fully configured. Add details below or set env vars on Vercel."}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {(
          [
            { id: "config" as const, label: "SMTP Config", Icon: Server },
            { id: "client" as const, label: "Client Templates", Icon: Mail },
            { id: "owner" as const, label: "Owner Templates", Icon: Send },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              const list = id === "client" ? clientTemplates : id === "owner" ? ownerTemplates : [];
              if (list[0]) setActiveTemplate(list[0].id);
            }}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              tab === id
                ? "bg-cyan-500 text-slate-950"
                : "border border-white/10 bg-[#0F172A] text-slate-400 hover:border-cyan-500/30 hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "config" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <AdminPanel className="lg:col-span-2">
            <h2 className="text-lg font-bold text-white mb-4">SMTP Server</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Host</label>
                <input className={inputClass} value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Port</label>
                <input type="number" className={inputClass} value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Username / Email</label>
                <input className={inputClass} value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Password</label>
                <input type="password" className={inputClass} value={smtp.pass} onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })} placeholder={smtp.hasPassword ? "Leave blank to keep current" : "App password"} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">From Address</label>
                <input className={inputClass} value={smtp.from} onChange={(e) => setSmtp({ ...smtp, from: e.target.value })} placeholder='"FlowDoverz" <you@domain.com>' />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Reply-To</label>
                <input className={inputClass} value={smtp.replyTo} onChange={(e) => setSmtp({ ...smtp, replyTo: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Admin notification email</label>
                <input className={inputClass} value={smtp.adminEmail} onChange={(e) => setSmtp({ ...smtp, adminEmail: e.target.value })} placeholder="you@domain.com" />
                <p className="mt-1 text-xs text-slate-500">Payment alerts and owner emails are sent here.</p>
              </div>
              <div className="sm:col-span-2">
                <ImageDropZone
                  label="Default logo (all emails)"
                  hint="Drag & drop your brand logo"
                  imageUrl={smtp.logoUrl}
                  onImage={(url) => setSmtp({ ...smtp, logoUrl: url })}
                  onClear={() => setSmtp({ ...smtp, logoUrl: "" })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Brand name (shown in emails)</label>
                <input className={inputClass} value={smtp.brandName || ""} onChange={(e) => setSmtp({ ...smtp, brandName: e.target.value })} placeholder="FlowDoverz" />
              </div>
              <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={smtp.enabled} onChange={(e) => setSmtp({ ...smtp, enabled: e.target.checked })} />
                Enable email sending
              </label>
            </div>
            <button type="button" disabled={saving} onClick={saveSmtp} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
              <Save className="w-4 h-4" /> Save SMTP Settings
            </button>
          </AdminPanel>

          <div className="space-y-6">
            <AdminPanel>
              <h2 className="text-lg font-bold text-white mb-4">Test</h2>
              <p className="text-sm text-slate-400 mb-4">Verify connection and send a test message.</p>
              <button type="button" onClick={testConnection} className="mb-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#080810] py-2.5 text-sm font-bold text-slate-300 hover:border-cyan-500/30 hover:text-white">
                <Zap className="w-4 h-4" /> Test Connection
              </button>
              <input type="email" className={`${inputClass} mb-3`} placeholder="test@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
              <button type="button" onClick={sendTest} className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-2.5 text-sm font-bold text-cyan-300 hover:bg-cyan-500/15">
                <Send className="w-4 h-4" /> Send Test Email
              </button>
            </AdminPanel>

            <AdminPanel>
              <h2 className="text-lg font-bold text-white mb-2">Expiration Cron</h2>
              <p className="text-sm text-slate-400 mb-4">
                Deactivates expired trials and subscriptions, then sends expiration emails.
              </p>
              <p className="text-sm text-slate-400 mb-4">
                Last run: {cronLastRun ? new Date(cronLastRun).toLocaleString() : "Never"}
                {cronLastResult ? ` · ${cronLastResult}` : ""}
              </p>
              <button
                type="button"
                disabled={cronRunning}
                onClick={runExpirationCron}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#080810] py-2.5 text-sm font-bold text-slate-300 hover:border-cyan-500/30 hover:text-white disabled:opacity-50"
              >
                <Play className="w-4 h-4" /> {cronRunning ? "Running..." : "Run Now"}
              </button>
            </AdminPanel>
          </div>
        </div>
      )}

      {(tab === "client" || tab === "owner") && current && editorValue && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {visibleTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTemplate(t.id)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                  activeTemplate === t.id
                    ? "border border-cyan-500 bg-cyan-500/10 text-cyan-300"
                    : "border border-white/10 bg-[#0F172A] text-slate-400 hover:border-cyan-500/30 hover:text-slate-200"
                }`}
              >
                {t.name}
                {t.isCustomized && <span className="ml-1 text-[10px] text-emerald-400">• edited</span>}
              </button>
            ))}
          </div>

          <AdminPanel>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">{current.name}</h2>
                <p className="text-sm text-slate-400 mt-1">{current.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => resetTemplate(current.id)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#080810] px-3 py-2 text-xs font-bold text-slate-400 hover:border-cyan-500/30 hover:text-slate-200">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset default
                </button>
                <button type="button" disabled={saving} onClick={saveTemplate} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">
                  <Save className="w-4 h-4" /> Save
                </button>
                <button type="button" onClick={sendPreview} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#080810] px-4 py-2 text-sm font-bold text-slate-300 hover:border-cyan-500/30 hover:text-white">
                  <Send className="w-4 h-4" /> Send preview
                </button>
              </div>
            </div>

            <EmailTemplateEditor
              value={editorValue}
              brandName={smtp.brandName}
              defaultLogoUrl={smtp.logoUrl}
              defaultStyle={smtp.defaultStyle}
              defaultColors={smtp.defaultColors}
              layoutLocked={current.layoutLocked}
              onChange={updateTemplate}
            />

            {testEmail && (
              <p className="mt-4 text-xs text-slate-500">
                Preview emails will be sent to: {testEmail} — set address in SMTP Config tab.
              </p>
            )}
            {!testEmail && (
              <p className="mt-4 text-xs text-slate-500">
                Add a test email address on the SMTP Config tab to send live previews.
              </p>
            )}
          </AdminPanel>
        </div>
      )}
    </AdminPageLayout>
  );
}
