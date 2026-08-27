/**
 * Copy data from OLD Firebase (read-only — nothing deleted on Firebase) into Supabase.
 *
 * Prerequisites:
 * 1. Run supabase/migrations/001_flowdoverz.sql in Supabase SQL editor
 * 2. Create storage buckets: extension-files, payment-screenshots, reseller-packs, reseller-logos
 * 3. .env.local:
 *    OLD_FIREBASE_PROJECT_ID / OLD_FIREBASE_CLIENT_EMAIL / OLD_FIREBASE_PRIVATE_KEY
 *    SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *    DATABASE_PROVIDER=supabase
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/migrate-firebase-to-supabase.ts
 *   npx tsx --env-file=.env.local scripts/migrate-firebase-to-supabase.ts --retry=20 --retry-ms=180000
 *   npx tsx --env-file=.env.local scripts/migrate-firebase-to-supabase.ts --skip-blobs
 */
import { initializeApp, cert, getApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getSupabaseAdmin } from "../src/lib/supabase-admin";
import { STORAGE_BUCKETS, uploadSupabaseBlob } from "../src/lib/supabase-storage";

const TOP_COLLECTIONS = [
  "users",
  "settings",
  "cookies",
  "resellers",
  "signup_verifications",
  "signup_rate_limits",
  "signup_ip_usage",
  "trial_ip_usage",
  "manual_payments",
  "email_templates",
  "extension_integrity",
  "extension_reseller_integrity",
  "extension_reseller_branding",
  "extension_reseller_packs",
  "extension_files",
  "admin_activity",
  "email_log",
] as const;

const RESELLER_SUBCOLLECTIONS = ["api_usage", "seat_grants"] as const;

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

function oldFirestore(): Firestore {
  const projectId = process.env.OLD_FIREBASE_PROJECT_ID!.trim();
  const clientEmail = process.env.OLD_FIREBASE_CLIENT_EMAIL!.trim();
  const privateKey = normalizePrivateKey(process.env.OLD_FIREBASE_PRIVATE_KEY!);
  let app;
  try {
    app = getApp("migrate-old-firebase");
  } catch {
    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, "migrate-old-firebase");
  }
  return getFirestore(app);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const rec = error as { code?: number | string; message?: string };
  return String(rec.code ?? "") === "8" || /quota exceeded/i.test(String(rec.message || ""));
}

async function withRetry<T>(label: string, fn: () => Promise<T>, maxAttempts: number, retryMs: number) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isQuotaError(error) || attempt >= maxAttempts) throw error;
      console.warn(`${label}: quota blocked, retry ${attempt}/${maxAttempts} in ${Math.round(retryMs / 60000)} min…`);
      await sleep(retryMs);
    }
  }
  throw new Error(`${label}: unreachable`);
}

async function upsertDoc(collectionPath: string, docId: string, data: Record<string, unknown>) {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase not configured.");
  const path = `${collectionPath}/${docId}`;
  const { error } = await client.from("app_documents").upsert({
    path,
    collection_path: collectionPath,
    doc_id: docId,
    data,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function transformAndUpsert(
  collectionPath: string,
  docId: string,
  raw: Record<string, unknown>,
  skipBlobs: boolean,
) {
  const data = { ...raw };

  if (!skipBlobs && collectionPath === "extension_files" && typeof data.zipBase64 === "string") {
    const buffer = Buffer.from(String(data.zipBase64), "base64");
    const storagePath = await uploadSupabaseBlob(
      STORAGE_BUCKETS.extensionFiles,
      `${docId}.zip`,
      buffer,
      "application/zip",
    );
    delete data.zipBase64;
    data.storagePath = storagePath;
    data.fileSize = data.fileSize || buffer.length;
  }

  if (!skipBlobs && collectionPath === "manual_payments" && typeof data.screenshot === "string") {
    const rawShot = String(data.screenshot);
    const base64 = rawShot.includes(",") ? rawShot.split(",")[1] || rawShot : rawShot;
    const buffer = Buffer.from(base64, "base64");
    const storagePath = await uploadSupabaseBlob(
      STORAGE_BUCKETS.paymentScreenshots,
      `${docId}.bin`,
      buffer,
      "application/octet-stream",
    );
    delete data.screenshot;
    data.storagePath = storagePath;
    data.hasScreenshot = true;
  }

  if (!skipBlobs && collectionPath === "extension_reseller_packs" && typeof data.zipBase64 === "string") {
    const buffer = Buffer.from(String(data.zipBase64), "base64");
    const storagePath = await uploadSupabaseBlob(
      STORAGE_BUCKETS.resellerPacks,
      `${docId}.zip`,
      buffer,
      "application/zip",
    );
    delete data.zipBase64;
    data.storagePath = storagePath;
  }

  if (!skipBlobs && collectionPath === "extension_reseller_branding" && typeof data.logoBase64 === "string") {
    const rawLogo = String(data.logoBase64);
    const base64 = rawLogo.includes(",") ? rawLogo.split(",")[1] || rawLogo : rawLogo;
    const buffer = Buffer.from(base64, "base64");
    const storagePath = await uploadSupabaseBlob(
      STORAGE_BUCKETS.resellerLogos,
      `${docId}.png`,
      buffer,
      "image/png",
    );
    delete data.logoBase64;
    data.storagePath = storagePath;
  }

  await upsertDoc(collectionPath, docId, data);
}

async function copyCollection(
  source: Firestore,
  collectionPath: string,
  skipBlobs: boolean,
  maxAttempts: number,
  retryMs: number,
) {
  const snap = await withRetry(`read ${collectionPath}`, () => source.collection(collectionPath).get(), maxAttempts, retryMs);
  let copied = 0;
  for (const doc of snap.docs) {
    await transformAndUpsert(collectionPath, doc.id, (doc.data() || {}) as Record<string, unknown>, skipBlobs);
    copied += 1;
  }
  return copied;
}

async function main() {
  if (!process.env.OLD_FIREBASE_PROJECT_ID?.trim()) {
    throw new Error("Set OLD_FIREBASE_* for the source Firebase project (flow-doverz).");
  }
  if (!getSupabaseAdmin()) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const args = new Set(process.argv.slice(2));
  const skipBlobs = args.has("--skip-blobs");
  const retryArg = process.argv.find((a) => a.startsWith("--retry="));
  const retryMsArg = process.argv.find((a) => a.startsWith("--retry-ms="));
  const maxAttempts = retryArg ? Math.max(1, Number(retryArg.slice("--retry=".length)) || 1) : 3;
  const retryMs = retryMsArg ? Math.max(5000, Number(retryMsArg.slice("--retry-ms=".length)) || 180000) : 180000;

  const source = oldFirestore();
  const result: Record<string, number> = {};

  console.log("Reading from Firebase (OLD — nothing will be deleted)…");
  console.log(`Source project: ${process.env.OLD_FIREBASE_PROJECT_ID}`);
  console.log(`Blobs → Supabase Storage: ${skipBlobs ? "skipped" : "enabled"}\n`);

  for (const collectionId of TOP_COLLECTIONS) {
    result[collectionId] = await copyCollection(source, collectionId, skipBlobs, maxAttempts, retryMs);
    console.log(`  ${collectionId}: ${result[collectionId]} doc(s)`);
  }

  const resellers = await withRetry("read resellers", () => source.collection("resellers").get(), maxAttempts, retryMs);
  for (const reseller of resellers.docs) {
    for (const sub of RESELLER_SUBCOLLECTIONS) {
      const subPath = `resellers/${reseller.id}/${sub}`;
      const subSnap = await withRetry(`read ${subPath}`, () => reseller.ref.collection(sub).get(), maxAttempts, retryMs);
      let count = 0;
      for (const doc of subSnap.docs) {
        await upsertDoc(subPath, doc.id, (doc.data() || {}) as Record<string, unknown>);
        count += 1;
      }
      result[subPath] = (result[subPath] || 0) + count;
    }
  }

  const total = Object.values(result).reduce((sum, n) => sum + n, 0);
  console.log(`\nDone. Copied ${total} document(s) to Supabase. Firebase source untouched.`);
  console.log("Set DATABASE_PROVIDER=supabase on Vercel and redeploy.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
