/**
 * lib/admin-cron-auth.ts
 *
 * Shared header check for /api/admin/seo/* and /api/admin/gbp/* endpoints
 * that n8n calls on cron. No cookies, no user session — just a shared
 * secret set on both n8n and Vercel.
 */

export class CronAuthError extends Error {
  constructor(reason: string) {
    super(`cron auth: ${reason}`);
    this.name = "CronAuthError";
  }
}

export function assertCronRequest(req: Request): void {
  const expected = process.env.CRON_SECRET;
  if (!expected) throw new CronAuthError("CRON_SECRET not configured");
  const provided = req.headers.get("x-cron-secret");
  if (!provided) throw new CronAuthError("x-cron-secret header missing");
  if (provided !== expected) throw new CronAuthError("x-cron-secret mismatch");
}
