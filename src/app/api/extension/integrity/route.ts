import { NextResponse } from "next/server";
import {
  EXTENSION_TAMPER_MESSAGE,
  createExtensionChallenge,
  officialExtensionVersion,
} from "@/lib/extension-build";
import { EXTENSION_UPDATE_MESSAGE } from "@/lib/extension-version";

export const dynamic = "force-dynamic";

/**
 * Public integrity challenge for the official extension.
 * Does NOT return expectedHash (that enabled hash-spoofing attacks).
 * Client must read real extension files and prove SHA256(nonce + payload).
 */
export async function GET() {
  const { nonce, challenge, expiresInSec } = createExtensionChallenge();
  const latestVersion = await officialExtensionVersion();
  return NextResponse.json({
    success: true,
    nonce,
    challenge,
    expiresInSec,
    version: latestVersion,
    latestVersion,
    updateMessage: EXTENSION_UPDATE_MESSAGE,
    tamperMessage: EXTENSION_TAMPER_MESSAGE,
    code: "EXTENSION_TAMPERED",
  });
}
