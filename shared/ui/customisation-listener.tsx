"use client";

/**
 * Mounted inside SiteShell. Listens for postMessage from the parent preview
 * page to apply live customisation (brand colours, logo, hero image) without
 * reloading the iframe.
 *
 * Wire from parent:
 *   iframe.contentWindow.postMessage(
 *     { type: "apply-customisation", payload: { primary, accent, logoUrl, heroUrl } },
 *     "*"
 *   );
 *
 * Updates:
 *   - `--primary` / `--accent` CSS variables on the [data-theme-root] container
 *   - `data-customise="hero"` <img> src
 *   - `data-customise="logo"` <img> src (or upgrades the text fallback)
 */

import { useEffect } from "react";
import { readableFgOn } from "@/lib/color";

interface CustomisationPayload {
  primary?: string;
  secondary?: string;
  accent?: string;
  /** "light" → white chrome bg / dark text; "dark" → black / white. */
  chromeTheme?: "light" | "dark";
  logoUrl?: string;
  logoHeightPx?: number;
  heroUrl?: string;
  /** New URLs for the gallery, applied in order to `img[data-customise="gallery"]`. */
  galleryUrls?: string[];
}

export function CustomisationListener() {
  useEffect(() => {
    function handle(event: MessageEvent) {
      const data = event.data as { type?: string; payload?: CustomisationPayload };
      if (!data || data.type !== "apply-customisation" || !data.payload) return;
      const { primary, secondary, accent, chromeTheme, logoUrl, logoHeightPx, heroUrl, galleryUrls } = data.payload;

      const root = document.querySelector<HTMLElement>("[data-theme-root]");
      if (root) {
        if (primary) {
          root.style.setProperty("--primary", primary);
          root.style.setProperty("--primary-fg", readableFgOn(primary));
        }
        if (secondary) root.style.setProperty("--secondary", secondary);
        if (accent) {
          root.style.setProperty("--accent", accent);
          root.style.setProperty("--accent-fg", readableFgOn(accent));
        }
        if (chromeTheme) {
          root.style.setProperty("--chrome-bg", chromeTheme === "dark" ? "#000000" : "#ffffff");
          root.style.setProperty("--chrome-fg", chromeTheme === "dark" ? "#ffffff" : "#111111");
        }
        if (typeof logoHeightPx === "number") {
          root.style.setProperty("--logo-height", `${logoHeightPx}px`);
        }
      }

      if (galleryUrls) {
        const imgs = Array.from(
          document.querySelectorAll<HTMLImageElement>('img[data-customise="gallery"]')
        );
        imgs.forEach((img, i) => {
          if (galleryUrls[i]) {
            img.removeAttribute("srcset");
            img.src = galleryUrls[i];
          }
        });
      }

      if (heroUrl !== undefined) {
        const hero = document.querySelector<HTMLImageElement>('img[data-customise="hero"]');
        if (hero) {
          // Next/Image emits srcset which takes precedence over src — must
          // clear it so the new src is honoured.
          hero.removeAttribute("srcset");
          hero.src = heroUrl;
        }
      }

      if (logoUrl !== undefined) {
        const businessName = document.querySelector<HTMLElement>('[data-customise="business-name"]');
        const footerLogo = document.querySelector<HTMLImageElement>('img[data-customise="footer-logo"]');
        const footerName = document.querySelector<HTMLElement>('[data-customise="footer-business-name"]');
        if (logoUrl) {
          // Apply or upgrade the header logo.
          const logo = document.querySelector<HTMLImageElement>('img[data-customise="logo"]');
          if (logo) {
            logo.removeAttribute("srcset");
            logo.src = logoUrl;
          } else {
            const fallback = document.querySelector<HTMLElement>('[data-customise="logo-fallback"]');
            if (fallback) {
              const img = document.createElement("img");
              img.src = logoUrl;
              img.alt = "Logo";
              img.dataset.customise = "logo";
              img.className = "w-auto object-contain";
              img.style.height = "var(--logo-height, 36px)";
              fallback.replaceWith(img);
            }
          }
          // Hide header business name when a logo is shown.
          if (businessName) businessName.style.display = "none";

          // Mirror to the footer: show logo, hide footer name.
          if (footerLogo) {
            footerLogo.removeAttribute("srcset");
            footerLogo.src = logoUrl;
            footerLogo.style.display = "";
          } else {
            // Footer had no logo before — inject one at the same position as the name.
            if (footerName?.parentElement) {
              const img = document.createElement("img");
              img.src = logoUrl;
              img.alt = "Logo";
              img.dataset.customise = "footer-logo";
              img.className = "w-auto object-contain";
              img.style.height = "var(--logo-height, 36px)";
              footerName.parentElement.insertBefore(img, footerName);
            }
          }
          if (footerName) footerName.style.display = "none";
        } else {
          // Removing the logo: swap header img back to text fallback, restore name.
          const logo = document.querySelector<HTMLImageElement>('img[data-customise="logo"]');
          if (logo) {
            const span = document.createElement("span");
            span.dataset.customise = "logo-fallback";
            span.className =
              "grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--accent)] text-sm font-black text-[var(--accent-fg)]";
            span.textContent = (businessName?.textContent ?? "?").trim().charAt(0).toUpperCase();
            logo.replaceWith(span);
          }
          if (businessName) businessName.style.display = "";

          // Footer: hide the logo, show the name back.
          if (footerLogo) footerLogo.style.display = "none";
          if (footerName) footerName.style.display = "";
        }
      }
    }

    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, []);

  return null;
}
