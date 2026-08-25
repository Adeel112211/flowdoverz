import { allowLiveEvent, publicLiveEnvelope, resolveLivePrincipal } from "@/lib/live-auth";
import { readLiveSnapshot } from "@/lib/live-tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(request: Request) {
  const principal = await resolveLivePrincipal(request);
  const since = Number(new URL(request.url).searchParams.get("since") || "0");
  const snapshot = await readLiveSnapshot(Number.isFinite(since) ? since : 0);
  const events = snapshot.resync
    ? []
    : snapshot.events.map(publicLiveEnvelope).filter((event) => allowLiveEvent(principal, event));

  return Response.json(
    {
      success: true,
      rev: snapshot.rev,
      at: snapshot.at,
      resync: snapshot.resync,
      events,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
