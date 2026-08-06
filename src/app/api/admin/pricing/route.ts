import { NextRequest, NextResponse } from "next/server";
import { isAdminUiRequest } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { getPricingConfig, savePricingConfig } from "@/lib/pricing-store";
import type { PricingConfig } from "@/lib/pricing-config";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const config = await getPricingConfig();
  return NextResponse.json({ success: true, config });
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminUiRequest())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<PricingConfig>;
    const config = await savePricingConfig(body);
    await logAdminActivity({ action: "settings_updated", detail: "Pricing configuration updated" });
    return NextResponse.json({ success: true, config });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save pricing";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
