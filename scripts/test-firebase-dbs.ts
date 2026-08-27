/**
 * Quick connectivity check for OLD + NEW Firestore projects.
 * Usage: npx tsx --env-file=.env.local scripts/test-firebase-dbs.ts
 */
import { initializeApp, cert, getApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

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

function dbFor(prefix: "FIREBASE" | "OLD_FIREBASE", appName: string) {
  const projectId = process.env[`${prefix}_PROJECT_ID`]!.trim();
  const clientEmail = process.env[`${prefix}_CLIENT_EMAIL`]!.trim();
  const privateKey = normalizePrivateKey(process.env[`${prefix}_PRIVATE_KEY`]!);

  let app;
  try {
    app = getApp(appName);
  } catch {
    app = initializeApp(
      { credential: cert({ projectId, clientEmail, privateKey }) },
      appName,
    );
  }
  return { db: getFirestore(app), projectId };
}

async function probe(label: string, db: Firestore, projectId: string) {
  try {
    const snap = await db.collection("users").limit(1).get();
    console.log(`OK  ${label} (${projectId}): users read → ${snap.size} doc(s)`);
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${label} (${projectId}) read: ${msg}`);
    return false;
  }
}

async function probeWrite(label: string, db: Firestore, projectId: string) {
  const ref = db.collection("_migration_probe").doc("ping");
  try {
    await ref.set({ at: new Date().toISOString() });
    await ref.delete();
    console.log(`OK  ${label} (${projectId}): write/delete probe`);
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${label} (${projectId}) write: ${msg}`);
    return false;
  }
}

async function main() {
  const oldCreds = process.env.OLD_FIREBASE_PROJECT_ID?.trim();
  const newCreds = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!oldCreds || !newCreds) {
    console.error("Missing OLD_FIREBASE_PROJECT_ID or FIREBASE_PROJECT_ID");
    process.exit(1);
  }

  const old = dbFor("OLD_FIREBASE", "probe-old");
  const neu = dbFor("FIREBASE", "probe-new");

  console.log("Testing Firestore read access…\n");
  await probe("OLD (source)", old.db, old.projectId);
  await probe("NEW (target)", neu.db, neu.projectId);

  console.log("\nTesting Firestore write access…\n");
  await probeWrite("OLD (source)", old.db, old.projectId);
  await probeWrite("NEW (target)", neu.db, neu.projectId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
