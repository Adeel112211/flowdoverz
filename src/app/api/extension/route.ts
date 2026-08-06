import { NextResponse } from "next/server";
import { getExtensionConfig } from "@/lib/extension-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getExtensionConfig();
  const active = config.releases.find((r) => r.version === config.activeVersion) || null;

  return NextResponse.json({
    success: true,
    extension: {
      name: config.name,
      shortName: config.shortName,
      description: config.description,
      minChromeVersion: config.minChromeVersion,
      installSteps: config.installSteps,
      mobileInstallSteps: config.mobileInstallSteps,
      chromeStoreUrl: config.chromeStoreUrl || null,
      activeVersion: config.activeVersion,
      latestVersion: config.activeVersion,
      release: active,
      downloadUrl: active ? `/api/extension/download?v=${encodeURIComponent(active.version)}` : null,
    },
  });
}
