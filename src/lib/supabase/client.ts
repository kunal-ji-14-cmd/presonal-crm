"use client";
import { createBrowserClient } from "@supabase/ssr";

// The publishable key is designed for client-side use. Environment variables
// can override these defaults for local or deployment-specific configuration.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kftkcqbhnzybjacyfsoc.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_PUQIFXzqlF2Kx34wfcSM-Q_me2G8u08";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}