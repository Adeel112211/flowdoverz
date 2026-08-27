/**
 * Export registered clients from OLD Firebase project (safe fields only — no passwords).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/export-old-users.ts
 *   npx tsx --env-file=.env.local scripts/export-old-users.ts --out=clients-export.json
 *   npx tsx --env-file=.env.local scripts/export-old-users.ts --retry=30 --retry-ms=120000
 *   npx tsx --env-file=.env.local scripts/export-old-users.ts --email=client@example.com
 */
import { readFileSync, writeFileSync } from "fs";
import { initializeApp, cert, getApp } from "firebase-admin/app";
import { getFirestore, type DocumentData, type Firestore } from "firebase-admin/firestore";

function normalizePrivateKey(raw: string) {
  let key = raw.trim();
  while (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  if (key.includes("\\n")) key = key.replace(/\\n/g, "\n");
  return key.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function oldDb() {
  const projectId = process.env.OLD_FIREBASE_PROJECT_ID!.trim();
  const clientEmail = process.env.OLD_FIREBASE_CLIENT_EMAIL!.trim();
  const privateKey = normalizePrivateKey(process.env.OLD_FIREBASE_PRIVATE_KEY!);

  let app;
  try {
    app = getApp("export-old");
  } catch {
    app = initializeApp(
      { credential: cert({ projectId, clientEmail, privateKey }) },
      "export-old",
    );
  }
  return { db: getFirestore(app), projectId };
}

type ExportedClient = {
  email: string;
  name: string;
  subscriptionPlan: string;
  subscriptionExpiresAt: string | null;
  trialExpiresAt: string | null;
  createdAt: string;
  emailVerified: boolean;
  resellerId: string | null;
  assignedSlot: string | null;
};

function mapUserDoc(email: string, d: DocumentData): ExportedClient {
  return {
    email,
    name: String(d.name || ""),
    subscriptionPlan: String(d.subscriptionPlan || "free"),
    subscriptionExpiresAt: d.subscriptionExpiresAt ? String(d.subscriptionExpiresAt) : null,
    trialExpiresAt: d.trialExpiresAt ? String(d.trialExpiresAt) : null,
    createdAt: String(d.createdAt || ""),
    emailVerified: Boolean(d.emailVerified),
    resellerId: d.resellerId ? String(d.resellerId) : null,
    assignedSlot: d.assignedSlot ? String(d.assignedSlot) : null,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const rec = error as { code?: number | string; message?: string };
  const code = String(rec.code ?? "");
  const msg = String(rec.message || "");
  return code === "8" || code === "RESOURCE_EXHAUSTED" || /quota exceeded/i.test(msg);
}

async function exportAllUsers(db: Firestore): Promise<ExportedClient[]> {
  const snap = await db.collection("users").get();
  return snap.docs.map((doc) => mapUserDoc(doc.id, doc.data()));
}

async function exportByEmails(db: Firestore, emails: string[]): Promise<ExportedClient[]> {
  const clients: ExportedClient[] = [];
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!email.includes("@")) continue;
    const snap = await db.collection("users").doc(email).get();
    if (!snap.exists) {
      console.warn(`Not found: ${email}`);
      continue;
    }
    clients.push(mapUserDoc(email, snap.data() || {}));
  }
  return clients;
}

function parseEmailsFromArgs(): string[] {
  const emails: string[] = [];
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--email=")) {
      emails.push(arg.slice("--email=".length));
    }
    if (arg.startsWith("--emails-file=")) {
      const path = arg.slice("--emails-file=".length);
      const text = readFileSync(path, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) emails.push(trimmed);
      }
    }
  }
  return emails;
}

async function main() {
  if (!process.env.OLD_FIREBASE_PROJECT_ID?.trim()) {
    throw new Error(
      "Set OLD_FIREBASE_PROJECT_ID + OLD_FIREBASE_CLIENT_EMAIL + OLD_FIREBASE_PRIVATE_KEY in .env.local",
    );
  }

  const outArg = process.argv.find((a) => a.startsWith("--out="));
  const outPath = outArg?.slice("--out=".length) || "clients-export.json";
  const retryArg = process.argv.find((a) => a.startsWith("--retry="));
  const retryMsArg = process.argv.find((a) => a.startsWith("--retry-ms="));
  const maxAttempts = retryArg ? Math.max(1, Number(retryArg.slice("--retry=".length)) || 1) : 1;
  const retryMs = retryMsArg ? Math.max(5000, Number(retryMsArg.slice("--retry-ms=".length)) || 120000) : 120000;

  const knownEmails = parseEmailsFromArgs();
  const { db, projectId } = oldDb();

  let clients: ExportedClient[] = [];
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      clients = knownEmails.length
        ? await exportByEmails(db, knownEmails)
        : await exportAllUsers(db);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (!isQuotaError(error) || attempt >= maxAttempts) throw error;
      const waitMin = Math.round(retryMs / 60000);
      console.warn(
        `Attempt ${attempt}/${maxAttempts}: quota blocked. Retrying in ~${waitMin} min…`,
      );
      await sleep(retryMs);
    }
  }

  if (lastError) throw lastError;

  clients.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const payload = {
    exportedAt: new Date().toISOString(),
    projectId,
    count: clients.length,
    clients,
  };

  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Exported ${clients.length} client(s) from ${projectId} → ${outPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  console.error(
    "\nQuota still full. Wait until ~12:00 PM Pakistan time, then run again.\n" +
      "Or pass known emails: --email=user@example.com\n" +
      "Auto-retry: --retry=20 --retry-ms=180000",
  );
  process.exit(1);
});
