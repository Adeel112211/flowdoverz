import { NextResponse } from "next/server";
import {
  EXTENSION_TAMPER_MESSAGE,
  OFFICIAL_EXTENSION_VERSION,
  createExtensionChallenge,
} from "@/lib/extension-build";

export const dynamic = "force-dynamic";

/**
 * Public integrity challenge for the official extension.
 * Does NOT return expectedHash (that enabled hash-spoofing attacks).
 * Client must read real extension files and prove SHA256(nonce + payload).
 */
export async function GET() {
  const { nonce, challenge, expiresInSec } = createExtensionChallenge();
  return NextResponse.json({
    success: true,
    nonce,
    challenge,
    expiresInSec,
    version: OFFICIAL_EXTENSION_VERSION,
    tamperMessage: EXTENSION_TAMPER_MESSAGE,
    code: "EXTENSION_TAMPERED",
  });
}
