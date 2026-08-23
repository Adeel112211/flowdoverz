import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import officialPayload from "@/lib/extension-official-payload.json";
import type { OfficialIntegrityAttestation, OfficialIntegrityProfile } from "@/lib/extension-official-from-zip";

/**
 * Official extension fingerprint + challenge-response verification.
 * Admin ZIP uploads become the live official profile.
 * Fallback: `node extension/compute-integrity.js`
 *
 * Proof = SHA256(nonce + payload + live function sources).
 * Spoofing X-Extension-Integrity alone is not enough.
 */
export const OFFICIAL_EXTENSION_VERSION = "1.0.0";

export const OFFICIAL_EXTENSION_INTEGRITY_HASH =
  "0014ebe8c8eedaf67104f2c9854f0af43a13d6561b5aa12b247fa309225219c7";

/** Shown by extension when server rejects a modified build. */
export const EXTENSION_TAMPER_MESSAGE =
  "Modified extension. Download the official FlowDoverz build from your dashboard.";

const CHALLENGE_TTL_MS = 90_000;

type OfficialPayload = {
  hash?: string;
  payload?: string;
  attestation?: OfficialIntegrityAttestation;
};

const payloadDoc = officialPayload as OfficialPayload;

let profileCache: { key: string; profile: OfficialIntegrityProfile } | null = null;

export function invalidateOfficialIntegrityCache() {
  profileCache = null;
}

function bakedInProfile(): OfficialIntegrityProfile {
  const attestation = payloadDoc.attestation || {
    enforce: "",
    isBlockedCookieExtension: "",
    computeLivePayload: "",
    proveForSync: "",
  };
  return {
    hash: String(payloadDoc.hash || OFFICIAL_EXTENSION_INTEGRITY_HASH).toLowerCase(),
    payload: String(payloadDoc.payload || ""),
    files: [],
    attestation: {
      enforce: String(attestation.enforce || ""),
      isBlockedCookieExtension: String(attestation.isBlockedCookieExtension || ""),
      computeLivePayload: String(attestation.computeLivePayload || ""),
      proveForSync: String(attestation.proveForSync || ""),
    },
    version: OFFICIAL_EXTENSION_VERSION,
    generatedAt: "",
  };
}

async function resolveOfficialProfile(): Promise<OfficialIntegrityProfile> {
  try {
    const { getActiveIntegrityProfile, getExtensionConfig } = await import("@/lib/extension-store");
    const config = await getExtensionConfig();
    const cacheKey = `${config.activeVersion || ""}:${String(config.officialHash || "").toLowerCase()}`;
    if (profileCache?.key === cacheKey && profileCache.profile?.hash) {
      return profileCache.profile;
    }

    const stored = await getActiveIntegrityProfile();
    if (stored?.hash && stored.payload && stored.attestation) {
      profileCache = {
        key: cacheKey || stored.hash,
        profile: stored,
      };
      return stored;
    }
  } catch {
    // Use packaged fallback when Firestore has no sealed ZIP yet.
  }

  if (profileCache?.key === "baked-in" && profileCache.profile) {
    return profileCache.profile;
  }
  const fallback = bakedInProfile();
  profileCache = { key: "baked-in", profile: fallback };
  return fallback;
}

function challengeSecret() {
  return (
    process.env.FLOWBRIDGE_CHALLENGE_SECRET?.trim() ||
    process.env.FLOWBRIDGE_ADMIN_PASSWORD?.trim() ||
    process.env.FLOWBRIDGE_ADMIN_SECRET?.trim() ||
    "flowdoverz-extension-challenge"
  );
}

export async function expectedExtensionIntegrityHash() {
  const profile = await resolveOfficialProfile();
  return profile.hash.toLowerCase();
}

export async function officialExtensionVersion() {
  try {
    const { getExtensionConfig } = await import("./extension-store");
    const config = await getExtensionConfig();
    if (config.activeVersion) return String(config.activeVersion);
  } catch {
    // fall through
  }
  try {
    const profile = await resolveOfficialProfile();
    if (profile.version) return String(profile.version);
  } catch {
    // fall through
  }
  return OFFICIAL_EXTENSION_VERSION;
}

export async function officialExtensionPayload() {
  const profile = await resolveOfficialProfile();
  return profile.payload;
}

export async function officialExtensionAttestation() {
  const profile = await resolveOfficialProfile();
  return profile.attestation;
}

function sha256Hex(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function safeEqualHex(a: string, b: string) {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length !== right.length || left.length === 0) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/** Create a short-lived challenge. Does NOT expose the expected file hash. */
export function createExtensionChallenge() {
  const nonce = randomBytes(24).toString("hex");
  const exp = String(Date.now() + CHALLENGE_TTL_MS);
  const body = `${exp}.${nonce}`;
  const sig = createHmac("sha256", challengeSecret()).update(body).digest("hex");
  return {
    nonce,
    challenge: `${body}.${sig}`,
    expiresInSec: Math.floor(CHALLENGE_TTL_MS / 1000),
  };
}

function parseChallenge(challengeHeader: string | null | undefined) {
  const raw = String(challengeHeader || "").trim();
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [exp, nonce, sig] = parts;
  if (!exp || !nonce || !sig || nonce.length < 16) return null;
  const body = `${exp}.${nonce}`;
  const expected = createHmac("sha256", challengeSecret()).update(body).digest("hex");
  if (!safeEqualHex(sig, expected)) return null;
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || Date.now() > expMs) return null;
  return { nonce, expMs };
}

export function buildExtensionProof(
  nonce: string,
  payload: string,
  attestation: OfficialIntegrityAttestation,
) {
  // Must match extension/integrity-guard.js buildChallengeProof material.
  const material = [
    String(nonce),
    payload,
    attestation.enforce,
    attestation.isBlockedCookieExtension,
    attestation.computeLivePayload,
    attestation.proveForSync,
    "CAP=management,cookies",
  ].join("\n");
  return sha256Hex(material);
}

/**
 * Validate sync integrity headers.
 * Requires matching file hash AND challenge proof of payload + live function sources.
 */
export async function validateExtensionIntegrityHeaders(
  headers: {
    integrity?: string | null;
    challenge?: string | null;
    proof?: string | null;
  },
  options?: { email?: string | null },
): Promise<{ ok: true } | { ok: false; code: "EXTENSION_TAMPERED"; message: string }> {
  const fail = {
    ok: false as const,
    code: "EXTENSION_TAMPERED" as const,
    message: EXTENSION_TAMPER_MESSAGE,
  };

  const incomingHash = String(headers.integrity || "")
    .trim()
    .toLowerCase();
  const incomingProof = String(headers.proof || "")
    .trim()
    .toLowerCase();
  const parsed = parseChallenge(headers.challenge);

  if (!incomingHash || incomingHash.length < 32 || incomingHash === "placeholder") {
    return fail;
  }
  if (!parsed || !incomingProof || incomingProof.length < 32) {
    return fail;
  }

  const email = String(options?.email || "").trim();
  if (email) {
    try {
      const { getBrandedExtensionForUserEmail } = await import("@/lib/extension-reseller-pack");
      const pack = await getBrandedExtensionForUserEmail(email);
      if (pack?.profile?.hash && pack.profile.payload && pack.profile.attestation) {
        const packHash = pack.profile.hash.toLowerCase();
        const attestation = pack.profile.attestation;
        if (
          incomingHash === packHash &&
          attestation.enforce.length >= 80 &&
          attestation.isBlockedCookieExtension.length >= 80 &&
          attestation.computeLivePayload.length >= 80 &&
          attestation.proveForSync.length >= 80
        ) {
          const expectedProof = buildExtensionProof(parsed.nonce, pack.profile.payload, attestation);
          if (safeEqualHex(incomingProof, expectedProof)) {
            return { ok: true };
          }
        }
        return fail;
      }
    } catch {
      // fall through to official profile
    }
  }

  const profile = await resolveOfficialProfile();
  const expectedHash = profile.hash.toLowerCase();
  const payload = profile.payload;
  const attestation = profile.attestation;
  if (
    !expectedHash ||
    expectedHash === "placeholder" ||
    expectedHash.length < 32 ||
    !payload ||
    attestation.enforce.length < 80 ||
    attestation.isBlockedCookieExtension.length < 80 ||
    attestation.computeLivePayload.length < 80 ||
    attestation.proveForSync.length < 80
  ) {
    return fail;
  }

  let activeHash = expectedHash;
  try {
    const { getExtensionConfig } = await import("@/lib/extension-store");
    const official = String((await getExtensionConfig()).officialHash || "").toLowerCase();
    if (official.length >= 32) activeHash = official;
  } catch {
    // keep profile hash
  }
  if (incomingHash !== activeHash && incomingHash !== expectedHash) {
    return fail;
  }

  const expectedProof = buildExtensionProof(parsed.nonce, payload, attestation);
  if (!safeEqualHex(incomingProof, expectedProof)) {
    return fail;
  }

  return { ok: true };
}

/** @deprecated use validateExtensionIntegrityHeaders */
export async function validateExtensionIntegrityHeader(
  reportedHash: string | null | undefined,
) {
  return validateExtensionIntegrityHeaders({ integrity: reportedHash });
}
