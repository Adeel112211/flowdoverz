import { NextRequest, NextResponse } from "next/server";
import { getActiveExtensionDownload, getExtensionZip } from "@/lib/extension-store";
import { sanitizeVersion } from "@/lib/extension-config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const versionParam = request.nextUrl.searchParams.get("v");
  const resellerId = request.nextUrl.searchParams.get("reseller")?.trim() || "";

  if (resellerId) {
    const { getResellerExtensionPack } = await import("@/lib/extension-reseller-pack");
    const pack = await getResellerExtensionPack(resellerId);
    if (!pack) {
      return NextResponse.json({ success: false, error: "No branded extension available." }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(pack.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `inline; filename="${pack.fileName}"`,
        "Content-Length": String(pack.buffer.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const payload = versionParam
    ? await getExtensionZip(sanitizeVersion(versionParam)).then((zip) =>
        zip ? { release: { fileName: zip.fileName }, ...zip } : null,
      )
    : await getActiveExtensionDownload();

  if (!payload) {
    return NextResponse.json({ success: false, error: "No extension release available." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(payload.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `inline; filename="${payload.fileName || "flowdoverz-extension.zip"}"`,
      "Content-Length": String(payload.buffer.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
