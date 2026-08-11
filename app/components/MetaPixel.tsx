"use client";

/**
 * app/components/MetaPixel.tsx
 *
 * Loads the Meta Pixel on the marketing host only.
 *
 * Same host gate as ClarityAnalytics — the root layout is shared with
 * every tenant preview host, and firing this pixel on customer sites
 * would send their visitors' page views to Launcharoo's Meta account.
 * That's a privacy leak AND would corrupt the ad-attribution data we're
 * trying to collect.
 *
 * Fires `PageView` on initial mount and on every subsequent client-side
 * route change — Next.js App Router navigates without a full document
 * reload, so `usePathname` is the correct trigger.
 *
 * The `<noscript>` image beacon from Meta's snippet is intentionally
 * omitted. Rendering it unconditionally would send a hit for JS-disabled
 * visitors on tenant sites too; making it host-gated would require
 * server-side host resolution and force the whole app dynamic. Modern
 * traffic is JS-enabled; the coverage loss is negligible.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PIXEL_ID = "1058897266852903";
const MARKETING_HOST = "launcharoo.online";

interface WindowWithFbq extends Window {
  fbq?: (...args: unknown[]) => void;
  _fbq?: unknown;
}

/** One-shot latch. Module-scope survives re-renders; the client boots once. */
let pixelInitialized = false;

function isMarketingHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.replace(/^www\./, "");
  return host === MARKETING_HOST;
}

/**
 * Fire a Meta standard event, host-gated. Safe to call from any client
 * component — no-ops on tenant hosts.
 *
 * Retries on a short delay if `window.fbq` isn't defined yet. React runs
 * child effects before parent effects, so a page-level useEffect that
 * calls trackPurchase can race ahead of MetaPixel's own useEffect that
 * sets up the fbq stub. Up to 10 retries × 100ms = 1s window, which
 * covers even the slowest cold mount.
 */
function track(
  eventName: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string },
): void {
  if (!isMarketingHost()) return;
  const attempt = (retriesLeft: number): void => {
    const w = window as WindowWithFbq;
    if (typeof w.fbq === "function") {
      if (options?.eventID) {
        w.fbq("track", eventName, params ?? {}, { eventID: options.eventID });
      } else {
        w.fbq("track", eventName, params ?? {});
      }
      return;
    }
    if (retriesLeft <= 0) return;
    setTimeout(() => attempt(retriesLeft - 1), 100);
  };
  attempt(10);
}

/** Fired when the user clicks a plan in the pricing modal. */
export function trackInitiateCheckout(input: {
  /** Plan value in AUD dollars (not cents). */
  value: number;
  /** Plan key, e.g. "growth-monthly". */
  planKey: string;
}): void {
  track("InitiateCheckout", {
    value: input.value,
    currency: "AUD",
    content_name: input.planKey,
  });
}

/** Fired on /welcome after Stripe redirects back. Deduped by sessionId. */
export function trackPurchase(input: {
  /** Plan value in AUD dollars (not cents). */
  value: number;
  /** Plan key, e.g. "growth-monthly". */
  planKey: string;
  /** Stripe checkout session id — used as event id so any future
   *  server-side CAPI event with the same id dedupes cleanly. */
  sessionId?: string;
}): void {
  track(
    "Purchase",
    {
      value: input.value,
      currency: "AUD",
      content_name: input.planKey,
    },
    input.sessionId ? { eventID: input.sessionId } : undefined,
  );
}

export default function MetaPixel(): null {
  const pathname = usePathname();

  useEffect(() => {
    const host = window.location.hostname.replace(/^www\./, "");
    if (host !== MARKETING_HOST) return;

    const w = window as WindowWithFbq;

    if (!pixelInitialized) {
      // Meta's standard bootstrap, transliterated so it doesn't fight
      // TypeScript. Sets up the fbq queue stub, injects fbevents.js,
      // then fires init.
      const stub = function (...args: unknown[]) {
        const q = (stub as unknown as { queue: unknown[][] }).queue;
        q.push(args);
      } as ((...args: unknown[]) => void) & {
        queue: unknown[][];
        loaded: boolean;
        version: string;
        push: unknown;
      };
      stub.queue = [];
      stub.push = stub;
      stub.loaded = true;
      stub.version = "2.0";
      w.fbq = stub;
      w._fbq = stub;

      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      const first = document.getElementsByTagName("script")[0];
      first?.parentNode?.insertBefore(script, first);

      w.fbq("init", PIXEL_ID);
      pixelInitialized = true;
    }

    w.fbq?.("track", "PageView");
  }, [pathname]);

  return null;
}
