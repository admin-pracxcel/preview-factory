/**
 * app/components/MarketingFooter.tsx
 *
 * Shared footer for every marketing-host page. Pure presentational — no
 * data dependencies. If the category list grows or moves, update it here
 * and every page using this footer picks it up.
 */

import Link from "next/link";

const FOOTER_CATEGORIES = [
  { label: "Trades", href: "/for/trades" },
  { label: "Allied Health", href: "/for/allied-health" },
  { label: "Beauty & Aesthetics", href: "/for/beauty" },
  { label: "Fitness & Wellness", href: "/for/fitness" },
];

export default function MarketingFooter() {
  return (
    <footer className="bg-[#040812] border-t border-white/10 py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <img
          src="/images/launcharoo-logo-white.webp"
          alt="Launcharoo"
          className="h-6 w-auto"
        />
        <div className="flex gap-6">
          {FOOTER_CATEGORIES.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              className="text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              {cat.label}
            </Link>
          ))}
        </div>
        <span className="text-white/30 text-sm">
          © {new Date().getFullYear()} Launcharoo
        </span>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/30">
        <Link href="/privacy" className="hover:text-white/60 transition-colors">
          Privacy Policy
        </Link>
        <span className="text-white/15">·</span>
        <Link href="/terms" className="hover:text-white/60 transition-colors">
          Terms of Service
        </Link>
        <span className="text-white/15">·</span>
        <span>For Australian service businesses.</span>
      </div>
    </footer>
  );
}
