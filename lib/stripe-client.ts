/**
 * lib/stripe-client.ts
 * Stripe Checkout helpers — pure fetch, no npm package required.
 *
 * Key resolution:
 *   STRIPE_SECRET_KEY  → real Stripe API calls (test mode: sk_test_...)
 *   Not set            → mock mode: returns a local mock-success URL
 *
 * Human deploy note:
 *   1. Create a Stripe account (stripe.com).
 *   2. In test mode, go to Developers → API Keys → copy Secret key.
 *   3. Set STRIPE_SECRET_KEY=sk_test_... in your .env.local / Vercel env vars.
 *   4. Optionally set STRIPE_PRICE_ID to a pre-created recurring price (AUD, $49/mo).
 *   5. For webhooks: set STRIPE_WEBHOOK_SECRET (from Stripe CLI or dashboard).
 *   6. Set NEXT_PUBLIC_BASE_URL=https://yourapp.vercel.app (no trailing slash).
 *   See strategy/_master/deployment-checklist.md section "Stripe".
 */

import { createHmac } from "node:crypto";
import { priceFor, type PlanKey } from "@/lib/plans";

/* -------------------------------------------------------------------- types */

export interface CheckoutResult {
  /** URL to redirect the user to (Stripe hosted page or local mock). */
  url: string;
  /** Stripe session ID; undefined in mock mode. */
  sessionId?: string;
  /** True if STRIPE_SECRET_KEY was not set and mock mode was used. */
  mock: boolean;
}

/* -------------------------------------------------------- public functions */

/**
 * Create a Stripe Checkout session for a tenant subscription.
 * Returns a mock URL if STRIPE_SECRET_KEY is not configured.
 */
export async function createCheckoutSession(
  tenantId: string,
  businessName: string,
  baseUrl: string,
  planKey: PlanKey
): Promise<CheckoutResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    console.warn("[stripe-client] STRIPE_SECRET_KEY not set — mock checkout.");
    return {
      url: `${baseUrl}/api/checkout/mock-success?tenantId=${encodeURIComponent(tenantId)}&planKey=${encodeURIComponent(planKey)}`,
      mock: true,
    };
  }

  const successUrl = `${baseUrl}/welcome/${encodeURIComponent(tenantId)}`;
  const cancelUrl = `${baseUrl}/preview/${encodeURIComponent(tenantId)}`;
  const price = priceFor(planKey);

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("metadata[tenantId]", tenantId);
  params.set("metadata[businessName]", businessName);
  // Recorded so the webhook can persist which plan the tenant subscribed
  // to without needing to reverse-map the priceId back to a tier.
  params.set("metadata[planKey]", planKey);

  if (price.priceId) {
    params.set("line_items[0][price]", price.priceId);
    params.set("line_items[0][quantity]", "1");
  } else {
    // Fallback: inline price_data when the tier's STRIPE_PRICE_* env var
    // hasn't been configured yet. Lets the tier flow run end-to-end
    // pre-Stripe-setup without breaking.
    params.set("line_items[0][price_data][currency]", "aud");
    params.set("line_items[0][price_data][unit_amount]", String(price.unitAmount));
    params.set("line_items[0][price_data][recurring][interval]", price.interval);
    params.set(
      "line_items[0][price_data][product_data][name]",
      `Launcharoo ${price.tierName} — ${businessName}`
    );
    params.set(
      "line_items[0][price_data][product_data][description]",
      "Your local business website, hosted and maintained."
    );
    params.set("line_items[0][quantity]", "1");
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stripe Checkout creation failed: ${res.status} ${err}`);
  }

  const session = (await res.json()) as { id: string; url: string };
  return { url: session.url, sessionId: session.id, mock: false };
}

/**
 * Verify a Stripe webhook signature.
 * Returns null on success, or an error string if verification fails.
 *
 * Stripe-Signature header format: t=<timestamp>,v1=<sig>,v1=<sig2>,...
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string
): string | null {
  // Parse the header
  const parts: Record<string, string[]> = {};
  for (const segment of signatureHeader.split(",")) {
    const idx = segment.indexOf("=");
    if (idx === -1) continue;
    const k = segment.slice(0, idx);
    const v = segment.slice(idx + 1);
    if (!parts[k]) parts[k] = [];
    parts[k].push(v);
  }

  const timestamp = parts["t"]?.[0];
  const signatures = parts["v1"] ?? [];

  if (!timestamp || !signatures.length) {
    return "Invalid Stripe-Signature header";
  }

  // Reject stale events (> 5 min)
  const tolerance = 5 * 60;
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > tolerance) {
    return `Webhook timestamp out of tolerance (${Math.abs(now - ts)}s)`;
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  if (!signatures.includes(expected)) {
    return "Webhook signature mismatch";
  }

  return null;
}

/* --------------------------------------------------------- Stripe event types */

export interface StripeCheckoutSessionCompleted {
  id: string;
  object: "checkout.session";
  customer: string | null;
  metadata: Record<string, string>;
  payment_status: string;
  subscription: string | null;
  /** Optional field: only set when the merchant passed it on the session. */
  customer_email: string | null;
  /** Always populated by Stripe on a completed session — this is where the
   *  guest checkout email lives. Prefer this over customer_email. */
  customer_details: {
    email: string | null;
  } | null;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

/**
 * Subset of Stripe's Subscription object we care about. Phase 8 uses this to
 * mirror lifecycle state (active / past_due / canceled) onto the tenant row.
 */
export interface StripeSubscription {
  id: string;
  object: "subscription";
  customer: string;
  status:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "incomplete"
    | "incomplete_expired"
    | "paused";
  /** Unix seconds. Set when Stripe finalises the cancellation. */
  canceled_at: number | null;
  /** Unix seconds. Only set when the customer scheduled a future cancel. */
  cancel_at: number | null;
  cancel_at_period_end: boolean;
  /** Unix seconds. Start of the current billing period (~= last paid date). */
  current_period_start?: number | null;
  /** Unix seconds. End of the current billing period (~= next bill date). */
  current_period_end?: number | null;
  /** Unix seconds. When the subscription first became active. */
  start_date?: number | null;
  /** Currency + unit amount for the primary plan item, if available. */
  items?: {
    data?: Array<{
      price?: {
        unit_amount?: number | null;
        currency?: string | null;
        recurring?: { interval?: string | null } | null;
      } | null;
    }>;
  };
}

/**
 * Retrieve a Stripe subscription by id. Returns null if the id is falsy, the
 * API key is missing, or Stripe returns non-2xx. Never throws — the admin
 * view degrades gracefully if Stripe is down.
 */
export async function retrieveSubscription(
  subscriptionId: string | null | undefined,
): Promise<StripeSubscription | null> {
  if (!subscriptionId) return null;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;

  try {
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(
        subscriptionId,
      )}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      console.warn(
        `[stripe-client] retrieveSubscription(${subscriptionId}) failed: ${res.status}`,
      );
      return null;
    }
    return (await res.json()) as StripeSubscription;
  } catch (err) {
    console.warn(
      `[stripe-client] retrieveSubscription(${subscriptionId}) threw:`,
      err,
    );
    return null;
  }
}

/**
 * Subset of Stripe's Invoice object. Only invoice.payment_failed carries
 * the subscription id we need to look the tenant up by.
 */
export interface StripeInvoice {
  id: string;
  object: "invoice";
  customer: string | null;
  subscription: string | null;
}
