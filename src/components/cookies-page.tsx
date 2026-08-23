"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { subscribeLive } from "@/lib/live-client";

const SLOTS = ["C1", "C2", "C3", "C4", "C5"] as const;

type SlotInfo = {
  key: string;
  name: string;
  label?: string | null;
  has_cookies: boolean;
  updated_at: string | null;
  cookie_count?: number;
};

function cookieCoverageWarning(names: string[]): string | null {
  const set = new Set(names);
  const hasLabsSession =
    set.has("__Secure-next-auth.session-token") ||
    set.has("__Host-next-auth.session-token") ||
    set.has("next-auth.session-token") ||
    set.has("OSID") ||
    set.has("__Secure-OSID");
  const hasGoogleSid =
    set.has("SID") || set.has("__Secure-1PSID") || set.has("__Secure-3PSID");
  if (hasLabsSession || hasGoogleSid) return null;
  return "No Flow session cookie found. Include __Secure-next-auth.session-token from labs.google.";
}

export function CookiesPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [admin, setAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [slot, setSlot] = useState("C1");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [status, setStatus] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [syncKey, setSyncKey] = useState("");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [meta, setMeta] = useState<{
    count: number;
    updated: string | null;
    names: string[];
  }>({ count: 0, updated: null, names: [] });
  const [slotLabel, setSlotLabel] = useState("");
  const [copyTarget, setCopyTarget] = useState("C2");
  const [preview, setPreview] = useState<{
    count: number;
    names: string[];
    warning: string | null;
  } | null>(null);
  const [pendingSave, setPendingSave] = useState<string | null>(null);

  async function checkAdmin() {
    setChecking(true);
    try {
      const res = await fetch("/api/admin", { credentials: "include" });
      const data = await res.json();
      const ok = Boolean(data.admin);
      setAdmin(ok);
      if (ok) {
        const savedKey = sessionStorage.getItem("flowdoverz_admin_sync_key") || "";
        if (savedKey) setSyncKey(savedKey);
        await refreshMeta("C1");
      } else {
        sessionStorage.removeItem("flowdoverz_admin_sync_key");
        setSyncKey("");
      }
    } catch {
      setAdmin(false);
    } finally {
      setChecking(false);
    }
  }

  async function refreshMeta(active = slot) {
    const res = await fetch(`/api/cookies?slot=${active}`, { credentials: "include" });
    if (res.status === 401) {
      setAdmin(false);
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setSlots(data.available_slots || []);
    setMeta({
      count: data.cookie_count || 0,
      updated: data.updated_at || null,
      names: data.cookie_names || [],
    });
    if (data.label) setSlotLabel(String(data.label));
    else {
      const current = (data.available_slots || []).find((s: SlotInfo) => s.key === active);
      if (current?.label) setSlotLabel(current.label);
      else setSlotLabel("");
    }
  }

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (admin) refreshMeta(slot);
  }, [slot, admin]);

  useEffect(() => {
    if (!admin) return;
    return subscribeLive((event) => {
      if (event.topic === "cookies" || event.type === "resync") void refreshMeta(slot);
    });
  }, [admin, slot]);

  async function saveCookies(raw: string, targetSlot = slot, skipPreview = false) {
    const text = raw.trim();
    if (!text) {
      setStatus({ type: "err", text: "Nothing to save — paste or upload cookies first." });
      return false;
    }

    if (!skipPreview) {
      try {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : parsed?.cookies;
        if (Array.isArray(list)) {
          const names = list.slice(0, 8).map((c: { name?: string }) => c.name || "?");
          setPreview({
            count: list.length,
            names,
            warning: cookieCoverageWarning(
              list.map((c: { name?: string }) => String(c.name || "")),
            ),
          });
          setPendingSave(text);
          return false;
        }
      } catch {
        // fall through to save attempt
      }
    }

    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/cookies", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: targetSlot, cookies: text, label: slotLabel || undefined }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setAdmin(false);
        setStatus({ type: "err", text: "Admin session expired. Unlock again." });
        return false;
      }
      if (!res.ok || !data.success) {
        setStatus({ type: "err", text: data.error || "Save failed" });
        return false;
      }
      setStatus({
        type: data.warnings?.length ? "err" : "ok",
        text:
          data.message ||
          (data.warnings && data.warnings[0]) ||
          `Replaced ${targetSlot} with ${data.cookie_count} cookies. Clients will get them after they sign in.`,
      });
      setJsonText("");
      await refreshMeta(targetSlot);
      return true;
    } catch {
      setStatus({ type: "err", text: "Network error while saving." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    setUnlocking(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatus({ type: "err", text: data.error || "Wrong password" });
        return;
      }
      setPassword("");
      setAdmin(true);
      if (typeof data.sync_key === "string" && data.sync_key) {
        setSyncKey(data.sync_key);
        sessionStorage.setItem("flowdoverz_admin_sync_key", data.sync_key);
      }
      await refreshMeta("C1");
      setStatus({
        type: "ok",
        text: "Unlocked. Keep this tab open and click Connect now in the extension.",
      });
    } catch {
      setStatus({ type: "err", text: "Could not unlock admin panel." });
    } finally {
      setUnlocking(false);
    }
  }

  async function handleLock() {
    await fetch("/api/admin", { method: "DELETE", credentials: "include" });
    sessionStorage.removeItem("flowdoverz_admin_sync_key");
    setAdmin(false);
    setSyncKey("");
    setJsonText("");
    setStatus(null);
  }

  async function pasteFromClipboard(autoSave = false) {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setStatus({ type: "err", text: "Clipboard is empty." });
        return;
      }
      setJsonText(text);
      if (autoSave) {
        await saveCookies(text);
      } else {
        setStatus({ type: "ok", text: "Pasted from clipboard. Click Save, or use Paste & replace." });
      }
    } catch {
      setStatus({
        type: "err",
        text: "Clipboard blocked. Allow clipboard permission, or paste with Ctrl+V.",
      });
    }
  }

  async function readFile(file: File) {
    const text = await file.text();
    setJsonText(text);
    setStatus({
      type: "ok",
      text: `Loaded ${file.name}. Click Save or press Ctrl+Enter.`,
    });
  }

  async function loadCurrentIntoEditor() {
    const res = await fetch(`/api/cookies?slot=${slot}&full=1`, {
      credentials: "include",
    });
    if (res.status === 401) {
      setAdmin(false);
      return;
    }
    const data = await res.json();
    if (!data.cookies?.length) {
      setStatus({ type: "err", text: `No cookies saved in ${slot} yet.` });
      return;
    }
    setJsonText(JSON.stringify(data.cookies, null, 2));
    setStatus({ type: "ok", text: `Loaded ${data.cookies.length} cookies from ${slot} into the editor.` });
  }

  async function handleClear() {
    setStatus(null);
    const res = await fetch(`/api/cookies?slot=${slot}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json();
    if (res.status === 401) {
      setAdmin(false);
      return;
    }
    if (!res.ok) {
      setStatus({ type: "err", text: data.error || "Clear failed" });
      return;
    }
    setStatus({ type: "ok", text: `Cleared cookies for ${slot}.` });
    await refreshMeta(slot);
  }

  async function copySlotTo(target: string) {
    if (target === slot) return;
    const res = await fetch(`/api/cookies?slot=${slot}&full=1`, {
      credentials: "include",
    });
    const data = await res.json();
    if (!data.cookies?.length) {
      setStatus({ type: "err", text: `${slot} has no cookies to copy.` });
      return;
    }
    await saveCookies(JSON.stringify(data.cookies), target);
    setSlot(target);
  }

  if (checking) {
    return <AdminLoadingState label="Checking admin access..." />;
  }

  if (!admin) {
    return <AdminLoadingState />;
  }

  return (
    <AdminPageLayout
      header={
        <AdminPageHeader
          title="Cookie Manager"
          description={
            <>
              Paste cookies here. Clients sign in on{" "}
              <code className="font-mono text-cyan-400">/login</code> and their extension syncs
              these automatically. A labs.google export with{" "}
              <code className="font-mono text-cyan-400">__Secure-next-auth.session-token</code> is
              enough.
            </>
          }
          actions={
            <button
              type="button"
              onClick={handleLock}
              className="w-full rounded-xl border border-white/10 bg-[#0F172A]/80 px-5 py-3 text-sm font-bold text-slate-300 shadow-xl backdrop-blur-xl transition-all hover:bg-white/5 sm:w-auto sm:px-6 sm:py-3.5"
            >
              Lock Admin
            </button>
          }
        />
      }
    >
      <div
        id="flowdoverz-admin-marker"
        data-admin-unlocked={admin ? "1" : "0"}
        hidden
        aria-hidden="true"
      />

      <main className="mx-auto w-full max-w-7xl space-y-4 pb-2 sm:space-y-6">
        {/* One-click daily action */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => pasteFromClipboard(true)}
            className="rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-6 text-left shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all max-md:hover:-translate-y-0.5 max-md:hover:shadow-[0_0_25px_rgba(34,211,238,0.4)] md:hover:shadow-[0_10px_30px_rgba(34,211,238,0.45)] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]"
          >
            <p className="text-xl font-black text-slate-950">Paste & Replace</p>
            <p className="mt-2 text-sm font-medium text-slate-800">
              Clipboard → {slot} in one click
            </p>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => fileRef.current?.click()}
            className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-6 py-6 text-left transition-all hover:bg-cyan-500/15 max-md:hover:-translate-y-0.5 md:hover:border-cyan-400/50 md:hover:shadow-[0_10px_28px_rgba(34,211,238,0.25)] disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <p className="text-xl font-black text-cyan-50">Upload JSON File</p>
            <p className="mt-2 text-sm text-cyan-200/70">
              Drop a Cookie Editor export
            </p>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readFile(file);
              e.target.value = "";
            }}
          />
        </div>

        {slots.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {SLOTS.map((key) => {
              const info = slots.find((s) => s.key === key);
              const active = slot === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSlot(key)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    active
                      ? "border-cyan-400 bg-cyan-500/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <p className="font-bold text-sm text-slate-200">{key}</p>
                  <p className="text-xs text-slate-500 truncate mt-1">{info?.label || info?.name || "Empty"}</p>
                  <p className="text-xs text-cyan-400/80 mt-2">{info?.cookie_count ?? 0} cookies</p>
                </button>
              );
            })}
          </div>
        )}

        <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-xl sm:rounded-2xl sm:p-8">
          <div className="pointer-events-none absolute top-0 right-0 h-48 w-48 rounded-full bg-cyan-500/5 blur-3xl" />
          <div className="relative z-30 mb-6 flex flex-wrap items-end gap-4">
            <div>
              <label
                htmlFor="slot"
                className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400"
              >
                Session slot
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className={`rounded-xl border bg-[#080810] px-4 py-2.5 pr-10 text-sm font-medium outline-none transition-all min-w-[200px] flex items-center justify-between text-left ${
                    dropdownOpen ? "border-cyan-400 ring-1 ring-cyan-400 text-cyan-50" : "border-white/10 text-slate-200 hover:border-white/20"
                  }`}
                >
                  <span className="truncate">
                    {slot}
                    {slots.find((s) => s.key === slot)?.has_cookies
                      ? ` · ${slots.find((s) => s.key === slot)?.cookie_count || "saved"}`
                      : ""}
                  </span>
                  <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-transform pointer-events-none ${dropdownOpen ? "rotate-180 text-cyan-400" : "text-slate-400"}`} />
                </button>

                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-2 w-full min-w-[200px] rounded-xl border border-white/10 bg-[#0F172A] shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="py-1">
                        {SLOTS.map((key) => {
                          const hasCookies = slots.find((s) => s.key === key)?.has_cookies;
                          const count = slots.find((s) => s.key === key)?.cookie_count || "saved";
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setSlot(key);
                                setDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex justify-between items-center ${
                                slot === key
                                  ? "bg-cyan-500/10 text-cyan-400 font-bold"
                                  : "text-slate-300 hover:bg-white/5"
                              }`}
                            >
                              <span>{key}</span>
                              {hasCookies && (
                                <span className="text-xs text-slate-500 font-medium bg-white/5 px-2 py-0.5 rounded-full">{count} cookies</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <p className="pb-2 text-sm text-slate-500">
              {meta.count > 0
                ? `${meta.count} live in ${slot}${meta.updated ? ` · updated ${new Date(meta.updated).toLocaleString()}` : ""}`
                : `No cookies in ${slot} yet`}
            </p>
            <div className="w-full sm:w-auto">
              <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Slot label</label>
              <input
                type="text"
                value={slotLabel}
                onChange={(e) => setSlotLabel(e.target.value)}
                placeholder="e.g. Main account"
                className="w-full sm:w-48 rounded-xl border border-white/10 bg-[#080810] px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/50"
              />
            </div>
            <div className="w-full sm:w-auto flex gap-2 items-end">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Copy to</label>
                <select
                  value={copyTarget}
                  onChange={(e) => setCopyTarget(e.target.value)}
                  className="rounded-xl border border-white/10 bg-[#080810] px-3 py-2 text-sm text-slate-200"
                >
                  {SLOTS.filter((s) => s !== slot).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => copySlotTo(copyTarget)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-white/5"
              >
                Copy slot
              </button>
            </div>
          </div>

          {meta.names.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {meta.names.slice(0, 12).map((name) => (
                <span
                  key={name}
                  className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-slate-400"
                >
                  {name}
                </span>
              ))}
              {meta.names.length > 12 && (
                <span className="px-2 py-0.5 text-[10px] text-slate-500">
                  +{meta.names.length - 12} more
                </span>
              )}
            </div>
          )}

          {status && (
            <p
              className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                status.type === "ok"
                  ? "border-teal-500/30 bg-teal-500/10 text-teal-100"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-200"
              }`}
            >
              {status.text}
            </p>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) readFile(file);
            }}
            className={`rounded-xl border border-dashed p-1 transition-colors ${
              dragging
                ? "border-cyan-400 bg-cyan-500/10"
                : "border-transparent"
            }`}
          >
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between">
                <label className="text-sm font-bold text-slate-300">
                  Raw JSON
                </label>
                {jsonText && jsonText !== "[]" && (
                  <button
                    type="button"
                    onClick={() => setJsonText("[]")}
                    className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <textarea
                id="cookies"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    saveCookies(jsonText);
                  }
                }}
                spellCheck={false}
                rows={12}
                placeholder="Paste cookie array here, or drag & drop a .json file..."
                className="w-full min-h-[180px] resize-y rounded-2xl border border-white/5 bg-[#080810]/50 p-4 font-mono text-[11px] leading-relaxed text-slate-400 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 sm:min-h-[240px]"
              />
            </div>
          </div>

          <div className="relative z-10 mt-6 grid grid-cols-2 gap-2 justify-end sm:mt-8 sm:flex sm:flex-wrap">
            <button
              type="button"
              disabled={saving}
              onClick={() => saveCookies(jsonText)}
              className="col-span-2 sm:col-span-1 w-full sm:w-auto rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-2.5 text-sm font-bold text-slate-950 transition-all hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save (Ctrl+Enter)"}
            </button>
            <button
              type="button"
              onClick={() => pasteFromClipboard(false)}
              className="w-full sm:w-auto rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/5 transition-colors"
            >
              Paste only
            </button>
            <button
              type="button"
              onClick={loadCurrentIntoEditor}
              className="w-full sm:w-auto rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5"
            >
              Load current
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="w-full sm:w-auto rounded-xl border border-white/10 px-4 py-2.5 text-sm text-rose-300/80 hover:bg-white/5"
            >
              Clear slot
            </button>
          </div>
        </div>
      </main>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F172A] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Confirm save to {slot}</h3>
            <p className="text-sm text-slate-400 mb-4">
              {preview.count} cookies will replace the current slot contents.
            </p>
            {preview.warning && (
              <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {preview.warning}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mb-6">
              {preview.names.map((name) => (
                <span key={name} className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                  {name}
                </span>
              ))}
              {preview.count > preview.names.length && (
                <span className="text-xs text-slate-500">+{preview.count - preview.names.length} more</span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setPreview(null); setPendingSave(null); }}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-bold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  const raw = pendingSave;
                  setPreview(null);
                  setPendingSave(null);
                  if (raw) await saveCookies(raw, slot, true);
                }}
                className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
