"use client";

/**
 * app/components/ClarityAnalytics.tsx
 *
 * Loads Microsoft Clarity on the marketing host only.
 *
 * Rendered inside the root layout, which is shared with every tenant
 * preview host (<slug>.launcharoo.online + customer custom domains). The
 * host check keeps Launcharoo's Clarity project from ingesting customer
 * traffic — that would be a privacy leak and would also pollute the
 * analytics we actually care about.
 *
 * Localhost + Vercel preview deploys are excluded for the same reason.
 */

import { useEffect } from "react";

const CLARITY_PROJECT_ID = "y0hj4uvkh4";
const MARKETING_HOST = "launcharoo.online";

interface WindowWithClarity extends Window {
  clarity?: {
    (...args: unknown[]): void;
    q?: unknown[];
  };
}

export default function ClarityAnalytics(): null {
  useEffect(() => {
    const host = window.location.hostname.replace(/^www\./, "");
    if (host !== MARKETING_HOST) return;

    const w = window as WindowWithClarity;
    if (w.clarity) return; // already loaded (e.g. HMR)

    const stub = function (...args: unknown[]) {
      (stub.q = stub.q ?? []).push(args);
    } as WindowWithClarity["clarity"] & { q: unknown[] };
    stub.q = [];
    w.clarity = stub;

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(script, first);
  }, []);

  return null;
}
