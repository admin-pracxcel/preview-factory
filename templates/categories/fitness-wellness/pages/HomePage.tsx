/** Fitness-wellness category — homepage. */
import type { SiteProps } from "@/shared/types/site-props";
import {
  SiteShell,
  Hero,
  OfferBand,
  ServicesGrid,
  AboutSection,
  ServiceAreaSection,
  GalleryGrid,
  TestimonialsSection,
  ContactSection,
  resolveTheme,
  buildLocalBusinessJsonLd,
} from "@/shared/ui";

export function HomePage({ site, basePath }: { site: SiteProps; basePath: string }) {
  const { home, business } = site;
  const { heroImage } = resolveTheme(site.branding, site.overrides);
  const phone = home.contact?.phone || business.phone || "";
  const email = home.contact?.email || business.email || "";
  const tenantId = basePath.startsWith("/preview/site/")
    ? basePath.replace("/preview/site/", "")
    : undefined;

  const locations = site.locations.map((l) => ({ slug: l.slug, suburb: l.suburb }));

  // Fitness-wellness uses SportsActivityLocation + LocalBusiness JSON-LD on the homepage.
  const jsonLd = [
    buildLocalBusinessJsonLd(site, heroImage),
    {
      "@context": "https://schema.org",
      "@type": "SportsActivityLocation",
      name: business.name,
      description: site.seo?.description ?? business.tagline,
      ...(business.phone ? { telephone: business.phone } : {}),
      ...(business.email ? { email: business.email } : {}),
    },
  ];

  return (
    <SiteShell site={site} basePath={basePath} jsonLd={jsonLd}>
      <Hero
        headline={home.hero.headline}
        subheadline={home.hero.subheadline}
        tagline={business.tagline}
        heroImage={heroImage}
        ctaPrimary={home.hero.cta_primary}
        ctaSecondary={home.hero.cta_secondary}
        socialProof={home.social_proof?.items}
      />

      {home.offer && (
        <OfferBand
          headline={home.offer.headline}
          description={home.offer.description}
          price={home.offer.price}
          code={home.offer.code}
          cta={home.offer.cta}
        />
      )}

      <ServicesGrid
        services={home.services}
        basePath={basePath}
        heading="Training programs"
        subheading="Results-focused programs built around your schedule and goals."
      />

      {home.about && (
        <AboutSection
          heading={home.about.heading}
          body={home.about.body}
          photoUrl={home.about.photo_url}
          yearsInBusiness={home.about.years_in_business}
          licence={home.about.licence}
          abn={business.abn}
          businessName={business.name}
          values={home.about.values}
        />
      )}

      {home.service_area && (
        <ServiceAreaSection
          heading={home.service_area.heading}
          intro={home.service_area.intro}
          suburbs={home.service_area.suburbs}
          locations={locations}
          basePath={basePath}
        />
      )}

      {home.gallery?.length ? <GalleryGrid items={home.gallery} heading="Client results & studio" /> : null}
      {home.testimonials?.length ? (
        <TestimonialsSection items={home.testimonials} heading="What clients say" />
      ) : null}

      <ContactSection
        heading={home.contact?.heading}
        phone={phone}
        email={email}
        address={home.contact?.address}
        hours={home.contact?.hours}
        cta={home.contact?.cta}
        tenantId={tenantId}
      />
    </SiteShell>
  );
}
