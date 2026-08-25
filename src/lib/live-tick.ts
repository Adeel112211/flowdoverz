import { getDb } from "./firebase-admin";

export const LIVE_TOPICS = [
  "user",
  "payment",
  "cookies",
  "settings",
  "extension",
  "maintenance",
  "activity",
  "reseller",
] as const;

export type LiveTopic = (typeof LIVE_TOPICS)[number];

export type LiveAction =
  | "created"
  | "updated"
  | "deleted"
  | "approved"
  | "rejected"
  | "refunded"
  | "synced";

export type LiveEvent = {
  type: "hello" | "tick" | "ping" | "resync";
  topic?: LiveTopic | string;
  action?: LiveAction | string;
  id?: string;
  userId?: string;
  rev: number;
  at: string;
};

export type TouchLiveInput = {
  topic: LiveTopic | string;
  action?: LiveAction | string;
  id?: string;
  userId?: string;
};

const LIVE_COLLECTION = "settings";
const LIVE_ID = "live";
const EVENT_LOG_LIMIT = 40;

type LiveDoc = {
  rev?: number;
  topic?: string;
  action?: string;
  id?: string;
  userId?: string;
  at?: string;
  events?: LiveEvent[];
};

let currentLive: { rev: number; at: string; last?: LiveEvent; events: LiveEvent[] } = {
  rev: 0,
  at: "",
  events: [],
};

function normalizeTopic(topic: string | undefined): string {
  if (topic === "users") return "user";
  if (topic === "payments") return "payment";
  return String(topic || "");
}

function eventFromDoc(data: LiveDoc): LiveEvent {
  return {
    type: "tick",
    topic: normalizeTopic(data.topic),
    action: data.action || "updated",
    id: data.id || undefined,
    userId: data.userId || undefined,
    rev: Number(data.rev || 0),
    at: String(data.at || new Date().toISOString()),
  };
}

function rememberLive(event: LiveEvent, events?: LiveEvent[]) {
  currentLive = {
    rev: event.rev,
    at: event.at,
    last: event,
    events: Array.isArray(events) ? events.slice(-EVENT_LOG_LIMIT) : currentLive.events,
  };
}

export function getCurrentLiveRev() {
  return currentLive.rev;
}

export async function touchLive(topicOrInput: string | TouchLiveInput, maybeAction?: string, maybeId?: string) {
  const db = getDb();
  if (!db) return;

  const input: TouchLiveInput =
    typeof topicOrInput === "string"
      ? {
          topic: normalizeTopic(topicOrInput),
          action: maybeAction,
          id: maybeId,
        }
      : {
          ...topicOrInput,
          topic: normalizeTopic(topicOrInput.topic),
        };

  try {
    const ref = db.collection(LIVE_COLLECTION).doc(LIVE_ID);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const prev = (snap.data() || {}) as LiveDoc;
      const rev = Number(prev.rev || 0) + 1;
      const at = new Date().toISOString();
      const event: LiveEvent = {
        type: "tick",
        topic: input.topic,
        action: input.action || "updated",
        id: input.id || undefined,
        userId: input.userId || undefined,
        rev,
        at,
      };
      const events = [...(Array.isArray(prev.events) ? prev.events : []), event].slice(-EVENT_LOG_LIMIT);
      tx.set(
        ref,
        {
          rev,
          topic: event.topic,
          action: event.action,
          id: event.id || null,
          userId: event.userId || null,
          at,
          events,
        },
        { merge: true },
      );
    });
  } catch {
    // Live ticks must never fail the original write.
  }
}

function snapshotFromDoc(data: LiveDoc, sinceRev: number) {
  const stored = Array.isArray(data.events) ? data.events : [];
  const storedRev = Number(data.rev || 0);
  const at = String(data.at || new Date().toISOString());
  rememberLive(eventFromDoc(data), stored);
  if (!Number.isFinite(sinceRev) || sinceRev < 0) {
    return { events: [] as LiveEvent[], resync: true, rev: storedRev, at };
  }
  if (sinceRev >= storedRev) {
    return { events: [] as LiveEvent[], resync: false, rev: storedRev, at };
  }
  const oldest = stored[0]?.rev;
  if (!oldest || sinceRev < oldest - 1) {
    return { events: [] as LiveEvent[], resync: true, rev: storedRev, at };
  }
  return {
    events: stored.filter((event) => event.rev > sinceRev),
    resync: false,
    rev: storedRev,
    at,
  };
}

/** One Firestore read. Safe on serverless — does not keep a listener open. */
export async function readLiveSnapshot(sinceRev: number): Promise<{
  events: LiveEvent[];
  resync: boolean;
  rev: number;
  at: string;
}> {
  const db = getDb();
  const at = currentLive.at || new Date().toISOString();
  if (!db) {
    return { events: [], resync: true, rev: currentLive.rev, at };
  }
  try {
    const snap = await db.collection(LIVE_COLLECTION).doc(LIVE_ID).get();
    return snapshotFromDoc((snap.data() || {}) as LiveDoc, sinceRev);
  } catch {
    return { events: [], resync: true, rev: currentLive.rev, at };
  }
}

export async function getMissedLiveEvents(sinceRev: number): Promise<{
  events: LiveEvent[];
  resync: boolean;
  rev: number;
  at: string;
}> {
  const memoryOldest = currentLive.events[0]?.rev;
  const memoryCovers =
    currentLive.rev > 0 && Boolean(memoryOldest && sinceRev >= memoryOldest - 1);
  if (memoryCovers) {
    if (!Number.isFinite(sinceRev) || sinceRev < 0) {
      return {
        events: [],
        resync: true,
        rev: currentLive.rev,
        at: currentLive.at || new Date().toISOString(),
      };
    }
    if (sinceRev >= currentLive.rev) {
      return {
        events: [],
        resync: false,
        rev: currentLive.rev,
        at: currentLive.at || new Date().toISOString(),
      };
    }
    return {
      events: currentLive.events.filter((event) => event.rev > sinceRev),
      resync: false,
      rev: currentLive.rev,
      at: currentLive.at || new Date().toISOString(),
    };
  }
  return readLiveSnapshot(sinceRev);
}
