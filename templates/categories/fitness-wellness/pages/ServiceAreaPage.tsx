/** Fitness-wellness category — service-in-area landing page (program × suburb). */
import type { SiteProps, ServiceAreaPage as ServiceAreaPageData } from "@/shared/types/site-props";
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
  buildServiceAreaJsonLd,
  buildBreadcrumbJsonLd,
} from "@/shared/ui";
import { primaryCta } from "../cta";

export function ServiceAreaPage({
  site,
  basePath,
  page,
}: {
  site: SiteProps;
  basePath: string;
  page: ServiceAreaPageData;
}) {
  const crumbs = [
    { label: "Home", href: href(basePath) },
    { label: page.service_title, href: href(basePath, "services", page.service_slug) },
    { label: page.suburb, href: href(basePath, "areas", page.slug) },
  ];

  const jsonLd = [
    buildServiceAreaJsonLd(site, page),
    buildBreadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: c.href }))),
  ];

  const related: Array<{ label: string; href: string; sublabel?: string }> = [];
  const svc = site.services.find((s) => s.slug === page.service_slug);
  if (svc)
    related.push({
      label: `All about ${svc.title}`,
      href: href(basePath, "services", svc.slug),
      sublabel: svc.summary,
    });
  const loc = site.locations.find((l) => l.suburb.toLowerCase() === page.suburb.toLowerCase());
  if (loc)
    related.push({ label: `${page.suburb} training`, href: href(basePath, "locations", loc.slug) });

  const siblingAreas = site.service_areas
    .filter((a) => a.service_slug === page.service_slug && a.slug !== page.slug)
    .slice(0, 6)
    .map((a) => ({ label: `${page.service_title} in ${a.suburb}`, href: href(basePath, "areas", a.slug) }));

  const cta = primaryCta(site, basePath);

  return (
    <SiteShell site={site} basePath={basePath} jsonLd={jsonLd}>
      <Breadcrumbs crumbs={crumbs} />
      <PageHero
        eyebrow={`${page.suburb}${page.state ? ", " + page.state : ""}`}
        title={page.headline}
        subtitle={page.intro}
      />

      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 space-y-10">
          <p className="whitespace-pre-line text-lg leading-relaxed text-zinc-700">{page.body}</p>

          {page.sections.length > 0 && (
            <ContentSections blocks={page.sections} />
          )}

          {page.benefits.length > 0 && (
            <BenefitsList items={page.benefits} heading={`Why ${page.suburb} clients choose this program`} />
          )}

          {page.faqs.length > 0 && (
            <FaqList items={page.faqs} heading={`${page.service_title} in ${page.suburb} — FAQ`} />
          )}
        </div>
      </section>

      {related.length > 0 && <RelatedLinks heading="Related" links={related} />}
      {siblingAreas.length > 0 && (
        <RelatedLinks heading={`${page.service_title} in other areas`} links={siblingAreas} />
      )}

      <CtaBand
        heading={`${page.service_title} in ${page.suburb} — book now`}
        body="First session consult is free. No contracts, no lock-ins."
        cta={cta}
      />
    </SiteShell>
  );
}
