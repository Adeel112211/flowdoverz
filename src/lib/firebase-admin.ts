import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;
let firebaseAuth: Auth | null = null;
let initAttempted = false;

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
    if (!getApps().length) {
      firebaseApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
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
