"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export interface NicheFormProps {
  subNiches: string[];
  defaultSubNiche?: string;
  category: string; // e.g. "trades", "allied-health", "beauty", "fitness"
  accentClass?: string; // Tailwind bg class for button, e.g. "bg-blue-600"
}

function generateLeadId(): string {
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function NicheForm({
  subNiches,
  defaultSubNiche = "",
  category,
  accentClass = "bg-blue-600 hover:bg-blue-500 active:bg-blue-700",
}: NicheFormProps) {
  const router = useRouter();
  const [subNiche, setSubNiche] = useState(defaultSubNiche);
  const [businessName, setBusinessName] = useState("");
  const [suburb, setSuburb] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!subNiche || !businessName.trim() || !suburb.trim()) {
      setError("Please fill in all three fields.");
      return;
    }
    setError("");
    setSubmitting(true);

    const leadId = generateLeadId();
    const payload = {
      lead_id: leadId,
      business_name: businessName.trim(),
      niche: subNiche,
      category,
      suburb: suburb.trim(),
      timestamp: new Date().toISOString(),
    };

    // Server-side proxy — the actual n8n URL stays out of the browser
    // bundle. See app/api/marketing-intake/route.ts.
    try {
      await fetch("/api/marketing-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Intake submit failed:", err);
    }

    router.push(
      `/building?lead_id=${encodeURIComponent(leadId)}&name=${encodeURIComponent(businessName.trim())}&niche=${encodeURIComponent(subNiche)}&suburb=${encodeURIComponent(suburb.trim())}&category=${encodeURIComponent(category)}`
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
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

        {/* Error */}
        {error && (
          <p className="text-red-500 text-sm -mt-1">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-white font-bold text-base transition-all mt-1 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed ${accentClass}`}
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Building your preview...
            </>
          ) : (
            "See my website now →"
          )}
        </button>
      </form>

      {/* Trust dots */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
          60 seconds to live
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
          No credit card required
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
          Cancel anytime
        </span>
      </div>
    </div>
  );
}
