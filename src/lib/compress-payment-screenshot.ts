import { getSharp } from "./sharp-runtime";

export const PAYMENT_SCREENSHOT_MAX_BYTES = 120 * 1024;
export const PAYMENT_SCREENSHOT_MAX_DIMENSION = 640;

function parseScreenshotBase64(screenshot: string) {
  const raw = String(screenshot || "").trim();
  if (!raw) return { base64: "", mime: "image/jpeg" as const };
  if (raw.startsWith("data:")) {
    const [meta, payload] = raw.split(",", 2);
    const mimeMatch = /^data:([^;]+);base64$/i.exec(meta || "");
    return {
      base64: payload || "",
      mime: (mimeMatch?.[1] || "image/jpeg") as string,
    };
  }
  return { base64: raw, mime: "image/jpeg" };
}

export async function compressPaymentScreenshotBuffer(input: Buffer) {
  if (!input.length) throw new Error("Payment screenshot is empty.");

  const sharp = await getSharp();
  const resize = {
    width: PAYMENT_SCREENSHOT_MAX_DIMENSION,
    height: PAYMENT_SCREENSHOT_MAX_DIMENSION,
    fit: "inside" as const,
    withoutEnlargement: true,
  };

  let quality = 72;
  let output = await sharp(input)
    .rotate()
    .resize(resize)
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  while (output.length > PAYMENT_SCREENSHOT_MAX_BYTES && quality > 40) {
    quality -= 8;
    output = await sharp(input)
      .rotate()
      .resize(resize)
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }

  return output;
}

export async function compressPaymentScreenshotDataUrl(screenshot: string) {
  const { base64 } = parseScreenshotBase64(screenshot);
  if (!base64) throw new Error("Payment screenshot is empty.");

  const compressed = await compressPaymentScreenshotBuffer(Buffer.from(base64, "base64"));
  return `data:image/jpeg;base64,${compressed.toString("base64")}`;
}
