/**
 * sentry.server.config.ts
 * Sentry init for the Node.js runtime (API routes, server components, crons).
 *
 * Imported from instrumentation.ts when process.env.NEXT_RUNTIME === 'nodejs'.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Sample 10% of transactions for perf tracing. Enough to catch trends
  // on the free plan (10k perf events/mo) without paying for volume.
  tracesSampleRate: 0.1,

  // Keep PII off by default. Email addresses, IPs, and request bodies
  // stay client-side; Sentry only sees error shape + stack.
  sendDefaultPii: false,

  // Local dev shouldn't pollute the prod project. Set SENTRY_DSN only in
  // Vercel Production to keep dev noise out.
  enabled: Boolean(process.env.SENTRY_DSN),

  ignoreErrors: [
    // Next 16 sometimes throws these on prefetch cancellation.
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
  ],
});
