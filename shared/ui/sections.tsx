"use client";

/**
 * Reusable, niche-agnostic content sections, harvested and generalised from the
 * original single-page trades template. Driven entirely by props (no hardcoded
 * business copy) and themed via the `--primary/--secondary/--accent` CSS
 * variables set by <SiteShell>.
 */

import Image from "next/image";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ChevronRight,
  Quote,
  ShieldCheck,
  BadgeCheck,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { LeadCaptureForm, TrackedPhoneLink } from "@/shared/ui/lead-capture";
import type { Home, ContentBlock, FaqItem } from "@/shared/types/site-props";
import type {
  Testimonial,
  GalleryItem,
  SocialProofItem,
} from "@/shared/types/template-props";
import { resolveIcon } from "./icons";
import { telHref, href } from "./helpers";
import { Reveal, Stars } from "./client";

type Cta = { label: string; href: string };
type SuburbLink = { slug: string; suburb: string };

/**
 * Grid column classes chosen from item count so grids never end with a lonely
 * card in the last row. Rule: 2 or 4 items → 2 columns; 3, 5, or more → 3
 * columns. Mobile stays 1 column; sm stays 2. Used by every card grid on the
 * homepage so the layout adapts to whatever the generator produced.
 */
function gridColsForCount(count: number): string {
  const useTwo = count === 2 || count === 4;
  return useTwo ? "sm:grid-cols-2 lg:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
}

/* -------------------------------------------------------------------- hero */

export function Hero({
  headline,
  subheadline,
  tagline,
  heroImage,
  ctaPrimary,
  ctaSecondary,
  socialProof,
}: {
  headline: string;
  subheadline?: string;
  tagline?: string;
  heroImage?: string;
  ctaPrimary: Cta;
  ctaSecondary?: Cta;
  socialProof?: SocialProofItem[];
}) {
  return (
    <section className="relative isolate overflow-hidden bg-[var(--secondary)] text-white">
      {heroImage && (
        <Image data-customise="hero" src={heroImage} alt="" fill priority sizes="100vw" className="object-cover" />
      )}
      <div className="absolute inset-0 -z-0 bg-gradient-to-br from-[var(--secondary)]/95 via-[var(--primary)]/85 to-[var(--primary)]/60" />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pb-24 sm:pt-24">
        <Reveal className="max-w-2xl">
          {tagline && (
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" />
              {tagline}
            </p>
          )}
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            {headline}
          </h1>
          {subheadline && (
            <p className="mt-5 max-w-xl text-base text-white/85 sm:text-lg">{subheadline}</p>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={ctaPrimary.href}
              className="flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-7 py-4 text-base font-bold text-[var(--accent-fg)] shadow-lg transition-transform hover:brightness-110 active:scale-95"
            >
              <Phone className="h-5 w-5" strokeWidth={2.5} />
              {ctaPrimary.label}
            </a>
            {ctaSecondary && (
              <a
                href={ctaSecondary.href}
                className="flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/5 px-7 py-4 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/15"
              >
                {ctaSecondary.label}
                <ChevronRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </Reveal>
      </div>

      {socialProof?.length ? (
        <div className="relative border-t border-white/10 bg-black/25 backdrop-blur">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            {socialProof.map((item) => {
              const Icon = resolveIcon(item.icon);
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-2 text-sm text-white/90"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" strokeWidth={2.5} />
                  <span className="flex flex-col leading-tight">
                    <span className="font-semibold">{item.value}</span>
                    {item.label && (
                      <span className="text-xs font-normal text-white/60">{item.label}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/* --------------------------------------------------- compact page hero */

/** Slim hero for sub-pages (service / location / area / faq / about). */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  image,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  image?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-[var(--secondary)] text-white">
      {image && (
        <Image src={image} alt="" fill priority sizes="100vw" className="object-cover" />
      )}
      <div className="absolute inset-0 -z-0 bg-gradient-to-br from-[var(--secondary)]/95 via-[var(--primary)]/85 to-[var(--primary)]/70" />
      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:py-20">
        {eyebrow && (
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
            {eyebrow}
          </p>
        )}
        <h1 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
          {title}
        </h1>
        {subtitle && <p className="mt-4 max-w-2xl text-base text-white/85 sm:text-lg">{subtitle}</p>}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- offer */

export function OfferBand({
  headline,
  description,
  price,
  code,
  cta,
}: {
  headline: string;
  description?: string;
  price?: string;
  code?: string;
  cta?: Cta;
}) {
  return (
    <Reveal>
      <section className="bg-[var(--primary)] text-[var(--primary-fg)]">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Tag className="mt-0.5 h-6 w-6 shrink-0 text-[var(--accent)]" strokeWidth={2.5} />
            <div>
              <p className="text-lg font-extrabold leading-tight">
                {headline}
                {price && <span className="ml-2 text-[var(--accent)]">{price}</span>}
              </p>
              {description && <p className="mt-1 text-sm text-white/80">{description}</p>}
              {code && (
                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-white/70">
                  Code:{" "}
                  <span className="rounded bg-white/15 px-2 py-0.5 text-white">{code}</span>
                </p>
              )}
            </div>
          </div>
          {cta && (
            <a
              href={cta.href}
              className="shrink-0 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[var(--accent-fg)] shadow-md transition-transform hover:brightness-110 active:scale-95"
            >
              {cta.label}
            </a>
          )}
        </div>
      </section>
    </Reveal>
  );
}

/* ------------------------------------------------------------- services */

export function ServicesGrid({
  services,
  basePath,
  heading = "What we do",
  subheading,
}: {
  services: Home["services"];
  basePath: string;
  heading?: string;
  subheading?: string;
}) {
  if (!services.length) return null;
  return (
    <section id="services" className="scroll-mt-20 bg-zinc-50 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-[var(--primary)] sm:text-4xl">
            {heading}
          </h2>
          {subheading && <p className="mt-3 text-zinc-600">{subheading}</p>}
        </Reveal>

        <div className={`grid gap-5 ${gridColsForCount(services.length)}`}>
          {services.map((svc, i) => {
            const Icon = resolveIcon(svc.icon);
            const link = svc.slug ? href(basePath, "services", svc.slug) : undefined;
            const inner = (
              <article className="group h-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-fg)]">
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-zinc-900">{svc.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{svc.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  {svc.starting_price ? (
                    <span className="text-sm font-bold text-[var(--accent)]">
                      {svc.starting_price}
                    </span>
                  ) : (
                    <span />
                  )}
                  {link && (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)] transition-colors group-hover:text-[var(--accent)]">
                      Learn more <ChevronRight className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </article>
            );
            return (
              <Reveal key={svc.id} delay={i * 0.05}>
                {link ? (
                  <a href={link} className="block h-full">
                    {inner}
                  </a>
                ) : (
                  inner
                )}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- about */

export function AboutSection({
  heading,
  body,
  photoUrl,
  yearsInBusiness,
  licence,
  abn,
  businessName,
  values,
}: {
  heading?: string;
  body: string;
  photoUrl?: string;
  yearsInBusiness?: number;
  licence?: string;
  abn?: string;
  businessName: string;
  values?: Array<{ id: string; title: string; body: string; icon?: string }>;
}) {
  return (
    <section id="about" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          {photoUrl && (
            <Reveal>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-xl">
                <Image
                  src={photoUrl}
                  alt={heading ?? `About ${businessName}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                {typeof yearsInBusiness === "number" && (
                  <div className="absolute bottom-4 left-4 rounded-xl bg-[var(--accent)] px-4 py-3 text-[var(--accent-fg)] shadow-lg">
                    <span className="block text-2xl font-black leading-none">{yearsInBusiness}+</span>
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
              {heading ?? `About ${businessName}`}
            </h2>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-zinc-600">{body}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {licence && (
                <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
                  <BadgeCheck className="h-4 w-4 text-[var(--accent)]" />
                  {licence}
                </span>
              )}
              {abn && (
                <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700">
                  <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
                  ABN {abn}
                </span>
              )}
            </div>
          </Reveal>
        </div>

        {values && values.length > 0 && (
          <div className={`mt-12 grid gap-6 ${gridColsForCount(values.length)}`}>
            {values.map((v, i) => {
              const Icon = resolveIcon(v.icon);
              return (
                <Reveal key={v.id} delay={(i % 3) * 0.05}>
                  <div className="h-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)]/10">
                      <Icon className="h-5 w-5 text-[var(--accent)]" />
                    </span>
                    <h3 className="mt-4 text-lg font-bold text-[var(--primary)]">{v.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">{v.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/* --------------------------------------------------------- service area */

export function ServiceAreaSection({
  heading,
  intro,
  suburbs,
  locations,
  basePath,
}: {
  heading?: string;
  intro?: string;
  suburbs: string[];
  locations?: SuburbLink[];
  basePath: string;
}) {
  if (!suburbs.length && !locations?.length) return null;
  // Prefer linked location pages where they exist; fall back to plain chips.
  const linkBySuburb = new Map((locations ?? []).map((l) => [l.suburb.toLowerCase(), l.slug]));
  return (
    <section id="areas" className="scroll-mt-20 bg-[var(--chrome-bg)] py-16 text-[var(--chrome-fg)] sm:py-20">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <Reveal>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {heading ?? "Areas we service"}
          </h2>
          {intro && <p className="mx-auto mt-3 max-w-2xl opacity-80">{intro}</p>}
        </Reveal>
        <Reveal delay={0.1}>
          <ul className="mt-8 flex flex-wrap justify-center gap-2.5">
            {suburbs.map((suburb) => {
              const slug = linkBySuburb.get(suburb.toLowerCase());
              const chip = (
                <span className="flex items-center gap-1.5 rounded-full border border-current/15 bg-current/5 px-4 py-2 text-sm font-medium opacity-90 transition-colors hover:bg-current/10">
                  <MapPin className="h-3.5 w-3.5 text-[var(--accent)]" />
                  {suburb}
                </span>
              );
              return (
                <li key={suburb}>
                  {slug ? <a href={href(basePath, "locations", slug)}>{chip}</a> : chip}
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- gallery */

export function GalleryGrid({
  items,
  heading = "Recent work",
  subheading,
}: {
  items: GalleryItem[];
  heading?: string;
  subheading?: string;
}) {
  if (!items.length) return null;
  return (
    <section id="gallery" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-[var(--primary)] sm:text-4xl">
            {heading}
          </h2>
          {subheading && <p className="mt-3 text-zinc-600">{subheading}</p>}
        </Reveal>
        <div
          className={
            items.length === 2 || items.length === 4
              ? "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2"
              : "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3"
          }
        >
          {items.map((item, i) => (
            <Reveal key={item.id} delay={(i % 3) * 0.05}>
              <figure className="group relative aspect-square overflow-hidden rounded-xl bg-zinc-100 shadow-sm">
                <Image
                  data-customise="gallery"
                  data-gallery-index={i}
                  src={item.image_url}
                  alt={item.alt ?? item.caption ?? "Completed work"}
                  fill
                  sizes="(max-width: 1024px) 50vw, 33vw"
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
  );
}

/* --------------------------------------------------------- testimonials */

export function TestimonialsSection({
  items,
  heading = "What our customers say",
}: {
  items: Testimonial[];
  heading?: string;
}) {
  if (!items.length) return null;
  // Always show three testimonials — trims longer lists so the grid stays full.
  const shown = items.slice(0, 3);
  return (
    <section id="reviews" className="scroll-mt-20 bg-zinc-50 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-[var(--primary)] sm:text-4xl">
            {heading}
          </h2>
        </Reveal>
        <div className="grid gap-5 md:grid-cols-3">
          {shown.map((t, i) => (
            <Reveal key={t.id} delay={i * 0.05}>
              <blockquote className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <Quote className="h-7 w-7 text-[var(--accent)]" />
                {typeof t.rating === "number" && (
                  <div className="mt-3">
                    <Stars rating={t.rating} />
                  </div>
                )}
                <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-700">“{t.quote}”</p>
                <footer className="mt-5 text-sm">
                  <span className="font-bold text-zinc-900">{t.author}</span>
                  {t.location && <span className="text-zinc-500"> · {t.location}</span>}
                </footer>
              </blockquote>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- contact */

export function ContactSection({
  heading,
  phone,
  email,
  address,
  hours,
  cta,
  tenantId,
}: {
  heading?: string;
  phone?: string;
  email?: string;
  address?: string;
  hours?: { label: string; value: string }[];
  cta?: Cta;
  /** When set, enables enquiry form + call-click tracking tied to this tenant. */
  tenantId?: string;
}) {
  return (
    <section id="contact" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="overflow-hidden rounded-3xl bg-[var(--primary)] text-[var(--primary-fg)] shadow-xl">
          <div className="p-8 sm:p-12">
            {/* Top row — heading + full-width contact details */}
            <Reveal>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                {heading ?? "Get in touch"}
              </h2>
              <p className="mt-3 max-w-2xl text-white/80">
                Call us or send a message — we&apos;ll get straight back to you.
              </p>
              <div className="mt-8 flex flex-wrap gap-4 sm:gap-8">
                {phone && (
                  <TrackedPhoneLink
                    href={telHref(phone)}
                    tenantId={tenantId}
                    phone={phone}
                    className="flex items-center gap-3 text-lg font-semibold transition-colors hover:text-[var(--accent)]"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
                      <Phone className="h-5 w-5 text-[var(--accent)]" />
                    </span>
                    {phone}
                  </TrackedPhoneLink>
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
                {address && (
                  <p className="flex items-center gap-3 text-base text-white/90">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10">
                      <MapPin className="h-5 w-5 text-[var(--accent)]" />
                    </span>
                    {address}
                  </p>
                )}
              </div>
              {cta && (
                <a
                  href={cta.href}
                  className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-7 py-4 text-base font-bold text-[var(--accent-fg)] shadow-lg transition-transform hover:brightness-110 active:scale-95"
                >
                  <Phone className="h-5 w-5" strokeWidth={2.5} />
                  {cta.label}
                </a>
              )}
            </Reveal>

            {/* Bottom row — opening hours (left) + enquiry form (right), equal height */}
            {(hours?.length || tenantId) && (
              <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-2">
                {hours?.length ? (
                  <Reveal className="h-full">
                    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6">
                      <h3 className="flex items-center gap-2 text-lg font-bold">
                        <Clock className="h-5 w-5 text-[var(--accent)]" />
                        Opening hours
                      </h3>
                      <dl className="mt-4 flex-1 divide-y divide-white/10">
                        {hours.map((h) => (
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
                <Reveal delay={0.1} className="h-full">
                  <div className="h-full [&>form]:flex [&>form]:h-full [&>form]:flex-col">
                    <LeadCaptureForm tenantId={tenantId} />
                  </div>
                </Reveal>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------- generic content */

/** Renders long-form heading+body blocks (service/location page bodies). */
export function ContentSections({ blocks }: { blocks: ContentBlock[] }) {
  if (!blocks.length) return null;
  return (
    <div className="space-y-10">
      {blocks.map((b, i) => (
        <Reveal key={i} delay={(i % 3) * 0.05}>
          <div>
            {b.heading && (
              <h2 className="text-2xl font-extrabold tracking-tight text-[var(--primary)] sm:text-3xl">
                {b.heading}
              </h2>
            )}
            <p className="mt-3 whitespace-pre-line leading-relaxed text-zinc-600">{b.body}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/** Tick-list of benefits / inclusions. */
export function BenefitsList({ items, heading }: { items: string[]; heading?: string }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8">
      {heading && <h3 className="text-lg font-bold text-zinc-900">{heading}</h3>}
      <ul className={"grid gap-3 sm:grid-cols-2 " + (heading ? "mt-4" : "")}>
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2.5 text-sm text-zinc-700">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Accessible FAQ list using native disclosure. */
export function FaqList({
  items,
  heading,
}: {
  items: FaqItem[];
  heading?: string;
}) {
  if (!items.length) return null;
  return (
    <section className="py-4">
      {heading && (
        <h2 className="mb-6 text-2xl font-extrabold tracking-tight text-[var(--primary)] sm:text-3xl">
          {heading}
        </h2>
      )}
      <div className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {items.map((f) => (
          <details key={f.id} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-semibold text-zinc-900">
              {f.question}
              <ChevronRight className="h-5 w-5 shrink-0 text-[var(--accent)] transition-transform group-open:rotate-90" />
            </summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-600">
              {f.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Reusable call-to-action band for the bottom of sub-pages. */
export function CtaBand({
  heading,
  body,
  cta,
}: {
  heading: string;
  body?: string;
  cta: Cta;
}) {
  return (
    <section className="bg-[var(--primary)] text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:py-16">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{heading}</h2>
          {body && <p className="mt-2 max-w-xl text-white/80">{body}</p>}
        </div>
        <a
          href={cta.href}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-7 py-4 text-base font-bold text-[var(--accent-fg)] shadow-lg transition-transform hover:brightness-110 active:scale-95"
        >
          <Phone className="h-5 w-5" strokeWidth={2.5} />
          {cta.label}
        </a>
      </div>
    </section>
  );
}

/** Simple linked card list for interlinking (related services / nearby areas). */
export function RelatedLinks({
  heading,
  links,
}: {
  heading: string;
  links: Array<{ label: string; href: string; sublabel?: string }>;
}) {
  if (!links.length) return null;
  return (
    <section className="bg-zinc-50 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-8 text-2xl font-extrabold tracking-tight text-[var(--primary)] sm:text-3xl">
          {heading}
        </h2>
        <div className={`grid gap-4 ${gridColsForCount(links.length)}`}>
          {links.map((l) => (
            <a
              key={l.href + l.label}
              href={l.href}
              className="group flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <span>
                <span className="block font-semibold text-zinc-900">{l.label}</span>
                {l.sublabel && <span className="text-sm text-zinc-500">{l.sublabel}</span>}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-[var(--accent)] transition-transform group-hover:translate-x-0.5" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export type { Cta, SuburbLink };
