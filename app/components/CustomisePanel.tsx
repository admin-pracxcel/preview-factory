"use client";

import { useState, useRef } from "react";
import { Check, Upload, Image as ImageIcon } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                       */
/* -------------------------------------------------------------------------- */

type HeroTab = "your-photos" | "upload" | "stock";

interface SwatchProps {
  hex: string;
  label: string;
  selected: boolean;
  onSelect: (hex: string) => void;
}

/* -------------------------------------------------------------------------- */
/*  Colour swatches                                                             */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Placeholder images                                                          */
/* -------------------------------------------------------------------------- */

const PLACEHOLDER_PHOTOS = [
  "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=160&h=110&fit=crop",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=160&h=110&fit=crop",
  "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=160&h=110&fit=crop",
];

const STOCK_PHOTOS = [
  "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=160&h=110&fit=crop",
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=160&h=110&fit=crop",
  "https://images.unsplash.com/photo-1581092162384-8987c1d64926?w=160&h=110&fit=crop",
];

/* -------------------------------------------------------------------------- */
/*  Swatch button                                                               */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Main component                                                              */
/* -------------------------------------------------------------------------- */

export default function CustomisePanel() {
  const [selectedColour, setSelectedColour] = useState(SWATCHES[0].hex);
  const [customHex, setCustomHex] = useState("");
  const [logoFilename, setLogoFilename] = useState<string | null>(null);
  const [heroTab, setHeroTab] = useState<HeroTab>("your-photos");
  const [selectedHero, setSelectedHero] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroUploadRef = useRef<HTMLInputElement>(null);
  const dragActive = useRef(false);
  const [dragHighlight, setDragHighlight] = useState(false);

  /* ---- Colour handlers ---- */

  function handleSwatchSelect(hex: string) {
    setSelectedColour(hex);
    setCustomHex("");
    console.log("colour changed", hex);
  }

  function handleCustomHexChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCustomHex(val);
    // Only apply if it looks like a full hex colour
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setSelectedColour(val);
      console.log("colour changed", val);
    }
  }

  /* ---- Logo handlers ---- */

  function handleLogoFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      alert("Logo file must be under 5 MB.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      alert("Please upload a PNG, JPG, or SVG file.");
      return;
    }
    setLogoFilename(file.name);
    console.log("logo uploaded", file.name);
    // Stub: FormData upload goes here in production
  }

  function handleLogoDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragHighlight(false);
    dragActive.current = false;
    const file = e.dataTransfer.files[0];
    if (file) handleLogoFile(file);
  }

  function handleLogoInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleLogoFile(file);
  }

  /* ---- Hero handlers ---- */

  function handleHeroSelect(url: string) {
    setSelectedHero(url);
    console.log("hero image selected", url);
  }

  function handleHeroUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSelectedHero(url);
    console.log("hero image selected", url);
  }

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-7 bg-slate-900 rounded-2xl border border-slate-800 p-6 h-full overflow-y-auto">
      {/* Panel heading */}
      <div>
        <h2 className="text-lg font-semibold text-white">Customise your site</h2>
        <p className="text-slate-400 text-xs mt-0.5">Changes go live in a few seconds</p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Colour                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
          Brand colour
        </h3>

        {/* Swatches */}
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((s) => (
            <Swatch
              key={s.hex}
              hex={s.hex}
              label={s.label}
              selected={selectedColour === s.hex}
              onSelect={handleSwatchSelect}
            />
          ))}
        </div>

        {/* Custom hex */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg border border-slate-700 shrink-0"
            style={{ backgroundColor: selectedColour }}
          />
          <input
            type="text"
            value={customHex || selectedColour}
            onChange={handleCustomHexChange}
            placeholder="#1e293b"
            maxLength={7}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </section>

      <div className="border-t border-slate-800" />

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Logo                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
          Logo
        </h3>

        {/* Drop zone */}
        <div
          onDragEnter={(e) => { e.preventDefault(); setDragHighlight(true); dragActive.current = true; }}
          onDragLeave={(e) => { e.preventDefault(); setDragHighlight(false); dragActive.current = false; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleLogoDrop}
          onClick={() => logoInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors
            ${dragHighlight
              ? "border-blue-500 bg-blue-500/10"
              : "border-slate-700 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800/80"
            }`}
        >
          <Upload className="w-5 h-5 text-slate-400" />
          {logoFilename ? (
            <p className="text-sm text-green-400 font-medium text-center truncate max-w-full">
              {logoFilename}
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-300 font-medium">
                Drop your logo here
              </p>
              <p className="text-xs text-slate-500">PNG, JPG, or SVG — max 5 MB</p>
            </>
          )}
        </div>
        <input
          ref={logoInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
          className="hidden"
          onChange={handleLogoInputChange}
        />

        <p className="text-xs text-slate-500">
          Background will be removed automatically.
        </p>
      </section>

      <div className="border-t border-slate-800" />

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Hero image                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
          Hero image
        </h3>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
          {(["your-photos", "upload", "stock"] as HeroTab[]).map((tab) => {
            const labels: Record<HeroTab, string> = {
              "your-photos": "Your photos",
              upload: "Upload",
              stock: "Stock",
            };
            return (
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
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {heroTab === "your-photos" && (
          <div className="grid grid-cols-3 gap-2">
            {PLACEHOLDER_PHOTOS.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleHeroSelect(url)}
                className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                  selectedHero === url
                    ? "border-blue-500"
                    : "border-transparent hover:border-slate-600"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-20 object-cover"
                />
                {selectedHero === url && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500/30">
                    <Check className="w-5 h-5 text-white drop-shadow" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {heroTab === "upload" && (
          <div>
            <button
              type="button"
              onClick={() => heroUploadRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800/80 p-6 cursor-pointer transition-colors"
            >
              <ImageIcon className="w-5 h-5 text-slate-400" />
              <p className="text-sm text-slate-300 font-medium">Upload a photo</p>
              <p className="text-xs text-slate-500">JPG, PNG or WebP</p>
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

        {heroTab === "stock" && (
          <div className="grid grid-cols-3 gap-2">
            {STOCK_PHOTOS.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleHeroSelect(url)}
                className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                  selectedHero === url
                    ? "border-blue-500"
                    : "border-transparent hover:border-slate-600"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Stock photo ${i + 1}`}
                  className="w-full h-20 object-cover"
                />
                {selectedHero === url && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500/30">
                    <Check className="w-5 h-5 text-white drop-shadow" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
