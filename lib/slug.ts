/**
 * lib/slug.ts
 * Slug generation for the customer subdomain (<slug>.launcharoo.online).
 *
 * Rules:
 *   - lowercase, [a-z0-9-] only, no leading/trailing hyphens
 *   - 3-30 chars
 *   - collision handling: append -2, -3, ... up to -99
 *   - reserved names blocked (never allocated even if generated)
 */

import { supabase } from "@/lib/supabase";

const MIN_LEN = 3;
const MAX_LEN = 30;

/** Never allocate a slug that would shadow app or infra hosts. */
const RESERVED = new Set([
  "www",
  "api",
  "admin",
  "mail",
  "smtp",
  "imap",
  "status",
  "health",
  "dashboard",
  "login",
  "welcome",
  "expired",
  "preview",
  "checkout",
  "billing",
  "help",
  "support",
  "docs",
  "app",
  "auth",
  "static",
  "cdn",
  "assets",
  "media",
  "images",
  "img",
  "test",
  "staging",
  "dev",
  "beta",
  "demo",
  "launcharoo",
]);

/** Turn a business name into a candidate slug. May return "" if unusable. */
export function normaliseSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    // strip diacritics
    .replace(/[̀-ͯ]/g, "")
    // spaces + underscores + dots → hyphens
    .replace(/[\s._]+/g, "-")
    // strip anything not [a-z0-9-]
    .replace(/[^a-z0-9-]/g, "")
    // collapse multi-hyphens
    .replace(/-+/g, "-")
    // trim leading/trailing hyphens
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LEN);
}

/** Pad a too-short slug to the minimum length. */
function padShort(slug: string, salt: string): string {
  if (slug.length >= MIN_LEN) return slug;
  const seed = (slug || "site") + "-" + salt;
  return seed.slice(0, MAX_LEN);
}

/**
 * Check whether a slug is already taken. Returns true if free (or belongs to
 * `sameTenantId`, so updates don't self-conflict).
 */
async function isAvailable(slug: string, sameTenantId?: string): Promise<boolean> {
  const { data, error } = await supabase()
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`slug availability check failed: ${error.message}`);
  if (!data) return true;
  return sameTenantId !== undefined && data.id === sameTenantId;
}

/**
 * Reserve a unique slug for `tenantId` derived from `name`. Collisions get
 * a numeric suffix, capped at 99 to avoid the algorithm ever looping. On the
 * (extremely rare) 99-way collision, throws — the caller should surface a
 * "pick a different business name" error, not silently mint garbage.
 */
export async function reserveSlug(
  name: string,
  tenantId: string,
): Promise<string> {
  let base = normaliseSlug(name);
  if (!base) base = "site";
  base = padShort(base, tenantId.slice(0, 4));

  // Try the bare candidate first, then bare-2 .. bare-99.
  const candidates: string[] = [];
  if (!RESERVED.has(base)) candidates.push(base);
  for (let i = 2; i <= 99; i++) {
    const suffix = `-${i}`;
    const withSuffix = base.slice(0, MAX_LEN - suffix.length) + suffix;
    if (!RESERVED.has(withSuffix)) candidates.push(withSuffix);
  }

  for (const candidate of candidates) {
    if (await isAvailable(candidate, tenantId)) return candidate;
  }
  throw new Error(
    `Could not reserve a slug for "${name}" — 99 variants exhausted.`,
  );
}

/**
 * Look up a tenantId by slug. Returns null when not found.
 * Cheap enough to call per request; the Worker caches results in KV.
 */
export async function tenantIdBySlug(slug: string): Promise<string | null> {
  const { data, error } = await supabase()
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`tenant lookup by slug failed: ${error.message}`);
  return (data?.id as string | undefined) ?? null;
}
