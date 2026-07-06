/**
 * lib/edit-requests-store.ts
 * Storage for plain-English edit requests submitted via the client dashboard.
 *
 * Phase 7: migrated from `data/edit-requests/*.json` to Supabase so the app
 * can run on Vercel (read-only filesystem). Public API is the same shape but
 * now async — call sites had to add `await`.
 *
 * Phase K wrote the record. Phase L extended it with the mutation + approval
 * engine (proposed_site_props, change_summary, preview/applied/rejected states).
 */

import { supabase } from "@/lib/supabase";
import type { SiteProps } from "@/shared/types/site-props";

/* --------------------------------------------------------------------- types */

export type EditRequestStatus =
  | "pending"    // submitted, not yet processed
  | "processing" // Phase L engine is mutating SiteProps
  | "preview"    // mutation complete, awaiting owner approval
  | "applied"    // owner approved, site published with change
  | "rejected"   // owner rejected the change
  | "error";     // processing failed

export interface EditRequest {
  id: string;
  tenantId: string;
  /** Plain-English description of the requested change. */
  request: string;
  status: EditRequestStatus;
  createdAt: string;
  /** ISO timestamp when the request was applied or rejected. */
  resolvedAt?: string;
  /** Brief summary of what changed (set by Phase L engine). */
  changeSummary?: string;
  /** The proposed updated SiteProps — present when status is "preview". */
  proposedSiteProps?: SiteProps;
}

const TABLE = "edit_requests";

interface EditRequestRow {
  id: string;
  tenant_id: string;
  request: string;
  status: EditRequestStatus;
  created_at: string;
  resolved_at: string | null;
  change_summary: string | null;
  proposed_site_props: SiteProps | null;
}

function rowToRecord(row: EditRequestRow): EditRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    request: row.request,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
    changeSummary: row.change_summary ?? undefined,
    proposedSiteProps: row.proposed_site_props ?? undefined,
  };
}

/* ---------------------------------------------------------------- public API */

/**
 * Upsert an edit request. Same primary-key semantics as the file-based store:
 * calling with the same `id` overwrites the row.
 */
export async function saveEditRequest(record: EditRequest): Promise<void> {
  const row = {
    id: record.id,
    tenant_id: record.tenantId,
    request: record.request,
    status: record.status,
    created_at: record.createdAt,
    resolved_at: record.resolvedAt ?? null,
    change_summary: record.changeSummary ?? null,
    proposed_site_props: record.proposedSiteProps ?? null,
  };
  const { error } = await supabase().from(TABLE).upsert(row);
  if (error) {
    throw new Error(`saveEditRequest(${record.id}) failed: ${error.message}`);
  }
}

export async function getEditRequest(id: string): Promise<EditRequest | null> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`getEditRequest(${id}) failed: ${error.message}`);
  }
  if (!data) return null;
  return rowToRecord(data as EditRequestRow);
}

/** List edit requests for a tenant, newest first. */
export async function listEditRequests(tenantId: string): Promise<EditRequest[]> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new Error(`listEditRequests(${tenantId}) failed: ${error.message}`);
  }
  return (data ?? []).map((r) => rowToRecord(r as EditRequestRow));
}
