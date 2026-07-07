/**
 * lib/subscription-lifecycle.ts
 * Maps Stripe subscription state transitions onto tenant rows.
 *
 * We keep this outside lib/tenant-store.ts because the tenant-store's
 * TenantStatus union is app-UI-facing (preview / paid / published) and doesn't
 * expose the past_due / cancelled substates. The webhook handler needs raw DB
 * access to write those.
 */

import { supabase } from "@/lib/supabase";

/** DB column value we write into tenants.status. Mirrors schema.sql. */
export type TenantDbStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "claimed"
  | "past_due"
  | "cancelled";

interface StatusPatch {
  /** Value for tenants.status. */
  status: TenantDbStatus;
  /** Verbatim Stripe subscription.status — persisted for observability. */
  subscription_status: string;
  /** Only set on the transition into cancelled. */
  cancelled_at?: string;
}

function mapSubscriptionStatus(stripeStatus: string): StatusPatch {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return { status: "claimed", subscription_status: stripeStatus };
    case "past_due":
      return { status: "past_due", subscription_status: stripeStatus };
    case "unpaid":
      // Stripe finalised dunning failure — treat as past_due until the
      // cancellation event lands. Some accounts skip straight to canceled.
      return { status: "past_due", subscription_status: stripeStatus };
    case "canceled":
      return {
        status: "cancelled",
        subscription_status: stripeStatus,
        cancelled_at: new Date().toISOString(),
      };
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      // Not reachable in the current checkout flow. Persist the subscription
      // status verbatim for observability but leave tenants.status untouched.
      return { status: "claimed", subscription_status: stripeStatus };
    default:
      return { status: "claimed", subscription_status: stripeStatus };
  }
}

/**
 * Apply a status transition based on a Stripe subscription id. No-op if we
 * can't find a tenant with that subscription id — normal for events from
 * subscriptions created outside our checkout flow, or for very old rows.
 */
export async function applySubscriptionStatus(
  subscriptionId: string,
  stripeStatus: string,
): Promise<{ tenantId: string | null; patch: StatusPatch }> {
  const patch = mapSubscriptionStatus(stripeStatus);

  const { data, error } = await supabase()
    .from("tenants")
    .update(patch)
    .eq("billing_subscription_id", subscriptionId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`applySubscriptionStatus(${subscriptionId}) failed: ${error.message}`);
  }
  return { tenantId: (data?.id as string | undefined) ?? null, patch };
}

/**
 * Shorthand used by invoice.payment_failed — always sets past_due regardless
 * of the current subscription status. Stripe will follow up with a
 * subscription.updated once dunning finishes; that event drives the terminal
 * transition.
 */
export async function markPastDueBySubscription(
  subscriptionId: string,
): Promise<{ tenantId: string | null }> {
  const { data, error } = await supabase()
    .from("tenants")
    .update({ status: "past_due", subscription_status: "past_due" })
    .eq("billing_subscription_id", subscriptionId)
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error(`markPastDueBySubscription(${subscriptionId}) failed: ${error.message}`);
  }
  return { tenantId: (data?.id as string | undefined) ?? null };
}
