import { allowLiveEvent, publicLiveEnvelope, type LivePrincipal } from "./live-auth";
import {
  getMissedLiveEvents,
  subscribeLiveTick,
  type LiveEvent,
} from "./live-tick";

type LiveSocket = {
  send: (data: string) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  readyState?: number;
};

function sendJson(socket: LiveSocket, event: LiveEvent) {
  try {
    if (socket.readyState === 2 || socket.readyState === 3) return;
    socket.send(JSON.stringify(event));
  } catch {
    // socket already closed
  }
}

function parseSinceRev(raw: unknown): number | null {
  try {
    const text = typeof raw === "string" ? raw : String(raw || "");
    const parsed = JSON.parse(text) as { type?: string; rev?: number };
    if (parsed?.type !== "since") return null;
    const rev = Number(parsed.rev);
    return Number.isFinite(rev) ? rev : null;
  } catch {
    return null;
  }
}

export function attachLiveSocket(socket: LiveSocket, principal: LivePrincipal) {
  const sendAllowed = (event: LiveEvent) => {
    const payload = publicLiveEnvelope(event);
    if (!allowLiveEvent(principal, payload)) return;
    sendJson(socket, payload);
  };

  const unsub = subscribeLiveTick(sendAllowed, { emitHello: true });
  const ping = setInterval(() => {
    sendAllowed({ type: "ping", rev: 0, at: new Date().toISOString() });
  }, 25000);

  const onMessage = (...args: unknown[]) => {
    const rev = parseSinceRev(args[0]);
    if (rev == null) return;
    void getMissedLiveEvents(rev).then(({ events, resync, rev: currentRev, at }) => {
      if (resync) {
        sendAllowed({ type: "resync", rev: currentRev, at });
        return;
      }
      for (const event of events) sendAllowed(event);
    });
  };

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(ping);
    unsub();
  };

  socket.on("message", onMessage);
  socket.on("close", stop);
  socket.on("error", stop);
  return stop;
}
