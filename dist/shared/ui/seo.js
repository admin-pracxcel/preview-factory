"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLocalBusinessJsonLd = buildLocalBusinessJsonLd;
exports.buildServiceJsonLd = buildServiceJsonLd;
exports.buildServiceAreaJsonLd = buildServiceAreaJsonLd;
exports.buildLocationJsonLd = buildLocationJsonLd;
exports.buildFaqJsonLd = buildFaqJsonLd;
exports.buildBreadcrumbJsonLd = buildBreadcrumbJsonLd;
function aggregateRating(site) {
    const ratings = (site.home.testimonials ?? [])
        .map((t) => t.rating)
        .filter((r) => typeof r === "number");
    if (!ratings.length)
        return undefined;
    return {
        "@type": "AggregateRating",
        ratingValue: (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1),
        reviewCount: ratings.length,
    };
}
/** Core LocalBusiness node for the whole site (used on the homepage). */
function buildLocalBusinessJsonLd(site, heroImage) {
    const { business, seo, home } = site;
    const contact = home.contact;
    const ld = {
        "@context": "https://schema.org",
        "@type": seo?.schema_org_type ?? "LocalBusiness",
        name: business.name,
    };
    if (business.tagline)
        ld.description = seo?.description ?? business.tagline;
    const phone = contact?.phone ?? business.phone;
    if (phone)
        ld.telephone = phone;
    const email = business.email ?? contact?.email;
    if (email)
        ld.email = email;
    if (heroImage)
        ld.image = heroImage;
    if (contact?.address || business.suburb) {
        ld.address = {
            "@type": "PostalAddress",
            ...(contact?.address ? { streetAddress: contact.address } : {}),
            ...(business.suburb ? { addressLocality: business.suburb } : {}),
            ...(business.state ? { addressRegion: business.state } : {}),
            addressCountry: "AU",
        };
    }
    const areas = home.service_area?.suburbs ?? [];
    if (areas.length)
        ld.areaServed = areas.map((s) => ({ "@type": "Place", name: s }));
    const rating = aggregateRating(site);
    if (rating)
        ld.aggregateRating = rating;
    return ld;
}
/** Service node for a service-detail page. */
function buildServiceJsonLd(site, page) {
    return {
        "@context": "https://schema.org",
        "@type": "Service",
        name: page.title,
        description: page.seo.description ?? page.summary,
        serviceType: page.title,
        provider: {
            "@type": site.seo?.schema_org_type ?? "LocalBusiness",
            name: site.business.name,
            ...(site.business.phone ? { telephone: site.business.phone } : {}),
        },
        ...(site.home.service_area?.suburbs?.length
            ? { areaServed: site.home.service_area.suburbs.map((s) => ({ "@type": "Place", name: s })) }
            : {}),
    };
}
/** Service-in-area landing page node. */
function buildServiceAreaJsonLd(site, page) {
    return {
        "@context": "https://schema.org",
        "@type": "Service",
        name: `${page.service_title} in ${page.suburb}`,
        description: page.seo.description ?? page.headline,
        serviceType: page.service_title,
        areaServed: { "@type": "Place", name: [page.suburb, page.state].filter(Boolean).join(", ") },
        provider: {
            "@type": site.seo?.schema_org_type ?? "LocalBusiness",
            name: site.business.name,
            ...(site.business.phone ? { telephone: site.business.phone } : {}),
        },
    };
}
/** Location page node. */
function buildLocationJsonLd(site, page) {
    return {
        "@context": "https://schema.org",
        "@type": site.seo?.schema_org_type ?? "LocalBusiness",
        name: `${site.business.name} — ${page.suburb}`,
        description: page.seo.description ?? page.intro,
        areaServed: {
            "@type": "Place",
            name: [page.suburb, page.state ?? site.business.state].filter(Boolean).join(", "),
        },
        ...(site.business.phone ? { telephone: site.business.phone } : {}),
    };
}
/** FAQPage node from a list of Q&A items. */
function buildFaqJsonLd(items) {
    if (!items.length)
        return undefined;
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((i) => ({
            "@type": "Question",
            name: i.question,
            acceptedAnswer: { "@type": "Answer", text: i.answer },
        })),
    };
}
/** BreadcrumbList node from `{ name, url }` crumbs. */
function buildBreadcrumbJsonLd(crumbs) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.name,
            item: c.url,
        })),
    };
}
