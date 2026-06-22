/**
 * lib/leads-store.ts
 * Per-lead storage — file-based for local development.
 *
 * Production swap: replace saveLead / listLeads with Supabase inserts/queries
 * targeting the `leads` table defined in strategy/_master/supabase-schema.sql.
 *
 * Human deploy note: set SUPABASE_URL + SUPABASE_SERVICE_KEY and swap these
 * two functions. See strategy/_master/deployment-checklist.md section "Leads".
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";

/* --------------------------------------------------------------------- types */

export type LeadSource = "contact-form" | "call-click" | "email-click";

export interface LeadRecord {
  /** UUID generated at capture time. */
  id: string;
  /** Tenant (site) the lead came from; undefined if from a static demo. */
  tenantId?: string;
  /** Submitter's name. */
  name?: string;
  /** Phone number as entered. */
  phone?: string;
  /** Email address (lowercased). */
  email?: string;
  /** Free-text message from the form. */
  message?: string;
  /** How the lead was captured. */
  source: LeadSource;
  /** URL path the lead was captured from. */
  page?: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
}

/* ------------------------------------------------------------------ file store */

const DATA_DIR = join(process.cwd(), "data", "leads");

function ensureDir(): void {
  mkdirSync(DATA_DIR, { recursive: true });
}

/** Persist a lead record. */
export function saveLead(record: LeadRecord): void {
  ensureDir();
  writeFileSync(
    join(DATA_DIR, `${record.id}.json`),
    JSON.stringify(record, null, 2),
    "utf8"
  );
}

/**
 * List all leads, newest first.
 * If `tenantId` is supplied, filter to that tenant only.
 */
export function listLeads(tenantId?: string): LeadRecord[] {
  ensureDir();
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const leads = files
    .map((f) => {
      try {
        return JSON.parse(
          readFileSync(join(DATA_DIR, f), "utf8")
        ) as LeadRecord;
      } catch {
        return null;
      }
    })
    .filter((l): l is LeadRecord => l !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return tenantId ? leads.filter((l) => l.tenantId === tenantId) : leads;
}
