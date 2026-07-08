/**
 * lib/telemetry.ts
 * Thin wrapper around Sentry for the paths that DON'T go through the
 * Next.js request pipeline — cron endpoints, background sweeps, and
 * fire-and-forget code paths.
 *
 * Next's built-in Sentry instrumentation auto-captures unhandled errors
 * inside API route handlers. But when a cron catches its own error to
 * return 500 (rather than throwing), Sentry never sees it. These helpers
 * bridge that gap.
 */

import * as Sentry from "@sentry/nextjs";

/**
 * Report an error to Sentry with a stable tag for filtering. Use this in
 * cron/background code where you catch-and-swallow rather than rethrow.
 * Safe to call when SENTRY_DSN is unset — Sentry no-ops.
 */
export function captureCronError(
  cron: string,
  err: unknown,
  extras?: Record<string, unknown>,
): void {
  Sentry.captureException(err, {
    tags: { source: "cron", cron },
    extra: extras,
  });
}

/**
 * Report a caught error from a business flow (webhooks, workflows) with
 * an arbitrary source tag. Use for anything that isn't a cron but still
 * catches internally.
 */
export function captureFlowError(
  source: string,
  err: unknown,
  extras?: Record<string, unknown>,
): void {
  Sentry.captureException(err, {
    tags: { source },
    extra: extras,
  });
}
