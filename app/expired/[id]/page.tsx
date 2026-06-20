import Link from "next/link";
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
    <div className="flex flex-col flex-1 min-h-screen bg-[#0A0F1E] text-white">
      {/* Header */}
      <header className="px-6 py-5 max-w-xl mx-auto w-full">
        <div className="text-xl font-[family-name:var(--font-sora)] font-extrabold text-white">
          Preview Factory
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <div className="w-full max-w-md flex flex-col items-center text-center">

          {/* Large visual */}
          <div className="w-32 h-32 mx-auto mb-8 relative">
            {/* Outer ring — slow pulse */}
            <div
              className="absolute inset-0 rounded-full bg-red-900/20 border-2 border-red-800/40 animate-ping"
              style={{ animationDuration: "2s" }}
            />
            {/* Inner circle */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-red-900/40 flex items-center justify-center">
                <Clock className="w-12 h-12 text-red-400" />
              </div>
            </div>
          </div>

          {/* Headline */}
          <h1 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl text-white tracking-tight mt-6">
            Your preview has expired.
          </h1>

          {/* Sub */}
          <p className="text-white/55 text-lg leading-relaxed mt-3 max-w-sm mx-auto">
            Your 3-hour window closed, but your site is saved. We can restore it and get it live again in under 2 minutes.
          </p>

          {/* Status card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-8 text-left w-full">
            <div className="flex flex-col gap-3">
              {[
                "Your site design is saved and ready to restore",
                "Your Google Business Profile data is retained",
                "Back online in 2 clicks. No rebuilding required.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <span className="text-white/70 text-sm leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Primary CTA */}
          <Link
            href={`/?recover=true&id=${encodeURIComponent(id)}`}
            className="mt-8 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-900/40 transition-colors"
          >
            <Undo2 className="w-5 h-5" />
            Recover my site now
          </Link>

          {/* Secondary CTA */}
          <div className="mt-3">
            <Link
              href="/"
              className="text-white/40 hover:text-white/70 text-sm underline underline-offset-4 transition-colors"
            >
              See another example first
            </Link>
          </div>

          {/* Footer note */}
          <p className="text-white/20 text-xs mt-8">
            Preview data is retained for 30 days after expiry.
          </p>

        </div>
      </main>
    </div>
  );
}
