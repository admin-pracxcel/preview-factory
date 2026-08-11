"use client";

/**
 * app/components/GoogleTagManager.tsx
 *
 * Loads Google Tag Manager on the marketing host only.
 *
 * Same host gate as ClarityAnalytics + MetaPixel. GTM is a *tag manager* —
 * anything configured inside the container fires wherever the loader is
 * mounted, so leaking it onto tenant subdomains would fire the whole
 * Launcharoo tag stack against customer visitors.
 *
 * The `<noscript>` iframe from GTM's snippet is intentionally omitted for
 * the same reason as MetaPixel: rendering it unconditionally would leak
 * hits on tenant sites for JS-disabled visitors, and gating it server-side
 * forces the whole app dynamic. Modern traffic is JS-enabled.
 *
 * If you later move Meta Pixel or Clarity inside GTM, remove the direct
 * MetaPixel.tsx / ClarityAnalytics.tsx components to avoid double-fires.
 */

import { useEffect } from "react";

const GTM_ID = "GTM-5R7F3TKB";
const MARKETING_HOST = "launcharoo.online";

interface WindowWithGtm extends Window {
  dataLayer?: unknown[];
}

/** One-shot latch. Module-scope survives re-renders. */
let gtmInitialized = false;

export default function GoogleTagManager(): null {
  useEffect(() => {
    if (gtmInitialized) return;

    const host = window.location.hostname.replace(/^www\./, "");
    if (host !== MARKETING_HOST) return;

    const w = window as WindowWithGtm;
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({
      "gtm.start": Date.now(),
      event: "gtm.js",
    });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(script, first);

    gtmInitialized = true;
  }, []);

  return null;
}
