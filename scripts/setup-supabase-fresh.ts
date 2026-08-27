/**
 * Seed a fresh Supabase project so FlowDoverz works for new signups (no Firebase migration needed).
 *
 * Usage: npx tsx --env-file=.env.local scripts/setup-supabase-fresh.ts
 */
import { DEFAULT_SYSTEM_SETTINGS } from "../src/lib/admin-settings";
import { DEFAULT_EXTENSION_CONFIG } from "../src/lib/extension-config";
import { mergePricingConfig } from "../src/lib/pricing-config";
import { getSupabaseAdmin } from "../src/lib/supabase-admin";

async function upsertSettingsDoc(id: string, data: Record<string, unknown>) {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase not configured.");

  const collectionPath = "settings";
  const path = `${collectionPath}/${id}`;
  const { error } = await client.from("app_documents").upsert({
    path,
    collection_path: collectionPath,
    doc_id: id,
    data,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`${path}: ${error.message}`);
}

async function main() {
  if (!getSupabaseAdmin()) {
    throw new Error("Set DATABASE_PROVIDER=supabase, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.");
  }

  const pricing = mergePricingConfig(null);

  await upsertSettingsDoc("system", DEFAULT_SYSTEM_SETTINGS as unknown as Record<string, unknown>);
  await upsertSettingsDoc("extension", DEFAULT_EXTENSION_CONFIG as unknown as Record<string, unknown>);
  await upsertSettingsDoc("pricing", pricing as unknown as Record<string, unknown>);
  await upsertSettingsDoc("live", {
    rev: 0,
    topic: "boot",
    action: "seed",
    at: new Date().toISOString(),
    events: [],
  });

  console.log("Seeded Supabase defaults:");
  console.log("  settings/system");
  console.log("  settings/extension");
  console.log("  settings/pricing");
  console.log("  settings/live");
  console.log("\nNew users can signup. Upload extension ZIP + cookies in Admin after deploy.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
