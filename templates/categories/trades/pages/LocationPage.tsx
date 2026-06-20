/** Trades category — location (suburb) page. */
import type { SiteProps, LocationPage as LocationPageData } from "@/shared/types/site-props";
import { MapPin } from "lucide-react";
import {
  SiteShell,
  Breadcrumbs,
  PageHero,
  BenefitsList,
  CtaBand,
  RelatedLinks,
  href,
  buildLocationJsonLd,
  buildBreadcrumbJsonLd,
} from "@/shared/ui";
import { primaryCta } from "../cta";

export function LocationPage({
  site,
  basePath,
  page,
}: {
  site: SiteProps;
  basePath: string;
  page: LocationPageData;
}) {
  const crumbs = [
    { label: "Home", href: href(basePath) },
    { label: page.suburb, href: href(basePath, "locations", page.slug) },
  ];

  const jsonLd = [
    buildLocationJsonLd(site, page),
    buildBreadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: c.href }))),
  ];

  // Services to surface for this suburb: explicit list if given, else all.
  const wanted = page.services_offered.map((s) => s.toLowerCase());
  const services = (
    wanted.length
      ? site.services.filter(
          (s) => wanted.includes(s.title.toLowerCase()) || wanted.includes(s.slug.toLowerCase()),
        )
      : site.services
  )
    .slice(0, 6)
    .map((s) => ({ label: s.title, href: href(basePath, "services", s.slug), sublabel: s.summary }));

  // Service-in-area landing pages anchored to this suburb.
  const areaPages = site.service_areas
    .filter((a) => a.suburb.toLowerCase() === page.suburb.toLowerCase())
    .slice(0, 6)
    .map((a) => ({ label: a.service_title, href: href(basePath, "areas", a.slug) }));

  const nearby = site.locations
    .filter((l) => l.slug !== page.slug)
    .slice(0, 6)
    .map((l) => ({ label: l.suburb, href: href(basePath, "locations", l.slug) }));

  const cta = primaryCta(site, basePath);
  const title = `${site.business.name} in ${page.suburb}`;

  return (
    <SiteShell site={site} basePath={basePath} jsonLd={jsonLd}>
      <Breadcrumbs crumbs={crumbs} />
      <PageHero
        eyebrow="Service area"
        title={title}
        subtitle={page.intro}
        image={page.hero_image}
      />

      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4">
          {page.body && (
            <p className="whitespace-pre-line text-lg leading-relaxed text-zinc-700">{page.body}</p>
          )}

          {page.landmarks.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2.5">
              {page.landmarks.map((lm) => (
                <span
                  key={lm}
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700"
                >
                  <MapPin className="h-3.5 w-3.5 text-[var(--accent)]" />
                  {lm}
                </span>
              ))}
            </div>
          )}

          {services.length > 0 && (
            <div className="mt-10">
              <BenefitsList
                items={services.map((s) => s.label)}
                heading={`Services we offer in ${page.suburb}`}
              />
            </div>
          )}
        </div>
      </section>

      {areaPages.length > 0 && (
        <RelatedLinks heading={`Popular in ${page.suburb}`} links={areaPages} />
      )}
      {nearby.length > 0 && <RelatedLinks heading="Nearby areas we cover" links={nearby} />}

      <CtaBand
        heading={`Local to ${page.suburb}?`}
        body="Call now or request a quote — fast, friendly, fully licensed."
        cta={cta}
      />
    </SiteShell>
  );
}
