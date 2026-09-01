/**
 * End free-trial access immediately for all non-paid users whose trial is still active.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/expire-active-trials.ts
 *   npx tsx --env-file=.env.local scripts/expire-active-trials.ts --dry-run
 */
import { getSupabaseAdmin } from "../src/lib/supabase-admin";

const PAID_PLANS = new Set(["solo", "studio", "team", "nano", "ultra"]);

function isPaidPlan(plan: string) {
  return PAID_PLANS.has(plan.toLowerCase());
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const client = getSupabaseAdmin();
  if (!client) {
    throw new Error("Set DATABASE_PROVIDER=supabase, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const pageSize = 500;
  let offset = 0;
  let scanned = 0;
  let expired = 0;
  const samples: string[] = [];

  for (;;) {
    const { data, error } = await client
      .from("app_documents")
      .select("path, doc_id, data")
      .eq("collection_path", "users")
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    const rows = data || [];
    if (!rows.length) break;

    for (const row of rows) {
      scanned += 1;
      const doc = (row.data || {}) as Record<string, unknown>;
      const email = String(row.doc_id || doc.email || "").trim().toLowerCase();
      const plan = String(doc.subscriptionPlan || "none").toLowerCase();
      const trialExpiresAt = doc.trialExpiresAt ? String(doc.trialExpiresAt) : null;
      const subscriptionExpiresAt = doc.subscriptionExpiresAt
        ? String(doc.subscriptionExpiresAt)
        : null;

      if (!email || !trialExpiresAt) continue;
      const trialMs = Date.parse(trialExpiresAt);
      if (!Number.isFinite(trialMs) || trialMs <= now.getTime()) continue;

      const paidActive =
        isPaidPlan(plan) &&
        subscriptionExpiresAt &&
        Number.isFinite(Date.parse(subscriptionExpiresAt)) &&
        Date.parse(subscriptionExpiresAt) > now.getTime();
      if (paidActive) continue;

      expired += 1;
      if (samples.length < 20) samples.push(email);

      if (!dryRun) {
        const nextData = {
          ...doc,
          trialExpiresAt: nowIso,
          subscriptionPlan: isPaidPlan(plan) ? plan : "none",
          subscriptionExpiresAt: isPaidPlan(plan) ? doc.subscriptionExpiresAt ?? null : null,
        };
        const { error: updateError } = await client
          .from("app_documents")
          .update({ data: nextData, updated_at: nowIso })
          .eq("path", row.path);
        if (updateError) throw new Error(`${email}: ${updateError.message}`);
      }
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  console.log(dryRun ? "Dry run complete." : "Expire complete.");
  console.log(`Scanned users: ${scanned}`);
  console.log(`Active trials ${dryRun ? "would expire" : "expired"}: ${expired}`);
  if (samples.length) {
    console.log("Sample emails:");
    for (const email of samples) console.log(`  - ${email}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
