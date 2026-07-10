"use client";

/**
 * Controlled customisation panel. Parent owns the customisation state and
 * receives onChange callbacks for each field. Parent decides what to do with
 * them (postMessage to iframe, debounced save to backend).
 */

import { useState, useRef } from "react";
import { Upload, Loader2, Trash2, Undo2, Pipette } from "lucide-react";

export interface CustomisationState {
  /** Drives buttons, icons, and accents — the *only* user-pickable colour. */
  brandColor: string;
  /** Header / footer / areas-we-service chrome — light (white) or dark (black). */
  chromeTheme: "light" | "dark";
  logoUrl: string;
  /** Rendered height of the header logo in CSS pixels. */
  logoHeightPx: number;
}

export interface CustomisePanelProps {
  tenantId: string;
  state: CustomisationState;
  onBrandColorChange: (hex: string) => void;
  onChromeThemeChange: (theme: "light" | "dark") => void;
  onLogoChange: (url: string) => void;
  onLogoHeightChange: (px: number) => void;
}

export default function CustomisePanel({
  tenantId,
  state,
  onBrandColorChange,
  onChromeThemeChange,
  onLogoChange,
  onLogoHeightChange,
}: CustomisePanelProps) {
  const [customHex, setCustomHex] = useState("");
  const [logoFilename, setLogoFilename] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  // When bg-removal ran, we upload both the original and the processed logo
  // so the owner can toggle if the ML mis-cut their design. Both URLs live
  // only in this session — reload wipes them and whichever variant they
  // last picked is what's persisted.
  const [logoOriginalUrl, setLogoOriginalUrl] = useState<string | null>(null);
  const [logoProcessedUrl, setLogoProcessedUrl] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const [dragHighlight, setDragHighlight] = useState(false);

  /* ---- Colour ---- */

  function handleColorPicker(e: React.ChangeEvent<HTMLInputElement>) {
    // Native picker fires on every drag tick — the debounced scheduleSave
    // upstream absorbs the noise, and postMessage'ing CSS vars per tick is
    // cheap enough to keep the preview feeling live.
    setCustomHex("");
    onBrandColorChange(e.target.value);
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
    // Reset any prior toggle state — a fresh upload starts a new revert window.
    setLogoOriginalUrl(null);
    setLogoProcessedUrl(null);
    try {
      // Skip background removal when the image already has transparency:
      // SVGs always do, and PNGs/WebPs may. JPGs never do — those always run
      // through the ML pass.
      const alreadyTransparent =
        file.type === "image/svg+xml" || (await hasTransparency(file));

      if (alreadyTransparent) {
        // No bg-removal, single upload — no revert option needed.
        const url = await uploadFile(file);
        if (url) {
          setLogoFilename(file.name);
          onLogoChange(url);
        }
        return;
      }

      // Upload the original first so we can revert if the ML pass mis-cuts
      // fine details (thin lines, similar-colour outlines).
      const originalUrl = await uploadFile(file);

      const { removeBackground } = await import("@imgly/background-removal");
      // "isnet" is the full-precision model — better edges on logos than
      // the default fp16 variant. Larger one-time download, cached after.
      const cleaned = await removeBackground(file, {
        model: "isnet",
        output: { format: "image/png", quality: 1 },
      });
      const processedFile = new File(
        [cleaned],
        `${file.name.replace(/\.[^/.]+$/, "")}.png`,
        { type: "image/png" },
      );
      const processedUrl = await uploadFile(processedFile);

      if (processedUrl) {
        setLogoFilename(processedFile.name);
        setLogoOriginalUrl(originalUrl ?? null);
        setLogoProcessedUrl(processedUrl);
        onLogoChange(processedUrl);
      } else if (originalUrl) {
        // Processed upload failed but the original made it through — fall back
        // to that so the owner isn't left with nothing.
        setLogoFilename(file.name);
        onLogoChange(originalUrl);
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

  return (
    <div className="flex flex-col gap-7">
      {/* Brand colour */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
          Brand colour
        </h3>
        <div className="flex items-center gap-3">
          <label
            className="group relative w-10 h-10 rounded-lg border border-slate-700 overflow-hidden cursor-pointer shrink-0 shadow-inner ring-0 hover:ring-2 hover:ring-blue-500/60 transition-shadow"
            style={{ backgroundColor: state.brandColor }}
          >
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/45 transition-colors"
              aria-hidden
            >
              <Pipette className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
            </span>
            <input
              type="color"
              value={
                /^#[0-9a-fA-F]{6}$/.test(state.brandColor)
                  ? state.brandColor
                  : "#1e293b"
              }
              onChange={handleColorPicker}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Pick brand colour"
            />
          </label>
          <input
            type="text"
            value={customHex || state.brandColor}
            onChange={handleCustomHexChange}
            placeholder="#1e293b"
            maxLength={7}
            className="flex-1 h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Backgrounds removed automatically. First upload fetches a one-time model.
        </p>
        {logoOriginalUrl && logoProcessedUrl && (
          <button
            type="button"
            onClick={() => {
              const next =
                state.logoUrl === logoProcessedUrl
                  ? logoOriginalUrl
                  : logoProcessedUrl;
              onLogoChange(next);
            }}
            className="flex items-center justify-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-200 hover:border-blue-400/70 hover:bg-blue-500/15 text-xs font-medium py-2 transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
            {state.logoUrl === logoProcessedUrl
              ? "Bg removal messed it up? Use original"
              : "Use background-removed version"}
          </button>
        )}
        {state.logoUrl && (
          <button
            type="button"
            onClick={() => {
              setLogoFilename(null);
              setLogoOriginalUrl(null);
              setLogoProcessedUrl(null);
              onLogoChange("");
            }}
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
    </div>
  );
}
