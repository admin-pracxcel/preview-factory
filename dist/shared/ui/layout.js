"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveNav = deriveNav;
exports.JsonLd = JsonLd;
exports.Breadcrumbs = Breadcrumbs;
exports.SiteShell = SiteShell;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * Site-wide layout: themed shell, sticky header, footer, breadcrumbs, mobile
 * call bar and JSON-LD renderer. Server components (pure markup); they embed
 * the client CountdownBanner where interactivity is needed.
 */
const image_1 = __importDefault(require("next/image"));
const lucide_react_1 = require("lucide-react");
const theme_1 = require("./theme");
const helpers_1 = require("./helpers");
const client_1 = require("./client");
/** Derive a robust nav from whichever pages/sections a site actually has. */
function deriveNav(site, basePath) {
    const base = (0, helpers_1.href)(basePath);
    const items = [];
    if (site.services.length || site.home.services.length)
        items.push({ label: "Services", href: `${base}#services` });
    if (site.locations.length || site.home.service_area?.suburbs?.length)
        items.push({ label: "Areas", href: `${base}#areas` });
    if (site.home.testimonials?.length)
        items.push({ label: "Reviews", href: `${base}#reviews` });
    if (site.about)
        items.push({ label: "About", href: (0, helpers_1.href)(basePath, "about") });
    else if (site.home.about)
        items.push({ label: "About", href: `${base}#about` });
    if (site.faq)
        items.push({ label: "FAQ", href: (0, helpers_1.href)(basePath, "faq") });
    items.push({ label: "Contact", href: `${base}#contact` });
    return items;
}
function sitePhone(site) {
    return site.home.contact?.phone || site.business.phone || "";
}
/** Render a JSON-LD <script>. */
function JsonLd({ data }) {
    return ((0, jsx_runtime_1.jsx)("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(data) } }));
}
function Header({ site, basePath, nav, logo, }) {
    const phone = sitePhone(site);
    return ((0, jsx_runtime_1.jsx)("header", { className: "sticky top-0 z-40 border-b border-white/10 bg-[var(--primary)] text-white shadow-sm", children: (0, jsx_runtime_1.jsxs)("nav", { className: "mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3", children: [(0, jsx_runtime_1.jsxs)("a", { href: (0, helpers_1.href)(basePath), className: "flex min-w-0 items-center gap-2.5", children: [logo ? ((0, jsx_runtime_1.jsx)(image_1.default, { src: logo, alt: `${site.business.name} logo`, width: 40, height: 40, className: "h-9 w-auto object-contain" })) : ((0, jsx_runtime_1.jsx)("span", { className: "grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--accent)] text-sm font-black", children: site.business.name.charAt(0) })), (0, jsx_runtime_1.jsx)("span", { className: "truncate text-base font-extrabold tracking-tight sm:text-lg", children: site.business.name })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-6", children: [(0, jsx_runtime_1.jsx)("ul", { className: "hidden items-center gap-6 text-sm font-medium text-white/80 lg:flex", children: nav.map((l) => ((0, jsx_runtime_1.jsx)("li", { children: (0, jsx_runtime_1.jsx)("a", { className: "transition-colors hover:text-white", href: l.href, children: l.label }) }, l.href + l.label))) }), phone && ((0, jsx_runtime_1.jsxs)("a", { href: (0, helpers_1.telHref)(phone), className: "flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white shadow-md transition-transform hover:brightness-110 active:scale-95", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Phone, { className: "h-4 w-4", strokeWidth: 2.5 }), (0, jsx_runtime_1.jsx)("span", { className: "hidden sm:inline", children: phone }), (0, jsx_runtime_1.jsx)("span", { className: "sm:hidden", children: "Call" })] }))] })] }) }));
}
function Footer({ site, basePath, nav, }) {
    const phone = sitePhone(site);
    const { business } = site;
    // SEO interlinking: surface a few service + location pages in the footer.
    const serviceLinks = site.services.slice(0, 6);
    const locationLinks = site.locations.slice(0, 6);
    return ((0, jsx_runtime_1.jsx)("footer", { className: "bg-[var(--primary)] text-white", children: (0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-6xl px-4 py-10", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid gap-8 sm:grid-cols-2 lg:grid-cols-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-lg font-extrabold tracking-tight", children: business.name }), business.tagline && ((0, jsx_runtime_1.jsx)("p", { className: "mt-1 max-w-sm text-sm text-white/70", children: business.tagline })), (business.suburb || business.state) && ((0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-sm text-white/60", children: [business.suburb, business.state].filter(Boolean).join(", ") }))] }), serviceLinks.length > 0 && ((0, jsx_runtime_1.jsxs)("nav", { "aria-label": "Services", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-bold uppercase tracking-wide text-white/80", children: "Services" }), (0, jsx_runtime_1.jsx)("ul", { className: "mt-3 space-y-2 text-sm text-white/70", children: serviceLinks.map((s) => ((0, jsx_runtime_1.jsx)("li", { children: (0, jsx_runtime_1.jsx)("a", { className: "transition-colors hover:text-white", href: (0, helpers_1.href)(basePath, "services", s.slug), children: s.title }) }, s.slug))) })] })), locationLinks.length > 0 && ((0, jsx_runtime_1.jsxs)("nav", { "aria-label": "Areas served", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-bold uppercase tracking-wide text-white/80", children: "Areas" }), (0, jsx_runtime_1.jsx)("ul", { className: "mt-3 space-y-2 text-sm text-white/70", children: locationLinks.map((l) => ((0, jsx_runtime_1.jsx)("li", { children: (0, jsx_runtime_1.jsx)("a", { className: "transition-colors hover:text-white", href: (0, helpers_1.href)(basePath, "locations", l.slug), children: l.suburb }) }, l.slug))) })] })), (0, jsx_runtime_1.jsxs)("nav", { "aria-label": "Footer", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-bold uppercase tracking-wide text-white/80", children: "Company" }), (0, jsx_runtime_1.jsxs)("ul", { className: "mt-3 space-y-2 text-sm text-white/70", children: [nav.map((l) => ((0, jsx_runtime_1.jsx)("li", { children: (0, jsx_runtime_1.jsx)("a", { className: "transition-colors hover:text-white", href: l.href, children: l.label }) }, l.href + l.label))), phone && ((0, jsx_runtime_1.jsx)("li", { children: (0, jsx_runtime_1.jsx)("a", { className: "transition-colors hover:text-white", href: (0, helpers_1.telHref)(phone), children: "Call us" }) }))] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-8 flex flex-col gap-1 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between", children: [(0, jsx_runtime_1.jsxs)("p", { children: ["\u00A9 ", (0, helpers_1.currentYear)(), " ", business.name, ". All rights reserved."] }), business.abn && (0, jsx_runtime_1.jsxs)("p", { children: ["ABN ", business.abn] })] })] }) }));
}
/** Sticky bottom call bar on mobile + spacer so it never overlaps content. */
function MobileCallBar({ site }) {
    const phone = sitePhone(site);
    const cta = site.home.contact?.cta;
    if (!phone && !cta)
        return null;
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: "fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/95 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] backdrop-blur md:hidden", children: (0, jsx_runtime_1.jsxs)("a", { href: phone ? (0, helpers_1.telHref)(phone) : cta.href, className: "flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3.5 text-base font-bold text-white shadow-md active:scale-[0.98]", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Phone, { className: "h-5 w-5", strokeWidth: 2.5 }), phone ? `Call ${site.business.name.split(" ")[0]}` : cta.label] }) }), (0, jsx_runtime_1.jsx)("div", { className: "h-20 md:hidden", "aria-hidden": true })] }));
}
/** Breadcrumb trail for sub-pages. */
function Breadcrumbs({ crumbs }) {
    return ((0, jsx_runtime_1.jsx)("nav", { "aria-label": "Breadcrumb", className: "border-b border-zinc-100 bg-zinc-50", children: (0, jsx_runtime_1.jsx)("ol", { className: "mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-3 text-sm text-zinc-500", children: crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                return ((0, jsx_runtime_1.jsxs)("li", { className: "flex items-center gap-1", children: [last ? ((0, jsx_runtime_1.jsx)("span", { className: "font-medium text-zinc-700", children: c.label })) : ((0, jsx_runtime_1.jsx)("a", { className: "transition-colors hover:text-[var(--accent)]", href: c.href, children: c.label })), !last && (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronRight, { className: "h-3.5 w-3.5 text-zinc-400" })] }, c.href + c.label));
            }) }) }));
}
/**
 * Themed page shell: applies the brand CSS variables, optional preview
 * countdown, header and footer, and renders any JSON-LD passed in.
 */
function SiteShell({ site, basePath, jsonLd = [], children, }) {
    const theme = (0, theme_1.resolveTheme)(site.branding, site.overrides);
    const nav = deriveNav(site, basePath);
    return ((0, jsx_runtime_1.jsxs)("div", { style: theme.vars, className: "flex min-h-screen flex-col bg-white font-sans text-zinc-900 antialiased", children: [jsonLd.map((d, i) => ((0, jsx_runtime_1.jsx)(JsonLd, { data: d }, i))), site.preview?.countdown_enabled && ((0, jsx_runtime_1.jsx)(client_1.CountdownBanner, { label: site.preview.countdown_label, target: site.preview.countdown_to })), (0, jsx_runtime_1.jsx)(Header, { site: site, basePath: basePath, nav: nav, logo: theme.logo }), (0, jsx_runtime_1.jsx)("div", { className: "flex-1", children: children }), (0, jsx_runtime_1.jsx)(Footer, { site: site, basePath: basePath, nav: nav }), (0, jsx_runtime_1.jsx)(MobileCallBar, { site: site })] }));
}
