import JSZip from "jszip";
import { getDb } from "@/lib/firebase-admin";
import { sanitizeForFirestore } from "@/lib/cookie-store";
import { getReseller, normalizeOriginList } from "@/lib/reseller-store";
import { getActiveExtensionDownload } from "@/lib/extension-store";
import { sealOfficialExtensionZip, type OfficialIntegrityProfile } from "@/lib/extension-official-from-zip";
import { getPublicAppUrl, getResellerUrl } from "@/lib/site-urls";
import {
  INTEGRITY_COLLECTION,
  PACKS_COLLECTION,
  asResellerPackMeta,
  brandedExtensionDownloadPath,
  brandedExtensionDownloadUrl,
  getResellerExtensionPackMeta,
  type ResellerExtensionMeta,
} from "@/lib/extension-reseller-lookup";

export {
  brandedExtensionDownloadPath,
  brandedExtensionDownloadUrl,
  type ResellerExtensionMeta,
};

const BRANDING_COLLECTION = "extension_reseller_branding";
const MAX_ZIP_BYTES = 700_000;
const PREVIOUS_HASH_LIMIT = 20;
const MAX_LOGO_BYTES = 400_000;
const TEXT_FILE = /\.(js|mjs|cjs|json|html|htm|css|svg|txt|md)$/i;
const RASTER_FILE = /\.(png|jpe?g|webp|gif|ico)$/i;
const BRAND_IMAGE_FILE = /\.(png|jpe?g|webp|gif|ico|svg)$/i;
const EMAIL_OVERLAY_FILES = new Set([
  "fake-credits.js",
  "fake-models-main.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "early-credits.css",
  "content.js",
]);

export type ResellerExtensionBranding = {
  displayName: string;
  supportEmail: string;
  dashboardUrl?: string;
  loginUrl?: string;
  logoBase64?: string;
  logoMime?: string;
  keepLogo?: boolean;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  labelColor?: string;
  onPrimaryColor?: string;
};

export type ResellerExtensionPack = ResellerExtensionMeta & {
  buffer: Buffer;
  profile: OfficialIntegrityProfile;
};

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("Database not configured.");
  return db;
}

function slugifyBrand(name: string) {
  return (
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "reseller"
  );
}

function chromeShortName(name: string) {
  const cleaned = String(name || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= 12) return cleaned;
  return cleaned.slice(0, 12).trim();
}

function zipEntry(zip: JSZip, fileName: string) {
  const exact = zip.file(fileName);
  if (exact && !exact.dir) return exact;
  const suffix = `/${fileName}`;
  return (
    Object.values(zip.files).find(
      (entry) => !entry.dir && (entry.name === fileName || entry.name.endsWith(suffix)),
    ) || null
  );
}

function rotateHashes(previous: string[] | undefined, oldHash: string | null | undefined, nextHash: string) {
  const seen = new Set<string>();
  const out: string[] = [];
  const next = nextHash.toLowerCase();
  for (const hash of [oldHash, ...(previous || [])]) {
    const value = String(hash || "").toLowerCase();
    if (value.length < 32 || value === next || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= PREVIOUS_HASH_LIMIT) break;
  }
  return out;
}

function replaceVisibleBrand(text: string, displayName: string) {
  const name = String(displayName || "").trim();
  if (!name) return text;
  // Do not touch identifiers like FlowDoverzGuard / FlowDoverzProtect.
  // Replacing those with "INFINITY FLOWGuard" makes background.js unparsable,
  // the service worker never starts, and the popup shows "Sync timed out".
  return String(text || "")
    .replace(/Flow[\s-]*Doverz(?![A-Za-z0-9_])/g, name)
    .replace(/FLOW[\s-]*DOVERZ(?![A-Za-z0-9_])/g, name.toUpperCase())
    .replace(/Google Flow Workspace/gi, `${name} workspace`)
    .replace(/GOOGLE FLOW WORKSPACE/g, `${name.toUpperCase()} WORKSPACE`);
}

const DEFAULT_BRAND_BG = "#080810";
const DEFAULT_BRAND_PRIMARY = "#22d3ee";
const DEFAULT_BRAND_ACCENT = "#34d399";
const DEFAULT_BRAND_LABEL = "#a5f3fc";
const DEFAULT_BRAND_ON_PRIMARY = "#041016";

function normalizeHexColor(raw: string, fallback: string) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(raw || "").trim());
  if (!match) return fallback;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split("").map((part) => `${part}${part}`).join("");
  return `#${hex.toLowerCase()}`;
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function darkenHex(hex: string, amount = 0.18) {
  const { r, g, b } = hexToRgb(hex);
  const next = (channel: number) => Math.max(0, Math.round(channel * (1 - amount)));
  return `#${[next(r), next(g), next(b)].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function normalizePublicUrl(raw: string) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function portalOriginFromUrl(raw: string) {
  const full = normalizePublicUrl(raw);
  if (!full) return "";
  try {
    const url = new URL(full);
    return `${url.protocol}//${url.host}`;
  } catch {
    return full.replace(/\/+(login|signup|dashboard|painel)\/?$/i, "").replace(/\/$/, "");
  }
}

function ensurePortalHostAccess(manifest: Record<string, unknown>, origins: string[]) {
  const unique = [
    ...new Set(
      origins
        .map((item) => String(item || "").trim().replace(/\/$/, ""))
        .filter(Boolean),
    ),
  ];
  if (!unique.length) return;

  for (const origin of unique) {
    const perm = `${origin}/*`;
    const perms = Array.isArray(manifest.host_permissions) ? [...(manifest.host_permissions as string[])] : [];
    if (!perms.includes(perm) && !perms.some((item) => item === "https://*/*" || item === "*://*/*")) {
      perms.push(perm);
      manifest.host_permissions = perms;
    }
  }

  const scripts = Array.isArray(manifest.content_scripts)
    ? (manifest.content_scripts as Array<Record<string, unknown>>).map((entry) => ({ ...entry }))
    : [];
  for (const entry of scripts) {
    const jsFiles = Array.isArray(entry.js) ? entry.js.map((item) => String(item)) : [];
    if (!jsFiles.some((file) => /portal-bridge/i.test(file))) continue;
    const matches = Array.isArray(entry.matches) ? [...(entry.matches as string[])] : [];
    for (const origin of unique) {
      const match = `${origin}/*`;
      if (!matches.includes(match)) matches.push(match);
    }
    entry.matches = matches;
  }
  if (scripts.length) manifest.content_scripts = scripts;
}

/**
 * Sync/integrity stay on FlowDoverz. Login and Dashboard use the exact client URL
 * from Admin (e.g. https://infinity-flow-tau.vercel.app/painel).
 */
function brandRuntimeSource(runtime: {
  siteName: string;
  supportEmail: string;
  loginUrl: string;
  dashboardUrl: string;
  cookieOrigin: string;
  syncOrigin: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  labelColor: string;
  onPrimaryColor: string;
}) {
  return `var BRAND_RUNTIME = ${JSON.stringify(runtime)};
function portalLoginUrl() {
  try {
    if (typeof BRAND_RUNTIME !== "undefined" && BRAND_RUNTIME.loginUrl) return BRAND_RUNTIME.loginUrl;
  } catch (_e) {}
  return ${JSON.stringify(runtime.loginUrl)};
}
function resellerDashboardUrl() {
  try {
    if (typeof BRAND_RUNTIME !== "undefined" && BRAND_RUNTIME.dashboardUrl) return BRAND_RUNTIME.dashboardUrl;
  } catch (_e) {}
  return ${JSON.stringify(runtime.dashboardUrl)};
}
try {
  if (typeof document !== "undefined" && document.documentElement) {
    var root = document.documentElement;
    if (BRAND_RUNTIME.backgroundColor) root.style.setProperty("--bg", BRAND_RUNTIME.backgroundColor);
    if (BRAND_RUNTIME.primaryColor) {
      root.style.setProperty("--primary", BRAND_RUNTIME.primaryColor);
      root.style.setProperty("--primary-dark", BRAND_RUNTIME.primaryColor);
    }
    if (BRAND_RUNTIME.accentColor) root.style.setProperty("--accent", BRAND_RUNTIME.accentColor);
    if (BRAND_RUNTIME.labelColor) root.style.setProperty("--label", BRAND_RUNTIME.labelColor);
    if (BRAND_RUNTIME.onPrimaryColor) root.style.setProperty("--on-primary", BRAND_RUNTIME.onPrimaryColor);
  }
} catch (_theme) {}
`;
}

function applyBrandTheme(
  text: string,
  fileName: string,
  theme: {
    bg: string;
    panel: string;
    primary: string;
    primaryDark: string;
    accent: string;
    label: string;
    onPrimary: string;
  },
) {
  const base = fileBaseName(fileName);
  let out = String(text || "");
  if (base === "popup.css") {
    out = out.replace(/--bg:\s*#[0-9a-fA-F]{3,8};/, `--bg: ${theme.bg};`);
    out = out.replace(/--panel:\s*#[0-9a-fA-F]{3,8};/, `--panel: ${theme.panel};`);
    out = out.replace(/--primary:\s*#[0-9a-fA-F]{3,8};/, `--primary: ${theme.primary};`);
    out = out.replace(/--primary-dark:\s*#[0-9a-fA-F]{3,8};/, `--primary-dark: ${theme.primaryDark};`);
    out = out.replace(/--accent:\s*#[0-9a-fA-F]{3,8};/, `--accent: ${theme.accent};`);
    out = out.replace(/rgba\(\s*34\s*,\s*211\s*,\s*238\s*,/g, `rgba(${hexToRgb(theme.primary).r}, ${hexToRgb(theme.primary).g}, ${hexToRgb(theme.primary).b},`);
    out = out.replace(/rgba\(\s*52\s*,\s*211\s*,\s*153\s*,/g, `rgba(${hexToRgb(theme.accent).r}, ${hexToRgb(theme.accent).g}, ${hexToRgb(theme.accent).b},`);
    out = out.replace(/#a5f3fc/gi, theme.label);
    out = out.replace(/#ecfeff/gi, theme.label);
    out = out.replace(/#041016/gi, theme.onPrimary);
    return out;
  }
  if (base === "content.js") {
    out = out.replace(/linear-gradient\(135deg, #22d3ee, #34d399\)/g, `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`);
    out = out.replace(/current \? "#ecfeff"/g, `current ? ${JSON.stringify(theme.label)}`);
    out = out.replace(/isCurrent \? "#ecfeff"/g, `isCurrent ? ${JSON.stringify(theme.label)}`);
    out = out.replace(/current \? "#020617"/g, `current ? ${JSON.stringify(theme.onPrimary)}`);
    out = out.replace(/isCurrent \? "#020617"/g, `isCurrent ? ${JSON.stringify(theme.onPrimary)}`);
    out = out.replace(/color: "#020617"/g, `color: ${JSON.stringify(theme.onPrimary)}`);
    out = out.replace(/color: "#22d3ee"/g, `color: ${JSON.stringify(theme.primary)}`);
    return out;
  }
  if (base === "popup.html" && !/id=["']brand-theme["']/.test(out)) {
    const style = `<style id="brand-theme">:root{--bg:${theme.bg};--panel:${theme.panel};--primary:${theme.primary};--primary-dark:${theme.primaryDark};--accent:${theme.accent};--label:${theme.label};--on-primary:${theme.onPrimary};}</style>\n    `;
    if (/<link[^>]+popup\.css/i.test(out)) {
      return out.replace(/<link[^>]+popup\.css[^>]*>/i, `${style}$&`);
    }
    return out.replace(/<\/head>/i, `${style}</head>`);
  }
  return out;
}

function wireBrandRuntimeLoader(text: string, fileName: string) {
  const base = fileBaseName(fileName);
  let out = String(text || "");
  if (base === "background.js") {
    out = out.replace(/importScripts\(\s*"brand-runtime\.js"\s*,\s*/g, "importScripts(");
    out = out.replace(/^importScripts\("brand-runtime\.js"\);\s*/m, "");
  }
  if (base === "popup.html" && !/brand-runtime\.js/.test(out)) {
    if (/<script([^>]*src=["']popup\.js["'][^>]*)>/i.test(out)) {
      out = out.replace(
        /<script([^>]*src=["']popup\.js["'][^>]*)>/i,
        `<script src="brand-runtime.js"></script>\n    <script$1>`,
      );
    } else {
      out = out.replace(/<\/head>/i, `<script src="brand-runtime.js"></script>\n</head>`);
    }
  }
  return out;
}

function fileBaseName(fileName: string) {
  return String(fileName || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop() || "";
}

function brandedPortalLockScript(portalOrigin: string, ownerOrigin: string, loginUrl: string) {
  const origin = String(portalOrigin || "").replace(/\/$/, "");
  const owner = String(ownerOrigin || "").replace(/\/$/, "") || "https://flow.doverz.com";
  const login = String(loginUrl || `${origin}/login`).trim() || `${origin}/login`;
  const originJson = JSON.stringify(origin);
  const ownerJson = JSON.stringify(owner);
  const loginJson = JSON.stringify(login);
  return `

;/* branded-portal-lock */
function brandedDecodeSid(value) {
  var token = String(value || "").trim();
  if (!token || token === "admin-local") return "";
  try {
    var decoded = decodeURIComponent(token);
    if (decoded && decoded.split("|").length >= 4) return decoded;
  } catch (_e) {}
  return token;
}
async function brandedReadSid(url) {
  try {
    var target = String(url || "").replace(/\\/+$/, "");
    if (!target) return "";
    if (target.indexOf("http") !== 0) target = "https://" + target;
    var originUrl = target;
    try { originUrl = new URL(target).origin + "/"; } catch (_e) {}
    var cookie = await chrome.cookies.get({ url: originUrl, name: SESSION_COOKIE_NAME });
    var token = brandedDecodeSid(cookie && cookie.value);
    if (token) return token;
    cookie = await chrome.cookies.get({ url: target + "/", name: SESSION_COOKIE_NAME });
    return brandedDecodeSid(cookie && cookie.value);
  } catch (_error) {
    return "";
  }
}
async function brandedEnsureOwnerSid() {
  try {
    var stored = await chrome.storage.local.get(["brandedSid", "clientPortalUrl"]);
    var sid = brandedDecodeSid(stored && stored.brandedSid);
    if (sid) return sid;
    var clientPortal = stored && stored.clientPortalUrl;
    if (clientPortal) {
      var fromClientPortal = await brandedReadSid(clientPortal);
      if (fromClientPortal) {
        try { await chrome.storage.local.set({ brandedSid: fromClientPortal, portalUrl: ${ownerJson} }); } catch (_e0) {}
        return fromClientPortal;
      }
    }
  } catch (_e) {}
  var found =
    (await brandedReadSid(${ownerJson})) ||
    (await brandedReadSid(${loginJson})) ||
    (await brandedReadSid(${originJson}));
  if (!found) {
    try {
      var all = await chrome.cookies.getAll({ name: SESSION_COOKIE_NAME });
      for (var i = 0; i < (all || []).length; i++) {
        var token = brandedDecodeSid(all[i] && all[i].value);
        if (token) { found = token; break; }
      }
    } catch (_allErr) {}
  }
  if (!found) return "";
  try { await chrome.storage.local.set({ brandedSid: found, portalUrl: ${ownerJson} }); } catch (_e2) {}
  return found;
}
async function hasPortalLoginCookie(_baseUrl) {
  return Boolean(await brandedEnsureOwnerSid());
}
async function portalSessionCookieHeader(_baseUrl) {
  var sid = await brandedEnsureOwnerSid();
  if (!sid) return "";
  return SESSION_COOKIE_NAME + "=" + sid;
}
async function plantPortalSidCookie(_origin, sid) {
  var token = brandedDecodeSid(sid);
  if (!token || token.length < 16) return;
  try { await chrome.storage.local.set({ brandedSid: token, portalUrl: ${ownerJson} }); } catch (_e) {}
}
function portalLoginUrl() {
  return ${loginJson};
}
function syncLoginUrl() {
  return ${JSON.stringify(`${owner}/login`)};
}
async function resolvePortalBaseUrl(_preferred) {
  var owner = ${ownerJson};
  await chrome.storage.local.set({ portalUrl: owner });
  return owner;
}
async function resolveClientSid(preferredBaseUrl) {
  var sid = await brandedEnsureOwnerSid();
  if (sid) return sid;
  try {
    if (typeof nativeResolveClientSid === "function") {
      return await nativeResolveClientSid(preferredBaseUrl);
    }
  } catch (_nativeErr) {}
  return "";
}
`;
}

function appendBrandedPortalLock(
  text: string,
  fileName: string,
  portalOrigin: string,
  ownerOrigin: string,
  loginUrl: string,
) {
  if (fileBaseName(fileName) !== "background.js") return text;
  const origin = String(portalOrigin || "").replace(/\/$/, "");
  const owner = String(ownerOrigin || "").replace(/\/$/, "") || "https://flow.doverz.com";
  if (!origin && !owner) return text;
  let stripped = String(text || "").replace(/\n;\/\* branded-portal-lock \*\/[\s\S]*$/, "");
  stripped = stripped.replace(
    /\basync function resolveClientSid\(/g,
    "async function nativeResolveClientSid(",
  );
  stripped = stripped.replace(
    /\s*else if \(!request\.isLoggedIn && !sid\) \{[\s\S]*?handleLogoutOrError\([\s\S]*?\);\s*\}\);?\s*/g,
    "\n    ",
  );
  stripped = stripped.replace(
    /if \(request\.isLoggedIn && request\.email\) \{/,
    "if ((request.sid && String(request.sid).length >= 16) || (request.isLoggedIn && (request.email || request.sid))) {",
  );
  stripped = stripped.replace(
    /if \(request\.isLoggedIn && \(request\.email \|\| request\.sid\)\) \{/,
    "if ((request.sid && String(request.sid).length >= 16) || (request.isLoggedIn && (request.email || request.sid))) {",
  );
  stripped = stripped.replace(
    /const sid = decodeClientSid\(request\.sid\);\s*const loggedIn =[\s\S]*?if \(loggedIn\) \{\s*const payload = \{\s*portalUrl: DEFAULT_PORTAL_URL,/,
    `const sid = decodeClientSid(request.sid);
    const loggedIn =
      sid.length >= 16 || (request.isLoggedIn && (request.email || request.sid));
    if (loggedIn) {
      const payload = {
        portalUrl: ${JSON.stringify(owner || "https://flow.doverz.com")},`,
  );
  stripped = stripped.replace(
    /portalUrl:\s*DEFAULT_PORTAL_URL,/,
    `portalUrl: ${JSON.stringify(owner || "https://flow.doverz.com")},`,
  );
  stripped = stripped.replace(
    /portalUrl:\s*request\.origin(?:\s*\|\|\s*DEFAULT_PORTAL_URL)?,/,
    `portalUrl: ${JSON.stringify(owner || "https://flow.doverz.com")},\n            brandedSid: request.sid || "",`,
  );
  stripped = stripped.replace(
    /\s*else if \(!request\.isLoggedIn\) \{[\s\S]{0,900}?handleLogoutOrError\([\s\S]{0,500}?\);\s*\}\);?\s*\}/,
    "\n    ",
  );
  if (!/plantPortalSidCookie\(request\.origin, request\.sid\)/.test(stripped)) {
    stripped = stripped.replace(
      /if \(request\.action === "PORTAL_AUTH_DETECTED"\) \{/,
      `if (request.action === "PORTAL_AUTH_DETECTED") {
    if (request.sid && String(request.sid).length >= 16) {
      plantPortalSidCookie(request.origin, request.sid);
    }`,
    );
  }
  stripped = stripped.replace(
    /if \(clientSid\) headers\["X-FlowDoverz-Sid"\] = clientSid;/,
    `if (!clientSid) {
      try { clientSid = await brandedEnsureOwnerSid(); } catch (_sidErr) {}
    }
    if (clientSid) headers["X-FlowDoverz-Sid"] = clientSid;`,
  );
  if (!/brandedEnsureOwnerSid/.test(stripped)) {
    stripped = stripped.replace(
      /if \(clientSid\) headers\["X-FlowDoverz-Sid"\] = clientSid;/,
      `try {
      var __sid = clientSid || (await brandedEnsureOwnerSid());
      if (__sid) headers["X-FlowDoverz-Sid"] = __sid;
    } catch (_sidErr) {}`,
    );
  }
  stripped = stripped.replace(
    /if \(request\.action === "TRIGGER_SYNC"\) \{[\s\S]*?return true;\s*\}/,
    `if (request.action === "TRIGGER_SYNC") {
    var __syncDone = false;
    var __syncFinish = function (result) {
      if (__syncDone) return;
      __syncDone = true;
      if (result && !result.success && !result.message) {
        result.message = "Sign in on your client page, then try Sync again.";
      }
      try { sendResponse(result || { success: false, status: "disconnected", message: "Sign in on your client page, then try Sync again." }); } catch (_e) {}
    };
    setTimeout(function () {
      __syncFinish({ success: false, status: "disconnected", message: "Sign in on your client page, then try Sync again." });
    }, 12000);
    performCookieSync(request.slot || "", { force: true }).then(async function (result) {
      if (!result || !result.success) {
        if (result && result.status === "disconnected") {
          var hasSid = "";
          try { hasSid = await brandedEnsureOwnerSid(); } catch (_sidErr) {}
          if (!hasSid) {
            var loginTarget = "";
            try { if (typeof syncLoginUrl === "function") loginTarget = syncLoginUrl(); } catch (_syncLoginFn) {}
            if (!loginTarget) {
              try { if (typeof portalLoginUrl === "function") loginTarget = portalLoginUrl(); } catch (_loginFn) {}
            }
            if (!loginTarget) loginTarget = ${JSON.stringify(`${owner}/login`)};
            try { await chrome.tabs.create({ url: loginTarget, active: true }); } catch (_tabErr) {}
            result.message = "Sign in with your client email on the page that opened, then Sync again.";
          }
        }
      }
      __syncFinish(result || { success: false, status: "disconnected" });
    }).catch(function () {
      __syncFinish({ success: false, status: "disconnected", message: "Sign in on your client page, then try Sync again." });
    });
    return true;
  }`,
  );
  return stripped + brandedPortalLockScript(origin, owner, loginUrl);
}

function rewriteSyncTimeoutCopy(text: string) {
  let out = String(text || "");
  out = out.replace(
    /Sync timed out\. Open [^."]*, sign in, then try again\./g,
    "Sync timed out. Sign in on your client page, then try again.",
  );
  out = out.replace(
    /Sync timed out\. Sign in on your website, then try again\./g,
    "Sync timed out. Sign in on your client page, then try again.",
  );
  out = out.replace(
    /Open [^."]{0,80} in this browser, sign in, then tap Sync now\./g,
    "Sign in on your client page in this browser, then tap Sync now.",
  );
  out = out.replace(
    /Could not connect — sign in on your website, then Sync/g,
    "Could not connect. Sign in on your client page, then Sync.",
  );
  out = out.replace(
    /Could not connect\. Sign in on your website, then Sync\./g,
    "Could not connect. Sign in on your client page, then Sync.",
  );
  out = out.replace(
    /showToast\("Could not connect[^"]*"\)/g,
    'showToast(result.message || "Could not connect. Sign in on your client page, then Sync.")',
  );
  out = out.replace(/\},\s*20000\)/, "}, 12000)");
  out = out.replace(/\},\s*45000\)/, "}, 12000)");
  return out;
}

function rewritePortalBridgePositiveOnly(text: string, fileName: string) {
  if (fileBaseName(fileName) !== "portal-bridge.js") return text;
  let out = String(text || "");
  if (/Never broadcast "logged out" from here/.test(out)) return out;
  out = out.replace(
    /const realLogin = \(isLoggedIn && email\.includes\("@"\)\) \|\| sid\.length >= 16;\s*safeSend\("PORTAL_AUTH_DETECTED", \{\s*isLoggedIn: realLogin,/,
    `const realLogin = (isLoggedIn && email.includes("@")) || sid.length >= 16;
      if (!realLogin) return;
      safeSend("PORTAL_AUTH_DETECTED", {
        isLoggedIn: true,`,
  );
  return out;
}

function rewritePortalBridgeOrigin(text: string, fileName: string, ownerOrigin: string) {
  if (fileBaseName(fileName) !== "portal-bridge.js") return text;
  const owner = String(ownerOrigin || "").replace(/\/$/, "") || "https://flow.doverz.com";
  const ownerJson = JSON.stringify(owner);
  let out = rewritePortalBridgePositiveOnly(text, fileName);
  if (!/sid\.length\s*>=\s*16/.test(out) || /const realLogin = isLoggedIn && email\.includes\("@"\);/.test(out)) {
    out = out.replace(
      /const realLogin = isLoggedIn && email\.includes\("@"\);\s*/g,
      "",
    );
    out = out.replace(
      /let sid = bridge\.getAttribute\("data-sid"\) \|\| "";/,
      `let sid = bridge.getAttribute("data-sid") || "";`,
    );
    if (!/sid\.length\s*>=\s*16/.test(out)) {
      out = out.replace(
        /safeSend\("PORTAL_AUTH_DETECTED", \{\s*isLoggedIn: realLogin,\s*email,\s*days,/,
        `const realLogin = (isLoggedIn && email.includes("@")) || sid.length >= 16;
      safeSend("PORTAL_AUTH_DETECTED", {\n        isLoggedIn: realLogin,\n        email,\n        sid,\n        days,`,
      );
    } else {
      out = out.replace(
        /safeSend\("PORTAL_AUTH_DETECTED", \{\s*isLoggedIn: realLogin,\s*email,\s*days,/,
        `safeSend("PORTAL_AUTH_DETECTED", {\n        isLoggedIn: realLogin,\n        email,\n        sid,\n        days,`,
      );
    }
  }
  out = out.replace(/origin:\s*baseUrl,/, `origin: ${ownerJson},`);
  out = out.replace(
    /safeSend\("PORTAL_AUTH_DETECTED", \{\s*isLoggedIn: true,\s*email: session\.email,\s*days: Number\(bridge\.getAttribute\("data-days"\) \|\| "30"\),\s*origin,/,
    `safeSend("PORTAL_AUTH_DETECTED", {\n        isLoggedIn: bridge.getAttribute("data-active") === "1" || String(bridge.getAttribute("data-sid") || "").length >= 16,\n        email: session.email,\n        sid: String(bridge.getAttribute("data-sid") || ""),\n        days: (function () {\n          var plan = String(bridge.getAttribute("data-plan") || "");\n          var hours = Number(bridge.getAttribute("data-hours") || "0");\n          var daysLeft = Number(bridge.getAttribute("data-days") || "0");\n          if (plan === "trial" && hours > 0) return Math.max(1, daysLeft || Math.ceil(hours / 24));\n          return Number(bridge.getAttribute("data-days") || "30");\n        })(),\n        origin: ${ownerJson},`,
  );
  out = out.replace(
    /setInterval\(detectPortalAuth, 2500\);/,
    `var lastBridgeSid = "";
  setInterval(function () {
    var el = document.getElementById("flowdoverz-auth-bridge");
    var nextSid = el ? String(el.getAttribute("data-sid") || "") : "";
    if (nextSid && nextSid === lastBridgeSid) return;
    lastBridgeSid = nextSid;
    detectPortalAuth();
  }, 2500);`,
  );
  return out;
}

function replaceDashboardUrls(text: string, dashboardUrl: string, appUrl: string) {
  if (!dashboardUrl) return text;
  const app = String(appUrl || "").replace(/\/$/, "");
  let out = String(text || "");
  if (app) {
    const escaped = app.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`${escaped}/dashboard/?`, "gi"), dashboardUrl);
  }
  out = out.replace(/https?:\/\/(?:www\.)?flowdoverz\.[a-z.]+\/dashboard\/?/gi, dashboardUrl);
  return out;
}

function pinResellerDashboardUrl(text: string, dashboardUrl: string) {
  const url = String(dashboardUrl || "").trim();
  if (!url) return text;
  const assignment = `const RESELLER_DASHBOARD_URL = ${JSON.stringify(url)};`;
  let out = String(text || "");
  if (/const RESELLER_DASHBOARD_URL\s*=/.test(out)) {
    out = out.replace(/const RESELLER_DASHBOARD_URL\s*=\s*(['"`])[\s\S]*?\1\s*;/, assignment);
  } else if (/const DEFAULT_PORTAL_URL\s*=/.test(out)) {
    out = out.replace(
      /^([ \t]*)const DEFAULT_PORTAL_URL\s*=\s*(['"])[^'"]*\2\s*;/m,
      (full, indent: string) => `${full}\n${indent}${assignment}`,
    );
  }
  return out;
}

function rewriteDashboardOpen(text: string, dashboardUrl: string) {
  const url = String(dashboardUrl || "").trim();
  if (!url) return text;
  let out = pinResellerDashboardUrl(text, url);
  out = out.replace(
    /if\s*\(\s*request\.action\s*===\s*"OPEN_DASHBOARD"\s*\)\s*\{[\s\S]*?return true;\s*\}/,
    `if (request.action === "OPEN_DASHBOARD") {
    (async () => {
      try {
        var url = (typeof BRAND_RUNTIME !== "undefined" && BRAND_RUNTIME.dashboardUrl) || RESELLER_DASHBOARD_URL || DEFAULT_PORTAL_URL;
        await chrome.tabs.create({ url: url, active: true });
      } catch (_error) {}
      try { sendResponse({ success: true }); } catch (_error) {}
    })();
    return true;
  }`,
  );
  out = out.replace(
    /dashboardBtn\.addEventListener\(\s*"click"\s*,\s*\(\)\s*=>\s*\{\s*chrome\.runtime\.sendMessage\(\s*\{\s*action:\s*"OPEN_DASHBOARD"\s*\}\s*\)\s*;\s*\}\s*\)/,
    `dashboardBtn.addEventListener("click", () => {
      var url = (typeof BRAND_RUNTIME !== "undefined" && BRAND_RUNTIME.dashboardUrl)
        || (typeof RESELLER_DASHBOARD_URL === "string" && RESELLER_DASHBOARD_URL)
        || ((currentPortalUrl || DEFAULT_PORTAL_URL).replace(/\\/+$/, "") + "/dashboard");
      if (chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url: url, active: true });
      else chrome.runtime.sendMessage({ action: "OPEN_DASHBOARD" });
    })`,
  );
  out = out.replace(
    /`\$\{portalRoot\.replace\(\/\\\/\+\$\/,\s*""\)\}\/dashboard`/g,
    "RESELLER_DASHBOARD_URL",
  );
  out = out.replace(
    /chrome\.tabs\.create\(\s*\{\s*url:\s*`\$\{[^`]*\}\/dashboard`\s*\}\s*\)/g,
    "chrome.tabs.create({ url: RESELLER_DASHBOARD_URL, active: true })",
  );
  out = out.replace(
    /`\$\{OWNER_PORTAL_URL\}\/login`/g,
    "portalLoginUrl()",
  );
  out = out.replace(
    /`\$\{cleanBaseUrl\(DEFAULT_PORTAL_URL\)\}\/login`/g,
    "portalLoginUrl()",
  );
  out = out.replace(
    /chrome\.tabs\.create\(\s*\{\s*url:\s*`\$\{[^`]*\}\/login`\s*\}\s*\)/g,
    "chrome.tabs.create({ url: portalLoginUrl(), active: true })",
  );
  out = out.replace(
    /const origin = cleanBaseUrl\(DEFAULT_PORTAL_URL\);/g,
    "const origin = cleanBaseUrl((typeof RESELLER_DASHBOARD_URL === \"string\" && RESELLER_DASHBOARD_URL) ? RESELLER_DASHBOARD_URL : DEFAULT_PORTAL_URL);",
  );
  return out;
}

function replaceVisibleEmails(text: string, email: string) {
  if (!email) return text;
  return String(text || "")
    .replace(/[a-zA-Z0-9._%+-]+@flowdoverz\.[a-zA-Z.]{2,}/gi, email)
    .replace(/flowdoverz\$\{[^}]+\}@gmail\.com/gi, email)
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, email);
}

/** Stamp the reseller name/email so Sync cannot put FlowDoverz back into the popup. */
function applyBrandIdentity(text: string, displayName: string, supportEmail: string) {
  const name = String(displayName || "").trim();
  const email = String(supportEmail || "").trim().toLowerCase();
  if (!name) return text;
  const nameJson = JSON.stringify(name);
  const emailJson = JSON.stringify(email);
  let out = String(text || "");

  out = out.replace(
    /siteName\.textContent\s*=\s*state\.brand_siteName\s*\|\|\s*(['"`])[\s\S]*?\1/g,
    `siteName.textContent = (typeof BRAND_RUNTIME !== "undefined" && BRAND_RUNTIME.siteName) || ${nameJson}`,
  );
  out = out.replace(
    /brand_siteName:\s*data\.branding\?\.site_name\s*\|\|\s*(['"`])[\s\S]*?\1/g,
    `brand_siteName: ${nameJson}`,
  );
  out = out.replace(
    /(<strong[^>]*id=["']siteName["'][^>]*>)[\s\S]*?(<\/strong>)/i,
    `$1${name.replace(/</g, "")}$2`,
  );
  out = out.replace(/(<title>)[\s\S]*?(<\/title>)/i, `$1${name.replace(/</g, "")}$2`);

  if (!/\bBRAND_SITE_NAME\b/.test(out) && /const DEFAULT_PORTAL_URL\s*=/.test(out)) {
    out = out.replace(
      /^([ \t]*)const DEFAULT_PORTAL_URL\s*=\s*(['"])[^'"]*\2\s*;/m,
      (full, indent: string) =>
        `${full}\n${indent}const BRAND_SITE_NAME = ${nameJson};` +
        (email ? `\n${indent}const BRAND_SUPPORT_EMAIL = ${emailJson};` : ""),
    );
  }
  if (email && /const DISPLAY_NAME\s*=/.test(out) && !/\bBRAND_SUPPORT_EMAIL\b/.test(out)) {
    out = out.replace(
      /^([ \t]*)const DISPLAY_NAME\s*=\s*(['"])[^'"]*\2\s*;/m,
      (full, indent: string) => `${full}\n${indent}const BRAND_SUPPORT_EMAIL = ${emailJson};`,
    );
  }

  if (email) {
    out = out.replace(/[a-zA-Z0-9._%+-]+@flowdoverz\.[a-zA-Z.]{2,}/gi, email);
    out = out.replace(/flowdoverz\$\{[^}]+\}@gmail\.com/gi, email);
    out = out.replace(/["']flowdoverz["']\s*\+\s*\w+\s*\+\s*["']@gmail\.com["']/g, emailJson);
    out = out.replace(
      /function emailFromIndex\s*\(\s*\w*\s*\)\s*\{[\s\S]*?\n  \}/,
      `function emailFromIndex(_n) {\n    return ${emailJson};\n  }`,
    );
    out = out.replace(/let fakeEmail\s*=\s*(['"`])[\s\S]*?\1/, `let fakeEmail = ${emailJson}`);
  }
  return out;
}

function overlayFileName(path: string) {
  const base = path.split("/").pop() || path;
  return EMAIL_OVERLAY_FILES.has(base);
}

function collectIconPaths(manifest: Record<string, unknown>) {
  const paths = new Set<string>([
    "logo.png",
    "logo-mark.svg",
    "icon16.png",
    "icon32.png",
    "icon48.png",
    "icon128.png",
  ]);
  const add = (value: unknown) => {
    if (typeof value === "string" && value.trim()) paths.add(value.replace(/^\.\//, "").trim());
    if (value && typeof value === "object") {
      for (const item of Object.values(value as Record<string, unknown>)) add(item);
    }
  };
  add(manifest.icons);
  add((manifest.action as Record<string, unknown> | undefined)?.default_icon);
  add((manifest.browser_action as Record<string, unknown> | undefined)?.default_icon);
  return [...paths];
}

function parseLogoInput(base64: string | undefined, mime: string | undefined) {
  const raw = String(base64 || "").trim();
  if (!raw) return null;
  let type = String(mime || "image/png").toLowerCase();
  let payload = raw;
  const comma = raw.indexOf(",");
  if (/^data:image\//i.test(raw) && comma > 0) {
    const header = raw.slice(5, comma).toLowerCase();
    type = header.split(";")[0] || type;
    payload = raw.slice(comma + 1);
  }
  payload = payload.replace(/\s+/g, "");
  if (type === "image/jpg" || type === "image/pjpeg") type = "image/jpeg";
  if (type === "image/x-png") type = "image/png";
  if (type.startsWith("image/svg")) type = "image/svg+xml";
  const buffer = Buffer.from(payload, "base64");
  if (!buffer.length) throw new Error("Logo file could not be read.");
  if (buffer.length > MAX_LOGO_BYTES) throw new Error("Logo is too large. Use a PNG or JPG under 400 KB.");
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(type)) {
    throw new Error("Upload a PNG, JPG, WEBP, or SVG logo.");
  }
  return { buffer, mime: type, base64: buffer.toString("base64") };
}

function rasterAsSvg(buffer: Buffer, mime: string) {
  const href = `data:${mime};base64,${buffer.toString("base64")}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="128" height="128" viewBox="0 0 128 128" preserveAspectRatio="xMidYMid meet">
  <image width="128" height="128" href="${href}" xlink:href="${href}"/>
</svg>
`;
}

function isImageFile(path: string) {
  const base = path.split("/").pop() || path;
  return BRAND_IMAGE_FILE.test(base);
}

function zipFolderOf(path: string) {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(0, slash + 1) : "";
}

function looksLikeBrandSvg(svg: string) {
  return /fd-flow|fd-play|fd-node|fd-text|logo-mark|headerLogo|Flow[\s-]*Doverz|L16 14L16 34L32 24|L16 34L32 24|viewBox=["']0 0 48 48["']|aria-label=/i.test(
    svg,
  );
}

function rewriteLogoRefs(text: string, logoFile: string, dataUrl: string) {
  let out = String(text || "");
  const logoJson = JSON.stringify(logoFile);
  out = out.replace(/logo-mark\.svg/gi, logoFile);
  out = out.replace(/logo\.svg/gi, logoFile);
  out = out.replace(/headerLogo\.src\s*=\s*[^;]+;/g, `headerLogo.src = chrome.runtime.getURL(${logoJson});`);
  out = out.replace(
    /brand_logoUrl:\s*data\.branding\?\.logo_url\s*\|\|\s*(['"`])[\s\S]*?\1/g,
    `brand_logoUrl: chrome.runtime.getURL(${logoJson})`,
  );
  out = out.replace(
    /brand_logoUrl:\s*data\.branding\?\.logo_url\s*\|\|\s*["']["']/g,
    `brand_logoUrl: chrome.runtime.getURL(${logoJson})`,
  );
  if (!/\bBRAND_LOGO_FILE\b/.test(out) && /const DEFAULT_PORTAL_URL\s*=/.test(out)) {
    out = out.replace(
      /^([ \t]*)const DEFAULT_PORTAL_URL\s*=\s*(['"])[^'"]*\2\s*;/m,
      (full, indent: string) => `${full}\n${indent}const BRAND_LOGO_FILE = ${logoJson};`,
    );
  }
  if (!/\bBRAND_LOGO_FILE\b/.test(out) && /function applyBranding\s*\(/.test(out)) {
    out = `const BRAND_LOGO_FILE = ${logoJson};\n${out}`;
  }
  out = out.replace(/(src|href)=(["'])([^"']*(?:logo|icon|mark|brand)[^"']*\.(?:svg|png|jpe?g|webp|gif))\2/gi, `$1=$2${logoFile}$2`);
  out = out.replace(/url\((['"]?)([^)'"]*(?:logo|icon|mark|brand)[^)'"]*\.(?:svg|png|jpe?g|webp|gif))\1\)/gi, `url($1${logoFile}$1)`);
  out = out.replace(/chrome\.runtime\.getURL\(\s*(['"])([^'"]*(?:logo|icon|mark)[^'"]*)\1\s*\)/gi, `chrome.runtime.getURL($1${logoFile}$1)`);
  out = out.replace(/<svg\b[\s\S]*?<\/svg>/gi, (svg) => {
    if (svg.length > 20_000 || !looksLikeBrandSvg(svg)) return svg;
    return `<img src="${logoFile}" alt="" class="brand-logo" width="32" height="32" style="width:32px;height:32px;object-fit:contain"/>`;
  });
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/src=["']https?:/i.test(tag)) return tag;
    if (!/src\s*=/i.test(tag)) return tag;
    if (!/logo|icon|mark|brand|header|src=["'][^"']*\.(?:svg|png|jpe?g|webp|gif)["']/i.test(tag)) return tag;
    return tag.replace(/src=(["'])[^"']*\1/i, `src=$1${logoFile}$1`);
  });
  if (dataUrl) {
    out = out.replace(/data:image\/svg\+xml[^"' )]+/gi, (value) => {
      try {
        return looksLikeBrandSvg(decodeURIComponent(value)) ? dataUrl : value;
      } catch {
        return value;
      }
    });
    out = out.replace(/data:image\/(?:png|jpeg|jpg|webp);base64,[a-zA-Z0-9+/=]+/gi, (value) => {
      if (/logo|icon|mark|brand/i.test(value.slice(0, 80))) return dataUrl;
      return value;
    });
  }
  return out;
}

async function applyLogoToZip(
  zip: JSZip,
  logo: { buffer: Buffer; mime: string },
  manifest: Record<string, unknown>,
) {
  const raster = logo.mime !== "image/svg+xml";
  const svgBytes = raster ? Buffer.from(rasterAsSvg(logo.buffer, logo.mime), "utf8") : logo.buffer;
  const rasterBytes = raster ? logo.buffer : null;
  const dataUrl = `data:${logo.mime};base64,${logo.buffer.toString("base64")}`;
  const logoFile = raster ? "logo.png" : "logo.svg";

  const dirs = new Set<string>([""]);
  for (const file of Object.values(zip.files)) {
    if (file.dir) continue;
    if (file.name.startsWith("__MACOSX") || file.name.split("/").some((part) => part.startsWith("."))) continue;
    dirs.add(zipFolderOf(file.name));
    if (!isImageFile(file.name)) continue;
    if (/\.svg$/i.test(file.name)) {
      zip.file(file.name, svgBytes);
    } else if (rasterBytes) {
      writeZipBytes(zip, file.name, rasterBytes);
    }
  }

  const manifestEntry = zipEntry(zip, "manifest.json");
  const manifestDir = manifestEntry ? zipFolderOf(manifestEntry.name) : "";
  dirs.add(manifestDir);
  const popup = zipEntry(zip, "popup.html");
  const popupDir = popup ? zipFolderOf(popup.name) : manifestDir;
  dirs.add(popupDir);

  if (rasterBytes) {
    for (const dir of dirs) {
      writeZipBytes(zip, `${dir}${logoFile}`, rasterBytes);
    }
  } else {
    for (const dir of dirs) {
      zip.file(`${dir}${logoFile}`, svgBytes);
    }
  }

  const iconPath = logoFile;
  manifest.icons = { "16": iconPath, "32": iconPath, "48": iconPath, "128": iconPath };
  const action = (manifest.action || manifest.browser_action) as Record<string, unknown> | undefined;
  if (action && typeof action === "object") {
    action.default_icon = manifest.icons;
  }

  for (const file of Object.values(zip.files)) {
    if (file.dir) continue;
    if (fileBaseName(file.name) === "brand-runtime.js") continue;
    if (!/\.(html|htm|css|js|mjs|cjs|json)$/i.test(file.name)) continue;
    let text = rewriteLogoRefs(await file.async("string"), logoFile, dataUrl);
    if (/\.html?$/i.test(file.name)) {
      text = text.replace(/(src|href)=(["'])(?!https?:|data:|chrome)([^"']+\.(?:svg|png|jpe?g|webp|gif))\2/gi, `$1=$2${logoFile}$2`);
    }
    zip.file(file.name, text);
  }

  const popupAfter = zipEntry(zip, "popup.html");
  if (popupAfter) {
    let html = await popupAfter.async("string");
    const img = `<img src="${logoFile}" alt="" class="brand-logo" width="36" height="36" style="width:36px;height:36px;object-fit:contain"/>`;
    html = html.replace(/<svg\b[\s\S]*?<\/svg>/gi, (svg) => {
      if (!looksLikeBrandSvg(svg)) return svg;
      return img;
    });
    html = html.replace(/<img\b[^>]*>/gi, (tag) => {
      if (/src=["']https?:/i.test(tag)) return tag;
      if (!/src\s*=/i.test(tag)) return tag;
      if (!/headerLogo|logo|icon|mark|brand/i.test(tag)) return tag;
      return tag.replace(/src=(["'])[^"']*\1/i, `src=$1${logoFile}$1`);
    });
    zip.file(popupAfter.name, html);
  }
}

function pickInputString(input: Record<string, unknown> | undefined, keys: string[]) {
  if (!input) return "";
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.trim() && wanted.has(key.toLowerCase())) return value.trim();
  }
  return "";
}

function pickLogoFromUnknown(input: Record<string, unknown> | undefined) {
  const direct = pickInputString(input, ["logoBase64", "logoDataUrl", "logo"]);
  if (direct.startsWith("data:image") || /^[a-zA-Z0-9+/_=-]{80,}$/.test(direct)) return direct;
  if (!input) return "";
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string" || !value.trim()) continue;
    if (/logo/i.test(key) && (value.includes("base64") || value.startsWith("data:image"))) return value.trim();
  }
  return "";
}

function writeZipBytes(zip: JSZip, path: string, bytes: Buffer) {
  zip.file(path, Uint8Array.from(bytes), { binary: true });
}

async function brandOfficialZip(
  officialBuffer: Buffer,
  branding: {
    displayName: string;
    supportEmail: string;
    websiteUrl?: string;
    dashboardUrl?: string;
    loginUrl?: string;
    logo?: { buffer: Buffer; mime: string } | null;
    version: string;
    primaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    labelColor?: string;
    onPrimaryColor?: string;
  },
) {
  const zip = await JSZip.loadAsync(officialBuffer);
  const entry = zipEntry(zip, "manifest.json");
  if (!entry) throw new Error("Official ZIP is missing manifest.json.");
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(await entry.async("string")) as Record<string, unknown>;
  } catch {
    throw new Error("Official ZIP manifest.json is invalid.");
  }

  const name = String(branding.displayName || "").trim().slice(0, 75);
  if (name.length < 2) throw new Error("Enter the name that should replace FlowDoverz in the extension.");
  const email = String(branding.supportEmail || "").trim().toLowerCase();
  if (email && !email.includes("@")) throw new Error("Enter a valid support email.");
  const websiteUrl = normalizePublicUrl(String(branding.websiteUrl || ""));
  const dashboardUrl =
    normalizePublicUrl(String(branding.dashboardUrl || "")) || websiteUrl || getResellerUrl();
  const loginUrl = normalizePublicUrl(String(branding.loginUrl || "")) || dashboardUrl;
  const portalOrigin = portalOriginFromUrl(loginUrl || dashboardUrl);
  const appUrl = getPublicAppUrl();
  const syncOrigin = portalOriginFromUrl(appUrl) || appUrl.replace(/\/$/, "");
  const appOrigin = syncOrigin;
  const primaryColor = normalizeHexColor(String(branding.primaryColor || ""), DEFAULT_BRAND_PRIMARY);
  const accentColor = normalizeHexColor(String(branding.accentColor || ""), DEFAULT_BRAND_ACCENT);
  const backgroundColor = normalizeHexColor(String(branding.backgroundColor || ""), DEFAULT_BRAND_BG);
  const labelColor = normalizeHexColor(String(branding.labelColor || ""), DEFAULT_BRAND_LABEL);
  const onPrimaryColor = normalizeHexColor(String(branding.onPrimaryColor || ""), DEFAULT_BRAND_ON_PRIMARY);
  const theme = {
    bg: backgroundColor,
    panel: backgroundColor === DEFAULT_BRAND_BG ? "#0c0e16" : backgroundColor,
    primary: primaryColor,
    primaryDark: darkenHex(primaryColor),
    accent: accentColor,
    label: labelColor,
    onPrimary: onPrimaryColor,
  };

  for (const file of Object.values(zip.files)) {
    if (file.dir) continue;
    if (fileBaseName(file.name) === "brand-runtime.js") continue;
    if (file.name.startsWith("__MACOSX") || file.name.split("/").some((part) => part.startsWith("."))) continue;
    if (branding.logo?.buffer && isImageFile(file.name)) continue;
    if (!TEXT_FILE.test(file.name)) continue;
    let text = await file.async("string");
    text = replaceVisibleBrand(text, name);
    if (email && overlayFileName(file.name)) {
      text = replaceVisibleEmails(text, email);
    }
    text = applyBrandIdentity(text, name, email);
    text = appendBrandedPortalLock(
      text,
      file.name,
      portalOrigin,
      appOrigin,
      loginUrl,
    );
    text = rewritePortalBridgePositiveOnly(text, file.name);
    text = rewritePortalBridgeOrigin(text, file.name, portalOrigin || appOrigin);
    text = rewriteDashboardOpen(text, dashboardUrl);
    text = rewriteSyncTimeoutCopy(text);
    text = replaceDashboardUrls(text, dashboardUrl, appUrl);
    text = wireBrandRuntimeLoader(text, file.name);
    text = applyBrandTheme(text, file.name, theme);
    zip.file(file.name, text);
  }

  const manifestEntry = zipEntry(zip, "manifest.json");
  if (!manifestEntry) throw new Error("Official ZIP is missing manifest.json after branding.");
  try {
    manifest = JSON.parse(await manifestEntry.async("string")) as Record<string, unknown>;
  } catch {
    throw new Error("Branded manifest.json is invalid.");
  }
  manifest.name = name;
  manifest.short_name = chromeShortName(name);
  manifest.description = `${name} helper for Google Flow.`;
  if (loginUrl) {
    manifest.homepage_url = loginUrl;
  }
  ensurePortalHostAccess(manifest, [portalOrigin, syncOrigin]);
  if (branding.version) {
    manifest.version = branding.version;
    manifest.version_name = branding.version;
  }
  if (branding.logo?.buffer) {
    await applyLogoToZip(zip, branding.logo, manifest);
  }
  zip.file(
    "brand-runtime.js",
    brandRuntimeSource({
      siteName: name,
      supportEmail: email,
      loginUrl,
      dashboardUrl,
      cookieOrigin: portalOrigin,
      syncOrigin,
      primaryColor,
      accentColor,
      backgroundColor,
      labelColor,
      onPrimaryColor,
    }),
  );
  zip.file(manifestEntry.name, `${JSON.stringify(manifest, null, 2)}\n`);

  return Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    }),
  );
}

async function savedBrandingFor(resellerId: string) {
  const db = getDb();
  if (!db) return null;
  const brandingSnap = await db.collection(BRANDING_COLLECTION).doc(resellerId).get();
  const packSnap = await db.collection(PACKS_COLLECTION).doc(resellerId).get();
  const branding = (brandingSnap.exists ? brandingSnap.data() : {}) as Record<string, unknown>;
  const pack = (packSnap.exists ? packSnap.data() : {}) as Record<string, unknown>;
  const displayName = String(branding.displayName || pack.displayName || "");
  const supportEmail = String(branding.supportEmail || pack.supportEmail || "");
  const dashboardUrl = String(branding.dashboardUrl || pack.dashboardUrl || "");
  const loginUrl = String(branding.loginUrl || pack.loginUrl || dashboardUrl);
  const { loadResellerLogo } = await import("./reseller-pack-storage");
  const logoLoaded = await loadResellerLogo({
    logoBase64: branding.logoBase64 || pack.logoBase64,
    logoStoragePath: branding.logoStoragePath || pack.logoStoragePath,
    logoMime: branding.logoMime || pack.logoMime,
  });
  const logoBase64 = logoLoaded?.base64 || "";
  const logoMime = logoLoaded?.mime || String(branding.logoMime || pack.logoMime || "image/png");
  if (!displayName && !supportEmail && !logoBase64 && !dashboardUrl && !loginUrl) return null;
  return {
    displayName,
    supportEmail,
    dashboardUrl,
    loginUrl,
    logoBase64,
    logoMime,
    logoStoragePath: String(branding.logoStoragePath || pack.logoStoragePath || ""),
    primaryColor: String(branding.primaryColor || pack.primaryColor || ""),
    accentColor: String(branding.accentColor || pack.accentColor || ""),
    backgroundColor: String(branding.backgroundColor || pack.backgroundColor || ""),
    labelColor: String(branding.labelColor || pack.labelColor || ""),
    onPrimaryColor: String(branding.onPrimaryColor || pack.onPrimaryColor || ""),
  };
}

export async function getResellerExtensionPack(resellerId: string): Promise<ResellerExtensionPack | null> {
  const id = String(resellerId || "").trim();
  if (!id) return null;
  const db = getDb();
  if (!db) return null;
  const packSnap = await db.collection(PACKS_COLLECTION).doc(id).get();
  if (!packSnap.exists) return null;
  const packData = (packSnap.data() || {}) as Record<string, unknown>;
  const meta = asResellerPackMeta(id, packData);
  const { loadResellerPackZip } = await import("./reseller-pack-storage");
  const buffer = await loadResellerPackZip(packData);
  if (!meta || !buffer) return null;

  let profile: OfficialIntegrityProfile | null = null;
  const integritySnap = await db.collection(INTEGRITY_COLLECTION).doc(id).get();
  if (integritySnap.exists) {
    const data = integritySnap.data() as Partial<OfficialIntegrityProfile>;
    if (data.hash && data.payload && data.attestation) {
      profile = data as OfficialIntegrityProfile;
    }
  }
  if (!profile) return null;

  return {
    ...meta,
    buffer,
    profile,
  };
}

async function saveResellerBrandedMeta(
  resellerId: string,
  meta: Pick<
    ResellerExtensionMeta,
    "version" | "fileName" | "generatedAt" | "displayName" | "officialVersion" | "supportEmail" | "dashboardUrl" | "loginUrl" | "hasLogo"
  > & {
    primaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    labelColor?: string;
    onPrimaryColor?: string;
  },
) {
  const db = requireDb();
  await db.collection("resellers").doc(resellerId).set(
    sanitizeForFirestore({
      brandedExtension: {
        version: meta.version,
        fileName: meta.fileName,
        generatedAt: meta.generatedAt,
        displayName: meta.displayName,
        officialVersion: meta.officialVersion,
        supportEmail: meta.supportEmail,
        dashboardUrl: meta.dashboardUrl || "",
        loginUrl: meta.loginUrl || meta.dashboardUrl || "",
        hasLogo: meta.hasLogo,
        primaryColor: meta.primaryColor || "",
        accentColor: meta.accentColor || "",
        backgroundColor: meta.backgroundColor || "",
        labelColor: meta.labelColor || "",
        onPrimaryColor: meta.onPrimaryColor || "",
      },
      updatedAt: new Date().toISOString(),
    }),
    { merge: true },
  );
}

export async function generateResellerExtensionPack(
  resellerId: string,
  input?: Partial<ResellerExtensionBranding>,
): Promise<{
  meta: ResellerExtensionMeta;
  downloadUrl: string;
}> {
  const reseller = await getReseller(resellerId);
  if (!reseller) throw new Error("Reseller not found.");
  if (reseller.kind !== "white_label" && reseller.kind !== "official") {
    throw new Error("Reseller not found.");
  }

  const saved = await savedBrandingFor(reseller.id);
  const inputRec = (input || {}) as Record<string, unknown>;
  const displayName = String(
    pickInputString(inputRec, ["displayName"]) || saved?.displayName || reseller.brandName || "",
  ).trim();
  if (displayName.length < 2) throw new Error("Enter the name that should appear on the extension.");
  const supportEmail = String(
    pickInputString(inputRec, ["supportEmail"]) || saved?.supportEmail || reseller.contactEmail || "",
  ).trim().toLowerCase();
  if (supportEmail && !supportEmail.includes("@")) throw new Error("Enter a valid support email.");
  const appBase = getPublicAppUrl().replace(/\/$/, "");
  const defaultLoginUrl = `${appBase}/login`;
  const defaultDashboardUrl = `${appBase}/dashboard`;
  const loginUrl = normalizePublicUrl(
    pickInputString(inputRec, ["loginUrl", "clientLoginUrl", "signinUrl", "signInUrl"]) ||
      saved?.loginUrl ||
      pickInputString(inputRec, ["dashboardUrl", "dashboardLink"]) ||
      saved?.dashboardUrl ||
      reseller.websiteUrl ||
      (reseller.kind === "official" ? defaultLoginUrl : ""),
  );
  if (!loginUrl) {
    throw new Error("Enter the client sign-in page. Example: https://their-site.vercel.app/painel");
  }
  const dashboardFromInput = pickInputString(inputRec, ["dashboardUrl", "dashboardLink"]);
  const dashboardUrl =
    normalizePublicUrl(dashboardFromInput) ||
    (input && ("dashboardUrl" in inputRec || "dashboardLink" in inputRec)
      ? loginUrl
      : normalizePublicUrl(String(saved?.dashboardUrl || "")) ||
        (reseller.kind === "official" ? defaultDashboardUrl : "") ||
        loginUrl);

  const keepLogo = input?.keepLogo !== false && inputRec.keepLogo !== "false";
  const primaryColor = normalizeHexColor(
    pickInputString(inputRec, ["primaryColor", "buttonColor"]) || saved?.primaryColor || "",
    DEFAULT_BRAND_PRIMARY,
  );
  const accentColor = normalizeHexColor(
    pickInputString(inputRec, ["accentColor", "sessionColor"]) || saved?.accentColor || "",
    DEFAULT_BRAND_ACCENT,
  );
  const backgroundColor = normalizeHexColor(
    pickInputString(inputRec, ["backgroundColor", "bgColor"]) || saved?.backgroundColor || "",
    DEFAULT_BRAND_BG,
  );
  const labelColor = normalizeHexColor(
    pickInputString(inputRec, ["labelColor", "textColor"]) || saved?.labelColor || "",
    DEFAULT_BRAND_LABEL,
  );
  const onPrimaryColor = normalizeHexColor(
    pickInputString(inputRec, ["onPrimaryColor", "buttonTextColor"]) || saved?.onPrimaryColor || "",
    DEFAULT_BRAND_ON_PRIMARY,
  );
  let logo = parseLogoInput(
    pickLogoFromUnknown(inputRec) || input?.logoBase64,
    pickInputString(inputRec, ["logoMime"]) || input?.logoMime,
  );
  if (!logo && keepLogo && saved?.logoBase64) {
    logo = parseLogoInput(saved.logoBase64, saved.logoMime);
  }
  if (!logo) {
    throw new Error("Upload a logo image. It replaces the FlowDoverz icons in the popup and in Chrome.");
  }

  const official = await getActiveExtensionDownload();
  if (!official?.buffer) {
    throw new Error("Upload the official FlowDoverz extension ZIP in Admin → Extension first.");
  }
  const version = String(official.release?.version || official.config.activeVersion || "").trim();
  if (!version) throw new Error("The official extension has no active version yet.");

  const branded = await brandOfficialZip(official.buffer, {
    displayName,
    supportEmail,
    websiteUrl: String(reseller.websiteUrl || ""),
    dashboardUrl,
    loginUrl,
    logo,
    version,
    primaryColor,
    accentColor,
    backgroundColor,
    labelColor,
    onPrimaryColor,
  });
  const sealed = await sealOfficialExtensionZip(branded, { version });
  if (sealed.zipBuffer.length > MAX_ZIP_BYTES) {
    throw new Error("Branded ZIP is too large to store. Upload a smaller official extension first.");
  }

  const existing = await getResellerExtensionPackMeta(reseller.id);
  const previousHashes = rotateHashes(existing?.previousHashes, existing?.hash, sealed.profile.hash);
  const generatedAt = new Date().toISOString();
  const fileName = `${slugifyBrand(displayName)}-extension-${version}.zip`;
  const meta: ResellerExtensionMeta = {
    resellerId: reseller.id,
    brandName: String(reseller.brandName || displayName),
    displayName: displayName.slice(0, 75),
    supportEmail,
    dashboardUrl,
    loginUrl,
    hasLogo: Boolean(logo),
    version,
    officialVersion: version,
    hash: sealed.profile.hash.toLowerCase(),
    fileName,
    fileSize: sealed.zipBuffer.length,
    generatedAt,
    previousHashes,
  };

  const db = requireDb();
  const {
    shouldStoreResellerPackInStorage,
    saveResellerPackZip,
    saveResellerLogo,
    deleteResellerPackStorage,
  } = await import("./reseller-pack-storage");
  const existingPackSnap = await db.collection(PACKS_COLLECTION).doc(reseller.id).get();
  const existingBrandingSnap = await db.collection(BRANDING_COLLECTION).doc(reseller.id).get();
  const existingPack = (existingPackSnap.data() || {}) as Record<string, unknown>;
  const existingBranding = (existingBrandingSnap.data() || {}) as Record<string, unknown>;

  const brandingPayload: Record<string, unknown> = {
    displayName: meta.displayName,
    supportEmail,
    dashboardUrl,
    loginUrl,
    primaryColor,
    accentColor,
    backgroundColor,
    labelColor,
    onPrimaryColor,
    updatedAt: generatedAt,
  };

  if (shouldStoreResellerPackInStorage()) {
    if (logo?.base64) {
      brandingPayload.logoStoragePath = await saveResellerLogo(
        reseller.id,
        Buffer.from(logo.base64, "base64"),
        logo.mime,
      );
      brandingPayload.logoMime = logo.mime;
      brandingPayload.hasLogo = true;
    } else if (keepLogo && saved?.logoStoragePath) {
      brandingPayload.logoStoragePath = saved.logoStoragePath;
      brandingPayload.logoMime = saved.logoMime || "image/jpeg";
      brandingPayload.hasLogo = true;
    } else if (keepLogo && saved?.logoBase64) {
      brandingPayload.logoStoragePath = await saveResellerLogo(
        reseller.id,
        Buffer.from(saved.logoBase64, "base64"),
        saved.logoMime || "image/png",
      );
      brandingPayload.logoMime = saved.logoMime || "image/png";
      brandingPayload.hasLogo = true;
    } else {
      brandingPayload.hasLogo = false;
    }
  } else if (logo?.base64) {
    brandingPayload.logoBase64 = logo.base64;
    brandingPayload.logoMime = logo.mime;
    brandingPayload.hasLogo = true;
  } else if (keepLogo && saved?.logoBase64) {
    brandingPayload.logoBase64 = saved.logoBase64;
    brandingPayload.logoMime = saved.logoMime || "image/png";
    brandingPayload.hasLogo = true;
  } else {
    brandingPayload.hasLogo = false;
  }

  const packPayload: Record<string, unknown> = {
    ...meta,
    primaryColor,
    accentColor,
    backgroundColor,
    labelColor,
    onPrimaryColor,
  };

  try {
    await deleteResellerPackStorage(existingPack, existingBranding);

    if (shouldStoreResellerPackInStorage()) {
      packPayload.storagePath = await saveResellerPackZip(reseller.id, sealed.zipBuffer);
    } else {
      packPayload.zipBase64 = sealed.zipBuffer.toString("base64");
    }

    await db.collection(BRANDING_COLLECTION).doc(reseller.id).set(sanitizeForFirestore(brandingPayload));
    await db.collection(PACKS_COLLECTION).doc(reseller.id).set(sanitizeForFirestore(packPayload));
    await db.collection(INTEGRITY_COLLECTION).doc(reseller.id).set(sanitizeForFirestore(sealed.profile));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (/exceeds the maximum allowed size|INVALID_ARGUMENT|too large/i.test(message)) {
      throw new Error("Branded ZIP is too large for the database. Use a smaller logo or official ZIP.");
    }
    throw error;
  }

  await saveResellerBrandedMeta(reseller.id, {
    ...meta,
    primaryColor,
    accentColor,
    backgroundColor,
    labelColor,
    onPrimaryColor,
  });
  const siteOrigin = portalOriginFromUrl(loginUrl);
  if (siteOrigin) {
    const websiteUrl = String(reseller.websiteUrl || "").trim() || siteOrigin;
    const allowedOrigins = normalizeOriginList([...(reseller.allowedOrigins || []), siteOrigin], websiteUrl);
    await db.collection("resellers").doc(reseller.id).set(
      sanitizeForFirestore({
        websiteUrl,
        allowedOrigins,
        updatedAt: generatedAt,
      }),
      { merge: true },
    );
  }
  const { touchLive } = await import("./live-tick");
  void touchLive({ topic: "reseller", action: "updated", id: reseller.id });
  void touchLive({ topic: "extension", action: "updated", id: reseller.id });

  return { meta, downloadUrl: brandedExtensionDownloadUrl(reseller.id) };
}

export async function rebuildResellerExtensionPacks() {
  const db = getDb();
  if (!db) return { rebuilt: 0, failed: 0, errors: [] as string[] };

  const targetIds = new Set<string>();
  const [packSnap, brandingSnap] = await Promise.all([
    db.collection(PACKS_COLLECTION).get(),
    db.collection(BRANDING_COLLECTION).get(),
  ]);
  for (const doc of packSnap.docs) targetIds.add(doc.id);
  for (const doc of brandingSnap.docs) targetIds.add(doc.id);

  const { listResellers } = await import("./reseller-store");
  const rows = await listResellers();
  for (const row of rows) {
    if (row.kind !== "white_label" && row.kind !== "official") continue;
    const branded = row.brandedExtension;
    if (!branded?.displayName && !branded?.loginUrl && !branded?.hasLogo) continue;
    targetIds.add(row.id);
  }

  let rebuilt = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const id of targetIds) {
    try {
      await generateResellerExtensionPack(id);
      rebuilt += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${id}: ${message}`);
      console.warn(`Failed to rebuild branded extension for ${id}:`, error);
    }
  }
  return { rebuilt, failed, errors };
}

export async function deleteResellerExtensionPack(resellerId: string) {
  const id = String(resellerId || "").trim();
  if (!id) return;
  const db = getDb();
  if (!db) return;

  const packSnap = await db.collection(PACKS_COLLECTION).doc(id).get();
  const brandingSnap = await db.collection(BRANDING_COLLECTION).doc(id).get();
  const { deleteResellerPackStorage } = await import("./reseller-pack-storage");
  await deleteResellerPackStorage(
    (packSnap.data() || {}) as Record<string, unknown>,
    (brandingSnap.data() || {}) as Record<string, unknown>,
  );

  await db.collection(PACKS_COLLECTION).doc(id).delete().catch(() => undefined);
  await db.collection(INTEGRITY_COLLECTION).doc(id).delete().catch(() => undefined);
  await db.collection(BRANDING_COLLECTION).doc(id).delete().catch(() => undefined);
}
