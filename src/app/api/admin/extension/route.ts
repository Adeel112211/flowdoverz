import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import {
  MAX_EXTENSION_ZIP_BYTES,
  type ExtensionConfig,
} from "@/lib/extension-config";
import {
  deleteExtensionRelease,
  getExtensionConfig,
  saveExtensionConfig,
  setActiveExtensionRelease,
  uploadExtensionRelease,
} from "@/lib/extension-store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const config = await getExtensionConfig();
  return NextResponse.json({ success: true, config });
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<ExtensionConfig>;
    const config = await saveExtensionConfig(body);
    await logAdminActivity({ action: "settings_updated", detail: "Extension settings updated" });
    return NextResponse.json({ success: true, config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save extension settings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");

  try {
    if (action === "upload_release") {
      const version = String(body.version || "").trim();
      const versionName = String(body.versionName || "").trim();
      const changelog = String(body.changelog || "").trim();
      const fileName = String(body.fileName || "").trim();
      const zipBase64 = String(body.zipBase64 || "");

      if (!version || !fileName || !zipBase64) {
        return NextResponse.json(
          { success: false, error: "Version, file name, and ZIP file are required." },
          { status: 400 },
        );
      }

      const zipBuffer = Buffer.from(zipBase64, "base64");
      if (zipBuffer.length > MAX_EXTENSION_ZIP_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: `ZIP must be under ${Math.floor(MAX_EXTENSION_ZIP_BYTES / 1024)}KB for storage.`,
          },
          { status: 400 },
        );
      }

      if (zipBuffer[0] !== 0x50 || zipBuffer[1] !== 0x4b) {
        return NextResponse.json(
          { success: false, error: "File must be a valid ZIP archive." },
          { status: 400 },
        );
      }

      try {
        const { assertSafeExtensionZip } = await import("@/lib/extension-zip-guard");
        assertSafeExtensionZip(zipBuffer);
      } catch (guardError) {
        const message =
          guardError instanceof Error ? guardError.message : "ZIP failed safety checks.";
        return NextResponse.json({ success: false, error: message }, { status: 400 });
      }

      const config = await uploadExtensionRelease({
        version,
        versionName: versionName || undefined,
        changelog,
        fileName,
        zipBuffer,
      });

      await logAdminActivity({
        action: "settings_updated",
        detail: `Extension release uploaded: v${version}`,
      });

      return NextResponse.json({ success: true, config, message: "Extension release uploaded." });
    }

    if (action === "set_active") {
      const version = String(body.version || "").trim();
      if (!version) {
        return NextResponse.json({ success: false, error: "Version required." }, { status: 400 });
      }
      const config = await setActiveExtensionRelease(version);
      return NextResponse.json({ success: true, config });
    }

    if (action === "delete_release") {
      const version = String(body.version || "").trim();
      if (!version) {
        return NextResponse.json({ success: false, error: "Version required." }, { status: 400 });
      }
      const config = await deleteExtensionRelease(version);
      return NextResponse.json({ success: true, config });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extension action failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
