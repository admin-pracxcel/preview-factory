"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const NICHES = [
  { value: "electrician", label: "Electrician" },
  { value: "plumber", label: "Plumber" },
  { value: "hair-salon", label: "Hair Salon" },
  { value: "physiotherapist", label: "Physiotherapist" },
  { value: "personal-trainer", label: "Personal Trainer" },
  { value: "other", label: "Other" },
];

function generateLeadId(): string {
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function LandingPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [niche, setNiche] = useState("");
  const [suburb, setSuburb] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!businessName.trim() || !niche || !suburb.trim()) {
      setError("Please fill in all three fields.");
      return;
    }
    setError("");
    setSubmitting(true);

    const leadId = generateLeadId();
    const payload = {
      lead_id: leadId,
      business_name: businessName.trim(),
      niche,
      suburb: suburb.trim(),
      timestamp: new Date().toISOString(),
    };

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error("Webhook call failed:", err);
        // Non-fatal: continue to building page regardless
      }
    } else {
      console.log("n8n webhook not configured. Payload:", payload);
    }

    router.push(
      `/building?lead_id=${encodeURIComponent(leadId)}&name=${encodeURIComponent(businessName.trim())}&niche=${encodeURIComponent(niche)}&suburb=${encodeURIComponent(suburb.trim())}`
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="text-lg font-semibold tracking-tight text-white">
          Preview Factory
        </div>
        <div className="text-sm text-slate-400 hidden sm:block">
          No credit card required
        </div>
      </header>

      {/* Hero + Form */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium tracking-wide uppercase">
              Live in under 60 seconds
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl font-bold text-center leading-tight tracking-tight mb-4">
            Your new website.{" "}
            <span className="text-blue-400">Live in 60 seconds.</span>
          </h1>

          {/* Sub-headline */}
          <p className="text-center text-slate-300 text-lg mb-10 leading-relaxed">
            See exactly how your site looks before you pay a cent. We pull your
            Google Business Profile and build a real site in under a minute.
          </p>

          {/* Form card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-2xl">
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
              {/* Business name */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="business-name"
                  className="text-sm font-medium text-slate-200"
                >
                  Business name
                </label>
                <input
                  id="business-name"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Smith Electrical"
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-base"
                  autoComplete="organization"
                  disabled={submitting}
                />
              </div>

              {/* Niche */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="niche"
                  className="text-sm font-medium text-slate-200"
                >
                  What do you do?
                </label>
                <select
                  id="niche"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-base appearance-none cursor-pointer"
                  disabled={submitting}
                >
                  <option value="" disabled>
                    Select your trade or service
                  </option>
                  {NICHES.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Suburb */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="suburb"
                  className="text-sm font-medium text-slate-200"
                >
                  Suburb
                </label>
                <input
                  id="suburb"
                  type="text"
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                  placeholder="e.g. Surry Hills, NSW"
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-base"
                  autoComplete="address-level2"
                  disabled={submitting}
                />
              </div>

              {/* Error */}
              {error && (
                <p className="text-red-400 text-sm -mt-1">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-base transition-colors mt-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Building your preview...
                  </>
                ) : (
                  "See my website now"
                )}
              </button>
            </form>
          </div>

          {/* Trust strip */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mt-7 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
              Generated in under 60 seconds
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
              Cancel anytime
            </span>
          </div>
        </div>
      </main>

      {/* Social proof footer */}
      <footer className="py-8 px-6 border-t border-slate-800/60">
        <div className="max-w-lg mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span>Over 500 Australian businesses previewed this month</span>
          <span>Preview Factory &copy; 2025</span>
        </div>
      </footer>
    </div>
  );
}
