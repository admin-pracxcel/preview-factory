/**
 * lib/leads-store.ts
 * Per-lead storage — Supabase-backed (Phase 3).
 *
 * Public interface mirrors the previous file-based version; only the async
 * signatures had to change. Leads capture contact-form / call-click /
 * email-click events from rendered customer sites and store them for
 * dashboard display. n8n notification is fired-and-forgotten by the API
 * route, not here.
 */

import { supabase } from "@/lib/supabase";

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

const TABLE = "leads";

interface LeadRow {
  id: string;
  tenant_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  source: LeadSource | null;
  page: string | null;
  created_at: string;
}

function rowToRecord(row: LeadRow): LeadRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id ?? undefined,
    name: row.name ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    message: row.message ?? undefined,
    source: row.source ?? "contact-form",
    page: row.page ?? undefined,
    createdAt: row.created_at,
  };
}

/* ---------------------------------------------------------------- public API */

/** Persist a lead record. */
export async function saveLead(record: LeadRecord): Promise<void> {
  const row = {
    id: record.id,
    tenant_id: record.tenantId ?? null,
    name: record.name ?? null,
    phone: record.phone ?? null,
    email: record.email ?? null,
    message: record.message ?? null,
    source: record.source,
    page: record.page ?? null,
    created_at: record.createdAt,
  };
  const { error } = await supabase().from(TABLE).insert(row);
  if (error) {
    throw new Error(`saveLead(${record.id}) failed: ${error.message}`);
  }
}

/**
 * List leads newest-first. If `tenantId` is supplied, filter to that tenant.
 * Caps at 200 rows — dashboard shows top 20 anyway.
 */
export async function listLeads(tenantId?: string): Promise<LeadRecord[]> {
  let query = supabase()
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data, error } = await query;
  if (error) {
    throw new Error(`listLeads failed: ${error.message}`);
  }
  return (data ?? []).map((r) => rowToRecord(r as LeadRow));
}
