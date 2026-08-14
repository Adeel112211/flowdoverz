import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import officialPayload from "@/lib/extension-official-payload.json";

/**
 * Official extension fingerprint + challenge-response verification.
 * Recompute with: `node extension/compute-integrity.js`
 *
 * Proof = SHA256(nonce + payload + live function sources).
 * Spoofing X-Extension-Integrity alone is not enough.
 */
export const OFFICIAL_EXTENSION_VERSION = "1.0.34";

export const OFFICIAL_EXTENSION_INTEGRITY_HASH =
  "57caa249402325cd5b55138076de41354e15167c4bff74b06b32965b6a47af87";

/** Shown by extension when server rejects a modified build. */
export const EXTENSION_TAMPER_MESSAGE =
  "This extension was changed. Reinstall the official FlowDoverz build from your dashboard.";

const CHALLENGE_TTL_MS = 90_000;

type OfficialPayload = {
  hash?: string;
  payload?: string;
  attestation?: {
    enforce?: string;
    isBlockedCookieExtension?: string;
    computeLivePayload?: string;
    proveForSync?: string;
  };
};

const payloadDoc = officialPayload as OfficialPayload;

function challengeSecret() {
  return (
    process.env.FLOWBRIDGE_CHALLENGE_SECRET?.trim() ||
    process.env.FLOWBRIDGE_ADMIN_PASSWORD?.trim() ||
    process.env.FLOWBRIDGE_ADMIN_SECRET?.trim() ||
    "flowdoverz-extension-challenge"
  );
}

export function expectedExtensionIntegrityHash() {
  return (
    process.env.FLOWBRIDGE_EXTENSION_INTEGRITY_HASH?.trim().toLowerCase() ||
    String(payloadDoc.hash || OFFICIAL_EXTENSION_INTEGRITY_HASH).toLowerCase()
  );
}

export function officialExtensionPayload() {
  return String(payloadDoc.payload || "");
}

export function officialExtensionAttestation() {
  const a = payloadDoc.attestation || {};
  return {
    enforce: String(a.enforce || ""),
    isBlockedCookieExtension: String(a.isBlockedCookieExtension || ""),
    computeLivePayload: String(a.computeLivePayload || ""),
    proveForSync: String(a.proveForSync || ""),
  };
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
  payload = officialExtensionPayload(),
  attestation = officialExtensionAttestation(),
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
export function validateExtensionIntegrityHeaders(headers: {
  integrity?: string | null;
  challenge?: string | null;
  proof?: string | null;
}): { ok: true } | { ok: false; code: "EXTENSION_TAMPERED"; message: string } {
  const fail = {
    ok: false as const,
    code: "EXTENSION_TAMPERED" as const,
    message: EXTENSION_TAMPER_MESSAGE,
  };

  const expectedHash = expectedExtensionIntegrityHash();
  const payload = officialExtensionPayload();
  const attestation = officialExtensionAttestation();
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
  if (incomingHash !== expectedHash) {
    return fail;
  }

  const expectedProof = buildExtensionProof(parsed.nonce, payload, attestation);
  if (!safeEqualHex(incomingProof, expectedProof)) {
    return fail;
  }

  return { ok: true };
}

/** @deprecated use validateExtensionIntegrityHeaders */
export function validateExtensionIntegrityHeader(
  reportedHash: string | null | undefined,
): { ok: true } | { ok: false; code: "EXTENSION_TAMPERED"; message: string } {
  return validateExtensionIntegrityHeaders({ integrity: reportedHash });
}
