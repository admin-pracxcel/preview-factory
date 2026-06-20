import Image from "next/image";
import Link from "next/link";
import { PenLine, Zap, Globe } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Category data                                                               */
/* -------------------------------------------------------------------------- */

const CATEGORIES = [
  {
    label: "Trades",
    desc: "Electricians, plumbers, builders and more",
    href: "/for/trades",
    image: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800&q=80",
  },
  {
    label: "Allied Health",
    desc: "Physios, chiros, massage therapists and more",
    href: "/for/allied-health",
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80",
  },
  {
    label: "Beauty & Aesthetics",
    desc: "Hair salons, nail bars, beauty therapists and more",
    href: "/for/beauty",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80",
  },
  {
    label: "Fitness & Wellness",
    desc: "Personal trainers, gyms, yoga studios and more",
    href: "/for/fitness",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
  },
];

const MASTER_TESTIMONIALS = [
  {
    name: "Dave S.",
    role: "Electrician, Penrith NSW",
    initials: "DS",
    quote:
      "I was getting maybe 5 calls a week from Google. Now I get 22. The site went live in about 45 seconds and looked exactly like what I'd pay an agency $5,000 for.",
    rating: 5,
  },
  {
    name: "Sarah K.",
    role: "Physiotherapist, Chatswood NSW",
    initials: "SK",
    quote:
      "Three weeks after my site went live I had 11 new bookings from Google searches. Before this I was relying entirely on word of mouth.",
    rating: 5,
  },
  {
    name: "Jessica L.",
    role: "Hair Stylist, Fitzroy VIC",
    initials: "JL",
    quote:
      "My Instagram was getting likes but not bookings. My new site converts. Picked up 14 new clients in the first month.",
    rating: 5,
  },
];

/* -------------------------------------------------------------------------- */
/*  Category tile                                                               */
/* -------------------------------------------------------------------------- */

function CategoryTile({
  label,
  desc,
  href,
  image,
}: {
  label: string;
  desc: string;
  href: string;
  image: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-end overflow-hidden rounded-2xl"
      style={{ minHeight: "400px" }}
    >
      <Image
        src={image}
        alt={label}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="(max-width: 768px) 100vw, 50vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-300 group-hover:from-black/80" />
      <div className="relative z-10 p-7 flex flex-col gap-2">
        <h3 className="text-2xl font-[family-name:var(--font-sora)] font-extrabold text-white">{label}</h3>
        <p className="text-sm text-white/65">{desc}</p>
        <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-semibold backdrop-blur-sm w-fit transition-all duration-200 group-hover:bg-white/20">
          Get started
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stars                                                                       */
/* -------------------------------------------------------------------------- */

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                        */
/* -------------------------------------------------------------------------- */

export const metadata = {
  title: "Preview Factory — Your Australian business website, live in 60 seconds",
  description:
    "Preview Factory builds professional websites for Australian service businesses using your Google Business Profile. Go from zero to live in under 60 seconds.",
};

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0A0F1E] text-white">

      {/* ------------------------------------------------------------------ */}
      {/* Navigation — sticky dark glass                                       */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-30 bg-black/95 border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
          <div className="text-xl font-[family-name:var(--font-sora)] font-extrabold text-white tracking-tight">
            Preview Factory
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#how-it-works"
              className="hidden sm:block text-sm text-white/70 hover:text-white transition-colors"
            >
              How it works
            </a>
            <a
              href="#industries"
              className="px-5 py-2 rounded-full bg-white text-black font-bold text-sm hover:bg-white/90 transition-colors"
            >
              Get started
            </a>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero — dark, full-viewport                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0A0F1E]">
        {/* Radial gradient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.25) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center px-6 py-20 max-w-4xl mx-auto w-full">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950 border border-blue-800/50 text-blue-300 text-xs font-semibold mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            1,200+ Australian businesses live
          </div>

          {/* Headline */}
          <h1
            className="font-[family-name:var(--font-sora)] text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight text-white leading-[1.05] mb-6"
          >
            The fastest way
            <br />
            to get your business{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              online.
            </span>
          </h1>

          {/* Sub */}
          <p className="text-white/60 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
            We pull your Google Business Profile and build a complete professional website automatically. Live in under 60 seconds. No agency. No web designer.
          </p>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-0">
            <a
              href="#industries"
              className="bg-blue-600 text-white font-bold px-8 py-4 rounded-2xl text-base hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/50"
            >
              See my website now
            </a>
            <a
              href="#how-it-works"
              className="text-white/60 underline underline-offset-4 hover:text-white text-sm font-medium flex items-center justify-center"
            >
              How it works →
            </a>
          </div>

          {/* Trust strip */}
          <div className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-white/40">
            <span>✓ 60-second live site</span>
            <span>✓ Built from Google data</span>
            <span>✓ Cancel anytime</span>
            <span>✓ No web designer needed</span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Stats bar                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="w-full bg-white/5 border-y border-white/10 py-8 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: "1,200+", label: "businesses previewed" },
            { value: "4.9 ★", label: "average rating" },
            { value: "60 sec", label: "average build time" },
            { value: "$0", label: "setup fee" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-extrabold text-white">{stat.value}</div>
              <div className="text-sm text-white/50 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Industries                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section id="industries" className="bg-[#0A0F1E] py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
              Industries
            </p>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl sm:text-5xl text-white tracking-tight mb-4">
              Choose your industry
            </h2>
            <p className="text-white/50 text-lg">One funnel, tailored to your trade.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {CATEGORIES.map((cat) => (
              <CategoryTile key={cat.href} {...cat} />
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How It Works                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section id="how-it-works" className="bg-[#040812] py-24 px-6">
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
                body: "Your business name, specialty, and suburb. Done in 30 seconds.",
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

      {/* ------------------------------------------------------------------ */}
      {/* Testimonials                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-[#0A0F1E] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
              Real results
            </p>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl text-white tracking-tight">
              Australian businesses growing with Preview Factory
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {MASTER_TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-2xl p-7 flex flex-col gap-4"
              >
                <Stars count={t.rating} />
                <p className="text-white/70 text-sm leading-relaxed italic flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                  <div className="w-9 h-9 rounded-full bg-blue-800 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-blue-200">{t.initials}</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">{t.name}</p>
                    <p className="text-white/40 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Features                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-[#040812] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
              Why Preview Factory
            </p>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl text-white tracking-tight">
              Built for Australian service businesses
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: "⚡",
                title: "60 seconds to live",
                body: "From form submit to a real, live URL. Not a mockup. A working website indexed by Google.",
              },
              {
                icon: "📍",
                title: "Local SEO built in",
                body: "Every site includes suburb-specific pages and structured data so you show up when locals search.",
              },
              {
                icon: "📱",
                title: "Mobile-first",
                body: "Over 70% of your clients are on their phone. Every page is fast, clean, and designed for mobile first.",
              },
              {
                icon: "🔗",
                title: "Uses your real Google data",
                body: "We pull your business name, address, phone, photos, and category from your Google Business Profile automatically.",
              },
              {
                icon: "🎨",
                title: "Customise in seconds",
                body: "Change colours, add your logo, swap the hero image. No designer needed. Changes go live in a few seconds.",
              },
              {
                icon: "💬",
                title: "Update via SMS",
                body: "Need to change your hours or add a service? Just text us. No logins, no portals.",
              },
            ].map((item) => (
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

      {/* ------------------------------------------------------------------ */}
      {/* Bottom CTA band                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="w-full bg-gradient-to-b from-blue-700 to-blue-900 py-24 px-6">
        <div className="max-w-2xl mx-auto text-center flex flex-col gap-6">
          <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl sm:text-5xl text-white tracking-tight">
            See yours in 60 seconds.
          </h2>
          <p className="text-blue-100 text-lg">
            No credit card. No commitment. Just your site, live, now.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="px-6 py-3.5 rounded-xl bg-white text-blue-700 font-bold text-sm hover:bg-blue-50 transition-colors"
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                               */}
      {/* ------------------------------------------------------------------ */}
      <footer className="bg-[#040812] border-t border-white/10 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-[family-name:var(--font-sora)] font-extrabold text-white text-base">
            Preview Factory
          </div>
          <div className="flex gap-6">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="text-white/40 hover:text-white/70 text-sm transition-colors"
              >
                {cat.label}
              </Link>
            ))}
          </div>
          <span className="text-white/30 text-sm">© 2025 Preview Factory</span>
        </div>
        <div className="text-white/20 text-xs text-center mt-6">
          For Australian service businesses. ABN: [to be added].
        </div>
      </footer>
    </div>
  );
}
