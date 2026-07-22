"use client";

/**
 * EditableImageOverlay
 *
 * Mounted inside SiteShell. Only activates when the site is being rendered
 * inside the preview editor's iframe (window.parent !== window). Walks every
 * element tagged with `data-editable-image="<dotted.path>"` and drops a
 * hover overlay ("Replace image") on top of it. Clicking the overlay
 * postMessages the parent, which opens the picker modal and PATCHes the
 * chosen URL into siteProps at that path.
 *
 * The overlay is injected as a plain DOM child of the tagged element, so
 * templates just need to add the data attribute — no per-image wrapper,
 * no client-component churn, no per-category rework.
 *
 * On the live site (parent === self), this component returns null and
 * neither the styles nor the overlay children are ever created.
 */

import { useEffect } from "react";

const OVERLAY_CLASS = "lch-edit-overlay";
const PILL_CLASS = "lch-edit-overlay-pill";

/*
 * Two visual modes:
 *
 *   default → full-cover dark overlay + centred pill. Whole area is clickable.
 *     Used for content images (about, service, location, gallery) where
 *     nothing else in the frame competes for the click.
 *
 *   corner  → only a small pill in the top-right corner is rendered. No dim
 *     over the rest of the element, and only the pill is a click target.
 *     Used for the home hero, which has CTAs sitting on top of the image;
 *     a full-cover overlay would visually hide them and hijack their clicks.
 */
const OVERLAY_CSS = `
  [data-editable-image] {
    position: relative;
  }

  /* Full-cover (default) */
  [data-editable-image]:not([data-editable-mode="corner"]) > .${OVERLAY_CLASS} {
    position: absolute;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.55);
    opacity: 0;
    transition: opacity 0.15s ease;
    cursor: pointer;
    border-radius: inherit;
  }
  /* Activation is driven by JS (see below) instead of CSS :hover, so a
     fixed header stacked above the image doesn't spuriously flip the
     overlay on. CSS :hover matches any pointer inside the image's
     bounding box, regardless of what's on top; JS checks the actual
     topmost element at pointer position via elementFromPoint. */
  [data-editable-image][data-lch-active="true"]:not([data-editable-mode="corner"]) > .${OVERLAY_CLASS} {
    opacity: 1;
  }

  /* Corner pill */
  [data-editable-image][data-editable-mode="corner"] > .${OVERLAY_CLASS} {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 40;
    /* Wrapper is invisible + non-blocking; only the pill inside intercepts
       clicks so CTAs beneath the section stay usable. */
    pointer-events: none;
    background: transparent;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  [data-editable-image][data-editable-mode="corner"][data-lch-active="true"] > .${OVERLAY_CLASS} {
    opacity: 1;
  }

  [data-editable-image] > .${OVERLAY_CLASS} > .${PILL_CLASS} {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #ffffff;
    color: #0f172a;
    padding: 8px 16px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    /* In corner mode the wrapper is pointer-events:none; re-enable on pill. */
    pointer-events: auto;
    cursor: pointer;
  }
`;

const PILL_HTML = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <path d="m21 15-5-5L5 21"/>
  </svg>
  Replace image
`;

export function EditableImageOverlay() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.parent === window) return; // not in an iframe → live site
    // Marketing embeds (e.g. the "See a real example" iframe on niche
    // landing pages) render the same tenant route but with ?embed=1 to
    // opt out of edit affordances. Keep hover overlays only for the
    // owner's preview editor iframe.
    if (new URLSearchParams(window.location.search).get("embed") === "1") return;

    const styleTag = document.createElement("style");
    styleTag.setAttribute("data-launcharoo-overlay", "");
    styleTag.textContent = OVERLAY_CSS;
    document.head.appendChild(styleTag);

    const listeners = new WeakMap<HTMLElement, (e: MouseEvent) => void>();

    function attach(el: HTMLElement) {
      if (el.dataset.editableAttached === "true") return;
      el.dataset.editableAttached = "true";

      const overlay = document.createElement("div");
      overlay.className = OVERLAY_CLASS;
      const pill = document.createElement("div");
      pill.className = PILL_CLASS;
      pill.innerHTML = PILL_HTML;
      overlay.appendChild(pill);

      // Click handler on the pill so it fires in both modes (in corner mode
      // the wrapper is pointer-events:none and would swallow the click).
      const onClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const path = el.getAttribute("data-editable-image");
        if (path && window.parent && window.parent !== window) {
          window.parent.postMessage(
            { type: "edit-image", path },
            "*",
          );
        }
      };
      pill.addEventListener("click", onClick);
      listeners.set(pill, onClick);

      el.appendChild(overlay);
    }

    function scan() {
      document
        .querySelectorAll<HTMLElement>("[data-editable-image]")
        .forEach(attach);
    }

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });

    // Activation via pointermove + elementFromPoint. This is the fix for
    // the "fixed nav triggers the image overlay behind it" bug: CSS
    // :hover fires whenever the pointer is inside the image's bounding
    // box, but a fixed header stacked above is what actually receives
    // events. elementFromPoint tells us the real topmost element, so we
    // activate only when the topmost element is a descendant of the
    // image (which includes the overlay + pill).
    let activeEl: HTMLElement | null = null;
    const setActive = (next: HTMLElement | null) => {
      if (activeEl === next) return;
      if (activeEl) delete activeEl.dataset.lchActive;
      activeEl = next;
      if (activeEl) activeEl.dataset.lchActive = "true";
    };
    const isInsideStickyOrFixed = (el: HTMLElement): boolean => {
      let node: HTMLElement | null = el;
      while (node && node !== document.body) {
        const pos = window.getComputedStyle(node).position;
        if (pos === "sticky" || pos === "fixed") return true;
        node = node.parentElement;
      }
      return false;
    };

    const onPointerMove = (e: PointerEvent) => {
      // elementsFromPoint returns every element under the cursor, front-to-
      // back. We want to activate an editable image only when it is truly
      // the frontmost target and NOT shadowed by a sticky or fixed
      // container (e.g. the tenant site's sticky header covering an image
      // that has scrolled behind it). Some tenant layouts render the image
      // above the header in the paint order due to nested transforms, so
      // elementFromPoint alone can point at the image even when the user
      // actually sees the header. We walk the front-to-back stack and stop
      // as soon as we see a sticky/fixed ancestor, which means the user's
      // pixel is really on that fixed chrome — leave every image alone.
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      let owner: HTMLElement | null = null;
      for (const el of stack) {
        if (!(el instanceof HTMLElement)) continue;
        if (isInsideStickyOrFixed(el)) {
          owner = null;
          break;
        }
        const match = el.closest<HTMLElement>("[data-editable-image]");
        if (match) {
          owner = match;
          break;
        }
      }
      setActive(owner);
    };
    const onPointerLeave = () => setActive(null);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);
    document.addEventListener("scroll", onPointerLeave, { passive: true, capture: true });

    return () => {
      observer.disconnect();
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      document.removeEventListener("scroll", onPointerLeave, { capture: true } as EventListenerOptions);
      setActive(null);
      styleTag.remove();
      document
        .querySelectorAll<HTMLElement>(
          `[data-editable-image] > .${OVERLAY_CLASS}`,
        )
        .forEach((overlay) => {
          const pill = overlay.querySelector<HTMLElement>(`.${PILL_CLASS}`);
          if (pill) {
            const handler = listeners.get(pill);
            if (handler) pill.removeEventListener("click", handler);
          }
          overlay.remove();
        });
      document
        .querySelectorAll<HTMLElement>('[data-editable-attached="true"]')
        .forEach((el) => {
          delete el.dataset.editableAttached;
        });
    };
  }, []);

  return null;
}
