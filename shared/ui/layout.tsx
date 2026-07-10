/**
 * Site-wide layout: themed shell, sticky header with dropdown nav, footer,
 * breadcrumbs, mobile call bar and JSON-LD renderer. Server components (pure
 * markup); they embed the client CountdownBanner where interactivity is needed.
 */
import Image from "next/image";
import { Phone, ChevronRight, ChevronDown } from "lucide-react";
import type { SiteProps } from "@/shared/types/site-props";
import { resolveTheme } from "./theme";
import { href, telHref, currentYear } from "./helpers";
import { CountdownBanner } from "./client";
import { CustomisationListener } from "./customisation-listener";
import { EditableImageOverlay } from "./editable-image-overlay";
import { MobileNav } from "./mobile-nav";

export interface NavItem {
  label: string;
  href: string;
  /** When present, render as a dropdown menu. */
  children?: Array<{ label: string; href: string }>;
}

/**
 * Derive a robust nav from whichever pages/sections a site actually has.
 * Service and location collections become dropdown menus; scalar pages
 * (About, FAQ, Contact) remain flat links.
 */
export function deriveNav(site: SiteProps, basePath: string): NavItem[] {
  const base = href(basePath);
  const items: NavItem[] = [];

  // Services — dropdown linking to each service-detail page (max 8 items).
  if (site.services.length) {
    items.push({
      label: "Services",
      href: `${base}#services`,
      children: site.services.slice(0, 8).map((s) => ({
        label: s.title,
        href: href(basePath, "services", s.slug),
      })),
    });
  } else if (site.home.services.length) {
    items.push({ label: "Services", href: `${base}#services` });
  }

  // Areas — dropdown linking to each location page (max 8 items).
  if (site.locations.length) {
    items.push({
      label: "Areas",
      href: `${base}#areas`,
      children: site.locations.slice(0, 8).map((l) => ({
        label: l.suburb,
        href: href(basePath, "locations", l.slug),
      })),
    });
  } else if (site.home.service_area?.suburbs?.length) {
    items.push({ label: "Areas", href: `${base}#areas` });
  }

  if (site.home.testimonials?.length)
    items.push({ label: "Reviews", href: `${base}#reviews` });
  if (site.about) items.push({ label: "About", href: href(basePath, "about") });
  else if (site.home.about) items.push({ label: "About", href: `${base}#about` });
  if (site.faq) items.push({ label: "FAQ", href: href(basePath, "faq") });
  items.push({ label: "Contact", href: `${base}#contact` });
  return items;
}

function sitePhone(site: SiteProps): string {
  return site.home.contact?.phone || site.business.phone || "";
}

/** Render a JSON-LD <script>. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function Header({
  site,
  basePath,
  nav,
  logo,
}: {
  site: SiteProps;
  basePath: string;
  nav: NavItem[];
  logo: string;
}) {
  const phone = sitePhone(site);
  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-[var(--chrome-bg)] text-[var(--chrome-fg)] shadow-sm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        {/* Logo / business name */}
        <a href={href(basePath)} className="flex min-w-0 items-center gap-2.5">
          {logo ? (
            <Image
              data-customise="logo"
              src={logo}
              alt={`${site.business.name} logo`}
              width={240}
              height={240}
              className="w-auto object-contain"
              style={{ height: "var(--logo-height, 36px)" }}
            />
          ) : (
            <span data-customise="logo-fallback" className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--accent)] text-sm font-black text-[var(--accent-fg)]">
              {site.business.name.charAt(0)}
            </span>
          )}
          <span
            data-customise="business-name"
            className="truncate text-base font-extrabold tracking-tight sm:text-lg"
            style={logo ? { display: "none" } : undefined}
          >
            {site.business.name}
          </span>
        </a>

        <div className="flex items-center gap-2">
          {/* Desktop nav with dropdown support */}
          <ul className="hidden items-center gap-0.5 text-sm font-medium lg:flex">
            {nav.map((l) =>
              l.children?.length ? (
                /* Dropdown item — CSS-only hover, no JS needed */
                <li key={l.href + l.label} className="group relative">
                  <span className="flex cursor-default select-none items-center gap-1 rounded-md px-3 py-2 opacity-80 transition-colors hover:bg-black/5 hover:text-[var(--accent)] hover:opacity-100">
                    {l.label}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:rotate-180" />
                  </span>
                  {/* Dropdown panel */}
                  <ul className="invisible absolute left-0 top-full z-50 min-w-[200px] translate-y-1 rounded-xl border border-black/10 bg-[var(--chrome-bg)] py-1.5 opacity-0 shadow-2xl transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    {l.children.map((c) => (
                      <li key={c.href}>
                        <a
                          href={c.href}
                          className="block px-4 py-2 text-sm text-[var(--chrome-fg)] opacity-80 transition-colors hover:bg-black/5 hover:opacity-100"
                        >
                          {c.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                /* Flat nav link */
                <li key={l.href + l.label}>
                  <a
                    className="block rounded-md px-3 py-2 opacity-80 transition-colors hover:bg-black/5 hover:text-[var(--accent)] hover:opacity-100"
                    href={l.href}
                  >
                    {l.label}
                  </a>
                </li>
              ),
            )}
          </ul>

          {phone && (
            <a
              href={telHref(phone)}
              className="ml-2 flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--accent-fg)] shadow-md transition-transform hover:brightness-110 active:scale-95 lg:ml-4"
            >
              <Phone className="h-4 w-4" strokeWidth={2.5} />
              <span className="hidden sm:inline">{phone}</span>
              <span className="sm:hidden">Call</span>
            </a>
          )}

          <MobileNav nav={nav} />
        </div>
      </nav>
    </header>
  );
}

function Footer({
  site,
  basePath,
  nav,
  logo,
}: {
  site: SiteProps;
  basePath: string;
  nav: NavItem[];
  logo: string;
}) {
  const phone = sitePhone(site);
  const { business } = site;
  // SEO interlinking: surface a few service + location pages in the footer.
  const serviceLinks = site.services.slice(0, 6);
  const locationLinks = site.locations.slice(0, 6);

  return (
    <footer className="bg-[var(--chrome-bg)] text-[var(--chrome-fg)] border-t border-current/10">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {logo ? (
              <Image
                data-customise="footer-logo"
                src={logo}
                alt={`${business.name} logo`}
                width={240}
                height={240}
                className="w-auto object-contain"
                style={{ height: "var(--logo-height, 36px)" }}
              />
            ) : null}
            <p
              data-customise="footer-business-name"
              className="text-lg font-extrabold tracking-tight"
              style={logo ? { display: "none" } : undefined}
            >
              {business.name}
            </p>
            {business.tagline && (
              <p className="mt-1 max-w-sm text-sm opacity-70">{business.tagline}</p>
            )}
            {(business.suburb || business.state) && (
              <p className="mt-2 text-sm opacity-60">
                {[business.suburb, business.state].filter(Boolean).join(", ")}
              </p>
            )}
          </div>

          {serviceLinks.length > 0 && (
            <nav aria-label="Services">
              <p className="text-sm font-bold uppercase tracking-wide opacity-80">Services</p>
              <ul className="mt-3 space-y-2 text-sm">
                {serviceLinks.map((s) => (
                  <li key={s.slug}>
                    <a
                      className="opacity-70 transition-opacity hover:opacity-100"
                      href={href(basePath, "services", s.slug)}
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {locationLinks.length > 0 && (
            <nav aria-label="Areas served">
              <p className="text-sm font-bold uppercase tracking-wide opacity-80">Areas</p>
              <ul className="mt-3 space-y-2 text-sm">
                {locationLinks.map((l) => (
                  <li key={l.slug}>
                    <a
                      className="opacity-70 transition-opacity hover:opacity-100"
                      href={href(basePath, "locations", l.slug)}
                    >
                      {l.suburb}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <nav aria-label="Footer">
            <p className="text-sm font-bold uppercase tracking-wide opacity-80">Company</p>
            <ul className="mt-3 space-y-2 text-sm">
              {nav.map((l) => (
                <li key={l.href + l.label}>
                  <a className="opacity-70 transition-opacity hover:opacity-100" href={l.href}>
                    {l.label}
                  </a>
                </li>
              ))}
              {phone && (
                <li>
                  <a className="opacity-70 transition-opacity hover:opacity-100" href={telHref(phone)}>
                    Call us
                  </a>
                </li>
              )}
            </ul>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-1 border-t border-current/10 pt-6 text-xs opacity-50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {currentYear()} {business.name}. All rights reserved.
          </p>
          {business.abn && <p>ABN {business.abn}</p>}
        </div>
      </div>
    </footer>
  );
}

/** Sticky bottom call bar on mobile + spacer so it never overlaps content. */
function MobileCallBar({ site }: { site: SiteProps }) {
  const phone = sitePhone(site);
  const cta = site.home.contact?.cta;
  if (!phone && !cta) return null;
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] backdrop-blur md:hidden">
        <a
          href={phone ? telHref(phone) : cta!.href}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3.5 text-base font-bold text-[var(--accent-fg)] shadow-md active:scale-[0.98]"
        >
          <Phone className="h-5 w-5" strokeWidth={2.5} />
          {phone ? "Call Now" : cta!.label}
        </a>
      </div>
      <div className="h-20 md:hidden" aria-hidden />
    </>
  );
}

/** Breadcrumb trail for sub-pages. */
export function Breadcrumbs({ crumbs }: { crumbs: NavItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="border-b border-zinc-100 bg-zinc-50">
      <ol className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-3 text-sm text-zinc-500">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href + c.label} className="flex items-center gap-1">
              {last ? (
                <span className="font-medium text-zinc-700">{c.label}</span>
              ) : (
                <a className="transition-colors hover:text-[var(--accent)]" href={c.href}>
                  {c.label}
                </a>
              )}
              {!last && <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Themed page shell: applies the brand CSS variables, optional preview
 * countdown, header and footer, and renders any JSON-LD passed in.
 */
export function SiteShell({
  site,
  basePath,
  jsonLd = [],
  children,
}: {
  site: SiteProps;
  basePath: string;
  jsonLd?: Array<Record<string, unknown>>;
  children: React.ReactNode;
}) {
  const theme = resolveTheme(site.branding, site.overrides);
  const nav = deriveNav(site, basePath);
  return (
    <div
      data-theme-root
      style={theme.vars}
      className="flex min-h-screen flex-col bg-white font-sans text-zinc-900 antialiased"
    >
      {jsonLd.map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}
      {site.preview?.countdown_enabled && (
        <CountdownBanner label={site.preview.countdown_label} target={site.preview.countdown_to} />
      )}
      <Header site={site} basePath={basePath} nav={nav} logo={theme.logo} />
      <div className="flex-1">{children}</div>
      <Footer site={site} basePath={basePath} nav={nav} logo={theme.logo} />
      <MobileCallBar site={site} />
      <CustomisationListener />
      <EditableImageOverlay />
    </div>
  );
}
