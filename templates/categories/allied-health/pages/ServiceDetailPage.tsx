/**
 * Allied-health category — service-detail page.
 *
 * Uses MedicalProcedure JSON-LD for physiotherapy services.
 * AHPRA-compliant: no cure/guarantee claims in copy framing.
 * No before/after health outcome claims.
 */
import type { SiteProps, ServicePage } from "@/shared/types/site-props";
import {
  SiteShell,
  Breadcrumbs,
  PageHero,
  ContentSections,
  BenefitsList,
  FaqList,
  CtaBand,
  RelatedLinks,
  href,
  buildFaqJsonLd,
  buildBreadcrumbJsonLd,
} from "@/shared/ui";
import { primaryCta } from "../cta";

export function ServiceDetailPage({
  site,
  basePath,
  page,
}: {
  site: SiteProps;
  basePath: string;
  page: ServicePage;
}) {
  const crumbs = [
    { label: "Home", href: href(basePath) },
    { label: page.title, href: href(basePath, "services", page.slug) },
  ];

  // MedicalProcedure JSON-LD for allied-health service pages
  const serviceLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "MedicalProcedure",
    "name": page.title,
    "description": page.summary,
    "procedureType": "Physiotherapy",
    "provider": {
      "@type": "MedicalBusiness",
      "name": site.business.name,
      "telephone": site.business.phone,
    },
  };
  if (page.starting_price) {
    serviceLd["offers"] = {
      "@type": "Offer",
      "priceSpecification": {
        "@type": "PriceSpecification",
        "description": page.starting_price,
      },
    };
  }

  const jsonLd: Array<Record<string, unknown>> = [
    serviceLd,
    buildBreadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: c.href }))),
  ];
  const faqLd = buildFaqJsonLd(page.faqs);
  if (faqLd) jsonLd.push(faqLd);

  // Interlink: other services and area pages for this service
  const otherServices = site.services
    .filter((s) => s.slug !== page.slug)
    .slice(0, 6)
    .map((s) => ({ label: s.title, href: href(basePath, "services", s.slug), sublabel: s.summary }));
  const areaPages = site.service_areas
    .filter((a) => a.service_slug === page.slug)
    .slice(0, 6)
    .map((a) => ({ label: `${page.title} in ${a.suburb}`, href: href(basePath, "areas", a.slug) }));

  const cta = primaryCta(site, basePath);

  return (
    <SiteShell site={site} basePath={basePath} jsonLd={jsonLd}>
      <Breadcrumbs crumbs={crumbs} />
      <PageHero eyebrow="Treatment" title={page.title} subtitle={page.summary} image={page.hero_image} />

      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4">
          {page.starting_price && (
            <p className="mb-6 inline-flex items-center rounded-full bg-teal-50 px-4 py-2 text-sm font-bold text-[var(--accent)]">
              {page.starting_price}
            </p>
          )}
          <p className="whitespace-pre-line text-lg leading-relaxed text-zinc-700">{page.intro}</p>

          {page.benefits.length > 0 && (
            <div className="mt-10">
              <BenefitsList items={page.benefits} heading="What this treatment covers" />
            </div>
          )}

          {page.sections.length > 0 && (
            <div className="mt-12">
              <ContentSections blocks={page.sections} />
            </div>
          )}

          {page.faqs.length > 0 && (
            <div className="mt-12">
              <FaqList items={page.faqs} heading="Common questions" />
            </div>
          )}
        </div>
      </section>

      {areaPages.length > 0 && <RelatedLinks heading={`${page.title} near you`} links={areaPages} />}
      {otherServices.length > 0 && <RelatedLinks heading="Other treatments" links={otherServices} />}

      <CtaBand
        heading="Ready to book an appointment?"
        body="Contact us today to discuss your treatment options with a registered physiotherapist."
        cta={cta}
      />
    </SiteShell>
  );
}
