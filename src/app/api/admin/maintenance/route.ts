import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { getMaintenanceSettings, saveMaintenanceSettings } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getMaintenanceSettings();
  return NextResponse.json({ success: true, settings });
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const settings = await saveMaintenanceSettings({
      enabled: Boolean(body.enabled),
      message: String(body.message || ""),
      until: String(body.until || ""),
    });

    await logAdminActivity({
      action: "maintenance_updated",
      detail: settings.enabled
        ? `Website maintenance turned on until ${settings.until || "unset"}`
        : "Website maintenance turned off",
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save maintenance";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
