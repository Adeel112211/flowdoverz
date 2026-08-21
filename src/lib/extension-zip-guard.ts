/**
 * Extra files in an admin ZIP are removed, not rejected.
 * official-payload.json is a server fingerprint and must never block upload.
 */

import JSZip from "jszip";

const STRIP_BASENAMES = new Set([
  "official-payload.json",
  "extension-official-payload.json",
  "compute-integrity.js",
  "pack-official.js",
  "guide.md",
  "debug-integrity.js",
  "_check-integrity-temp.js",
  ".ds_store",
]);

function zipPath(name: string) {
  return String(name || "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

function zipBasename(name: string) {
  const path = zipPath(name);
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function shouldStripEntry(name: string) {
  const path = zipPath(name);
  const base = zipBasename(name);
  return (
    STRIP_BASENAMES.has(base) ||
    base.endsWith(".zip") ||
    path.includes("__macosx/") ||
    path.includes("official-payload.json")
  );
}

/**
 * Drop payload/lab files from an uploaded extension ZIP so the official
 * Chrome files can be sealed. Never throws for official-payload.json.
 */
export async function sanitizeOfficialExtensionZip(zipBuffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(zipBuffer);
  let stripped = 0;

  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    if (shouldStripEntry(name)) {
      zip.remove(name);
      stripped += 1;
    }
  }

  if (stripped === 0) return zipBuffer;

  return Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    }),
  );
}
