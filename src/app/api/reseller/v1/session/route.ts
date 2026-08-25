import { NextRequest } from "next/server";
import { authenticateReseller, corsHeaders, jsonSafe } from "@/lib/reseller-http";
import { issueResellerClientSession } from "@/lib/user-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
  return jsonSafe({ success: true }, { headers: corsHeaders(request, []) });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateReseller(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonSafe(
      { success: false, error: "Invalid JSON body." },
      { status: 400, headers: auth.headers },
    );
  }

  const result = await issueResellerClientSession(auth.reseller.id, String(body.email || ""));
  if (!result.ok) {
    return jsonSafe(
      { success: false, error: result.error },
      { status: result.status, headers: auth.headers },
    );
  }

  return jsonSafe(
    {
      success: true,
      sid: result.sid,
      user: {
        email: result.email,
        assignedSlot: result.assignedSlot,
        subscriptionExpiresAt: result.subscriptionExpiresAt,
      },
    },
    { headers: auth.headers },
  );
}
