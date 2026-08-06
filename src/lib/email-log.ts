import { getDb } from "./firebase-admin";

export async function logEmailSent(input: {
  to: string;
  subject: string;
  type: string;
  status: "sent" | "failed";
  error?: string;
}) {
  try {
    const db = getDb();
    if (!db) return;

    await db.collection("email_log").add({
      to: input.to,
      subject: input.subject,
      type: input.type,
      status: input.status,
      error: input.error || null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Failed to log email:", err);
  }
}
