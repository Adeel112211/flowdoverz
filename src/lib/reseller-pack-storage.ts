import sharp from "sharp";
import { isSupabaseBackend } from "./firebase-admin";
import { deleteSupabaseBlob, downloadSupabaseBlob, uploadSupabaseBlob, STORAGE_BUCKETS } from "./supabase-storage";

const LOGO_MAX_BYTES = 80 * 1024;
const LOGO_MAX_DIMENSION = 256;

export function shouldStoreResellerPackInStorage() {
  return isSupabaseBackend();
}

export async function saveResellerPackZip(resellerId: string, buffer: Buffer) {
  return uploadSupabaseBlob(
    STORAGE_BUCKETS.resellerPacks,
    `${resellerId}.zip`,
    buffer,
    "application/zip",
  );
}

export async function loadResellerPackZip(record: {
  zipBase64?: unknown;
  storagePath?: unknown;
}): Promise<Buffer | null> {
  if (typeof record.storagePath === "string" && record.storagePath.trim()) {
    return downloadSupabaseBlob(record.storagePath);
  }
  const base64 = String(record.zipBase64 || "");
  if (!base64) return null;
  return Buffer.from(base64, "base64");
}

async function compressLogoBuffer(input: Buffer) {
  let quality = 82;
  let output = await sharp(input)
    .rotate()
    .resize(LOGO_MAX_DIMENSION, LOGO_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  while (output.length > LOGO_MAX_BYTES && quality > 45) {
    quality -= 10;
    output = await sharp(input)
      .rotate()
      .resize(LOGO_MAX_DIMENSION, LOGO_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }

  return { buffer: output, mime: "image/jpeg" as const };
}

export async function saveResellerLogo(resellerId: string, buffer: Buffer, mime: string) {
  const compressed = await compressLogoBuffer(buffer);
  return uploadSupabaseBlob(
    STORAGE_BUCKETS.resellerLogos,
    `${resellerId}.jpg`,
    compressed.buffer,
    compressed.mime,
  );
}

export async function loadResellerLogo(record: {
  logoBase64?: unknown;
  logoStoragePath?: unknown;
  logoMime?: unknown;
}): Promise<{ base64: string; mime: string } | null> {
  if (typeof record.logoBase64 === "string" && record.logoBase64.trim()) {
    return {
      base64: record.logoBase64,
      mime: String(record.logoMime || "image/png"),
    };
  }
  if (typeof record.logoStoragePath !== "string" || !record.logoStoragePath.trim()) {
    return null;
  }
  const buffer = await downloadSupabaseBlob(record.logoStoragePath);
  if (!buffer) return null;
  return {
    base64: buffer.toString("base64"),
    mime: String(record.logoMime || "image/jpeg"),
  };
}

export async function deleteResellerPackStorage(
  packRecord: Record<string, unknown>,
  brandingRecord?: Record<string, unknown>,
) {
  if (typeof packRecord.storagePath === "string" && packRecord.storagePath.trim()) {
    try {
      await deleteSupabaseBlob(packRecord.storagePath);
    } catch (error) {
      console.warn("Failed to delete reseller pack blob:", error);
    }
  }

  const logoPath =
    typeof brandingRecord?.logoStoragePath === "string"
      ? brandingRecord.logoStoragePath
      : typeof packRecord.logoStoragePath === "string"
        ? packRecord.logoStoragePath
        : "";
  if (logoPath.trim()) {
    try {
      await deleteSupabaseBlob(logoPath);
    } catch (error) {
      console.warn("Failed to delete reseller logo blob:", error);
    }
  }
}
