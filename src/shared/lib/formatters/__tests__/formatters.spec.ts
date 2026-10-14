import { describe, expect, it } from 'vitest';
import { formatClock, formatDistanceKm, formatPace } from '../formatters';

describe('formatPace', () => {
  it('formats minutes and seconds per km', () => {
    expect(formatPace(373)).toBe('6:13');
  });

  it('rounds up into the next minute instead of printing :60', () => {
    expect(formatPace(359.6)).toBe('6:00');
  });

  it('returns a dash for missing or invalid values', () => {
    expect(formatPace(null)).toBe('—');
    expect(formatPace(Number.NaN)).toBe('—');
    expect(formatPace(0)).toBe('—');
  });
});

describe('formatClock', () => {
  it('uses m:ss under an hour', () => {
    expect(formatClock(1886)).toBe('31:26');
  });

  it('uses h:mm:ss from an hour', () => {
    expect(formatClock(3725)).toBe('1:02:05');
  });
});

describe('formatDistanceKm', () => {
  it('prints kilometres with two decimals', () => {
    expect(formatDistanceKm(5049)).toBe('5.05');
  });
});
