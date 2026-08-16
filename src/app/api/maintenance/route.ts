import { NextResponse } from "next/server";
import { getPublicMaintenanceStatus } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getPublicMaintenanceStatus();
  return NextResponse.json(
    { success: true, ...status },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
