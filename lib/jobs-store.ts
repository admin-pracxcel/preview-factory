/**
 * lib/jobs-store.ts
 * Generation-job queue (Phase 4).
 *
 * Every intake enqueues a job row here; n8n's generate workflow drains the
 * queue via a webhook (fast path) and a 30s cron (recovery path). The DB is
 * the source of truth — the webhook is just a "poke".
 */

import { supabase } from "@/lib/supabase";

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface EnqueueJobInput {
  tenantId: string;
  /** The generator CLI payload (see generator/cli.ts). Opaque here. */
  payload: unknown;
}

/**
 * Insert a new job in status=queued and return its id.
 */
export async function enqueueJob(input: EnqueueJobInput): Promise<string> {
  const { data, error } = await supabase()
    .from("jobs")
    .insert({
      tenant_id: input.tenantId,
      status: "queued",
      payload: input.payload,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`enqueueJob(${input.tenantId}) failed: ${error?.message ?? "no row returned"}`);
  }
  return data.id as string;
}
