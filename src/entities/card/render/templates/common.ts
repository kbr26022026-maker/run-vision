import { getLuminance, withAlpha } from '@/shared/lib/color/color-scales';
import { getAnimatedStat } from '../../card-data';
import type { StatKey } from '../../card.types';
import type { RenderEnv } from '../env';
import {
  drawText,
  easeInOutCubic,
  easeOutCubic,
  fitFontSize,
  measureText,
  phase,
  wrapText,
  type FontFamily,
  type Rect,
} from '../kit';
import { drawRoute, projectShape, type RouteStyle } from '../route';

export type Phases = {
  /** Header and frame fade-in. */
  intro: number;
  /** Route drawing and count-up. */
  route: number;
  /** Late elements (secondary stats, legends). */
  outro: number;
};

export function getPhases(t: number): Phases {
  if (t >= 1) {
    return { intro: 1, route: 1, outro: 1 };
  }

  return {
    intro: easeOutCubic(phase(t, 0, 0.14)),
    route: easeInOutCubic(phase(t, 0.08, 0.74)),
    outro: easeOutCubic(phase(t, 0.68, 0.86)),
  };
}

export type Colors = {
  text: string;
  muted: string;
  faint: string;
  accent: string;
  shadow: boolean;
};

export function getColors(env: RenderEnv): Colors {
  const busy = env.isBusyBackground;
  const transparent = env.settings.backgroundMode === 'transparent';
  const text = busy ? '#ffffff' : env.palette.text;
  let accent = env.palette.accent;

  // A dark accent disappears on a darkened photo.
  if (busy && getLuminance(accent) < 0.12) {
    accent = '#ffffff';
  }

  return {
    text,
    muted: withAlpha(text, busy ? 0.75 : 0.62),
    faint: withAlpha(text, busy ? 0.4 : 0.22),
    accent,
    shadow: busy || transparent,
  };
}

/** Route stroke settings shared by the templates. */
export function getRouteStyle(
  env: RenderEnv,
  baseWidth: number,
  overrides: Partial<RouteStyle> = {},
): RouteStyle {
  const colors = getColors(env);

  return {
    color: colors.accent,
    mode: env.settings.routeColorMode,
    width: baseWidth * env.settings.routeWidth,
    glow: env.settings.routeGlow,
    progress: getPhases(env.t).route,
    shadow: colors.shadow,
    markers: true,
    markerFill: env.isBusyBackground ? '#0a0a0b' : env.palette.background,
    ...overrides,
  };
}

export function drawRouteInRect(
  env: RenderEnv,
  rect: Rect,
  baseWidth: number,
  overrides: Partial<RouteStyle> = {},
) {
  const points = projectShape(env.data.shape, rect);
  drawRoute(env.ctx, env.data.shape, points, getRouteStyle(env, baseWidth, overrides));
  return points;
}

export function getEyebrow(env: RenderEnv): string {
  const parts: string[] = [];

  if (env.settings.showBrand) {
    parts.push('RUNVISION');
  }

  if (env.settings.showDate) {
    parts.push(env.data.date.toUpperCase());
  }

  return parts.join('  ·  ');
}

export type HeaderOptions = {
  x: number;
  y: number;
  width: number;
  align?: CanvasTextAlign;
  titleSize?: number;
  titleLines?: number;
  titleFamily?: FontFamily;
  eyebrowColor?: string;
  titleColor?: string;
};

/** Eyebrow (brand · date) and title. Returns the y below the block. */
export function drawHeader(env: RenderEnv, options: HeaderOptions): number {
  const { ctx, u } = env;
  const colors = getColors(env);
  const alpha = getPhases(env.t).intro;
  const align = options.align ?? 'left';
  const anchorX =
    align === 'center'
      ? options.x + options.width / 2
      : align === 'right'
        ? options.x + options.width
        : options.x;
  let y = options.y;

  ctx.save();
  ctx.globalAlpha = alpha;

  const eyebrow = getEyebrow(env);

  if (eyebrow) {
    const size = 26 * u;
    drawText(ctx, eyebrow, anchorX, y + size, {
      size,
      weight: 650,
      color: options.eyebrowColor ?? colors.muted,
      tracking: 0.16,
      align,
      shadow: colors.shadow,
    });
    y += size + 22 * u;
  }

  if (env.title) {
    const family = options.titleFamily ?? 'display';
    const maxSize = (options.titleSize ?? 80) * u;
    const lines = wrapText(ctx, env.title, options.width, options.titleLines ?? 2, {
      size: maxSize,
      weight: 700,
      family,
      tracking: -0.03,
    });
    const longest = lines.reduce(
      (max, line) =>
        Math.max(
          max,
          measureText(ctx, line, { size: maxSize, weight: 700, family, tracking: -0.03 }),
        ),
      0,
    );
    const size =
      longest > options.width ? Math.floor((maxSize * options.width) / longest) : maxSize;
    const lineHeight = size * 1.08;

    lines.forEach((line, index) => {
      drawText(ctx, line, anchorX, y + size * 0.92 + index * lineHeight, {
        size,
        weight: 700,
        family,
        color: options.titleColor ?? colors.text,
        tracking: -0.03,
        align,
        shadow: colors.shadow,
      });
    });

    y += size * 0.92 + (lines.length - 1) * lineHeight + 8 * u;
  }

  ctx.restore();
  return y;
}

export type StatsGridOptions = {
  columns?: number;
  valueSize?: number;
  labelSize?: number;
  rowGap?: number;
  valueFamily?: FontFamily;
  valueColor?: string;
  labelColor?: string;
  align?: CanvasTextAlign;
  dividers?: boolean;
  /** Grow upward from the rect's bottom edge instead of down from its top. */
  anchorBottom?: boolean;
};

export function getStatColumns(count: number): number {
  if (count <= 1) return 1;
  if (count === 2 || count === 4) return 2;
  return 3;
}

/** Height of a stats grid for layout purposes. */
export function measureStatsGrid(
  env: RenderEnv,
  keys: StatKey[],
  options: StatsGridOptions = {},
): number {
  if (keys.length === 0) {
    return 0;
  }

  const columns = options.columns ?? getStatColumns(keys.length);
  const rows = Math.ceil(keys.length / columns);
  const valueSize = (options.valueSize ?? (columns === 3 ? 66 : 84)) * env.u;
  const labelSize = (options.labelSize ?? 24) * env.u;
  const rowGap = (options.rowGap ?? 44) * env.u;
  const rowHeight = labelSize + 14 * env.u + valueSize;

  return rows * rowHeight + (rows - 1) * rowGap;
}

export function drawStatsGrid(
  env: RenderEnv,
  keys: StatKey[],
  rect: Rect,
  options: StatsGridOptions = {},
) {
  if (keys.length === 0) {
    return;
  }

  const { ctx, u } = env;
  const colors = getColors(env);
  const phases = getPhases(env.t);
  const columns = options.columns ?? getStatColumns(keys.length);
  const valueFamily = options.valueFamily ?? 'display';
  const baseValueSize = (options.valueSize ?? (columns === 3 ? 66 : 84)) * u;
  const labelSize = (options.labelSize ?? 24) * u;
  const rowGap = (options.rowGap ?? 44) * u;
  const columnGap = 32 * u;
  const cellWidth = (rect.w - columnGap * (columns - 1)) / columns;
  const rowHeight = labelSize + 14 * u + baseValueSize;
  const totalHeight = measureStatsGrid(env, keys, options);
  const top = options.anchorBottom ? rect.y + rect.h - totalHeight : rect.y;
  const align = options.align ?? 'left';

  keys.forEach((key, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cellX = rect.x + column * (cellWidth + columnGap);
    const cellY = top + row * (rowHeight + rowGap);
    const stat = getAnimatedStat(env.data, key, phases.route);
    const isCounting = key === 'distance' || key === 'duration';
    const alpha = isCounting ? phases.intro : Math.max(phases.outro, env.t >= 1 ? 1 : 0);
    const anchorX = align === 'center' ? cellX + cellWidth / 2 : cellX;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (options.dividers && column > 0) {
      ctx.fillStyle = colors.faint;
      ctx.fillRect(cellX - columnGap / 2, cellY, 2, rowHeight);
    }

    drawText(ctx, stat.label.toUpperCase(), anchorX, cellY + labelSize, {
      size: labelSize,
      weight: 650,
      color: options.labelColor ?? colors.muted,
      tracking: 0.12,
      align,
      shadow: colors.shadow,
    });

    // Keep value + unit inside the cell by shrinking long values (e.g. 1:02:13).
    const unitSize = baseValueSize * 0.36;
    const unitWidth = stat.unit
      ? measureText(ctx, stat.unit, { size: unitSize, weight: 600 }) + 10 * u
      : 0;
    const valueSize = fitFontSize(
      ctx,
      stat.value,
      cellWidth - unitWidth,
      baseValueSize,
      baseValueSize * 0.55,
      {
        weight: 700,
        family: valueFamily,
        tracking: -0.03,
      },
    );
    const baseline = cellY + labelSize + 14 * u + baseValueSize * 0.86;
    const valueWidth = measureText(ctx, stat.value, {
      size: valueSize,
      weight: 700,
      family: valueFamily,
      tracking: -0.03,
    });
    const startX = align === 'center' ? anchorX - (valueWidth + unitWidth) / 2 : anchorX;

    drawText(ctx, stat.value, startX, baseline, {
      size: valueSize,
      weight: 700,
      family: valueFamily,
      color: options.valueColor ?? colors.text,
      tracking: -0.03,
      shadow: colors.shadow,
    });

    if (stat.unit) {
      drawText(ctx, stat.unit, startX + valueWidth + 10 * u, baseline, {
        size: unitSize,
        weight: 600,
        color: colors.muted,
        shadow: colors.shadow,
      });
    }

    ctx.restore();
  });
}

export function drawFooterBrand(
  env: RenderEnv,
  x: number,
  y: number,
  align: CanvasTextAlign = 'left',
) {
  if (!env.settings.showBrand) {
    return;
  }

  const colors = getColors(env);
  drawText(env.ctx, 'RUNVISION', x, y, {
    size: 22 * env.u,
    weight: 700,
    family: 'display',
    color: colors.faint,
    tracking: 0.2,
    align,
    shadow: colors.shadow,
  });
}
