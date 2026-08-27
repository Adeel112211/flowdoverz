/** Test blind deletes on OLD project without listing (when read quota is dead). */
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
    app = getApp("blind-del");
  } catch {
    app = initializeApp({ credential: cert(cred) }, "blind-del");
  }
  const db = getFirestore(app);

  console.log("listCollections…");
  try {
    const cols = await db.listCollections();
    console.log("collections:", cols.map((c) => c.id).join(", ") || "(none)");
  } catch (e) {
    console.log("listCollections FAIL:", e instanceof Error ? e.message : e);
  }

  // Try deleting heavy collections' docs if we guess version ids from admin history
  const heavyTargets = [
    ["extension_files", "1.0.0"],
    ["extension_files", "1.0.1"],
    ["extension_files", "1.0.2"],
    ["extension_files", "1.1.0"],
    ["extension_files", "1.2.0"],
    ["extension_files", "2.0.0"],
    ["admin_activity", "dummy"],
  ];

  for (const [col, id] of heavyTargets) {
    try {
      await db.collection(col).doc(id).delete();
      console.log(`delete ${col}/${id}: OK (or not found)`);
    } catch (e) {
      console.log(`delete ${col}/${id}: FAIL`, e instanceof Error ? e.message : e);
    }
  }
}

main();
