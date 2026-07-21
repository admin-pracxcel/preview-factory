"use client";

/**
 * Intake funnel entry — now a two-step form:
 *
 *   Step 1 (form)     : sub-niche, business name, suburb → hits /api/lookup
 *                        and (fire-and-forget) marketing-intake for lead capture
 *   Step 2 (confirm)  : shows the found GBP as a card, offers "This isn't me →"
 *                        which reveals a Google-Maps-link paste box, plus a
 *                        phone-number input and a Build-my-site CTA. On submit
 *                        we POST /api/intake with the confirmed listing + phone
 *                        and route to /building?tenantId=…
 *
 * Generation only starts on Step-2 submit, so no Claude tokens are burned
 * on the wrong business.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, MapPin, Phone as PhoneIcon, Star, Info, ChevronDown } from "lucide-react";
import type { GbpData } from "@/lib/places-client";

export interface NicheFormProps {
  subNiches: string[];
  defaultSubNiche?: string;
  category: string; // "trades" | "allied-health" | "beauty" | "fitness"
  accentClass?: string; // Tailwind bg class for button, e.g. "bg-blue-600"
}

function generateLeadId(): string {
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** AU mobile: `+614XXXXXXXX` or `04XXXXXXXX`, whitespace/dashes ignored. */
function isValidAuMobile(input: string): boolean {
  const cleaned = input.replace(/[\s-]/g, "");
  return /^(\+614|04)\d{8}$/.test(cleaned);
}

type Step = "form" | "confirm";

export default function NicheForm({
  subNiches,
  defaultSubNiche = "",
  category,
  accentClass = "bg-blue-600 hover:bg-blue-500 active:bg-blue-700",
}: NicheFormProps) {
  const router = useRouter();

  // -- form step state -------------------------------------------------------
  const [subNiche, setSubNiche] = useState(defaultSubNiche);
  const [businessName, setBusinessName] = useState("");
  const [suburb, setSuburb] = useState("");
  const [formError, setFormError] = useState("");
  const [looking, setLooking] = useState(false);

  // -- confirm step state ----------------------------------------------------
  const [step, setStep] = useState<Step>("form");
  const [gbpData, setGbpData] = useState<GbpData | null>(null);
  const [confirmError, setConfirmError] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [building, setBuilding] = useState(false);

  const leadIdRef = useRef<string>("");

  // Step 1: run /api/lookup, fire lead-capture in parallel, move to confirm.
  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!subNiche || !businessName.trim() || !suburb.trim()) {
      setFormError("Please fill in all three fields.");
      return;
    }
    setFormError("");
    setLooking(true);

    // Lead capture — never blocks the UX, just for our funnel analytics.
    leadIdRef.current = generateLeadId();
    void fetch("/api/marketing-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: leadIdRef.current,
        business_name: businessName.trim(),
        niche: subNiche,
        category,
        suburb: suburb.trim(),
        timestamp: new Date().toISOString(),
      }),
    }).catch((err) => console.error("marketing-intake fire-and-forget failed:", err));

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          niche: subNiche,
          suburb: suburb.trim(),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Lookup failed (HTTP ${res.status})`);
      }
      const { gbpData: gbp } = (await res.json()) as { gbpData: GbpData };
      setGbpData(gbp);
      setStep("confirm");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't reach Google. Try again in a moment.";
      setFormError(msg);
    } finally {
      setLooking(false);
    }
  }

  // Confirm step "This isn't me →" — re-run lookup with a pasted Maps link.
  async function handleUseThisListing(mapsUrl: string): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!mapsUrl.trim()) return { ok: false, error: "Paste your Google Maps link first." };
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapsUrl: mapsUrl.trim(), niche: subNiche, suburb: suburb.trim() || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        return { ok: false, error: data.error ?? `Couldn't read that link (HTTP ${res.status})` };
      }
      const { gbpData: gbp } = (await res.json()) as { gbpData: GbpData };
      setGbpData(gbp);
      setConfirmError("");
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error. Try again." };
    }
  }

  // Confirm step Build-my-site: start generation, redirect to /building.
  async function handleBuildMySite() {
    if (!gbpData) return;
    if (!isValidAuMobile(phone)) {
      setPhoneError("Enter a valid Australian mobile (e.g. 04XX XXX XXX).");
      return;
    }
    setPhoneError("");
    setBuilding(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gbpData,
          niche: subNiche,
          category,
          phone: phone.trim(),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Intake failed (HTTP ${res.status})`);
      }
      const { tenantId } = (await res.json()) as { tenantId: string };
      router.push(`/building?tenantId=${encodeURIComponent(tenantId)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't start the build. Try again.";
      setConfirmError(msg);
      setBuilding(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-8 w-full mx-auto max-w-full">
      {step === "form" ? (
        <FormStep
          subNiche={subNiche}
          setSubNiche={setSubNiche}
          businessName={businessName}
          setBusinessName={setBusinessName}
          suburb={suburb}
          setSuburb={setSuburb}
          subNiches={subNiches}
          submitting={looking}
          error={formError}
          onSubmit={handleFormSubmit}
          accentClass={accentClass}
        />
      ) : (
        <ConfirmStep
          gbpData={gbpData!}
          phone={phone}
          setPhone={setPhone}
          phoneError={phoneError}
          confirmError={confirmError}
          building={building}
          onUseThisListing={handleUseThisListing}
          onBuild={handleBuildMySite}
          accentClass={accentClass}
        />
      )}

      {/* Trust dots (unchanged) */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          60 seconds to live
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          No credit card required
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Cancel anytime
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 1 — the original three-field form                                      */
/* -------------------------------------------------------------------------- */

function FormStep({
  subNiche,
  setSubNiche,
  businessName,
  setBusinessName,
  suburb,
  setSuburb,
  subNiches,
  submitting,
  error,
  onSubmit,
  accentClass,
}: {
  subNiche: string;
  setSubNiche: (v: string) => void;
  businessName: string;
  setBusinessName: (v: string) => void;
  suburb: string;
  setSuburb: (v: string) => void;
  subNiches: string[];
  submitting: boolean;
  error: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  accentClass: string;
}) {
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {/* Sub-niche */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="sub-niche" className="text-sm font-semibold text-slate-700">
          What do you specialise in?
        </label>
        <div className="relative">
          <select
            id="sub-niche"
            value={subNiche}
            onChange={(e) => setSubNiche(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-base appearance-none cursor-pointer pr-10"
            disabled={submitting}
          >
            <option value="" disabled>
              Select your specialty
            </option>
            {subNiches.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Business name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="business-name" className="text-sm font-semibold text-slate-700">
          Business name
        </label>
        <input
          id="business-name"
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g. Smith Electrical"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-base"
          autoComplete="organization"
          disabled={submitting}
        />
      </div>

      {/* Suburb */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="suburb" className="text-sm font-semibold text-slate-700">
          Suburb
        </label>
        <input
          id="suburb"
          type="text"
          value={suburb}
          onChange={(e) => setSuburb(e.target.value)}
          placeholder="e.g. Surry Hills NSW"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-base"
          autoComplete="address-level2"
          disabled={submitting}
        />
      </div>

      {error && <p className="text-red-500 text-sm -mt-1">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-white font-bold text-base transition-all mt-1 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed ${accentClass}`}
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Finding you on Google…
          </>
        ) : (
          "See my website now →"
        )}
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 2 — confirm the GBP listing, capture phone, kick off generation        */
/* -------------------------------------------------------------------------- */

function ConfirmStep({
  gbpData,
  phone,
  setPhone,
  phoneError,
  confirmError,
  building,
  onUseThisListing,
  onBuild,
  accentClass,
}: {
  gbpData: GbpData;
  phone: string;
  setPhone: (v: string) => void;
  phoneError: string;
  confirmError: string;
  building: boolean;
  onUseThisListing: (mapsUrl: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onBuild: () => void;
  accentClass: string;
}) {
  const [showPaste, setShowPaste] = useState(false);
  const [mapsUrl, setMapsUrl] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [pasting, setPasting] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const heroPhoto = gbpData.photos?.[0];
  const rating = typeof gbpData.rating === "number" ? gbpData.rating.toFixed(1) : null;
  const reviewCount = gbpData.reviewCount;
  const displayAddress = gbpData.address || [gbpData.suburb, gbpData.state].filter(Boolean).join(" ");

  async function submitPaste() {
    setPasting(true);
    setPasteError("");
    const result = await onUseThisListing(mapsUrl);
    setPasting(false);
    if (result.ok) {
      setShowPaste(false);
      setMapsUrl("");
    } else {
      setPasteError(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 text-left">
      <div>
        <div className="mb-2 sm:mb-3 text-left">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
            Found your business
          </h2>
        </div>
        <div className="rounded-xl border border-slate-200 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            {heroPhoto && (
              <div className="relative w-full h-[150px] sm:w-1/4 sm:h-auto sm:aspect-square shrink-0 rounded-lg overflow-hidden bg-slate-100">
                <Image
                  src={heroPhoto}
                  alt={gbpData.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 200px"
                  unoptimized
                />
              </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <h3 className="font-extrabold text-slate-900 text-base leading-tight">{gbpData.name}</h3>
              {displayAddress && (
                <p className="flex items-start gap-1.5 text-sm text-slate-600 leading-snug">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{displayAddress}</span>
                </p>
              )}
              {gbpData.phone && (
                <p className="flex items-center gap-1.5 text-sm text-slate-600">
                  <PhoneIcon className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{gbpData.phone}</span>
                </p>
              )}
              {rating && (
                <div className="mt-1 flex items-center gap-1 w-fit rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-700 text-xs font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {rating}
                  {typeof reviewCount === "number" && (
                    <span className="text-amber-600/70 font-medium">({reviewCount})</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setShowPaste((v) => !v)}
            className="text-sm font-medium text-slate-500 hover:text-slate-900 underline underline-offset-4 decoration-slate-300 hover:decoration-slate-900 transition-colors"
          >
            {showPaste ? "Never mind" : "Not your business? Paste your link →"}
          </button>
        </div>
      </div>

      {showPaste && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor="maps-url" className="text-sm font-semibold text-slate-700">
              Paste your Google Maps link here
            </label>
            <TooltipIcon open={showTooltip} onToggle={() => setShowTooltip((v) => !v)} />
          </div>
          <div className="flex gap-2">
            <input
              id="maps-url"
              type="url"
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
              placeholder="https://maps.app.goo.gl/…"
              className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
              disabled={pasting}
            />
            <button
              type="button"
              onClick={submitPaste}
              disabled={pasting || !mapsUrl.trim()}
              className={`shrink-0 px-4 py-2.5 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed ${accentClass}`}
            >
              {pasting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Use this listing"}
            </button>
          </div>
          {pasteError && <p className="text-red-500 text-xs">{pasteError}</p>}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm font-semibold text-slate-700">
          Your mobile number
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="04XX XXX XXX"
          className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-base"
          autoComplete="tel"
          disabled={building}
          inputMode="tel"
        />
        <p className="text-xs text-slate-500">We&apos;ll SMS you the link when it&apos;s live.</p>
        {phoneError && <p className="text-red-500 text-xs">{phoneError}</p>}
      </div>

      {confirmError && <p className="text-red-500 text-sm">{confirmError}</p>}

      <button
        type="button"
        onClick={onBuild}
        disabled={building}
        className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 sm:py-4 rounded-xl text-white font-bold text-base transition-all mt-1 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed ${accentClass}`}
      >
        {building ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Starting your build…
          </>
        ) : (
          "Build my site →"
        )}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tiny tap/hover tooltip for the paste-link "i" icon                          */
/* -------------------------------------------------------------------------- */

function TooltipIcon({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on outside click.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onToggle();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onToggle]);

  const steps = useMemo(
    () => [
      "Open Google Maps and find your business",
      "Tap Share (the arrow icon)",
      "Tap Copy link — then paste it here",
    ],
    [],
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-label="How to get your Google Maps link"
        className="grid place-items-center rounded-full text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Info className="w-4 h-4" />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute z-30 top-6 left-0 w-64 rounded-xl border border-slate-200 bg-white shadow-lg p-3 text-left"
        >
          <p className="text-xs font-bold text-slate-900 mb-1">How to get your link</p>
          <ol className="text-xs text-slate-600 space-y-1 list-decimal pl-4">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
