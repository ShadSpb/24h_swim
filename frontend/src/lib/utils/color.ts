/**
 * Colour helpers for rendering team colours legibly.
 *
 * Team colours are organiser-chosen and now include light values (White,
 * Silver, Yellow) that are nearly invisible on a light card and make white
 * text unreadable. These helpers pick a readable text colour and expose a
 * consistent swatch border so light colours stay visible.
 */

/** Parse a #rrggbb / #rgb string into [r, g, b] (0-255). Falls back to mid-grey. */
function hexToRgb(hex: string): [number, number, number] {
  let h = (hex || '').trim().replace('#', '');
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) {
    return [136, 136, 136]; // #888 fallback
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Perceived luminance (0-255) using the standard YIQ weighting. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Readable text/foreground colour for content drawn on top of `bgHex`.
 * Returns near-black for light backgrounds, white for dark ones.
 */
export function getContrastText(bgHex: string): string {
  return luminance(bgHex) >= 150 ? '#111827' : '#ffffff';
}

/**
 * Tailwind classes for a subtle, always-visible border around a colour swatch,
 * so light colours (White/Silver) don't disappear against a light surface.
 */
export const SWATCH_BORDER = 'border border-black/15 dark:border-white/25';
