"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Share2, X, Lock, ChevronDown, Smartphone, Monitor, LayoutDashboard, CheckCircle2 } from "lucide-react";
import CustomisePanel, { type CustomisationState } from "@/app/components/CustomisePanel";
import { derivePrimary, deriveSecondary } from "@/lib/color";

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

function getBusinessName(): string {
  if (typeof window === "undefined") return "Your Business";
  try {
    return localStorage.getItem("preview_business_name") ?? "Your Business";
  } catch {
    return "Your Business";
  }
}

/* -------------------------------------------------------------------------- */
/*  Toast                                                                       */
/* -------------------------------------------------------------------------- */

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-slate-700 text-white text-sm font-medium shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300 flex items-center gap-3 whitespace-nowrap">
      {message}
      <button type="button" onClick={onClose}>
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Countdown box — changes appearance when urgent                              */
/* -------------------------------------------------------------------------- */

function CountdownBox({ timeLeft, urgency }: { timeLeft: number; urgency: boolean }) {
  const label = formatCountdown(timeLeft);
  return (
    <div
      className={`flex flex-col items-center px-4 py-2 rounded-xl transition-colors ${
        urgency
          ? "bg-red-950/80 border border-red-800"
          : "bg-slate-800/80 border border-slate-700"
      }`}
    >
      <span
        className={`text-xl font-black font-mono tabular-nums tracking-tight ${
          urgency ? "text-red-400" : "text-slate-200"
        }`}
      >
        {label}
      </span>
      <span className={`text-xs font-medium mt-0.5 ${urgency ? "text-red-500" : "text-slate-500"}`}>
        {urgency ? "Expiring soon!" : "preview expires"}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Inner component                                                             */
/* -------------------------------------------------------------------------- */

function PreviewPageInner() {
  const params = useParams();
  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : "unknown";

  const expiryRef = useRef<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(PREVIEW_DURATION_MS);
  const [toast, setToast] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [businessName, setBusinessName] = useState("Your Business");
  const [viewMode, setViewMode] = useState<"mobile" | "desktop">("mobile");
  /** When the tenant has already been claimed/published, hide the 3h
   *  countdown urgency + "Save my site" checkout button and show a
   *  "back to dashboard" affordance instead. Fetched once on mount. */
  const [isPublished, setIsPublished] = useState(false);

  // Customisation state. Initial values come from /api/tenants/[id]/customise.
  const [customisation, setCustomisation] = useState<CustomisationState | null>(null);
  const [niche, setNiche] = useState<string>("");
  const mobileIframeRef = useRef<HTMLIFrameElement>(null);
  const desktopIframeRef = useRef<HTMLIFrameElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch initial customisation state on mount.
  useEffect(() => {
    if (!id || id === "unknown") return;
    (async () => {
      try {
        const res = await fetch(`/api/tenants/${id}/customise`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          primary_color: string;
          accent_color: string;
          logo_url: string;
          hero_image_url: string;
          chrome_theme: "light" | "dark";
          logo_height_px: number;
          niche: string;
        };
        setCustomisation({
          // Brand colour drives accents only — load it from the accent slot.
          brandColor: data.accent_color || data.primary_color,
          chromeTheme: data.chrome_theme ?? "light",
          logoUrl: data.logo_url,
          logoHeightPx: data.logo_height_px ?? 36,
          heroUrl: data.hero_image_url,
        });
        setNiche(data.niche);
      } catch {
        // Panel just won't render until state loads.
      }
    })();
  }, [id]);

  /** Push the latest customisation into both iframes (whichever is mounted). */
  const broadcast = useCallback((payload: { primary?: string; secondary?: string; accent?: string; chromeTheme?: "light" | "dark"; logoUrl?: string; logoHeightPx?: number; heroUrl?: string }) => {
    for (const ref of [mobileIframeRef, desktopIframeRef]) {
      const win = ref.current?.contentWindow;
      if (win) win.postMessage({ type: "apply-customisation", payload }, "*");
    }
  }, []);

  /** Debounced persist to backend. */
  const scheduleSave = useCallback((body: Record<string, string | number>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/tenants/${id}/customise`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        // Silent — next change will retry.
      }
    }, 800);
  }, [id]);

  const handleBrandColorChange = useCallback((hex: string) => {
    // Brand picker drives a monochromatic palette: accent = user pick;
    // primary = same hue, much darker (for headings/icons); secondary = same
    // hue, mid lightness (for hero overlay and offer band).
    const primary = derivePrimary(hex);
    const secondary = deriveSecondary(hex);
    setCustomisation((c) => c && { ...c, brandColor: hex });
    broadcast({ accent: hex, primary, secondary });
    scheduleSave({ accent_color: hex, primary_color: primary, secondary_color: secondary });
  }, [broadcast, scheduleSave]);

  const handleLogoChange = useCallback((url: string) => {
    setCustomisation((c) => c && { ...c, logoUrl: url });
    broadcast({ logoUrl: url });
    scheduleSave({ logo_url: url });
  }, [broadcast, scheduleSave]);

  const handleHeroChange = useCallback((url: string) => {
    setCustomisation((c) => c && { ...c, heroUrl: url });
    broadcast({ heroUrl: url });
    scheduleSave({ hero_image_url: url });
  }, [broadcast, scheduleSave]);

  const handleChromeThemeChange = useCallback((theme: "light" | "dark") => {
    setCustomisation((c) => c && { ...c, chromeTheme: theme });
    broadcast({ chromeTheme: theme });
    scheduleSave({ chrome_theme: theme });
  }, [broadcast, scheduleSave]);

  const handleLogoHeightChange = useCallback((px: number) => {
    setCustomisation((c) => c && { ...c, logoHeightPx: px });
    broadcast({ logoHeightPx: px });
    scheduleSave({ logo_height_px: px });
  }, [broadcast, scheduleSave]);

  const handleGalleryChange = useCallback((urls: string[]) => {
    // Gallery is already persisted by the /api/.../gallery endpoint the panel
    // called — we just need to mirror it into the live iframe.
    for (const ref of [mobileIframeRef, desktopIframeRef]) {
      const win = ref.current?.contentWindow;
      if (win) win.postMessage({ type: "apply-customisation", payload: { galleryUrls: urls } }, "*");
    }
  }, []);

  useEffect(() => {
    expiryRef.current = getExpiryTimestamp(id);
    setTimeLeft(Math.max(0, expiryRef.current - Date.now()));
    setBusinessName(getBusinessName());
  }, [id]);

  // Detect whether this tenant has already been published so we can swap
  // the countdown/checkout for an "editing your live site" affordance.
  useEffect(() => {
    if (!id || id === "unknown") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tenants/${id}/status`);
        if (!res.ok) return;
        const body = (await res.json()) as { status?: string };
        if (!cancelled && (body.status === "claimed" || body.status === "past_due")) {
          setIsPublished(true);
        }
      } catch {
        // Non-fatal — page still renders as a pre-checkout preview.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, expiryRef.current - Date.now());
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const [checkingOut, setCheckingOut] = useState(false);

  async function handleSave() {
    if (checkingOut) return;
    setCheckingOut(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: id }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setToast(err.error ?? "Checkout failed. Please try again.");
        return;
      }
      const data = (await res.json()) as { checkoutUrl: string };
      window.location.href = data.checkoutUrl;
    } catch {
      setToast("Could not start checkout. Check your connection.");
    } finally {
      setCheckingOut(false);
    }
  }

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
        // User cancelled
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

  // Point the iframe at the per-tenant universal renderer.
  // Falls back to the trades example if the id looks like a static category slug.
  const iframeSrc = `/preview/site/${id}`;
  const urgency = timeLeft < 30 * 60 * 1000;

  /* ---------------------------------------------------------------------- */
  /*  Mobile layout                                                            */
  /* ---------------------------------------------------------------------- */

  const mobileLayout = (
    <div className="md:hidden flex flex-col h-screen bg-slate-950">
      {/* Slim top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/95 border-b border-slate-800 z-10 backdrop-blur shrink-0">
        {isPublished ? (
          <div className="flex items-center gap-1.5 text-sm font-semibold text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Editing your live site
          </div>
        ) : (
          <div className={`text-sm font-mono font-bold ${urgency ? "text-red-400" : "text-slate-300"}`}>
            {urgency ? "⚠ " : ""}Expires {formatCountdown(timeLeft)}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-medium"
          >
            Customise
            <ChevronDown className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Fullscreen iframe */}
      <div className="flex-1 relative overflow-hidden">
        <iframe
          ref={mobileIframeRef}
          src={iframeSrc}
          title="Your website preview"
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>

      {/* Sticky bottom CTA — gradient bg */}
      <div className="shrink-0 px-4 pb-6 pt-8 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
        {isPublished ? (
          <Link
            href={`/dashboard/${id}`}
            className="flex w-full items-center justify-center gap-2 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-base transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Back to dashboard
          </Link>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={checkingOut}
              className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 text-white font-bold text-base shadow-lg shadow-blue-900/40 transition-colors"
            >
              {checkingOut ? "Taking you to checkout…" : <>Save my site &mdash; $49/mo<span className="ml-2 line-through text-blue-300 font-normal text-sm">$149</span></>}
            </button>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <Lock className="w-3 h-3 text-slate-500" />
              <p className="text-center text-xs text-slate-500">
                Secure checkout via Stripe
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );

  /* ---------------------------------------------------------------------- */
  /*  Desktop layout                                                          */
  /* ---------------------------------------------------------------------- */

  const desktopLayout = (
    <div className="hidden md:flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-4">
          <div className="text-base font-bold text-white">Preview Factory</div>
          <div className="hidden lg:block h-4 w-px bg-slate-700" />
          <div className="hidden lg:block text-sm text-slate-400">
            {businessName}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Viewport toggle: mobile phone mockup vs full-width desktop */}
          <div className="flex items-center rounded-xl border border-slate-700 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("mobile")}
              aria-pressed={viewMode === "mobile"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === "mobile"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mobile
            </button>
            <button
              type="button"
              onClick={() => setViewMode("desktop")}
              aria-pressed={viewMode === "desktop"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === "desktop"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Desktop
            </button>
          </div>
          {isPublished ? (
            <>
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-green-500/20 bg-green-900/10 text-sm font-semibold text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Editing your live site
              </div>
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
              <Link
                href={`/dashboard/${id}`}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                Back to dashboard
              </Link>
            </>
          ) : (
            <>
              <CountdownBox timeLeft={timeLeft} urgency={urgency} />
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 text-sm font-medium transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
              <div className="flex flex-col items-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={checkingOut}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold transition-colors shadow-lg shadow-blue-900/30"
                >
                  {checkingOut ? "Taking you to checkout…" : <>Save my site &mdash; $49/mo<span className="line-through text-blue-300 font-normal text-xs ml-1">$149</span></>}
                </button>
                <div className="flex items-center gap-1 mt-1">
                  <Lock className="w-3 h-3 text-slate-600" />
                  <span className="text-xs text-slate-600">Secure checkout via Stripe</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden gap-6 px-8 py-6">
        {/* Preview area — phone mockup or desktop frame depending on toggle */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 min-w-0">
          {/* Above-preview label */}
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
              This is your new website
            </p>
            <p className="text-lg font-bold text-white">{businessName}</p>
          </div>

          {viewMode === "mobile" ? (
            <>
              {/* Phone frame */}
              <div
                className="relative bg-slate-800 rounded-[3rem] border-[6px] border-slate-700 shadow-2xl overflow-hidden"
                style={{ width: "340px", height: "680px" }}
              >
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-6 bg-slate-800 rounded-b-2xl z-10" />
                {/* Status bar */}
                <div className="absolute top-0 left-0 right-0 h-7 bg-slate-800/80 z-10" />
                {/* Iframe */}
                <iframe
                  ref={desktopIframeRef}
                  src={iframeSrc}
                  title="Your website preview"
                  className="absolute inset-0 w-full h-full border-0"
                />
              </div>
              {/* Home indicator */}
              <div className="w-28 h-1.5 rounded-full bg-slate-700" />
            </>
          ) : (
            /* Desktop frame — browser chrome + full-width iframe */
            <div className="w-full max-w-5xl flex-1 flex flex-col bg-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border-b border-slate-700 shrink-0">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="ml-3 flex-1 px-3 py-1 rounded-md bg-slate-900/60 text-xs text-slate-400 font-mono truncate">
                  {businessName.toLowerCase().replace(/\s+/g, "")}.com.au
                </div>
              </div>
              {/* Iframe */}
              <iframe
                ref={desktopIframeRef}
                src={iframeSrc}
                title="Your website preview"
                className="flex-1 w-full border-0 bg-white"
              />
            </div>
          )}
        </div>

        {/* Customise panel */}
        <div className="w-80 shrink-0 overflow-y-auto">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white">Make it yours</h2>
            <p className="text-slate-400 text-sm mt-1">
              {isPublished
                ? "Changes save automatically to your live site."
                : urgency
                ? `Preview expires in ${formatCountdown(timeLeft)} — save now to keep it.`
                : "Your preview is active. Customise then save."}
            </p>
          </div>
          {customisation ? (
            <CustomisePanel
              tenantId={id}
              state={customisation}
              defaultPexelsQuery={niche}
              onBrandColorChange={handleBrandColorChange}
              onChromeThemeChange={handleChromeThemeChange}
              onLogoHeightChange={handleLogoHeightChange}
              onLogoChange={handleLogoChange}
              onHeroChange={handleHeroChange}
              onGalleryChange={handleGalleryChange}
            />
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
              Loading customisation…
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ---------------------------------------------------------------------- */
  /*  Mobile customise panel slide-up                                         */
  /* ---------------------------------------------------------------------- */
  const mobilePanelToggle = panelOpen ? (
    <div className="md:hidden fixed inset-0 z-40 flex flex-col">
      <div
        className="flex-1 bg-black/60 backdrop-blur-sm"
        onClick={() => setPanelOpen(false)}
      />
      <div className="bg-slate-950 border-t border-slate-800 max-h-[75vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <h2 className="text-base font-bold text-white">Make it yours</h2>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          {customisation ? (
            <CustomisePanel
              tenantId={id}
              state={customisation}
              defaultPexelsQuery={niche}
              onBrandColorChange={handleBrandColorChange}
              onChromeThemeChange={handleChromeThemeChange}
              onLogoHeightChange={handleLogoHeightChange}
              onLogoChange={handleLogoChange}
              onHeroChange={handleHeroChange}
              onGalleryChange={handleGalleryChange}
            />
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
              Loading customisation…
            </div>
          )}
        </div>
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
          Loading your preview...
        </div>
      }
    >
      <PreviewPageInner />
    </Suspense>
  );
}
