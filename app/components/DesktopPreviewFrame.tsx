"use client";

/**
 * DesktopPreviewFrame
 *
 * Renders an iframe at a fixed desktop viewport width (1440px by default)
 * and CSS-scales it down to fit whatever the parent container's actual
 * width is. Effect: the embedded site looks like a full-desktop preview
 * even inside a narrow card. Same trick every "responsive design mode"
 * tool uses.
 *
 * Why not just set width/height on the iframe: browsers use the iframe's
 * CSS width as the layout viewport for the inner document. If we set the
 * iframe to 1024px, the site inside renders as if on a 1024px screen —
 * mobile breakpoints kick in and it looks like a phone view. By fixing
 * the iframe width at 1440px and scaling the whole thing visually with
 * transform, the inside stays on desktop breakpoints.
 *
 * Uses ResizeObserver on the container so it stays crisp when the viewport
 * changes (e.g. resizing the browser, orientation change on mobile).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

interface DesktopPreviewFrameProps {
  src: string;
  title: string;
  /** Desktop viewport width to render at. Default 1440. */
  desktopWidth?: number;
  /** Height of the visible (scaled) preview area. */
  className?: string;
  /** Content rendered above the fade, e.g. an "Open" CTA button. */
  overlay?: ReactNode;
}

export default function DesktopPreviewFrame({
  src,
  title,
  desktopWidth = 1440,
  className = "",
  overlay,
}: DesktopPreviewFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const width = el.clientWidth;
      // Guard against zero-width during initial layout (SSR hydration edge).
      if (width > 0) setScale(width / desktopWidth);
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [desktopWidth]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-white ${className}`}
    >
      <iframe
        src={src}
        title={title}
        loading="lazy"
        style={{
          width: `${desktopWidth}px`,
          // Height scales up in inverse so the visible (scaled) area matches
          // the parent container height. Uses the same scale factor.
          height: `${100 / scale}%`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          border: 0,
          display: "block",
        }}
      />
      {overlay}
    </div>
  );
}
