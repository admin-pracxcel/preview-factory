"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useParams } from "next/navigation";
import { Share2, X } from "lucide-react";
import CustomisePanel from "@/app/components/CustomisePanel";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                   */
/* -------------------------------------------------------------------------- */

const PREVIEW_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function getExpiryTimestamp(id: string): number {
  const key = `preview_expiry_${id}`;
  if (typeof window === "undefined") return Date.now() + PREVIEW_DURATION_MS;
  const stored = localStorage.getItem(key);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed)) return parsed;
  }
  const expiry = Date.now() + PREVIEW_DURATION_MS;
  localStorage.setItem(key, String(expiry));
  return expiry;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/*  Toast component                                                             */
/* -------------------------------------------------------------------------- */

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-slate-700 text-white text-sm font-medium shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300 flex items-center gap-3">
      {message}
      <button type="button" onClick={onClose}>
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Inner component                                                             */
/* -------------------------------------------------------------------------- */

function PreviewPageInner() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "unknown";

  const expiryRef = useRef<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(PREVIEW_DURATION_MS);
  const [toast, setToast] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Initialise expiry from localStorage (must be client-side)
  useEffect(() => {
    expiryRef.current = getExpiryTimestamp(id);
    setTimeLeft(Math.max(0, expiryRef.current - Date.now()));
  }, [id]);

  // Countdown tick
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, expiryRef.current - Date.now());
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  /* ---- Save / Stripe stub ---- */
  function handleSave() {
    console.log("Save my site clicked for preview:", id);
    alert("Redirecting to Stripe... (stub)");
  }

  /* ---- Share ---- */
  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Check out my new website!",
          text: "I just built a website in under 60 seconds. Take a look:",
          url,
        });
      } catch {
        // User cancelled share — no-op
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setToast("Link copied to clipboard.");
      } catch {
        setToast("Copy this link: " + url);
      }
    }
  }

  /* ---- Preview iframe URL ---- */
  const iframeSrc = "/preview/trades";

  const countdownLabel = formatCountdown(timeLeft);
  const urgency = timeLeft < 30 * 60 * 1000; // under 30 min

  /* ---------------------------------------------------------------------- */
  /*  Mobile layout (< md)                                                    */
  /* ---------------------------------------------------------------------- */

  const mobileLayout = (
    <div className="md:hidden flex flex-col h-screen bg-slate-950">
      {/* Slim top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/95 border-b border-slate-800 z-10 backdrop-blur shrink-0">
        <div className={`text-sm font-mono font-semibold ${urgency ? "text-red-400" : "text-slate-300"}`}>
          Expires in {countdownLabel}
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Fullscreen iframe */}
      <div className="flex-1 relative overflow-hidden">
        <iframe
          src={iframeSrc}
          title="Your website preview"
          className="absolute inset-0 w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-top-navigation"
        />
      </div>

      {/* Sticky bottom CTA */}
      <div className="shrink-0 px-4 pb-5 pt-3 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-base shadow-lg shadow-blue-900/30 transition-colors"
        >
          Save my site — $49/mo
        </button>
        <p className="text-center text-xs text-slate-500 mt-2">
          No credit card needed to preview
        </p>
      </div>
    </div>
  );

  /* ---------------------------------------------------------------------- */
  /*  Desktop layout (md+)                                                    */
  /* ---------------------------------------------------------------------- */

  const desktopLayout = (
    <div className="hidden md:flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-800 shrink-0">
        <div className="text-base font-semibold text-white">Preview Factory</div>
        <div className="flex items-center gap-4">
          <span className={`text-sm font-mono font-semibold ${urgency ? "text-red-400" : "text-slate-400"}`}>
            Expires in {countdownLabel}
          </span>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-900/30"
          >
            Save my site — $49/mo
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden gap-8 px-8 py-8">
        {/* Phone mockup */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative flex flex-col items-center">
            {/* Phone frame */}
            <div
              className="relative bg-slate-800 rounded-[3rem] border-[6px] border-slate-700 shadow-2xl overflow-hidden"
              style={{ width: "360px", height: "720px" }}
            >
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-800 rounded-b-2xl z-10" />
              {/* Status bar */}
              <div className="absolute top-0 left-0 right-0 h-8 bg-slate-800/80 z-10" />
              {/* Iframe */}
              <iframe
                src={iframeSrc}
                title="Your website preview"
                className="absolute inset-0 w-full h-full border-0"
                style={{ marginTop: "0px" }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-top-navigation"
              />
            </div>
            {/* Bottom pill */}
            <div className="mt-4 w-32 h-1.5 rounded-full bg-slate-700" />
          </div>
        </div>

        {/* Customise panel — toggle on mobile, always visible on desktop */}
        <div className="w-80 shrink-0 overflow-y-auto">
          <CustomisePanel />
        </div>
      </div>
    </div>
  );

  /* ---------------------------------------------------------------------- */
  /*  Mobile customise panel toggle (visible only on mobile)                 */
  /* ---------------------------------------------------------------------- */
  const mobilePanelToggle = panelOpen ? (
    <div className="md:hidden fixed inset-0 z-40 flex flex-col">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setPanelOpen(false)} />
      <div className="bg-slate-950 border-t border-slate-800 max-h-[70vh] overflow-y-auto p-4">
        <button
          type="button"
          onClick={() => setPanelOpen(false)}
          className="mb-3 text-slate-400 flex items-center gap-1 text-sm"
        >
          <X className="w-4 h-4" /> Close
        </button>
        <CustomisePanel />
      </div>
    </div>
  ) : null;

  return (
    <>
      {mobileLayout}
      {desktopLayout}
      {mobilePanelToggle}
      {toast && <Toast message={toast} onClose={dismissToast} />}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Export                                                                      */
/* -------------------------------------------------------------------------- */

export default function PreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center min-h-screen bg-slate-950 text-white">
          Loading preview...
        </div>
      }
    >
      <PreviewPageInner />
    </Suspense>
  );
}
