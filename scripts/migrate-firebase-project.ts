/**
 * Copy client + settings data from the OLD Firebase project into the NEW one.
 *
 * .env.local example:
 *   OLD_FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"old-project",...}
 *   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"flowdoverz-2523e",...}
 *
 * Or use split vars: OLD_FIREBASE_PROJECT_ID / FIREBASE_PROJECT_ID + email + private key.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/migrate-firebase-project.ts
 *   npx tsx --env-file=.env.local scripts/migrate-firebase-project.ts --include-extension-files
 */
import { migrateFirebaseProject } from "../src/lib/firebase-migrate";

async function main() {
  const args = new Set(process.argv.slice(2));
  console.log("Migrating Firestore data from OLD_FIREBASE_* → FIREBASE_* …");

  const result = await migrateFirebaseProject({
    includeExtensionFiles: args.has("--include-extension-files"),
    includeResellerPacks: args.has("--include-reseller-packs"),
    includePaymentScreenshots: args.has("--include-payment-screenshots"),
    includeLogs: args.has("--include-logs"),
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.warnings.length) {
    console.log("\nWarnings:");
    for (const warning of result.warnings) console.log(`- ${warning}`);
  }

  console.log("\nDone. Update Vercel FIREBASE_* to the NEW project and redeploy.");
  console.log("Re-upload official extension ZIP if extension_files were skipped.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
