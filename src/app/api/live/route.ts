import { connection } from "next/server";
import { subscribeLiveTick, type LiveEvent } from "@/lib/live-tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function encodeEvent(event: LiveEvent) {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function GET(request: Request) {
  await connection();

  let unsub = () => {};
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: LiveEvent) => {
        try {
          controller.enqueue(encodeEvent(event));
        } catch {
          // stream closed
        }
      };

      send({ type: "hello", rev: 0, at: new Date().toISOString() });
      unsub = subscribeLiveTick(send);
      ping = setInterval(() => {
        send({ type: "ping", rev: 0, at: new Date().toISOString() });
      }, 25000);

      request.signal.addEventListener("abort", () => {
        if (ping) clearInterval(ping);
        unsub();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      if (ping) clearInterval(ping);
      unsub();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
