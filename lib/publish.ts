/**
 * lib/publish.ts
 * Marks a tenant's site as published and returns the live URL.
 *
 * In this repo "publish" means:
 *   1. status = "published"
 *   2. publishedAt timestamp recorded
 *   3. The site is permanently accessible at /preview/site/<tenantId>
 *
 * Production wiring (human deploy note):
 *   - Map <slug>.mysitehq.com.au → /preview/site/<tenantId> via a Vercel
 *     rewrite rule or edge-config hostname lookup.
 *   - Or trigger a Vercel deploy-hook to generate a static snapshot.
 *   - See strategy/_master/deployment-checklist.md section "Publishing sites".
 */

import { getTenant, saveTenant } from "@/lib/tenant-store";

export interface PublishResult {
  tenantId: string;
  name: string;
  /** The canonical live URL — /preview/site/<id> in dev; subdomain in prod. */
  liveUrl: string;
  publishedAt: string;
}

/**
 * Publish a tenant's site.
 * Idempotent — safe to call multiple times (e.g. webhook retries).
 */
export function publishTenant(
  tenantId: string,
  stripeSessionId?: string,
  stripeCustomerId?: string
): PublishResult {
  const tenant = getTenant(tenantId);
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  const publishedAt = tenant.publishedAt ?? new Date().toISOString();

  saveTenant({
    ...tenant,
    status: "published",
    publishedAt,
    ...(stripeSessionId ? { stripeSessionId } : {}),
    ...(stripeCustomerId ? { stripeCustomerId } : {}),
  });

  const liveUrl = `/preview/site/${tenantId}`;

  return { tenantId, name: tenant.name, liveUrl, publishedAt };
}
