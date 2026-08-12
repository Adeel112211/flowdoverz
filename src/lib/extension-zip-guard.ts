/**
 * Reject attacker / lab materials from user-facing extension ZIPs.
 * Blocks official-payload.json dual-copy packs and "extension 2" style builds.
 */

const BLOCKED_PATH_SNIPPETS = [
  "official-payload.json",
  "extension 2/",
  "extension2/",
  "extension-2/",
];

const BLOCKED_MANIFEST_MARKERS = [
  "no cookie protect",
  "modified test",
  "noprotect",
  "forged integrity",
  "cookie protection removed",
];

function readZipLocalNames(buffer: Buffer): string[] {
  const names: string[] = [];
  let offset = 0;
  while (offset + 30 < buffer.length) {
    // local file header signature 0x04034b50
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const compSize = buffer.readUInt32LE(offset + 18);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > buffer.length) break;
    const name = buffer.slice(nameStart, nameEnd).toString("utf8").replace(/\\/g, "/");
    names.push(name.toLowerCase());
    offset = nameEnd + extraLen + compSize;
  }
  return names;
}

function extractManifestText(buffer: Buffer): string {
  // Best-effort: search for uncompressed manifest.json ASCII blob in the zip.
  const asText = buffer.toString("utf8");
  const marker = '"manifest_version"';
  const idx = asText.indexOf(marker);
  if (idx < 0) return "";
  const window = asText.slice(Math.max(0, idx - 80), idx + 1200).toLowerCase();
  return window;
}

export function assertSafeExtensionZip(zipBuffer: Buffer): void {
  const names = readZipLocalNames(zipBuffer);
  for (const name of names) {
    for (const blocked of BLOCKED_PATH_SNIPPETS) {
      if (name.includes(blocked)) {
        throw new Error(
          `ZIP rejected: contains blocked path "${blocked}". Upload only the official extension folder.`,
        );
      }
    }
    if (name.endsWith("official-payload.json")) {
      throw new Error(
        "ZIP rejected: official-payload.json is not allowed in client downloads.",
      );
    }
  }

  const manifestText = extractManifestText(zipBuffer);
  for (const marker of BLOCKED_MANIFEST_MARKERS) {
    if (manifestText.includes(marker)) {
      throw new Error(
        "ZIP rejected: manifest looks like a modified/test build. Upload the official extension only.",
      );
    }
  }
}
