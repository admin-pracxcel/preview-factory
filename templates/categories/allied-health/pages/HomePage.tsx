/**
 * Allied-health category — homepage.
 *
 * Visual design: teal/slate palette, trust-forward layout with prominent booking CTA,
 * credentials/registration display, and AHPRA-compliant copy framing.
 *
 * NO TESTIMONIALS anywhere in the allied-health category. AHPRA's advertising
 * guidelines prohibit testimonials for regulated health services (s133 of the
 * National Law), even ones that don't reference outcomes. We render nothing
 * from site.home.testimonials — the data can stay in SiteProps but it never
 * reaches the DOM on a tenant site.
 */
import type { SiteProps } from "@/shared/types/site-props";
import {
  SiteShell,
  Hero,
  OfferBand,
  ServicesGrid,
  AboutSection,
  ServiceAreaSection,
  GalleryGrid,
  ContactSection,
  resolveTheme,
  buildLocalBusinessJsonLd,
} from "@/shared/ui";

export function HomePage({
  site,
  basePath,
  tenantId,
  showBlog = false,
}: {
  site: SiteProps;
  basePath: string;
  tenantId?: string;
  showBlog?: boolean;
}) {
  const { home, business } = site;
  const { heroImage } = resolveTheme(site.branding, site.overrides);
  const phone = home.contact?.phone || business.phone || "";
  const email = home.contact?.email || business.email || "";

  const locations = site.locations.map((l) => ({ slug: l.slug, suburb: l.suburb }));

  // JSON-LD: LocalBusiness + MedicalBusiness for allied health
  const localBizLd = buildLocalBusinessJsonLd(site, heroImage);
  const medicalBizLd = {
    ...localBizLd,
    "@type": ["LocalBusiness", "MedicalBusiness"],
    "medicalSpecialty": "Physiotherapy",
  };

  return (
    <SiteShell site={site} basePath={basePath} showBlog={showBlog} jsonLd={[medicalBizLd]}>
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
        subheading="Evidence-based treatment from registered physiotherapists."
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

      {home.gallery?.length ? <GalleryGrid items={home.gallery} heading="Our clinic" subheading="Treatment rooms and facilities at our Chatswood practice." /> : null}

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
