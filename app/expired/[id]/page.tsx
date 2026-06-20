import Link from "next/link";
import Image from "next/image";
import { Clock, CheckCircle2, Undo2 } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Expired preview page                                                        */
/*                                                                              */
/*  Shown when a preview's 3-hour countdown reaches zero. The site data is     */
/*  retained for 30 days. This page invites the prospect to recover and pay.   */
/* -------------------------------------------------------------------------- */

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ExpiredPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="px-6 py-5 max-w-xl mx-auto w-full">
        <div className="text-lg font-bold text-white">Preview Factory</div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-lg flex flex-col items-center text-center gap-8">

          {/* Clock illustration */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-slate-700 bg-slate-900 flex items-center justify-center shadow-xl">
              <Clock className="w-10 h-10 text-slate-400" />
            </div>
            {/* Pulsing ring */}
            <div className="absolute inset-0 rounded-full border-4 border-red-500/30 animate-ping" />
          </div>

          {/* Headline */}
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              Your preview has expired.
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed max-w-md mx-auto">
              Your 3-hour window closed, but your site is saved. We can restore it
              in under 2 minutes &mdash; just click below.
            </p>
          </div>

          {/* Thumbnail image */}
          <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              </div>
              <div className="flex-1 bg-slate-800 rounded h-4" />
            </div>
            <div className="relative" style={{ height: "200px" }}>
              <Image
                src="https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=600&q=70"
                alt="Your saved website preview"
                fill
                className="object-cover opacity-70"
                sizes="400px"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/60 backdrop-blur-sm rounded-xl px-5 py-3 flex flex-col items-center gap-1">
                  <Clock className="w-6 h-6 text-slate-300" />
                  <span className="text-white text-sm font-semibold">Preview expired</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reassurance bullets */}
          <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-3 text-left">
            {[
              "Your site is saved and ready to restore",
              "Your Google Business Profile data is retained",
              "Back online in 2 clicks",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                <span className="text-slate-300 text-sm">{item}</span>
              </div>
            ))}
          </div>

          {/* Primary CTA */}
          <div className="w-full flex flex-col gap-3">
            <Link
              href={`/?recover=true&id=${encodeURIComponent(id)}`}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-base transition-colors shadow-lg shadow-blue-900/30"
            >
              <Undo2 className="w-5 h-5" />
              Recover my site
            </Link>
            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 font-medium text-sm transition-colors"
            >
              See another example first
            </Link>
          </div>

          {/* Bottom note */}
          <p className="text-slate-600 text-xs">
            Preview data is retained for 30 days after expiry.
          </p>

        </div>
      </main>
    </div>
  );
}
