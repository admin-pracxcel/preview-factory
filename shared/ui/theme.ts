/** Resolve branding + overrides into CSS variables and concrete values. */
import type { CSSProperties } from "react";
import type { SiteProps } from "@/shared/types/site-props";

export interface ResolvedTheme {
  vars: CSSProperties;
  primary: string;
  secondary: string;
  accent: string;
  logo: string;
  heroImage: string;
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
  const secondary = branding.secondary_color ?? primary;
  const accent = overrides?.accent_color ?? branding.accent_color ?? primary;
  const logo = overrides?.logo_url || branding.logo_url || "";
  const heroImage = overrides?.hero_image_url || branding.hero_image_url || "";

  const vars = {
    "--primary": primary,
    "--secondary": secondary,
    "--accent": accent,
  } as CSSProperties;

  return { vars, primary, secondary, accent, logo, heroImage };
}
