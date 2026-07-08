"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, MapPin, Phone, Building2 } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                       */
/* -------------------------------------------------------------------------- */

type Phase =
  | "lookup"
  | "found"
  | "phone-capture"
  | "designing"
  | "going-live"
  | "done";

/** Shape of the lookup response — mirrors lib/places-client.ts GbpData. */
interface GbpCardData {
  name: string;
  address: string;
  phone: string;
  suburb?: string;
  state?: string;
}

/* -------------------------------------------------------------------------- */
/*  Progress bar                                                                */
/* -------------------------------------------------------------------------- */

function ProgressBar({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-mono text-slate-500">{progress}%</span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pulsing dot                                                                 */
/* -------------------------------------------------------------------------- */

function PulsingDot() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 shrink-0">
      <span className="block w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Designing steps                                                             */
/* -------------------------------------------------------------------------- */

const DESIGN_STEPS = [
  { label: "Generating homepage", targetPct: 20 },
  { label: "Writing service pages", targetPct: 40 },
  { label: "Creating suburb pages", targetPct: 60 },
  { label: "Optimising for local SEO", targetPct: 80 },
  { label: "Polishing copy and going live", targetPct: 100 },
];

/** "Designing your site" phase duration, ms. Tuned so the progress bar
 * matches realistic Haiku generation time (typically 30–90s). The redirect
 * itself waits for the real /api/intake response, so any overage shows as
 * "Finalising your site…" — the animation here is the optimistic floor. */
const DESIGNING_DURATION_MS = 70_000;
const STEP_INTERVAL_MS = DESIGNING_DURATION_MS / DESIGN_STEPS.length; // 14s per step
const PROGRESS_TICK_MS = 700; // 95 ticks × 700ms = ~66.5s for the bar to reach 95%
const CHECKLIST_INTERVAL_MS = 8_000; // reveal a checklist item every 8s

const CHECKLIST = [
  "Homepage",
  "6 service pages",
  "8 suburb pages",
  "Local SEO structure",
  "Call tracking",
];

/* -------------------------------------------------------------------------- */
/*  Inner component                                                              */
/* -------------------------------------------------------------------------- */

function BuildingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const leadId = searchParams.get("lead_id") ?? "unknown";
  const name = searchParams.get("name") ?? "Your Business";
  const suburb = searchParams.get("suburb") ?? "your suburb";
  const niche = searchParams.get("niche") ?? "";
  const category = searchParams.get("category") ?? "";

  const [phase, setPhase] = useState<Phase>("lookup");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneSubmitted, setPhoneSubmitted] = useState(false);
  const [designProgress, setDesignProgress] = useState(0);
  const [currentDesignStep, setCurrentDesignStep] = useState(0);
  const [visibleChecklistItems, setVisibleChecklistItems] = useState<number>(0);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Real lookup + intake state. Lookup runs first and populates the "Found on
  // Google" card with real data; intake enqueues the generation job and returns
  // a tenantId immediately (Phase 4). The client then polls
  // /api/tenants/[id]/status every 2s until the async worker finishes.
  //
  // The redirect waits until the animation reaches "done" AND tenantStatus is
  // 'done' (or 'claimed' for legacy paths).
  const [gbpData, setGbpData] = useState<GbpCardData | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantStatus, setTenantStatus] = useState<string | null>(null);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [animationReady, setAnimationReady] = useState(false);
  const intakeStartedRef = useRef(false);

  /* ---------------------------------------------------------------------- */
  /*  Phase sequencing                                                        */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase("found");
    }, 2800);

    const t2 = setTimeout(() => {
      setPhase("phone-capture");
    }, 4500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire lookup → intake chain on mount.
  // Step 1 (/api/lookup) is fast — populates the "Found on Google" card with real data.
  // Step 2 (/api/intake) is slow — does generation, returns the tenantId for redirect.
  useEffect(() => {
    if (intakeStartedRef.current) return;
    if (!name || name === "Your Business" || !niche) {
      setIntakeError("Missing business name or niche in the URL.");
      return;
    }
    intakeStartedRef.current = true;

    (async () => {
      try {
        // 1. Lookup — instant card population
        const lookupRes = await fetch("/api/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessName: name, niche, suburb }),
        });
        if (!lookupRes.ok) {
          const data = (await lookupRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Lookup failed: HTTP ${lookupRes.status}`);
        }
        const { gbpData: gbp } = (await lookupRes.json()) as { gbpData: GbpCardData };
        setGbpData(gbp);

        // 2. Intake — slow generation, hands back tenantId
        const intakeRes = await fetch("/api/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gbpData: gbp, niche, category: category || undefined }),
        });
        if (!intakeRes.ok) {
          const data = (await intakeRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Intake failed: HTTP ${intakeRes.status}`);
        }
        const intakeData = (await intakeRes.json()) as { tenantId: string };
        setTenantId(intakeData.tenantId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[building] pipeline failed:", msg);
        setIntakeError(msg);
      }
    })();
  }, [name, niche, suburb, category]);

  useEffect(() => {
    if (phase === "phone-capture") {
      setTimeout(() => phoneInputRef.current?.focus(), 100);
    }
  }, [phase]);

  useEffect(() => {
    if (!phoneSubmitted) return;

    setPhase("designing");
    setDesignProgress(0);
    setCurrentDesignStep(0);
    setVisibleChecklistItems(0);

    let step = 0;
    const stepInterval = setInterval(() => {
      if (step < DESIGN_STEPS.length - 1) {
        step++;
        setCurrentDesignStep(step);
      } else {
        clearInterval(stepInterval);
      }
    }, STEP_INTERVAL_MS);

    const progressInterval = setInterval(() => {
      setDesignProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + 1;
      });
    }, PROGRESS_TICK_MS);

    // Reveal checklist items one by one
    let checklistCount = 0;
    const checklistInterval = setInterval(() => {
      checklistCount++;
      setVisibleChecklistItems(checklistCount);
      if (checklistCount >= CHECKLIST.length) clearInterval(checklistInterval);
    }, CHECKLIST_INTERVAL_MS);

    // Once the animation timer elapses, the progress bar caps at 95% and waits
    // for the real intake to land. We don't transition to a separate
    // "going-live" / "done" phase any more — the progress bar stays visible.
    const animationCompleteTimer = setTimeout(() => {
      setAnimationReady(true);
    }, DESIGNING_DURATION_MS);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      clearInterval(checklistInterval);
      clearTimeout(animationCompleteTimer);
    };
  }, [phoneSubmitted]);

  // Poll /api/tenants/[id]/status every 2s while the async generation runs.
  // The intake API returns fast; the real work happens in the n8n worker.
  useEffect(() => {
    if (!tenantId) return;
    // Reset any stale status from a previous mount before polling.
    setTenantStatus(null);

    let cancelled = false;
    const TIMEOUT_MS = 6 * 60 * 1000; // 6 minutes hard cap
    const startedAt = Date.now();

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/tenants/${tenantId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`status HTTP ${res.status}`);
        const data = (await res.json()) as { status: string; error?: string };
        if (cancelled) return;
        setTenantStatus(data.status);
        if (data.status === "failed" && data.error) {
          setIntakeError(data.error);
        }
        // Once terminal, stop polling.
        if (
          data.status === "done" ||
          data.status === "claimed" ||
          data.status === "failed"
        ) {
          return;
        }
        // Hard timeout — surface as a friendly error, stop polling.
        if (Date.now() - startedAt > TIMEOUT_MS) {
          setIntakeError(
            "Generation is taking longer than expected. Please refresh in a minute or contact support.",
          );
          return;
        }
      } catch (err: unknown) {
        // Transient poll errors don't kill the loop; keep trying.
        console.warn("[building] status poll:", err);
      }
      setTimeout(tick, 2000);
    };
    // First tick fires immediately so we don't waste 2s at 'queued'.
    void tick();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // Redirect once BOTH the animation has finished AND the async generation
  // has landed. On terminal-success, snap progress to 100% then briefly hold
  // so the user sees the bar fill before navigation.
  useEffect(() => {
    const ready =
      animationReady &&
      tenantId &&
      (tenantStatus === "done" || tenantStatus === "claimed");
    if (!ready) return;
    setDesignProgress(100);
    const t = setTimeout(() => {
      router.push(`/preview/${tenantId}`);
    }, 600);
    return () => clearTimeout(t);
  }, [animationReady, tenantId, tenantStatus, router]);

  /* ---------------------------------------------------------------------- */
  /*  Phone submit handler                                                    */
  /* ---------------------------------------------------------------------- */

  function handlePhoneSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleaned = phone.replace(/\s/g, "");
    if (!cleaned || cleaned.length < 8) {
      setPhoneError("Please enter a valid Australian mobile number.");
      return;
    }
    setPhoneError("");
    console.log("Phone captured:", phone, "for lead:", leadId);
    setPhoneSubmitted(true);
  }

  /* ---------------------------------------------------------------------- */
  /*  Computed state                                                          */
  /* ---------------------------------------------------------------------- */

  const showFound = phase !== "lookup";
  const showPhoneCapture = phase === "phone-capture" || phoneSubmitted;
  const showDesigning = phase === "designing";
  // Progress bar label progression:
  //   1. While animation timer running → cycle through DESIGN_STEPS
  //   2. After animation timer elapses (intake still in flight) → "Finalising your site…"
  //   3. After tenantId arrives → "Site is ready"
  const generationDone = tenantStatus === "done" || tenantStatus === "claimed";
  const activeDesignLabel = generationDone
    ? "Site is ready"
    : animationReady
      ? "Finalising your site…"
      : DESIGN_STEPS[currentDesignStep]?.label ?? "Building your site";

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-slate-950 text-white relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute top-1/3 right-0 w-80 h-80 rounded-full bg-indigo-600/8 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1 px-5 py-10">
        <div className="w-full max-w-md mx-auto flex flex-col gap-0">

          {/* Header */}
          <div className="mb-10 text-center">
            <div className="text-lg font-bold text-white mb-2">Launcharoo</div>
            <h1 className="text-2xl font-[family-name:var(--font-sora)] font-extrabold text-white leading-tight">
              Building{" "}
              <span className="text-blue-400">{name}&apos;s</span>{" "}
              website
            </h1>
            <p className="text-slate-400 text-sm mt-2">
              Sit tight — this takes about 60 seconds
            </p>
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-7">

            {/* Step 1: Google lookup */}
            <div className="flex items-start gap-4">
              <div className="w-6 h-6 shrink-0 mt-0.5">
                {phase === "lookup" ? (
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                )}
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <p className={`font-semibold text-sm ${phase === "lookup" ? "text-white" : "text-slate-300"}`}>
                  {phase === "lookup" ? (
                    <>Searching Google for <span className="text-blue-400">{name}</span>...</>
                  ) : (
                    <>Found on Google</>
                  )}
                </p>

                {/* Lookup animation */}
                {phase === "lookup" && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-bounce [animation-delay:300ms]" />
                  </div>
                )}

                {/* GBP result card — populated from /api/lookup */}
                {showFound && (
                  <div className="mt-3 bg-slate-900 border border-slate-700 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-500 shadow-xl">
                    {gbpData ? (
                      <>
                        {/* Business details from Google Places */}
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start gap-3">
                            <Building2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                            <span className="text-sm text-white font-bold">{gbpData.name}</span>
                          </div>
                          {gbpData.address && (
                            <div className="flex items-start gap-3">
                              <MapPin className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                              <span className="text-sm text-slate-300">{gbpData.address}</span>
                            </div>
                          )}
                          {gbpData.phone && (
                            <div className="flex items-start gap-3">
                              <Phone className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                              <span className="text-sm text-slate-300">{gbpData.phone}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-green-500 font-medium mt-4 text-center">
                          ✓ Google Business Profile matched
                        </p>
                      </>
                    ) : (
                      // Lookup in flight — show a compact loading state inside the card
                      <div className="flex items-center justify-center gap-2 py-2">
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        <span className="text-sm text-slate-400">Fetching your business details…</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Phone capture */}
            {showPhoneCapture && (
              <div className="flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="w-6 h-6 shrink-0 mt-0.5">
                  {phoneSubmitted ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  ) : (
                    <PulsingDot />
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <p className="font-semibold text-sm text-white">
                    {phoneSubmitted
                      ? "Preview link ready to send"
                      : "Where should we send your preview link?"}
                  </p>
                  {!phoneSubmitted && (
                    <form onSubmit={handlePhoneSubmit} className="mt-2 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          ref={phoneInputRef}
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="e.g. 0412 345 678"
                          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          autoComplete="tel"
                        />
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm transition-colors shrink-0"
                        >
                          Send
                        </button>
                      </div>
                      {phoneError && (
                        <p className="text-red-400 text-xs">{phoneError}</p>
                      )}
                      <p className="text-slate-600 text-xs">
                        Australian mobile only &mdash; no spam, ever.
                      </p>
                    </form>
                  )}
                  {phoneSubmitted && (
                    <p className="text-sm text-slate-400">
                      We will SMS you the link when it is ready.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Designing — progress bar visible until redirect */}
            {showDesigning && (
              <div className="flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="w-6 h-6 shrink-0 mt-0.5">
                  {generationDone ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  ) : (
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                  )}
                </div>
                <div className="flex flex-col gap-3 flex-1">
                  <p className="font-semibold text-sm text-white">
                    Designing your site
                  </p>

                  <ProgressBar progress={designProgress} label={activeDesignLabel} />

                  {/* What you're getting checklist */}
                  {visibleChecklistItems > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        What you are getting
                      </p>
                      {CHECKLIST.slice(0, visibleChecklistItems).map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-sm animate-in fade-in slide-in-from-left-2 duration-300"
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                          <span className="text-slate-300">{item}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {intakeError && (
                    <p className="text-sm text-red-400 font-medium">
                      Sorry — couldn&apos;t build your site: {intakeError}
                    </p>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Bottom note */}
          <div className="mt-14 text-center text-slate-700 text-xs">
            Your site is being built from your Google Business Profile data.
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Export (wrapped in Suspense for useSearchParams)                            */
/* -------------------------------------------------------------------------- */

export default function BuildingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center min-h-screen bg-slate-950">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      }
    >
      <BuildingPageInner />
    </Suspense>
  );
}
