import { NextResponse } from "next/server";
import { getPublicMaintenanceStatus } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getPublicMaintenanceStatus();
  return NextResponse.json(
    { success: true, ...status },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    },
  );
}
