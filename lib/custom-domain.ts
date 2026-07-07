/**
 * lib/custom-domain.ts
 * State machine helpers for the customer BYO-domain flow (Phase 10b).
 *
 * States (mirrors schema.sql tenants.custom_domain_status):
 *   null           — no domain set (default)
 *   choosing       — customer has entered a domain, we're validating input
 *   pending_ns     — zone created, waiting for customer to change nameservers
 *   pending_ssl    — nameservers changed, waiting for SSL cert provisioning
 *   active         — everything is up and their site is live at the domain
 *   failed         — something went irrecoverably wrong (see error notes)
 *
 * Transitions we perform automatically (via /api/dashboard/custom-domain
 * and the reconciliation cron):
 *
 *     null ─(user enters domain)─▶ choosing
 *     choosing ─(zone created)──▶ pending_ns
 *     pending_ns ─(zone active)─▶ pending_ssl
 *     pending_ssl ─(cert issued)▶ active
 *     any ─(error)─────────────▶ failed
 *
 * "purchasing" is reserved for a future concierge flow where we help the
 * customer register a fresh domain; not used in 10b.
 */

export type CustomDomainStatus =
  | "choosing"
  | "purchasing"
  | "pending_ns"
  | "pending_ssl"
  | "active"
  | "failed";

/** Human-readable status headline for the dashboard card. */
export function statusLabel(status: CustomDomainStatus | null | undefined): string {
  switch (status) {
    case null:
    case undefined:
      return "No custom domain";
    case "choosing":
      return "Setting up...";
    case "purchasing":
      return "Purchasing domain...";
    case "pending_ns":
      return "Waiting for nameserver change";
    case "pending_ssl":
      return "Issuing SSL certificate";
    case "active":
      return "Live";
    case "failed":
      return "Setup failed";
  }
}

/** Whether the tenant should still see instructions vs "you're done". */
export function isTerminalStatus(status: CustomDomainStatus | null | undefined): boolean {
  return status === "active" || status === "failed";
}

/* ------------------------------------------------------ input validation */

/**
 * Reject obviously-bad input before spending a Cloudflare API call on it.
 * Accepts second-level and deeper domains only — Cloudflare rejects
 * single-label TLDs and IP addresses anyway, but bailing early is nicer.
 *
 * Explicitly rejects our own site domain to prevent someone submitting
 * "launcharoo.online" and creating a zone conflict.
 */
export function validateCustomDomain(input: string): { ok: true; domain: string } | { ok: false; error: string } {
  const normalised = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!normalised) return { ok: false, error: "Enter a domain." };
  if (normalised.length > 253) return { ok: false, error: "Domain is too long." };
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(normalised)) {
    return { ok: false, error: "That doesn't look like a valid domain (example: yourbusiness.com.au)." };
  }
  if (normalised === "launcharoo.online" || normalised.endsWith(".launcharoo.online")) {
    return { ok: false, error: "Use your own domain, not a launcharoo subdomain." };
  }
  return { ok: true, domain: normalised };
}
