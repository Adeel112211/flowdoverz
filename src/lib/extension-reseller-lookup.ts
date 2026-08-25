import { getDb } from "@/lib/firebase-admin";
import { getAppUrl } from "@/lib/site-urls";
import { getReseller } from "@/lib/reseller-store";
import { getUserRecord } from "@/lib/user-store";
import { getExtensionConfig, isPreviousOfficialHash } from "@/lib/extension-store";
import type { OfficialIntegrityProfile } from "@/lib/extension-official-from-zip";

export const PACKS_COLLECTION = "extension_reseller_packs";
export const INTEGRITY_COLLECTION = "extension_reseller_integrity";

export type ResellerExtensionMeta = {
  resellerId: string;
  brandName: string;
  displayName: string;
  supportEmail: string;
  dashboardUrl?: string;
  loginUrl?: string;
  hasLogo: boolean;
  version: string;
  officialVersion: string;
  hash: string;
  fileName: string;
  fileSize: number;
  generatedAt: string;
  previousHashes: string[];
};

export type ResellerExtensionIntegrity = ResellerExtensionMeta & {
  profile: OfficialIntegrityProfile;
};

export function brandedExtensionDownloadPath(resellerId: string) {
  return `/api/extension/download?reseller=${encodeURIComponent(resellerId)}`;
}

export function brandedExtensionDownloadUrl(resellerId: string) {
  return `${getAppUrl()}/api/extension/download?reseller=${encodeURIComponent(resellerId)}`;
}

export function asResellerPackMeta(id: string, data: Record<string, unknown>): ResellerExtensionMeta | null {
  const hash = String(data.hash || "").toLowerCase();
  const version = String(data.version || "").trim();
  if (!hash || hash.length < 32 || !version) return null;
  return {
    resellerId: id,
    brandName: String(data.brandName || ""),
    displayName: String(data.displayName || data.brandName || ""),
    supportEmail: String(data.supportEmail || ""),
    dashboardUrl: String(data.dashboardUrl || ""),
    loginUrl: String(data.loginUrl || data.dashboardUrl || ""),
    hasLogo: Boolean(data.hasLogo || data.logoBase64),
    version,
    officialVersion: String(data.officialVersion || version),
    hash,
    fileName: String(data.fileName || "reseller-extension.zip"),
    fileSize: Math.max(0, Math.floor(Number(data.fileSize) || 0)),
    generatedAt: String(data.generatedAt || ""),
    previousHashes: Array.isArray(data.previousHashes)
      ? data.previousHashes.map((item) => String(item || "").toLowerCase()).filter((item) => item.length >= 32)
      : [],
  };
}

export async function getResellerExtensionPackMeta(resellerId: string): Promise<ResellerExtensionMeta | null> {
  const id = String(resellerId || "").trim();
  if (!id) return null;
  const db = getDb();
  if (!db) return null;
  const snap = await db.collection(PACKS_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return asResellerPackMeta(id, (snap.data() || {}) as Record<string, unknown>);
}

export async function getResellerExtensionIntegrity(
  resellerId: string,
): Promise<ResellerExtensionIntegrity | null> {
  const meta = await getResellerExtensionPackMeta(resellerId);
  if (!meta) return null;
  const db = getDb();
  if (!db) return null;
  const integritySnap = await db.collection(INTEGRITY_COLLECTION).doc(resellerId).get();
  if (!integritySnap.exists) return null;
  const data = integritySnap.data() as Partial<OfficialIntegrityProfile>;
  if (!data.hash || !data.payload || !data.attestation) return null;
  return { ...meta, profile: data as OfficialIntegrityProfile };
}

export async function getResellerExtensionIntegrityByHash(
  hash: string,
): Promise<ResellerExtensionIntegrity | null> {
  const normalized = String(hash || "").trim().toLowerCase();
  if (normalized.length < 32) return null;
  const db = getDb();
  if (!db) return null;
  try {
    const integritySnap = await db
      .collection(INTEGRITY_COLLECTION)
      .where("hash", "==", normalized)
      .limit(1)
      .get();
    const integrityDoc = integritySnap.docs[0];
    if (integrityDoc) {
      return getResellerExtensionIntegrity(integrityDoc.id);
    }
  } catch {
    // missing index — try pack meta next
  }
  try {
    const packSnap = await db.collection(PACKS_COLLECTION).where("hash", "==", normalized).limit(1).get();
    const packDoc = packSnap.docs[0];
    if (!packDoc) return null;
    return getResellerExtensionIntegrity(packDoc.id);
  } catch {
    return null;
  }
}

export async function getWhiteLabelResellerIdForUser(email: string): Promise<string | null> {
  const user = await getUserRecord(email);
  const resellerId = String(user?.resellerId || "").trim();
  if (!resellerId) return null;
  const reseller = await getReseller(resellerId);
  if (!reseller || reseller.kind !== "white_label") return null;
  return resellerId;
}

export async function getBrandedExtensionIdentityForUserEmail(email: string): Promise<{
  displayName: string;
  supportEmail: string;
} | null> {
  const user = await getUserRecord(email);
  const resellerId = String(user?.resellerId || "").trim();
  if (!resellerId) return null;
  const reseller = await getReseller(resellerId);
  if (!reseller || reseller.kind !== "white_label") return null;
  const branded = reseller.brandedExtension;
  const displayName = String(branded?.displayName || reseller.brandName || "").trim();
  if (!displayName) return null;
  return {
    displayName,
    supportEmail: String(branded?.supportEmail || "").trim().toLowerCase(),
  };
}

export async function getBrandedExtensionIntegrityForUserEmail(email: string) {
  const resellerId = await getWhiteLabelResellerIdForUser(email);
  if (!resellerId) return null;
  return getResellerExtensionIntegrity(resellerId);
}

export async function isResellerExtensionUpdateRequired(
  email: string | null | undefined,
  incomingHash: string,
) {
  const hash = String(incomingHash || "").trim().toLowerCase();
  if (!email || hash.length < 32) return false;
  const resellerId = await getWhiteLabelResellerIdForUser(email);
  if (!resellerId) return false;
  const meta = await getResellerExtensionPackMeta(resellerId);
  if (!meta) return false;
  if (hash === meta.hash) return false;
  if (meta.previousHashes.includes(hash)) return true;
  try {
    const config = await getExtensionConfig();
    if (hash === String(config.officialHash || "").toLowerCase()) return true;
    if (isPreviousOfficialHash(hash, config)) return true;
  } catch {
    // ignore
  }
  return false;
}
