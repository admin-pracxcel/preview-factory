/**
 * instrumentation-client.ts
 * Sentry init for the browser (client components, /login form, dashboard).
 *
 * Next 15+ auto-loads this file — no manual import required.
 * Kept lean: error capture only, no replay/perf tracing to keep the
 * client bundle small.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Client-side we skip perf tracing entirely — bundle stays small and
  // browser network noise doesn't eat the free-tier quota.
  tracesSampleRate: 0,

  sendDefaultPii: false,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
