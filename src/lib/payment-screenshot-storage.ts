import { isSupabaseBackend } from "./firebase-admin";
import { deleteSupabaseBlob, downloadSupabaseBlob, uploadSupabaseBlob, STORAGE_BUCKETS } from "./supabase-storage";

export async function preparePaymentScreenshot(screenshot: string) {
  const { compressPaymentScreenshotDataUrl } = await import("./compress-payment-screenshot");
  return compressPaymentScreenshotDataUrl(screenshot);
}

export async function savePaymentScreenshot(paymentId: string, screenshotDataUrl: string) {
  const base64 = screenshotDataUrl.split(",", 2)[1] || "";
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new Error("Payment screenshot is empty.");

  return uploadSupabaseBlob(
    STORAGE_BUCKETS.paymentScreenshots,
    `${paymentId}.jpg`,
    buffer,
    "image/jpeg",
  );
}

export async function loadPaymentScreenshotDataUrl(record: {
  screenshot?: unknown;
  storagePath?: unknown;
}): Promise<string | null> {
  if (typeof record.screenshot === "string" && record.screenshot.trim()) {
    return record.screenshot;
  }
  if (typeof record.storagePath !== "string" || !record.storagePath.trim()) {
    return null;
  }
  const buffer = await downloadSupabaseBlob(record.storagePath);
  if (!buffer) return null;
  const ext = record.storagePath.split(".").pop()?.toLowerCase();
  const mime =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export async function stripPaymentScreenshotFields(
  paymentRef: {
    get: () => Promise<{ data: () => Record<string, unknown> | undefined }>;
    set: (data: Record<string, unknown>, options?: { merge?: boolean }) => Promise<unknown>;
  },
  record: Record<string, unknown>,
) {
  if (typeof record.storagePath === "string" && record.storagePath.trim()) {
    try {
      await deleteSupabaseBlob(record.storagePath);
    } catch (error) {
      console.warn("Failed to delete payment screenshot blob:", error);
    }
  }

  const snap = await paymentRef.get();
  const data = { ...(snap.data() || {}) };
  delete data.screenshot;
  delete data.storagePath;
  data.hasScreenshot = false;
  await paymentRef.set(data, { merge: false });
}

export async function deletePaymentScreenshotBlob(record: Record<string, unknown>) {
  if (typeof record.storagePath !== "string" || !record.storagePath.trim()) return;
  try {
    await deleteSupabaseBlob(record.storagePath);
  } catch (error) {
    console.warn("Failed to delete payment screenshot blob:", error);
  }
}

export function shouldStorePaymentScreenshotInStorage() {
  return isSupabaseBackend();
}
