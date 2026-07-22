/** Resolve the best primary call-to-action for sub-page CTA bands. */
import type { SiteProps } from "@/shared/types/site-props";
import { telHref, href, resolveHref } from "@/shared/ui";

export function primaryCta(site: SiteProps, basePath: string): { label: string; href: string } {
  if (site.home.contact?.cta) {
    const cta = site.home.contact.cta;
    return { ...cta, href: resolveHref(cta.href, basePath) ?? cta.href };
  }
  const phone = site.home.contact?.phone || site.business.phone || "";
  if (phone) return { label: "Call Now", href: telHref(phone) };
  return { label: "Book an Appointment", href: `${href(basePath)}#contact` };
}
