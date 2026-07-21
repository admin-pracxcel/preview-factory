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
export interface PublishInput {
  stripeSessionId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  ownerEmail?: string;
  /** Plan the tenant chose in the picker before checkout. One of the
   *  `PlanKey` values from `lib/plans.ts`. Persisted on the tenant so the
   *  quota checks and dashboard billing card have a stable reference. */
  planKey?: string;
}

export async function publishTenant(
  tenantId: string,
  input: PublishInput = {},
): Promise<PublishResult> {
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  const publishedAt = tenant.publishedAt ?? new Date().toISOString();

  console.log(
    `[publish] tenant=${tenantId} input.planKey=${input.planKey ?? "(none)"} existing.planKey=${tenant.planKey ?? "(none)"}`,
  );

  await saveTenant({
    ...tenant,
    status: "published",
    publishedAt,
    ...(input.stripeSessionId ? { stripeSessionId: input.stripeSessionId } : {}),
    ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
    ...(input.stripeSubscriptionId ? { stripeSubscriptionId: input.stripeSubscriptionId } : {}),
    ...(input.ownerEmail ? { ownerEmail: input.ownerEmail.toLowerCase() } : {}),
    ...(input.planKey ? { planKey: input.planKey } : {}),
  });

  const liveUrl = `/preview/site/${tenantId}`;

  return { tenantId, name: tenant.name, liveUrl, publishedAt };
}
