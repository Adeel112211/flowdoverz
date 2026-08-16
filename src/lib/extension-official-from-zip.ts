import { createHash } from "crypto";
import JSZip from "jszip";

/** Text files hashed for official vs modified detection. Keep in sync with integrity-guard.js */
export const CANONICAL_INTEGRITY_FILES = [
  "background.js",
  "cookie-core.js",
  "popup.js",
  "popup.html",
  "popup.css",
  "manifest.json",
  "integrity-guard.js",
  "protect.js",
  "portal-bridge.js",
  "content.js",
  "fake-credits.js",
  "fake-models-main.js",
  "watchdog-isolated.js",
  "watchdog-main.js",
] as const;

export type OfficialIntegrityAttestation = {
  enforce: string;
  isBlockedCookieExtension: string;
  computeLivePayload: string;
  proveForSync: string;
};

export type OfficialIntegrityProfile = {
  hash: string;
  payload: string;
  files: string[];
  attestation: OfficialIntegrityAttestation;
  version: string;
  generatedAt: string;
};

export function stripIntegrityHashConstant(text: string) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/const EXPECTED_INTEGRITY_HASH = "[^"]*";/, "")
    .replace(/const INTEGRITY_HASH = "[^"]*";/, "");
}

export function extractNamedFunction(source: string, name: string) {
  const re = new RegExp(`(async\\s+)?function\\s+${name}\\s*\\(`);
  const match = re.exec(source);
  if (!match) {
    throw new Error(`Could not extract function ${name}`);
  }
  const braceStart = source.indexOf("{", match.index);
  if (braceStart < 0) {
    throw new Error(`Could not find body for function ${name}`);
  }
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(match.index, i + 1);
      }
    }
  }
  throw new Error(`Unclosed function ${name}`);
}

function zipEntry(zip: JSZip, fileName: string) {
  const exact = zip.file(fileName);
  if (exact && !exact.dir) return exact;
  const suffix = `/${fileName}`;
  const found = Object.values(zip.files).find(
    (entry) => !entry.dir && (entry.name === fileName || entry.name.endsWith(suffix)),
  );
  return found || null;
}

function integrityFilesSource(files: string[]) {
  return `const INTEGRITY_FILES = [\n${files.map((file) => `    "${file}",`).join("\n")}\n  ];`;
}

function sha256Hex(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Stamp an uploaded ZIP as official: hash every text file, write EXPECTED_INTEGRITY_HASH,
 * and return the server proof profile. Modified copies of this ZIP will fail sync.
 */
export async function sealOfficialExtensionZip(
  zipBuffer: Buffer,
  options?: { version?: string },
): Promise<{
  zipBuffer: Buffer;
  profile: OfficialIntegrityProfile;
}> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const files = [...CANONICAL_INTEGRITY_FILES];

  const guardEntry = zipEntry(zip, "integrity-guard.js");
  if (!guardEntry) throw new Error("ZIP is missing integrity-guard.js.");
  const protectEntry = zipEntry(zip, "protect.js");
  if (!protectEntry) throw new Error("ZIP is missing protect.js.");

  for (const file of files) {
    if (!zipEntry(zip, file)) {
      throw new Error(`ZIP is missing required file: ${file}`);
    }
  }

  let guardSrc = await guardEntry.async("string");
  if (!/const INTEGRITY_FILES = \[/.test(guardSrc)) {
    throw new Error("integrity-guard.js is missing INTEGRITY_FILES.");
  }
  if (!/const EXPECTED_INTEGRITY_HASH = "[^"]*";/.test(guardSrc)) {
    throw new Error("integrity-guard.js is missing EXPECTED_INTEGRITY_HASH.");
  }

  guardSrc = guardSrc.replace(/const INTEGRITY_FILES = \[[\s\S]*?\];/, integrityFilesSource(files));

  const texts: Record<string, string> = {
    "integrity-guard.js": guardSrc,
  };
  for (const file of files) {
    if (file === "integrity-guard.js") continue;
    texts[file] = await zipEntry(zip, file)!.async("string");
  }

  const releaseVersion = String(options?.version || "").trim();
  if (releaseVersion) {
    try {
      const manifest = JSON.parse(texts["manifest.json"] || "{}") as {
        version?: string;
        version_name?: string;
      };
      manifest.version = releaseVersion;
      manifest.version_name = releaseVersion;
      const stamped = `${JSON.stringify(manifest, null, 2)}\n`;
      texts["manifest.json"] = stamped;
      const manifestEntry = zipEntry(zip, "manifest.json");
      if (manifestEntry) zip.file(manifestEntry.name, stamped);
    } catch {
      throw new Error("ZIP manifest.json could not be updated with the release version.");
    }
  }

  let payload = files.map((file) => stripIntegrityHashConstant(texts[file])).join("");
  const hash = sha256Hex(payload);

  guardSrc = guardSrc.replace(
    /const EXPECTED_INTEGRITY_HASH = "[^"]*";/,
    `const EXPECTED_INTEGRITY_HASH = "${hash}";`,
  );
  texts["integrity-guard.js"] = guardSrc;
  zip.file(guardEntry.name, guardSrc);

  payload = files.map((file) => stripIntegrityHashConstant(texts[file])).join("");

  const protectSrc = texts["protect.js"];
  const guardStripped = stripIntegrityHashConstant(guardSrc);
  const attestation: OfficialIntegrityAttestation = {
    enforce: extractNamedFunction(protectSrc, "enforce"),
    isBlockedCookieExtension: extractNamedFunction(protectSrc, "isBlockedCookieExtension"),
    computeLivePayload: extractNamedFunction(guardStripped, "computeLivePayload"),
    proveForSync: extractNamedFunction(guardStripped, "proveForSync"),
  };

  for (const [name, src] of Object.entries(attestation)) {
    if (!src || src.length < 80) {
      throw new Error(`Attestation source too short: ${name}`);
    }
  }

  let version = releaseVersion || "1.0.0";
  if (!releaseVersion) {
    try {
      const manifest = JSON.parse(texts["manifest.json"] || "{}") as { version?: string };
      version = String(manifest.version || version);
    } catch {
      // keep default
    }
  }

  const sealed = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return {
    zipBuffer: Buffer.from(sealed),
    profile: {
      hash,
      payload,
      files,
      attestation,
      version,
      generatedAt: new Date().toISOString(),
    },
  };
}
