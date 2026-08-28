import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { loadResellerLogo } from "@/lib/reseller-pack-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PACKS_COLLECTION = "extension_reseller_packs";
const BRANDING_COLLECTION = "extension_reseller_branding";

export async function GET(request: NextRequest) {
  const id = String(request.nextUrl.searchParams.get("id") || "").trim();
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing reseller id." }, { status: 400 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not configured." }, { status: 503 });
  }

  const [brandingSnap, packSnap] = await Promise.all([
    db.collection(BRANDING_COLLECTION).doc(id).get(),
    db.collection(PACKS_COLLECTION).doc(id).get(),
  ]);
  const branding = (brandingSnap.data() || {}) as Record<string, unknown>;
  const pack = (packSnap.data() || {}) as Record<string, unknown>;
  const logo = await loadResellerLogo({
    logoBase64: branding.logoBase64 || pack.logoBase64,
    logoStoragePath: branding.logoStoragePath || pack.logoStoragePath,
    logoMime: branding.logoMime || pack.logoMime,
  });

  if (!logo?.base64) {
    return NextResponse.json({ success: false, error: "No logo." }, { status: 404 });
  }

  const mime = logo.mime || "image/png";
  return new NextResponse(Buffer.from(logo.base64, "base64"), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
