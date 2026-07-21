"use client";

/**
 * PlanPicker — modal for the "Save my site" flow on the preview page.
 *
 * Three tier cards (Starter / Growth / Pro), monthly/annual toggle at the
 * top, Growth pre-highlighted with a "Most popular" chip. Selecting a plan
 * fires the parent's `onChoosePlan(planKey)` which POSTs to `/api/checkout`
 * and redirects the browser to Stripe (or the local mock URL in dev).
 *
 * Modal styling mirrors the existing dashboard dialog pattern so the
 * preview page feels visually consistent across surfaces.
 */

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import {
  ANNUAL_DISCOUNT_LABEL,
  TIERS,
  type BillingCycle,
  type PlanKey,
} from "@/lib/plans";

export default function PlanPicker({
  open,
  onClose,
  onChoosePlan,
  busyPlan,
}: {
  open: boolean;
  onClose: () => void;
  onChoosePlan: (planKey: PlanKey) => void;
  /** When set, that plan's card shows a spinner + disables all other cards. */
  busyPlan: PlanKey | null;
}) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const dismiss = useCallback(() => {
    if (busyPlan) return; // don't let a click through the backdrop kill the redirect
    onClose();
  }, [busyPlan, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Choose your plan"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={dismiss}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0A0F1E] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/5 px-6 py-5">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white">
              Choose your plan
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Same site. Different amount of support and edits.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="shrink-0 rounded-lg border border-white/10 p-1.5 text-white/50 transition-colors hover:border-white/25 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          <CycleToggle cycle={cycle} onChange={setCycle} />

          <div className="mt-5 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
            {TIERS.map((tier) => {
              const key = `${tier.id}-${cycle}` as PlanKey;
              const amount = cycle === "monthly" ? tier.monthly : tier.annual;
              const dollars = (amount / 100).toFixed(0);
              const cycleLabel = cycle === "monthly" ? "/month" : "/year";
              const isBusy = busyPlan === key;
              const anyBusy = busyPlan != null;

              return (
                <div
                  key={tier.id}
                  className={`relative flex flex-col rounded-xl border p-4 sm:p-5 transition-colors ${
                    tier.popular
                      ? "border-blue-500/50 bg-blue-500/[0.06]"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  {tier.popular && (
                    <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-blue-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
                      <Sparkles className="h-3 w-3" />
                      Most popular
                    </span>
                  )}
                  <h3 className="text-lg font-extrabold text-white">{tier.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white">${dollars}</span>
                    <span className="text-sm text-white/50">{cycleLabel}</span>
                    <span className="text-[10px] font-medium text-white/40 ml-0.5">+ GST</span>
                  </div>
                  <ul className="mt-4 space-y-2 flex-1">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-white/85">
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            tier.popular ? "text-blue-300" : "text-white/60"
                          }`}
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => onChoosePlan(key)}
                    disabled={anyBusy}
                    className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                      tier.popular
                        ? "bg-blue-600 text-white hover:bg-blue-500"
                        : "bg-white text-slate-900 hover:bg-white/90"
                    }`}
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Taking you to checkout…
                      </>
                    ) : (
                      `Choose ${tier.name}`
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="mt-5 text-center text-[11px] text-white/40">
            All prices exclude GST. Secure checkout via Stripe. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CycleToggle({
  cycle,
  onChange,
}: {
  cycle: BillingCycle;
  onChange: (v: BillingCycle) => void;
}) {
  return (
    <div className="flex justify-center">
      <div className="relative inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] p-1">
        <button
          type="button"
          onClick={() => onChange("monthly")}
          aria-pressed={cycle === "monthly"}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            cycle === "monthly" ? "bg-white text-slate-900" : "text-white/70 hover:text-white"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onChange("annual")}
          aria-pressed={cycle === "annual"}
          className={`ml-1 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            cycle === "annual" ? "bg-white text-slate-900" : "text-white/70 hover:text-white"
          }`}
        >
          Annual
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              cycle === "annual"
                ? "bg-green-500/20 text-green-700"
                : "bg-green-500/20 text-green-300"
            }`}
          >
            {ANNUAL_DISCOUNT_LABEL}
          </span>
        </button>
      </div>
    </div>
  );
}
