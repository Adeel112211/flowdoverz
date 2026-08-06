import type { App } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";

let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;
let firebaseAuth: Auth | null = null;
let initAttempted = false;

function normalizePrivateKey(raw: string) {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

function hasFirebaseEnv() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

function initFirebaseAdmin() {
  if (initAttempted) return;
  initAttempted = true;

  if (!hasFirebaseEnv()) {
    console.warn("Firebase admin env vars missing — database features disabled.");
    return;
  }

  try {
    // Lazy require keeps firebase-admin out of the edge bundle on Vercel.
    const { initializeApp, cert, getApps } = require("firebase-admin/app") as typeof import("firebase-admin/app");
    const { getFirestore } = require("firebase-admin/firestore") as typeof import("firebase-admin/firestore");
    const { getAuth } = require("firebase-admin/auth") as typeof import("firebase-admin/auth");

    if (!getApps().length) {
      firebaseApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY!),
        }),
      });
    } else {
      firebaseApp = getApps()[0]!;
    }

    firestoreDb = getFirestore(firebaseApp);
    firebaseAuth = getAuth(firebaseApp);
  } catch (error) {
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

export function isFirebaseConfigured() {
  return hasFirebaseEnv();
}
