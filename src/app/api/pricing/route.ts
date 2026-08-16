import { NextResponse } from "next/server";
import { getPricingConfig } from "@/lib/pricing-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getPricingConfig();
  return NextResponse.json(
    {
      success: true,
      config: {
        ...config,
        plans: config.plans.filter((p) => p.enabled),
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
