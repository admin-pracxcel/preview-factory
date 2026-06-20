import Image from "next/image";
import Link from "next/link";
import HowItWorks from "@/app/components/HowItWorks";
import Testimonials from "@/app/components/Testimonials";

/* -------------------------------------------------------------------------- */
/*  Category data                                                               */
/* -------------------------------------------------------------------------- */

const CATEGORIES = [
  {
    label: "Trades",
    desc: "Electricians, plumbers, builders & more",
    href: "/for/trades",
    image: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800&q=80",
  },
  {
    label: "Allied Health",
    desc: "Physios, chiros, massage therapists & more",
    href: "/for/allied-health",
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80",
  },
  {
    label: "Beauty & Aesthetics",
    desc: "Hair salons, nail bars, beauty therapists & more",
    href: "/for/beauty",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80",
  },
  {
    label: "Fitness & Wellness",
    desc: "Personal trainers, gyms, yoga studios & more",
    href: "/for/fitness",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
  },
];

const MASTER_TESTIMONIALS = [
  {
    name: "Dave S.",
    role: "Electrician, Penrith NSW",
    quote:
      "I was getting maybe 5 calls a week from Google. Now I get 22. The site went live in about 45 seconds and looked exactly like what I'd pay an agency $5k for.",
    rating: 5 as const,
  },
  {
    name: "Sarah K.",
    role: "Physiotherapist, Chatswood NSW",
    quote:
      "Three weeks after my site went live I had 11 new bookings from Google searches. I was relying entirely on word of mouth before this.",
    rating: 5 as const,
  },
  {
    name: "Jessica L.",
    role: "Hair Stylist, Fitzroy VIC",
    quote:
      "My Instagram was getting likes but not bookings. My new site converts. I picked up 14 new clients in the first month.",
    rating: 5 as const,
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
      style={{ minHeight: "380px" }}
    >
      {/* Background image */}
      <Image
        src={image}
        alt={label}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="(max-width: 768px) 100vw, 50vw"
      />

      {/* Gradient overlay — darker at bottom for text */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 transition-opacity duration-300 group-hover:from-black/90" />

      {/* Content */}
      <div className="relative z-10 p-7 flex flex-col gap-2">
        <h3 className="text-2xl font-bold text-white">{label}</h3>
        <p className="text-sm text-white/75">{desc}</p>
        <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 border border-white/25 text-white text-sm font-semibold backdrop-blur-sm w-fit transition-all duration-200 group-hover:bg-white/25 group-hover:border-white/40">
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
/*  Page                                                                        */
/* -------------------------------------------------------------------------- */

export const metadata = {
  title: "Preview Factory — Your Australian business website, live in 60 seconds",
  description:
    "Preview Factory builds professional websites for Australian service businesses using your Google Business Profile. Go from zero to live in under 60 seconds.",
};

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-slate-900">
      {/* ------------------------------------------------------------------ */}
      {/* Navigation                                                           */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-30 bg-white/95 border-b border-slate-100 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
          <div className="text-lg font-bold text-slate-900 tracking-tight">
            Preview Factory
          </div>
          <div className="flex items-center gap-4">
            <a
              href="#how-it-works"
              className="hidden sm:block text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              How it works
            </a>
            <Link
              href="/for/trades"
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white pt-20 pb-6 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold tracking-wide uppercase mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            1,200+ Australian businesses live
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-slate-900 leading-tight tracking-tight mb-6">
            Your business website.
            <br />
            <span className="text-blue-600">Live in 60 seconds.</span>
          </h1>

          {/* Sub-headline */}
          <p className="text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed mb-8">
            We pull your Google Business Profile and build a complete, professional website
            for your service business before you have finished your coffee. No agency. No
            designer. No waiting.
          </p>

          {/* CTA row */}
          <p className="text-slate-600 font-medium text-base mb-4">
            Choose your industry to get started:
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Category tiles                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-6 pb-20 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {CATEGORIES.map((cat) => (
            <CategoryTile key={cat.href} {...cat} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Stats bar                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="w-full bg-slate-900 py-10 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
          {[
            { value: "1,200+", label: "businesses previewed" },
            { value: "4.9 / 5", label: "average rating" },
            { value: "60 seconds", label: "to a live site" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-black text-white">{stat.value}</div>
              <div className="text-sm text-slate-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* How It Works                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div id="how-it-works">
        <HowItWorks />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Testimonials                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Testimonials
        items={MASTER_TESTIMONIALS}
        heading="Businesses growing with Preview Factory"
      />

      {/* ------------------------------------------------------------------ */}
      {/* Trust / Why us section                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="w-full bg-white py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">
              Why Preview Factory
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Built for Australian service businesses
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                className="bg-slate-50 border border-slate-100 rounded-2xl p-7 flex flex-col gap-3"
              >
                <div className="text-2xl">{item.icon}</div>
                <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom CTA                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="w-full bg-blue-600 py-20 px-6">
        <div className="max-w-2xl mx-auto text-center flex flex-col gap-6">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            See yours in 60 seconds.
          </h2>
          <p className="text-blue-100 text-lg">
            No credit card. No commitment. Just your site, live, now.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="px-6 py-3.5 rounded-xl bg-white text-blue-700 font-bold text-sm hover:bg-blue-50 transition-colors shadow-sm"
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
      <footer className="bg-slate-950 border-t border-slate-800 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
          <div className="font-bold text-slate-400">Preview Factory</div>
          <div className="flex gap-6">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="hover:text-slate-300 transition-colors"
              >
                {cat.label}
              </Link>
            ))}
          </div>
          <span>Preview Factory &copy; 2025 &middot; For Australian service businesses</span>
        </div>
      </footer>
    </div>
  );
}
