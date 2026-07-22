import Link from "next/link";
import { PenLine, Zap, Globe, ExternalLink } from "lucide-react";
import NicheForm from "./NicheForm";

/* -------------------------------------------------------------------------- */
/*  Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface Testimonial {
  name: string;
  role: string;
  quote: string;
  rating: 5;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface Feature {
  icon: string;
  title: string;
  body: string;
}

export interface PainPoint {
  quote: string;
  detail: string;
}

export interface NicheHomeLandingConfig {
  /** Category the intake form pre-selects. Must match a real category slug. */
  category: string;
  /** Sub-niche picker options in the intake form. */
  subNiches: string[];
  /** Little pill above the hero headline (e.g. "For Australian tradies"). */
  tag: string;
  /** Two-part hero headline. First plain, second gradient-highlighted. */
  heroHeadline1: string;
  heroHeadline2: string;
  heroSub: string;
  /** Accent used on primary CTAs. */
  accentClass: string;
  /** Category example URL — the "See a live example" link target. */
  exampleHref: string;
  /** Iframe title / short label for the embedded example. */
  exampleAlt: string;
  /** Four short niche-specific metrics for the stats bar. */
  stats: [Stat, Stat, Stat, Stat];
  /** Three niche-specific pain points ("sound familiar?"). */
  painPoints: [PainPoint, PainPoint, PainPoint];
  /** Six niche-specific website features. */
  features: Feature[];
  testimonials: Testimonial[];
  faqs: Faq[];
  /** Bottom CTA band headline. */
  ctaHeadline: string;
  /** Bottom CTA band sub. */
  ctaSub: string;
}

/* -------------------------------------------------------------------------- */
/*  Layout                                                                      */
/* -------------------------------------------------------------------------- */

export default function NicheHomeLanding({ config }: { config: NicheHomeLandingConfig }) {
  return (
    <div className="flex flex-col min-h-screen bg-[#0A0F1E] text-white">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="w-full bg-[#0A0F1E] border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" aria-label="Launcharoo">
            <img
              src="/images/launcharoo-logo-white.webp"
              alt="Launcharoo"
              className="h-6 w-auto"
            />
          </Link>
          <div className="flex items-center gap-4">
            <a
              href="#intake"
              className={`hidden sm:inline-flex ${config.accentClass} text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors`}
            >
              Build my site
            </a>
          </div>
        </div>
      </header>

      {/* ─── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-[#0A0F1E]">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.25) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 flex flex-col items-center text-center px-6 py-20 max-w-4xl mx-auto w-full">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950 border border-blue-800/50 text-blue-300 text-xs font-semibold mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            {config.tag}
          </div>

          <h1 className="font-[family-name:var(--font-sora)] text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1] sm:leading-[1.05] mb-6">
            {config.heroHeadline1}{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {config.heroHeadline2}
            </span>
          </h1>

          <p className="text-white/60 text-base sm:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
            {config.heroSub}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-0">
            <a
              href="#intake"
              className={`${config.accentClass} text-white font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-xl shadow-blue-900/50`}
            >
              See my website now
            </a>
            <a
              href={config.exampleHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 underline underline-offset-4 hover:text-white text-sm font-medium flex items-center justify-center gap-1.5"
            >
              See a live example
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-white/40">
            <span>✓ 60-second live site</span>
            <span>✓ Built from Google data</span>
            <span>✓ Cancel anytime</span>
            <span>✓ No web designer needed</span>
          </div>
        </div>
      </section>

      {/* ─── Stats bar ──────────────────────────────────────────────────── */}
      <div className="w-full bg-white/5 border-y border-white/10 py-4 sm:py-8 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 sm:gap-8 text-center">
          {config.stats.map((stat) => (
            <div key={stat.label}>
              <div className="text-lg sm:text-3xl font-extrabold text-white leading-tight">{stat.value}</div>
              <div className="text-[11px] sm:text-sm text-white/50 mt-0.5 sm:mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Pain points ─────────────────────────────────────────────── */}
      <section className="bg-[#0A0F1E] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
              Sound familiar?
            </p>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl text-white tracking-tight max-w-2xl mx-auto">
              You&apos;re missing customers you don&apos;t even know about.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {config.painPoints.map((p) => (
              <div
                key={p.quote}
                className="bg-white/5 border border-white/10 rounded-2xl p-7 flex flex-col gap-3"
              >
                <p className="text-white font-bold text-lg leading-snug">&ldquo;{p.quote}&rdquo;</p>
                <p className="text-white/50 text-sm leading-relaxed">{p.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────────────────── */}
      <section className="bg-[#040812] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
              Built for your industry
            </p>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl text-white tracking-tight">
              Everything your website needs, out of the box
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {config.features.map((item) => (
              <div
                key={item.title}
                className="bg-white/5 border border-white/10 rounded-2xl p-7 flex flex-col gap-3"
              >
                <div className="w-10 h-10 bg-blue-900/40 rounded-xl flex items-center justify-center text-xl">
                  {item.icon}
                </div>
                <h3 className="text-base font-bold text-white">{item.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Live example card ──────────────────────────────────────── */}
      <section className="bg-[#0A0F1E] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
              A real one, live right now
            </p>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl text-white tracking-tight">
              See a real example site
            </h2>
            <p className="text-white/50 text-lg mt-3 max-w-xl mx-auto">
              This is a live, multi-page site generated by our tool. Click through it, then build yours.
            </p>
          </div>
          <div className="relative rounded-3xl border border-white/10 bg-white/5 overflow-hidden shadow-2xl shadow-black/50 group">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 bg-white/5 border-b border-white/10 px-4 py-3">
              <span className="w-3 h-3 rounded-full bg-red-500/70" />
              <span className="w-3 h-3 rounded-full bg-amber-400/70" />
              <span className="w-3 h-3 rounded-full bg-green-500/70" />
              <div className="ml-4 flex-1 h-7 rounded-md bg-black/40 border border-white/10 flex items-center px-3">
                <span className="text-xs font-mono text-white/50 truncate">launcharoo.online{config.exampleHref}</span>
              </div>
              <a
                href={config.exampleHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                Open <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            {/* Live iframe of the example site */}
            <div className="relative bg-white">
              <iframe
                src={config.exampleHref}
                title={config.exampleAlt}
                loading="lazy"
                className="block w-full h-[560px] sm:h-[720px] bg-white"
              />
              {/* Bottom fade so long pages don't look cut off, plus prominent open link */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0A0F1E] via-[#0A0F1E]/70 to-transparent" />
              <a
                href={config.exampleHref}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#0A0F1E] shadow-xl hover:bg-blue-50 transition-colors"
              >
                Explore the full example
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────────────────── */}
      <section className="bg-[#040812] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
              How it works
            </p>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl text-white tracking-tight mb-4">
              From zero to live in 60 seconds
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              No agency. No designer. No waiting.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                number: "01",
                Icon: PenLine,
                heading: "Enter your details",
                body: "Your business name, specialty and suburb. Done in 30 seconds.",
              },
              {
                number: "02",
                Icon: Zap,
                heading: "We build your site",
                body: "We pull your Google Business Profile and generate a complete multi-page website in under 60 seconds.",
              },
              {
                number: "03",
                Icon: Globe,
                heading: "Go live or customise",
                body: "Your site is live on a real URL. Change colours, add your logo, done.",
              },
            ].map((step) => {
              const StepIcon = step.Icon;
              return (
                <div
                  key={step.number}
                  className="relative flex flex-col gap-5 bg-white/5 border border-white/10 rounded-2xl p-8"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-blue-400 bg-blue-600/20 border border-blue-600/30 rounded-full px-3 py-1 tracking-widest">
                      {step.number}
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/40">
                    <StepIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2">{step.heading}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{step.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─────────────────────────────────────────────── */}
      <section className="bg-[#0A0F1E] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
              Real results
            </p>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl text-white tracking-tight">
              Australian businesses growing with Launcharoo
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {config.testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-white/5 border border-white/10 rounded-2xl p-7 flex flex-col gap-4"
              >
                <div className="flex gap-0.5 text-amber-400 text-sm">
                  {"★".repeat(t.rating)}
                </div>
                <p className="text-white/70 text-sm leading-relaxed italic flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="pt-2 border-t border-white/10">
                  <p className="text-white text-sm font-bold">{t.name}</p>
                  <p className="text-white/40 text-xs">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Embedded intake ─────────────────────────────────────────── */}
      <section id="intake" className="bg-[#040812] py-24 px-6 scroll-mt-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
              Your turn
            </p>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl sm:text-5xl text-white tracking-tight mb-4">
              Build your site
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Enter your details. Your preview is ready in about 60 seconds.
            </p>
          </div>
          <div className="max-w-[806px] mx-auto">
            <NicheForm
              subNiches={config.subNiches}
              category={config.category}
              accentClass={config.accentClass}
            />
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────── */}
      <section className="bg-[#0A0F1E] py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
              Questions
            </p>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl text-white tracking-tight">
              Frequently asked
            </h2>
          </div>
          <div className="space-y-3">
            {config.faqs.map((f) => (
              <details
                key={f.q}
                className="group bg-white/5 border border-white/10 rounded-2xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-semibold text-white">
                  {f.q}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 text-white/50 shrink-0 transition-transform group-open:rotate-180"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.4a.75.75 0 01-1.08 0l-4.25-4.4a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Bottom CTA band ─────────────────────────────────────────── */}
      <section className="w-full bg-gradient-to-b from-blue-700 to-blue-900 py-24 px-6">
        <div className="max-w-2xl mx-auto text-center flex flex-col gap-6">
          <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl sm:text-5xl text-white tracking-tight">
            {config.ctaHeadline}
          </h2>
          <p className="text-blue-100 text-lg">{config.ctaSub}</p>
          <div className="flex justify-center">
            <a
              href="#intake"
              className="px-6 py-3.5 rounded-xl bg-white text-blue-700 font-bold text-sm hover:bg-blue-50 transition-colors"
            >
              Build my site
            </a>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer className="bg-[#040812] border-t border-white/10 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <img
            src="/images/launcharoo-logo-white.webp"
            alt="Launcharoo"
            className="h-6 w-auto"
          />
          <div className="flex gap-6">
            <Link href="/" className="text-white/40 hover:text-white/70 text-sm transition-colors">
              Home
            </Link>
            <Link href="/for/trades" className="text-white/40 hover:text-white/70 text-sm transition-colors">
              Trades
            </Link>
            <Link href="/for/allied-health" className="text-white/40 hover:text-white/70 text-sm transition-colors">
              Allied Health
            </Link>
            <Link href="/for/beauty" className="text-white/40 hover:text-white/70 text-sm transition-colors">
              Beauty
            </Link>
            <Link href="/for/fitness" className="text-white/40 hover:text-white/70 text-sm transition-colors">
              Fitness
            </Link>
          </div>
          <span className="text-white/30 text-sm">© {new Date().getFullYear()} Launcharoo</span>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/30">
          <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
          <span className="text-white/15">·</span>
          <Link href="/terms" className="hover:text-white/60 transition-colors">Terms of Service</Link>
          <span className="text-white/15">·</span>
          <span>For Australian service businesses.</span>
        </div>
      </footer>
    </div>
  );
}
