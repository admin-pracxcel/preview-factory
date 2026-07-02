"use client";

/**
 * Controlled customisation panel. Parent owns the customisation state and
 * receives onChange callbacks for each field. Parent decides what to do with
 * them (postMessage to iframe, debounced save to backend).
 */

import { useState, useRef, useEffect } from "react";
import { Check, Upload, Image as ImageIcon, Loader2, Search, Trash2, RefreshCw } from "lucide-react";

interface SwatchProps {
  hex: string;
  label: string;
  selected: boolean;
  onSelect: (hex: string) => void;
}

const SWATCHES = [
  { hex: "#1e293b", label: "Slate" },
  { hex: "#1d4ed8", label: "Blue" },
  { hex: "#15803d", label: "Green" },
  { hex: "#b91c1c", label: "Red" },
  { hex: "#7e22ce", label: "Purple" },
  { hex: "#d97706", label: "Amber" },
  { hex: "#db2777", label: "Pink" },
  { hex: "#0f766e", label: "Teal" },
];

function Swatch({ hex, label, selected, onSelect }: SwatchProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onSelect(hex)}
      className="relative w-9 h-9 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
      style={{
        backgroundColor: hex,
        borderColor: selected ? "#fff" : "transparent",
        boxShadow: selected ? "0 0 0 1px #3b82f6" : "none",
      }}
      title={label}
    >
      {selected && (
        <Check className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow" />
      )}
    </button>
  );
}

export interface CustomisationState {
  /** Drives buttons, icons, and accents — the *only* user-pickable colour. */
  brandColor: string;
  /** Header / footer / areas-we-service chrome — light (white) or dark (black). */
  chromeTheme: "light" | "dark";
  logoUrl: string;
  /** Rendered height of the header logo in CSS pixels. */
  logoHeightPx: number;
  heroUrl: string;
}

export interface CustomisePanelProps {
  tenantId: string;
  state: CustomisationState;
  defaultPexelsQuery?: string;
  onBrandColorChange: (hex: string) => void;
  onChromeThemeChange: (theme: "light" | "dark") => void;
  onLogoChange: (url: string) => void;
  onLogoHeightChange: (px: number) => void;
  onHeroChange: (url: string) => void;
  onGalleryChange: (urls: string[]) => void;
}

type HeroTab = "stock" | "upload";

export default function CustomisePanel({
  tenantId,
  state,
  defaultPexelsQuery = "",
  onBrandColorChange,
  onChromeThemeChange,
  onLogoChange,
  onLogoHeightChange,
  onHeroChange,
  onGalleryChange,
}: CustomisePanelProps) {
  const [customHex, setCustomHex] = useState("");
  const [logoFilename, setLogoFilename] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [heroTab, setHeroTab] = useState<HeroTab>("stock");
  const [heroUploading, setHeroUploading] = useState(false);
  const [pexelsQuery, setPexelsQuery] = useState(defaultPexelsQuery);
  const [pexelsResults, setPexelsResults] = useState<string[]>([]);
  const [pexelsLoading, setPexelsLoading] = useState(false);
  const [pexelsError, setPexelsError] = useState<string | null>(null);

  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryQuery, setGalleryQuery] = useState(defaultPexelsQuery);
  const [galleryRefreshing, setGalleryRefreshing] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryRestoringGbp, setGalleryRestoringGbp] = useState(false);
  const [hasGbpPhotos, setHasGbpPhotos] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const galleryUploadRef = useRef<HTMLInputElement>(null);

  // Per-slot editing state — when set, an inline editor below the grid
  // shows search + upload scoped to that one gallery position.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [slotQuery, setSlotQuery] = useState("");
  const [slotResults, setSlotResults] = useState<string[]>([]);
  const [slotSearching, setSlotSearching] = useState(false);
  const [slotUploading, setSlotUploading] = useState(false);
  const slotUploadRef = useRef<HTMLInputElement>(null);

  // Load current gallery URLs on mount.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/tenants/${tenantId}/gallery`);
        if (!res.ok) return;
        const data = (await res.json()) as { urls: string[]; gbpPhotoCount?: number };
        setGalleryUrls(data.urls);
        setHasGbpPhotos((data.gbpPhotoCount ?? 0) > 0);
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroUploadRef = useRef<HTMLInputElement>(null);
  const [dragHighlight, setDragHighlight] = useState(false);

  // Initial Pexels search on mount with the default niche query.
  useEffect(() => {
    if (defaultPexelsQuery) runPexelsSearch(defaultPexelsQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Colour ---- */

  function handleSwatchSelect(hex: string) {
    setCustomHex("");
    onBrandColorChange(hex);
  }

  function handleCustomHexChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCustomHex(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      onBrandColorChange(val);
    }
  }


  /* ---- Logo upload ---- */

  async function uploadFile(file: File): Promise<string | null> {
    const form = new FormData();
    form.append("file", file);
    form.append("tenantId", tenantId);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      alert(err.error ?? `Upload failed (${res.status})`);
      return null;
    }
    const data = (await res.json()) as { url: string };
    return data.url;
  }

  async function handleLogoFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      alert("Logo file must be under 5 MB.");
      return;
    }
    setLogoUploading(true);
    try {
      // Skip background removal when the image already has transparency:
      // SVGs always do, and PNGs/WebPs may. JPGs never do — those always run
      // through the ML pass.
      const alreadyTransparent =
        file.type === "image/svg+xml" || (await hasTransparency(file));

      let toUpload: File = file;
      if (!alreadyTransparent) {
        const { removeBackground } = await import("@imgly/background-removal");
        // "isnet" is the full-precision model — better edges on logos than
        // the default fp16 variant. Larger one-time download, cached after.
        const cleaned = await removeBackground(file, {
          model: "isnet",
          output: { format: "image/png", quality: 1 },
        });
        toUpload = new File([cleaned], `${file.name.replace(/\.[^/.]+$/, "")}.png`, {
          type: "image/png",
        });
      }
      const url = await uploadFile(toUpload);
      if (url) {
        setLogoFilename(toUpload.name);
        onLogoChange(url);
      }
    } catch (err) {
      alert(`Background removal failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLogoUploading(false);
    }
  }

  /**
   * Detect whether a raster image already has alpha < 255 anywhere.
   * Draws onto a small canvas (max 64×64) and scans the alpha channel —
   * runs in <100 ms and avoids the ~3-8 s ML pass for already-transparent logos.
   * Returns false on JPGs (they have no alpha) or on any error.
   */
  async function hasTransparency(file: File): Promise<boolean> {
    if (file.type === "image/jpeg") return false;
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = url;
      });
      const w = Math.min(img.naturalWidth || 64, 64);
      const h = Math.min(img.naturalHeight || 64, 64);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function handleLogoDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragHighlight(false);
    const file = e.dataTransfer.files[0];
    if (file) handleLogoFile(file);
  }

  function handleLogoInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleLogoFile(file);
  }

  /* ---- Hero upload + Pexels ---- */

  async function handleHeroUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroUploading(true);
    const url = await uploadFile(file);
    setHeroUploading(false);
    if (url) onHeroChange(url);
  }

  /** Persist a new gallery list and broadcast. */
  async function applyGalleryUrls(next: string[]) {
    const res = await fetch(`/api/tenants/${tenantId}/gallery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: next }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setGalleryError(err.error ?? `Save failed (${res.status})`);
      return;
    }
    const data = (await res.json()) as { urls: string[] };
    setGalleryUrls(data.urls);
    onGalleryChange(data.urls);
  }

  function openSlotEditor(i: number) {
    setEditingIndex(i);
    setSlotQuery(defaultPexelsQuery);
    setSlotResults([]);
    setGalleryError(null);
  }

  function closeSlotEditor() {
    setEditingIndex(null);
    setSlotResults([]);
  }

  async function searchSlotPexels(q: string) {
    if (!q.trim()) return;
    setSlotSearching(true);
    setGalleryError(null);
    try {
      const res = await fetch(`/api/pexels-search?q=${encodeURIComponent(q)}&count=12`);
      const data = (await res.json()) as { urls?: string[]; error?: string };
      if (!res.ok) {
        setGalleryError(data.error ?? "Search failed");
        setSlotResults([]);
      } else {
        setSlotResults(data.urls ?? []);
        if (!data.urls?.length) setGalleryError("No results — try another keyword");
      }
    } finally {
      setSlotSearching(false);
    }
  }

  async function pickForSlot(url: string) {
    if (editingIndex === null) return;
    const next = [...galleryUrls];
    next[editingIndex] = url;
    await applyGalleryUrls(next);
    closeSlotEditor();
  }

  async function uploadForSlot(file: File | undefined) {
    if (!file || editingIndex === null) return;
    if (file.size > 5 * 1024 * 1024) {
      setGalleryError("File exceeds 5 MB limit.");
      return;
    }
    setSlotUploading(true);
    try {
      const url = await uploadFile(file);
      if (url) {
        const next = [...galleryUrls];
        next[editingIndex] = url;
        await applyGalleryUrls(next);
        closeSlotEditor();
      }
    } finally {
      setSlotUploading(false);
      if (slotUploadRef.current) slotUploadRef.current.value = "";
    }
  }

  async function handleGalleryUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setGalleryError(null);
    setGalleryUploading(true);
    try {
      // Upload all files in parallel; keep only those that succeed.
      const uploaded = await Promise.all(
        Array.from(files).map(async (f) => {
          if (f.size > 5 * 1024 * 1024) {
            setGalleryError(`"${f.name}" exceeds the 5 MB limit — skipped.`);
            return null;
          }
          return uploadFile(f);
        })
      );
      const newUrls = uploaded.filter((u): u is string => !!u);
      if (newUrls.length === 0) return;

      // New uploads take the first slots; remaining slots stay as they were.
      const next = [...newUrls, ...galleryUrls].slice(0, galleryUrls.length || newUrls.length);

      // Persist via PATCH; broadcast via parent callback.
      const res = await fetch(`/api/tenants/${tenantId}/gallery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: next }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setGalleryError(err.error ?? `Save failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { urls: string[] };
      setGalleryUrls(data.urls);
      onGalleryChange(data.urls);
    } finally {
      setGalleryUploading(false);
      if (galleryUploadRef.current) galleryUploadRef.current.value = "";
    }
  }

  async function restoreGbpPhotos() {
    setGalleryRestoringGbp(true);
    setGalleryError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/gallery`, { method: "PUT" });
      const data = (await res.json()) as { urls?: string[]; error?: string };
      if (!res.ok || !data.urls) {
        setGalleryError(data.error ?? `Restore failed (${res.status})`);
        return;
      }
      setGalleryUrls(data.urls);
      onGalleryChange(data.urls);
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : String(err));
    } finally {
      setGalleryRestoringGbp(false);
    }
  }

  async function refreshGalleryFromStock() {
    setGalleryRefreshing(true);
    setGalleryError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/gallery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: galleryQuery || undefined }),
      });
      const data = (await res.json()) as { urls?: string[]; error?: string };
      if (!res.ok || !data.urls) {
        setGalleryError(data.error ?? `Refresh failed (${res.status})`);
        return;
      }
      setGalleryUrls(data.urls);
      onGalleryChange(data.urls);
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : String(err));
    } finally {
      setGalleryRefreshing(false);
    }
  }

  async function runPexelsSearch(q: string) {
    if (!q.trim()) return;
    setPexelsLoading(true);
    setPexelsError(null);
    try {
      const res = await fetch(`/api/pexels-search?q=${encodeURIComponent(q)}&count=12`);
      const data = (await res.json()) as { urls?: string[]; error?: string };
      if (!res.ok) {
        setPexelsError(data.error ?? "Search failed");
        setPexelsResults([]);
      } else {
        setPexelsResults(data.urls ?? []);
        if (!data.urls?.length) setPexelsError("No results — try another keyword");
      }
    } catch (err) {
      setPexelsError(err instanceof Error ? err.message : String(err));
      setPexelsResults([]);
    } finally {
      setPexelsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-7 bg-slate-900 rounded-2xl border border-slate-800 p-6 h-full overflow-y-auto">
      <div>
        <h2 className="text-lg font-semibold text-white">Customise your site</h2>
        <p className="text-slate-400 text-xs mt-0.5">Changes apply instantly</p>
      </div>

      {/* Brand colour */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
          Brand colour
        </h3>
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((s) => (
            <Swatch
              key={s.hex}
              hex={s.hex}
              label={s.label}
              selected={state.brandColor.toLowerCase() === s.hex.toLowerCase()}
              onSelect={handleSwatchSelect}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg border border-slate-700 shrink-0"
            style={{ backgroundColor: state.brandColor }}
          />
          <input
            type="text"
            value={customHex || state.brandColor}
            onChange={handleCustomHexChange}
            placeholder="#1e293b"
            maxLength={7}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Header / footer / areas section — light or dark chrome */}
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-300">Header &amp; footer</p>
          <div className="flex items-center rounded-xl border border-slate-700 p-0.5">
            <button
              type="button"
              onClick={() => onChromeThemeChange("light")}
              aria-pressed={state.chromeTheme === "light"}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                state.chromeTheme === "light"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => onChromeThemeChange("dark")}
              aria-pressed={state.chromeTheme === "dark"}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                state.chromeTheme === "dark"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Dark
            </button>
          </div>
        </div>
      </section>

      <div className="border-t border-slate-800" />

      {/* Logo */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
          Logo
        </h3>
        <div
          onDragEnter={(e) => { e.preventDefault(); setDragHighlight(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragHighlight(false); }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleLogoDrop}
          onClick={() => logoInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors
            ${dragHighlight
              ? "border-blue-500 bg-blue-500/10"
              : "border-slate-700 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800/80"
            }`}
        >
          {logoUploading ? (
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          ) : (
            <Upload className="w-5 h-5 text-slate-400" />
          )}
          {state.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={state.logoUrl} alt="Logo preview" className="h-12 max-w-full object-contain" />
          ) : logoFilename ? (
            <p className="text-sm text-green-400 font-medium text-center truncate max-w-full">
              {logoFilename}
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-300 font-medium">
                {logoUploading ? "Removing background…" : "Drop your logo here"}
              </p>
              <p className="text-xs text-slate-500">PNG, JPG, WebP or SVG — max 5 MB</p>
            </>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Background is removed automatically (first upload downloads a ~80 MB model for sharp edges).
        </p>
        {state.logoUrl && (
          <button
            type="button"
            onClick={() => { setLogoFilename(null); onLogoChange(""); }}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-medium py-2 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove logo
          </button>
        )}
        <input
          ref={logoInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={handleLogoInputChange}
        />

        {/* Logo size slider — applies whether or not a logo is uploaded */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Logo size</span>
            <span className="font-mono text-slate-400">{state.logoHeightPx}px</span>
          </div>
          <input
            type="range"
            min={24}
            max={72}
            step={1}
            value={state.logoHeightPx}
            onChange={(e) => onLogoHeightChange(parseInt(e.target.value, 10))}
            className="w-full accent-blue-500"
          />
        </div>
      </section>

      <div className="border-t border-slate-800" />

      {/* Hero image */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
          Hero image
        </h3>

        <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
          {(["stock", "upload"] as HeroTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setHeroTab(tab)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                heroTab === tab
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab === "stock" ? "Search stock" : "Upload"}
            </button>
          ))}
        </div>

        {heroTab === "stock" && (
          <div className="flex flex-col gap-3">
            <form
              onSubmit={(e) => { e.preventDefault(); runPexelsSearch(pexelsQuery); }}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus-within:ring-2 focus-within:ring-blue-500">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={pexelsQuery}
                  onChange={(e) => setPexelsQuery(e.target.value)}
                  placeholder="e.g. barber, salon, gym"
                  className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={pexelsLoading || !pexelsQuery.trim()}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold"
              >
                {pexelsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Search
              </button>
            </form>
            {pexelsLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Searching Pexels…
              </div>
            )}
            {pexelsError && (
              <p className="text-xs text-amber-400">{pexelsError}</p>
            )}
            {pexelsResults.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {pexelsResults.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => onHeroChange(url)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                      state.heroUrl === url
                        ? "border-blue-500"
                        : "border-transparent hover:border-slate-600"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Result ${i + 1}`}
                      className="w-full h-20 object-cover"
                    />
                    {state.heroUrl === url && (
                      <div className="absolute inset-0 flex items-center justify-center bg-blue-500/30">
                        <Check className="w-5 h-5 text-white drop-shadow" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {heroTab === "upload" && (
          <div>
            <button
              type="button"
              onClick={() => heroUploadRef.current?.click()}
              disabled={heroUploading}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800/80 p-6 cursor-pointer transition-colors disabled:opacity-50"
            >
              {heroUploading ? (
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              ) : (
                <ImageIcon className="w-5 h-5 text-slate-400" />
              )}
              <p className="text-sm text-slate-300 font-medium">
                {heroUploading ? "Uploading…" : "Upload a photo"}
              </p>
              <p className="text-xs text-slate-500">JPG, PNG or WebP — max 5 MB</p>
            </button>
            <input
              ref={heroUploadRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleHeroUploadChange}
            />
          </div>
        )}
      </section>

      <div className="border-t border-slate-800" />

      {/* Gallery */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
          Gallery
        </h3>
        <p className="text-xs text-slate-500">
          Click any image to replace just that one, or refresh / upload to update many at once.
        </p>

        {/* Thumbnails — click to open per-slot editor */}
        {galleryUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {galleryUrls.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => openSlotEditor(i)}
                className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                  editingIndex === i ? "border-blue-500" : "border-slate-700 hover:border-slate-500"
                }`}
                title={`Replace image ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-16 object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                  <span className="opacity-0 group-hover:opacity-100 text-xs font-semibold text-white">
                    Replace
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Inline editor for a single slot */}
        {editingIndex !== null && (
          <div className="rounded-lg border border-blue-500/40 bg-slate-800/60 p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-300">
                Replacing image {editingIndex + 1}
              </p>
              <button
                type="button"
                onClick={closeSlotEditor}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); searchSlotPexels(slotQuery); }}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus-within:ring-2 focus-within:ring-blue-500">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={slotQuery}
                  onChange={(e) => setSlotQuery(e.target.value)}
                  placeholder="Search stock photos"
                  className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={slotSearching || !slotQuery.trim()}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold"
              >
                {slotSearching && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Search
              </button>
            </form>

            {slotSearching && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Searching…
              </div>
            )}

            {slotResults.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {slotResults.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => pickForSlot(url)}
                    className="relative rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Result ${i + 1}`} className="w-full h-16 object-cover" />
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => slotUploadRef.current?.click()}
              disabled={slotUploading}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-medium py-2 transition-colors disabled:opacity-50"
            >
              {slotUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {slotUploading ? "Uploading…" : "Upload from your computer"}
            </button>
            <input
              ref={slotUploadRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => uploadForSlot(e.target.files?.[0])}
            />
          </div>
        )}

        {/* Search input on its own line */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus-within:ring-2 focus-within:ring-blue-500">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={galleryQuery}
            onChange={(e) => setGalleryQuery(e.target.value)}
            placeholder="e.g. barber, salon, gym"
            className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Refresh button on its own line */}
        <button
          type="button"
          onClick={refreshGalleryFromStock}
          disabled={galleryRefreshing}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold"
        >
          {galleryRefreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Refresh all from stock
        </button>

        {/* Restore original GBP photos — only shown when the tenant has them */}
        {hasGbpPhotos && (
          <button
            type="button"
            onClick={restoreGbpPhotos}
            disabled={galleryRestoringGbp}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-semibold disabled:opacity-50"
          >
            {galleryRestoringGbp ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Use Google photos
          </button>
        )}

        {/* Bulk upload */}
        <button
          type="button"
          onClick={() => galleryUploadRef.current?.click()}
          disabled={galleryUploading}
          className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800/80 py-3 text-sm text-slate-300 font-medium transition-colors disabled:opacity-50"
        >
          {galleryUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {galleryUploading ? "Uploading…" : "Upload your photos"}
        </button>
        <input
          ref={galleryUploadRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleGalleryUpload(e.target.files)}
        />
        <p className="text-xs text-slate-500">
          Bulk uploads fill the top slots. JPG, PNG or WebP — 5 MB each.
        </p>

        {galleryError && (
          <p className="text-xs text-amber-400">{galleryError}</p>
        )}
      </section>
    </div>
  );
}
