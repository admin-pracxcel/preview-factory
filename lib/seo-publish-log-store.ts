/**
 * lib/seo-publish-log-store.ts
 *
 * Append-only audit log for every SEO automation attempt (blog + gbp),
 * used for debugging + monthly reporting. Never read on the hot path.
 */

import { supabase } from "@/lib/supabase";

const TABLE = "seo_publish_log";

export type SeoAutomationKind = "blog" | "gbp";

async function insert(row: {
  tenant_id: string;
  kind: SeoAutomationKind;
  status: "success" | "skipped" | "failed";
  reason?: string;
  blog_post_id?: string;
}): Promise<void> {
  const { error } = await supabase().from(TABLE).insert({
    tenant_id: row.tenant_id,
    kind: row.kind,
    status: row.status,
    reason: row.reason ?? null,
    blog_post_id: row.blog_post_id ?? null,
  });
  if (error) throw new Error(`seo_publish_log insert: ${error.message}`);
}

export async function logSuccess(input: {
  tenantId: string;
  kind: SeoAutomationKind;
  blogPostId?: string;
}): Promise<void> {
  await insert({
    tenant_id: input.tenantId,
    kind: input.kind,
    status: "success",
    blog_post_id: input.blogPostId,
  });
}

export async function logSkipped(input: {
  tenantId: string;
  kind: SeoAutomationKind;
  reason: string;
}): Promise<void> {
  await insert({
    tenant_id: input.tenantId,
    kind: input.kind,
    status: "skipped",
    reason: input.reason,
  });
}

export async function logFailed(input: {
  tenantId: string;
  kind: SeoAutomationKind;
  reason: string;
}): Promise<void> {
  await insert({
    tenant_id: input.tenantId,
    kind: input.kind,
    status: "failed",
    reason: input.reason,
  });
}
