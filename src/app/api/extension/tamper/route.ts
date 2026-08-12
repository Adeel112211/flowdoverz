import { NextRequest, NextResponse } from "next/server";
import { getClientSessionFromRequest } from "@/lib/client-session";
import { EXTENSION_TAMPER_MESSAGE } from "@/lib/extension-build";
import { clearExtensionTampered, markExtensionTampered } from "@/lib/user-store";

export const dynamic = "force-dynamic";

/**
 * Extension reports local tamper / cookie-protection removal so the
 * logged-in user's Dashboard can show reinstall guidance.
 */
export async function POST(request: NextRequest) {
  const session = getClientSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
  }

  let message = EXTENSION_TAMPER_MESSAGE;
  try {
    const body = (await request.json().catch(() => ({}))) as { message?: string };
    if (body.message && String(body.message).trim()) {
      message = String(body.message).trim().slice(0, 500);
    }
  } catch {
    // keep default
  }

  await markExtensionTampered(session.email, message);

  return NextResponse.json({
    success: true,
    code: "EXTENSION_TAMPERED",
    message,
  });
}

/** Dashboard / healthy extension clears the banner immediately. */
export async function DELETE(request: NextRequest) {
  const session = getClientSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
  }

  await clearExtensionTampered(session.email);
  return NextResponse.json({ success: true });
}
