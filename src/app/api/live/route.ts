import { connection } from "next/server";
import { allowLiveEvent, publicLiveEnvelope, resolveLivePrincipal } from "@/lib/live-auth";
import { getMissedLiveEvents, subscribeLiveTick, type LiveEvent } from "@/lib/live-tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function encodeEvent(event: LiveEvent) {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function GET(request: Request) {
  await connection();
  const principal = await resolveLivePrincipal(request);

  let unsub = () => {};
  let ping: ReturnType<typeof setInterval> | undefined;
  const since = Number(new URL(request.url).searchParams.get("since") || "");

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: LiveEvent) => {
        const payload = publicLiveEnvelope(event);
        if (!allowLiveEvent(principal, payload)) return;
        try {
          controller.enqueue(encodeEvent(payload));
        } catch {
          // stream closed
        }
      };

      unsub = subscribeLiveTick(send, { emitHello: true });
      if (Number.isFinite(since) && since > 0) {
        void getMissedLiveEvents(since).then(({ events, resync, rev, at }) => {
          if (resync) {
            send({ type: "resync", rev, at });
            return;
          }
          for (const event of events) send(event);
        });
      }

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
