"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Link2,
  CirclePlus,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Store,
  Trash2,
  Users,
  Puzzle,
  Globe,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin-data-table";
import { AdminFilterPills } from "@/components/admin-filter-pills";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminDateTimeInput } from "@/components/admin-datetime-input";
import { AdminLoadingState } from "@/components/admin-loading-state";
import { AdminGlassModal, AdminGlassPanel } from "@/components/admin-glass-modal";
import { useAdminToast } from "@/components/admin-toast";
import { AdminPageLayout } from "@/components/admin-page-layout";
import { ResellerMobileCard } from "@/components/admin-mobile-cards";
import { useAdminLiveRefresh } from "@/hooks/use-admin-live-refresh";

const SLOTS = ["C1", "C2", "C3", "C4", "C5"] as const;
const FILTERS = ["all", "active", "paused", "disabled"] as const;
const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-white outline-none transition-all focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400";

type Filter = (typeof FILTERS)[number];
type ResellerStatus = "active" | "paused" | "disabled";

type SlotHealth = {
  key: string;
  label: string;
  hasCookies: boolean;
  cookieCount: number;
};

type Reseller = {
  id: string;
  brandName: string;
  contactName: string;
  contactEmail: string;
  websiteUrl: string;
  allowedOrigins: string[];
  status: ResellerStatus;
  kind?: "white_label" | "official";
  signupCode?: string;
  signupUrl?: string;
  panelUrl?: string;
  assignedSlots: string[];
  maxUsers: number;
  seatsPurchased: number;
  remainingSeats: number;
  seatDays: number;
  notes: string;
  expiresAt: string | null;
  apiKeyPrefix: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  userCount: number;
  brandedExtension?: {
    version: string;
    fileName: string;
    generatedAt: string;
    displayName: string;
    downloadUrl?: string;
    supportEmail?: string;
    dashboardUrl?: string;
    loginUrl?: string;
    hasLogo?: boolean;
  } | null;
};

type ResellerUser = {
  email: string;
  name: string;
  subscriptionPlan: string;
  assignedSlot: string;
  trialExpiresAt: string | null;
  subscriptionExpiresAt: string | null;
  createdAt: string | null;
};

type Integration = {
  apiBaseUrl: string;
  extensionDownloadUrl: string;
  assignedSlots: string[];
  maxUsers: number;
  allowedOrigins: string[];
  cookiesIncluded: boolean;
  rules: string[];
};

type FormState = {
  brandName: string;
  contactName: string;
  contactEmail: string;
  websiteUrl: string;
  allowedOrigins: string;
  status: ResellerStatus;
  kind: "white_label" | "official";
  assignedSlots: string[];
  maxUsers: string;
  notes: string;
  expiresAt: string;
  panelPassword: string;
};

const EMPTY_FORM: FormState = {
  brandName: "",
  contactName: "",
  contactEmail: "",
  websiteUrl: "",
  allowedOrigins: "",
  status: "active",
  kind: "white_label",
  assignedSlots: [],
  maxUsers: "0",
  notes: "",
  expiresAt: "",
  panelPassword: "",
};

function formFromReseller(row: Reseller): FormState {
  return {
    brandName: row.brandName,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    websiteUrl: row.websiteUrl,
    allowedOrigins: (row.allowedOrigins || []).join("\n"),
    status: row.status,
    kind: row.kind === "official" ? "official" : "white_label",
    assignedSlots: [...(row.assignedSlots || [])],
    maxUsers: String(row.seatsPurchased || row.maxUsers || 0),
    notes: row.notes || "",
    expiresAt: row.expiresAt || "",
    panelPassword: "",
  };
}

function payloadFromForm(form: FormState) {
  return {
    brandName: form.brandName,
    contactName: form.contactName,
    contactEmail: form.contactEmail,
    websiteUrl: form.websiteUrl,
    allowedOrigins: form.allowedOrigins,
    status: form.status,
    kind: form.kind,
    assignedSlots: form.assignedSlots,
    seatsPurchased: Number(form.maxUsers) || 0,
    maxUsers: Number(form.maxUsers) || 0,
    notes: form.notes,
    expiresAt: form.expiresAt || null,
    ...(form.panelPassword.trim() ? { panelPassword: form.panelPassword.trim() } : {}),
  };
}

function daysLeft(iso: string | null | undefined) {
  if (!iso) return { label: "No timer", className: "text-slate-500" };
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return { label: "No timer", className: "text-slate-500" };
  if (ms <= 0) return { label: "Expired", className: "text-rose-400" };
  const days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  return { label: `${days}d left`, className: "text-emerald-400" };
}

type ResellerApiUseDomain = {
  domain: string;
  origin: string;
  hits: number;
  blockedHits: number;
  lastAt: string;
  lastIp: string;
  lastPath: string;
  expected: boolean;
};

type ResellerApiUseEvent = {
  id: string;
  domain: string;
  origin: string;
  ip: string;
  path: string;
  blocked: boolean;
  expected: boolean;
  source: "origin" | "referer" | "server";
  createdAt: string;
};

function formatUseTime(iso: string) {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString();
}

function StatusBadge({ status }: { status: ResellerStatus }) {
  const styles = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    disabled: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}

function ActionIconButton({
  label,
  icon: Icon,
  onClick,
  bgClass,
  colorClass,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  bgClass: string;
  colorClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`shrink-0 rounded-lg p-2 transition-colors hover:brightness-125 ${bgClass} ${colorClass}`}
    >
      <Icon size={16} strokeWidth={2.25} />
    </button>
  );
}

function kitText(args: {
  brandName: string;
  apiKey?: string;
  apiKeyPrefix?: string;
  integration: Integration;
}) {
  const keyLine = args.apiKey
    ? `API key (shown once): ${args.apiKey}`
    : `API key prefix: ${args.apiKeyPrefix || "—"} (full key is only shown when created or rotated)`;
  return [
    `FlowDoverz reseller kit — ${args.brandName}`,
    keyLine,
    `API base: ${args.integration.apiBaseUrl}`,
    `Auth header: Authorization: Bearer YOUR_API_KEY`,
    `Extension download: ${args.integration.extensionDownloadUrl}`,
    `Assigned slots: ${args.integration.assignedSlots.join(", ") || "none"}`,
    `Allowed origins: ${args.integration.allowedOrigins.join(", ") || "none"}`,
    "",
    "Config check:",
    `curl -H "Authorization: Bearer YOUR_API_KEY" ${args.integration.apiBaseUrl}/config`,
    "",
    "Create a user from YOUR SERVER:",
    `curl -X POST ${args.integration.apiBaseUrl}/users -H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json" -d '{"email":"user@example.com","name":"User","password":"at-least-8-chars"}'`,
    "",
    "Rules:",
    ...args.integration.rules.map((rule) => `- ${rule}`),
  ].join("\n");
}

export default function AdminResellersPage() {
  const { toast } = useAdminToast();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [slots, setSlots] = useState<SlotHealth[]>([]);
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [extensionDownloadUrl, setExtensionDownloadUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Reseller | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{
    brandName: string;
    apiKey: string;
    integration: Integration;
  } | null>(null);
  const [showKey, setShowKey] = useState(true);
  const [kit, setKit] = useState<{ reseller: Reseller; integration: Integration } | null>(null);
  const [usersFor, setUsersFor] = useState<Reseller | null>(null);
  const [users, setUsers] = useState<ResellerUser[]>([]);
  const [usageFor, setUsageFor] = useState<Reseller | null>(null);
  const [usageDomains, setUsageDomains] = useState<ResellerApiUseDomain[]>([]);
  const [usageEvents, setUsageEvents] = useState<ResellerApiUseEvent[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Reseller | null>(null);
  const [seatsTarget, setSeatsTarget] = useState<Reseller | null>(null);
  const [seatCount, setSeatCount] = useState("10");
  const [seatNote, setSeatNote] = useState("");
  const [seatPayment, setSeatPayment] = useState("");
  const [addingSeats, setAddingSeats] = useState(false);
  const [generatingExtensionId, setGeneratingExtensionId] = useState<string | null>(null);
  const [brandTarget, setBrandTarget] = useState<Reseller | null>(null);
  const [brandName, setBrandName] = useState("");
  const [brandEmail, setBrandEmail] = useState("");
  const [brandDashboardUrl, setBrandDashboardUrl] = useState("");
  const [brandLoginUrl, setBrandLoginUrl] = useState("");
  const [brandResult, setBrandResult] = useState<{
    displayName: string;
    supportEmail: string;
    loginUrl: string;
    dashboardUrl: string;
    downloadUrl: string;
    version: string;
  } | null>(null);
  const [brandLogoDataUrl, setBrandLogoDataUrl] = useState("");
  const [brandLogoName, setBrandLogoName] = useState("");
  const [brandLogoError, setBrandLogoError] = useState("");
  const brandLogoInputRef = useRef<HTMLInputElement>(null);
  const [revealedSignup, setRevealedSignup] = useState<{
    brandName: string;
    signupUrl: string;
    email: string;
    password: string;
  } | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch("/api/admin/resellers", { credentials: "same-origin" });
        const data = await res.json();
        if (data.success) {
          setResellers(data.resellers || []);
          setSlots(data.slots || []);
          setApiBaseUrl(data.apiBaseUrl || "");
          setExtensionDownloadUrl(data.extensionDownloadUrl || "");
        } else if (!silent) {
          toast(data.error || "Failed to load resellers", "error");
        }
      } catch {
        if (!silent) toast("Failed to load resellers", "error");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useAdminLiveRefresh(
    () => {
      void load(true);
    },
    [load],
    { topics: ["reseller"] },
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resellers.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      return [row.brandName, row.contactEmail, row.contactName, row.websiteUrl]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [resellers, filter, query]);

  const stats = useMemo(() => {
    const active = resellers.filter((row) => row.status === "active").length;
    const paused = resellers.filter((row) => row.status === "paused").length;
    const userTotal = resellers.reduce((sum, row) => sum + (row.userCount || 0), 0);
    const seatsLeft = resellers.reduce((sum, row) => sum + (row.remainingSeats || 0), 0);
    const missingSlots = resellers.filter((row) => row.status === "active" && row.assignedSlots.length === 0).length;
    return { active, paused, userTotal, seatsLeft, missingSlots };
  }, [resellers]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (row: Reseller) => {
    setEditing(row);
    setForm(formFromReseller(row));
    setFormOpen(true);
  };

  const saveForm = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/resellers", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(editing ? { id: editing.id, ...payloadFromForm(form) } : payloadFromForm(form)),
      });
      const data = await res.json();
      if (!data.success) {
        toast(data.error || "Save failed", "error");
        return;
      }
      setFormOpen(false);
      setEditing(null);
      await load(true);
      const created = data.reseller as Reseller | undefined;
      if (!editing && created) {
        setRevealedSignup({
          brandName: created.brandName,
          signupUrl: created.panelUrl || created.signupUrl || "",
          email: form.contactEmail.trim().toLowerCase(),
          password: form.panelPassword,
        });
      } else if (data.apiKey && data.integration) {
        setShowKey(true);
        setRevealedKey({
          brandName: data.reseller.brandName,
          apiKey: data.apiKey,
          integration: data.integration,
        });
      } else {
        toast(editing ? "Reseller updated" : "Reseller created");
      }
    } catch {
      toast("Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const openBrandModal = (row: Reseller) => {
    setBrandTarget(row);
    setBrandResult(null);
    setBrandName(row.brandedExtension?.displayName || row.brandName || "");
    setBrandEmail(row.brandedExtension?.supportEmail || row.contactEmail || "");
    setBrandLoginUrl(row.brandedExtension?.loginUrl || row.brandedExtension?.dashboardUrl || row.websiteUrl || "");
    setBrandDashboardUrl(
      row.brandedExtension?.dashboardUrl && row.brandedExtension.dashboardUrl !== row.brandedExtension.loginUrl
        ? row.brandedExtension.dashboardUrl
        : "",
    );
    setBrandLogoDataUrl("");
    setBrandLogoName("");
    setBrandLogoError("");
    if (brandLogoInputRef.current) brandLogoInputRef.current.value = "";
  };

  const onBrandLogoPicked = (file: File | null) => {
    if (brandLogoDataUrl.startsWith("blob:")) {
      URL.revokeObjectURL(brandLogoDataUrl);
    }
    if (!file) {
      setBrandLogoDataUrl("");
      setBrandLogoName("");
      setBrandLogoError("");
      return;
    }
    setBrandLogoName(file.name);
    const allowed = /image\/(png|jpe?g|jpg|webp|svg\+xml)/i.test(file.type) || /\.(png|jpe?g|webp|svg)$/i.test(file.name);
    if (!allowed) {
      setBrandLogoDataUrl("");
      setBrandLogoError("Use a PNG, JPG, WEBP, or SVG file.");
      return;
    }
    if (file.size > 400 * 1024) {
      setBrandLogoDataUrl("");
      setBrandLogoError(`This file is ${Math.ceil(file.size / 1024)} KB. Compress it under 400 KB and choose it again.`);
      return;
    }
    setBrandLogoError("");
    setBrandLogoDataUrl(URL.createObjectURL(file));
  };

  const generateExtension = async (event: FormEvent) => {
    event.preventDefault();
    if (!brandTarget) return;
    const row = brandTarget;
    const file = brandLogoInputRef.current?.files?.[0] || null;
    if (!file && !row.brandedExtension?.hasLogo) {
      setBrandLogoError("Select a logo image first.");
      toast("Select a logo image first.", "error");
      return;
    }
    if (!brandLoginUrl.trim()) {
      toast("Enter the client sign-in page first.", "error");
      return;
    }
    setGeneratingExtensionId(row.id);
    try {
      const form = new FormData();
      form.set("id", row.id);
      form.set("action", "generate_extension");
      form.set("displayName", brandName.trim());
      form.set("supportEmail", brandEmail.trim());
      form.set("loginUrl", brandLoginUrl.trim());
      form.set("dashboardUrl", brandDashboardUrl.trim() || brandLoginUrl.trim());
      if (file) {
        form.set("logo", file);
        form.set("keepLogo", "false");
      } else {
        form.set("keepLogo", "true");
      }
      const res = await fetch("/api/admin/resellers", {
        method: "PUT",
        credentials: "same-origin",
        body: form,
      });
      const data = await res.json();
      if (!data.success) {
        toast(data.error || "Could not build branded extension", "error");
        return;
      }
      await load(true);
      const baked = data.meta as {
        displayName?: string;
        supportEmail?: string;
        loginUrl?: string;
        dashboardUrl?: string;
        version?: string;
      } | undefined;
      const url = String(data.downloadUrl || data.reseller?.brandedExtension?.downloadUrl || "");
      setBrandResult({
        displayName: String(baked?.displayName || brandName.trim() || row.brandName),
        supportEmail: String(baked?.supportEmail || brandEmail.trim()),
        loginUrl: String(baked?.loginUrl || brandLoginUrl.trim()),
        dashboardUrl: String(baked?.dashboardUrl || brandDashboardUrl.trim() || brandLoginUrl.trim()),
        downloadUrl: url,
        version: String(baked?.version || data.reseller?.brandedExtension?.version || ""),
      });
      if (url) {
        await copyText(url, "Branded extension link");
        const link = document.createElement("a");
        link.href = url;
        link.download = "";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      toast(`Branded ZIP ready for ${brandName.trim() || row.brandName}. Remove the old extension, then load this new ZIP.`);
    } catch {
      toast("Could not build branded extension", "error");
    } finally {
      setGeneratingExtensionId(null);
    }
  };

  const rotateKey = async (row: Reseller) => {
    if (!window.confirm(`Rotate the API key for ${row.brandName}? The old key stops working immediately.`)) return;
    const res = await fetch("/api/admin/resellers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id: row.id, action: "rotate_key" }),
    });
    const data = await res.json();
    if (!data.success) {
      toast(data.error || "Could not rotate key", "error");
      return;
    }
    setShowKey(true);
    setRevealedKey({
      brandName: data.reseller.brandName,
      apiKey: data.apiKey,
      integration: data.integration,
    });
    await load(true);
  };

  const togglePause = async (row: Reseller) => {
    const next = row.status === "paused" ? "active" : "paused";
    const res = await fetch("/api/admin/resellers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id: row.id, status: next }),
    });
    const data = await res.json();
    if (!data.success) {
      toast(data.error || "Update failed", "error");
      return;
    }
    toast(next === "paused" ? "Reseller paused" : "Reseller activated");
    await load(true);
  };

  const openKit = async (row: Reseller) => {
    const res = await fetch(`/api/admin/resellers?id=${encodeURIComponent(row.id)}`, {
      credentials: "same-origin",
    });
    const data = await res.json();
    if (!data.success) {
      toast(data.error || "Could not load kit", "error");
      return;
    }
    setKit({ reseller: data.reseller, integration: data.integration });
  };

  const openUsers = async (row: Reseller) => {
    setUsersFor(row);
    const res = await fetch(`/api/admin/resellers?id=${encodeURIComponent(row.id)}`, {
      credentials: "same-origin",
    });
    const data = await res.json();
    if (!data.success) {
      toast(data.error || "Could not load users", "error");
      return;
    }
    setUsers(data.users || []);
  };

  const openUsage = async (row: Reseller) => {
    setUsageFor(row);
    setUsageLoading(true);
    try {
      const res = await fetch(`/api/admin/resellers?id=${encodeURIComponent(row.id)}&usage=1`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!data.success) {
        toast(data.error || "Could not load API usage", "error");
        return;
      }
      setUsageDomains(data.usage?.domains || []);
      setUsageEvents(data.usage?.events || []);
    } finally {
      setUsageLoading(false);
    }
  };

  const removeReseller = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/admin/resellers?id=${encodeURIComponent(deleteTarget.id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const data = await res.json();
    if (!data.success) {
      toast(data.error || "Delete failed", "error");
      return;
    }
    toast("Reseller deleted");
    setDeleteTarget(null);
    await load(true);
  };

  const addSeats = async (event: FormEvent) => {
    event.preventDefault();
    if (!seatsTarget) return;
    setAddingSeats(true);
    try {
      const res = await fetch("/api/admin/resellers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          id: seatsTarget.id,
          action: "add_seats",
          seats: Number(seatCount),
          note: seatNote,
          paymentAmount: seatPayment,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast(data.error || "Could not add seats", "error");
        return;
      }
      toast(`Added ${Number(seatCount)} seats for ${seatsTarget.brandName}`);
      setSeatsTarget(null);
      setSeatCount("10");
      setSeatNote("");
      setSeatPayment("");
      await load(true);
    } catch {
      toast("Could not add seats", "error");
    } finally {
      setAddingSeats(false);
    }
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied`);
    } catch {
      toast("Could not copy", "error");
    }
  };

  const renderActions = (row: Reseller) => (
    <div className="flex flex-wrap gap-1.5">
      <ActionIconButton label="Edit" icon={Pencil} onClick={() => openEdit(row)} bgClass="bg-cyan-500/10" colorClass="text-cyan-400" />
      {row.kind === "official" ? (
        <ActionIconButton
          label="Copy panel link"
          icon={Link2}
          onClick={() => void copyText(row.panelUrl || row.signupUrl || "", "Panel link")}
          bgClass="bg-emerald-500/10"
          colorClass="text-emerald-400"
        />
      ) : (
        <ActionIconButton label="Integration kit" icon={Copy} onClick={() => void openKit(row)} bgClass="bg-emerald-500/10" colorClass="text-emerald-400" />
      )}
      {row.kind === "official" ? null : (
        <ActionIconButton
          label={row.brandedExtension ? "Rebuild branded extension" : "Build branded extension"}
          icon={Puzzle}
          onClick={() => openBrandModal(row)}
          bgClass="bg-fuchsia-500/10"
          colorClass="text-fuchsia-300"
        />
      )}
      <ActionIconButton label="Users" icon={Users} onClick={() => void openUsers(row)} bgClass="bg-violet-500/10" colorClass="text-violet-400" />
      {row.kind === "official" ? null : (
        <ActionIconButton label="Where this API key was used" icon={Globe} onClick={() => void openUsage(row)} bgClass="bg-sky-500/10" colorClass="text-sky-300" />
      )}
      <ActionIconButton label="Add paid seats" icon={CirclePlus} onClick={() => { setSeatCount("10"); setSeatNote(""); setSeatPayment(""); setSeatsTarget(row); }} bgClass="bg-emerald-500/10" colorClass="text-emerald-300" />
      {row.kind === "official" ? null : (
        <ActionIconButton label="Rotate API key" icon={KeyRound} onClick={() => void rotateKey(row)} bgClass="bg-amber-500/10" colorClass="text-amber-400" />
      )}
      <ActionIconButton
        label={row.status === "paused" ? "Activate" : "Pause"}
        icon={row.status === "paused" ? Play : Pause}
        onClick={() => void togglePause(row)}
        bgClass="bg-slate-500/10"
        colorClass="text-slate-300"
      />
      <ActionIconButton label="Delete" icon={Trash2} onClick={() => setDeleteTarget(row)} bgClass="bg-rose-500/10" colorClass="text-rose-400" />
    </div>
  );

  const columns: AdminTableColumn<Reseller>[] = [
    {
      key: "brand",
      header: "Brand",
      render: (row) => (
        <div className="min-w-0">
          <div className="font-semibold text-white">{row.brandName}</div>
          <div className="truncate text-xs text-slate-500">{row.contactEmail}</div>
        </div>
      ),
    },
    {
      key: "kind",
      header: "Type",
      render: (row) => (
        <span className="text-xs font-semibold text-slate-300">
          {row.kind === "official" ? "FlowDoverz name" : "Own brand"}
        </span>
      ),
    },
    {
      key: "website",
      header: "Website",
      hideOnMobile: true,
      render: (row) => (
        <span className="block max-w-[220px] truncate text-slate-300" title={row.websiteUrl}>
          {row.websiteUrl || "—"}
        </span>
      ),
    },
    {
      key: "slots",
      header: "Slots",
      render: (row) => (
        <span className="font-mono text-xs text-cyan-300">
          {row.assignedSlots.length ? row.assignedSlots.join(" · ") : "None"}
        </span>
      ),
    },
    {
      key: "users",
      header: "Seats",
      render: (row) => (
        <div className="text-sm">
          <p className="tabular-nums text-slate-200">
            {row.userCount} / {row.seatsPurchased || row.maxUsers || 0} used
          </p>
          <p className={`text-xs ${(row.remainingSeats || 0) > 0 ? "text-emerald-400" : "text-amber-400"}`}>
            {row.remainingSeats || 0} left
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "key",
      header: "API key",
      hideOnMobile: true,
      render: (row) => <span className="font-mono text-xs text-slate-400">{row.apiKeyPrefix}••••</span>,
    },
    {
      key: "actions",
      header: "",
      hideOnMobile: true,
      render: (row) => renderActions(row),
    },
  ];

  if (loading) return <AdminLoadingState label="Loading resellers..." />;

  return (
    <AdminPageLayout
      scrollContent={false}
      header={
        <AdminPageHeader
          title="Resellers"
          description="Every official reseller uses the same panel at resellerflow.doverz.com. They sign in with their email and panel password to see only their dashboard, clients, and password page."
          actions={
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.3)]"
              >
                <Plus size={16} />
                Add Reseller
              </button>
              <AdminFilterPills options={FILTERS} value={filter} onChange={setFilter} />
            </div>
          }
        />
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { label: "Active", value: stats.active },
          { label: "Paused", value: stats.paused },
          { label: "Registered users", value: stats.userTotal },
          { label: "Seats left", value: stats.seatsLeft },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-white/10 bg-[#0F172A]/70 px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
            <p className="mt-1 text-xl font-black tabular-nums text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-100">
        They pay for a pack of users (example: 10). After you accept payment, add those seats here. Each signup uses one seat and starts a 30-day timer. When they pay for more users, add more seats.
        {apiBaseUrl ? <span className="mt-1 block font-mono text-xs text-cyan-300/80">{apiBaseUrl}</span> : null}
      </div>

      <AdminDataTable
        title="Resellers"
        count={filtered.length}
        columns={columns}
        data={filtered}
        rowKey={(row) => row.id}
        renderMobileCard={(row) => (
          <ResellerMobileCard
            reseller={row}
            onEdit={() => openEdit(row)}
            onKit={() => void openKit(row)}
            onUsers={() => void openUsers(row)}
            onUsage={row.kind === "official" ? undefined : () => void openUsage(row)}
            onAddSeats={() => { setSeatCount("10"); setSeatNote(""); setSeatPayment(""); setSeatsTarget(row); }}
            onRotate={() => void rotateKey(row)}
            onBuildExtension={row.kind === "official" ? undefined : () => openBrandModal(row)}
            onCopySignup={() => void copyText(row.panelUrl || row.signupUrl || "", "Panel link")}
            onTogglePause={() => void togglePause(row)}
            onDelete={() => setDeleteTarget(row)}
          />
        )}
        emptyState={
          <div className="flex flex-col items-center gap-2 text-center">
            <Store className="h-10 w-10 text-cyan-400" />
            <h3 className="text-lg font-black text-white">No resellers yet</h3>
            <p className="max-w-sm text-sm text-slate-400">
              Add a reseller, assign cookie slots, then send them the integration kit — never the cookies.
            </p>
          </div>
        }
        headerActions={
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search brand or email..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900/50 py-2 pl-9 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
        }
      />

      <AdminGlassModal open={formOpen} maxWidth="2xl" align="end" scrollable closeOnBackdrop onClose={() => setFormOpen(false)}>
        <AdminGlassPanel accent="cyan" sheet>
          <h2 className="mb-6 text-xl font-black text-white sm:text-2xl">{editing ? "Edit reseller" : "Add reseller"}</h2>
          <form onSubmit={saveForm} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, kind: "white_label" })}
                className={`rounded-xl border px-4 py-3 text-left ${
                  form.kind === "white_label"
                    ? "border-cyan-400/60 bg-cyan-500/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <p className="text-sm font-bold text-white">Own branding + API</p>
                <p className="mt-1 text-xs text-slate-400">They have their own website. You give them an API key. Users see their brand.</p>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, kind: "official" })}
                className={`rounded-xl border px-4 py-3 text-left ${
                  form.kind === "official"
                    ? "border-emerald-400/60 bg-emerald-500/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <p className="text-sm font-bold text-white">Sell as FlowDoverz</p>
                <p className="mt-1 text-xs text-slate-400">No own website. All resellers use the same panel link. They sign in with email and password, then register clients.</p>
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">
                  {form.kind === "official" ? "Partner name" : "Brand name"}
                </label>
                <input required value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} className={INPUT_CLASS} placeholder={form.kind === "official" ? "Partner / agent name" : "Client brand"} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Contact name</label>
                <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className={INPUT_CLASS} placeholder="Owner name" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Contact email</label>
                <input required type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className={INPUT_CLASS} placeholder="owner@brand.com" />
                <p className="mt-1 text-xs text-slate-500">This email is their reseller panel login.</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">{editing ? "New panel password" : "Panel password"}</label>
                <input
                  required={!editing}
                  minLength={editing ? undefined : 8}
                  type="text"
                  autoComplete="new-password"
                  value={form.panelPassword}
                  onChange={(e) => setForm({ ...form, panelPassword: e.target.value })}
                  className={INPUT_CLASS}
                  placeholder={editing ? "Leave blank to keep current" : "At least 8 characters"}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Website URL</label>
                <input value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} className={INPUT_CLASS} placeholder="https://their-brand.com" disabled={form.kind === "official"} />
                {form.kind === "official" ? (
                  <p className="mt-1 text-xs text-slate-500">Not needed. Customers use the FlowDoverz website.</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">Optional. Rebuild ZIP fills this from their client sign-in page if you leave it empty.</p>
                )}
              </div>
            </div>
            {form.kind === "white_label" ? (
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-400">Allowed origins</label>
              <textarea
                value={form.allowedOrigins}
                onChange={(e) => setForm({ ...form, allowedOrigins: e.target.value })}
                className={`${INPUT_CLASS} min-h-[88px]`}
                placeholder={"https://their-brand.com\nhttps://app.their-brand.com"}
              />
              <p className="mt-1 text-xs text-slate-500">Optional. Rebuild ZIP also adds their client sign-in origin here if it is missing.</p>
            </div>
            ) : (
              <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100">
                Send every reseller the same https://resellerflow.doverz.com link plus their email and panel password. After they sign in they see only their seats and clients. Unused seats stay until they register someone. The 30-day timer starts then.
              </p>
            )}
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-400">Assigned cookie slots</label>
              <div className="flex flex-wrap gap-2">
                {SLOTS.map((slot) => {
                  const health = slots.find((item) => item.key === slot);
                  const checked = form.assignedSlots.includes(slot);
                  return (
                    <label
                      key={slot}
                      className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold ${
                        checked ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-200" : "border-white/10 bg-white/5 text-slate-400"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={checked}
                        onChange={(event) => {
                          setForm((prev) => ({
                            ...prev,
                            assignedSlots: event.target.checked
                              ? [...prev.assignedSlots, slot]
                              : prev.assignedSlots.filter((item) => item !== slot),
                          }));
                        }}
                      />
                      {slot}
                      <span className="ml-2 text-[11px] font-medium text-slate-500">
                        {health?.hasCookies ? `${health.cookieCount} cookies` : "empty"}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500">They never see cookie values. Keep cookies in Cookie Manager.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ResellerStatus })}
                  className={INPUT_CLASS}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">
                  {editing ? "Paid seats" : "Paid seats now"}
                </label>
                {editing ? (
                  <div className="rounded-xl border border-white/10 bg-[#080810] px-4 py-3 text-sm text-slate-300">
                    {editing.userCount} used · {editing.remainingSeats} left · {editing.seatsPurchased || editing.maxUsers} paid
                    <p className="mt-1 text-xs text-slate-500">After they pay for more users, use Add paid seats. Do not edit this number by hand.</p>
                  </div>
                ) : (
                  <>
                    <input type="number" min={0} value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: e.target.value })} className={INPUT_CLASS} />
                    <p className="mt-1 text-xs text-slate-500">If they paid for 10 users today, enter 10. Each register starts a 30-day timer.</p>
                  </>
                )}
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Access expires</label>
                <AdminDateTimeInput value={form.expiresAt} onChange={(value) => setForm({ ...form, expiresAt: value })} />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-400">Internal notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={`${INPUT_CLASS} min-h-[72px]`}
                placeholder="Pricing, WhatsApp, special terms…"
              />
            </div>
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
              <button type="button" onClick={() => setFormOpen(false)} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-60">
                {saving ? "Saving..." : editing ? "Save reseller" : "Create and show API key"}
              </button>
            </div>
          </form>
        </AdminGlassPanel>
      </AdminGlassModal>

      <AdminGlassModal open={Boolean(revealedKey)} maxWidth="2xl" align="end" scrollable closeOnBackdrop onClose={() => setRevealedKey(null)}>
        <AdminGlassPanel accent="emerald" sheet>
          {revealedKey ? (
            <>
              <div className="mb-4 flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <div>
                  <h2 className="text-xl font-black text-white">API key for {revealedKey.brandName}</h2>
                  <p className="mt-1 text-sm text-slate-400">Copy this now. It is not stored in plaintext and will not be shown again.</p>
                </div>
              </div>
              <div className="relative">
                <input readOnly type={showKey ? "text" : "password"} value={revealedKey.apiKey} className={`${INPUT_CLASS} pr-24 font-mono text-sm`} />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
                  <button type="button" onClick={() => setShowKey((value) => !value)} className="rounded-lg p-2 text-slate-400 hover:text-white" aria-label={showKey ? "Hide key" : "Show key"}>
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button type="button" onClick={() => void copyText(revealedKey.apiKey, "API key")} className="rounded-lg p-2 text-slate-400 hover:text-white" aria-label="Copy key">
                    <Copy size={16} />
                  </button>
                </div>
              </div>
              <pre className="mt-4 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-slate-300">
                {kitText({ brandName: revealedKey.brandName, apiKey: revealedKey.apiKey, integration: revealedKey.integration })}
              </pre>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      kitText({ brandName: revealedKey.brandName, apiKey: revealedKey.apiKey, integration: revealedKey.integration }),
                      "Integration kit",
                    )
                  }
                  className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3 text-sm font-bold text-slate-950"
                >
                  Copy kit
                </button>
                <button type="button" onClick={() => setRevealedKey(null)} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300">
                  Done
                </button>
              </div>
            </>
          ) : null}
        </AdminGlassPanel>
      </AdminGlassModal>

      <AdminGlassModal open={Boolean(revealedSignup)} maxWidth="lg" align="end" closeOnBackdrop onClose={() => setRevealedSignup(null)}>
        <AdminGlassPanel accent="emerald" sheet>
          {revealedSignup ? (
            <>
              <h2 className="text-xl font-black text-white">Reseller login — {revealedSignup.brandName}</h2>
              <p className="mt-1 text-sm text-slate-400">
                Send this same panel link to every reseller, plus their email and password. They sign in and only see their own clients.
              </p>
              <label className="mt-4 mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Panel link</label>
              <input readOnly value={revealedSignup.signupUrl} className={`${INPUT_CLASS} font-mono text-sm`} />
              <label className="mt-3 mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
              <input readOnly value={revealedSignup.email} className={INPUT_CLASS} />
              <label className="mt-3 mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Password</label>
              <input readOnly value={revealedSignup.password} className={INPUT_CLASS} />
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      `Panel: ${revealedSignup.signupUrl}\nEmail: ${revealedSignup.email}\nPassword: ${revealedSignup.password}`,
                      "Reseller login details",
                    )
                  }
                  className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3 text-sm font-bold text-slate-950"
                >
                  Copy details
                </button>
                <button type="button" onClick={() => setRevealedSignup(null)} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300">
                  Done
                </button>
              </div>
            </>
          ) : null}
        </AdminGlassPanel>
      </AdminGlassModal>

      <AdminGlassModal open={Boolean(kit)} maxWidth="2xl" align="end" scrollable closeOnBackdrop onClose={() => setKit(null)}>
        <AdminGlassPanel accent="emerald" sheet>
          {kit ? (
            <>
              <h2 className="mb-2 text-xl font-black text-white">Integration kit — {kit.reseller.brandName}</h2>
              <p className="mb-4 text-sm text-slate-400">Send this to their developer. Do not include cookies. The full API key appears only on create or rotate.</p>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">API key</dt>
                  <dd className="font-mono text-slate-200">{kit.reseller.apiKeyPrefix}••••</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">API base</dt>
                  <dd className="truncate font-mono text-cyan-300">{kit.integration.apiBaseUrl}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Slots</dt>
                  <dd className="font-mono text-slate-200">{kit.integration.assignedSlots.join(", ") || "None"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Cookies in API</dt>
                  <dd className="text-emerald-400">Never</dd>
                </div>
              </dl>
              <pre className="mt-4 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-slate-300">
                {kitText({ brandName: kit.reseller.brandName, apiKeyPrefix: kit.reseller.apiKeyPrefix, integration: kit.integration })}
              </pre>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      kitText({ brandName: kit.reseller.brandName, apiKeyPrefix: kit.reseller.apiKeyPrefix, integration: kit.integration }),
                      "Integration kit",
                    )
                  }
                  className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3 text-sm font-bold text-slate-950"
                >
                  Copy kit
                </button>
                <button type="button" onClick={() => setKit(null)} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300">
                  Close
                </button>
              </div>
              {extensionDownloadUrl ? <p className="mt-3 break-all font-mono text-[11px] text-slate-500">{extensionDownloadUrl}</p> : null}
            </>
          ) : null}
        </AdminGlassPanel>
      </AdminGlassModal>

      <AdminGlassModal open={Boolean(usersFor)} maxWidth="2xl" align="end" scrollable closeOnBackdrop onClose={() => setUsersFor(null)}>
        <AdminGlassPanel accent="violet" sheet>
          {usersFor ? (
            <>
              <h2 className="mb-1 text-xl font-black text-white">{usersFor.brandName} users</h2>
              <p className="mb-4 text-sm text-slate-400">
                {users.length} registered · {usersFor.remainingSeats} seats left · {usersFor.seatsPurchased || usersFor.maxUsers} paid
              </p>
              {users.length === 0 ? (
                <p className="text-sm text-slate-400">No users created through this reseller yet.</p>
              ) : (
                <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
                  {users.map((user) => (
                    <li key={user.email} className="flex items-start justify-between gap-3 px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{user.name || "—"}</p>
                        <p className="truncate font-mono text-xs text-cyan-300">{user.email}</p>
                      </div>
                      <div className="shrink-0 text-right text-xs text-slate-400">
                        <p className="capitalize">{user.subscriptionPlan}</p>
                        <p className="font-mono">{user.assignedSlot || "—"}</p>
                        <p className={daysLeft(user.subscriptionExpiresAt).className}>{daysLeft(user.subscriptionExpiresAt).label}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => setUsersFor(null)} className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300">
                Close
              </button>
            </>
          ) : null}
        </AdminGlassPanel>
      </AdminGlassModal>

      <AdminGlassModal open={Boolean(usageFor)} maxWidth="2xl" align="end" scrollable closeOnBackdrop onClose={() => setUsageFor(null)}>
        <AdminGlassPanel accent="cyan" sheet>
          {usageFor ? (
            <>
              <h2 className="mb-1 text-xl font-black text-white">API use — {usageFor.brandName}</h2>
              <p className="mb-4 text-sm text-slate-400">
                Websites and IPs that called this key. Allowed site: {usageFor.websiteUrl || "not set"}.
                Server calls (curl, Node, PHP) show as “server (no website)” — that is normal.
              </p>
              {usageLoading ? (
                <p className="text-sm text-slate-400">Loading usage…</p>
              ) : usageDomains.length === 0 && usageEvents.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No API calls recorded yet. That means this key has not hit{" "}
                  <span className="font-mono text-slate-300">/api/reseller/v1</span> with a valid key.
                  A frontend-only page, the wrong URL, or a truncated key will not show up here.
                </p>
              ) : (
                <>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Domains</h3>
                  <ul className="mb-5 divide-y divide-white/10 rounded-xl border border-white/10">
                    {usageDomains.map((row) => {
                      const otherSite = !row.expected || row.blockedHits > 0;
                      return (
                        <li key={row.domain} className="flex items-start justify-between gap-3 px-3 py-3">
                          <div className="min-w-0">
                            <p className={`truncate font-semibold ${otherSite ? "text-rose-300" : "text-white"}`}>{row.domain}</p>
                            <p className="truncate text-xs text-slate-500">{row.origin || "No Origin header"}</p>
                            <p className="mt-1 text-xs text-slate-400">Last IP {row.lastIp || "unknown"}</p>
                          </div>
                          <div className="shrink-0 text-right text-xs text-slate-400">
                            <p className="tabular-nums text-slate-200">{row.hits} call{row.hits === 1 ? "" : "s"}</p>
                            {row.blockedHits > 0 ? <p className="text-rose-400">{row.blockedHits} blocked</p> : null}
                            <p>{formatUseTime(row.lastAt)}</p>
                            <p className={otherSite ? "text-rose-400" : "text-emerald-400"}>
                              {otherSite ? "Other website" : "Expected"}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {usageEvents.length > 0 ? (
                    <>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Recent calls</h3>
                      <ul className="max-h-64 divide-y divide-white/10 overflow-y-auto rounded-xl border border-white/10">
                        {usageEvents.map((row) => (
                          <li key={row.id} className="px-3 py-2.5 text-xs">
                            <div className="flex items-start justify-between gap-3">
                              <p className={`min-w-0 truncate font-semibold ${row.blocked || !row.expected ? "text-rose-300" : "text-slate-200"}`}>
                                {row.domain}
                              </p>
                              <p className="shrink-0 text-slate-500">{formatUseTime(row.createdAt)}</p>
                            </div>
                            <p className="mt-0.5 truncate font-mono text-slate-500">
                              {row.ip} · {row.path || "—"} {row.blocked ? "· blocked" : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </>
              )}
              <button type="button" onClick={() => setUsageFor(null)} className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300">
                Close
              </button>
            </>
          ) : null}
        </AdminGlassPanel>
      </AdminGlassModal>

      <AdminGlassModal
        open={Boolean(brandTarget)}
        maxWidth="lg"
        align="end"
        scrollable
        closeOnBackdrop
        onClose={() => {
          setBrandTarget(null);
          setBrandResult(null);
        }}
      >
        <AdminGlassPanel accent="violet" sheet>
          {brandTarget && brandResult ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={22} />
                <div>
                  <h2 className="text-xl font-black text-white">ZIP baked for {brandResult.displayName}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    No extra code change is needed. Remove the old extension, load this ZIP, then sign in on their client page and tap Sync.
                  </p>
                </div>
              </div>
              <dl className="grid gap-2 rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Name</dt>
                  <dd className="truncate text-white">{brandResult.displayName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Sign-in page</dt>
                  <dd className="truncate font-mono text-cyan-300" title={brandResult.loginUrl}>{brandResult.loginUrl}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Dashboard</dt>
                  <dd className="truncate font-mono text-cyan-300" title={brandResult.dashboardUrl}>{brandResult.dashboardUrl}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Support email</dt>
                  <dd className="truncate text-white">{brandResult.supportEmail || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Version</dt>
                  <dd className="font-mono text-slate-200">{brandResult.version || "—"}</dd>
                </div>
              </dl>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
                <li>Open chrome://extensions and remove the previous ZIP.</li>
                <li>Load this new ZIP (Developer mode → Load unpacked, or drag the zip after unzipping).</li>
                <li>Sign in at {brandResult.loginUrl} in this same Chrome profile.</li>
                <li>Open the extension popup and tap Sync.</li>
              </ol>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setBrandTarget(null);
                    setBrandResult(null);
                  }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300"
                >
                  Done
                </button>
                {brandResult.downloadUrl ? (
                  <button
                    type="button"
                    onClick={() => void copyText(brandResult.downloadUrl, "Branded extension link")}
                    className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-400 to-cyan-400 px-4 py-3 text-sm font-bold text-slate-950"
                  >
                    Copy download link
                  </button>
                ) : null}
              </div>
            </div>
          ) : brandTarget ? (
            <form onSubmit={generateExtension} className="space-y-4">
              <div>
                <h2 className="text-xl font-black text-white">Build branded extension</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Fill this once and rebuild. The ZIP bakes their name, logo, email, sign-in page, and dashboard. You do not change code for a new reseller.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Extension name</label>
                <input
                  required
                  minLength={2}
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Their brand name"
                />
                <p className="mt-1 text-xs text-slate-500">Shown in Chrome and anywhere FlowDoverz currently appears in the extension UI.</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Support email</label>
                <input
                  type="email"
                  required
                  value={brandEmail}
                  onChange={(e) => setBrandEmail(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="support@theirbrand.com"
                />
                <p className="mt-1 text-xs text-slate-500">Replaces contact emails in the fake credits overlay.</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Client sign-in page</label>
                <input
                  required
                  type="url"
                  value={brandLoginUrl}
                  onChange={(e) => setBrandLoginUrl(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="https://infinity-flow-tau.vercel.app/painel"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Exact page clients log into. Example: https://infinity-flow-tau.vercel.app/painel. That page must set the FlowDoverz login cookie after they sign in. Sync still talks to FlowDoverz in the background.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Dashboard page (optional)</label>
                <input
                  type="url"
                  value={brandDashboardUrl}
                  onChange={(e) => setBrandDashboardUrl(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Same as sign-in if left empty"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Popup Dashboard button opens this URL. Leave empty to use the same sign-in page.
                </p>
              </div>
              <div>
                <p className="mb-2 text-sm font-bold text-white">Logo</p>
                <input
                  ref={brandLogoInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="block w-full max-w-full cursor-pointer rounded-xl border border-white/15 bg-[#080810] px-3 py-3 text-sm text-white file:mb-2 file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-500 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-fuchsia-400 sm:file:mb-0 sm:file:mr-4 sm:file:px-4"
                  onChange={(e) => onBrandLogoPicked(e.target.files?.[0] || null)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Required. Replaces the FlowDoverz play icon in the popup and the Chrome extension icon. PNG, JPG, WEBP, or SVG. Max 400 KB.
                </p>
                {brandLogoError ? <p className="mt-2 text-sm font-semibold text-rose-400">{brandLogoError}</p> : null}
                {brandLogoName && !brandLogoError ? (
                  <p className="mt-2 text-sm font-semibold text-cyan-300">Selected: {brandLogoName}</p>
                ) : null}
                {brandLogoDataUrl ? (
                  <img src={brandLogoDataUrl} alt="Selected logo preview" className="mt-3 h-20 w-20 rounded-lg border border-cyan-400/50 object-contain bg-black/40" />
                ) : null}
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button type="button" onClick={() => setBrandTarget(null)} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300">
                  Cancel
                </button>
                <button type="submit" disabled={Boolean(generatingExtensionId)} className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-400 to-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-60">
                  {generatingExtensionId ? "Building..." : brandTarget.brandedExtension ? "Rebuild ZIP" : "Build ZIP"}
                </button>
              </div>
            </form>
          ) : null}
        </AdminGlassPanel>
      </AdminGlassModal>

      <AdminGlassModal open={Boolean(seatsTarget)} align="end" closeOnBackdrop onClose={() => setSeatsTarget(null)}>
        <AdminGlassPanel accent="emerald" sheet>
          {seatsTarget ? (
            <form onSubmit={addSeats} className="space-y-4">
              <div>
                <h2 className="text-xl font-black text-white">Add paid seats — {seatsTarget.brandName}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Use this after they send money. Example: they paid for 10 more users, enter 10. New signups then start a 30-day timer.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Now: {seatsTarget.userCount} used · {seatsTarget.remainingSeats} left · {seatsTarget.seatsPurchased || seatsTarget.maxUsers} paid
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Users paid for</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={seatCount}
                  onChange={(e) => setSeatCount(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Payment amount (optional)</label>
                <input value={seatPayment} onChange={(e) => setSeatPayment(e.target.value)} className={INPUT_CLASS} placeholder="e.g. 15000 PKR" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-400">Note (optional)</label>
                <input value={seatNote} onChange={(e) => setSeatNote(e.target.value)} className={INPUT_CLASS} placeholder="JazzCash / bank / invoice" />
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button type="button" onClick={() => setSeatsTarget(null)} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300">
                  Cancel
                </button>
                <button type="submit" disabled={addingSeats} className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-60">
                  {addingSeats ? "Adding..." : "Add seats"}
                </button>
              </div>
            </form>
          ) : null}
        </AdminGlassPanel>
      </AdminGlassModal>

      <AdminGlassModal open={Boolean(deleteTarget)} align="end" closeOnBackdrop onClose={() => setDeleteTarget(null)}>
        <AdminGlassPanel accent="rose" sheet>
          {deleteTarget ? (
            <>
              <h2 className="text-xl font-black text-white">Delete {deleteTarget.brandName}?</h2>
              <p className="mt-2 text-sm text-slate-400">Their API key stops working. Existing FlowDoverz users are not deleted.</p>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                <button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300">
                  Cancel
                </button>
                <button type="button" onClick={() => void removeReseller()} className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white">
                  Delete reseller
                </button>
              </div>
            </>
          ) : null}
        </AdminGlassPanel>
      </AdminGlassModal>
    </AdminPageLayout>
  );
}
