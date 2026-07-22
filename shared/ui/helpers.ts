/** Niche-agnostic helpers shared across the multi-page site system. */

export { cn } from "@/shared/utils";

/** Build a safe `tel:` href from a display phone string. */
export function telHref(phone: string): string {
  return "tel:" + phone.replace(/[^\d+]/g, "");
}

/**
 * Join a base path and any number of slug segments into a clean absolute URL.
 * `href("/preview/trades", "services", "switchboard")` -> "/preview/trades/services/switchboard"
 * `href("/preview/trades")` -> "/preview/trades"
 */
export function href(base: string, ...segments: Array<string | undefined>): string {
  const cleanBase = base.replace(/\/+$/, "");
  const parts = segments.filter((s): s is string => !!s && s.length > 0);
  return parts.length ? `${cleanBase}/${parts.join("/")}` : cleanBase || "/";
}

export function currentYear(): number {
  return new Date().getFullYear();
}

/**
 * Prepend `basePath` to an internal href when needed.
 *
 * The generator produces CTA hrefs like "/services/emergency-plumbing"
 * or "/contact" — clean paths that assume the site lives at the domain
 * root. When the site actually renders under a mount point (the
 * `/preview/site/<tenantId>` preview iframe, for example), those hrefs
 * 404 unless the mount point is prepended. This normalises for the
 * common CTA / nav paths without touching absolute URLs, anchors,
 * tel:, mailto: or hrefs that already include the base.
 */
export function resolveHref(
  href: string | undefined,
  basePath: string,
): string | undefined {
  if (!href) return href;
  // Anything that's not a plain absolute-path is left alone —
  // #anchors, tel:, mailto:, https://, etc.
  if (!href.startsWith("/")) return href;
  if (!basePath) return href;
  // Already prefixed? Leave it.
  if (href === basePath || href.startsWith(`${basePath}/`)) return href;
  return `${basePath}${href}`;
}
