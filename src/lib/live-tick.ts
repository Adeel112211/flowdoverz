import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./firebase-admin";

export type LiveEvent = {
  type: "hello" | "tick" | "ping";
  topic?: string;
  rev: number;
  at: string;
};

const LIVE_COLLECTION = "settings";
const LIVE_ID = "live";

export async function touchLive(topic: string) {
  const db = getDb();
  if (!db) return;
  try {
    await db
      .collection(LIVE_COLLECTION)
      .doc(LIVE_ID)
      .set(
        {
          rev: FieldValue.increment(1),
          topic,
          at: new Date().toISOString(),
        },
        { merge: true },
      );
  } catch {
    // Live ticks must never fail the original write.
  }
}

export function subscribeLiveTick(onEvent: (event: LiveEvent) => void): () => void {
  const db = getDb();
  if (!db) return () => {};

  let first = true;
  const unsub = db
    .collection(LIVE_COLLECTION)
    .doc(LIVE_ID)
    .onSnapshot(
      (snap) => {
        if (first) {
          first = false;
          return;
        }
        const data = snap.data() || {};
        onEvent({
          type: "tick",
          topic: String(data.topic || ""),
          rev: Number(data.rev || 0),
          at: String(data.at || new Date().toISOString()),
        });
      },
      () => {},
    );

  return () => {
    try {
      unsub();
    } catch {
      // ignore
    }
  };
}
