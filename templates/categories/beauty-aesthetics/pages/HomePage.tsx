/**
 * Beauty & Aesthetics category — homepage.
 *
 * Gallery-forward layout: gallery section appears prominently above the fold
 * after the hero. Online booking CTA is surfaced in the offer band and contact
 * section. Uses the shared section components themed via CSS variables set by
 * SiteShell (rose/blush primary, warm gold accent).
 */
import type { SiteProps } from "@/shared/types/site-props";
import {
  SiteShell,
  Hero,
  OfferBand,
  GalleryGrid,
  ServicesGrid,
  AboutSection,
  ServiceAreaSection,
  TestimonialsSection,
  ContactSection,
  resolveTheme,
  buildLocalBusinessJsonLd,
} from "@/shared/ui";

export function HomePage({
  site,
  basePath,
  tenantId,
}: {
  site: SiteProps;
  basePath: string;
  tenantId?: string;
}) {
  const { home, business } = site;
  const { heroImage } = resolveTheme(site.branding, site.overrides);
  const phone = home.contact?.phone || business.phone || "";
  const email = home.contact?.email || business.email || "";

  const locations = site.locations.map((l) => ({ slug: l.slug, suburb: l.suburb }));

  // JSON-LD: LocalBusiness + HairSalon schema
  const localBusinessLd = buildLocalBusinessJsonLd(site, heroImage);
  const hairSalonLd = {
    ...localBusinessLd,
    "@type": ["LocalBusiness", "HairSalon"],
  };

  return (
    <SiteShell site={site} basePath={basePath} jsonLd={[hairSalonLd]}>
      <Hero
        headline={home.hero.headline}
        subheadline={home.hero.subheadline}
        tagline={business.tagline}
        heroImage={heroImage}
        ctaPrimary={home.hero.cta_primary}
        ctaSecondary={home.hero.cta_secondary}
        socialProof={home.social_proof?.items}
        basePath={basePath}
      />

      {/* Gallery appears early — beauty category is gallery-forward */}
      {home.gallery?.length ? (
        <GalleryGrid
          items={home.gallery}
          heading="Our work"
          subheading="Real results from real clients at Studio Luma."
        />
      ) : null}

      {home.offer && (
        <OfferBand
          headline={home.offer.headline}
          description={home.offer.description}
          price={home.offer.price}
          code={home.offer.code}
          cta={home.offer.cta}
          basePath={basePath}
        />
      )}

      <ServicesGrid
        services={home.services}
        basePath={basePath}
        heading="What we do"
        subheading="From everyday cuts to colour transformations — all under one roof."
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

      {home.testimonials?.length ? <TestimonialsSection items={home.testimonials} /> : null}

      <ContactSection
        heading={home.contact?.heading}
        phone={phone}
        email={email}
        address={home.contact?.address}
        hours={home.contact?.hours}
        cta={home.contact?.cta}
        tenantId={tenantId}
        basePath={basePath}
      />
    </SiteShell>
  );
}
