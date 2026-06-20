/** Beauty & Aesthetics category — service-detail page. */
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
  buildServiceJsonLd,
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

  const jsonLd: Array<Record<string, unknown>> = [
    buildServiceJsonLd(site, page),
    buildBreadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: c.href }))),
  ];
  const faqLd = buildFaqJsonLd(page.faqs);
  if (faqLd) jsonLd.push(faqLd);

  // Interlink: other services, and area pages for THIS service.
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
      <PageHero eyebrow="Service" title={page.title} subtitle={page.summary} image={page.hero_image} />

      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4">
          {page.starting_price && (
            <p className="mb-6 inline-flex items-center rounded-full bg-zinc-100 px-4 py-2 text-sm font-bold text-[var(--accent)]">
              {page.starting_price}
            </p>
          )}
          <p className="whitespace-pre-line text-lg leading-relaxed text-zinc-700">{page.intro}</p>

          {page.benefits.length > 0 && (
            <div className="mt-10">
              <BenefitsList items={page.benefits} heading="What's included" />
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
      {otherServices.length > 0 && <RelatedLinks heading="Other services" links={otherServices} />}

      <CtaBand
        heading="Ready to book?"
        body="Call us or book online — we'll find the right appointment for you."
        cta={cta}
      />
    </SiteShell>
  );
}
