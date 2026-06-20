/** Trades category — homepage. Composes the shared sections from SiteProps.home. */
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

  const locations = site.locations.map((l) => ({ slug: l.slug, suburb: l.suburb }));

  return (
    <SiteShell site={site} basePath={basePath} jsonLd={[buildLocalBusinessJsonLd(site, heroImage)]}>
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
        subheading="Workmanship you can rely on — done right the first time."
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

      {home.gallery?.length ? <GalleryGrid items={home.gallery} /> : null}
      {home.testimonials?.length ? <TestimonialsSection items={home.testimonials} /> : null}

      <ContactSection
        heading={home.contact?.heading}
        phone={phone}
        email={email}
        address={home.contact?.address}
        hours={home.contact?.hours}
        cta={home.contact?.cta}
      />
    </SiteShell>
  );
}
