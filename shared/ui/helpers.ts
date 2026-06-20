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
