/**
 * app/api/webhooks/stripe/route.ts
 * POST /api/webhooks/stripe
 *
 * Stripe webhook handler. Listens for payment events and publishes the tenant
 * site when checkout completes.
 *
 * Signature verification:
 *   STRIPE_WEBHOOK_SECRET set   → verifies every request (required in production)
 *   STRIPE_WEBHOOK_SECRET unset → skips verification (dev convenience only)
 *
 * Human deploy note:
 *   1. In Stripe dashboard → Developers → Webhooks → Add endpoint.
 *      URL: https://yourapp.vercel.app/api/webhooks/stripe
 *      Events: checkout.session.completed
 *   2. Copy the signing secret and set STRIPE_WEBHOOK_SECRET in your env vars.
 *   3. For local testing: stripe listen --forward-to localhost:3000/api/webhooks/stripe
 *   See strategy/_master/deployment-checklist.md section "Stripe webhooks".
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  type StripeEvent,
  type StripeCheckoutSessionCompleted,
} from "@/lib/stripe-client";
import { publishTenant } from "@/lib/publish";

export const runtime = "nodejs";

// Must read raw body before parsing to verify signature.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Verify signature if secret is configured
  if (webhookSecret) {
    if (!signatureHeader) {
      return NextResponse.json({ error: "Missing Stripe-Signature header" }, { status: 400 });
    }
    const verifyError = verifyWebhookSignature(rawBody, signatureHeader, webhookSecret);
    if (verifyError) {
      console.error(`[webhook] signature verification failed: ${verifyError}`);
      return NextResponse.json({ error: verifyError }, { status: 400 });
    }
  } else {
    console.warn(
      "[webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev mode)"
    );
  }

  // Parse event
  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log(`[webhook] received event: ${event.type} (id=${event.id})`);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as StripeCheckoutSessionCompleted;
      const tenantId = session.metadata?.tenantId;

      if (!tenantId) {
        console.error("[webhook] checkout.session.completed missing tenantId in metadata");
        // Return 200 so Stripe doesn't retry — this is a data issue, not a transient error
        return NextResponse.json({ received: true, warning: "no tenantId in metadata" });
      }

      try {
        const result = await publishTenant(
          tenantId,
          session.id,
          session.customer ?? undefined
        );
        console.log(
          `[webhook] tenant ${tenantId} published. liveUrl=${result.liveUrl}`
        );
      } catch (err) {
        console.error(`[webhook] publishTenant failed for ${tenantId}:`, err);
        // Return 500 so Stripe retries
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Publish failed" },
          { status: 500 }
        );
      }

      return NextResponse.json({ received: true, tenantId });
    }

    default:
      // Unknown event type — acknowledge and ignore
      return NextResponse.json({ received: true, ignored: event.type });
  }
}
