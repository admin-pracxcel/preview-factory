"use client";

/**
 * ChangeRequestsPanel
 *
 * Single "Need an edit?" trigger in the preview page's right rail (and
 * mobile slide-up). Opens a modal that adapts to the tenant's current
 * plan:
 *
 *   Pre-claim    → "Included on Growth and Pro plans" + [Choose a plan]
 *   Starter      → "Not included on Starter — upgrade" + [Upgrade]
 *   Growth       → "X of 20 requests left this month" + [Submit an edit]
 *   Pro          → "Unlimited (fair use)" + [Submit an edit]
 *   Legacy paid  → treated as unlimited (grandfathered)
 *
 * Growth/Pro states link to /dashboard/[tenantId] where the actual form
 * lives. Starter + pre-claim open the plan picker via the parent's
 * `onCheckoutClick` callback.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileEdit, X, Check, Clock } from "lucide-react";
import { splitPlanKey, tierOf, TIERS } from "@/lib/plans";

interface PlanState {
  kind: "pre-claim" | "starter" | "growth" | "pro" | "legacy";
  cap?: number;
  used?: number;
  remaining?: number;
  exhausted?: boolean;
  softCapWarn?: boolean;
}

function derivePlanState({
  isPublished,
  planKey,
  editsUsedThisMonth,
}: {
  isPublished: boolean;
  planKey?: string;
  editsUsedThisMonth?: number;
}): PlanState {
  if (!isPublished) return { kind: "pre-claim" };
  const parts = splitPlanKey(planKey);
  if (!parts) return { kind: "legacy" };
  const tier = tierOf(parts.tier);
  const used = editsUsedThisMonth ?? 0;
  if (parts.tier === "starter") return { kind: "starter" };
  if (parts.tier === "growth") {
    const cap = tier.editsCap;
    const remaining = Math.max(0, cap - used);
    return { kind: "growth", cap, used, remaining, exhausted: remaining === 0 };
  }
  const soft = tier.fairUseSoftCap ?? Infinity;
  const hard = tier.fairUseHardCap ?? Infinity;
  return {
    kind: "pro",
    used,
    softCapWarn: used >= soft && used < hard,
    exhausted: used >= hard,
  };
}

export default function ChangeRequestsPanel({
  tenantId,
  isPublished,
  checkingOut,
  onCheckoutClick,
  planKey,
  editsUsedThisMonth,
}: {
  tenantId: string;
  isPublished: boolean;
  checkingOut: boolean;
  onCheckoutClick: () => void;
  planKey?: string;
  editsUsedThisMonth?: number;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const planState = useMemo(
    () => derivePlanState({ isPublished, planKey, editsUsedThisMonth }),
    [isPublished, planKey, editsUsedThisMonth],
  );

  const eyebrow = planState.kind === "pre-claim" ? "After you subscribe" : "Edits";
  const subtitle = triggerSubtitle(planState);

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {eyebrow}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-left transition-colors hover:border-slate-700 hover:bg-slate-900"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-300">
            <FileEdit className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">
              Need an edit?
            </span>
            <span className="mt-0.5 block text-xs text-slate-400">{subtitle}</span>
          </span>
        </button>
      </div>

      {open && (
        <EditModal
          tenantId={tenantId}
          checkingOut={checkingOut}
          onCheckoutClick={onCheckoutClick}
          onClose={close}
          planState={planState}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */

function triggerSubtitle(state: PlanState): string {
  switch (state.kind) {
    case "pre-claim":
      return "Wording, sections, layout — done for you";
    case "starter":
      return "Available on Growth and Pro";
    case "growth":
      return state.exhausted
        ? "0 of 20 left this month — resets on the 1st"
        : `${state.remaining} of ${state.cap} left this month`;
    case "pro":
      return state.exhausted
        ? "Fair-use ceiling reached this month"
        : "Unlimited (fair use)";
    case "legacy":
      return "Wording, sections, layout — done for you";
  }
}

/* -------------------------------------------------------------------------- */
/*  Modal — one unified copy for all edit types                                 */
/* -------------------------------------------------------------------------- */

const INCLUDED: string[] = [
  "Copy tweaks — headlines, service descriptions, FAQ answers",
  "Add or remove testimonials, FAQs, service items",
  "Swap or replace photos across the site",
  "Add new service pages or location pages",
  "Add new sections (promo band, extra gallery, before/after)",
  "Layout tweaks and colour or typography adjustments within your template",
];

const EXCLUDED: string[] = [
  "Custom code or bespoke features",
  "Third-party integrations (booking systems, chat widgets, CRMs)",
  "Brand identity or logo redesign",
  "Migrating to a different template",
];

function EditModal({
  tenantId,
  checkingOut,
  onCheckoutClick,
  onClose,
  planState,
}: {
  tenantId: string;
  checkingOut: boolean;
  onCheckoutClick: () => void;
  onClose: () => void;
  planState: PlanState;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const status = statusBadge(planState);
  const turnaround = turnaroundFor(planState);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Site edits"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0A0F1E] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/5 px-6 py-5">
          <div className="min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${status.bg} ${status.ring} ${status.text}`}
            >
              {status.label}
            </span>
            <h3 className="mt-2 text-lg font-bold text-white">
              Site edits, done for you
            </h3>
            <p className="mt-1 text-sm text-white/60">
              Send us a plain-English change request from your dashboard. We
              handle the update and publish it live — you don&apos;t touch code.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg border border-white/10 p-1.5 text-white/50 transition-colors hover:border-white/25 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                <Clock className="h-3.5 w-3.5" />
                Turnaround
              </div>
              <p className="mt-1 text-sm font-semibold text-white">{turnaround}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                {quotaLabel(planState)}
              </div>
              <p className={`mt-1 text-sm font-semibold ${quotaTint(planState)}`}>
                {quotaValue(planState)}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              What&apos;s included
            </h4>
            <ul className="mt-2 space-y-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-white/85">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Not included
            </h4>
            <ul className="mt-2 space-y-2">
              {EXCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-white/60">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-[11px] leading-relaxed text-white/70">
            <strong className="font-semibold text-white/90">Terms.</strong>{" "}
            Requests are submitted from your dashboard and must be
            plain-English, specific, and within the scope above. Turnarounds
            are measured from receipt during Australian business hours
            (Mon–Fri, 9am–5pm AEST) and exclude public holidays. Unused
            monthly requests do not roll over. Out-of-scope items may be
            quoted as separate work. We reserve the right to decline requests
            that infringe third-party rights, are misleading, or breach our
            acceptable-use policy.
          </div>
        </div>

        <div className="border-t border-white/5 bg-white/[0.02] px-6 py-4">
          <Cta
            planState={planState}
            tenantId={tenantId}
            checkingOut={checkingOut}
            onCheckoutClick={onCheckoutClick}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function turnaroundFor(state: PlanState): string {
  switch (state.kind) {
    case "pro":
      return "Priority — same-day for most edits";
    case "growth":
    case "legacy":
      return "Within 2 business days";
    case "starter":
      return "N/A on Starter";
    case "pre-claim":
      return "Within 2 business days";
  }
}

function statusBadge(state: PlanState): { label: string; bg: string; ring: string; text: string } {
  const growthPlus = TIERS.filter((t) => t.editsCap > 0)
    .map((t) => t.name)
    .join(" and ");
  switch (state.kind) {
    case "pre-claim":
      return {
        label: `Included on ${growthPlus} plans`,
        bg: "bg-blue-500/10",
        ring: "border-blue-500/30",
        text: "text-blue-300",
      };
    case "starter":
      return {
        label: "Not included on Starter",
        bg: "bg-amber-500/10",
        ring: "border-amber-500/30",
        text: "text-amber-300",
      };
    case "growth":
      return state.exhausted
        ? {
            label: "Cap reached this month",
            bg: "bg-amber-500/10",
            ring: "border-amber-500/30",
            text: "text-amber-300",
          }
        : {
            label: "Included with Growth",
            bg: "bg-emerald-500/10",
            ring: "border-emerald-500/30",
            text: "text-emerald-300",
          };
    case "pro":
      return state.exhausted
        ? {
            label: "Fair-use ceiling reached",
            bg: "bg-amber-500/10",
            ring: "border-amber-500/30",
            text: "text-amber-300",
          }
        : {
            label: state.softCapWarn ? "Fair-use — heads up" : "Included with Pro",
            bg: "bg-emerald-500/10",
            ring: "border-emerald-500/30",
            text: "text-emerald-300",
          };
    case "legacy":
      return {
        label: "Included with your plan",
        bg: "bg-emerald-500/10",
        ring: "border-emerald-500/30",
        text: "text-emerald-300",
      };
  }
}

function quotaLabel(state: PlanState): string {
  switch (state.kind) {
    case "growth":
      return "Remaining this month";
    case "pro":
      return "Monthly usage";
    case "starter":
    case "pre-claim":
      return "Included from";
    case "legacy":
      return "Monthly cap";
  }
}

function quotaValue(state: PlanState): string {
  switch (state.kind) {
    case "growth":
      return `${state.remaining} of ${state.cap}`;
    case "pro":
      return `${state.used ?? 0} this month`;
    case "starter":
    case "pre-claim":
      return "Growth and Pro plans";
    case "legacy":
      return "Unlimited";
  }
}

function quotaTint(state: PlanState): string {
  if (state.kind === "growth" && state.exhausted) return "text-amber-300";
  if (state.kind === "pro" && state.exhausted) return "text-amber-300";
  return "text-white";
}

function Cta({
  planState,
  tenantId,
  checkingOut,
  onCheckoutClick,
  onClose,
}: {
  planState: PlanState;
  tenantId: string;
  checkingOut: boolean;
  onCheckoutClick: () => void;
  onClose: () => void;
}) {
  if (planState.kind === "growth" || planState.kind === "pro" || planState.kind === "legacy") {
    const disabled = planState.exhausted && planState.kind !== "legacy";
    return (
      <>
        <Link
          href={`/dashboard/${tenantId}`}
          onClick={onClose}
          className={`flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-bold transition-colors ${
            disabled
              ? "cursor-not-allowed bg-white/20 text-white/50"
              : "bg-white text-slate-900 hover:bg-white/90"
          }`}
          aria-disabled={disabled}
        >
          {disabled ? "Cap reached — see dashboard" : "Submit an edit"}
        </Link>
        <p className="mt-2 text-center text-[11px] text-white/40">
          {planState.kind === "growth" && !planState.exhausted && `${planState.remaining} of ${planState.cap} edits left · resets on the 1st`}
          {planState.kind === "growth" && planState.exhausted && "Your quota resets on the 1st of next month."}
          {planState.kind === "pro" && planState.softCapWarn && "You're above the fair-use soft cap. We may follow up on very heavy usage."}
          {planState.kind === "pro" && planState.exhausted && "You've reached the fair-use ceiling for this month."}
          {planState.kind === "pro" && !planState.softCapWarn && !planState.exhausted && "Unlimited within fair use — resets on the 1st."}
          {planState.kind === "legacy" && "Submit edits from your dashboard."}
        </p>
      </>
    );
  }

  const label = planState.kind === "starter" ? "Upgrade to Growth or Pro" : "Choose a plan";
  return (
    <>
      <button
        type="button"
        disabled={checkingOut}
        onClick={() => {
          onClose();
          onCheckoutClick();
        }}
        className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
      >
        {checkingOut ? "Opening plans…" : label}
      </button>
      <p className="mt-2 text-center text-[11px] text-white/40">
        Secure checkout via Stripe. Cancel anytime.
      </p>
    </>
  );
}
