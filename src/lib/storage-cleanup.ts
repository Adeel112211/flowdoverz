import { WORKSPACE_OWNER } from "@/lib/admin";
import { clearSlotCookies, listSlots } from "@/lib/cookie-store";
import { getDb } from "@/lib/firebase-admin";
import {
  getExtensionConfig,
  saveExtensionConfig,
} from "@/lib/extension-store";
import { sanitizeVersion } from "@/lib/extension-config";
import type { ExtensionReleaseMeta } from "@/lib/extension-config";

const FILES_COLLECTION = "extension_files";
const INTEGRITY_COLLECTION = "extension_integrity";

export type PurgeOldExtensionResult = {
  keptVersion: string;
  deletedFileVersions: string[];
  deletedIntegrityVersions: string[];
};

type FileDoc = { id: string; data: () => { uploadedAt?: string } };

function resolveKeepVersion(
  config: Awaited<ReturnType<typeof getExtensionConfig>>,
  fileDocs: FileDoc[],
): string {
  const fromActive = sanitizeVersion(config.activeVersion || "");
  if (fromActive) return fromActive;

  const releaseVersions = config.releases
    .map((item) => sanitizeVersion(item.version))
    .filter(Boolean);
  if (releaseVersions.length === 1) return releaseVersions[0];

  const byUploaded = [...config.releases]
    .filter((item) => sanitizeVersion(item.version))
    .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
  if (byUploaded[0]?.version) return sanitizeVersion(byUploaded[0].version);

  const fromFiles = fileDocs
    .map((doc) => ({
      version: sanitizeVersion(doc.id),
      uploadedAt: String((doc.data() as { uploadedAt?: string }).uploadedAt || ""),
    }))
    .filter((item) => item.version)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  if (fromFiles[0]?.version) return fromFiles[0].version;

  if (fileDocs.length === 1) return sanitizeVersion(fileDocs[0].id);

  return "";
}

/** Delete every official extension ZIP + integrity profile except the active release. */
export async function purgeOldExtensionReleases(): Promise<PurgeOldExtensionResult> {
  const config = await getExtensionConfig();

  const db = getDb();
  if (!db) throw new Error("Database not configured.");

  const filesSnap = await db.collection(FILES_COLLECTION).get();
  const keep = resolveKeepVersion(config, filesSnap.docs);
  if (!keep) {
    throw new Error(
      "No extension version found to keep. Upload an official ZIP in Admin → Extension first.",
    );
  }

  const deletedFileVersions: string[] = [];
  const deletedIntegrityVersions: string[] = [];

  const integritySnap = await db.collection(INTEGRITY_COLLECTION).get();

  for (const doc of filesSnap.docs) {
    if (doc.id === keep) continue;
    const fileData = doc.data() as { storagePath?: string; zipBase64?: string };
    if (fileData.storagePath) {
      try {
        const { deleteSupabaseBlob } = await import("./supabase-storage");
        await deleteSupabaseBlob(String(fileData.storagePath));
      } catch (error) {
        console.warn(`Failed to delete extension storage ${doc.id}:`, error);
      }
    }
    await doc.ref.delete();
    deletedFileVersions.push(doc.id);
  }

  for (const doc of integritySnap.docs) {
    if (doc.id === keep) continue;
    await doc.ref.delete();
    deletedIntegrityVersions.push(doc.id);
  }

  const activeRelease: ExtensionReleaseMeta =
    config.releases.find((item) => item.version === keep) || {
      version: keep,
      versionName: keep,
      changelog: "",
      fileName: `flowdoverz-${keep}.zip`,
      fileSize: 0,
      uploadedAt: new Date().toISOString(),
      isActive: true,
    };

  await saveExtensionConfig({
    activeVersion: keep,
    releases: [{ ...activeRelease, isActive: true }],
    previousOfficialHashes: [],
  });

  const { invalidateOfficialIntegrityCache } = await import("./extension-build");
  invalidateOfficialIntegrityCache();

  return {
    keptVersion: keep,
    deletedFileVersions,
    deletedIntegrityVersions,
  };
}

export type PurgeEmptyCookieSlotsResult = {
  ownerKey: string;
  keptSlots: string[];
  removedSlots: string[];
};

/** Remove cookie slots that have no cookies. Slots with live cookies are kept. */
export async function purgeEmptyCookieSlots(
  ownerKey: string = WORKSPACE_OWNER,
): Promise<PurgeEmptyCookieSlotsResult> {
  const slots = await listSlots(ownerKey);
  const keptSlots: string[] = [];
  const removedSlots: string[] = [];

  for (const { key, record } of slots) {
    const hasCookies = Array.isArray(record.cookies) && record.cookies.length > 0;
    if (hasCookies) {
      keptSlots.push(key);
      continue;
    }
    await clearSlotCookies(ownerKey, key);
    removedSlots.push(key);
  }

  return { ownerKey, keptSlots, removedSlots };
}

export async function purgeOldExtensionAndEmptyCookieSlots() {
  const extension = await purgeOldExtensionReleases();
  const cookies = await purgeEmptyCookieSlots();
  return { extension, cookies };
}
