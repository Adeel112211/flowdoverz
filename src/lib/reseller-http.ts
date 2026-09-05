import { NextRequest, NextResponse } from "next/server";
import {
  getResellerByApiKey,
  logResellerApiUse,
  originsForReseller,
  resellerCanServe,
  resellerIsExpired,
  touchResellerUsage,
  websiteFromResellerRequest,
  type ResellerRecord,
} from "@/lib/reseller-store";
import { getPublicAppUrl, toPublicAbsoluteUrl } from "@/lib/site-urls";
import { getExtensionConfig } from "@/lib/extension-store";

const BLOCKED_KEYS = new Set([
  "cookies",
  "slot_cookies",
  "slotCookies",
  "cookie_hash",
  "cookieHash",
  "apiKeyHash",
  "passwordHash",
  "salt",
]);

export function jsonSafe(data: unknown, init?: { status?: number; headers?: HeadersInit }) {
  const body = JSON.stringify(data, (key, value) => {
    if (BLOCKED_KEYS.has(key)) return undefined;
    return value;
  });
  return new NextResponse(body, {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(init?.headers || {}),
    },
  });
}

export function readResellerApiKey(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const lower = header.toLowerCase();
  if (lower.startsWith("bearer ")) return header.slice(7).trim();
  if (lower.startsWith("token ")) return header.slice(6).trim();
  return (
    request.headers.get("x-reseller-key") ||
    request.headers.get("x-api-key") ||
    ""
  ).trim();
}

export function corsHeaders(request: NextRequest, allowedOrigins: string[]): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  const match = allowedOrigins.find((item) => item.toLowerCase() === origin.toLowerCase());
  if (!match) return {};
  return {
    "Access-Control-Allow-Origin": match,
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Reseller-Key",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

function originAllowed(origin: string, allowedOrigins: string[]) {
  return allowedOrigins.some((item) => item.toLowerCase() === origin.toLowerCase());
}

/** Browser calls must come from this reseller's website. Server calls have no Origin and still work. */
function rejectForeignWebsite(request: NextRequest, allowedOrigins: string[], headers: Record<string, string>) {
  const origin = (request.headers.get("origin") || "").trim();
  if (!origin) return null;
  if (originAllowed(origin, allowedOrigins)) return null;
  return jsonSafe(
    {
      success: false,
      error: "This API key is locked to the reseller website. Other websites cannot use it.",
    },
    { status: 403, headers: { ...headers, Vary: "Origin" } },
  );
}

export async function authenticateReseller(request: NextRequest): Promise<
  | { ok: true; reseller: ResellerRecord; headers: Record<string, string> }
  | { ok: false; response: NextResponse }
> {
  const key = readResellerApiKey(request);
  if (!key) {
    return {
      ok: false,
      response: jsonSafe({ success: false, error: "Missing reseller API key." }, { status: 401 }),
    };
  }

  let reseller: ResellerRecord | null = null;
  try {
    reseller = await getResellerByApiKey(key);
  } catch {
    return {
      ok: false,
      response: jsonSafe({ success: false, error: "Database not available." }, { status: 503 }),
    };
  }

  if (!reseller) {
    return {
      ok: false,
      response: jsonSafe({ success: false, error: "Invalid reseller API key." }, { status: 401 }),
    };
  }

  const found = reseller;
  const allowedOrigins = originsForReseller(found);
  const headers = corsHeaders(request, allowedOrigins);
  const site = websiteFromResellerRequest(request);
  const expected =
    site.source === "server" ||
    allowedOrigins.some((item) => item.toLowerCase() === site.origin.toLowerCase());

  async function recordUse(blocked: boolean) {
    await logResellerApiUse({
      resellerId: found.id,
      request,
      blocked,
      expected: blocked ? false : expected,
    });
  }

  const foreign = rejectForeignWebsite(request, allowedOrigins, headers);
  if (foreign) {
    await recordUse(true);
    return { ok: false, response: foreign };
  }
  if (reseller.status === "disabled") {
    await recordUse(true);
    return {
      ok: false,
      response: jsonSafe(
        { success: false, error: "This reseller is disabled." },
        { status: 403, headers },
      ),
    };
  }
  if (reseller.status === "paused") {
    await recordUse(true);
    return {
      ok: false,
      response: jsonSafe(
        { success: false, error: "This reseller is paused." },
        { status: 403, headers },
      ),
    };
  }
  if (reseller.kind === "official") {
    await recordUse(true);
    return {
      ok: false,
      response: jsonSafe(
        {
          success: false,
          error:
            "This partner sells FlowDoverz under our name. They sign in at the reseller panel and register clients there, not through this API.",
        },
        { status: 403, headers },
      ),
    };
  }
  if (resellerIsExpired(reseller) || !resellerCanServe(reseller)) {
    await recordUse(true);
    return {
      ok: false,
      response: jsonSafe(
        { success: false, error: "This reseller access has expired." },
        { status: 403, headers },
      ),
    };
  }

  void touchResellerUsage(reseller.id);
  await recordUse(false);
  return { ok: true, reseller, headers };
}

export async function buildResellerIntegration(reseller: {
  id?: string;
  kind?: string;
  assignedSlots: string[];
  maxUsers: number;
  seatsPurchased?: number;
  remainingSeats?: number;
  seatDays?: number;
  brandName: string;
  websiteUrl: string;
  allowedOrigins: string[];
  status: string;
  expiresAt: string | null;
  brandedExtension?: {
    downloadUrl?: string;
    version?: string;
    fileName?: string;
    generatedAt?: string;
    displayName?: string;
    officialVersion?: string;
    loginUrl?: string;
  } | null;
}) {
  const appUrl = getPublicAppUrl();
  const config = await getExtensionConfig();
  const version = config.activeVersion;
  let extensionDownloadUrl = version
    ? `${appUrl}/api/extension/download?v=${encodeURIComponent(version)}`
    : `${appUrl}/api/extension/download`;
  let branded = false;
  if (reseller.id && reseller.kind !== "official") {
    const resellerPath = `/api/extension/download?reseller=${encodeURIComponent(reseller.id)}`;
    const { getResellerExtensionPackMeta, brandedExtensionDownloadUrl } = await import(
      "@/lib/extension-reseller-lookup"
    );
    extensionDownloadUrl = toPublicAbsoluteUrl(
      reseller.brandedExtension?.downloadUrl || brandedExtensionDownloadUrl(reseller.id),
      resellerPath,
    );
    try {
      const pack = await getResellerExtensionPackMeta(reseller.id);
      branded = Boolean(pack || reseller.brandedExtension?.displayName);
    } catch {
      branded = Boolean(reseller.brandedExtension?.displayName);
    }
  }
  const seatsPurchased = Number(reseller.seatsPurchased ?? reseller.maxUsers) || 0;
  const clientLoginUrl =
    String(reseller.brandedExtension?.loginUrl || "").trim() ||
    (reseller.websiteUrl ? `${String(reseller.websiteUrl).replace(/\/$/, "")}/login` : "");

  return {
    brandName: reseller.brandName,
    websiteUrl: reseller.websiteUrl,
    status: reseller.status,
    expiresAt: reseller.expiresAt,
    apiBaseUrl: `${appUrl}/api/reseller/v1`,
    extensionDownloadUrl,
    clientLoginUrl: clientLoginUrl || undefined,
    assignedSlots: reseller.assignedSlots,
    maxUsers: seatsPurchased,
    seatsPurchased,
    remainingSeats: reseller.remainingSeats,
    seatDays: reseller.seatDays || 30,
    allowedOrigins: reseller.allowedOrigins,
    cookiesIncluded: false,
    brandedExtension: branded,
    rules: [
      "Call this API from your server. Never put the API key in frontend JavaScript.",
      "This API key is tied to your website origin. Other websites cannot call it from the browser.",
      "This API never returns Google Flow cookies.",
      branded
        ? "Users install the branded ZIP generated in Admin → Resellers. It is sealed by FlowDoverz. Never ship a ZIP you built yourself."
        : "Users install the official FlowDoverz extension only. Ask the owner to generate your branded ZIP in Admin → Resellers.",
      "Cookie slots stay on FlowDoverz. Your admin panel must not copy Cookie Manager.",
      "Each paid seat lets one user register. That user's 30-day timer starts at registration, not when you paid.",
      "When trials are enabled, send plan: \"trial\" to register a short trial seat instead of a paid Solo/Team seat.",
      "To upgrade an existing trial client to Solo/Team, POST /users again with plan: \"solo\" or \"team\" and upgrade: true.",
      "When seats run out, send another user payment so more seats can be added.",
      "Rotating the API key only changes server authentication. Previously registered clients keep working — update your server to the new key.",
    ],
  };
}
