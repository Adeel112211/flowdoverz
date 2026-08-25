import JSZip from "jszip";
import { getDb } from "@/lib/firebase-admin";
import { sanitizeForFirestore } from "@/lib/cookie-store";
import { getReseller } from "@/lib/reseller-store";
import { getActiveExtensionDownload } from "@/lib/extension-store";
import { sealOfficialExtensionZip, type OfficialIntegrityProfile } from "@/lib/extension-official-from-zip";
import { getAppUrl, getResellerUrl } from "@/lib/site-urls";
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
  logoBase64?: string;
  logoMime?: string;
  keepLogo?: boolean;
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
  return String(text || "")
    .replace(/Flow[\s-]*Doverz/g, name)
    .replace(/FLOW[\s-]*DOVERZ(?!_)/g, name.toUpperCase())
    .replace(/Google Flow Workspace/gi, `${name} workspace`)
    .replace(/GOOGLE FLOW WORKSPACE/g, `${name.toUpperCase()} WORKSPACE`);
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
    return full.replace(/\/+(login|signup|dashboard)\/?$/i, "").replace(/\/$/, "");
  }
}

/**
 * Branded ZIP: Sync and login run on the reseller website, not flow.doverz.com.
 */
function rewritePortalOrigin(text: string, portalOrigin: string) {
  const origin = String(portalOrigin || "").replace(/\/$/, "");
  if (!origin) return text;
  let out = String(text || "");
  out = out.replace(
    /const DEFAULT_PORTAL_URL\s*=\s*["']https:\/\/flow\.doverz\.com["']/g,
    `const DEFAULT_PORTAL_URL = ${JSON.stringify(origin)}`,
  );
  out = out.replace(
    /const OWNER_PORTAL_URL\s*=\s*`https:\/\/\$\{\s*\[\s*"flow"\s*,\s*"doverz"\s*,\s*"com"\s*\]\s*\.join\(\s*"\."\s*\)\s*\}`\s*;?/g,
    `const OWNER_PORTAL_URL = ${JSON.stringify(origin)};`,
  );
  out = out.replace(/https:\/\/flow\.doverz\.com/g, origin);
  return out;
}

function fileBaseName(fileName: string) {
  return String(fileName || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop() || "";
}

/** Force branded builds to stay on the reseller origin even if the official ZIP is older. */
function brandedPortalLockScript(portalOrigin: string) {
  const origin = String(portalOrigin || "").replace(/\/$/, "");
  const originJson = JSON.stringify(origin);
  const loginJson = JSON.stringify(`${origin}/login`);
  return `

;/* branded-portal-lock */
async function hasPortalLoginCookie(baseUrl) {
  try {
    var target = String(baseUrl || ${originJson}).replace(/\\/+$/, "");
    var root = target.indexOf("http") === 0 ? target : ("http://" + target);
    var cookieUrl = root.charAt(root.length - 1) === "/" ? root : (root + "/");
    var cookie = await chrome.cookies.get({ url: cookieUrl, name: SESSION_COOKIE_NAME });
    if (cookie && cookie.value && cookie.value !== "admin-local") return true;
    var host = "";
    try { host = new URL(root).hostname.replace(/^www\\./, ""); } catch (_e) { return false; }
    var all = await chrome.cookies.getAll({ name: SESSION_COOKIE_NAME });
    return (all || []).some(function (item) {
      if (!item || !item.value || item.value === "admin-local") return false;
      var domain = String(item.domain || "").replace(/^\\./, "").replace(/^www\\./, "");
      return domain === host || domain.endsWith("." + host);
    });
  } catch (_error) {
    return false;
  }
}
function portalLoginUrl() {
  return ${loginJson};
}
async function resolvePortalBaseUrl(_preferred) {
  var origin = ${originJson};
  if (await hasPortalLoginCookie(origin)) {
    await chrome.storage.local.set({ portalUrl: origin });
    return origin;
  }
  return origin;
}
`;
}

function appendBrandedPortalLock(text: string, fileName: string, portalOrigin: string) {
  if (fileBaseName(fileName) !== "background.js") return text;
  const origin = String(portalOrigin || "").replace(/\/$/, "");
  if (!origin) return text;
  const stripped = String(text || "").replace(/\n;\/\* branded-portal-lock \*\/[\s\S]*$/, "");
  return stripped + brandedPortalLockScript(origin);
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
        var url = RESELLER_DASHBOARD_URL || DEFAULT_PORTAL_URL;
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
      var url = (typeof RESELLER_DASHBOARD_URL === "string" && RESELLER_DASHBOARD_URL)
        ? RESELLER_DASHBOARD_URL
        : ((currentPortalUrl || DEFAULT_PORTAL_URL).replace(/\\/+$/, "") + "/dashboard");
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
    `siteName.textContent = ${nameJson}`,
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
    logo?: { buffer: Buffer; mime: string } | null;
    version: string;
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
  const portalOrigin = portalOriginFromUrl(dashboardUrl);
  const appUrl = getAppUrl();

  for (const file of Object.values(zip.files)) {
    if (file.dir) continue;
    if (file.name.startsWith("__MACOSX") || file.name.split("/").some((part) => part.startsWith("."))) continue;
    if (branding.logo?.buffer && isImageFile(file.name)) continue;
    if (!TEXT_FILE.test(file.name)) continue;
    let text = await file.async("string");
    text = replaceVisibleBrand(text, name);
    if (email && overlayFileName(file.name)) {
      text = replaceVisibleEmails(text, email);
    }
    text = applyBrandIdentity(text, name, email);
    text = rewritePortalOrigin(text, portalOrigin);
    text = appendBrandedPortalLock(text, file.name, portalOrigin);
    text = rewriteDashboardOpen(text, dashboardUrl);
    text = replaceDashboardUrls(text, dashboardUrl, appUrl);
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
  if (dashboardUrl) {
    manifest.homepage_url = dashboardUrl;
  }
  if (portalOrigin) {
    const perms = Array.isArray(manifest.host_permissions) ? [...(manifest.host_permissions as string[])] : [];
    const perm = `${portalOrigin}/*`;
    if (!perms.includes(perm) && !perms.some((item) => item === "https://*/*" || item === "*://*/*")) {
      perms.push(perm);
      manifest.host_permissions = perms;
    }
  }
  if (branding.version) {
    manifest.version = branding.version;
    manifest.version_name = branding.version;
  }
  if (branding.logo?.buffer) {
    await applyLogoToZip(zip, branding.logo, manifest);
  }
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
  const logoBase64 = String(branding.logoBase64 || pack.logoBase64 || "");
  const logoMime = String(branding.logoMime || pack.logoMime || "image/png");
  if (!displayName && !supportEmail && !logoBase64 && !dashboardUrl) return null;
  return { displayName, supportEmail, dashboardUrl, logoBase64, logoMime };
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
  const zipBase64 = String(packData.zipBase64 || "");
  if (!meta || !zipBase64) return null;

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
    buffer: Buffer.from(zipBase64, "base64"),
    profile,
  };
}

async function saveResellerBrandedMeta(
  resellerId: string,
  meta: Pick<
    ResellerExtensionMeta,
    "version" | "fileName" | "generatedAt" | "displayName" | "officialVersion" | "supportEmail" | "dashboardUrl" | "hasLogo"
  >,
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
        hasLogo: meta.hasLogo,
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
  if (reseller.kind !== "white_label") {
    throw new Error("Branded extensions are only for white-label resellers. Official partners use the FlowDoverz ZIP.");
  }

  const saved = await savedBrandingFor(reseller.id);
  const inputRec = (input || {}) as Record<string, unknown>;
  const displayName = String(
    pickInputString(inputRec, ["displayName"]) || saved?.displayName || reseller.brandName || "",
  ).trim();
  if (displayName.length < 2) throw new Error("Enter the name that should appear on the extension.");
  const supportEmail = String(
    pickInputString(inputRec, ["supportEmail"]) || saved?.supportEmail || "",
  ).trim().toLowerCase();
  if (supportEmail && !supportEmail.includes("@")) throw new Error("Enter a valid support email.");
  const dashboardUrl = normalizePublicUrl(
    pickInputString(inputRec, ["dashboardUrl", "dashboardLink"]) ||
      saved?.dashboardUrl ||
      reseller.websiteUrl ||
      "",
  );
  if (!dashboardUrl) {
    throw new Error("Enter the dashboard link clients should open from the extension popup.");
  }

  const keepLogo = input?.keepLogo !== false && inputRec.keepLogo !== "false";
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
    logo,
    version,
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
  try {
    await db.collection(BRANDING_COLLECTION).doc(reseller.id).set(
      sanitizeForFirestore({
        displayName: meta.displayName,
        supportEmail,
        dashboardUrl,
        logoBase64: logo?.base64 || (keepLogo ? saved?.logoBase64 || "" : ""),
        logoMime: logo?.mime || (keepLogo ? saved?.logoMime || "" : ""),
        updatedAt: generatedAt,
      }),
    );
    await db.collection(PACKS_COLLECTION).doc(reseller.id).set(
      sanitizeForFirestore({
        ...meta,
        zipBase64: sealed.zipBuffer.toString("base64"),
      }),
    );
    await db.collection(INTEGRITY_COLLECTION).doc(reseller.id).set(sanitizeForFirestore(sealed.profile));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (/exceeds the maximum allowed size|INVALID_ARGUMENT|too large/i.test(message)) {
      throw new Error("Branded ZIP is too large for the database. Use a smaller logo or official ZIP.");
    }
    throw error;
  }

  await saveResellerBrandedMeta(reseller.id, meta);
  const { touchLive } = await import("./live-tick");
  void touchLive({ topic: "reseller", action: "updated", id: reseller.id });
  void touchLive({ topic: "extension", action: "updated", id: reseller.id });

  return { meta, downloadUrl: brandedExtensionDownloadUrl(reseller.id) };
}

export async function rebuildResellerExtensionPacks() {
  const db = getDb();
  if (!db) return { rebuilt: 0, failed: 0 };
  const snap = await db.collection(PACKS_COLLECTION).get();
  let rebuilt = 0;
  let failed = 0;
  for (const doc of snap.docs) {
    try {
      await generateResellerExtensionPack(doc.id);
      rebuilt += 1;
    } catch (error) {
      failed += 1;
      console.warn(`Failed to rebuild branded extension for ${doc.id}:`, error);
    }
  }
  return { rebuilt, failed };
}

export async function deleteResellerExtensionPack(resellerId: string) {
  const id = String(resellerId || "").trim();
  if (!id) return;
  const db = getDb();
  if (!db) return;
  await db.collection(PACKS_COLLECTION).doc(id).delete().catch(() => undefined);
  await db.collection(INTEGRITY_COLLECTION).doc(id).delete().catch(() => undefined);
  await db.collection(BRANDING_COLLECTION).doc(id).delete().catch(() => undefined);
}
