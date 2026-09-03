import { getDb } from "@/lib/firebase-admin";
import { getPublicAppUrl } from "@/lib/site-urls";
import { getReseller, originFromUrl, originsForReseller, getResellerBySignupCode, listResellers } from "@/lib/reseller-store";
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
  return `${getPublicAppUrl()}/api/extension/download?reseller=${encodeURIComponent(resellerId)}`;
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
    hasLogo: Boolean(data.hasLogo || data.logoBase64 || data.logoStoragePath),
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
  // Any reseller client with a built branded pack (official or white_label).
  return getResellerIdWithBrandedPackForUser(email);
}

export async function getResellerBrandForUserEmail(email: string): Promise<{
  resellerId: string;
  displayName: string;
  supportEmail: string;
  logoUrl: string | null;
  hasPack: boolean;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  labelColor?: string;
  onPrimaryColor?: string;
} | null> {
  const user = await getUserRecord(email);
  const resellerId = String(user?.resellerId || "").trim();
  if (!resellerId) return null;
  const reseller = await getReseller(resellerId);
  if (!reseller) return null;
  const branded = reseller.brandedExtension;
  const displayName = String(branded?.displayName || reseller.brandName || "").trim();
  if (!displayName) return null;
  const pack = await getResellerExtensionPackMeta(resellerId);
  return {
    resellerId,
    displayName,
    supportEmail: String(branded?.supportEmail || reseller.contactEmail || "").trim().toLowerCase(),
    logoUrl: branded?.hasLogo || pack?.hasLogo ? resellerBrandLogoPath(resellerId) : null,
    hasPack: Boolean(pack),
    primaryColor: String(branded?.primaryColor || "").trim() || undefined,
    accentColor: String(branded?.accentColor || "").trim() || undefined,
    backgroundColor: String(branded?.backgroundColor || "").trim() || undefined,
    labelColor: String(branded?.labelColor || "").trim() || undefined,
    onPrimaryColor: String(branded?.onPrimaryColor || "").trim() || undefined,
  };
}

export async function getResellerIdWithBrandedPackForUser(email: string): Promise<string | null> {
  const brand = await getResellerBrandForUserEmail(email);
  if (!brand?.hasPack) return null;
  return brand.resellerId;
}

export function resellerBrandLogoPath(resellerId: string) {
  return `/api/reseller/brand-logo?id=${encodeURIComponent(resellerId)}`;
}

export function resellerBrandLogoUrl(resellerId: string) {
  return `${getPublicAppUrl()}${resellerBrandLogoPath(resellerId)}`;
}

export async function getBrandedExtensionIdentityForUserEmail(email: string): Promise<{
  displayName: string;
  supportEmail: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  labelColor?: string;
  onPrimaryColor?: string;
} | null> {
  const brand = await getResellerBrandForUserEmail(email);
  if (!brand) return null;
  return {
    displayName: brand.displayName,
    supportEmail: brand.supportEmail,
    logoUrl: brand.logoUrl ? resellerBrandLogoUrl(brand.resellerId) : undefined,
    primaryColor: brand.primaryColor,
    accentColor: brand.accentColor,
    backgroundColor: brand.backgroundColor,
    labelColor: brand.labelColor,
    onPrimaryColor: brand.onPrimaryColor,
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

export type ResellerPortalBrand = {
  displayName: string;
  logoUrl: string | null;
  supportEmail: string;
  tagline: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  labelColor?: string;
  onPrimaryColor?: string;
};

function portalBrandFromRecord(
  reseller: Awaited<ReturnType<typeof getReseller>>,
): ResellerPortalBrand | null {
  if (!reseller) return null;
  const branded = reseller.brandedExtension;
  const displayName = String(
    branded?.displayName || (reseller.kind === "white_label" ? reseller.brandName : ""),
  ).trim();
  if (!displayName) return null;
  return {
    displayName,
    logoUrl: branded?.hasLogo ? resellerBrandLogoPath(reseller.id) : null,
    supportEmail: String(branded?.supportEmail || reseller.contactEmail || "").trim(),
    tagline: `${displayName} Workspace`,
    primaryColor: String(branded?.primaryColor || "").trim() || undefined,
    accentColor: String(branded?.accentColor || "").trim() || undefined,
    backgroundColor: String(branded?.backgroundColor || "").trim() || undefined,
    labelColor: String(branded?.labelColor || "").trim() || undefined,
    onPrimaryColor: String(branded?.onPrimaryColor || "").trim() || undefined,
  };
}

function portalOriginsForReseller(
  reseller: NonNullable<Awaited<ReturnType<typeof getReseller>>>,
) {
  const origins = new Set<string>(originsForReseller(reseller).map((item) => item.toLowerCase()));
  for (const url of [
    reseller.websiteUrl,
    reseller.brandedExtension?.loginUrl,
    reseller.brandedExtension?.dashboardUrl,
  ]) {
    const origin = originFromUrl(String(url || ""));
    if (origin) origins.add(origin);
  }
  return origins;
}

async function getWhiteLabelResellerIdForOrigin(origin: string): Promise<string | null> {
  const normalized = String(origin || "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, "");
  if (!normalized) return null;

  const rows = await listResellers();
  const matches: string[] = [];
  for (const row of rows) {
    if (row.kind !== "white_label") continue;
    const reseller = await getReseller(row.id);
    if (!reseller) continue;
    const origins = portalOriginsForReseller(reseller);
    if (origins.has(normalized)) matches.push(reseller.id);
  }
  if (matches.length !== 1) return null;
  return matches[0]!;
}

/** White-label reseller whose branded login/dashboard origin matches this host. */
export async function getWhiteLabelResellerForOrigin(origin: string) {
  const id = await getWhiteLabelResellerIdForOrigin(origin);
  if (!id) return null;
  return getReseller(id);
}

/** Match reseller branding from the page origin (custom domain) or signup ref code. */
export async function resolveResellerPortalBrand(input: {
  origin?: string;
  ref?: string;
}): Promise<ResellerPortalBrand | null> {
  const ref = String(input.ref || "").trim();
  if (ref) {
    const reseller = await getResellerBySignupCode(ref);
    return portalBrandFromRecord(reseller);
  }

  const id = await getWhiteLabelResellerIdForOrigin(String(input.origin || ""));
  if (!id) return null;
  return portalBrandFromRecord(await getReseller(id));
}
