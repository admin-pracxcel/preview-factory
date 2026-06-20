/**
 * Allied-health category — FAQ page.
 *
 * FAQPage JSON-LD helps with AI-overview citation and rich results.
 * Copy framing must remain AHPRA-compliant: no clinical outcome claims.
 */
import type { SiteProps } from "@/shared/types/site-props";
import {
  SiteShell,
  Breadcrumbs,
  PageHero,
  FaqList,
  CtaBand,
  href,
  buildFaqJsonLd,
  buildBreadcrumbJsonLd,
} from "@/shared/ui";
import { primaryCta } from "../cta";

export function FaqPage({ site, basePath }: { site: SiteProps; basePath: string }) {
  const faq = site.faq;
  if (!faq) return null;

  const crumbs = [
    { label: "Home", href: href(basePath) },
    { label: "FAQ", href: href(basePath, "faq") },
  ];

  const jsonLd: Array<Record<string, unknown>> = [
    buildBreadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: c.href }))),
  ];
  const faqLd = buildFaqJsonLd(faq.items);
  if (faqLd) jsonLd.push(faqLd);

  const cta = primaryCta(site, basePath);

  return (
    <SiteShell site={site} basePath={basePath} jsonLd={jsonLd}>
      <Breadcrumbs crumbs={crumbs} />
      <PageHero
        eyebrow="Help"
        title={faq.heading ?? "Frequently asked questions"}
        subtitle={faq.intro}
      />
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4">
          <FaqList items={faq.items} />
        </div>
      </section>
      <CtaBand
        heading="Still have a question?"
        body="Call us or book a consultation — our team is happy to help."
        cta={cta}
      />
    </SiteShell>
  );
}
