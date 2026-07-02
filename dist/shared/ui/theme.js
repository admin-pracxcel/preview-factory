"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTheme = resolveTheme;
/**
 * Overrides win over branding (per the canonical schema contract). Returns the
 * `--primary/--secondary/--accent` CSS variables every section reads from, plus
 * the resolved logo and hero image URLs.
 */
function resolveTheme(branding, overrides) {
    const primary = overrides?.primary_color ?? branding.primary_color;
    const secondary = branding.secondary_color ?? primary;
    const accent = overrides?.accent_color ?? branding.accent_color ?? primary;
    const logo = overrides?.logo_url || branding.logo_url || "";
    const heroImage = overrides?.hero_image_url || branding.hero_image_url || "";
    const vars = {
        "--primary": primary,
        "--secondary": secondary,
        "--accent": accent,
    };
    return { vars, primary, secondary, accent, logo, heroImage };
}
