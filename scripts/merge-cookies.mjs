import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const DROP_COOKIE_NAMES = new Set([
  "__Secure-next-auth.pkce.code_verifier",
  "__Secure-next-auth.state",
]);

const HOST_SESSION_NAMES = new Set(["OSID", "__Secure-OSID"]);
const FLOW_HOSTS = ["flow.google.com", "labs.google.com"];

function cookieKeyParts(name, domain, path = "/") {
  return `${name}@${domain}@${path}`;
}

function cookieKey(cookie) {
  return cookieKeyParts(cookie.name, cookie.domain || "", cookie.path || "/");
}

function hostFromDomain(domain) {
  if (!domain) return null;
  return domain.replace(/^\./, "").toLowerCase() || null;
}

function cloneForHost(cookie, host) {
  const cloned = { ...cookie, domain: host, hostOnly: true, url: `https://${host}/` };
  if (cookie.name.startsWith("__Secure-") || cookie.secure) cloned.secure = true;
  if (cookie.name === "__Secure-OSID" && !cloned.sameSite) cloned.sameSite = "no_restriction";
  return cloned;
}

function normalizeFlowCookies(cookies) {
  const filtered = cookies.filter((c) => !DROP_COOKIE_NAMES.has(c.name));
  const byKey = new Map();
  for (const cookie of filtered) byKey.set(cookieKey(cookie), cookie);

  for (const name of HOST_SESSION_NAMES) {
    const flowKey = cookieKeyParts(name, "flow.google.com");
    const labsKey = cookieKeyParts(name, "labs.google");
    const flowCookie = byKey.get(flowKey);
    const labsCookie = byKey.get(labsKey);
    if (flowCookie && labsCookie && flowCookie.value !== labsCookie.value) {
      byKey.set(labsKey, cloneForHost(flowCookie, "labs.google"));
    }
  }

  const result = [...byKey.values()];
  const seen = new Set(byKey.keys());

  for (const cookie of [...result]) {
    if (!HOST_SESSION_NAMES.has(cookie.name)) continue;
    const sourceHost = hostFromDomain(cookie.domain);
    if (!sourceHost || !FLOW_HOSTS.includes(sourceHost)) continue;
    for (const targetHost of FLOW_HOSTS) {
      if (targetHost === sourceHost) continue;
      const mirrored = cloneForHost(cookie, targetHost);
      const key = cookieKey(mirrored);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(mirrored);
    }
  }

  return result;
}

function mergeExports(...arrays) {
  const byKey = new Map();
  for (const arr of arrays) {
    for (const cookie of arr) {
      byKey.set(cookieKey(cookie), cookie);
    }
  }
  return [...byKey.values()];
}

function osidPrefix(value) {
  if (!value || value.length < 20) return value?.slice(0, 12) ?? "?";
  return `${value.slice(0, 16)}…`;
}

function analyze(cookies) {
  const byHost = {};
  for (const c of cookies) {
    const h = hostFromDomain(c.domain) || c.domain || "?";
    byHost[h] = (byHost[h] || 0) + 1;
  }
  const flowOsid = cookies.find((c) => c.name === "OSID" && hostFromDomain(c.domain) === "flow.google.com");
  const labsOsid = cookies.find((c) => c.name === "OSID" && hostFromDomain(c.domain) === "labs.google");
  const nextAuth = cookies.find((c) => c.name.includes("next-auth.session-token"));
  const psid = cookies.find((c) => c.name === "__Secure-1PSID");

  return {
    total: cookies.length,
    byHost,
    hasPsid: Boolean(psid),
    hasNextAuth: Boolean(nextAuth),
    nextAuthExpiry: nextAuth?.expirationDate ?? "session",
    flowOsidPrefix: flowOsid ? osidPrefix(flowOsid.value) : null,
    labsOsidPrefix: labsOsid ? osidPrefix(labsOsid.value) : null,
    osidMatch: flowOsid && labsOsid ? flowOsid.value === labsOsid.value : null,
    cookieNames: cookies.map((c) => `${c.name}@${hostFromDomain(c.domain)}`).sort(),
  };
}

const google = JSON.parse(readFileSync(join(root, "cookies-export-google.json"), "utf8"));
const flow = JSON.parse(readFileSync(join(root, "cookies-export-flow.json"), "utf8"));
const labs = JSON.parse(readFileSync(join(root, "cookies-export-labs.json"), "utf8"));

const rawMerged = mergeExports(google, flow, labs);
const normalized = normalizeFlowCookies(rawMerged);
const summary = analyze(normalized);

writeFileSync(join(root, "cookies-merged-C1.json"), JSON.stringify(normalized, null, 2), "utf8");
writeFileSync(
  join(root, "cookies-merged-C1-summary.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sources: {
        google: google.length,
        flow: flow.length,
        labs: labs.length,
        rawMerged: rawMerged.length,
        afterNormalize: normalized.length,
      },
      ...summary,
    },
    null,
    2,
  ),
  "utf8",
);

console.log("Merged → cookies-merged-C1.json");
console.log("Summary → cookies-merged-C1-summary.json");
console.log(JSON.stringify(summary, null, 2));
