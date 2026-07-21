/**
 * lib/addon-store.ts
 * Supabase-backed store for tenant addon subscriptions.
 *
 * Row lifecycle:
 *   1. `active`     — inserted when Stripe checkout.session.completed fires
 *                     with metadata.addonKey set.
 *   2. `past_due`   — Stripe invoice.payment_failed on the addon sub.
 *   3. `cancelled`  — Stripe customer.subscription.deleted (or cancelled
 *                     via the customer portal). Row stays as audit.
 *
 * Unique partial index in the schema means only ONE row per
 * (tenant_id, addon_key) can be `active` at a time. Cancel + resubscribe
 * creates a new row; historical rows remain visible for revenue analytics.
 */

import { supabase } from "@/lib/supabase";
import type { AddonKey, AddonPlanKey } from "@/lib/addon-plans";

const TABLE = "tenant_addons";

export type AddonSubscriptionStatus =
  | "active"
  | "past_due"
  | "cancelled";

export interface AddonSubscription {
  id: string;
  tenantId: string;
  addonKey: AddonKey;
  planKey: AddonPlanKey;
  status: AddonSubscriptionStatus;
  stripeSubscriptionId?: string;
  subscribedAt: string;
  cancelledAt?: string;
  onboardingData?: Record<string, unknown>;
  campaignsLiveAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface AddonRow {
  id: string;
  tenant_id: string;
  addon_key: AddonKey;
  plan_key: AddonPlanKey;
  status: AddonSubscriptionStatus;
  stripe_subscription_id: string | null;
  subscribed_at: string;
  cancelled_at: string | null;
  onboarding_data: Record<string, unknown> | null;
  campaigns_live_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToRecord(row: AddonRow): AddonSubscription {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    addonKey: row.addon_key,
    planKey: row.plan_key,
    status: row.status,
    stripeSubscriptionId: row.stripe_subscription_id ?? undefined,
    subscribedAt: row.subscribed_at,
    cancelledAt: row.cancelled_at ?? undefined,
    onboardingData: row.onboarding_data ?? undefined,
    campaignsLiveAt: row.campaigns_live_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ---------------------------------------------------------------- writes */

export interface CreateAddonSubscriptionInput {
  tenantId: string;
  addonKey: AddonKey;
  planKey: AddonPlanKey;
  stripeSubscriptionId?: string;
}

/**
 * Insert an addon subscription row. Called from the Stripe webhook after
 * checkout.session.completed for an addon session. Idempotent-ish:
 * if there's already an active row for (tenant, addon), we UPDATE it to
 * point at the new subscription instead of hitting the unique-index
 * conflict. That handles the "customer subscribed, cancelled, subscribed
 * again immediately before cancellation propagated" edge case cleanly.
 */
export async function createOrRefreshAddonSubscription(
  input: CreateAddonSubscriptionInput,
): Promise<AddonSubscription> {
  const client = supabase();
  const now = new Date().toISOString();

  const { data: existing, error: lookupErr } = await client
    .from(TABLE)
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("addon_key", input.addonKey)
    .eq("status", "active")
    .maybeSingle();
  if (lookupErr) {
    throw new Error(`addon-store lookup failed: ${lookupErr.message}`);
  }

  if (existing) {
    const { data: updated, error: updateErr } = await client
      .from(TABLE)
      .update({
        plan_key: input.planKey,
        stripe_subscription_id: input.stripeSubscriptionId ?? null,
        subscribed_at: now,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (updateErr) {
      throw new Error(`addon-store refresh failed: ${updateErr.message}`);
    }
    return rowToRecord(updated as AddonRow);
  }

  const { data: created, error: insertErr } = await client
    .from(TABLE)
    .insert({
      tenant_id: input.tenantId,
      addon_key: input.addonKey,
      plan_key: input.planKey,
      status: "active",
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
      subscribed_at: now,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (insertErr) {
    throw new Error(`addon-store insert failed: ${insertErr.message}`);
  }
  return rowToRecord(created as AddonRow);
}

/**
 * Update the status of every addon row matching a Stripe subscription id.
 * Returns the tenantId of the affected row (or null if we've never seen
 * this subscription — the event is for a main-plan sub, not an addon).
 */
export async function applyAddonSubscriptionStatus(
  subscriptionId: string,
  stripeStatus: string,
): Promise<{ tenantId: string; addonKey: AddonKey } | null> {
  const client = supabase();
  const { data: row, error: lookupErr } = await client
    .from(TABLE)
    .select("id, tenant_id, addon_key")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (lookupErr) {
    throw new Error(`addon-store lookup by sub failed: ${lookupErr.message}`);
  }
  if (!row) return null;

  const now = new Date().toISOString();
  const nextStatus = mapStripeStatus(stripeStatus);
  const patch: Record<string, unknown> = {
    status: nextStatus,
    updated_at: now,
  };
  if (nextStatus === "cancelled") patch.cancelled_at = now;

  const { error: updateErr } = await client
    .from(TABLE)
    .update(patch)
    .eq("id", row.id);
  if (updateErr) {
    throw new Error(`addon-store status update failed: ${updateErr.message}`);
  }

  return {
    tenantId: row.tenant_id as string,
    addonKey: row.addon_key as AddonKey,
  };
}

function mapStripeStatus(stripe: string): AddonSubscriptionStatus {
  switch (stripe) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "cancelled";
    default:
      return "past_due";
  }
}

/* ----------------------------------------------------------------- reads */

/** All addon rows for a tenant, newest-first. Includes cancelled rows. */
export async function listAddonsForTenant(
  tenantId: string,
): Promise<AddonSubscription[]> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("subscribed_at", { ascending: false });
  if (error) {
    throw new Error(`addon-store list failed: ${error.message}`);
  }
  return (data ?? []).map((r) => rowToRecord(r as AddonRow));
}

/** Just the currently-active addons for a tenant. */
export async function listActiveAddonsForTenant(
  tenantId: string,
): Promise<AddonSubscription[]> {
  const { data, error } = await supabase()
    .from(TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("subscribed_at", { ascending: false });
  if (error) {
    throw new Error(`addon-store list-active failed: ${error.message}`);
  }
  return (data ?? []).map((r) => rowToRecord(r as AddonRow));
}
