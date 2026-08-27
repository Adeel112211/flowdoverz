const SECRET_KEYS = ["salt", "passwordHash", "signupIpHash"] as const;

export function publicClientRecord(id: string, data: Record<string, unknown> | undefined) {
  const raw = { ...(data || {}) } as Record<string, unknown>;
  for (const key of SECRET_KEYS) delete raw[key];
  return { email: id, ...raw } as Record<string, unknown> & { email: string };
}

export const PAID_PLAN_IDS = ["solo", "studio", "team", "nano", "ultra"] as const;

export function isPaidPlanId(plan?: string | null) {
  return PAID_PLAN_IDS.includes(String(plan || "") as (typeof PAID_PLAN_IDS)[number]);
}

export function clientCreatedAtMs(client: { createdAt?: unknown }) {
  const raw = client.createdAt;
  if (raw == null) return 0;
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : 0;
}

export function sortClientsNewestFirst<T extends { email?: string; createdAt?: unknown }>(clients: T[]) {
  return [...clients].sort((a, b) => {
    const diff = clientCreatedAtMs(b) - clientCreatedAtMs(a);
    if (diff !== 0) return diff;
    return String(b.email || "").localeCompare(String(a.email || ""));
  });
}

export function clientMatchesFilter(
  client: Record<string, unknown> & { email?: string; subscriptionPlan?: unknown; suspended?: unknown },
  filter: string,
) {
  const plan = String(client.subscriptionPlan || "none");
  if (filter === "pending") return plan === "pending";
  if (filter === "paid") return isPaidPlanId(plan);
  if (filter === "trial") return !isPaidPlanId(plan) && plan !== "pending";
  if (filter === "suspended") return Boolean(client.suspended);
  if (filter === "reseller") return Boolean(String(client.resellerId || "").trim());
  return true;
}

export function accessFromUserData(data: Record<string, unknown>, now = Date.now()) {
  const emailVerified = data.emailVerified !== false;
  const trialActive =
    emailVerified && data.trialExpiresAt ? new Date(String(data.trialExpiresAt)).getTime() > now : false;
  const subscriptionActive =
    isPaidPlanId(String(data.subscriptionPlan || "")) && data.subscriptionExpiresAt
      ? new Date(String(data.subscriptionExpiresAt)).getTime() > now
      : false;
  return {
    active: trialActive || subscriptionActive,
    trialActive,
    subscriptionActive,
  };
}

export function syncStatusFromUserData(data: Record<string, unknown>, now = Date.now()) {
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const lastSyncAt = data.lastSyncAt ? new Date(String(data.lastSyncAt)).getTime() : null;
  const neverSynced = !lastSyncAt;
  const staleSync = lastSyncAt ? lastSyncAt < sevenDaysAgo : true;
  const access = accessFromUserData(data, now);

  let syncStatus: "never" | "stale" | "active" | "expired" | "suspended" = "never";
  if (data.suspended) syncStatus = "suspended";
  else if (!access.active) syncStatus = "expired";
  else if (neverSynced) syncStatus = "never";
  else if (staleSync) syncStatus = "stale";
  else syncStatus = "active";

  return { ...access, syncStatus };
}
