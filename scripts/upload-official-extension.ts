/**
 * Upload the local official extension ZIP and rebuild branded reseller packs.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/upload-official-extension.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { uploadExtensionRelease } from "../src/lib/extension-store";
import { rebuildResellerExtensionPacks } from "../src/lib/extension-reseller-pack";

async function main() {
  const zipPath = resolve(process.cwd(), "extension/FlowDoverz-official.zip");
  const zipBuffer = readFileSync(zipPath);
  const zip = await JSZip.loadAsync(zipBuffer);
  const manifestEntry = zip.file("manifest.json");
  if (!manifestEntry) throw new Error("ZIP is missing manifest.json");
  const manifest = JSON.parse(await manifestEntry.async("string")) as {
    version?: string;
    version_name?: string;
  };
  const version = String(manifest.version || "").trim();
  if (!version) throw new Error("manifest.json has no version");

  console.log(`Uploading FlowDoverz-official.zip v${version} (${zipBuffer.length} bytes)...`);
  await uploadExtensionRelease({
    version,
    versionName: String(manifest.version_name || version),
    changelog: "Branded portal-bridge sync fix",
    fileName: "FlowDoverz-official.zip",
    zipBuffer,
  });
  console.log(`Official extension v${version} uploaded and set active.`);

  console.log("Rebuilding branded reseller extension packs...");
  const result = await rebuildResellerExtensionPacks();
  console.log(`Rebuilt ${result.rebuilt}, failed ${result.failed}.`);
  if (result.errors?.length) {
    for (const line of result.errors) console.error(`  - ${line}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
