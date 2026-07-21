import { describe, it, expect } from 'vitest';
import { getContrastText } from '@/lib/utils/color';

describe('getContrastText', () => {
  it('uses dark text on light team colours', () => {
    expect(getContrastText('#ffffff')).toBe('#111827'); // White
    expect(getContrastText('#c0c0c0')).toBe('#111827'); // Silver
    expect(getContrastText('#eab308')).toBe('#111827'); // Yellow
  });

  it('uses light text on dark team colours', () => {
    expect(getContrastText('#000000')).toBe('#ffffff'); // Black
    expect(getContrastText('#3b82f6')).toBe('#ffffff'); // Blue
    expect(getContrastText('#ef4444')).toBe('#ffffff'); // Red
  });

  it('falls back safely on malformed input', () => {
    expect(getContrastText('')).toBe('#ffffff');       // #888 fallback → light
    expect(getContrastText('not-a-color')).toBe('#ffffff');
  });

  it('supports 3-digit shorthand hex', () => {
    expect(getContrastText('#fff')).toBe('#111827');
    expect(getContrastText('#000')).toBe('#ffffff');
  });
});
