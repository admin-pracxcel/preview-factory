/**
 * lib/supabase.ts
 *
 * Server-only Supabase client factory. The service_role key bypasses RLS,
 * so this module must never ship to the client — imports guarded at runtime.
 * Every persistent store in the repo (tenant-store, leads-store, and the
 * later phases' billing/domain modules) goes through this.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/supabase.ts imported from client code. Move the call into a server component or API route.",
  );
}

let cached: SupabaseClient | null = null;

/**
 * Return a shared server-side Supabase client. Lazy so importing this module
 * doesn't crash when env vars are absent (Next.js sometimes imports server
 * modules during build introspection where env isn't populated yet).
 */
export function supabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. " +
        "See supabase/README.md for setup and docs/env.md for the full registry.",
    );
  }

  cached = createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      // Named for Supabase logs so it's clear these come from the Vercel app.
      headers: { "x-application-name": "preview-factory-vercel" },
    },
  });
  return cached;
}
