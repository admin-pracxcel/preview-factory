"use client";

/**
 * /building — the "we're generating your site" screen.
 *
 * Generation is started by the intake confirm step (see NicheForm) and this
 * page just polls status + drives the animation. Phase 3 refactor: URL
 * carries only `tenantId`; phone was captured before generation started so
 * there is no mid-flow phone step here any more; lookup + intake calls are
 * gone (already done upstream).
 */

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

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
/*  Designing steps                                                             */
/* -------------------------------------------------------------------------- */

const DESIGN_STEPS = [
  { label: "Generating homepage", targetPct: 20 },
  { label: "Writing service pages", targetPct: 40 },
  { label: "Creating suburb pages", targetPct: 60 },
  { label: "Optimising for local SEO", targetPct: 80 },
  { label: "Polishing copy and going live", targetPct: 100 },
];

/** "Designing your site" phase duration for the optimistic animation. Real
 *  generation runs 3-6 min; the bar caps at 95% and holds until status flips. */
const DESIGNING_DURATION_MS = 70_000;
const STEP_INTERVAL_MS = DESIGNING_DURATION_MS / DESIGN_STEPS.length;
const PROGRESS_TICK_MS = 700;
const CHECKLIST_INTERVAL_MS = 8_000;

const CHECKLIST = [
  "Homepage",
  "6 service pages",
  "8 suburb pages",
  "Local SEO structure",
];

/* -------------------------------------------------------------------------- */
/*  Inner component                                                              */
/* -------------------------------------------------------------------------- */

function BuildingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenantId");

  const [businessName, setBusinessName] = useState<string>("Your Business");
  const [designProgress, setDesignProgress] = useState(0);
  const [currentDesignStep, setCurrentDesignStep] = useState(0);
  const [visibleChecklistItems, setVisibleChecklistItems] = useState(0);

  const [tenantStatus, setTenantStatus] = useState<string | null>(null);
  const [hasSiteProps, setHasSiteProps] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [takingLonger, setTakingLonger] = useState(false);
  const [animationReady, setAnimationReady] = useState(false);

  /* ---------------------------------------------------------------------- */
  /*  Status polling — every 2s. First tick fires immediately.                */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!tenantId) {
      setIntakeError("Missing tenant id in the URL.");
      return;
    }

    let cancelled = false;
    // Soft threshold — swap the animation copy for reassurance; poll continues.
    const SOFT_WARN_MS = 4 * 60 * 1000;
    // Hard cap — give up polling and tell the user to hang out.
    const TIMEOUT_MS = 15 * 60 * 1000;
    const startedAt = Date.now();

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/tenants/${tenantId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`status HTTP ${res.status}`);
        const data = (await res.json()) as {
          status: string;
          error?: string;
          name?: string;
          hasSiteProps?: boolean;
        };
        if (cancelled) return;

        if (data.name) setBusinessName(data.name);

        setTenantStatus(data.status);
        const siteReady = data.hasSiteProps === true;
        setHasSiteProps(siteReady);
        if (data.status === "failed" && data.error) {
          setIntakeError(data.error);
        }
        if (data.status === "failed") return;
        if ((data.status === "done" || data.status === "claimed") && siteReady) {
          return;
        }

        const elapsed = Date.now() - startedAt;
        if (elapsed > SOFT_WARN_MS) setTakingLonger(true);
        if (elapsed > TIMEOUT_MS) {
          setIntakeError(
            "Your site is taking unusually long to build. You can safely close this page — we'll email you the link when it's ready, or check your dashboard.",
          );
          return;
        }
      } catch (err: unknown) {
        console.warn("[building] status poll:", err);
      }
      setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  /* ---------------------------------------------------------------------- */
  /*  Designing animation — starts on mount and drives the progress bar +     */
  /*  checklist reveals independently of the real generation status.          */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
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

    let checklistCount = 0;
    const checklistInterval = setInterval(() => {
      checklistCount++;
      setVisibleChecklistItems(checklistCount);
      if (checklistCount >= CHECKLIST.length) clearInterval(checklistInterval);
    }, CHECKLIST_INTERVAL_MS);

    const animationCompleteTimer = setTimeout(() => {
      setAnimationReady(true);
    }, DESIGNING_DURATION_MS);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      clearInterval(checklistInterval);
      clearTimeout(animationCompleteTimer);
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /*  Redirect on ready                                                       */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    const ready =
      animationReady &&
      tenantId &&
      (tenantStatus === "done" || tenantStatus === "claimed") &&
      hasSiteProps;
    if (!ready) return;
    setDesignProgress(100);
    const t = setTimeout(() => {
      router.push(`/preview/${tenantId}`);
    }, 600);
    return () => clearTimeout(t);
  }, [animationReady, tenantId, tenantStatus, hasSiteProps, router]);

  /* ---------------------------------------------------------------------- */
  /*  Derived                                                                 */
  /* ---------------------------------------------------------------------- */
  const generationDone =
    (tenantStatus === "done" || tenantStatus === "claimed") && hasSiteProps;
  const activeDesignLabel = generationDone
    ? "Site is ready"
    : takingLonger
      ? "This one's taking a bit longer — hang tight"
      : animationReady
        ? "Finalising your site…"
        : DESIGN_STEPS[currentDesignStep]?.label ?? "Building your site";

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute top-1/3 right-0 w-80 h-80 rounded-full bg-indigo-600/8 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 px-5 py-10">
        <div className="w-full max-w-md mx-auto flex flex-col gap-0">

          <div className="mb-10 text-center">
            <img
              src="/images/launcharoo-logo-white.webp"
              alt="Launcharoo"
              className="h-6 w-auto mx-auto mb-3"
            />
            <h1 className="text-2xl font-[family-name:var(--font-sora)] font-extrabold text-white leading-tight">
              Building{" "}
              <span className="text-blue-400">{businessName}&apos;s</span>{" "}
              website
            </h1>
            <p className="text-slate-400 text-sm mt-2">
              Sit tight — this takes a few minutes
            </p>
          </div>

          <div className="flex items-start gap-4">
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

          <div className="mt-14 text-center text-slate-300 text-xs">
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
