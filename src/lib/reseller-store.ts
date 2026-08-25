import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/firebase-admin";
import { sanitizeForFirestore } from "@/lib/cookie-store";
import { getAppUrl, getResellerUrl } from "@/lib/site-urls";

export const RESELLER_SLOTS = ["C1", "C2", "C3", "C4", "C5"] as const;
export type ResellerSlot = (typeof RESELLER_SLOTS)[number];
export type ResellerStatus = "active" | "paused" | "disabled";
/** white_label = their own branded site + API. official = they sell FlowDoverz under our name. */
export type ResellerKind = "white_label" | "official";

export type ResellerBrandedExtension = {
  version: string;
  fileName: string;
  generatedAt: string;
  displayName: string;
  officialVersion: string;
  supportEmail: string;
  dashboardUrl?: string;
  loginUrl?: string;
  hasLogo: boolean;
};

export type ResellerRecord = {
  id: string;
  brandName: string;
  contactName: string;
  contactEmail: string;
  websiteUrl: string;
  allowedOrigins: string[];
  status: ResellerStatus;
  kind: ResellerKind;
  /** Public signup code for official partners. Users join at /signup?ref=CODE */
  signupCode: string;
  /** Legacy unique path. Official resellers now share the dedicated panel host. */
  panelSlug: string;
  assignedSlots: ResellerSlot[];
  maxUsers: number;
  /** Paid registration seats. Each new user uses one seat and gets a 30-day timer. */
  seatsPurchased: number;
  /** Length of each user's access after they register. */
  seatDays: number;
  notes: string;
  expiresAt: string | null;
  apiKeyHash: string;
  apiKeyPrefix: string;
  passwordHash: string;
  passwordSalt: string;
  sessionVersion: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  brandedExtension: ResellerBrandedExtension | null;
};

export type PublicReseller = Omit<
  ResellerRecord,
  "apiKeyHash" | "passwordHash" | "passwordSalt"
> & {
  userCount: number;
  remainingSeats: number;
  signupUrl: string;
  panelUrl: string;
  hasPanelPassword: boolean;
  brandedExtension: (ResellerBrandedExtension & { downloadUrl: string }) | null;
};

export type ResellerUserRow = {
  email: string;
  name: string;
  subscriptionPlan: string;
  trialExpiresAt: string | null;
  subscriptionExpiresAt: string | null;
  assignedSlot: string;
  createdAt: string | null;
};

export type ResellerInput = {
  brandName?: string;
  contactName?: string;
  contactEmail?: string;
  websiteUrl?: string;
  allowedOrigins?: string[] | string;
  status?: string;
  kind?: string;
  assignedSlots?: string[];
  maxUsers?: number;
  seatsPurchased?: number;
  seatDays?: number;
  notes?: string;
  expiresAt?: string | null;
  panelPassword?: string;
};

export const DEFAULT_SEAT_DAYS = 30;

const COLLECTION = "resellers";
const KEY_PREFIX = "fdz_rk_";

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("Database not initialized");
  return db;
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function generateResellerApiKey() {
  const key = `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 12) };
}

function hashesEqual(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const MIN_PANEL_PASSWORD = 8;

function hashPanelPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function makePanelPasswordSecret(password: string) {
  const passwordSalt = randomBytes(16).toString("hex");
  return {
    passwordSalt,
    passwordHash: hashPanelPassword(password, passwordSalt),
  };
}

export function isPanelPasswordValid(password: string) {
  return String(password || "").trim().length >= MIN_PANEL_PASSWORD;
}

export function isResellerSlot(value: string): value is ResellerSlot {
  return (RESELLER_SLOTS as readonly string[]).includes(value);
}

export function normalizeSlotList(input: unknown): ResellerSlot[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<ResellerSlot>();
  for (const item of input) {
    const slot = String(item || "").trim().toUpperCase();
    if (isResellerSlot(slot)) unique.add(slot);
  }
  return [...unique].sort();
}

export function originFromUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeOriginList(input: unknown, websiteUrl?: string): string[] {
  const raw = Array.isArray(input)
    ? input.map((item) => String(item))
    : String(input || "")
        .split(/\r?\n|,/)
        .map((item) => item.trim());
  const origins = new Set<string>();
  for (const item of raw) {
    const origin = originFromUrl(item);
    if (origin) origins.add(origin);
  }
  if (websiteUrl) {
    const fromSite = originFromUrl(websiteUrl);
    if (fromSite) origins.add(fromSite);
  }
  return [...origins];
}

function normalizeStatus(value: unknown): ResellerStatus {
  const status = String(value || "active").toLowerCase();
  if (status === "paused" || status === "disabled") return status;
  return "active";
}

export function normalizeKind(value: unknown): ResellerKind {
  const kind = String(value || "white_label").trim().toLowerCase().replace(/-/g, "_");
  if (kind === "official" || kind === "our_brand" || kind === "flowdoverz") return "official";
  return "white_label";
}

function randomSignupCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "FDZ";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseBrandedExtension(raw: unknown): ResellerBrandedExtension | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const version = String(data.version || "").trim();
  const fileName = String(data.fileName || "").trim();
  if (!version) return null;
  return {
    version,
    fileName,
    generatedAt: String(data.generatedAt || ""),
    displayName: String(data.displayName || ""),
    officialVersion: String(data.officialVersion || version),
    supportEmail: String(data.supportEmail || ""),
    dashboardUrl: String(data.dashboardUrl || ""),
    loginUrl: String(data.loginUrl || data.dashboardUrl || ""),
    hasLogo: Boolean(data.hasLogo),
  };
}

function asRecord(id: string, data: Record<string, unknown>): ResellerRecord {
  return {
    id,
    brandName: String(data.brandName || ""),
    contactName: String(data.contactName || ""),
    contactEmail: String(data.contactEmail || ""),
    websiteUrl: String(data.websiteUrl || ""),
    allowedOrigins: Array.isArray(data.allowedOrigins)
      ? data.allowedOrigins.map((item) => String(item))
      : [],
    status: normalizeStatus(data.status),
    kind: normalizeKind(data.kind),
    signupCode: String(data.signupCode || "").trim().toUpperCase(),
    panelSlug: String(data.panelSlug || "").trim().toLowerCase(),
    assignedSlots: normalizeSlotList(data.assignedSlots),
    seatsPurchased: Math.max(0, Math.floor(Number(data.seatsPurchased ?? data.maxUsers) || 0)),
    seatDays: Math.max(1, Math.floor(Number(data.seatDays) || DEFAULT_SEAT_DAYS)),
    maxUsers: Math.max(0, Math.floor(Number(data.seatsPurchased ?? data.maxUsers) || 0)),
    notes: String(data.notes || ""),
    expiresAt: data.expiresAt ? String(data.expiresAt) : null,
    apiKeyHash: String(data.apiKeyHash || ""),
    apiKeyPrefix: String(data.apiKeyPrefix || ""),
    passwordHash: String(data.passwordHash || ""),
    passwordSalt: String(data.passwordSalt || ""),
    sessionVersion: Math.max(0, Math.floor(Number(data.sessionVersion) || 0)),
    createdAt: String(data.createdAt || ""),
    updatedAt: String(data.updatedAt || ""),
    lastUsedAt: data.lastUsedAt ? String(data.lastUsedAt) : null,
    brandedExtension: parseBrandedExtension(data.brandedExtension),
  };
}

export function remainingSeats(record: Pick<ResellerRecord, "seatsPurchased">, userCount = 0) {
  return Math.max(0, record.seatsPurchased - userCount);
}

export async function resolveOfficialSignup(code: string): Promise<
  | { ok: true; reseller: ResellerRecord; slot: ResellerSlot; remaining: number }
  | { ok: false; error: string }
> {
  const reseller = await getResellerBySignupCode(code);
  if (!reseller || reseller.kind !== "official") {
    return { ok: false, error: "This partner signup link is not valid." };
  }
  if (reseller.status !== "active" || resellerIsExpired(reseller)) {
    return { ok: false, error: "This partner is not accepting new users right now." };
  }
  const slot = pickAssignedSlot(reseller);
  if (!slot) {
    return { ok: false, error: "This partner has no cookie slots assigned yet." };
  }
  const used = await countResellerUsers(reseller.id);
  const remaining = remainingSeats(reseller, used);
  if (remaining <= 0) {
    return { ok: false, error: "No paid seats left for this partner. Ask them to buy more users." };
  }
  return { ok: true, reseller, slot, remaining };
}

export function subscriptionExpiryFromNow(seatDays = DEFAULT_SEAT_DAYS) {
  const days = Math.max(1, Math.floor(Number(seatDays) || DEFAULT_SEAT_DAYS));
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function panelUrlForReseller(_record?: Pick<ResellerRecord, "kind" | "panelSlug">) {
  void _record;
  return getResellerUrl();
}

export function signupUrlForReseller(record: Pick<ResellerRecord, "kind" | "signupCode" | "panelSlug">) {
  const panel = panelUrlForReseller(record);
  if (panel) return panel;
  if (record.kind !== "official" || !record.signupCode) return "";
  return `${getAppUrl()}/signup?ref=${encodeURIComponent(record.signupCode)}`;
}

export function toPublicReseller(record: ResellerRecord, userCount = 0): PublicReseller {
  const { apiKeyHash: _hash, passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...rest } = record;
  void _hash;
  void _passwordHash;
  void _passwordSalt;
  const purchased = record.seatsPurchased;
  const panelUrl = panelUrlForReseller(record);
  return {
    ...rest,
    maxUsers: purchased,
    seatsPurchased: purchased,
    userCount,
    remainingSeats: remainingSeats(record, userCount),
    panelUrl,
    signupUrl: panelUrl,
    hasPanelPassword: Boolean(record.passwordHash && record.passwordSalt),
    brandedExtension: record.brandedExtension
      ? {
          ...record.brandedExtension,
          downloadUrl: `${getAppUrl()}/api/extension/download?reseller=${encodeURIComponent(record.id)}`,
        }
      : null,
  };
}

export function resellerIsExpired(record: Pick<ResellerRecord, "expiresAt">) {
  if (!record.expiresAt) return false;
  const at = Date.parse(record.expiresAt);
  return Number.isFinite(at) && at <= Date.now();
}

export function resellerCanServe(record: ResellerRecord) {
  return record.status === "active" && !resellerIsExpired(record) && Boolean(record.apiKeyHash);
}

export function originsForReseller(record: ResellerRecord) {
  return normalizeOriginList(record.allowedOrigins, record.websiteUrl);
}

function validateInput(input: ResellerInput, creating: boolean) {
  const brandName = String(input.brandName || "").trim();
  const contactEmail = normalizeEmail(String(input.contactEmail || ""));
  if (creating || input.brandName !== undefined) {
    if (brandName.length < 2) throw new Error("Enter the reseller brand name.");
  }
  if (creating || input.contactEmail !== undefined) {
    if (!contactEmail.includes("@")) throw new Error("Enter a valid contact email.");
  }
  if (input.websiteUrl) {
    if (!originFromUrl(input.websiteUrl)) throw new Error("Enter a valid website URL.");
  }
  if (input.maxUsers !== undefined && (!Number.isFinite(Number(input.maxUsers)) || Number(input.maxUsers) < 0)) {
    throw new Error("Max users must be 0 or more.");
  }
}

export async function countResellerUsers(resellerId: string) {
  const db = getDb();
  if (!db) return 0;
  const snap = await db.collection("users").where("resellerId", "==", resellerId).get();
  return snap.size;
}

export async function listResellerUsers(resellerId: string, limit = 200): Promise<ResellerUserRow[]> {
  const db = getDb();
  if (!db) return [];
  const snap = await db
    .collection("users")
    .where("resellerId", "==", resellerId)
    .limit(Math.min(Math.max(limit, 1), 500))
    .get();
  return snap.docs
    .map((doc) => {
      const data = doc.data() || {};
      return {
        email: doc.id,
        name: String(data.name || ""),
        subscriptionPlan: String(data.subscriptionPlan || "trial"),
        trialExpiresAt: data.trialExpiresAt ? String(data.trialExpiresAt) : null,
        subscriptionExpiresAt: data.subscriptionExpiresAt ? String(data.subscriptionExpiresAt) : null,
        assignedSlot: String(data.assignedSlot || ""),
        createdAt: data.createdAt ? String(data.createdAt) : null,
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function deleteResellerUser(
  resellerId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { ok: false, error: "Email is required.", status: 400 };
  }

  const db = getDb();
  if (!db) return { ok: false, error: "Database not configured.", status: 503 };

  const ref = db.collection("users").doc(normalized);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, error: "Client not found.", status: 404 };
  }

  const data = (snap.data() || {}) as Record<string, unknown>;
  if (String(data.resellerId || "") !== resellerId) {
    return { ok: false, error: "This client does not belong to this reseller.", status: 403 };
  }

  await ref.delete();
  return { ok: true };
}

export async function listResellers(): Promise<PublicReseller[]> {
  const db = requireDb();
  const snap = await db.collection(COLLECTION).get();
  const rows = snap.docs.map((doc) => asRecord(doc.id, (doc.data() || {}) as Record<string, unknown>));
  rows.sort((a, b) => a.brandName.localeCompare(b.brandName));
  return Promise.all(
    rows.map(async (row) => {
      const ready = await ensurePanelSlug(row);
      return toPublicReseller(ready, await countResellerUsers(ready.id));
    }),
  );
}

export async function getReseller(id: string): Promise<ResellerRecord | null> {
  const db = requireDb();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return ensurePanelSlug(asRecord(snap.id, (snap.data() || {}) as Record<string, unknown>));
}

export async function getResellerByApiKey(key: string): Promise<ResellerRecord | null> {
  const trimmed = key.trim();
  if (!trimmed.startsWith(KEY_PREFIX) || trimmed.length < 20) return null;
  const db = requireDb();
  const hash = hashApiKey(trimmed);
  const snap = await db.collection(COLLECTION).where("apiKeyHash", "==", hash).limit(2).get();
  if (snap.empty) return null;
  const record = asRecord(snap.docs[0].id, (snap.docs[0].data() || {}) as Record<string, unknown>);
  if (!hashesEqual(record.apiKeyHash, hash)) return null;
  return record;
}

export async function getResellerByContactEmail(email: string): Promise<ResellerRecord | null> {
  const contactEmail = normalizeEmail(email);
  if (!contactEmail.includes("@")) return null;
  const db = requireDb();
  const snap = await db.collection(COLLECTION).where("contactEmail", "==", contactEmail).limit(2).get();
  if (snap.empty) return null;
  return asRecord(snap.docs[0].id, (snap.docs[0].data() || {}) as Record<string, unknown>);
}

async function assertUniqueContactEmail(email: string, exceptId?: string) {
  const found = await getResellerByContactEmail(email);
  if (found && found.id !== exceptId) {
    throw new Error("This email is already used by another reseller.");
  }
}

export async function authenticateResellerPanel(
  email: string,
  password: string,
): Promise<{ ok: true; reseller: ResellerRecord } | { ok: false; error: string }> {
  const reseller = await getResellerByContactEmail(email);
  if (!reseller?.passwordHash || !reseller.passwordSalt) {
    return { ok: false, error: "Wrong email or password." };
  }
  if (reseller.status === "disabled") {
    return { ok: false, error: "This reseller panel is disabled." };
  }
  const incoming = hashPanelPassword(password, reseller.passwordSalt);
  if (!hashesEqual(incoming, reseller.passwordHash)) {
    return { ok: false, error: "Wrong email or password." };
  }
  void touchResellerUsage(reseller.id);
  return { ok: true, reseller };
}

export async function setResellerPanelPassword(id: string, password: string) {
  if (!isPanelPasswordValid(password)) {
    throw new Error("Panel password must be at least 8 characters.");
  }
  const current = await getReseller(id);
  if (!current) throw new Error("Reseller not found.");
  const secret = makePanelPasswordSecret(password.trim());
  const sessionVersion = (current.sessionVersion || 0) + 1;
  const updatedAt = new Date().toISOString();
  const db = requireDb();
  await db.collection(COLLECTION).doc(id).set(
    { ...secret, sessionVersion, updatedAt },
    { merge: true },
  );
  return toPublicReseller(
    { ...current, ...secret, sessionVersion, updatedAt },
    await countResellerUsers(id),
  );
}

export async function changeResellerPanelPassword(
  id: string,
  currentPassword: string,
  nextPassword: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const reseller = await getReseller(id);
  if (!reseller) return { ok: false, error: "Reseller not found.", status: 404 };
  const auth = await authenticateResellerPanel(reseller.contactEmail, currentPassword);
  if (!auth.ok) return { ok: false, error: "Current password is wrong.", status: 400 };
  if (!isPanelPasswordValid(nextPassword)) {
    return { ok: false, error: "New password must be at least 8 characters.", status: 400 };
  }
  await setResellerPanelPassword(id, nextPassword);
  return { ok: true };
}

export async function getResellerBySignupCode(code: string): Promise<ResellerRecord | null> {
  const signupCode = String(code || "").trim().toUpperCase();
  if (signupCode.length < 4) return null;
  const db = requireDb();
  const snap = await db.collection(COLLECTION).where("signupCode", "==", signupCode).limit(2).get();
  if (snap.empty) return null;
  return asRecord(snap.docs[0].id, (snap.docs[0].data() || {}) as Record<string, unknown>);
}

export async function getResellerByPanelSlug(slug: string): Promise<ResellerRecord | null> {
  const panelSlug = String(slug || "").trim().toLowerCase();
  if (panelSlug.length < 16) return null;
  const db = requireDb();
  const snap = await db.collection(COLLECTION).where("panelSlug", "==", panelSlug).limit(2).get();
  if (snap.empty) return null;
  return asRecord(snap.docs[0].id, (snap.docs[0].data() || {}) as Record<string, unknown>);
}

function randomPanelSlug() {
  return `fdz${randomBytes(16).toString("hex")}`;
}

async function uniquePanelSlug() {
  for (let i = 0; i < 8; i += 1) {
    const slug = randomPanelSlug();
    const existing = await getResellerByPanelSlug(slug);
    if (!existing) return slug;
  }
  return `fdz${randomBytes(20).toString("hex")}`;
}

async function ensurePanelSlug(record: ResellerRecord): Promise<ResellerRecord> {
  if (record.kind !== "official") return record;
  if (record.panelSlug && record.panelSlug.length >= 16) return record;
  const panelSlug = await uniquePanelSlug();
  const db = requireDb();
  const updatedAt = new Date().toISOString();
  await db.collection(COLLECTION).doc(record.id).set({ panelSlug, updatedAt }, { merge: true });
  return { ...record, panelSlug, updatedAt };
}

export async function resolveOfficialPanel(slug: string): Promise<
  | { ok: true; reseller: ResellerRecord }
  | { ok: false; error: string; status: number }
> {
  const found = await getResellerByPanelSlug(slug);
  if (!found || found.kind !== "official") {
    return { ok: false, error: "This partner panel link is not valid.", status: 404 };
  }
  const reseller = await ensurePanelSlug(found);
  if (reseller.status === "disabled") {
    return { ok: false, error: "This partner panel is disabled.", status: 403 };
  }
  if (reseller.status === "paused") {
    return { ok: false, error: "This partner panel is paused. Ask the owner to activate it.", status: 403 };
  }
  if (resellerIsExpired(reseller)) {
    return { ok: false, error: "This partner panel has expired.", status: 403 };
  }
  void touchResellerUsage(reseller.id);
  return { ok: true, reseller };
}

export async function registerClientForReseller(
  reseller: ResellerRecord,
  input: { email: string; name: string; password: string },
): Promise<
  | {
      ok: true;
      user: { email: string; name: string; subscriptionExpiresAt: string };
      remainingSeats: number;
      seatsPurchased: number;
    }
  | { ok: false; error: string; status: number }
> {
  if (reseller.status === "disabled") {
    return { ok: false, error: "This reseller panel is disabled.", status: 403 };
  }
  if (reseller.status === "paused") {
    return { ok: false, error: "This panel is paused. Ask the owner to activate it.", status: 403 };
  }
  if (resellerIsExpired(reseller)) {
    return { ok: false, error: "This reseller panel has expired.", status: 403 };
  }

  const slot = pickAssignedSlot(reseller);
  if (!slot) {
    return { ok: false, error: "No cookie slots assigned yet. Ask the owner to assign a slot.", status: 400 };
  }
  const used = await countResellerUsers(reseller.id);
  const left = remainingSeats(reseller, used);
  if (left <= 0) {
    return { ok: false, error: "No paid seats left. Send another payment so more seats can be added.", status: 403 };
  }

  const { createUserByAdmin } = await import("./user-store");
  const expiry = subscriptionExpiryFromNow(reseller.seatDays);
  const created = await createUserByAdmin({
    email: input.email,
    name: input.name,
    password: input.password,
    subscriptionPlan: "solo",
    trialExpiresAt: new Date().toISOString(),
    subscriptionExpiresAt: expiry,
    resellerId: reseller.id,
    assignedSlot: slot,
  });
  if (!created.ok) {
    return { ok: false, error: created.error, status: 400 };
  }

  void touchResellerUsage(reseller.id);
  return {
    ok: true,
    user: {
      email: String(input.email || "").trim().toLowerCase(),
      name: String(input.name || "").trim(),
      subscriptionExpiresAt: expiry,
    },
    remainingSeats: left - 1,
    seatsPurchased: reseller.seatsPurchased,
  };
}

export async function registerPartnerClient(
  slug: string,
  input: { email: string; name: string; password: string },
) {
  const resolved = await resolveOfficialPanel(slug);
  if (!resolved.ok) return resolved;
  return registerClientForReseller(resolved.reseller, input);
}

async function uniqueSignupCode() {
  for (let i = 0; i < 8; i += 1) {
    const code = randomSignupCode();
    const existing = await getResellerBySignupCode(code);
    if (!existing) return code;
  }
  return `${randomSignupCode()}${Date.now().toString(36).slice(-3).toUpperCase()}`;
}

export async function touchResellerUsage(id: string) {
  try {
    const db = getDb();
    if (!db) return;
    const ref = db.collection(COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return;
    const last = String(snap.data()?.lastUsedAt || "");
    const lastMs = Date.parse(last);
    if (Number.isFinite(lastMs) && Date.now() - lastMs < 5 * 60 * 1000) return;
    await ref.set({ lastUsedAt: new Date().toISOString() }, { merge: true });
  } catch {
    // non-blocking
  }
}

export type ResellerApiUseDomain = {
  domain: string;
  origin: string;
  hits: number;
  blockedHits: number;
  lastAt: string;
  lastIp: string;
  lastPath: string;
  expected: boolean;
};

export type ResellerApiUseEvent = {
  id: string;
  domain: string;
  origin: string;
  ip: string;
  path: string;
  blocked: boolean;
  expected: boolean;
  source: "origin" | "referer" | "server";
  createdAt: string;
};

function parsePublicSite(value: string): { origin: string; domain: string } | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return { origin: url.origin, domain: url.host };
  } catch {
    return null;
  }
}

export function websiteFromResellerRequest(request: Request): {
  origin: string;
  domain: string;
  source: "origin" | "referer" | "server";
} {
  const fromOrigin = parsePublicSite((request.headers.get("origin") || "").trim());
  if (fromOrigin) return { ...fromOrigin, source: "origin" };
  const fromReferer = parsePublicSite((request.headers.get("referer") || "").trim());
  if (fromReferer) return { ...fromReferer, source: "referer" };
  return { origin: "", domain: "server (no website)", source: "server" };
}

function callerIpFromRequest(request: Request) {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0],
    request.headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (value) return value.slice(0, 80);
  }
  return "unknown";
}

function normalizeUseDomain(raw: unknown): ResellerApiUseDomain | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const domain = String(row.domain || "").trim();
  if (!domain) return null;
  return {
    domain,
    origin: String(row.origin || ""),
    hits: Math.max(0, Number(row.hits) || 0),
    blockedHits: Math.max(0, Number(row.blockedHits) || 0),
    lastAt: String(row.lastAt || ""),
    lastIp: String(row.lastIp || ""),
    lastPath: String(row.lastPath || ""),
    expected: row.expected !== false,
  };
}

/** Records which website/IP used this reseller API key. Never stores the key or cookies. */
export async function logResellerApiUse(input: {
  resellerId: string;
  request: Request;
  blocked: boolean;
  expected: boolean;
}) {
  try {
    const db = getDb();
    if (!db) return;
    const site = websiteFromResellerRequest(input.request);
    const ip = callerIpFromRequest(input.request);
    let path = "";
    try {
      path = new URL(input.request.url).pathname.slice(0, 180);
    } catch {
      path = "";
    }
    const now = new Date().toISOString();
    const ref = db.collection(COLLECTION).doc(input.resellerId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const current = Array.isArray(snap.data()?.apiUseByDomain)
      ? (snap.data()?.apiUseByDomain as unknown[]).map(normalizeUseDomain).filter(Boolean) as ResellerApiUseDomain[]
      : [];
    const index = current.findIndex((row) => row.domain === site.domain);
    const previous = index >= 0 ? current[index] : null;
    const lastMs = Date.parse(previous?.lastAt || "");
    const duplicate =
      Boolean(previous) &&
      previous?.lastPath === path &&
      previous?.lastIp === ip &&
      Number.isFinite(lastMs) &&
      Date.now() - lastMs < 10 * 60 * 1000;
    if (duplicate && !input.blocked) return;

    const nextRow: ResellerApiUseDomain = {
      domain: site.domain,
      origin: site.origin,
      hits: (index >= 0 ? current[index].hits : 0) + 1,
      blockedHits: (index >= 0 ? current[index].blockedHits : 0) + (input.blocked ? 1 : 0),
      lastAt: now,
      lastIp: ip,
      lastPath: path,
      expected: input.expected,
    };
    const next =
      index >= 0
        ? current.map((row, i) => (i === index ? nextRow : row))
        : [nextRow, ...current];
    next.sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
    await ref.set(
      sanitizeForFirestore({
        apiUseByDomain: next.slice(0, 40),
        lastUsedAt: now,
        updatedAt: now,
      }),
      { merge: true },
    );
    await ref.collection("api_usage").add(
      sanitizeForFirestore({
        domain: site.domain,
        origin: site.origin,
        ip,
        path,
        blocked: input.blocked,
        expected: input.expected,
        source: site.source,
        createdAt: now,
      }),
    );
  } catch {
    // non-blocking
  }
}

export async function listResellerApiUse(id: string): Promise<{
  domains: ResellerApiUseDomain[];
  events: ResellerApiUseEvent[];
}> {
  const db = requireDb();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Reseller not found.");
  const domains = (
    Array.isArray(snap.data()?.apiUseByDomain) ? (snap.data()?.apiUseByDomain as unknown[]) : []
  )
    .map(normalizeUseDomain)
    .filter(Boolean) as ResellerApiUseDomain[];
  domains.sort((a, b) => Date.parse(b.lastAt || "") - Date.parse(a.lastAt || ""));

  let events: ResellerApiUseEvent[] = [];
  try {
    const logs = await ref.collection("api_usage").orderBy("createdAt", "desc").limit(80).get();
    events = logs.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        domain: String(data.domain || "server (no website)"),
        origin: String(data.origin || ""),
        ip: String(data.ip || "unknown"),
        path: String(data.path || ""),
        blocked: Boolean(data.blocked),
        expected: data.expected !== false,
        source: data.source === "referer" || data.source === "origin" ? data.source : "server",
        createdAt: String(data.createdAt || ""),
      };
    });
  } catch {
    events = [];
  }
  return { domains, events };
}

export async function createReseller(input: ResellerInput): Promise<{
  reseller: PublicReseller;
  apiKey: string;
}> {
  validateInput(input, true);
  const contactEmail = normalizeEmail(String(input.contactEmail || ""));
  await assertUniqueContactEmail(contactEmail);
  const panelPassword = String(input.panelPassword || "");
  if (!isPanelPasswordValid(panelPassword)) {
    throw new Error("Set a panel password (at least 8 characters). The reseller uses it with this email to log in.");
  }
  const secret = makePanelPasswordSecret(panelPassword.trim());
  const db = requireDb();
  const now = new Date().toISOString();
  const generated = generateResellerApiKey();
  const websiteUrl = String(input.websiteUrl || "").trim();
  const ref = db.collection(COLLECTION).doc();
  const record: ResellerRecord = {
    id: ref.id,
    brandName: String(input.brandName || "").trim(),
    contactName: String(input.contactName || "").trim(),
    contactEmail,
    websiteUrl,
    allowedOrigins: normalizeOriginList(input.allowedOrigins, websiteUrl),
    status: normalizeStatus(input.status),
    kind: normalizeKind(input.kind),
    signupCode: await uniqueSignupCode(),
    panelSlug: await uniquePanelSlug(),
    assignedSlots: normalizeSlotList(input.assignedSlots),
    seatsPurchased: Math.max(
      0,
      Math.floor(Number(input.seatsPurchased ?? input.maxUsers) || 0),
    ),
    seatDays: Math.max(1, Math.floor(Number(input.seatDays) || DEFAULT_SEAT_DAYS)),
    maxUsers: Math.max(0, Math.floor(Number(input.seatsPurchased ?? input.maxUsers) || 0)),
    notes: String(input.notes || "").trim(),
    expiresAt: input.expiresAt ? String(input.expiresAt) : null,
    apiKeyHash: generated.hash,
    apiKeyPrefix: generated.prefix,
    passwordHash: secret.passwordHash,
    passwordSalt: secret.passwordSalt,
    sessionVersion: 1,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    brandedExtension: null,
  };
  await ref.set(sanitizeForFirestore(record));
  const { touchLive } = await import("./live-tick");
  void touchLive({ topic: "reseller", action: "created", id: record.id });
  return { reseller: toPublicReseller(record, 0), apiKey: generated.key };
}

export async function updateReseller(id: string, input: ResellerInput): Promise<PublicReseller> {
  const current = await getReseller(id);
  if (!current) throw new Error("Reseller not found.");
  validateInput(input, false);
  if (input.contactEmail !== undefined) {
    await assertUniqueContactEmail(normalizeEmail(String(input.contactEmail)), id);
  }
  let passwordHash = current.passwordHash;
  let passwordSalt = current.passwordSalt;
  let sessionVersion = current.sessionVersion || 0;
  if (input.panelPassword !== undefined && String(input.panelPassword || "").trim()) {
    if (!isPanelPasswordValid(String(input.panelPassword))) {
      throw new Error("Panel password must be at least 8 characters.");
    }
    const secret = makePanelPasswordSecret(String(input.panelPassword).trim());
    passwordHash = secret.passwordHash;
    passwordSalt = secret.passwordSalt;
    sessionVersion += 1;
  }
  const websiteUrl =
    input.websiteUrl !== undefined ? String(input.websiteUrl || "").trim() : current.websiteUrl;
  const next: ResellerRecord = {
    ...current,
    brandName: input.brandName !== undefined ? String(input.brandName).trim() : current.brandName,
    contactName: input.contactName !== undefined ? String(input.contactName).trim() : current.contactName,
    contactEmail:
      input.contactEmail !== undefined
        ? normalizeEmail(String(input.contactEmail))
        : current.contactEmail,
    websiteUrl,
    allowedOrigins:
      input.allowedOrigins !== undefined || input.websiteUrl !== undefined
        ? normalizeOriginList(
            input.allowedOrigins !== undefined ? input.allowedOrigins : current.allowedOrigins,
            websiteUrl,
          )
        : current.allowedOrigins,
    status: input.status !== undefined ? normalizeStatus(input.status) : current.status,
    kind: input.kind !== undefined ? normalizeKind(input.kind) : current.kind,
    signupCode:
      current.signupCode ||
      (normalizeKind(input.kind ?? current.kind) === "official" ? await uniqueSignupCode() : ""),
    panelSlug:
      current.panelSlug ||
      (normalizeKind(input.kind ?? current.kind) === "official" ? await uniquePanelSlug() : ""),
    assignedSlots:
      input.assignedSlots !== undefined ? normalizeSlotList(input.assignedSlots) : current.assignedSlots,
    seatsPurchased: current.seatsPurchased,
    seatDays:
      input.seatDays !== undefined
        ? Math.max(1, Math.floor(Number(input.seatDays) || DEFAULT_SEAT_DAYS))
        : current.seatDays,
    maxUsers: current.seatsPurchased,
    notes: input.notes !== undefined ? String(input.notes || "").trim() : current.notes,
    expiresAt:
      input.expiresAt !== undefined ? (input.expiresAt ? String(input.expiresAt) : null) : current.expiresAt,
    passwordHash,
    passwordSalt,
    sessionVersion,
    updatedAt: new Date().toISOString(),
  };
  const db = requireDb();
  await db.collection(COLLECTION).doc(id).set(sanitizeForFirestore(next), { merge: true });
  const { touchLive } = await import("./live-tick");
  void touchLive({ topic: "reseller", action: "updated", id });
  return toPublicReseller(next, await countResellerUsers(id));
}

export async function rotateResellerKey(id: string): Promise<{
  reseller: PublicReseller;
  apiKey: string;
}> {
  const current = await getReseller(id);
  if (!current) throw new Error("Reseller not found.");
  const generated = generateResellerApiKey();
  const now = new Date().toISOString();
  const db = requireDb();
  await db.collection(COLLECTION).doc(id).set(
    { apiKeyHash: generated.hash, apiKeyPrefix: generated.prefix, updatedAt: now },
    { merge: true },
  );
  const { touchLive } = await import("./live-tick");
  void touchLive({ topic: "reseller", action: "updated", id });
  return {
    reseller: toPublicReseller(
      { ...current, apiKeyPrefix: generated.prefix, updatedAt: now },
      await countResellerUsers(id),
    ),
    apiKey: generated.key,
  };
}

export async function deleteReseller(id: string) {
  const current = await getReseller(id);
  if (!current) throw new Error("Reseller not found.");
  const db = requireDb();
  await db.collection(COLLECTION).doc(id).delete();
  const { deleteResellerExtensionPack } = await import("./extension-reseller-pack");
  await deleteResellerExtensionPack(id);
  const { touchLive } = await import("./live-tick");
  void touchLive({ topic: "reseller", action: "deleted", id });
  return current;
}

export function pickAssignedSlot(record: ResellerRecord, requested?: string) {
  const want = String(requested || "").trim().toUpperCase();
  if (want && record.assignedSlots.includes(want as ResellerSlot)) return want as ResellerSlot;
  return record.assignedSlots[0] || null;
}

export async function addResellerSeats(
  id: string,
  seats: number,
  meta?: { note?: string; paymentAmount?: string },
): Promise<PublicReseller> {
  const count = Math.floor(Number(seats));
  if (!Number.isFinite(count) || count < 1) {
    throw new Error("Enter how many users were paid for.");
  }
  const current = await getReseller(id);
  if (!current) throw new Error("Reseller not found.");
  const now = new Date().toISOString();
  const seatsPurchased = current.seatsPurchased + count;
  const db = requireDb();
  await db.collection(COLLECTION).doc(id).set(
    {
      seatsPurchased,
      maxUsers: seatsPurchased,
      updatedAt: now,
    },
    { merge: true },
  );
  await db.collection(COLLECTION).doc(id).collection("seat_grants").add(
    sanitizeForFirestore({
      seats: count,
      note: String(meta?.note || "").trim(),
      paymentAmount: String(meta?.paymentAmount || "").trim(),
      createdAt: now,
    }),
  );
  const { touchLive } = await import("./live-tick");
  void touchLive({ topic: "reseller", action: "updated", id });
  return toPublicReseller(
    { ...current, seatsPurchased, maxUsers: seatsPurchased, updatedAt: now },
    await countResellerUsers(id),
  );
}
