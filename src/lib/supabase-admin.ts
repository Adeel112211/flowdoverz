import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseAdmin: SupabaseClient | null = null;
let initAttempted = false;
let lastInitError: string | null = null;

export function isSupabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function getSupabaseInitError() {
  return lastInitError;
}

export function useSupabaseDatabase() {
  const provider = process.env.DATABASE_PROVIDER?.trim().toLowerCase();
  if (provider === "firebase") return false;
  if (provider === "supabase") return isSupabaseConfigured();
  return isSupabaseConfigured();
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (initAttempted) return supabaseAdmin;
  initAttempted = true;
  lastInitError = null;

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    lastInitError =
      "Supabase env vars missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.";
    return null;
  }

  try {
    supabaseAdmin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return supabaseAdmin;
  } catch (error) {
    lastInitError =
      error instanceof Error ? error.message : "Supabase initialization failed.";
    supabaseAdmin = null;
    return null;
  }
}

export const STORAGE_BUCKETS = {
  extensionFiles: "extension-files",
  paymentScreenshots: "payment-screenshots",
  resellerPacks: "reseller-packs",
  resellerLogos: "reseller-logos",
} as const;
