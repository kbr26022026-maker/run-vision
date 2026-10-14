export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export type Rect = { x: number; y: number; w: number; h: number };

export const FONTS = {
  display: '"Unbounded Variable", "Inter Variable", sans-serif',
  ui: '"Inter Variable", system-ui, sans-serif',
  condensed: '"Oswald Variable", "Inter Variable", sans-serif',
  mono: '"JetBrains Mono Variable", ui-monospace, monospace',
} as const;

export type FontFamily = keyof typeof FONTS;

export type TextStyle = {
  size: number;
  weight?: number;
  family?: FontFamily;
  color: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  /** Letter spacing in em. */
  tracking?: number;
  alpha?: number;
  /** Soft drop shadow, for text over photos and maps. */
  shadow?: boolean;
};

const supportsLetterSpacing =
  typeof CanvasRenderingContext2D !== 'undefined' &&
  'letterSpacing' in CanvasRenderingContext2D.prototype;

export function applyFont(
  ctx: Ctx,
  style: Pick<TextStyle, 'size' | 'weight' | 'family' | 'tracking'>,
) {
  ctx.font = `${style.weight ?? 600} ${style.size}px ${FONTS[style.family ?? 'ui']}`;

  if (supportsLetterSpacing) {
    (ctx as CanvasRenderingContext2D).letterSpacing = `${(style.tracking ?? 0) * style.size}px`;
  }
}

export function measureText(
  ctx: Ctx,
  value: string,
  style: Pick<TextStyle, 'size' | 'weight' | 'family' | 'tracking'>,
) {
  applyFont(ctx, style);
  return ctx.measureText(value).width;
}

export function drawText(ctx: Ctx, value: string, x: number, y: number, style: TextStyle) {
  if (!value) {
    return 0;
  }

  ctx.save();
  applyFont(ctx, style);
  ctx.fillStyle = style.color;
  ctx.textAlign = style.align ?? 'left';
  ctx.textBaseline = style.baseline ?? 'alphabetic';
  ctx.globalAlpha *= style.alpha ?? 1;

  if (style.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = Math.max(8, style.size * 0.35);
    ctx.shadowOffsetY = Math.max(1, style.size * 0.04);
  }

  ctx.fillText(value, x, y);
  const width = ctx.measureText(value).width;
  ctx.restore();

  return width;
}

/** Largest font size (≤ max) at which the text fits the width. */
export function fitFontSize(
  ctx: Ctx,
  value: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  style: Pick<TextStyle, 'weight' | 'family' | 'tracking'>,
) {
  const width = measureText(ctx, value, { ...style, size: maxSize });

  if (width <= maxWidth) {
    return maxSize;
  }

  return Math.max(minSize, Math.floor((maxSize * maxWidth) / width));
}

/** Greedy word wrap with an ellipsis on the last allowed line. */
export function wrapText(
  ctx: Ctx,
  value: string,
  maxWidth: number,
  maxLines: number,
  style: Pick<TextStyle, 'size' | 'weight' | 'family' | 'tracking'>,
): string[] {
  applyFont(ctx, style);
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  const kept = lines.slice(0, maxLines);
  let last = `${kept[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`;

  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1);
  }

  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

export function roundRectPath(ctx: Ctx, rect: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
}

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** Progress of `t` inside the [from, to] window, 0–1. */
export function phase(t: number, from: number, to: number) {
  return clamp01((t - from) / (to - from));
}

export function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

let grainPattern: HTMLCanvasElement | null = null;

/** A small tile of random noise; a few percent of it makes flat colours feel printed, not digital. */
export function getGrainTile(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  if (!grainPattern) {
    grainPattern = document.createElement('canvas');
    grainPattern.width = 160;
    grainPattern.height = 160;
    const context = grainPattern.getContext('2d')!;
    const image = context.createImageData(160, 160);

    for (let index = 0; index < image.data.length; index += 4) {
      const value = Math.random() * 255;
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }

    context.putImageData(image, 0, 0);
  }

  return grainPattern;
}

export function drawGrain(ctx: Ctx, width: number, height: number, strength = 0.05) {
  const tile = getGrainTile();

  if (!tile) {
    return;
  }

  const pattern = ctx.createPattern(tile, 'repeat');

  if (!pattern) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = strength;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
