/** Trades category — location (suburb) page. */
import type { SiteProps, LocationPage as LocationPageData } from "@/shared/types/site-props";
import { MapPin } from "lucide-react";
import {
  SiteShell,
  Breadcrumbs,
  PageHero,
  ContentSections,
  BenefitsList,
  FaqList,
  CtaBand,
  RelatedLinks,
  TestimonialsSection,
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
  const serviceLinks = (
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

  // Pull testimonials that mention this suburb (case-insensitive) — gives the
  // location page genuine social proof without duplicating everything from home.
  const suburbLower = page.suburb.toLowerCase();
  const localTestimonials = (site.home.testimonials ?? []).filter(
    (t) => t.location?.toLowerCase().includes(suburbLower),
  );

  const cta = primaryCta(site, basePath);
  const title = page.headline ?? `${site.business.name} in ${page.suburb}`;

  return (
    <SiteShell site={site} basePath={basePath} jsonLd={jsonLd}>
      <Breadcrumbs crumbs={crumbs} />
      <PageHero
        eyebrow={`${page.suburb}${page.state ? ", " + page.state : ""}`}
        title={title}
        subtitle={page.intro}
        image={page.hero_image}
      />

      {/* Main body — intro paragraph, rich content sections, landmarks */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 space-y-10">
          {page.body && (
            <p className="whitespace-pre-line text-lg leading-relaxed text-zinc-700">{page.body}</p>
          )}

          {/* Long-form local content blocks (e.g. "Why locals trust us here") */}
          {page.sections.length > 0 && (
            <ContentSections blocks={page.sections} />
          )}

          {/* Local landmarks as geo-context chips */}
          {page.landmarks.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Areas we cover in {page.suburb}
              </p>
              <div className="flex flex-wrap gap-2.5">
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
            </div>
          )}

          {/* Benefits / inclusions specific to this location */}
          {page.benefits.length > 0 && (
            <BenefitsList items={page.benefits} heading={`Why ${page.suburb} locals choose us`} />
          )}
        </div>
      </section>

      {/* Services we offer here — clickable cards linking to full service pages */}
      {serviceLinks.length > 0 && (
        <RelatedLinks
          heading={`Services we offer in ${page.suburb}`}
          links={serviceLinks}
        />
      )}

      {/* Service × suburb landing pages — deepens the SEO footprint */}
      {areaPages.length > 0 && (
        <RelatedLinks heading={`Popular in ${page.suburb}`} links={areaPages} />
      )}

      {/* Social proof from locals in this suburb */}
      {localTestimonials.length > 0 && (
        <TestimonialsSection
          items={localTestimonials}
          heading={`What ${page.suburb} customers say`}
        />
      )}

      {/* Location-specific FAQs */}
      {page.faqs.length > 0 && (
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-4xl px-4">
            <FaqList items={page.faqs} heading={`Common questions from ${page.suburb}`} />
          </div>
        </section>
      )}

      {/* Nearby areas — internal linking for crawl equity */}
      {nearby.length > 0 && <RelatedLinks heading="Nearby areas we cover" links={nearby} />}

      <CtaBand
        heading={`Local to ${page.suburb}?`}
        body="Call now or request a quote — fast, friendly, fully licensed."
        cta={cta}
      />
    </SiteShell>
  );
}
