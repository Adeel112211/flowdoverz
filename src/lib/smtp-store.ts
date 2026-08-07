import { getDb } from "./firebase-admin";
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  type EmailTemplateDef,
  type EmailTemplateId,
} from "./email-templates-defaults";
import type { EmailBranding, EmailTemplateStyle, EmailThemeColors } from "./email-theme";

export type { EmailTemplateId };

export type SmtpConfig = {
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
};

export type StoredEmailTemplate = EmailBranding & {
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  preheader?: string;
  badge?: string;
  badgeTone?: EmailTemplateDef["badgeTone"];
  ctaLabel?: string;
  ctaHref?: string;
  heading?: string;
  footerText?: string;
};

export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  host: process.env.SMTP_HOST || "",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
  from: process.env.SMTP_FROM || "",
  replyTo: process.env.SMTP_REPLY_TO || process.env.SMTP_USER || "",
  adminEmail: process.env.SMTP_USER || "",
  enabled: true,
  brandName: "FlowDoverz",
  logoUrl: "/logo.png",
  defaultStyle: "modern",
};

const SMTP_DOC = { collection: "settings", id: "smtp" };
const TEMPLATES_DOC = { collection: "settings", id: "email_templates" };

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const db = getDb();
  if (!db) return { ...DEFAULT_SMTP_CONFIG };

  try {
    const doc = await db.collection(SMTP_DOC.collection).doc(SMTP_DOC.id).get();
    if (!doc.exists) return { ...DEFAULT_SMTP_CONFIG };
    return { ...DEFAULT_SMTP_CONFIG, ...(doc.data() as Partial<SmtpConfig>) };
  } catch {
    return { ...DEFAULT_SMTP_CONFIG };
  }
}

export async function saveSmtpConfig(partial: Partial<SmtpConfig>) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const current = await getSmtpConfig();
  const next: SmtpConfig = { ...current, ...partial };

  if (partial.pass === "" || partial.pass === "********") {
    next.pass = current.pass;
  }

  await db.collection(SMTP_DOC.collection).doc(SMTP_DOC.id).set(next, { merge: true });
  return next;
}

export async function getStoredTemplates(): Promise<Record<string, StoredEmailTemplate>> {
  const db = getDb();
  if (!db) return {};

  try {
    const oldDoc = await db.collection(TEMPLATES_DOC.collection).doc(TEMPLATES_DOC.id).get();
    const oldData = oldDoc.exists ? ((oldDoc.data()?.templates as Record<string, StoredEmailTemplate>) || {}) : {};

    const snapshot = await db.collection("email_templates").get();
    const newData: Record<string, StoredEmailTemplate> = {};
    snapshot.forEach((doc) => {
      newData[doc.id] = doc.data() as StoredEmailTemplate;
    });

    return { ...oldData, ...newData };
  } catch {
    return {};
  }
}

export async function saveStoredTemplate(id: string, template: StoredEmailTemplate) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  await db.collection("email_templates").doc(id).set(template, { merge: true });
}

export async function deleteStoredTemplate(id: string) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  // Delete from new collection
  await db.collection("email_templates").doc(id).delete();

  // Also remove from old document if it exists to ensure complete reset
  try {
    const oldDocRef = db.collection(TEMPLATES_DOC.collection).doc(TEMPLATES_DOC.id);
    const oldDoc = await oldDocRef.get();
    if (oldDoc.exists) {
      const data = oldDoc.data()?.templates as Record<string, StoredEmailTemplate> | undefined;
      if (data && data[id]) {
        delete data[id];
        await oldDocRef.set({ templates: data }, { merge: true });
      }
    }
  } catch (e) {
    console.error("Failed to clean up old template", e);
  }
}

export async function saveStoredTemplates(templates: Record<string, StoredEmailTemplate>) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  // For backward compatibility / bulk ops, save each template individually
  const batch = db.batch();
  for (const [id, template] of Object.entries(templates)) {
    const ref = db.collection("email_templates").doc(id);
    batch.set(ref, template, { merge: true });
  }
  await batch.commit();
}

export async function getMergedTemplate(id: EmailTemplateId): Promise<EmailTemplateDef> {
  const base = EMAIL_TEMPLATE_DEFINITIONS.find((t) => t.id === id)!;
  const stored = await getStoredTemplates();
  const override = stored[id] || {};
  return {
    ...base,
    ...override,
    id: base.id,
    name: base.name,
    audience: base.audience,
    description: base.description,
    placeholders: base.placeholders,
  };
}

export function maskSmtpForClient(config: SmtpConfig) {
  return {
    ...config,
    pass: config.pass ? "********" : "",
    hasPassword: Boolean(config.pass),
  };
}

export async function getSmtpStatus() {
  const config = await getSmtpConfig();
  const envConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
  const dbConfigured = Boolean(config.host && config.user && config.pass);
  return {
    configured: envConfigured || dbConfigured,
    source: dbConfigured && config.host ? "database" : envConfigured ? "environment" : "none",
    enabled: config.enabled !== false,
  };
}
