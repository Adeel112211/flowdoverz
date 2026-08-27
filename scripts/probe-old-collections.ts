/** Probe which OLD collections are readable under quota limits. */
import { initializeApp, cert, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function normalizePrivateKey(raw: string) {
  let key = raw.trim();
  if (key.includes("\\n")) key = key.replace(/\\n/g, "\n");
  return key;
}

async function main() {
  const cred = {
    projectId: process.env.OLD_FIREBASE_PROJECT_ID!,
    clientEmail: process.env.OLD_FIREBASE_CLIENT_EMAIL!,
    privateKey: normalizePrivateKey(process.env.OLD_FIREBASE_PRIVATE_KEY!),
  };
  let app;
  try {
    app = getApp("probe-old-cols");
  } catch {
    app = initializeApp({ credential: cert(cred) }, "probe-old-cols");
  }
  const db = getFirestore(app);

  for (const name of ["users", "settings", "cookies", "resellers", "manual_payments"]) {
    try {
      const snap = await db.collection(name).limit(5).get();
      console.log(`${name}: OK — ${snap.size} doc(s)`);
      for (const doc of snap.docs) {
        const d = doc.data();
        if (name === "users") {
          console.log(`  - ${doc.id} | ${d.name} | ${d.subscriptionPlan}`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`${name}: FAIL — ${msg}`);
    }
  }
}

main();
