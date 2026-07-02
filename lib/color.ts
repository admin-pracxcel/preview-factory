/**
 * lib/color.ts
 *
 * Derive an accent colour from a primary brand colour. Used so users only pick
 * one swatch and get a sensibly contrasting accent for CTAs and icons.
 *
 * Algorithm: complementary hue (180° rotation) in HSL, with saturation lifted
 * to at least 65% and lightness pinned at 50%. The high saturation + mid
 * lightness gives a CTA-friendly tone with strong contrast against the primary
 * (which can be any hue) and good legibility under white text.
 */

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  if (m.length !== 6) return [0, 0, 0];
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(1, s));
  const ll = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) { r = c; g = x; b = 0; }
  else if (hh < 120) { r = x; g = c; b = 0; }
  else if (hh < 180) { r = 0; g = c; b = x; }
  else if (hh < 240) { r = 0; g = x; b = c; }
  else if (hh < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (v: number): string => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Compute a "primary" colour from the user-picked accent — same hue, much
 * darker. Used for section headings, service-card icon tiles, dark CTA bands.
 * The shared hue keeps the palette monochromatic; the low lightness gives the
 * text/icon contrast needed against light backgrounds.
 */
export function derivePrimary(accent: string): string {
  const [r, g, b] = hexToRgb(accent);
  const [h, s] = rgbToHsl(r, g, b);
  // Lightness 0.18 reads as "dark, branded text". Saturation kept healthy.
  return hslToHex(h, Math.max(s, 0.35), 0.18);
}

/**
 * Compute a "secondary" colour from the user-picked accent — same hue, mid
 * darkness. Used for hero gradient overlays and the offer band background.
 * Sits between primary (very dark) and accent (bright).
 */
export function deriveSecondary(accent: string): string {
  const [r, g, b] = hexToRgb(accent);
  const [h, s] = rgbToHsl(r, g, b);
  return hslToHex(h, Math.max(s, 0.45), 0.32);
}

/**
 * Return a readable foreground colour for text/icons drawn ON `bgHex`.
 * Uses the WCAG-style relative luminance formula (sRGB → linear → weighted
 * sum) and flips to dark text for bright backgrounds. Threshold 0.55 chosen
 * so mid-yellow / lime / cyan / white flip to dark; mid-blue / red / green
 * keep white text.
 */
export function readableFgOn(bgHex: string): string {
  const [r, g, b] = hexToRgb(bgHex);
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.55 ? "#111111" : "#ffffff";
}
