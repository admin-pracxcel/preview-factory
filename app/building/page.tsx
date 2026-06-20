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

/* -------------------------------------------------------------------------- */
/*  Mock GBP data                                                               */
/* -------------------------------------------------------------------------- */

function getMockGBPData(name: string, suburb: string) {
  return {
    name,
    address: `${suburb}, Australia`,
    phone: "0412 345 678",
    photos: [
      "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=160&h=120&fit=crop",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=160&h=120&fit=crop",
      "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=160&h=120&fit=crop",
    ],
    confidence: 1.0,
  };
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
  { label: "Building service pages", targetPct: 45 },
  { label: "Optimising for local SEO", targetPct: 65 },
  { label: "Adding call tracking", targetPct: 80 },
  { label: "Going live on preview server", targetPct: 100 },
];

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

  const gbpData = getMockGBPData(name, suburb);

  const [phase, setPhase] = useState<Phase>("lookup");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneSubmitted, setPhoneSubmitted] = useState(false);
  const [designProgress, setDesignProgress] = useState(0);
  const [currentDesignStep, setCurrentDesignStep] = useState(0);
  const [visibleChecklistItems, setVisibleChecklistItems] = useState<number>(0);
  const phoneInputRef = useRef<HTMLInputElement>(null);

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
    }, 1000);

    const progressInterval = setInterval(() => {
      setDesignProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + 10;
      });
    }, 500);

    // Reveal checklist items one by one
    let checklistCount = 0;
    const checklistInterval = setInterval(() => {
      checklistCount++;
      setVisibleChecklistItems(checklistCount);
      if (checklistCount >= CHECKLIST.length) clearInterval(checklistInterval);
    }, 900);

    const t3 = setTimeout(() => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      setDesignProgress(100);
      setPhase("going-live");
    }, 5500);

    const t4 = setTimeout(() => {
      setPhase("done");
    }, 8500);

    const t5 = setTimeout(() => {
      router.push(`/preview/${leadId}`);
    }, 9200);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      clearInterval(checklistInterval);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [phoneSubmitted, leadId, router]);

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
  const showDesigning = phase === "designing" || phase === "going-live" || phase === "done";
  const showGoingLive = phase === "going-live" || phase === "done";
  const activeDesignLabel =
    DESIGN_STEPS[currentDesignStep]?.label ?? "Building your site";

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
            <div className="text-lg font-bold text-white mb-2">Preview Factory</div>
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

                {/* GBP result card */}
                {showFound && (
                  <div className="mt-3 bg-slate-900 border border-slate-700 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-500 shadow-xl">
                    {/* Business details */}
                    <div className="flex flex-col gap-3 mb-4">
                      <div className="flex items-start gap-3">
                        <Building2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                        <span className="text-sm text-white font-bold">{gbpData.name}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                        <span className="text-sm text-slate-300">{gbpData.address}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Phone className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                        <span className="text-sm text-slate-300">{gbpData.phone}</span>
                      </div>
                    </div>

                    {/* Photo strip */}
                    <div className="flex gap-2 overflow-hidden rounded-xl">
                      {gbpData.photos.map((url, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-xl overflow-hidden bg-slate-800"
                          style={{ height: "80px" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Business photo ${i + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-green-500 font-medium mt-3 text-center">
                      ✓ Google Business Profile matched
                    </p>
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

            {/* Designing */}
            {showDesigning && (
              <div className="flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="w-6 h-6 shrink-0 mt-0.5">
                  {showGoingLive ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  ) : (
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                  )}
                </div>
                <div className="flex flex-col gap-3 flex-1">
                  <p className={`font-semibold text-sm ${showGoingLive ? "text-slate-300" : "text-white"}`}>
                    Designing your site
                  </p>

                  {!showGoingLive && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Going live */}
            {showGoingLive && (
              <div className="flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="w-6 h-6 shrink-0 mt-0.5">
                  {phase === "done" ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  ) : (
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <p className={`font-semibold text-sm ${phase === "done" ? "text-slate-300" : "text-white"}`}>
                    {phase === "done" ? "Your site is live." : "Going live on preview server..."}
                  </p>
                  {phase === "going-live" && (
                    <p className="text-xs text-slate-500">
                      Deploying to preview URL
                    </p>
                  )}
                  {phase === "done" && (
                    <p className="text-sm text-blue-400 font-medium animate-pulse">
                      Opening your preview now...
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
