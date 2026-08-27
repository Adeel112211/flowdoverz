import type { Firestore } from "firebase-admin/firestore";

type ServiceAccountCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export type FirebaseMigrateOptions = {
  /** Copy extension ZIP blobs (large). Default false. */
  includeExtensionFiles?: boolean;
  /** Copy reseller branded ZIP blobs (large). Default false. */
  includeResellerPacks?: boolean;
  /** Keep payment screenshot base64 on manual_payments. Default false. */
  includePaymentScreenshots?: boolean;
  /** Copy admin activity + email logs. Default false. */
  includeLogs?: boolean;
};

export type FirebaseMigrateResult = {
  sourceProjectId: string;
  targetProjectId: string;
  copied: Record<string, number>;
  skipped: Record<string, number>;
  warnings: string[];
};

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

function credentialsFromEnv(prefix: "FIREBASE" | "OLD_FIREBASE"): ServiceAccountCredentials | null {
  const jsonRaw = process.env[`${prefix}_SERVICE_ACCOUNT_JSON`]?.trim();
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: normalizePrivateKey(parsed.private_key),
      };
    } catch {
      return null;
    }
  }

  const projectId = process.env[`${prefix}_PROJECT_ID`]?.trim();
  const clientEmail = process.env[`${prefix}_CLIENT_EMAIL`]?.trim();
  const privateKeyRaw = process.env[`${prefix}_PRIVATE_KEY`]?.trim();
  if (!projectId || !clientEmail || !privateKeyRaw) return null;

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKeyRaw),
  };
}

function firestoreForCredentials(credentials: ServiceAccountCredentials, appName: string): Firestore {
  const { initializeApp, cert, getApp } = require("firebase-admin/app") as typeof import("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore") as typeof import("firebase-admin/firestore");

  let app;
  try {
    app = getApp(appName);
  } catch {
    app = initializeApp(
      {
        credential: cert({
          projectId: credentials.projectId,
          clientEmail: credentials.clientEmail,
          privateKey: credentials.privateKey,
        }),
      },
      appName,
    );
  }
  return getFirestore(app);
}

function stripLargeFields(
  collectionId: string,
  data: Record<string, unknown>,
  options: FirebaseMigrateOptions,
): Record<string, unknown> {
  const out = { ...data };
  if (collectionId === "manual_payments" && !options.includePaymentScreenshots) {
    delete out.screenshot;
    out.screenshotMigrated = false;
  }
  if (collectionId === "extension_reseller_packs" && !options.includeResellerPacks) {
    delete out.zipBase64;
  }
  if (collectionId === "extension_reseller_branding" && !options.includeResellerPacks) {
    delete out.logoBase64;
  }
  if (collectionId === "extension_files" && !options.includeExtensionFiles) {
    delete out.zipBase64;
  }
  return out;
}

async function copyTopLevelCollection(
  source: Firestore,
  target: Firestore,
  collectionId: string,
  options: FirebaseMigrateOptions,
  copied: Record<string, number>,
  skipped: Record<string, number>,
  warnings: string[],
) {
  if (collectionId === "extension_files" && !options.includeExtensionFiles) {
    skipped[collectionId] = 0;
    return;
  }
  if (collectionId === "extension_reseller_packs" && !options.includeResellerPacks) {
    skipped[collectionId] = 0;
    return;
  }
  if ((collectionId === "admin_activity" || collectionId === "email_log") && !options.includeLogs) {
    skipped[collectionId] = 0;
    return;
  }

  const snap = await source.collection(collectionId).get();
  let count = 0;
  let skip = 0;

  for (const doc of snap.docs) {
    const raw = (doc.data() || {}) as Record<string, unknown>;
    const data = stripLargeFields(collectionId, raw, options);
    const serialized = JSON.stringify(data);

    // Firestore doc max ~1 MiB — skip huge extension rows unless explicitly included.
    if (serialized.length > 900_000) {
      skip += 1;
      warnings.push(`Skipped ${collectionId}/${doc.id} (${Math.round(serialized.length / 1024)}KB too large).`);
      continue;
    }

    await target.collection(collectionId).doc(doc.id).set(data, { merge: true });
    count += 1;
  }

  copied[collectionId] = count;
  if (skip) skipped[collectionId] = skip;
}

async function copyResellerSubcollections(
  source: Firestore,
  target: Firestore,
  copied: Record<string, number>,
) {
  const resellers = await source.collection("resellers").get();
  for (const reseller of resellers.docs) {
    for (const sub of ["api_usage", "seat_grants"] as const) {
      const subSnap = await reseller.ref.collection(sub).get();
      for (const doc of subSnap.docs) {
        await target
          .collection("resellers")
          .doc(reseller.id)
          .collection(sub)
          .doc(doc.id)
          .set(doc.data() || {}, { merge: true });
        copied[`resellers/${sub}`] = (copied[`resellers/${sub}`] || 0) + 1;
      }
    }
  }
}

const DEFAULT_COLLECTIONS = [
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

/** Copy data from OLD_FIREBASE_* project into FIREBASE_* (new) project. */
export async function migrateFirebaseProject(
  options: FirebaseMigrateOptions = {},
): Promise<FirebaseMigrateResult> {
  const sourceCredentials = credentialsFromEnv("OLD_FIREBASE");
  const targetCredentials = credentialsFromEnv("FIREBASE");

  if (!sourceCredentials) {
    throw new Error(
      "Old project credentials missing. Set OLD_FIREBASE_SERVICE_ACCOUNT_JSON or OLD_FIREBASE_PROJECT_ID + OLD_FIREBASE_CLIENT_EMAIL + OLD_FIREBASE_PRIVATE_KEY.",
    );
  }
  if (!targetCredentials) {
    throw new Error(
      "New project credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.",
    );
  }
  if (sourceCredentials.projectId === targetCredentials.projectId) {
    throw new Error("OLD and NEW Firebase project IDs must be different.");
  }

  const resolved: Required<FirebaseMigrateOptions> = {
    includeExtensionFiles: options.includeExtensionFiles ?? false,
    includeResellerPacks: options.includeResellerPacks ?? false,
    includePaymentScreenshots: options.includePaymentScreenshots ?? false,
    includeLogs: options.includeLogs ?? false,
  };

  const source = firestoreForCredentials(sourceCredentials, "flowdoverz-source");
  const target = firestoreForCredentials(targetCredentials, "flowdoverz-target");

  const copied: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const warnings: string[] = [];

  // Clients + core config first.
  for (const collectionId of DEFAULT_COLLECTIONS) {
    try {
      await copyTopLevelCollection(source, target, collectionId, resolved, copied, skipped, warnings);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed while copying "${collectionId}" (${sourceCredentials.projectId} → ${targetCredentials.projectId}): ${msg}`,
      );
    }
  }

  await copyResellerSubcollections(source, target, copied);

  return {
    sourceProjectId: sourceCredentials.projectId,
    targetProjectId: targetCredentials.projectId,
    copied,
    skipped,
    warnings,
  };
}
