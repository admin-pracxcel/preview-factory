"use client";

/**
 * Mobile-only hamburger menu. Shown < lg. Renders the same NavItem[] the
 * desktop bar uses, so services/areas dropdowns become expandable in-panel
 * accordions. Closes on link click, escape, and outside taps.
 */

import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import type { NavItem } from "./layout";

export function MobileNav({ nav }: { nav: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  // Real header height, measured from the closest ancestor <header>. The
  // header shrinks/grows with the logo-height slider, so a hardcoded 64px
  // fallback would leave a gap or overlap. Recomputed on open + resize.
  const [headerHeight, setHeaderHeight] = useState<number>(64);

  useEffect(() => {
    if (!open) return;

    const measure = () => {
      const header = buttonRef.current?.closest("header");
      if (header) setHeaderHeight(header.getBoundingClientRect().height);
    };
    measure();

    // Lock scroll while the sheet is open — otherwise iOS lets you scroll
    // the page behind the overlay which feels broken.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", measure);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-10 w-10 place-items-center rounded-md transition-colors hover:bg-black/5 lg:hidden"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            style={{ top: headerHeight }}
            className="fixed inset-x-0 bottom-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          />
          {/* Panel */}
          <div
            style={{ top: headerHeight, maxHeight: `calc(100vh - ${headerHeight}px - 1rem)` }}
            className="fixed inset-x-0 z-50 overflow-y-auto border-b border-black/10 bg-[var(--chrome-bg)] text-[var(--chrome-fg)] shadow-2xl lg:hidden"
          >
            <ul className="mx-auto max-w-6xl divide-y divide-current/10 px-2 py-2">
              {nav.map((l) => {
                const key = l.href + l.label;
                const isOpen = expanded === key;
                if (l.children?.length) {
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : key)}
                        className="flex w-full items-center justify-between rounded-md px-3 py-3 text-base font-semibold opacity-90 transition-colors hover:bg-black/5"
                      >
                        {l.label}
                        <ChevronDown
                          className={
                            "h-4 w-4 opacity-60 transition-transform " +
                            (isOpen ? "rotate-180" : "")
                          }
                        />
                      </button>
                      {isOpen && (
                        <ul className="mb-1 space-y-0.5 pb-2 pl-3">
                          <li>
                            <a
                              href={l.href}
                              onClick={() => setOpen(false)}
                              className="block rounded-md px-3 py-2 text-sm font-medium opacity-80 transition-colors hover:bg-black/5 hover:opacity-100"
                            >
                              All {l.label.toLowerCase()}
                            </a>
                          </li>
                          {l.children.map((c) => (
                            <li key={c.href}>
                              <a
                                href={c.href}
                                onClick={() => setOpen(false)}
                                className="block rounded-md px-3 py-2 text-sm opacity-75 transition-colors hover:bg-black/5 hover:opacity-100"
                              >
                                {c.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                }
                return (
                  <li key={key}>
                    <a
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-3 py-3 text-base font-semibold opacity-90 transition-colors hover:bg-black/5"
                    >
                      {l.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
