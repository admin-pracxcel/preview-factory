"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp,
  BarChart3,
  Megaphone,
  CheckCircle2,
  ExternalLink,
  X,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Upsell product definitions                                                  */
/* -------------------------------------------------------------------------- */

const UPSELLS = [
  {
    id: "growth-engine",
    icon: TrendingUp,
    iconBg: "bg-blue-900/40",
    iconColour: "text-blue-400",
    badge: "Most popular",
    badgeBg: "bg-blue-600",
    name: "Complete Growth Engine",
    price: "$297/mo",
    priceNote: "Added to your subscription",
    pitch: "Google Ads managed for you. We write the ads, set the targeting, and optimise weekly. You just answer the phone.",
    bullets: [
      "Google Ads setup and ongoing management",
      "Weekly bid and keyword optimisation",
      "Monthly performance report with plain-English summary",
      "Average 6.1x return on ad spend for our trade clients",
    ],
    ctaLabel: "Add Complete Growth Engine",
    ctaClass: "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/40",
  },
  {
    id: "seo-reports",
    icon: BarChart3,
    iconBg: "bg-indigo-900/40",
    iconColour: "text-indigo-400",
    badge: null,
    badgeBg: null,
    name: "intelliLens Monthly Reports",
    price: "$49/mo",
    priceNote: "Added to your subscription",
    pitch: "Monthly AI-generated performance report: calls, clicks, rankings, and competitor movement. In plain English.",
    bullets: [
      "Call tracking + Google Search Console data merged",
      "Competitor ranking tracker (up to 5 competitors)",
      "Automated suburb-by-suburb visibility score",
      "Delivered to your inbox on the 1st of each month",
    ],
    ctaLabel: "Add intelliLens Reports",
    ctaClass: "bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/40",
  },
  {
    id: "social",
    icon: Megaphone,
    iconBg: "bg-purple-900/40",
    iconColour: "text-purple-400",
    badge: null,
    badgeBg: null,
    name: "Repuboost Social Posts",
    price: "$79/mo",
    priceNote: "Added to your subscription",
    pitch: "12 ready-to-post social media graphics per month. Each one branded, suburb-specific, and ready to copy-paste to Facebook or Instagram.",
    bullets: [
      "12 branded posts per month (Facebook + Instagram formats)",
      "Suburb and service tailored to your business",
      "Sent to your phone as ready-to-post image files",
      "Includes 4 promotional posts, 4 educational, 4 social proof",
    ],
    ctaLabel: "Add Repuboost Social",
    ctaClass: "bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/40",
  },
];

/* -------------------------------------------------------------------------- */
/*  Page component                                                              */
/* -------------------------------------------------------------------------- */

export default function UpsellPage() {
  const params = useParams();
  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : "unknown";

  const [dismissed, setDismissed] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);

  const active = UPSELLS.filter((u) => !dismissed.includes(u.id));

  function handleAdd(upsellId: string) {
    setAdded((prev) => [...prev, upsellId]);
    console.log("Upsell added:", upsellId, "for lead:", id);
    // In production this fires a Stripe upgrade API call
    alert(`${upsellId} added to your subscription. (stub — Stripe upgrade call fires here)`);
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0F1E] text-white">
      {/* Header */}
      <header className="px-6 py-5 max-w-4xl mx-auto w-full flex items-center justify-between">
        <div className="text-xl font-[family-name:var(--font-sora)] font-extrabold text-white">
          Launcharoo
        </div>
        <Link
          href={`/welcome/${id}`}
          className="text-white/50 hover:text-white transition-colors text-sm flex items-center gap-1.5"
        >
          <ExternalLink className="w-4 h-4" />
          View my site
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-3xl flex flex-col gap-10">

          {/* Headline */}
          <div className="text-center flex flex-col gap-3">
            {/* Green check */}
            <div className="w-16 h-16 rounded-full bg-green-900/40 border-2 border-green-700/40 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-[family-name:var(--font-sora)] font-extrabold tracking-tight">
              Your site is live.
            </h1>
            <p className="text-white/50 text-lg max-w-md mx-auto leading-relaxed">
              While you are here, these add-ons take less than 30 seconds to activate and are used by our top-performing clients.
            </p>
          </div>

          {/* Upsell cards */}
          {active.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <p>No more offers. You are all set.</p>
              <Link
                href={`/welcome/${id}`}
                className="mt-4 inline-block text-blue-400 hover:text-blue-300 underline underline-offset-4 text-sm"
              >
                Go to your site →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {active.map((upsell) => {
                const Icon = upsell.icon;
                const isAdded = added.includes(upsell.id);
                return (
                  <div
                    key={upsell.id}
                    className="relative bg-white/5 border border-white/10 rounded-3xl p-7 sm:p-8 flex flex-col gap-6"
                  >
                    {/* Dismiss button */}
                    <button
                      type="button"
                      onClick={() => setDismissed((prev) => [...prev, upsell.id])}
                      className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
                      aria-label="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {/* Header */}
                    <div className="flex items-start gap-4 pr-10">
                      <div className={`w-12 h-12 rounded-2xl ${upsell.iconBg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-6 h-6 ${upsell.iconColour}`} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-white font-bold text-lg">{upsell.name}</h2>
                          {upsell.badge && (
                            <span className={`${upsell.badgeBg} text-white text-xs font-bold px-2.5 py-0.5 rounded-full`}>
                              {upsell.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-white/50 text-sm leading-relaxed">{upsell.pitch}</p>
                      </div>
                    </div>

                    {/* Bullets */}
                    <div className="flex flex-col gap-2 pl-16">
                      {upsell.bullets.map((b) => (
                        <div key={b} className="flex items-start gap-3">
                          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                          <span className="text-white/65 text-sm leading-relaxed">{b}</span>
                        </div>
                      ))}
                    </div>

                    {/* Price + CTA */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pl-16">
                      <div>
                        <span className="text-white font-extrabold text-2xl">{upsell.price}</span>
                        <span className="text-white/40 text-sm ml-2">{upsell.priceNote}</span>
                      </div>
                      {isAdded ? (
                        <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-700/30 border border-green-700/40 text-green-400 font-semibold text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          Added to your subscription
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAdd(upsell.id)}
                          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm transition-all ${upsell.ctaClass}`}
                        >
                          {upsell.ctaLabel} →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Skip */}
          <div className="text-center">
            <Link
              href={`/welcome/${id}`}
              className="text-white/30 hover:text-white/60 text-sm transition-colors"
            >
              No thanks, take me to my site →
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}
