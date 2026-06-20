"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ExternalLink,
  Share2,
  Palette,
  CheckCircle2,
  Copy,
  Check,
  MessageSquare,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function deriveSubdomain(id: string): string {
  const clean = id
    .replace(/^lead_\d+_/, "")
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase()
    .slice(0, 30);
  return clean || "your-business";
}

/* -------------------------------------------------------------------------- */
/*  Animated star burst (CSS only)                                              */
/* -------------------------------------------------------------------------- */

function StarBurst() {
  return (
    <div className="relative flex items-center justify-center w-32 h-32 mx-auto mb-2">
      {/* Rotating ring */}
      <div className="absolute inset-0 rounded-full border-4 border-green-500/20 animate-spin" style={{ animationDuration: "8s" }} />
      <div className="absolute inset-2 rounded-full border-2 border-green-400/15 animate-spin" style={{ animationDuration: "5s", animationDirection: "reverse" }} />
      {/* Green circle */}
      <div className="w-20 h-20 rounded-full bg-green-500/15 border-2 border-green-500/40 flex items-center justify-center shadow-lg shadow-green-900/30">
        <CheckCircle2 className="w-10 h-10 text-green-400" />
      </div>
      {/* Floating dots */}
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <div
          key={deg}
          className="absolute w-2 h-2 rounded-full bg-green-400/60"
          style={{
            transform: `rotate(${deg}deg) translateX(52px)`,
          }}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Copy button                                                                 */
/* -------------------------------------------------------------------------- */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 text-xs font-medium transition-colors shrink-0"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-green-400" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          Copy
        </>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Timeline                                                                    */
/* -------------------------------------------------------------------------- */

const TIMELINE = [
  {
    period: "Today",
    event: "Your site is live on your permanent URL",
    sub: "Share it anywhere — Google, socials, business cards.",
    colour: "bg-green-400",
  },
  {
    period: "Day 3",
    event: "Google discovers and indexes your site",
    sub: "Our sitemap submission speeds up crawling significantly.",
    colour: "bg-blue-400",
  },
  {
    period: "Week 2",
    event: "First organic rankings appear",
    sub: "Suburb-specific pages start ranking for local searches.",
    colour: "bg-indigo-400",
  },
  {
    period: "Month 1",
    event: "Monthly performance report in your inbox",
    sub: "Plain-English breakdown of calls, clicks and rankings.",
    colour: "bg-purple-400",
  },
];

/* -------------------------------------------------------------------------- */
/*  Page (client component for share + clipboard)                              */
/* -------------------------------------------------------------------------- */

export default function WelcomePage() {
  const params = useParams();
  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : "unknown";

  const subdomain = deriveSubdomain(id);
  const siteUrl = `https://${subdomain}.mysitehq.com.au`;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function handleShare() {
    if (!mounted) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My new business website",
          text: "Check out my new site — built in under 60 seconds:",
          url: siteUrl,
        });
      } catch {
        // cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(siteUrl);
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-[#0A0F1E] text-white">
      {/* Header */}
      <header className="px-6 py-5 max-w-2xl mx-auto w-full">
        <div className="text-xl font-[family-name:var(--font-sora)] font-extrabold text-white">
          Preview Factory
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-xl flex flex-col gap-8">

          {/* Hero */}
          <div className="text-center flex flex-col gap-3">
            <StarBurst />
            <h1 className="font-[family-name:var(--font-sora)] font-extrabold text-4xl sm:text-5xl text-white tracking-tight mt-4">
              Your site is live.
            </h1>
            <p className="text-white/55 text-lg mt-2">
              It is permanently published at the address below. Share it anywhere.
            </p>
          </div>

          {/* URL card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
              Your permanent web address
            </p>
            <div className="bg-black/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="flex-1 text-blue-400 font-mono text-sm break-all">
                {siteUrl}
              </span>
              <CopyButton text={siteUrl} />
            </div>
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm transition-colors mt-4"
            >
              <ExternalLink className="w-4 h-4" />
              Visit your site
            </a>
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Visit */}
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-900/40 flex items-center justify-center">
                <ExternalLink className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-white font-semibold text-sm">Visit your site</span>
            </a>

            {/* Share */}
            <button
              type="button"
              onClick={handleShare}
              className="flex flex-col items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-green-900/40 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-white font-semibold text-sm">Share with a friend</span>
            </button>

            {/* Update logo */}
            <Link
              href={`/preview/${id}`}
              className="flex flex-col items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors text-center"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-900/40 flex items-center justify-center">
                <Palette className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-white font-semibold text-sm">Update your logo</span>
            </Link>
          </div>

          {/* SMS editing */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-blue-400 shrink-0" />
              <h2 className="text-base font-bold text-white">
                Update your site anytime
              </h2>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              Text your changes to{" "}
              <a
                href="sms:+611800000000"
                className="text-white font-bold hover:text-blue-400 transition-colors"
              >
                +61 XXX XXX XXX
              </a>
              . We will update your site within 2 hours. No logins. No portals.
            </p>
            <div className="bg-black/30 rounded-xl p-4">
              <p className="text-xs text-white/30 font-semibold mb-3 uppercase tracking-wide">
                Example messages
              </p>
              <ul className="flex flex-col gap-2 text-xs text-white/50">
                {[
                  "Update my phone number to 0412 345 678",
                  "Add carpet cleaning to my services",
                  "Change my trading hours to Mon-Fri 7am-5pm",
                ].map((msg) => (
                  <li key={msg} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                    &ldquo;{msg}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* What happens next timeline */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
            <h2 className="text-base font-bold text-white">What happens next</h2>
            <div className="flex flex-col gap-0">
              {TIMELINE.map((item, i) => (
                <div key={item.period} className="flex gap-4">
                  {/* Dot + line */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full shrink-0 mt-1 ${item.colour}`} />
                    {i < TIMELINE.length - 1 && (
                      <div className="w-px flex-1 bg-white/10 my-1" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-5">
                    <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-0.5">
                      {item.period}
                    </p>
                    <p className="text-sm font-semibold text-white/80">{item.event}</p>
                    <p className="text-xs text-white/40 mt-1">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer links */}
          <div className="text-center text-white/30 text-sm">
            <p>
              Need help?{" "}
              <a
                href="tel:1800000000"
                className="text-white/60 hover:text-white transition-colors"
              >
                Call 1800 XXX XXX
              </a>{" "}
              or reply to your welcome SMS.
            </p>
            <Link
              href="/"
              className="text-xs text-white/20 hover:text-white/40 transition-colors mt-2 inline-block"
            >
              Back to Preview Factory
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}
