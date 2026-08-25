export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  return new Response("Use /api/live", {
    status: 426,
    headers: { Upgrade: "websocket" },
  });
}
