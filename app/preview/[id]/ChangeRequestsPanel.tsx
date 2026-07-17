"use client";

/**
 * ChangeRequestsPanel
 *
 * Two small triggers rendered in the preview page's right rail (and mobile
 * slide-up). Each opens a modal explaining a request lane the customer gets
 * once subscribed:
 *
 *   - "Need content changes?"  → 3/month, 12h turnaround, small edits only
 *   - "Need custom changes?"   → 3/month, 3 business days, structural work
 *
 * The modals are informational; the CTA routes to the existing subscribe
 * flow (Stripe checkout) if the tenant hasn't claimed, or to the dashboard
 * (where the actual request form lives) if they have.
 *
 * Modal styling matches the existing pattern in
 * app/dashboard/[tenantId]/ui.tsx so the surface feels native.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileEdit, Wand2, X, Check, Clock } from "lucide-react";

type Lane = "content" | "custom";

export default function ChangeRequestsPanel({
  tenantId,
  isPublished,
  checkingOut,
  onCheckoutClick,
}: {
  tenantId: string;
  isPublished: boolean;
  checkingOut: boolean;
  onCheckoutClick: () => void;
}) {
  const [open, setOpen] = useState<Lane | null>(null);
  const close = useCallback(() => setOpen(null), []);

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          After you subscribe
        </p>
        <button
          type="button"
          onClick={() => setOpen("content")}
          className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-left transition-colors hover:border-slate-700 hover:bg-slate-900"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-300">
            <FileEdit className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">
              Need content changes?
            </span>
            <span className="mt-0.5 block text-xs text-slate-400">
              Wording, hours, photos — done in 12 hours
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOpen("custom")}
          className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-left transition-colors hover:border-slate-700 hover:bg-slate-900"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-300">
            <Wand2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">
              Need custom changes?
            </span>
            <span className="mt-0.5 block text-xs text-slate-400">
              New sections, layout tweaks — 3 business days
            </span>
          </span>
        </button>
      </div>

      {open === "content" && (
        <ChangeModal
          lane="content"
          tenantId={tenantId}
          isPublished={isPublished}
          checkingOut={checkingOut}
          onCheckoutClick={onCheckoutClick}
          onClose={close}
        />
      )}
      {open === "custom" && (
        <ChangeModal
          lane="custom"
          tenantId={tenantId}
          isPublished={isPublished}
          checkingOut={checkingOut}
          onCheckoutClick={onCheckoutClick}
          onClose={close}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */

interface LaneCopy {
  title: string;
  eyebrow: string;
  headline: string;
  sub: string;
  included: string[];
  excluded: string[];
  cap: string;
  turnaround: string;
  accent: "blue" | "violet";
}

const COPY: Record<Lane, LaneCopy> = {
  content: {
    title: "Content changes",
    eyebrow: "Included with your subscription",
    headline: "Small edits, done for you within 12 hours",
    sub: "Send us plain-English change requests from your dashboard. We handle the update and publish it live — you don’t touch code.",
    included: [
      "Wording tweaks (headlines, service descriptions, FAQ answers)",
      "Business info: hours, phone, address, ABN, email",
      "Swap or replace individual photos",
      "Add or remove a testimonial, FAQ, or single service item",
    ],
    excluded: [
      "New sections or extra pages (see “Custom changes” instead)",
      "Layout, colour or typography changes",
      "Third-party integrations or embeds",
    ],
    cap: "3 requests per calendar month",
    turnaround: "Within 12 hours during AU business hours",
    accent: "blue",
  },
  custom: {
    title: "Custom changes",
    eyebrow: "Included with your subscription",
    headline: "Structural work that stays within your template",
    sub: "For bigger jobs — new pages, extra sections, layout tweaks. Same plain-English request from your dashboard.",
    included: [
      "Add a new service page or location page",
      "Add a new section (e.g. promo band, extra gallery, before/after strip)",
      "Layout adjustments within your existing template",
      "Colour or typography tweaks beyond the preset options",
    ],
    excluded: [
      "Custom code or bespoke features",
      "Third-party integrations (booking systems, chat widgets, CRMs)",
      "Brand identity or logo redesign",
      "Migrating to a different template",
    ],
    cap: "3 requests per calendar month",
    turnaround: "3 business days",
    accent: "violet",
  },
};

function ChangeModal({
  lane,
  tenantId,
  isPublished,
  checkingOut,
  onCheckoutClick,
  onClose,
}: {
  lane: Lane;
  tenantId: string;
  isPublished: boolean;
  checkingOut: boolean;
  onCheckoutClick: () => void;
  onClose: () => void;
}) {
  const copy = COPY[lane];

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

  const accentText =
    copy.accent === "blue" ? "text-blue-300" : "text-violet-300";
  const accentBg =
    copy.accent === "blue" ? "bg-blue-500/10" : "bg-violet-500/10";
  const accentRing =
    copy.accent === "blue" ? "border-blue-500/30" : "border-violet-500/30";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
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
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${accentBg} ${accentRing} ${accentText}`}
            >
              {copy.eyebrow}
            </span>
            <h3 className="mt-2 text-lg font-bold text-white">{copy.headline}</h3>
            <p className="mt-1 text-sm text-white/60">{copy.sub}</p>
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
              <p className="mt-1 text-sm font-semibold text-white">
                {copy.turnaround}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                Monthly cap
              </div>
              <p className="mt-1 text-sm font-semibold text-white">{copy.cap}</p>
            </div>
          </div>

          <div className="mt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              What&apos;s included
            </h4>
            <ul className="mt-2 space-y-2">
              {copy.included.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-white/85">
                  <Check className={`mt-0.5 h-4 w-4 shrink-0 ${accentText}`} />
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
              {copy.excluded.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-white/60">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] leading-relaxed text-white/50">
            <strong className="font-semibold text-white/75">Terms.</strong>{" "}
            Requests are submitted from your dashboard and must be plain-English,
            specific, and within the scope above. Turnarounds are measured from
            receipt during Australian business hours (Mon–Fri, 9am–5pm AEST) and
            exclude public holidays. Unused monthly requests do not roll over.
            Out-of-scope items may be quoted as separate work. Fair-use limit of
            10 requests per tenant per day applies across both lanes. We reserve
            the right to decline requests that infringe third-party rights, are
            misleading, or breach our acceptable-use policy.
          </div>
        </div>

        <div className="border-t border-white/5 bg-white/[0.02] px-6 py-4">
          {isPublished ? (
            <Link
              href={`/dashboard/${tenantId}`}
              className="flex w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition-colors hover:bg-white/90"
              onClick={onClose}
            >
              Go to your dashboard
            </Link>
          ) : (
            <button
              type="button"
              disabled={checkingOut}
              onClick={() => {
                onClose();
                onCheckoutClick();
              }}
              className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
            >
              {checkingOut ? "Taking you to checkout…" : "Subscribe to unlock — $49/mo"}
            </button>
          )}
          <p className="mt-2 text-center text-[11px] text-white/40">
            {isPublished
              ? "Submit change requests from your dashboard."
              : "Secure checkout via Stripe. Cancel anytime."}
          </p>
        </div>
      </div>
    </div>
  );
}
