/**
 * lib/edit-requests-store.ts
 * Storage for plain-English edit requests submitted via the client dashboard.
 *
 * Phase K: stores requests. Phase L: adds the mutation + approval engine.
 *
 * Production swap: replace with Supabase inserts to an edit_requests table.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";

/* --------------------------------------------------------------------- types */

export type EditRequestStatus =
  | "pending"    // submitted, not yet processed
  | "processing" // Phase L engine is mutating SiteProps
  | "preview"    // mutation complete, awaiting owner approval
  | "applied"    // owner approved, site published with change
  | "rejected";  // owner rejected the change

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
}

/* ------------------------------------------------------------------ store */

const DATA_DIR = join(process.cwd(), "data", "edit-requests");

function ensureDir(): void {
  mkdirSync(DATA_DIR, { recursive: true });
}

export function saveEditRequest(record: EditRequest): void {
  ensureDir();
  writeFileSync(
    join(DATA_DIR, `${record.id}.json`),
    JSON.stringify(record, null, 2),
    "utf8"
  );
}

export function getEditRequest(id: string): EditRequest | null {
  ensureDir();
  const path = join(DATA_DIR, `${id}.json`);
  try {
    return JSON.parse(readFileSync(path, "utf8")) as EditRequest;
  } catch {
    return null;
  }
}

/** List edit requests for a tenant, newest first. */
export function listEditRequests(tenantId: string): EditRequest[] {
  ensureDir();
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(
          readFileSync(join(DATA_DIR, f), "utf8")
        ) as EditRequest;
      } catch {
        return null;
      }
    })
    .filter((r): r is EditRequest => r !== null && r.tenantId === tenantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
