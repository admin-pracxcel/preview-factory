/** Beauty & Aesthetics category — location (suburb) page. */
import type { SiteProps, LocationPage as LocationPageData } from "@/shared/types/site-props";
import { MapPin } from "lucide-react";
import {
  SiteShell,
  Breadcrumbs,
  PageHero,
  ContentSections,
  ServicesGrid,
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

  const locationIndex = site.locations.findIndex((l) => l.slug === page.slug);
  const editablePath =
    locationIndex >= 0 ? `locations.${locationIndex}.hero_image` : undefined;

  const jsonLd = [
    buildLocationJsonLd(site, page),
    buildBreadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: c.href }))),
  ];

  // Services to surface for this suburb: explicit list if given, else all.
  const wanted = page.services_offered.map((s) => s.toLowerCase());
  const filteredServices = (
    wanted.length
      ? site.services.filter(
          (s) => wanted.includes(s.title.toLowerCase()) || wanted.includes(s.slug.toLowerCase()),
        )
      : site.services
  ).slice(0, 6);

  // Map ServicePage[] → ServicesGrid shape.
  const serviceCards = filteredServices.map((s) => ({
    id: s.slug,
    title: s.title,
    description: s.summary,
    icon: s.icon,
    starting_price: s.starting_price,
    slug: s.slug,
  }));

  // Service-in-area landing pages anchored to this suburb.
  const areaPages = site.service_areas
    .filter((a) => a.suburb.toLowerCase() === page.suburb.toLowerCase())
    .slice(0, 6)
    .map((a) => ({ label: a.service_title, href: href(basePath, "areas", a.slug) }));

  const nearby = site.locations
    .filter((l) => l.slug !== page.slug)
    .slice(0, 6)
    .map((l) => ({ label: l.suburb, href: href(basePath, "locations", l.slug) }));

  // Pull testimonials that mention this suburb. Fall back to all site testimonials (max 3).
  const suburbLower = page.suburb.toLowerCase();
  const allTestimonials = site.home.testimonials ?? [];
  const localTestimonials = allTestimonials.filter(
    (t) => t.location?.toLowerCase().includes(suburbLower),
  );
  const testimonialsToShow = localTestimonials.length > 0
    ? localTestimonials
    : allTestimonials.slice(0, 3);

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
        editablePath={editablePath}
      />

      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 space-y-10">
          {page.body && (
            <p className="whitespace-pre-line text-lg leading-relaxed text-zinc-700">{page.body}</p>
          )}

          {page.sections.length > 0 && (
            <ContentSections blocks={page.sections} />
          )}

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

          {page.benefits.length > 0 && (
            <BenefitsList items={page.benefits} heading={`Why ${page.suburb} clients choose us`} />
          )}
        </div>
      </section>

      {serviceCards.length > 0 && (
        <ServicesGrid
          services={serviceCards}
          basePath={basePath}
          heading={`Services available in ${page.suburb}`}
          subheading={`Available to clients across ${page.suburb} and nearby suburbs.`}
        />
      )}

      {areaPages.length > 0 && (
        <RelatedLinks heading={`Popular in ${page.suburb}`} links={areaPages} />
      )}

      {testimonialsToShow.length > 0 && (
        <TestimonialsSection
          items={testimonialsToShow}
          heading={
            localTestimonials.length > 0
              ? `What ${page.suburb} clients say`
              : "What our clients say"
          }
        />
      )}

      {page.faqs.length > 0 && (
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-4xl px-4">
            <FaqList items={page.faqs} heading={`Common questions from ${page.suburb}`} />
          </div>
        </section>
      )}

      {nearby.length > 0 && <RelatedLinks heading="Nearby areas we visit" links={nearby} />}

      <CtaBand
        heading={`Visiting ${page.suburb}?`}
        body="Book your appointment online or call — we'll find a time that works."
        cta={cta}
      />
    </SiteShell>
  );
}
