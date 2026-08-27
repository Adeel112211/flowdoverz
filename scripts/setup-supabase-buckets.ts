/**
 * Create required Supabase Storage buckets (one-time setup).
 * Usage: npx tsx --env-file=.env.local scripts/setup-supabase-buckets.ts
 */
import { getSupabaseAdmin, STORAGE_BUCKETS } from "../src/lib/supabase-admin";

const BUCKETS = Object.values(STORAGE_BUCKETS);

async function main() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const { data: existing, error: listError } = await client.storage.listBuckets();
  if (listError) throw new Error(listError.message);

  const names = new Set((existing || []).map((b) => b.name));

  for (const bucket of BUCKETS) {
    if (names.has(bucket)) {
      console.log(`OK  ${bucket} (already exists)`);
      continue;
    }
    const { error } = await client.storage.createBucket(bucket, { public: false });
    if (error) {
      console.error(`FAIL ${bucket}: ${error.message}`);
      process.exitCode = 1;
      continue;
    }
    console.log(`OK  ${bucket} (created)`);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
