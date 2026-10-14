export type RouteColorMode = 'solid' | 'pace' | 'heartRate' | 'elevation';

type ColorStop = readonly [position: number, color: string];

/** Slow → fast. */
const PACE_SCALE: ColorStop[] = [
  [0, '#3b6cff'],
  [0.3, '#22d3ee'],
  [0.55, '#a3e635'],
  [0.78, '#facc15'],
  [1, '#ff4d2e'],
];

/** Easy → max effort, roughly following heart rate zones. */
const HEART_RATE_SCALE: ColorStop[] = [
  [0, '#60a5fa'],
  [0.35, '#34d399'],
  [0.6, '#facc15'],
  [0.8, '#fb923c'],
  [1, '#ef4444'],
];

/** Low → high ground. */
const ELEVATION_SCALE: ColorStop[] = [
  [0, '#2dd4bf'],
  [0.5, '#c084fc'],
  [1, '#f472b6'],
];

export const ROUTE_COLOR_SCALES: Record<Exclude<RouteColorMode, 'solid'>, ColorStop[]> = {
  pace: PACE_SCALE,
  heartRate: HEART_RATE_SCALE,
  elevation: ELEVATION_SCALE,
};

export const ROUTE_COLOR_MODE_LABELS: Record<RouteColorMode, string> = {
  solid: 'Однотонный',
  pace: 'Темп',
  heartRate: 'Пульс',
  elevation: 'Высота',
};

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  let value = hex.trim().replace('#', '');

  if (value.length === 3) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const number = Number.parseInt(value.slice(0, 6), 16);

  if (Number.isNaN(number)) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mixColors(from: string, to: string, ratio: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);

  return rgbToHex({
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
  });
}

/** WCAG relative luminance, 0 (black) – 1 (white). */
export function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function sampleScale(stops: readonly ColorStop[], position: number): string {
  const t = Math.min(1, Math.max(0, Number.isFinite(position) ? position : 0));

  for (let index = 1; index < stops.length; index += 1) {
    const [rightPosition, rightColor] = stops[index]!;

    if (t <= rightPosition) {
      const [leftPosition, leftColor] = stops[index - 1]!;
      const span = rightPosition - leftPosition || 1;
      return mixColors(leftColor, rightColor, (t - leftPosition) / span);
    }
  }

  return stops[stops.length - 1]![1];
}

export function getScaleStops(mode: Exclude<RouteColorMode, 'solid'>): readonly ColorStop[] {
  return ROUTE_COLOR_SCALES[mode];
}
