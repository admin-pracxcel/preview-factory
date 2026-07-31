"use client";

import { useEffect, useState } from "react";

interface TocProps {
  headings: Array<{ id: string; text: string }>;
}

/**
 * Sticky sidebar TOC with active-section highlighting driven by
 * IntersectionObserver on the H2 elements the server rendered.
 */
export function TableOfContents({ headings }: TocProps) {
  const [activeId, setActiveId] = useState<string | null>(headings[0]?.id ?? null);

  useEffect(() => {
    if (headings.length === 0) return;
    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
        On this page
      </p>
      <ul className="space-y-2 border-l border-zinc-200">
        {headings.map((h) => {
          const active = h.id === activeId;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                className={`-ml-px block border-l-2 py-1 pl-4 leading-snug transition-colors ${
                  active
                    ? "border-[var(--accent)] font-semibold text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
