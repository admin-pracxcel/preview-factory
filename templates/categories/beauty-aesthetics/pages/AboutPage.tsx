/** Beauty & Aesthetics category — about page. */
import type { SiteProps } from "@/shared/types/site-props";
import Image from "next/image";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import {
  SiteShell,
  Breadcrumbs,
  PageHero,
  TestimonialsSection,
  CtaBand,
  resolveIcon,
  href,
  buildLocalBusinessJsonLd,
  buildBreadcrumbJsonLd,
} from "@/shared/ui";
import { primaryCta } from "../cta";

export function AboutPage({ site, basePath }: { site: SiteProps; basePath: string }) {
  const about = site.about;
  if (!about) return null;
  const { business } = site;

  const crumbs = [
    { label: "Home", href: href(basePath) },
    { label: "About", href: href(basePath, "about") },
  ];

  const jsonLd = [
    buildLocalBusinessJsonLd(site),
    buildBreadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: c.href }))),
  ];

  const cta = primaryCta(site, basePath);

  return (
    <SiteShell site={site} basePath={basePath} jsonLd={jsonLd}>
      <Breadcrumbs crumbs={crumbs} />
      <PageHero eyebrow="About" title={about.heading ?? `About ${business.name}`} />

      <section className="py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 lg:grid-cols-2">
          <div>
            <p className="whitespace-pre-line text-lg leading-relaxed text-zinc-700">{about.body}</p>
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
          </div>

          {about.photo_url && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-xl">
              <Image
                src={about.photo_url}
                alt={about.heading ?? `About ${business.name}`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              {typeof about.years_in_business === "number" && (
                <div className="absolute bottom-4 left-4 rounded-xl bg-[var(--accent)] px-4 py-3 text-[var(--accent-fg)] shadow-lg">
                  <span className="block text-2xl font-black leading-none">
                    {about.years_in_business}+
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Years experience
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {about.values.length > 0 && (
          <div className="mx-auto mt-16 max-w-6xl px-4">
            <div
              className={
                about.values.length === 2 || about.values.length === 4
                  ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-2"
                  : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              }
            >
              {about.values.map((v) => {
                const Icon = resolveIcon(v.icon);
                return (
                  <div
                    key={v.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                  >
                    <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[var(--primary)] text-[var(--primary-fg)]">
                      <Icon className="h-6 w-6" strokeWidth={2} />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900">{v.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">{v.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {site.home.testimonials?.length ? (
        <TestimonialsSection items={site.home.testimonials} heading="What our clients say" />
      ) : null}

      <CtaBand heading="Come in and see us" body="Book your next appointment today." cta={cta} />
    </SiteShell>
  );
}
