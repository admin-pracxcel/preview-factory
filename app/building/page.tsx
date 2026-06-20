"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

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

interface CheckItem {
  id: string;
  label: string;
  done: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Mock GBP data                                                               */
/* -------------------------------------------------------------------------- */

function getMockGBPData(name: string, suburb: string) {
  return {
    name,
    address: `${suburb}, Australia`,
    phone: "0412 345 678",
    photos: [
      "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=120&h=90&fit=crop",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=120&h=90&fit=crop",
      "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=120&h=90&fit=crop",
    ],
    confidence: 1.0,
  };
}

/* -------------------------------------------------------------------------- */
/*  Progress bar component                                                      */
/* -------------------------------------------------------------------------- */

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pulsing dot                                                                 */
/* -------------------------------------------------------------------------- */

function PulsingDot() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
      <span className="block w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Inner component (uses useSearchParams — must be inside Suspense)            */
/* -------------------------------------------------------------------------- */

function BuildingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const leadId = searchParams.get("lead_id") ?? "unknown";
  const name = searchParams.get("name") ?? "Your Business";
  const suburb = searchParams.get("suburb") ?? "your suburb";

  const gbpData = getMockGBPData(name, suburb);

  const [phase, setPhase] = useState<Phase>("lookup");
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneSubmitted, setPhoneSubmitted] = useState(false);
  const [designProgress, setDesignProgress] = useState(0);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  /* ---------------------------------------------------------------------- */
  /*  Phase sequencing                                                        */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    // Phase 1: lookup starts immediately
    const t1 = setTimeout(() => {
      // Show "Found" result
      setPhase("found");
      setChecks([
        { id: "found-name", label: gbpData.name, done: true },
        { id: "found-address", label: gbpData.address, done: true },
        { id: "found-phone", label: gbpData.phone, done: true },
      ]);
    }, 2800);

    // Phase 2: after showing found result, prompt phone
    const t2 = setTimeout(() => {
      setPhase("phone-capture");
    }, 4500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus phone input when phase changes to phone-capture
  useEffect(() => {
    if (phase === "phone-capture") {
      setTimeout(() => phoneInputRef.current?.focus(), 100);
    }
  }, [phase]);

  // After phone submitted, run designing + going-live phases
  useEffect(() => {
    if (!phoneSubmitted) return;

    setPhase("designing");
    setDesignProgress(0);

    // Increment progress bar
    const interval = setInterval(() => {
      setDesignProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + 12;
      });
    }, 500);

    const t3 = setTimeout(() => {
      clearInterval(interval);
      setDesignProgress(100);
      setPhase("going-live");
    }, 5000);

    const t4 = setTimeout(() => {
      setPhase("done");
    }, 8200);

    const t5 = setTimeout(() => {
      router.push(`/preview/${leadId}`);
    }, 8800);

    return () => {
      clearInterval(interval);
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
    // Stub: POST to webhook/Supabase
    setPhoneSubmitted(true);
  }

  /* ---------------------------------------------------------------------- */
  /*  Render helpers                                                          */
  /* ---------------------------------------------------------------------- */

  const showPhotos = phase === "found" || phase === "phone-capture" || phase === "designing" || phase === "going-live" || phase === "done";
  const showDesigning = phase === "designing" || phase === "going-live" || phase === "done";
  const showGoingLive = phase === "going-live" || phase === "done";

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-slate-950 text-white px-5 py-10">
      <div className="w-full max-w-md mx-auto flex flex-col gap-0">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="text-lg font-semibold text-white mb-1">Preview Factory</div>
          <p className="text-slate-400 text-sm">Building your site...</p>
        </div>

        {/* Steps container */}
        <div className="flex flex-col gap-6">

          {/* Step 1: Google lookup */}
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 shrink-0 mt-0.5">
              {phase === "lookup" ? (
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              )}
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <p className={`font-medium ${phase === "lookup" ? "text-white" : "text-slate-300"}`}>
                {phase === "lookup" ? (
                  <>Looking up <span className="text-blue-400">{name}</span> on Google</>
                ) : (
                  <>Found <span className="text-green-400">{name}</span></>
                )}
              </p>

              {/* Typing dots during lookup */}
              {phase === "lookup" && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:300ms]" />
                </div>
              )}

              {/* GBP result cards */}
              {showPhotos && (
                <div className="mt-3 bg-slate-900 border border-slate-800 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex flex-col gap-2 mb-3">
                    {checks.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                        <span>{c.label}</span>
                      </div>
                    ))}
                  </div>
                  {/* Photo strip */}
                  <div className="flex gap-2 overflow-hidden">
                    {gbpData.photos.map((url, i) => (
                      <div
                        key={i}
                        className="w-20 h-14 rounded-lg overflow-hidden bg-slate-800 shrink-0"
                        style={{ animationDelay: `${i * 120}ms` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Phone capture — appears after found */}
          {(phase === "phone-capture" || phoneSubmitted) && (
            <div className="flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="w-8 h-8 shrink-0 mt-0.5">
                {phoneSubmitted ? (
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                ) : (
                  <PulsingDot />
                )}
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <p className="font-medium text-white">
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
                        placeholder="Your mobile number"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        autoComplete="tel"
                      />
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-sm transition-colors shrink-0"
                      >
                        Send
                      </button>
                    </div>
                    {phoneError && (
                      <p className="text-red-400 text-xs">{phoneError}</p>
                    )}
                    <p className="text-slate-500 text-xs">
                      Australian mobile only. No spam.
                    </p>
                  </form>
                )}
                {phoneSubmitted && (
                  <p className="text-sm text-slate-400">
                    We&apos;ll SMS you the link when it&apos;s ready.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Designing */}
          {showDesigning && (
            <div className="flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="w-8 h-8 shrink-0 mt-0.5">
                {showGoingLive ? (
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                ) : (
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                )}
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <p className={`font-medium ${showGoingLive ? "text-slate-300" : "text-white"}`}>
                  Designing your site
                </p>
                {!showGoingLive && (
                  <ProgressBar progress={designProgress} />
                )}
              </div>
            </div>
          )}

          {/* Step 4: Going live */}
          {showGoingLive && (
            <div className="flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="w-8 h-8 shrink-0 mt-0.5">
                {phase === "done" ? (
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                ) : (
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                )}
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <p className={`font-medium ${phase === "done" ? "text-slate-300" : "text-white"}`}>
                  {phase === "done" ? "Your site is live." : "Going live..."}
                </p>
                {phase === "going-live" && (
                  <p className="text-xs text-slate-500">
                    Deploying to preview server
                  </p>
                )}
                {phase === "done" && (
                  <p className="text-sm text-blue-400 animate-pulse">
                    Opening your preview now...
                  </p>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Bottom note */}
        <div className="mt-12 text-center text-slate-600 text-xs">
          Your site is being built using your Google Business Profile data.
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
