import { connection } from "next/server";
import { attachLiveSocket } from "@/lib/live-socket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  await connection();

  try {
    const { experimental_upgradeWebSocket } = await import("@vercel/functions");
    return experimental_upgradeWebSocket((ws) => {
      attachLiveSocket(ws as Parameters<typeof attachLiveSocket>[0]);
    });
  } catch {
    return new Response("WebSocket upgrade unavailable. Use /api/live.", {
      status: 426,
      headers: { Upgrade: "websocket" },
    });
  }
}
