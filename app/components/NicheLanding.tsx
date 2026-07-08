"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight, CheckCircle2, RotateCcw, TrendingUp } from "lucide-react";
import NicheForm from "./NicheForm";
import HowItWorks from "./HowItWorks";
import Testimonials, { Testimonial } from "./Testimonials";

/* -------------------------------------------------------------------------- */
/*  Types                                                                       */
/* -------------------------------------------------------------------------- */

interface FAQ {
  q: string;
  a: string;
}

export interface NicheLandingConfig {
  category: string;
  heroImage: string;
  tag: string;
  headline: string;
  subheadline: string;
  subNiches: string[];
  previewRoute: string;
  previewCaption: string;
  testimonials: Testimonial[];
  faqs: FAQ[];
  accentClass?: string;
}

/* -------------------------------------------------------------------------- */
/*  FAQ accordion item                                                          */
/* -------------------------------------------------------------------------- */

function FAQItem({ q, a }: FAQ) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800 text-sm sm:text-base">{q}</span>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-slate-600 text-sm leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                              */
/* -------------------------------------------------------------------------- */

export default function NicheLanding({
  category,
  heroImage,
  tag,
  headline,
  subheadline,
  subNiches,
  previewCaption,
  testimonials,
  faqs,
  accentClass = "bg-blue-600 hover:bg-blue-500 active:bg-blue-700",
}: NicheLandingConfig) {
  return (
    <div className="flex flex-col min-h-screen bg-white text-slate-900">
      {/* ------------------------------------------------------------------ */}
      {/* Navigation — absolute, transparent over hero                         */}
      {/* ------------------------------------------------------------------ */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <div className="text-lg font-[family-name:var(--font-sora)] font-extrabold text-white tracking-tight drop-shadow-sm">
          Preview Factory
        </div>
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-white/80 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All industries
        </Link>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <Image
            src={heroImage}
            alt={`${tag} hero`}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/55" />
          {/* Bottom gradient fade */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/40 to-transparent" />
        </div>

        {/* Hero content */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 pt-28 pb-16 max-w-3xl mx-auto w-full">
          {/* Tag pill */}
          <span className="inline-block px-4 py-1.5 rounded-full border border-white/40 text-white text-xs font-semibold tracking-widest uppercase mb-6 backdrop-blur-sm bg-white/10">
            {tag}
          </span>

          {/* Headline */}
          <h1 className="font-[family-name:var(--font-sora)] text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-5">
            {headline}
          </h1>

          {/* Sub-headline */}
          <p className="text-white/75 text-xl mb-10 max-w-xl leading-relaxed">
            {subheadline}
          </p>

          {/* Form card — frosted glass */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-6 sm:p-8 max-w-md w-full">
            <NicheForm
              subNiches={subNiches}
              category={category}
              accentClass={accentClass}
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Social proof strip                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-black/30 backdrop-blur-sm border-y border-white/10 py-5 px-6 bg-slate-900">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {[
            "1,200+ businesses",
            "4.9 ★ rating",
            "60 sec build",
            "$0 setup",
          ].map((stat, i, arr) => (
            <span key={stat} className="flex items-center gap-3 text-white/70 text-sm">
              {stat}
              {i < arr.length - 1 && <span className="text-white/20">|</span>}
            </span>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* What your site includes (replaces BrowserMockup)                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="w-full bg-white py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">
              What you get
            </p>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-3xl sm:text-4xl text-slate-900 tracking-tight mb-4">
              A complete website, built for local search
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Every site includes these pages and features — generated from your Google Business Profile in under 60 seconds.
            </p>
            <p className="text-slate-400 text-sm mt-3 max-w-lg mx-auto">{previewCaption}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {[
              {
                icon: "🏠",
                title: "Homepage",
                body: "Your business name, hero image, services summary, and a prominent call-to-action.",
              },
              {
                icon: "📋",
                title: "6 service pages",
                body: "One page per service, optimised for the search terms your customers use.",
              },
              {
                icon: "📍",
                title: "8 suburb pages",
                body: "Location-specific pages that rank when locals search near them.",
              },
              {
                icon: "📞",
                title: "Call tracking",
                body: "Every inbound call logged so you can see exactly which page generated the lead.",
              },
              {
                icon: "🔍",
                title: "Local SEO structure",
                body: "Structured data, sitemap, and suburb targeting built in from day one.",
              },
              {
                icon: "📱",
                title: "Mobile-first design",
                body: "Over 70% of local searches happen on mobile. Every page is fast and clean.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-slate-50 border border-slate-100 rounded-2xl p-6 flex flex-col gap-3"
              >
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-lg">
                  {item.icon}
                </div>
                <h3 className="text-slate-900 font-bold text-sm">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mt-2">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How It Works                                                         */}
      {/* ------------------------------------------------------------------ */}
      <HowItWorks />

      {/* ------------------------------------------------------------------ */}
      {/* Trust stack                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-slate-900 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
              Why trust us
            </p>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
              Built different. Not just cheaper.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: <CheckCircle2 className="w-8 h-8 text-green-400" />,
                title: "Built from real data",
                body: "We pull your actual Google Business Profile. Your name, address, phone, photos, and services — not placeholder content.",
              },
              {
                icon: <RotateCcw className="w-8 h-8 text-blue-400" />,
                title: "7-day money-back",
                body: "Not happy in the first 7 days? Full refund, no questions. We back our product.",
              },
              {
                icon: <span className="text-2xl">🇦🇺</span>,
                title: "100% Australian",
                body: "We are an Australian business. Our customers are Australian businesses. Everything is built for the AU market.",
              },
              {
                icon: <TrendingUp className="w-8 h-8 text-amber-400" />,
                title: "Average 4.2x more enquiries",
                body: "Sites built by Preview Factory generate an average of 4.2x more online enquiries than a basic directory listing.",
              },
            ].map((pillar, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-2xl p-7 flex flex-col gap-4"
              >
                <div className="w-10 h-10 flex items-center justify-center">
                  {pillar.icon}
                </div>
                <h3 className="text-white font-bold text-base">{pillar.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Testimonials                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Testimonials items={testimonials} />

      {/* ------------------------------------------------------------------ */}
      {/* FAQ                                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="w-full bg-slate-50 py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">
              Questions
            </p>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-3xl sm:text-4xl text-slate-900 tracking-tight">
              Frequently asked
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom CTA                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="w-full bg-slate-950 py-20 px-6">
        <div className="max-w-2xl mx-auto flex flex-col items-center text-center gap-8">
          <div>
            <h2 className="font-[family-name:var(--font-sora)] font-extrabold text-3xl sm:text-4xl text-white tracking-tight mb-4">
              Ready to see yours?
            </h2>
            <p className="text-slate-400 text-lg">
              Takes 60 seconds. No credit card. No commitment.
            </p>
          </div>
          <div className="w-full max-w-md">
            <NicheForm
              subNiches={subNiches}
              category={category}
              accentClass={accentClass}
            />
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <ChevronRight className="w-4 h-4" />
            <span>Join 1,200+ Australian businesses already live</span>
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
            {[
              { label: "Trades", href: "/for/trades" },
              { label: "Allied Health", href: "/for/allied-health" },
              { label: "Beauty", href: "/for/beauty" },
              { label: "Fitness", href: "/for/fitness" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-white/40 hover:text-white/70 text-sm transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <span className="text-white/30 text-sm">© 2025 Preview Factory</span>
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
          <span>For Australian service businesses. ABN: [to be added].</span>
        </div>
      </footer>
    </div>
  );
}
