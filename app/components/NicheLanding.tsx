"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
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
/*  Stats bar                                                                   */
/* -------------------------------------------------------------------------- */

function StatsBar() {
  return (
    <div className="w-full bg-white border-y border-slate-100 py-6 px-6">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
        {[
          { value: "1,200+", label: "businesses previewed" },
          { value: "4.9 ★", label: "average rating" },
          { value: "60 sec", label: "to a live site" },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
            <div className="text-sm text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Browser mockup wrapper                                                      */
/* -------------------------------------------------------------------------- */

function BrowserMockup({ src, caption }: { src: string; caption: string }) {
  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-2xl">
        {/* Browser chrome */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-slate-400 font-mono">
            preview.previewfactory.com.au/...
          </div>
        </div>
        {/* iframe content */}
        <div className="relative" style={{ height: "500px" }}>
          <iframe
            src={src}
            title="Sample website preview"
            className="absolute inset-0 w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
      <p className="text-center text-slate-500 text-sm mt-4">{caption}</p>
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
  previewRoute,
  previewCaption,
  testimonials,
  faqs,
  accentClass = "bg-blue-600 hover:bg-blue-500 active:bg-blue-700",
}: NicheLandingConfig) {
  return (
    <div className="flex flex-col min-h-screen bg-white text-slate-900">
      {/* ------------------------------------------------------------------ */}
      {/* Navigation                                                           */}
      {/* ------------------------------------------------------------------ */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <div className="text-lg font-bold text-white tracking-tight drop-shadow-sm">
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
      <section className="relative min-h-[75vh] flex items-center justify-center overflow-hidden">
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
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-5">
            {headline}
          </h1>

          {/* Sub-headline */}
          <p className="text-lg sm:text-xl text-white/85 mb-10 max-w-xl leading-relaxed">
            {subheadline}
          </p>

          {/* Form */}
          <div className="w-full max-w-md">
            <NicheForm
              subNiches={subNiches}
              category={category}
              accentClass={accentClass}
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Stats bar                                                            */}
      {/* ------------------------------------------------------------------ */}
      <StatsBar />

      {/* ------------------------------------------------------------------ */}
      {/* Sample preview section                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="w-full bg-white py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">
              Live preview
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-4">
              See what you will get
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              This is a real preview site. Yours will include your actual business name, phone number, and Google photos.
            </p>
          </div>
          <BrowserMockup src={previewRoute} caption={previewCaption} />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How It Works                                                         */}
      {/* ------------------------------------------------------------------ */}
      <HowItWorks />

      {/* ------------------------------------------------------------------ */}
      {/* Testimonials                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Testimonials items={testimonials} />

      {/* ------------------------------------------------------------------ */}
      {/* FAQ                                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="w-full bg-white py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">
              Questions
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
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
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              Ready to see yours?
            </h2>
            <p className="text-slate-400 text-lg">
              Takes 60 seconds. No credit card. No commitment.
            </p>
          </div>
          <NicheForm
            subNiches={subNiches}
            category={category}
            accentClass={accentClass}
          />
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <ChevronRight className="w-4 h-4" />
            <span>Join 1,200+ Australian businesses already live</span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                               */}
      {/* ------------------------------------------------------------------ */}
      <footer className="bg-slate-950 border-t border-slate-800 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-500">Preview Factory</span>
          <span>For Australian service businesses &copy; 2025</span>
          <Link href="/" className="hover:text-slate-400 transition-colors">
            View all industries
          </Link>
        </div>
      </footer>
    </div>
  );
}
