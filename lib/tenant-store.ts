/**
 * lib/tenant-store.ts
 * Per-tenant SiteProps store — file-based for local development.
 *
 * Production swap: set SUPABASE_URL + SUPABASE_SERVICE_KEY and replace the
 * read/write functions with @supabase/supabase-js calls. See
 * strategy/_master/deployment-checklist.md section "Supabase".
 *
 * The interface is intentionally narrow so the swap is a single-file change.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { SiteProps } from "@/shared/types/site-props";

/* --------------------------------------------------------------------- types */

export type TenantStatus = "preview" | "paid" | "published";

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
  /** Lifecycle status. */
  status: TenantStatus;
  /** Google place_id if the intake used the Places API; undefined for fixture. */
  placeId?: string;
}

/* ------------------------------------------------------------------ file store */

const DATA_DIR = join(process.cwd(), "data", "tenants");

function ensureDir(): void {
  mkdirSync(DATA_DIR, { recursive: true });
}

/** Persist a tenant record. Overwrites any existing record with the same id. */
export function saveTenant(record: TenantRecord): void {
  ensureDir();
  writeFileSync(
    join(DATA_DIR, `${record.id}.json`),
    JSON.stringify(record, null, 2),
    "utf8"
  );
}

/** Load a tenant by id. Returns null if not found or unreadable. */
export function getTenant(id: string): TenantRecord | null {
  ensureDir();
  const path = join(DATA_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as TenantRecord;
  } catch {
    return null;
  }
}

/** Update the status field only. Throws if the tenant does not exist. */
export function updateTenantStatus(id: string, status: TenantStatus): void {
  const record = getTenant(id);
  if (!record) throw new Error(`Tenant ${id} not found`);
  saveTenant({ ...record, status });
}

/** List all tenant IDs in the store. */
export function listTenantIds(): string[] {
  ensureDir();
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}
