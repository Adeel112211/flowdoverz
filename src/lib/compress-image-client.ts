export const PAYMENT_SCREENSHOT_MAX_BYTES = 120 * 1024;
export const PAYMENT_SCREENSHOT_MAX_DIMENSION = 640;

function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.floor((base64.length * 3) / 4);
}

function compressCanvasToJpegDataUrl(canvas: HTMLCanvasElement, maxBytes = PAYMENT_SCREENSHOT_MAX_BYTES) {
  let quality = 0.72;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (estimateDataUrlBytes(dataUrl) > maxBytes && quality > 0.38) {
    quality -= 0.06;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return dataUrl;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image."));
    img.src = src;
  });
}

export async function compressPaymentScreenshotFile(file: File) {
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image must be less than 8MB.");
  }

  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result || ""));
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });

  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  const scale = Math.min(
    1,
    PAYMENT_SCREENSHOT_MAX_DIMENSION / img.width,
    PAYMENT_SCREENSHOT_MAX_DIMENSION / img.height,
  );
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");
  ctx.drawImage(img, 0, 0, width, height);

  return compressCanvasToJpegDataUrl(canvas);
}
