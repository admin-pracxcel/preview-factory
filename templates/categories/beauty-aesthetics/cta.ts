/** Resolve the best primary call-to-action for sub-page CTA bands. */
import type { SiteProps } from "@/shared/types/site-props";
import { telHref, href } from "@/shared/ui";

export function primaryCta(site: SiteProps, basePath: string): { label: string; href: string } {
  if (site.home.contact?.cta) return site.home.contact.cta;
  const phone = site.home.contact?.phone || site.business.phone || "";
  if (phone) return { label: `Call ${site.business.name.split(" ")[0]}`, href: telHref(phone) };
  return { label: "Book now", href: `${href(basePath)}#contact` };
}
