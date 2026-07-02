"use client";

/**
 * Tradies template
 * -----------------
 * A complete, mobile-first single-page website for trade businesses
 * (plumbers, electricians, builders, etc.). Renders entirely from a
 * `TemplateProps` object — there is zero hardcoded business-specific copy.
 *
 * Aesthetic: bold and masculine — deep navy, charcoal and safety-orange accent,
 * driven by CSS variables injected from `branding` (with `overrides` taking
 * precedence). Subtle scroll-triggered fade/slide animations via framer-motion.
 *
 * Sections (in order): sticky header, hero + trust strip, offer band,
 * services, about, service area, gallery, testimonials, contact, footer,
 * plus a sticky mobile call bar and an optional preview countdown banner.
 */

import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ChevronRight,
  Star,
  Quote,
  Wrench,
  Hammer,
  Flame,
  Siren,
  Waves,
  ShieldCheck,
  BadgeCheck,
  DollarSign,
  CheckCircle2,
  Sparkles,
  Tag,
} from "lucide-react";
import type { TemplateProps } from "@/shared/types/template-props";

/* ----------------------------------------------------------------- icon map */

type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number }>;

/** Icons referenced by `service.icon` / `social_proof.icon` strings in props. */
const ICONS: Record<string, IconComponent> = {
  Wrench,
  Hammer,
  Flame,
  Siren,
  Waves,
  ShieldCheck,
  BadgeCheck,
  DollarSign,
  Star,
  Clock,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Sparkles,
};

function resolveIcon(name?: string): IconComponent {
  return (name && ICONS[name]) || Wrench;
}

/* --------------------------------------------------------------- animations */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

/** Wraps children in a one-shot fade-up that triggers when scrolled into view. */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ helpers */

/** Build a safe tel: href from a display phone string. */
function telHref(phone: string): string {
  return "tel:" + phone.replace(/[^\d+]/g, "");
}

/** Render a row of rating stars (1–5). */
function Stars({ rating }: { rating: number }) {
  const r = Math.round(rating);
  return (
    <div className="flex gap-0.5" aria-label={`${r} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={
            "h-4 w-4 " +
            (i < r ? "fill-[var(--accent)] text-[var(--accent)]" : "text-zinc-300")
          }
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- countdown */

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function getTimeLeft(target: string): TimeLeft | null {
  const end = new Date(target).getTime();
  if (Number.isNaN(end)) return null;
  const diff = end - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function CountdownBanner({ label, target }: { label?: string; target?: string }) {
  const [left, setLeft] = useState<TimeLeft | null>(() =>
    target ? getTimeLeft(target) : null,
  );

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setLeft(getTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  // If there is no valid future target, fall back to just the label.
  const unit = (n: number, suffix: string) => `${n}${suffix}`;

  return (
    <div className="bg-[var(--accent)] text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-xs font-semibold tracking-wide sm:text-sm">
        <Sparkles className="h-4 w-4 shrink-0" />
        <span>{label ?? "Limited-time offer"}</span>
        {left && (
          <span className="tabular-nums">
            {unit(left.days, "d")} {unit(left.hours, "h")} {unit(left.minutes, "m")}{" "}
            {unit(left.seconds, "s")}
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- JSON-LD */

function buildJsonLd(props: TemplateProps, heroImage?: string) {
  const { business, seo, contact, testimonials, service_area } = props;
  const ratings = (testimonials ?? [])
    .map((t) => t.rating)
    .filter((r): r is number => typeof r === "number");
  const avg =
    ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : undefined;

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": seo?.schema_org_type ?? "LocalBusiness",
    name: business.name,
  };
  if (business.tagline) ld.description = seo?.description ?? business.tagline;
  if (contact?.phone ?? business.phone)
    ld.telephone = contact?.phone ?? business.phone;
  if (business.email ?? contact?.email)
    ld.email = business.email ?? contact?.email;
  if (heroImage) ld.image = heroImage;
  if (contact?.address || business.suburb) {
    ld.address = {
      "@type": "PostalAddress",
      ...(contact?.address ? { streetAddress: contact.address } : {}),
      ...(business.suburb ? { addressLocality: business.suburb } : {}),
      ...(business.state ? { addressRegion: business.state } : {}),
      addressCountry: "AU",
    };
  }
  if (service_area?.suburbs?.length)
    ld.areaServed = service_area.suburbs.map((s) => ({ "@type": "Place", name: s }));
  if (avg)
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: avg,
      reviewCount: ratings.length,
    };
  return ld;
}

/* ============================================================= main template */

export default function TradiesTemplate({ props }: { props: TemplateProps }) {
  const {
    business,
    branding,
    hero,
    services,
    about,
    service_area,
    gallery,
    testimonials,
    social_proof,
    contact,
    offer,
    preview,
    overrides,
  } = props;

  // Theming: overrides win over branding; sensible fallbacks throughout.
  const primary = overrides?.primary_color ?? branding.primary_color;
  const secondary = branding.secondary_color ?? primary;
  const accent = overrides?.accent_color ?? branding.accent_color ?? primary;
  const logo = overrides?.logo_url || branding.logo_url || "";
  const heroImage = overrides?.hero_image_url || branding.hero_image_url || "";

  const themeVars = {
    "--primary": primary,
    "--secondary": secondary,
    "--accent": accent,
  } as React.CSSProperties;

  const phone = contact?.phone || business.phone || "";
  const email = contact?.email || business.email || "";

  const jsonLd = useMemo(
    () => buildJsonLd(props, heroImage),
    [props, heroImage],
  );

  // Anchor links shown in the desktop header (only those with content).
  const navLinks = useMemo(
    () =>
      [
        services.length ? { href: "#services", label: "Services" } : null,
        about ? { href: "#about", label: "About" } : null,
        gallery?.length ? { href: "#gallery", label: "Work" } : null,
        testimonials?.length ? { href: "#reviews", label: "Reviews" } : null,
        { href: "#contact", label: "Contact" },
      ].filter((l): l is { href: string; label: string } => l !== null),
    [services.length, about, gallery, testimonials],
  );

  const year = new Date().getFullYear();

  return (
    <div
      style={themeVars}
      className="min-h-screen bg-white font-sans text-zinc-900 antialiased"
    >
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Optional preview countdown banner */}
      {preview?.countdown_enabled && (
        <CountdownBanner
          label={preview.countdown_label}
          target={preview.countdown_to}
        />
      )}

      {/* ============================================================ HEADER */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--primary)] text-white shadow-sm">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <a href="#top" className="flex items-center gap-2.5 min-w-0">
            {logo ? (
              <Image
                src={logo}
                alt={`${business.name} logo`}
                width={40}
                height={40}
                className="h-9 w-auto object-contain"
              />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--accent)] text-sm font-black">
                {business.name.charAt(0)}
              </span>
            )}
            <span className="truncate text-base font-extrabold tracking-tight sm:text-lg">
              {business.name}
            </span>
          </a>

          <div className="flex items-center gap-6">
            <ul className="hidden items-center gap-6 text-sm font-medium text-white/80 lg:flex">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <a className="transition-colors hover:text-white" href={l.href}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            {phone && (
              <a
                href={telHref(phone)}
                className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white shadow-md transition-transform active:scale-95 hover:brightness-110"
              >
                <Phone className="h-4 w-4" strokeWidth={2.5} />
                <span className="hidden sm:inline">{phone}</span>
                <span className="sm:hidden">Call</span>
              </a>
            )}
          </div>
        </nav>
      </header>

      <main id="top">
        {/* ============================================================ HERO */}
        <section className="relative isolate overflow-hidden bg-[var(--secondary)] text-white">
          {heroImage && (
            <Image
              src={heroImage}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          )}
          {/* Dark gradient scrim for legibility over the photo */}
          <div className="absolute inset-0 -z-0 bg-gradient-to-br from-[var(--secondary)]/95 via-[var(--primary)]/85 to-[var(--primary)]/60" />

          <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pb-24 sm:pt-24">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="max-w-2xl"
            >
              {business.tagline && (
                <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {business.tagline}
                </p>
              )}
              <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
                {hero.headline}
              </h1>
              {hero.subheadline && (
                <p className="mt-5 max-w-xl text-base text-white/85 sm:text-lg">
                  {hero.subheadline}
                </p>
              )}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={hero.cta_primary.href}
                  className="flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-7 py-4 text-base font-bold text-white shadow-lg transition-transform active:scale-95 hover:brightness-110"
                >
                  <Phone className="h-5 w-5" strokeWidth={2.5} />
                  {hero.cta_primary.label}
                </a>
                {hero.cta_secondary && (
                  <a
                    href={hero.cta_secondary.href}
                    className="flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/5 px-7 py-4 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/15"
                  >
                    {hero.cta_secondary.label}
                    <ChevronRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </motion.div>
          </div>

          {/* Trust signal strip */}
          {social_proof?.items?.length ? (
            <div className="relative border-t border-white/10 bg-black/25 backdrop-blur">
              <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                {social_proof.items.map((item) => {
                  const Icon = resolveIcon(item.icon);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 text-sm font-semibold text-white/90"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-[var(--accent)]" strokeWidth={2.5} />
                      <span>{item.value}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>

        {/* =========================================================== OFFER */}
        {offer && (
          <Reveal>
            <section className="bg-[var(--primary)] text-white">
              <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Tag className="mt-0.5 h-6 w-6 shrink-0 text-[var(--accent)]" strokeWidth={2.5} />
                  <div>
                    <p className="text-lg font-extrabold leading-tight">
                      {offer.headline}
                      {offer.price && (
                        <span className="ml-2 text-[var(--accent)]">{offer.price}</span>
                      )}
                    </p>
                    {offer.description && (
                      <p className="mt-1 text-sm text-white/80">{offer.description}</p>
                    )}
                    {offer.code && (
                      <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-white/70">
                        Code:{" "}
                        <span className="rounded bg-white/15 px-2 py-0.5 text-white">
                          {offer.code}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                {offer.cta && (
                  <a
                    href={offer.cta.href}
                    className="shrink-0 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-white shadow-md transition-transform active:scale-95 hover:brightness-110"
                  >
                    {offer.cta.label}
                  </a>
                )}
              </div>
            </section>
          </Reveal>
        )}

        {/* ======================================================== SERVICES */}
        {services.length > 0 && (
          <section id="services" className="bg-zinc-50 py-16 sm:py-24">
            <div className="mx-auto max-w-6xl px-4">
              <Reveal className="mb-10 max-w-2xl">
                <h2 className="text-3xl font-extrabold tracking-tight text-[var(--primary)] sm:text-4xl">
                  What we do
                </h2>
                <p className="mt-3 text-zinc-600">
                  Workmanship you can rely on — done right the first time.
                </p>
              </Reveal>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((svc, i) => {
                  const Icon = resolveIcon(svc.icon);
                  return (
                    <Reveal key={svc.id} delay={i * 0.05}>
                      <article className="group h-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg">
                        <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[var(--primary)] text-white transition-colors group-hover:bg-[var(--accent)]">
                          <Icon className="h-6 w-6" strokeWidth={2} />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-900">{svc.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                          {svc.description}
                        </p>
                        {svc.starting_price && (
                          <p className="mt-4 text-sm font-bold text-[var(--accent)]">
                            {svc.starting_price}
                          </p>
                        )}
                      </article>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* =========================================================== ABOUT */}
        {about && (
          <section id="about" className="py-16 sm:py-24">
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
              {about.photo_url && (
                <Reveal>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-xl">
                    <Image
                      src={about.photo_url}
                      alt={about.heading ?? `About ${business.name}`}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover"
                    />
                    {typeof about.years_in_business === "number" && (
                      <div className="absolute bottom-4 left-4 rounded-xl bg-[var(--accent)] px-4 py-3 text-white shadow-lg">
                        <span className="block text-2xl font-black leading-none">
                          {about.years_in_business}+
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          Years experience
                        </span>
                      </div>
                    )}
                  </div>
                </Reveal>
              )}

              <Reveal delay={0.1}>
                <h2 className="text-3xl font-extrabold tracking-tight text-[var(--primary)] sm:text-4xl">
                  {about.heading ?? `About ${business.name}`}
                </h2>
                <p className="mt-4 whitespace-pre-line leading-relaxed text-zinc-600">
                  {about.body}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {about.licence && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
                      <BadgeCheck className="h-4 w-4 text-[var(--accent)]" />
                      {about.licence}
                    </span>
                  )}
                  {business.abn && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
                      <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
                      ABN {business.abn}
                    </span>
                  )}
                </div>
              </Reveal>
            </div>
          </section>
        )}

        {/* ==================================================== SERVICE AREA */}
        {service_area?.suburbs?.length ? (
          <section className="bg-[var(--primary)] py-16 text-white sm:py-20">
            <div className="mx-auto max-w-6xl px-4 text-center">
              <Reveal>
                <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {service_area.heading ?? "Areas we service"}
                </h2>
                {service_area.intro && (
                  <p className="mx-auto mt-3 max-w-2xl text-white/80">
                    {service_area.intro}
                  </p>
                )}
              </Reveal>
              <Reveal delay={0.1}>
                <ul className="mt-8 flex flex-wrap justify-center gap-2.5">
                  {service_area.suburbs.map((suburb) => (
                    <li
                      key={suburb}
                      className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
                    >
                      <MapPin className="h-3.5 w-3.5 text-[var(--accent)]" />
                      {suburb}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </section>
        ) : null}

        {/* ========================================================= GALLERY */}
        {gallery?.length ? (
          <section id="gallery" className="py-16 sm:py-24">
            <div className="mx-auto max-w-6xl px-4">
              <Reveal className="mb-10 max-w-2xl">
                <h2 className="text-3xl font-extrabold tracking-tight text-[var(--primary)] sm:text-4xl">
                  Recent work
                </h2>
                <p className="mt-3 text-zinc-600">A look at some jobs we&apos;ve completed.</p>
              </Reveal>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                {gallery.map((item, i) => (
                  <Reveal key={item.id} delay={(i % 3) * 0.05}>
                    <figure className="group relative aspect-square overflow-hidden rounded-xl bg-zinc-100 shadow-sm">
                      <Image
                        src={item.image_url}
                        alt={item.alt ?? item.caption ?? "Completed work"}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {item.caption && (
                        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 text-xs font-medium text-white">
                          {item.caption}
                        </figcaption>
                      )}
                    </figure>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* ==================================================== TESTIMONIALS */}
        {testimonials?.length ? (
          <section id="reviews" className="bg-zinc-50 py-16 sm:py-24">
            <div className="mx-auto max-w-6xl px-4">
              <Reveal className="mb-10 max-w-2xl">
                <h2 className="text-3xl font-extrabold tracking-tight text-[var(--primary)] sm:text-4xl">
                  What our customers say
                </h2>
              </Reveal>
              <div className="grid gap-5 md:grid-cols-3">
                {testimonials.map((t, i) => (
                  <Reveal key={t.id} delay={i * 0.05}>
                    <blockquote className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                      <Quote className="h-7 w-7 text-[var(--accent)]" />
                      {typeof t.rating === "number" && (
                        <div className="mt-3">
                          <Stars rating={t.rating} />
                        </div>
                      )}
                      <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-700">
                        “{t.quote}”
                      </p>
                      <footer className="mt-5 text-sm">
                        <span className="font-bold text-zinc-900">{t.author}</span>
                        {t.location && (
                          <span className="text-zinc-500"> · {t.location}</span>
                        )}
                      </footer>
                    </blockquote>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* ========================================================= CONTACT */}
        <section id="contact" className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="overflow-hidden rounded-3xl bg-[var(--secondary)] text-white shadow-xl">
              <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-2">
                <Reveal>
                  <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                    {contact?.heading ?? "Get in touch"}
                  </h2>
                  <p className="mt-3 text-white/80">
                    Call us or send a message — we&apos;ll get straight back to you.
                  </p>

                  <div className="mt-8 space-y-4">
                    {phone && (
                      <a
                        href={telHref(phone)}
                        className="flex items-center gap-3 text-lg font-semibold transition-colors hover:text-[var(--accent)]"
                      >
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
                          <Phone className="h-5 w-5 text-[var(--accent)]" />
                        </span>
                        {phone}
                      </a>
                    )}
                    {email && (
                      <a
                        href={`mailto:${email}`}
                        className="flex w-full min-w-0 items-center gap-3 text-base font-medium transition-colors hover:text-[var(--accent)]"
                      >
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10">
                          <Mail className="h-5 w-5 text-[var(--accent)]" />
                        </span>
                        <span className="min-w-0 flex-1 break-all">{email}</span>
                      </a>
                    )}
                    {contact?.address && (
                      <p className="flex items-center gap-3 text-base text-white/90">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10">
                          <MapPin className="h-5 w-5 text-[var(--accent)]" />
                        </span>
                        {contact.address}
                      </p>
                    )}
                  </div>

                  {contact?.cta && (
                    <a
                      href={contact.cta.href}
                      className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-7 py-4 text-base font-bold text-white shadow-lg transition-transform active:scale-95 hover:brightness-110"
                    >
                      <Phone className="h-5 w-5" strokeWidth={2.5} />
                      {contact.cta.label}
                    </a>
                  )}
                </Reveal>

                {contact?.hours?.length ? (
                  <Reveal delay={0.1}>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                      <h3 className="flex items-center gap-2 text-lg font-bold">
                        <Clock className="h-5 w-5 text-[var(--accent)]" />
                        Opening hours
                      </h3>
                      <dl className="mt-4 divide-y divide-white/10">
                        {contact.hours.map((h) => (
                          <div
                            key={h.label}
                            className="flex items-center justify-between py-2.5 text-sm"
                          >
                            <dt className="font-medium text-white/80">{h.label}</dt>
                            <dd className="font-semibold">{h.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </Reveal>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ============================================================ FOOTER */}
      <footer className="bg-[var(--primary)] text-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-lg font-extrabold tracking-tight">{business.name}</p>
              {business.tagline && (
                <p className="mt-1 max-w-sm text-sm text-white/70">{business.tagline}</p>
              )}
              {(business.suburb || business.state) && (
                <p className="mt-2 text-sm text-white/60">
                  {[business.suburb, business.state].filter(Boolean).join(", ")}
                </p>
              )}
            </div>

            <nav aria-label="Footer">
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
                {navLinks.map((l) => (
                  <li key={l.href}>
                    <a className="transition-colors hover:text-white" href={l.href}>
                      {l.label}
                    </a>
                  </li>
                ))}
                {phone && (
                  <li>
                    <a className="transition-colors hover:text-white" href={telHref(phone)}>
                      Call us
                    </a>
                  </li>
                )}
              </ul>
            </nav>
          </div>

          <div className="mt-8 flex flex-col gap-1 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {year} {business.name}. All rights reserved.
            </p>
            {business.abn && <p>ABN {business.abn}</p>}
          </div>
        </div>
      </footer>

      {/* ================================================= STICKY MOBILE CTA */}
      {(phone || contact?.cta) && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] backdrop-blur md:hidden">
          <a
            href={phone ? telHref(phone) : contact!.cta!.href}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3.5 text-base font-bold text-white shadow-md active:scale-[0.98]"
          >
            <Phone className="h-5 w-5" strokeWidth={2.5} />
            {phone ? `Call ${business.name.split(" ")[0]}` : contact!.cta!.label}
          </a>
        </div>
      )}
      {/* Spacer so the sticky bar never overlaps footer content on mobile */}
      <div className="h-20 md:hidden" aria-hidden />
    </div>
  );
}
