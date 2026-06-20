import Link from "next/link";
import { Clock, ShieldCheck, Undo2 } from "lucide-react";

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
        <div className="text-lg font-semibold text-white">Preview Factory</div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md flex flex-col items-center text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-8">
            <Clock className="w-8 h-8 text-slate-400" />
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Your preview has expired.
          </h1>

          {/* Sub-copy */}
          <p className="text-slate-300 text-lg leading-relaxed mb-8">
            Your site was live for 3 hours. We have saved it. Just let us know
            you would like to continue and we will restore it within minutes.
          </p>

          {/* Primary CTA */}
          <Link
            href={`/?recover=true&id=${encodeURIComponent(id)}`}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-base transition-colors mb-4 shadow-lg shadow-blue-900/30"
          >
            <Undo2 className="w-5 h-5" />
            Get my site back
          </Link>

          {/* Secondary CTA */}
          <p className="text-slate-400 text-sm">
            Questions? Call us on{" "}
            <a
              href="tel:1800000000"
              className="text-white font-medium hover:text-blue-400 transition-colors"
            >
              1800 XXX XXX
            </a>
          </p>

          {/* Trust strip */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              Your data is safe
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              Preview saved for 30 days
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              No lock-in contracts
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
