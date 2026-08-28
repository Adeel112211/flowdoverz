import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CLIENT_SID_COOKIE, verifyClientSession } from "@/lib/client-session";
import { getExtensionConfig } from "@/lib/extension-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getExtensionConfig();
  const active = config.releases.find((r) => r.version === config.activeVersion) || null;
  const cookieStore = await cookies();
  const email = verifyClientSession(cookieStore.get(CLIENT_SID_COOKIE)?.value)?.email || "";

  let downloadUrl = active ? `/api/extension/download?v=${encodeURIComponent(active.version)}` : null;
  let name = config.name;
  let shortName = config.shortName;
  let branded = false;
  let brandedVersion = config.activeVersion;

  if (email) {
    try {
      const {
        getResellerBrandForUserEmail,
        brandedExtensionDownloadPath,
      } = await import("@/lib/extension-reseller-lookup");
      const brand = await getResellerBrandForUserEmail(email);
      if (brand) {
        name = brand.displayName || name;
        shortName = name;
        if (brand.hasPack) {
          downloadUrl = brandedExtensionDownloadPath(brand.resellerId);
          branded = true;
          const { getReseller } = await import("@/lib/reseller-store");
          const reseller = await getReseller(brand.resellerId);
          brandedVersion = reseller?.brandedExtension?.version || config.activeVersion;
        }
      }
    } catch {
      // keep official download
    }
  }

  return NextResponse.json({
    success: true,
    extension: {
      name,
      shortName,
      description: config.description,
      minChromeVersion: config.minChromeVersion,
      installSteps: config.installSteps,
      mobileInstallSteps: config.mobileInstallSteps,
      chromeStoreUrl: config.chromeStoreUrl || null,
      activeVersion: branded ? brandedVersion : config.activeVersion,
      latestVersion: branded ? brandedVersion : config.activeVersion,
      release: active,
      downloadUrl,
      branded,
    },
  });
}
