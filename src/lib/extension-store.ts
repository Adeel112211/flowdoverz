import { getDb } from "./firebase-admin";
import {
  DEFAULT_EXTENSION_CONFIG,
  sanitizeVersion,
  type ExtensionConfig,
  type ExtensionReleaseMeta,
} from "./extension-config";

const CONFIG_DOC = { collection: "settings", id: "extension" };
const FILES_COLLECTION = "extension_files";

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
  };
}

export async function getExtensionConfig(): Promise<ExtensionConfig> {
  const db = getDb();
  if (!db) return mergeConfig(null);

  try {
    const doc = await db.collection(CONFIG_DOC.collection).doc(CONFIG_DOC.id).get();
    if (!doc.exists) return mergeConfig(null);
    return mergeConfig(doc.data() as Partial<ExtensionConfig>);
  } catch {
    return mergeConfig(null);
  }
}

export async function saveExtensionConfig(partial: Partial<ExtensionConfig>) {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const current = await getExtensionConfig();
  const next = mergeConfig({ ...current, ...partial });
  await db.collection(CONFIG_DOC.collection).doc(CONFIG_DOC.id).set(next, { merge: true });
  return next;
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

  const config = await getExtensionConfig();
  const existing = config.releases.find((r) => r.version === version);

  await db
    .collection(FILES_COLLECTION)
    .doc(version)
    .set({
      zipBase64: input.zipBuffer.toString("base64"),
      fileName: input.fileName,
      fileSize: input.zipBuffer.length,
      uploadedAt: new Date().toISOString(),
    });

  const release: ExtensionReleaseMeta = {
    version,
    versionName: input.versionName || version,
    changelog: input.changelog,
    fileName: input.fileName,
    fileSize: input.zipBuffer.length,
    uploadedAt: new Date().toISOString(),
    isActive: existing?.isActive ?? config.releases.length === 0,
  };

  const releases = existing
    ? config.releases.map((r) => (r.version === version ? release : r))
    : [...config.releases, release];

  const activeVersion =
    releases.find((r) => r.isActive)?.version || release.version;

  const next = await saveExtensionConfig({
    releases: releases.map((r) => ({ ...r, isActive: r.version === activeVersion })),
    activeVersion,
  });

  await syncMinExtensionVersion(activeVersion);
  return next;
}

export async function setActiveExtensionRelease(version: string) {
  const config = await getExtensionConfig();
  const safe = sanitizeVersion(version);
  if (!config.releases.some((r) => r.version === safe)) {
    throw new Error("Release not found.");
  }

  const next = await saveExtensionConfig({
    activeVersion: safe,
    releases: config.releases.map((r) => ({ ...r, isActive: r.version === safe })),
  });

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

  let activeVersion = config.activeVersion;
  if (activeVersion === safe) {
    activeVersion = remaining[0]?.version || null;
  }

  const next = await saveExtensionConfig({
    releases: remaining.map((r) => ({ ...r, isActive: r.version === activeVersion })),
    activeVersion,
  });

  if (activeVersion) await syncMinExtensionVersion(activeVersion);
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
