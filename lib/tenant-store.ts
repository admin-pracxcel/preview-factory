/**
 * lib/tenant-store.ts
 * Per-tenant SiteProps store — Supabase-backed (Phase 3).
 *
 * Public interface mirrors the previous file-based version; only the async
 * signatures had to change. App-facing TenantStatus values are translated at
 * the boundary:
 *
 *   App       <->  DB
 *   -------------  ---------
 *   "preview" <->  "done"
 *   "paid"    <->  "claimed"
 *   "published" <->  "claimed"
 *
 * The paid-vs-published distinction is currently lossy at the DB layer — no
 * caller writes "paid" anyway. If we need it back, add a published_at column
 * and set it alongside claimed_at.
 */

import { supabase } from "@/lib/supabase";
import type { SiteProps } from "@/shared/types/site-props";

/* --------------------------------------------------------------------- types */

export type TenantStatus = "preview" | "paid" | "published";

type DBStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "claimed"
  | "past_due"
  | "cancelled"
  | "expired";

export interface TenantRecord {
  /** UUID generated at intake time. Used as the tenant/preview ID. */
  id: string;
  /** Business trading name. */
  name: string;
  /** Trade niche, e.g. "plumber", "electrician". */
  niche: string;
  /** Template category directory name, e.g. "trades", "allied-health". */
  category: string;
  /** Validated SiteProps blob. */
  siteProps: SiteProps;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 timestamp of the last row update. Sourced from Postgres's
   *  auto-maintained `updated_at`. Read-only — Postgres owns it. */
  updatedAt: string;
  /** Lifecycle status. */
  status: TenantStatus;
  /** Google place_id if the intake used the Places API; undefined for fixture. */
  placeId?: string;
  /** Original GBP photo URLs captured at intake. */
  gbpPhotos?: string[];
  /** ISO 8601 timestamp set when the site is published. */
  publishedAt?: string;
  /** Stripe Checkout session ID associated with the payment. */
  stripeSessionId?: string;
  /** Stripe customer ID for billing management. */
  stripeCustomerId?: string;
  /** Stripe subscription ID — retained separately so the customer portal, cancel
   *  flows, and past_due transitions have a stable reference (Phase 7.5a). */
  stripeSubscriptionId?: string;
  /** Owner email captured from the completed Checkout Session (Phase 7.5a).
   *  Used as the auth identity post-claim once magic-link login is wired. */
  ownerEmail?: string;
  /** True when the underlying DB status is 'expired' (Phase 8b reaper).
   *  Read-only, populated on load. Callers use it to redirect to /expired. */
  isExpired?: boolean;
  /** Public subdomain fragment: <slug>.launcharoo.online. Phase 10a. */
  slug?: string;
  /* -------------------- Custom domain fields (Phase 10b) -------------------- */
  /** Customer-supplied BYO domain (e.g. johnsplumbing.com.au). */
  customDomain?: string;
  /** Where we are in the setup flow. See lib/custom-domain.ts CustomDomainStatus. */
  customDomainStatus?: string;
  /** Cloudflare zone id, set once the zone is created in our account. */
  cloudflareZoneId?: string;
  /** Nameservers Cloudflare wants the customer to point their registrar at. */
  assignedNameservers?: string[];
  /** ISO 8601 of when SSL provisioned and the site went live at the custom domain. */
  customDomainVerifiedAt?: string;
  /** Snapshot of the customer's live DNS at the moment we scanned before
   *  taking over (Phase 10b-ii). Used to seed the new Cloudflare zone so
   *  their email keeps working after the nameserver flip. */
  dnsRecordsSnapshot?: unknown;
}

const TABLE = "tenants";

/* --------------------------------------------------------- status translation */

function toDbStatus(app: TenantStatus): DBStatus {
  switch (app) {
    case "preview":
      return "done";
    case "paid":
    case "published":
      return "claimed";
  }
}

function toAppStatus(db: DBStatus | null | undefined): TenantStatus {
  switch (db) {
    case "claimed":
    case "past_due":
    case "cancelled":
      return "published";
    default:
      // done | queued | running | failed — the UI treats them all as preview.
      return "preview";
  }
}

/* ------------------------------------------------------------- row <-> record */

interface TenantRow {
  id: string;
  session_id: string | null;
  category: string;
  status: DBStatus;
  site_props: SiteProps | null;
  created_at: string;
  updated_at: string;
  name: string | null;
  niche: string | null;
  place_id: string | null;
  gbp_photos: string[] | null;
  claimed_at: string | null;
  owner_email: string | null;
  billing_customer_id: string | null;
  billing_subscription_id: string | null;
  cancelled_at: string | null;
  slug: string | null;
  custom_domain: string | null;
  custom_domain_status: string | null;
  cloudflare_zone_id: string | null;
  assigned_nameservers: string[] | null;
  custom_domain_verified_at: string | null;
  dns_records_snapshot: unknown;
}

function rowToRecord(row: TenantRow): TenantRecord {
  return {
    id: row.id,
    name: row.name ?? row.site_props?.business?.name ?? "",
    niche: row.niche ?? "",
    category: row.category,
    siteProps: (row.site_props ?? {}) as SiteProps,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: toAppStatus(row.status),
    placeId: row.place_id ?? undefined,
    gbpPhotos: row.gbp_photos ?? undefined,
    publishedAt: row.claimed_at ?? undefined,
    stripeCustomerId: row.billing_customer_id ?? undefined,
    stripeSubscriptionId: row.billing_subscription_id ?? undefined,
    ownerEmail: row.owner_email ?? undefined,
    isExpired: row.status === "expired",
    slug: row.slug ?? undefined,
    customDomain: row.custom_domain ?? undefined,
    customDomainStatus: row.custom_domain_status ?? undefined,
    cloudflareZoneId: row.cloudflare_zone_id ?? undefined,
    assignedNameservers: row.assigned_nameservers ?? undefined,
    customDomainVerifiedAt: row.custom_domain_verified_at ?? undefined,
    dnsRecordsSnapshot: row.dns_records_snapshot ?? undefined,
  };
}

function recordToUpsert(record: TenantRecord): Record<string, unknown> {
  return {
    id: record.id,
    category: record.category,
    status: toDbStatus(record.status),
    site_props: record.siteProps,
    created_at: record.createdAt,
    name: record.name,
    niche: record.niche,
    place_id: record.placeId ?? null,
    gbp_photos: record.gbpPhotos ?? null,
    // claimed_at only set when the app-facing status implies claim
    claimed_at:
      record.status === "paid" || record.status === "published"
        ? record.publishedAt ?? new Date().toISOString()
        : null,
    billing_customer_id: record.stripeCustomerId ?? null,
    billing_subscription_id: record.stripeSubscriptionId ?? null,
    owner_email: record.ownerEmail ?? null,
    slug: record.slug ?? null,
    custom_domain: record.customDomain ?? null,
    custom_domain_status: record.customDomainStatus ?? null,
    cloudflare_zone_id: record.cloudflareZoneId ?? null,
    assigned_nameservers: record.assignedNameservers ?? null,
    custom_domain_verified_at: record.customDomainVerifiedAt ?? null,
    dns_records_snapshot: record.dnsRecordsSnapshot ?? null,
  };
}

/* ---------------------------------------------------------------- public API */

/** Persist a tenant record. Upserts on id. */
export async function saveTenant(record: TenantRecord): Promise<void> {
  const { error } = await supabase()
    .from(TABLE)
    .upsert(recordToUpsert(record), { onConflict: "id" });
  if (error) {
    throw new Error(`saveTenant(${record.id}) failed: ${error.message}`);
  }
}

/** Load a tenant by id. Returns null when not found. */
export async function getTenant(id: string): Promise<TenantRecord | null> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`getTenant(${id}) failed: ${error.message}`);
  }
  if (!data) return null;
  return rowToRecord(data as TenantRow);
}

/** Update the lifecycle status only. Throws if the tenant does not exist. */
export async function updateTenantStatus(
  id: string,
  status: TenantStatus,
): Promise<void> {
  const patch: Record<string, unknown> = { status: toDbStatus(status) };
  if (status === "paid" || status === "published") {
    patch.claimed_at = new Date().toISOString();
  }
  const { data, error } = await supabase()
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error(`updateTenantStatus(${id}) failed: ${error.message}`);
  }
  if (!data) throw new Error(`Tenant ${id} not found`);
}

/**
 * Create a tenant in status=queued for async generation (Phase 4). Skips the
 * TenantRecord path because a queued tenant has no site_props yet; the n8n
 * worker will fill it in and flip status=done.
 *
 * Returns the new tenant id. Later, /api/tenants/[id]/status polls the row
 * until status=done or =failed.
 */
export interface CreateQueuedTenantInput {
  category: string;
  name: string;
  niche: string;
  placeId?: string;
  gbpPhotos?: string[];
  sessionId?: string;
}

export async function createQueuedTenant(
  input: CreateQueuedTenantInput,
): Promise<string> {
  const { data, error } = await supabase()
    .from(TABLE)
    .insert({
      category: input.category,
      status: "queued",
      name: input.name,
      niche: input.niche,
      place_id: input.placeId ?? null,
      gbp_photos: input.gbpPhotos ?? null,
      session_id: input.sessionId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`createQueuedTenant failed: ${error?.message ?? "no row returned"}`);
  }
  return data.id as string;
}

/**
 * Lightweight summary used by the dashboard list view. We don't need to hydrate
 * full siteProps just to render a card, so this pulls only the visible fields.
 */
export interface TenantSummary {
  id: string;
  name: string;
  slug?: string;
  status: TenantStatus;
  customDomain?: string;
  customDomainStatus?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * List every tenant owned by this session, newest first. Used by /dashboard
 * to render the "your sites" grid. Magic-link verify rewires session_id
 * across all email-owned tenants, so this covers the cross-device case too.
 */
export async function listTenantsForSession(
  sessionId: string,
): Promise<TenantSummary[]> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select(
      "id, name, slug, status, custom_domain, custom_domain_status, created_at, updated_at",
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new Error(`listTenantsForSession failed: ${error.message}`);
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string | null) ?? "Untitled",
    slug: (row.slug as string | null) ?? undefined,
    status: toAppStatus(row.status as DBStatus),
    customDomain: (row.custom_domain as string | null) ?? undefined,
    customDomainStatus:
      (row.custom_domain_status as string | null) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string | null) ?? (row.created_at as string),
  }));
}

/**
 * List all tenant IDs, newest first. Caps at 1000 rows. Used only by admin
 * flows and legacy scripts.
 */
export async function listTenantIds(): Promise<string[]> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    throw new Error(`listTenantIds failed: ${error.message}`);
  }
  return (data ?? []).map((r) => r.id as string);
}
