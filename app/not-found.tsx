import Link from "next/link";
import { Compass, Home, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

/**
 * app/not-found.tsx
 *
 * Global 404 page. Rendered whenever a route calls `notFound()` or when
 * Next can't match a URL. This layout is host-agnostic — the root layout
 * is shared with tenant subdomains and custom domains, so the copy stays
 * neutral and the primary CTA is a host-relative link to `/`. Marketing
 * visitors land back on the Launcharoo home; tenant visitors land back on
 * the customer's own home.
 */

export const metadata: Metadata = {
  title: "Page not found | Launcharoo",
  description:
    "The page you were looking for doesn't exist. Head back to the home page.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex flex-col flex-1 min-h-screen bg-[#0A0F1E] text-white">
      <header className="px-6 py-5 max-w-xl mx-auto w-full">
        <Link
          href="/"
          className="text-xl font-[family-name:var(--font-sora)] font-extrabold text-white hover:text-blue-300 transition-colors"
        >
          Launcharoo
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <div className="w-full max-w-md flex flex-col items-center text-center">
          {/* Visual */}
          <div className="w-32 h-32 mx-auto mb-8 relative">
            <div
              className="absolute inset-0 rounded-full bg-blue-900/20 border-2 border-blue-800/40 animate-ping"
              style={{ animationDuration: "2.4s" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-blue-900/40 flex items-center justify-center">
                <Compass className="w-12 h-12 text-blue-300" />
              </div>
            </div>
          </div>

          {/* Big 404 badge */}
          <p className="text-xs font-bold uppercase tracking-widest text-blue-300/70">
            Error 404
          </p>

          <h1 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl sm:text-5xl text-white tracking-tight mt-3">
            We can&apos;t find that page.
          </h1>

          <p className="text-white/55 text-lg leading-relaxed mt-4 max-w-sm mx-auto">
            The link might be broken, or the page may have moved. Let&apos;s
            get you back on track.
          </p>

          {/* Primary CTA */}
          <Link
            href="/"
            className="mt-10 inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 px-6 py-3 text-base font-semibold text-white transition-colors shadow-lg shadow-blue-900/40"
          >
            <Home className="w-4 h-4" />
            Back to home
            <ArrowRight className="w-4 h-4" />
          </Link>

          {/* Support */}
          <p className="mt-10 text-sm text-white/40">
            Still stuck?{" "}
            <a
              href="mailto:hello@launcharoo.online"
              className="text-white/60 hover:text-white transition-colors underline decoration-white/20 hover:decoration-white/60 underline-offset-4"
            >
              hello@launcharoo.online
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
