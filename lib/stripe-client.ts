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
  baseUrl: string
): Promise<CheckoutResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    console.warn("[stripe-client] STRIPE_SECRET_KEY not set — mock checkout.");
    return {
      url: `${baseUrl}/api/checkout/mock-success?tenantId=${encodeURIComponent(tenantId)}`,
      mock: true,
    };
  }

  const successUrl = `${baseUrl}/welcome/${encodeURIComponent(tenantId)}`;
  const cancelUrl = `${baseUrl}/preview/${encodeURIComponent(tenantId)}`;
  const priceId = process.env.STRIPE_PRICE_ID;

  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("metadata[tenantId]", tenantId);
  params.set("metadata[businessName]", businessName);

  if (priceId) {
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", "1");
  } else {
    // Dynamic price: $49/mo AUD
    params.set("line_items[0][price_data][currency]", "aud");
    params.set("line_items[0][price_data][unit_amount]", "4900");
    params.set("line_items[0][price_data][recurring][interval]", "month");
    params.set(
      "line_items[0][price_data][product_data][name]",
      `Preview Factory — ${businessName}`
    );
    params.set("line_items[0][price_data][product_data][description]",
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
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: unknown };
}
