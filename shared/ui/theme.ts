/** Resolve branding + overrides into CSS variables and concrete values. */
import type { CSSProperties } from "react";
import type { SiteProps } from "@/shared/types/site-props";
import { readableFgOn } from "@/lib/color";

export interface ResolvedTheme {
  vars: CSSProperties;
  primary: string;
  secondary: string;
  accent: string;
  logo: string;
  heroImage: string;
  chromeTheme: "light" | "dark";
  logoHeightPx: number;
}

/**
 * Overrides win over branding (per the canonical schema contract). Returns the
 * `--primary/--secondary/--accent` CSS variables every section reads from, plus
 * the resolved logo and hero image URLs.
 */
export function resolveTheme(
  branding: SiteProps["branding"],
  overrides?: SiteProps["overrides"],
): ResolvedTheme {
  const primary = overrides?.primary_color ?? branding.primary_color;
  const secondary = overrides?.secondary_color ?? branding.secondary_color ?? primary;
  const accent = overrides?.accent_color ?? branding.accent_color ?? primary;
  // For images, an empty-string override means "user explicitly removed it" —
  // don't fall through to branding. `undefined` means "no override set".
  const logo = overrides?.logo_url !== undefined
    ? overrides.logo_url
    : (branding.logo_url ?? "");
  const heroImage = overrides?.hero_image_url !== undefined
    ? overrides.hero_image_url
    : (branding.hero_image_url ?? "");

  // Chrome (header, footer, areas-we-service) is neutral — black or white —
  // never tinted by the brand colour. Default is light. The CSS vars
  // `--chrome-bg` and `--chrome-fg` are read by those sections.
  const chromeTheme: "light" | "dark" = overrides?.chrome_theme ?? "light";
  const chromeBg = chromeTheme === "dark" ? "#000000" : "#ffffff";
  const chromeFg = chromeTheme === "dark" ? "#ffffff" : "#111111";

  const logoHeightPx = overrides?.logo_height_px ?? 36;

  // Companion "foreground" colours — text/icon colour that stays legible when
  // drawn ON the corresponding background. Lets buttons use
  // `text-[var(--accent-fg)]` instead of hardcoded white so a bright accent
  // (yellow, lime) automatically switches to dark text.
  const accentFg = readableFgOn(accent);
  const primaryFg = readableFgOn(primary);

  const vars = {
    "--primary": primary,
    "--primary-fg": primaryFg,
    "--secondary": secondary,
    "--accent": accent,
    "--accent-fg": accentFg,
    "--chrome-bg": chromeBg,
    "--chrome-fg": chromeFg,
    "--logo-height": `${logoHeightPx}px`,
  } as CSSProperties;

  return { vars, primary, secondary, accent, logo, heroImage, chromeTheme, logoHeightPx };
}
