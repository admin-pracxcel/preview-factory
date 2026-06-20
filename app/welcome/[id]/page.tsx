import Link from "next/link";
import { ExternalLink, MessageSquare, TrendingUp, Mail, RefreshCw } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Welcome page                                                                */
/*                                                                              */
/*  Shown after a successful Stripe checkout. The site is now permanently live */
/*  on a subdomain. This page confirms the URL, explains SMS editing, and sets */
/*  expectations for the first 30 days.                                         */
/* -------------------------------------------------------------------------- */

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Derive a human-readable subdomain from the lead/subscription id. */
function deriveSubdomain(id: string): string {
  // Strip any lead_ prefix and timestamp to get a clean slug
  const clean = id
    .replace(/^lead_\d+_/, "")
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase()
    .slice(0, 30);
  return clean || "your-business";
}

export default async function WelcomePage({ params }: PageProps) {
  const { id } = await params;
  const subdomain = deriveSubdomain(id);
  const siteUrl = `https://${subdomain}.mysitehq.com.au`;

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="px-6 py-5 max-w-2xl mx-auto w-full">
        <div className="text-lg font-semibold text-white">Preview Factory</div>
      </header>

      {/* Main */}
      <main className="flex flex-1 flex-col items-center px-6 py-10">
        <div className="w-full max-w-xl flex flex-col gap-8">

          {/* Hero section */}
          <div className="text-center flex flex-col gap-3">
            <div className="mx-auto mb-2 w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <span className="text-2xl">&#10003;</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Your site is live.
            </h1>
            <p className="text-slate-400 text-lg">
              It is now permanently published at the address below.
            </p>
          </div>

          {/* URL card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Your permanent web address
            </p>
            <div className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3">
              <span className="flex-1 text-blue-400 font-mono text-sm break-all">
                {siteUrl}
              </span>
            </div>
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Visit your site
            </a>
          </div>

          {/* SMS editing section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-blue-400 shrink-0" />
              <h2 className="text-base font-semibold text-white">
                How to update your site
              </h2>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Text your change to{" "}
              <a
                href="sms:+611800000000"
                className="text-white font-semibold hover:text-blue-400 transition-colors"
              >
                +61 XXX XXX XXX
              </a>
              . We will update your site within 2 hours.
            </p>
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium mb-2">Example messages</p>
              <ul className="flex flex-col gap-1.5 text-xs text-slate-400">
                <li>&ldquo;Update my phone number to 0412 345 678&rdquo;</li>
                <li>&ldquo;Add carpet cleaning to my services&rdquo;</li>
                <li>&ldquo;Change my trading hours to Mon-Fri 7am-5pm&rdquo;</li>
              </ul>
            </div>
          </div>

          {/* What happens next */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
            <h2 className="text-base font-semibold text-white">What happens next</h2>
            <ul className="flex flex-col gap-4">
              <li className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    SEO takes 2 to 4 weeks to kick in
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Google crawls new sites within a few days. Rankings build
                    steadily over the first month.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Check your monthly report in your inbox
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    We send a plain-English performance report each month:
                    calls, clicks, and rankings.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <RefreshCw className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Reply to the welcome SMS to make changes
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Any time you need to update your site, just reply to the SMS
                    we sent you. No logins required.
                  </p>
                </div>
              </li>
            </ul>
          </div>

          {/* Support footer */}
          <div className="text-center text-sm text-slate-500">
            <p>
              Need help?{" "}
              <a
                href="tel:1800000000"
                className="text-slate-300 hover:text-white transition-colors"
              >
                Call 1800 XXX XXX
              </a>{" "}
              or reply to your welcome SMS.
            </p>
          </div>

          {/* Back link */}
          <div className="text-center">
            <Link
              href="/"
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              Back to Preview Factory
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}
