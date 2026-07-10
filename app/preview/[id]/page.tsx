"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Share2, X, Lock, ChevronDown, Smartphone, Monitor, LayoutDashboard, CheckCircle2 } from "lucide-react";
import CustomisePanel, { type CustomisationState } from "@/app/components/CustomisePanel";
import BusinessDetailsSection, { type BusinessDetailsInitial } from "@/app/components/BusinessDetailsSection";
import ImagePickerModal from "@/app/components/ImagePickerModal";
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
  const [viewMode, setViewMode] = useState<"mobile" | "desktop">("desktop");
  /** When the tenant has already been claimed/published, hide the 3h
   *  countdown urgency + "Save my site" checkout button and show a
   *  "back to dashboard" affordance instead. Fetched once on mount. */
  const [isPublished, setIsPublished] = useState(false);
  /** Real public host of this tenant — a custom domain if one is active,
   *  otherwise the launcharoo subdomain. Populated by the /status fetch. */
  const [publicHost, setPublicHost] = useState<string | null>(null);
  /** Phone/email/address — hydrated from GET /api/tenants/[id]/contact. */
  const [businessDetails, setBusinessDetails] =
    useState<BusinessDetailsInitial | null>(null);
  /** Non-null path → ImagePickerModal is open editing that image slot.
   *  Set by an `edit-image` postMessage from the iframe (hover overlay). */
  const [editingImagePath, setEditingImagePath] = useState<string | null>(null);

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

  useEffect(() => {
    expiryRef.current = getExpiryTimestamp(id);
    setTimeLeft(Math.max(0, expiryRef.current - Date.now()));
    setBusinessName(getBusinessName());
  }, [id]);

  // Detect whether this tenant has already been published, and pick up the
  // real public host so the desktop browser chrome shows the actual URL.
  useEffect(() => {
    if (!id || id === "unknown") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tenants/${id}/status`);
        if (!res.ok) return;
        const body = (await res.json()) as {
          status?: string;
          slug?: string;
          customDomain?: string;
          customDomainStatus?: string;
        };
        if (cancelled) return;
        if (body.status === "claimed" || body.status === "past_due") {
          setIsPublished(true);
        }
        const host =
          body.customDomain && body.customDomainStatus === "active"
            ? body.customDomain
            : body.slug
            ? `${body.slug}.launcharoo.online`
            : null;
        if (host) setPublicHost(host);
      } catch {
        // Non-fatal — page still renders as a pre-checkout preview.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Hydrate the Business details form with the current phone/email/address.
  useEffect(() => {
    if (!id || id === "unknown") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tenants/${id}/contact`);
        if (!res.ok) return;
        const body = (await res.json()) as BusinessDetailsInitial;
        if (!cancelled) setBusinessDetails(body);
      } catch {
        // Non-fatal — section just stays hidden until it loads.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Business details save doesn't have a live postMessage channel yet — the
  // simplest way to reflect a new phone/email/address in the preview is to
  // reload the iframe once. Templates re-render server-side with fresh
  // siteProps and the change is visible.
  const reloadPreviewIframes = useCallback(() => {
    for (const ref of [mobileIframeRef, desktopIframeRef]) {
      const win = ref.current?.contentWindow;
      if (win) {
        try {
          win.location.reload();
        } catch {
          // Some browsers refuse cross-origin reload — fall back to src reset.
          const el = ref.current;
          if (el) el.src = el.src;
        }
      }
    }
  }, []);

  const handleBusinessDetailsSaved = useCallback(
    (next: BusinessDetailsInitial) => {
      setBusinessDetails(next);
      reloadPreviewIframes();
    },
    [reloadPreviewIframes],
  );

  // Iframe → parent: the click-to-swap overlay inside a tenant page fires
  // { type: "edit-image", path } when the owner clicks a Replace pill. We
  // pop the ImagePickerModal for that slot.
  useEffect(() => {
    function handle(event: MessageEvent) {
      const data = event.data as { type?: string; path?: string };
      if (data?.type === "edit-image" && typeof data.path === "string") {
        setEditingImagePath(data.path);
      }
    }
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, []);

  const handleImagePicked = useCallback(
    async (url: string) => {
      if (!editingImagePath) return;
      try {
        const res = await fetch(`/api/tenants/${id}/image`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: editingImagePath, url }),
        });
        if (!res.ok) {
          // Modal stays open with no error surface for now; PATCH failures
          // are rare and the underlying endpoint returns 400/403/409 with
          // messages we could bubble up in a follow-up.
          console.error("[preview] image save failed", await res.text());
          return;
        }
        setEditingImagePath(null);
        reloadPreviewIframes();
      } catch (err) {
        console.error("[preview] image save error", err);
      }
    },
    [editingImagePath, id, reloadPreviewIframes],
  );

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

  const brandGlow = customisation?.brandColor ?? "#334155";
  const displayHost =
    publicHost ??
    (
      (businessName || "your-business")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") + ".launcharoo.online"
    );

  const viewportToggle = (
    <div className="flex items-center rounded-full border border-slate-700/70 bg-slate-950/70 p-1 shrink-0">
      <button
        type="button"
        onClick={() => setViewMode("desktop")}
        aria-pressed={viewMode === "desktop"}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
          viewMode === "desktop"
            ? "bg-white text-slate-900"
            : "text-slate-400 hover:text-white"
        }`}
      >
        <Monitor className="w-3.5 h-3.5" />
        Desktop
      </button>
      <button
        type="button"
        onClick={() => setViewMode("mobile")}
        aria-pressed={viewMode === "mobile"}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
          viewMode === "mobile"
            ? "bg-white text-slate-900"
            : "text-slate-400 hover:text-white"
        }`}
      >
        <Smartphone className="w-3.5 h-3.5" />
        Mobile
      </button>
    </div>
  );

  const desktopLayout = (
    <div className="hidden md:flex flex-col h-screen bg-[#0A0F1E] overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-3.5 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base font-bold text-white shrink-0">Launcharoo</span>
          <span className="hidden lg:block h-4 w-px bg-slate-700/60 shrink-0" />
          <span className="hidden lg:block text-sm text-slate-400 truncate max-w-[260px]">
            {businessName}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {viewportToggle}
          {isPublished ? (
            <>
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-700/70 text-slate-300 hover:text-white hover:border-slate-500 hover:bg-slate-800/60 text-sm font-medium transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
              <Link
                href={`/dashboard/${id}`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-900 hover:bg-slate-100 text-sm font-semibold transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <CountdownBox timeLeft={timeLeft} urgency={urgency} />
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-700/70 text-slate-300 hover:text-white hover:border-slate-500 hover:bg-slate-800/60 text-sm font-medium transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
              <div className="flex flex-col items-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={checkingOut}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold transition-colors shadow-lg shadow-blue-900/30"
                >
                  {checkingOut ? "Taking you to checkout…" : <>Save my site &mdash; $49/mo<span className="line-through text-blue-300 font-normal text-xs ml-1">$149</span></>}
                </button>
                <div className="flex items-center gap-1 mt-1">
                  <Lock className="w-3 h-3 text-slate-600" />
                  <span className="text-[11px] text-slate-600">Secure checkout via Stripe</span>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Preview column */}
        <div className="flex-1 relative min-w-0 overflow-hidden">
          {/* Brand-tinted radial glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-25 transition-opacity duration-500"
            style={{
              background: `radial-gradient(60% 55% at 50% 40%, ${brandGlow} 0%, transparent 65%)`,
            }}
          />
          {/* Subtle grid pattern */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative flex flex-col items-center justify-center h-full px-8 py-8 min-h-0">
            {viewMode === "mobile" ? (
              <>
                <div
                  className="relative bg-slate-950 rounded-[2.75rem] border-[6px] border-slate-800 overflow-hidden shrink-0"
                  style={{
                    width: "380px",
                    height: "min(780px, calc(100vh - 130px))",
                    boxShadow: `0 40px 80px -20px ${brandGlow}55, 0 20px 40px -10px rgba(0,0,0,0.5)`,
                  }}
                >
                  <iframe
                    ref={desktopIframeRef}
                    src={iframeSrc}
                    title="Your website preview"
                    className="absolute inset-0 w-full h-full border-0"
                  />
                </div>
                <div className="w-28 h-1 rounded-full bg-slate-700 shrink-0 mt-3" />
              </>
            ) : (
              <div
                className="w-full max-w-[1180px] h-full flex flex-col bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden"
                style={{
                  boxShadow: `0 40px 80px -20px ${brandGlow}55, 0 20px 40px -10px rgba(0,0,0,0.5)`,
                }}
              >
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border-b border-slate-700 shrink-0">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="ml-3 flex-1 px-3 py-1 rounded-md bg-slate-900/60 text-xs text-slate-400 font-mono truncate">
                    {displayHost}
                  </div>
                </div>
                <iframe
                  ref={desktopIframeRef}
                  src={iframeSrc}
                  title="Your website preview"
                  className="flex-1 w-full border-0 bg-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right rail */}
        <aside className="w-[380px] shrink-0 border-l border-slate-800/80 bg-slate-950/90 flex flex-col overflow-hidden">
          <div className="px-6 pt-6 pb-5 border-b border-slate-800/60 shrink-0">
            {isPublished ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-[11px] font-bold text-green-300 uppercase tracking-[0.14em]">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Editing live site
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-[11px] font-bold text-blue-300 uppercase tracking-[0.14em]">
                Preview mode
              </div>
            )}
            <h2 className="text-xl font-bold text-white mt-3 tracking-tight">
              Make it yours
            </h2>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              {isPublished
                ? "Every change saves to your live site instantly."
                : "Play with the design. Save when you love it."}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-7">
            {businessDetails && (
              <>
                <BusinessDetailsSection
                  tenantId={id}
                  initial={businessDetails}
                  onSaved={handleBusinessDetailsSaved}
                />
                <div className="border-t border-slate-800" />
              </>
            )}
            {customisation ? (
              <CustomisePanel
                tenantId={id}
                state={customisation}
                onBrandColorChange={handleBrandColorChange}
                onChromeThemeChange={handleChromeThemeChange}
                onLogoHeightChange={handleLogoHeightChange}
                onLogoChange={handleLogoChange}
              />
            ) : (
              <div className="text-sm text-slate-400">Loading customisation…</div>
            )}
          </div>
        </aside>
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
        <div className="p-4 flex flex-col gap-7">
          {businessDetails && (
            <>
              <BusinessDetailsSection
                tenantId={id}
                initial={businessDetails}
                onSaved={handleBusinessDetailsSaved}
              />
              <div className="border-t border-slate-800" />
            </>
          )}
          {customisation ? (
            <CustomisePanel
              tenantId={id}
              state={customisation}
              onBrandColorChange={handleBrandColorChange}
              onChromeThemeChange={handleChromeThemeChange}
              onLogoHeightChange={handleLogoHeightChange}
              onLogoChange={handleLogoChange}
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
      <ImagePickerModal
        tenantId={id}
        path={editingImagePath}
        defaultQuery={niche}
        onClose={() => setEditingImagePath(null)}
        onSelect={handleImagePicked}
      />
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
