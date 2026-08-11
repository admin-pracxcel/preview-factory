"use client";

/**
 * app/components/DemoVideoButton.tsx
 *
 * Small pill button that opens a modal with an autoplay looped video demo.
 * Used on the /websites-for-* landing pages beside the "See a live example"
 * link. The button + modal live in a single client component because the
 * open/close state is trivial and the parent NicheHomeLanding stays a
 * server component.
 *
 * Modal behaviour:
 *   - Backdrop click, ESC key, or × button closes
 *   - Body scroll locked while open
 *   - Video autoplays muted (works across all autoplay policies), loops,
 *     shows native controls so the user can pause / seek
 */

import { useEffect, useState } from "react";
import { PlayCircle, X } from "lucide-react";

export default function DemoVideoButton({
  videoSrc,
  label = "Live demo",
}: {
  videoSrc: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  // ESC to close + scroll lock while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-1.5 text-white/60 underline underline-offset-4 hover:text-white text-sm font-medium transition-colors cursor-pointer"
      >
        {label}
        <PlayCircle className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Video demo"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-6xl overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close demo"
              className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <video
              autoPlay
              loop
              muted
              playsInline
              controls
              className="block w-full h-auto"
            >
              <source src={videoSrc} type="video/webm" />
            </video>
          </div>
        </div>
      )}
    </>
  );
}
