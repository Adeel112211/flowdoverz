import { subscribeLiveTick, type LiveEvent } from "./live-tick";

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

export function attachLiveSocket(socket: LiveSocket) {
  sendJson(socket, {
    type: "hello",
    rev: 0,
    at: new Date().toISOString(),
  });

  const unsub = subscribeLiveTick((event) => sendJson(socket, event));
  const ping = setInterval(() => {
    sendJson(socket, { type: "ping", rev: 0, at: new Date().toISOString() });
  }, 25000);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(ping);
    unsub();
  };

  socket.on("close", stop);
  socket.on("error", stop);
  return stop;
}
