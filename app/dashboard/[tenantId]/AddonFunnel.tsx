"use client";
/**
 * app/dashboard/[tenantId]/AddonFunnel.tsx
 *
 * Three exports live in this file, all related to the growth-services
 * upsell surface:
 *
 *  1. `AddonFunnelModal`      — controlled modal (open + onClose + step).
 *                                Renders the three-step walkthrough. Pure
 *                                UI; no lifecycle side-effects.
 *  2. `AutoOpenAddonFunnel`   — thin wrapper that auto-opens the modal on
 *                                mount and stamps `funnel_shown_at` so it
 *                                never auto-opens again. Used the FIRST
 *                                time the customer lands on the dashboard
 *                                after their custom domain verifies.
 *  3. `GrowthServicesCard`    — persistent section on the dashboard that
 *                                stays visible forever. Lets the customer
 *                                reopen the picker on demand and shows
 *                                which addons they already subscribe to.
 *
 * The walkthrough steps:
 *   1. SEO         — three tiers (Starter / Growth / Pro) × monthly/annual
 *   2. Google Ads  — flat $150/mo management + your ad spend
 *   3. Social Ads  — flat $150/mo management + your ad spend
 *
 * Subscribe opens Stripe checkout in a new tab so the walkthrough stays
 * visible; the primary CTA swaps to "Next →" with a "Great, subscribed"
 * ack banner.
 */

import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  Sparkles,
  TrendingUp,
  Megaphone,
  Check,
  ArrowRight,
  Info,
} from "lucide-react";
import {
  SEO_TIERS,
  ADS_ADDONS,
  ADS_PRICING,
  ADDON_ANNUAL_DISCOUNT_LABEL,
  type AddonKey,
  type AddonPlanKey,
  type BillingCycle,
} from "@/lib/addon-plans";

export type Step = 0 | 1 | 2;

const STEP_META: {
  title: string;
  subtitle: string;
  icon: typeof Sparkles;
  accent: string;
}[] = [
  {
    title: "Get found on Google — every day, not just today",
    subtitle:
      "Your site is live. SEO is the ongoing work that keeps you climbing local search results.",
    icon: Sparkles,
    accent: "text-emerald-300",
  },
  {
    title: "Skip the queue with Google Ads",
    subtitle:
      "SEO is the long game. Google Ads puts you at the top for high-intent searches — starting today.",
    icon: TrendingUp,
    accent: "text-blue-300",
  },
  {
    title: "Get seen where your customers already scroll",
    subtitle:
      "Meta puts your ads in front of locals scrolling Facebook and Instagram, turning them into enquiries before they even start searching.",
    icon: Megaphone,
    accent: "text-fuchsia-300",
  },
];

/* ================================================================= modal === */

export function AddonFunnelModal({
  tenantId,
  open,
  onClose,
  initialStep = 0,
}: {
  tenantId: string;
  open: boolean;
  onClose: () => void;
  initialStep?: Step;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [subscribedAtStep, setSubscribedAtStep] = useState<
    Record<Step, boolean>
  >({ 0: false, 1: false, 2: false });
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Whenever the modal is reopened (or opened at a different step), snap
  // to the requested step and clear any inline error from a prior session.
  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setError(null);
    }
  }, [open, initialStep]);

  if (!open) return null;

  const meta = STEP_META[step];

  async function subscribe(addonPlanKey: AddonPlanKey) {
    setCheckoutLoading(addonPlanKey);
    setError(null);
    try {
      const res = await fetch("/api/checkout/addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, addonPlanKey }),
      });
      const data = (await res.json()) as {
        checkoutUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.checkoutUrl) {
        setError(data.error ?? "Couldn't start checkout. Try again.");
        return;
      }
      // Open Stripe in a new tab so the walkthrough stays visible.
      window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
      setSubscribedAtStep((prev) => ({ ...prev, [step]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setCheckoutLoading(null);
    }
  }

  function next() {
    setError(null);
    if (step === 2) {
      onClose();
      return;
    }
    setStep((s) => (s + 1) as Step);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0F1424] shadow-2xl my-8">
        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/5 px-6 py-5">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 shrink-0 rounded-lg bg-white/5 p-2">
              <meta.icon className={`h-5 w-5 ${meta.accent}`} />
            </div>
            <div className="min-w-0">
              <h2 className="font-[family-name:var(--font-sora)] text-lg sm:text-xl font-extrabold tracking-tight text-white">
                {meta.title}
              </h2>
              <p className="mt-1 text-sm text-white/60">{meta.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white/80 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* progress dots */}
        <div className="flex items-center justify-center gap-2 pt-5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-8 bg-white"
                  : i < step
                    ? "w-2 bg-white/40"
                    : "w-2 bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* body */}
        <div className="px-6 py-6">
          {step === 0 && (
            <SeoStep
              cycle={cycle}
              onCycleChange={setCycle}
              onSubscribe={subscribe}
              checkoutLoading={checkoutLoading}
              subscribed={subscribedAtStep[0]}
            />
          )}
          {step === 1 && (
            <AdsStep
              addon="google_ads"
              cycle={cycle}
              onCycleChange={setCycle}
              onSubscribe={subscribe}
              checkoutLoading={checkoutLoading}
              subscribed={subscribedAtStep[1]}
            />
          )}
          {step === 2 && (
            <AdsStep
              addon="social_ads"
              cycle={cycle}
              onCycleChange={setCycle}
              onSubscribe={subscribe}
              checkoutLoading={checkoutLoading}
              subscribed={subscribedAtStep[2]}
            />
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/5 px-6 py-4">
          <button
            onClick={onClose}
            className="text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            Close
          </button>
          <button
            onClick={next}
            className="rounded-lg bg-white px-5 py-2 text-sm font-bold text-[#0A0F1E] hover:bg-white/90 transition-colors"
          >
            {step === 2
              ? "Done"
              : subscribedAtStep[step]
                ? "Next →"
                : "Not now →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================== auto-open wrapper === */

export function AutoOpenAddonFunnel({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    // Stamp funnel_shown_at once. Idempotent server-side, so a duplicate
    // fire in React strict mode is harmless.
    fetch(`/api/dashboard/${tenantId}/funnel/mark-shown`, {
      method: "POST",
    }).catch((err) => {
      console.warn("[addon-funnel] mark-shown failed", err);
    });
  }, [tenantId]);

  return (
    <AddonFunnelModal
      tenantId={tenantId}
      open={open}
      onClose={() => setOpen(false)}
      initialStep={0}
    />
  );
}

/* ================================================ persistent section === */

const CARD_META: {
  key: AddonKey;
  step: Step;
  title: string;
  hook: string;
  icon: typeof Sparkles;
  accent: string;
  bg: string;
}[] = [
  {
    key: "seo",
    step: 0,
    title: "SEO",
    hook: "Rank higher on Google, month after month.",
    icon: Sparkles,
    accent: "text-emerald-300",
    bg: "bg-emerald-500/10 border-emerald-500/30",
  },
  {
    key: "google_ads",
    step: 1,
    title: "Google Ads",
    hook: "Get to the top of search today — not next quarter.",
    icon: TrendingUp,
    accent: "text-blue-300",
    bg: "bg-blue-500/10 border-blue-500/30",
  },
  {
    key: "social_ads",
    step: 2,
    title: "Social Ads",
    hook: "Reach customers scrolling Facebook and Instagram.",
    icon: Megaphone,
    accent: "text-fuchsia-300",
    bg: "bg-fuchsia-500/10 border-fuchsia-500/30",
  },
];

export function GrowthServicesCard({
  tenantId,
  activeAddonKeys,
}: {
  tenantId: string;
  /** Addon keys the tenant currently subscribes to. Renders a "Subscribed"
   *  pill on matching cards. */
  activeAddonKeys: AddonKey[];
}) {
  const [openStep, setOpenStep] = useState<Step | null>(null);
  const [drawerKey, setDrawerKey] = useState<AddonKey | null>(null);

  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/10 via-white/5 to-blue-500/10 p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-300" />
            <h2 className="text-base font-bold text-white">
              Grow your business
            </h2>
          </div>
          <p className="mt-1 text-sm text-white/60">
            Your site is live. These add-ons drive more customers to it.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {CARD_META.map((c) => {
          const subscribed = activeAddonKeys.includes(c.key);
          return (
            <div
              key={c.key}
              className={`flex flex-col gap-3 rounded-xl border ${c.bg} p-4`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="rounded-lg bg-black/30 p-1.5">
                  <c.icon className={`h-4 w-4 ${c.accent}`} />
                </div>
                {subscribed && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    ✓ Subscribed
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{c.title}</p>
                <p className="mt-0.5 text-xs text-white/60">{c.hook}</p>
              </div>
              <div className="mt-auto flex flex-col gap-2">
                <button
                  onClick={() => setDrawerKey(c.key)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:border-white/30 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Info className="h-3.5 w-3.5" />
                  What&apos;s included
                </button>
                <button
                  onClick={() => setOpenStep(c.step)}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#0A0F1E] hover:bg-white/90 transition-colors"
                >
                  {subscribed ? "Manage plan" : "See plans"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AddonFunnelModal
        tenantId={tenantId}
        open={openStep !== null}
        initialStep={openStep ?? 0}
        onClose={() => setOpenStep(null)}
      />

      <AddonDetailsDrawer
        addonKey={drawerKey}
        onClose={() => setDrawerKey(null)}
        onSeeplans={(key) => {
          const step = CARD_META.find((c) => c.key === key)?.step ?? 0;
          setDrawerKey(null);
          setOpenStep(step);
        }}
      />
    </section>
  );
}

/* ============================================== details drawer (slide-in) === */

interface DrawerSection {
  title: string;
  body: string;
}

interface DrawerContent {
  headline: string;
  intro: string;
  sections: DrawerSection[];
  pricing: string;
  icon: typeof Sparkles;
  accent: string;
  bg: string;
}

const DRAWER_CONTENT: Record<AddonKey, DrawerContent> = {
  seo: {
    headline: "Rank higher on Google, month after month",
    intro:
      "SEO is the ongoing work that gets your business found in local search. Here's exactly what we do every month, so you know what your money is buying.",
    sections: [
      {
        title: "Local directory presence",
        body: "We list you consistently across 30+ Australian directories (True Local, White Pages, Yellow Pages, Yelp AU, Hotfrog, StartLocal, Aussie Web, and more). Same name, address and phone everywhere. It sounds boring, but it's one of the strongest local ranking signals Google uses.",
      },
      {
        title: "Blog posts written and published for you",
        body: "4 posts a month on Starter, 8 on Growth, 16 on Pro. Written by our team, optimised for the search terms your customers actually type, and published straight to your site. Fresh content is what tells Google your site is alive and worth ranking.",
      },
      {
        title: "Google Business Profile posts",
        body: "4 GBP posts a month on Starter, 8 on Growth, 16 on Pro. Keeps your Google listing active. Google rewards recent activity by ranking you higher on Maps and the local 3-pack — the results customers actually click.",
      },
      {
        title: "Monthly performance report",
        body: "Every month you get a plain-English report: what we did, keyword rankings, traffic, and enquiries. No jargon, no vanity metrics. You'll always know what you're paying for.",
      },
      {
        title: "First results in 60 to 90 days",
        body: "SEO is a compounding game. You'll see early movement in the first month or two, real ranking gains around month three, and the biggest wins from month six onwards. It only works if you stay consistent, which is why we run it monthly.",
      },
    ],
    pricing: "From $29/mo (Starter) to $79/mo (Pro). ex GST. Cancel anytime.",
    icon: Sparkles,
    accent: "text-emerald-300",
    bg: "from-emerald-500/20 to-emerald-500/5",
  },
  google_ads: {
    headline: "The fastest way to the top of Google",
    intro:
      "SEO takes months. Google Ads puts you in front of customers who are searching right now. Here's everything we do for the $150/month management fee.",
    sections: [
      {
        title: "Campaign strategy, built for your business",
        body: "We build your campaigns from scratch: which searches to target, geographic radius, budget pacing, day and time of week. Set up around your actual services and service area, not a generic template.",
      },
      {
        title: "Ad copy that converts",
        body: "Multiple headline and description variations, written to your services and location. We rotate the winners and cut the ones that don't pull their weight.",
      },
      {
        title: "Weekly bid and keyword tuning",
        body: "Every week we tune bids and add negative keywords (searches you don't want to show for). Your ad spend flows to the searches that actually convert — not job seekers, tyre kickers or DIYers.",
      },
      {
        title: "Landing page tuning",
        body: "We wire your ads to the right page on your site and tune the page for conversions. Usually means more calls and form submissions from the same spend.",
      },
      {
        title: "Monthly performance report",
        body: "Clicks, calls, cost per lead, and what's working versus what we're changing next month. Simple English, real numbers.",
      },
      {
        title: "Your ad spend is separate",
        body: "The $150/month is our management fee. Your actual ad spend (the money Google pays out to show your ads) is billed by Google directly to your card. You set the budget, and you can change it any time.",
      },
    ],
    pricing:
      "$150/month management fee. ex GST. Your ad spend is separate and billed by Google. Recommended starting budget: $500 to $1,500/month.",
    icon: TrendingUp,
    accent: "text-blue-300",
    bg: "from-blue-500/20 to-blue-500/5",
  },
  social_ads: {
    headline: "Reach customers where they scroll",
    intro:
      "Meta ads run across both Facebook and Instagram from a single setup, putting your business in front of locals who don't know they need you yet. Here's what's included for the $150/month management fee.",
    sections: [
      {
        title: "One setup, both Facebook and Instagram",
        body: "Meta owns Facebook and Instagram, so a single campaign shows on both. We pick the right mix of placements (feed, stories, reels, marketplace) based on your services and audience, so you're not paying twice to reach the same customers.",
      },
      {
        title: "Creative built for scroll",
        body: "Short-form video and image ads, produced from your existing content (or shot fresh with your phone, guided by us). Different creative for different audiences. Scroll-stopping is the whole job.",
      },
      {
        title: "Precise local targeting",
        body: "Locals in your service radius, filtered by the traits that matter for your business (homeowners, age band, interests, life events like moving house or having a baby). We keep the audience tight so your budget goes to the right people.",
      },
      {
        title: "A/B testing built in",
        body: "We run multiple creatives and audiences head-to-head, kill the losers fast, and scale the winners. This is why paid social works. Most people running it themselves stop at one ad and wonder why nothing happened.",
      },
      {
        title: "Monthly performance report",
        body: "Reach, engagement, cost per lead, and what's working versus what we're testing next month.",
      },
      {
        title: "Your ad spend is separate",
        body: "The $150/month is our management fee. Your actual ad spend (the money Meta pays out to show your ads) is billed by them directly to your card. You set the budget, and you can change it any time.",
      },
    ],
    pricing:
      "$150/month management fee. ex GST. Your ad spend is separate and billed by Meta. Recommended starting budget: $500 to $1,500/month.",
    icon: Megaphone,
    accent: "text-fuchsia-300",
    bg: "from-fuchsia-500/20 to-fuchsia-500/5",
  },
};

function AddonDetailsDrawer({
  addonKey,
  onClose,
  onSeeplans,
}: {
  addonKey: AddonKey | null;
  onClose: () => void;
  onSeeplans: (key: AddonKey) => void;
}) {
  const open = addonKey !== null;

  // Lock body scroll while the drawer is open so the page behind doesn't
  // scroll under a fixed drawer on mobile.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC to dismiss — makes the drawer feel first-class on desktop.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Keep the last-shown addon in state so content doesn't blank out mid
  // slide-out animation. When closed, we still render the previous content
  // for one animation cycle.
  const [held, setHeld] = useState<AddonKey | null>(addonKey);
  useEffect(() => {
    if (addonKey) setHeld(addonKey);
  }, [addonKey]);

  const shownKey = addonKey ?? held;
  const content = shownKey ? DRAWER_CONTENT[shownKey] : null;

  return (
    <>
      {/* backdrop */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* drawer */}
      <aside
        role="dialog"
        aria-hidden={!open}
        aria-label={content?.headline ?? "Addon details"}
        className={`fixed top-0 right-0 z-[95] flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0F1424] shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {content && (
          <>
            {/* header */}
            <div
              className={`relative border-b border-white/10 bg-gradient-to-br ${content.bg} px-6 py-6`}
            >
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-start gap-3 pr-8">
                <div className="mt-0.5 shrink-0 rounded-lg bg-black/30 p-2">
                  <content.icon className={`h-5 w-5 ${content.accent}`} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-[family-name:var(--font-sora)] text-xl font-extrabold tracking-tight text-white">
                    {content.headline}
                  </h2>
                  <p className="mt-2 text-sm text-white/70">{content.intro}</p>
                </div>
              </div>
            </div>

            {/* scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
              {content.sections.map((section) => (
                <div key={section.title} className="flex flex-col gap-1.5">
                  <div className="flex items-start gap-2">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${content.accent}`}
                    />
                    <p className="text-sm font-bold text-white">
                      {section.title}
                    </p>
                  </div>
                  <p className="pl-6 text-sm text-white/70 leading-relaxed">
                    {section.body}
                  </p>
                </div>
              ))}

              <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Pricing
                </p>
                <p className="mt-1 text-sm text-white/80">{content.pricing}</p>
              </div>
            </div>

            {/* sticky footer CTA */}
            <div className="border-t border-white/10 bg-[#0A0F1E] px-6 py-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={onClose}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => shownKey && onSeeplans(shownKey)}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-[#0A0F1E] hover:bg-white/90 transition-colors"
              >
                See plans
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

/* --------------------------------------------------------------- cycle toggle */

function CycleToggle({
  cycle,
  onChange,
}: {
  cycle: BillingCycle;
  onChange: (c: BillingCycle) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
          cycle === "monthly"
            ? "bg-white text-[#0A0F1E]"
            : "text-white/60 hover:text-white"
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
          cycle === "annual"
            ? "bg-white text-[#0A0F1E]"
            : "text-white/60 hover:text-white"
        }`}
      >
        Annual
        <span className="ml-1.5 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
          {ADDON_ANNUAL_DISCOUNT_LABEL}
        </span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------- SEO step */

function SeoStep({
  cycle,
  onCycleChange,
  onSubscribe,
  checkoutLoading,
  subscribed,
}: {
  cycle: BillingCycle;
  onCycleChange: (c: BillingCycle) => void;
  onSubscribe: (key: AddonPlanKey) => void;
  checkoutLoading: string | null;
  subscribed: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {subscribed && <SubscribedAck message="Great, subscribed. Also worth considering →" />}

      <div className="flex justify-center">
        <CycleToggle cycle={cycle} onChange={onCycleChange} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {SEO_TIERS.map((tier) => {
          const planKey = `seo-${tier.id}-${cycle}` as AddonPlanKey;
          const amount = cycle === "monthly" ? tier.monthly : tier.annual;
          const dollars = (amount / 100).toFixed(0);
          const isLoading = checkoutLoading === planKey;
          return (
            <div
              key={tier.id}
              className={`relative flex flex-col gap-4 rounded-xl border p-4 ${
                tier.popular
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-white/10 bg-white/5"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-2.5 left-4 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0A0F1E]">
                  Most popular
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  {tier.name}
                </p>
                <p className="mt-1 text-2xl font-extrabold text-white">
                  ${dollars}
                  <span className="text-sm font-medium text-white/40">
                    {" "}
                    /{cycle === "monthly" ? "mo" : "yr"}
                  </span>
                </p>
                <p className="text-[11px] text-white/40">ex GST</p>
              </div>
              <ul className="flex flex-col gap-2 text-xs text-white/70">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <SubscribeButton
                onClick={() => onSubscribe(planKey)}
                loading={isLoading}
                disabled={checkoutLoading != null && !isLoading}
                popular={tier.popular}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- Ads step */

function AdsStep({
  addon,
  cycle,
  onCycleChange,
  onSubscribe,
  checkoutLoading,
  subscribed,
}: {
  addon: "google_ads" | "social_ads";
  cycle: BillingCycle;
  onCycleChange: (c: BillingCycle) => void;
  onSubscribe: (key: AddonPlanKey) => void;
  checkoutLoading: string | null;
  subscribed: boolean;
}) {
  const spec = ADS_ADDONS.find((a) => a.addonKey === addon)!;
  const planKey = `${addon}-${cycle}` as AddonPlanKey;
  const amount = cycle === "monthly" ? ADS_PRICING.monthly : ADS_PRICING.annual;
  const dollars = (amount / 100).toFixed(0);
  const isLoading = checkoutLoading === planKey;

  return (
    <div className="flex flex-col gap-5">
      {subscribed && <SubscribedAck message="Great, subscribed. One more to consider →" />}

      <div className="flex justify-center">
        <CycleToggle cycle={cycle} onChange={onCycleChange} />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
              {spec.name}
            </p>
            <p className="mt-1 text-3xl font-extrabold text-white">
              ${dollars}
              <span className="text-sm font-medium text-white/40">
                {" "}
                /{cycle === "monthly" ? "mo" : "yr"}
              </span>
            </p>
            <p className="text-[11px] text-white/40">
              ex GST · management fee only
            </p>
          </div>
          <div className="text-right text-xs text-white/50 max-w-[220px]">
            <p className="font-semibold text-white/70">Your ad spend is separate</p>
            <p className="mt-1">
              Google / Meta bill your card directly for the ads themselves.
              You choose the budget.
            </p>
          </div>
        </div>

        <ul className="flex flex-col gap-2 text-sm text-white/70">
          {spec.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <SubscribeButton
          onClick={() => onSubscribe(planKey)}
          loading={isLoading}
          disabled={checkoutLoading != null && !isLoading}
          popular
        />
      </div>
    </div>
  );
}

/* --------------------------------------------------------- shared subunits === */

function SubscribeButton({
  onClick,
  loading,
  disabled,
  popular,
}: {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  popular?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        popular
          ? "bg-emerald-500 text-[#0A0F1E] hover:bg-emerald-400"
          : "bg-white/10 text-white hover:bg-white/20"
      }`}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening…
        </>
      ) : (
        "Subscribe"
      )}
    </button>
  );
}

function SubscribedAck({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-center gap-2 text-sm text-emerald-200">
      <Check className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
