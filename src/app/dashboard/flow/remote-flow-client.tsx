"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

const VIEW_W = 1280;
const VIEW_H = 800;

export function RemoteFlowClient() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameBlobRef = useRef<string | null>(null);
  const sessionRef = useRef<string | null>(null);

  const clearFrameBlob = () => {
    if (frameBlobRef.current) {
      URL.revokeObjectURL(frameBlobRef.current);
      frameBlobRef.current = null;
    }
  };

  const stopSession = useCallback(async (id: string | null) => {
    if (!id) return;
    try {
      await fetch(`/api/flow/remote?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {
      // ignore
    }
  }, []);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    clearFrameBlob();
    setFrameUrl(null);
    try {
      const res = await fetch("/api/flow/remote", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: "C1" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not start remote Flow.");
      }
      sessionRef.current = data.sessionId;
      setSessionId(data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start remote Flow.");
      setSessionId(null);
      sessionRef.current = null;
    } finally {
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    void start();
    return () => {
      const id = sessionRef.current;
      sessionRef.current = null;
      void stopSession(id);
      clearFrameBlob();
    };
  }, [start, stopSession]);

  // Poll frames (~2.5 fps) — prototype quality; upgrade to WebSocket later.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer = 0;

    const tick = async () => {
      try {
        const res = await fetch(`/api/flow/remote/${sessionId}/frame?t=${Date.now()}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 404) {
          setError("Session ended. Click Restart.");
          setSessionId(null);
          sessionRef.current = null;
          return;
        }
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        clearFrameBlob();
        frameBlobRef.current = url;
        setFrameUrl(url);
      } catch {
        // ignore transient
      } finally {
        if (!cancelled) timer = window.setTimeout(tick, 400);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionId]);

  function toPageCoords(clientX: number, clientY: number) {
    const el = imgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((clientY - rect.top) / rect.height) * VIEW_H;
    return {
      x: Math.max(0, Math.min(VIEW_W, x)),
      y: Math.max(0, Math.min(VIEW_H, y)),
    };
  }

  async function sendInput(body: Record<string, unknown>) {
    if (!sessionId) return;
    try {
      await fetch(`/api/flow/remote/${sessionId}/input`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-[#080810] text-slate-100">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <div>
            <p className="text-sm font-semibold text-white">Cloud Flow</p>
            <p className="text-xs text-slate-500">Uses admin cookies — no extension on your PC</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void (async () => {
              await stopSession(sessionId);
              await start();
            })();
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2 text-sm font-bold text-slate-950"
        >
          <RefreshCw size={14} /> Restart
        </button>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-auto p-3 sm:p-6">
        {starting && (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="animate-spin text-cyan-400" />
            <p>Starting cloud browser with admin cookies…</p>
          </div>
        )}

        {!starting && error && (
          <div className="max-w-md rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
            <p className="font-semibold text-rose-100">Could not open Cloud Flow</p>
            <p className="mt-2 text-sm text-rose-100/80">{error}</p>
            <button
              type="button"
              onClick={() => void start()}
              className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white"
            >
              Try again
            </button>
          </div>
        )}

        {!starting && !error && frameUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={frameUrl}
            alt="Remote Google Flow"
            width={VIEW_W}
            height={VIEW_H}
            draggable={false}
            className="max-h-full max-w-full cursor-crosshair select-none rounded-xl border border-white/10 shadow-2xl"
            onClick={(e) => {
              const pt = toPageCoords(e.clientX, e.clientY);
              if (!pt) return;
              void sendInput({ type: "click", x: pt.x, y: pt.y });
            }}
            onWheel={(e) => {
              e.preventDefault();
              void sendInput({ type: "scroll", deltaX: e.deltaX, deltaY: e.deltaY });
            }}
          />
        )}
      </main>

      <footer className="border-t border-white/10 px-4 py-2 text-center text-xs text-slate-500">
        Click the screen to control Flow. Type with your keyboard when focused. Prototype — Google may
        challenge unusual IPs.
      </footer>

      {/* Capture keyboard while viewing */}
      <input
        aria-label="Remote keyboard"
        className="sr-only"
        autoFocus
        onKeyDown={(e) => {
          if (!sessionId) return;
          if (e.key === "Backspace" || e.key === "Enter" || e.key === "Tab" || e.key === "Escape") {
            e.preventDefault();
            void sendInput({ type: "key", key: e.key });
            return;
          }
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            void sendInput({ type: "type", text: e.key });
          }
        }}
      />
    </div>
  );
}
