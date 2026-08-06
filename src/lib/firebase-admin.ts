import type { App } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";

let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;
let firebaseAuth: Auth | null = null;
let initAttempted = false;
let lastInitError: string | null = null;

type ServiceAccountCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function normalizePrivateKey(raw: string) {
  let key = raw.trim();

  while (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  if (key.includes("\\n")) {
    key = key.replace(/\\n/g, "\n");
  }

  key = key.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (!key.includes("\n") && key.includes("-----BEGIN PRIVATE KEY-----")) {
    key = key
      .replace("-----BEGIN PRIVATE KEY-----", "-----BEGIN PRIVATE KEY-----\n")
      .replace("-----END PRIVATE KEY-----", "\n-----END PRIVATE KEY-----\n");
  }

  return key.trim();
}

function credentialsFromJson(): ServiceAccountCredentials | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };

    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      lastInitError = "FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key.";
      return null;
    }

    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: normalizePrivateKey(parsed.private_key),
    };
  } catch {
    lastInitError = "FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON.";
    return null;
  }
}

function credentialsFromSplitEnv(): ServiceAccountCredentials | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY?.trim();

  if (!projectId || !clientEmail || !privateKeyRaw) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKeyRaw),
  };
}

function resolveCredentials(): ServiceAccountCredentials | null {
  return credentialsFromJson() ?? credentialsFromSplitEnv();
}

export function isFirebaseConfigured() {
  return Boolean(resolveCredentials());
}

export function getFirebaseInitError() {
  return lastInitError;
}

function initFirebaseAdmin() {
  if (initAttempted) return;
  initAttempted = true;
  lastInitError = null;

  const credentials = resolveCredentials();
  if (!credentials) {
    lastInitError =
      "Firebase env vars missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.";
    console.warn(lastInitError);
    return;
  }

  try {
    const { initializeApp, cert, getApps } = require("firebase-admin/app") as typeof import("firebase-admin/app");
    const { getFirestore } = require("firebase-admin/firestore") as typeof import("firebase-admin/firestore");
    const { getAuth } = require("firebase-admin/auth") as typeof import("firebase-admin/auth");

    if (!getApps().length) {
      firebaseApp = initializeApp({
        credential: cert({
          projectId: credentials.projectId,
          clientEmail: credentials.clientEmail,
          privateKey: credentials.privateKey,
        }),
      });
    } else {
      firebaseApp = getApps()[0]!;
    }

    firestoreDb = getFirestore(firebaseApp);
    firebaseAuth = getAuth(firebaseApp);
  } catch (error) {
    lastInitError =
      error instanceof Error
        ? error.message
        : "Firebase admin initialization failed.";
    console.error("Firebase admin initialization error", error);
    firebaseApp = null;
    firestoreDb = null;
    firebaseAuth = null;
  }
}

export function getDb(): Firestore | null {
  initFirebaseAdmin();
  return firestoreDb;
}

export function getAdminAuth(): Auth | null {
  initFirebaseAdmin();
  return firebaseAuth;
}
