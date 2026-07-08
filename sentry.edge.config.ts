/**
 * sentry.edge.config.ts
 * Sentry init for the Edge runtime (middleware, some route handlers).
 *
 * We use mostly node runtime, but Next 16 may still spin up edge for
 * middleware or dynamic segments. Keeping the surface identical to
 * server config so grouping stays consistent.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  enabled: Boolean(process.env.SENTRY_DSN),
});
