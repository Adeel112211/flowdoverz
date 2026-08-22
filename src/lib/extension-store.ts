import { getDb } from "./firebase-admin";
import {
  DEFAULT_EXTENSION_CONFIG,
  sanitizeVersion,
  type ExtensionConfig,
  type ExtensionReleaseMeta,
} from "./extension-config";
import type { OfficialIntegrityProfile } from "./extension-official-from-zip";

const CONFIG_DOC = { collection: "settings", id: "extension" };
const FILES_COLLECTION = "extension_files";
const INTEGRITY_COLLECTION = "extension_integrity";
const CONFIG_TTL_MS = 5 * 60 * 1000;
const INTEGRITY_TTL_MS = 5 * 60 * 1000;

let configCache: { value: ExtensionConfig; at: number } | null = null;
let integrityCache: { key: string; value: OfficialIntegrityProfile; at: number } | null = null;

function clearExtensionCaches() {
  integrityCache = null;
}

function mergeConfig(partial?: Partial<ExtensionConfig> | null): ExtensionConfig {
  if (!partial) {
    return {
      ...DEFAULT_EXTENSION_CONFIG,
      installSteps: [...DEFAULT_EXTENSION_CONFIG.installSteps],
      mobileInstallSteps: [...DEFAULT_EXTENSION_CONFIG.mobileInstallSteps],
      releases: [],
    };
  }
  return {
    ...DEFAULT_EXTENSION_CONFIG,
    ...partial,
    installSteps: partial.installSteps?.length
      ? partial.installSteps
      : [...DEFAULT_EXTENSION_CONFIG.installSteps],
    mobileInstallSteps: partial.mobileInstallSteps?.length
      ? partial.mobileInstallSteps
      : [...DEFAULT_EXTENSION_CONFIG.mobileInstallSteps],
    releases: partial.releases || [],
    previousOfficialHashes: Array.isArray(partial.previousOfficialHashes)
      ? partial.previousOfficialHashes.map((hash) => String(hash || "").toLowerCase()).filter((hash) => hash.length >= 32)
      : [],
    officialHash: partial.officialHash ? String(partial.officialHash).toLowerCase() : null,
  };
}

export async function getExtensionConfig(): Promise<ExtensionConfig> {
  if (configCache && Date.now() - configCache.at < CONFIG_TTL_MS) {
    return configCache.value;
  }

  const db = getDb();
  if (!db) return mergeConfig(null);

  try {
    const doc = await db.collection(CONFIG_DOC.collection).doc(CONFIG_DOC.id).get();
    const value = !doc.exists ? mergeConfig(null) : mergeConfig(doc.data() as Partial<ExtensionConfig>);
    configCache = { value, at: Date.now() };
    return value;
  } catch {
    return configCache?.value || mergeConfig(null);
  }
}

export async function saveExtensionConfig(partial: Partial<ExtensionConfig>) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const current = await getExtensionConfig();
  const next = mergeConfig({ ...current, ...partial });
  await db.collection(CONFIG_DOC.collection).doc(CONFIG_DOC.id).set(next, { merge: true });
  configCache = { value: next, at: Date.now() };
  const { touchLive } = await import("./live-tick");
  void touchLive("extension");
  return next;
}

function rotateOfficialHashes(
  previous: string[] | undefined,
  oldHash: string | null | undefined,
  nextHash: string | null | undefined,
) {
  const seen = new Set<string>();
  const out: string[] = [];
  const next = String(nextHash || "").toLowerCase();
  for (const hash of [oldHash, ...(previous || [])]) {
    const value = String(hash || "").toLowerCase();
    if (value.length < 32 || value === next || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= 20) break;
  }
  return out;
}

async function getIntegrityProfile(version: string): Promise<OfficialIntegrityProfile | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const doc = await db.collection(INTEGRITY_COLLECTION).doc(sanitizeVersion(version)).get();
    if (!doc.exists) return null;
    const data = doc.data() as Partial<OfficialIntegrityProfile>;
    if (data.hash && data.payload && data.attestation) return data as OfficialIntegrityProfile;
  } catch {
    return null;
  }
  return null;
}

async function syncMinExtensionVersion(version: string | null) {
  if (!version) return;
  const { saveSystemSettings } = await import("./admin-settings");
  await saveSystemSettings({ minExtensionVersion: version });
}

export async function getExtensionZip(version: string): Promise<{
  buffer: Buffer;
  fileName: string;
  fileSize: number;
} | null> {
  const db = getDb();
  if (!db) return null;

  const doc = await db.collection(FILES_COLLECTION).doc(sanitizeVersion(version)).get();
  if (!doc.exists) return null;

  const data = doc.data() as { zipBase64?: string; fileName?: string; fileSize?: number };
  if (!data.zipBase64) return null;

  return {
    buffer: Buffer.from(data.zipBase64, "base64"),
    fileName: data.fileName || `flowdoverz-${version}.zip`,
    fileSize: data.fileSize || Buffer.byteLength(data.zipBase64, "base64"),
  };
}

export async function uploadExtensionRelease(input: {
  version: string;
  versionName?: string;
  changelog: string;
  fileName: string;
  zipBuffer: Buffer;
}) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const version = sanitizeVersion(input.version);
  if (!version) throw new Error("Version is required.");

  const { sealOfficialExtensionZip } = await import("./extension-official-from-zip");
  const { invalidateOfficialIntegrityCache } = await import("./extension-build");
  const config = await getExtensionConfig();
  const previousProfile = await getActiveIntegrityProfile();
  const sealed = await sealOfficialExtensionZip(input.zipBuffer, { version });
  const previousOfficialHashes = rotateOfficialHashes(
    config.previousOfficialHashes,
    previousProfile?.hash || config.officialHash,
    sealed.profile.hash,
  );

  await db
    .collection(FILES_COLLECTION)
    .doc(version)
    .set({
      zipBase64: sealed.zipBuffer.toString("base64"),
      fileName: input.fileName,
      fileSize: sealed.zipBuffer.length,
      uploadedAt: new Date().toISOString(),
    });

  await db.collection(INTEGRITY_COLLECTION).doc(version).set(sealed.profile);

  const release: ExtensionReleaseMeta = {
    version,
    versionName: input.versionName || version,
    changelog: input.changelog,
    fileName: input.fileName,
    fileSize: sealed.zipBuffer.length,
    uploadedAt: new Date().toISOString(),
    isActive: true,
  };

  const releases = config.releases.some((item) => item.version === version)
    ? config.releases.map((item) => (item.version === version ? release : item))
    : [...config.releases, release];

  const next = await saveExtensionConfig({
    releases: releases.map((item) => ({ ...item, isActive: item.version === version })),
    activeVersion: version,
    officialHash: sealed.profile.hash.toLowerCase(),
    previousOfficialHashes,
  });

  clearExtensionCaches();
  invalidateOfficialIntegrityCache();
  await syncMinExtensionVersion(version);
  return next;
}

export async function setActiveExtensionRelease(version: string) {
  const config = await getExtensionConfig();
  const safe = sanitizeVersion(version);
  if (!config.releases.some((r) => r.version === safe)) {
    throw new Error("Release not found.");
  }

  const previousProfile = await getActiveIntegrityProfile();
  const nextProfile = await getIntegrityProfile(safe);
  const previousOfficialHashes = rotateOfficialHashes(
    config.previousOfficialHashes,
    previousProfile?.hash || config.officialHash,
    nextProfile?.hash,
  );

  const next = await saveExtensionConfig({
    activeVersion: safe,
    officialHash: nextProfile?.hash?.toLowerCase() || config.officialHash || null,
    previousOfficialHashes,
    releases: config.releases.map((r) => ({ ...r, isActive: r.version === safe })),
  });

  const { invalidateOfficialIntegrityCache } = await import("./extension-build");
  clearExtensionCaches();
  invalidateOfficialIntegrityCache();
  await syncMinExtensionVersion(safe);
  return next;
}

export async function deleteExtensionRelease(version: string) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const safe = sanitizeVersion(version);
  const config = await getExtensionConfig();
  const remaining = config.releases.filter((r) => r.version !== safe);

  await db.collection(FILES_COLLECTION).doc(safe).delete();
  await db.collection(INTEGRITY_COLLECTION).doc(safe).delete().catch(() => undefined);

  let activeVersion = config.activeVersion;
  if (activeVersion === safe) {
    activeVersion = remaining[0]?.version || null;
  }

  const next = await saveExtensionConfig({
    releases: remaining.map((r) => ({ ...r, isActive: r.version === activeVersion })),
    activeVersion,
  });

  if (activeVersion) await syncMinExtensionVersion(activeVersion);
  const { invalidateOfficialIntegrityCache } = await import("./extension-build");
  clearExtensionCaches();
  invalidateOfficialIntegrityCache();
  return next;
}

export async function getActiveExtensionDownload() {
  const config = await getExtensionConfig();
  const version = config.activeVersion;
  if (!version) return null;

  const zip = await getExtensionZip(version);
  if (!zip) return null;

  const release = config.releases.find((r) => r.version === version);
  return { config, release, ...zip };
}

export function isPreviousOfficialHash(hash: string | null | undefined, config: ExtensionConfig) {
  const value = String(hash || "").trim().toLowerCase();
  if (value.length < 32) return false;
  return (config.previousOfficialHashes || []).includes(value);
}

export async function getActiveIntegrityProfile(): Promise<OfficialIntegrityProfile | null> {
  const config = await getExtensionConfig();
  const version = config.activeVersion;
  if (!version) return null;

  const cacheKey = `${version}:${String(config.officialHash || "").toLowerCase()}`;
  if (
    integrityCache &&
    integrityCache.key === cacheKey &&
    Date.now() - integrityCache.at < INTEGRITY_TTL_MS
  ) {
    return integrityCache.value;
  }

  const db = getDb();
  if (db) {
    try {
      const doc = await db.collection(INTEGRITY_COLLECTION).doc(sanitizeVersion(version)).get();
      if (doc.exists) {
        const data = doc.data() as Partial<OfficialIntegrityProfile>;
        if (data.hash && data.payload && data.attestation) {
          integrityCache = {
            key: cacheKey,
            value: data as OfficialIntegrityProfile,
            at: Date.now(),
          };
          return integrityCache.value;
        }
      }
    } catch {
      // fall through to zip
    }
  }

  const zip = await getExtensionZip(version);
  if (zip) {
    try {
      const { profileFromExtensionZip } = await import("./extension-official-from-zip");
      const profile = await profileFromExtensionZip(zip.buffer, version);
      if (profile?.hash && profile.payload && profile.attestation) {
        integrityCache = { key: cacheKey, value: profile, at: Date.now() };
        return profile;
      }
    } catch {
      // no sealed profile
    }
  }

  return integrityCache?.key === cacheKey ? integrityCache.value : null;
}
