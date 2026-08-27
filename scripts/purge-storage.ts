/**
 * One-off database cleanup when Firebase quota/storage is tight.
 *
 * Keeps:
 * - Active trial/subscription clients
 * - Latest official extension ZIP
 * - Cookie slots that still have cookies
 *
 * Removes:
 * - Old extension versions
 * - Empty cookie slots
 * - Inactive / unverified clients + their payments/logs
 * - Old approved/rejected payment screenshots (90+ days)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/purge-storage.ts
 */
import { purgeDatabaseStorage } from "../src/lib/client-data-cleanup";

async function main() {
  console.log("Running full database storage purge…");
  const result = await purgeDatabaseStorage();
  console.log(JSON.stringify(result, null, 2));
  console.log("Done.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
