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
  type StripeSubscription,
  type StripeInvoice,
} from "@/lib/stripe-client";
import { publishTenant } from "@/lib/publish";
import { supabase } from "@/lib/supabase";
import {
  applySubscriptionStatus,
  markPastDueBySubscription,
} from "@/lib/subscription-lifecycle";

export const runtime = "nodejs";

/**
 * Insert the event id into processed_events. Returns true if we're the first
 * (proceed), false if a duplicate delivery landed while we were mid-flight.
 * Any DB error is treated as "proceed" — we prefer occasional re-processing
 * over dropping a real event on a transient Postgres blip. publishTenant is
 * itself idempotent, so a double-run of a real event is safe.
 */
async function markEventProcessed(eventId: string): Promise<boolean> {
  const { error } = await supabase()
    .from("processed_events")
    .insert({ event_id: eventId, provider: "stripe" });
  if (!error) return true;
  // Postgres unique_violation → this event id is already in the table.
  if (error.code === "23505") return false;
  console.warn(`[webhook] processed_events insert warned (${error.code}): ${error.message}`);
  return true;
}

// Must read raw body before parsing to verify signature.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log(`[webhook] received event: ${event.type} (id=${event.id})`);

  const proceed = await markEventProcessed(event.id);
  if (!proceed) {
    console.log(`[webhook] duplicate delivery for ${event.id} — skipping`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as StripeCheckoutSessionCompleted;
      const tenantId = session.metadata?.tenantId;

      if (!tenantId) {
        console.error("[webhook] checkout.session.completed missing tenantId in metadata");
        // Return 200 so Stripe doesn't retry — this is a data issue.
        return NextResponse.json({ received: true, warning: "no tenantId in metadata" });
      }

      // Stripe stores the guest checkout email under customer_details.email on
      // a completed session. customer_email is only present if the merchant
      // pre-filled it. Fall through both.
      const ownerEmail =
        session.customer_details?.email ?? session.customer_email ?? undefined;

      try {
        const result = await publishTenant(tenantId, {
          stripeSessionId: session.id,
          stripeCustomerId: session.customer ?? undefined,
          stripeSubscriptionId: session.subscription ?? undefined,
          ownerEmail,
        });
        console.log(
          `[webhook] tenant ${tenantId} published. liveUrl=${result.liveUrl}${
            ownerEmail ? ` owner=${ownerEmail}` : ""
          }`
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

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as StripeSubscription;
      try {
        const { tenantId, patch } = await applySubscriptionStatus(sub.id, sub.status);
        if (!tenantId) {
          console.warn(
            `[webhook] ${event.type} sub=${sub.id} — no matching tenant, ignoring`
          );
          return NextResponse.json({ received: true, warning: "no tenant for subscription" });
        }
        console.log(
          `[webhook] ${event.type} tenant=${tenantId} sub=${sub.id} → status=${patch.status} (stripe=${sub.status})`
        );
        return NextResponse.json({ received: true, tenantId, status: patch.status });
      } catch (err) {
        console.error(`[webhook] ${event.type} failed:`, err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "subscription update failed" },
          { status: 500 }
        );
      }
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as StripeInvoice;
      if (!invoice.subscription) {
        // One-off invoice — no subscription to mark past_due. Ignore.
        return NextResponse.json({ received: true, ignored: "no subscription on invoice" });
      }
      try {
        const { tenantId } = await markPastDueBySubscription(invoice.subscription);
        if (!tenantId) {
          console.warn(
            `[webhook] invoice.payment_failed sub=${invoice.subscription} — no matching tenant`
          );
          return NextResponse.json({ received: true, warning: "no tenant for subscription" });
        }
        console.log(
          `[webhook] invoice.payment_failed tenant=${tenantId} sub=${invoice.subscription} → past_due`
        );
        return NextResponse.json({ received: true, tenantId, status: "past_due" });
      } catch (err) {
        console.error("[webhook] invoice.payment_failed failed:", err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "past_due mark failed" },
          { status: 500 }
        );
      }
    }

    default:
      // Unknown event type — acknowledge and ignore
      return NextResponse.json({ received: true, ignored: event.type });
  }
}
