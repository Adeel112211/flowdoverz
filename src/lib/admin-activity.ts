import { getDb } from "./firebase-admin";

export type ActivityAction =
  | "admin_login"
  | "admin_logout"
  | "client_created"
  | "client_updated"
  | "client_deleted"
  | "client_suspended"
  | "client_unsuspended"
  | "password_changed"
  | "payment_approved"
  | "payment_rejected"
  | "payment_refunded"
  | "cookies_saved"
  | "cookies_cleared"
  | "settings_updated"
  | "email_sent"
  | "cron_run"
  | "maintenance_updated"
  | "reseller_created"
  | "reseller_updated"
  | "reseller_deleted"
  | "reseller_key_rotated"
  | "reseller_seats_added"
  | "reseller_user_created"
  | "reseller_extension_generated";

export async function logAdminActivity(input: {
  action: ActivityAction;
  detail?: string;
  targetEmail?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    const db = getDb();
    if (!db) return;

    await db.collection("admin_activity").add({
      action: input.action,
      detail: input.detail || "",
      targetEmail: input.targetEmail || null,
      meta: input.meta || {},
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Failed to log admin activity:", err);
  }
}
