/** Trades category — service-in-area landing page (service × suburb). */
import type { SiteProps, ServiceAreaPage as ServiceAreaPageData } from "@/shared/types/site-props";
import {
  SiteShell,
  Breadcrumbs,
  PageHero,
  BenefitsList,
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

  // Cross-links: the parent service, the suburb's location page, sibling areas.
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
    related.push({ label: `${page.suburb} services`, href: href(basePath, "locations", loc.slug) });

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
      />

      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4">
          <p className="whitespace-pre-line text-lg leading-relaxed text-zinc-700">{page.body}</p>
          {page.benefits.length > 0 && (
            <div className="mt-10">
              <BenefitsList items={page.benefits} heading={`Why locals in ${page.suburb} choose us`} />
            </div>
          )}
        </div>
      </section>

      {related.length > 0 && <RelatedLinks heading="Related" links={related} />}
      {siblingAreas.length > 0 && (
        <RelatedLinks heading={`${page.service_title} in other areas`} links={siblingAreas} />
      )}

      <CtaBand
        heading={`${page.service_title} in ${page.suburb} — book today`}
        body="Upfront pricing, no surprises. Get your free quote now."
        cta={cta}
      />
    </SiteShell>
  );
}
