import { getLuminance, withAlpha } from '@/shared/lib/color/color-scales';
import { formatPace } from '@/shared/lib/formatters/formatters';
import type { RenderEnv } from '../env';
import { clamp01, drawText, easeOutCubic, type Rect } from '../kit';
import {
  drawHeader,
  drawRouteInRect,
  drawStatsGrid,
  getColors,
  getPhases,
  measureStatsGrid,
} from './common';
import { renderMinimal } from './minimal';

function onAccentColor(accent: string) {
  return getLuminance(accent) > 0.45 ? '#0a0a0b' : '#ffffff';
}

function drawRows(env: RenderEnv, area: Rect) {
  const { ctx, u, data } = env;
  const colors = getColors(env);
  const phases = getPhases(env.t);
  const splits = data.splits;
  const paces = splits.filter((split) => !split.isPartial).map((split) => split.paceSecondsPerKm);
  const fastest = Math.min(
    ...(paces.length ? paces : splits.map((split) => split.paceSecondsPerKm)),
  );
  const slowest = Math.max(
    ...(paces.length ? paces : splits.map((split) => split.paceSecondsPerKm)),
  );
  const span = slowest - fastest || 1;
  // Few splits get big, chunky bars; many splits shrink to fit.
  const rowHeight = Math.min(150 * u, area.h / splits.length);
  const barHeight = rowHeight * 0.7;
  const labelSize = Math.min(40 * u, rowHeight * 0.34);
  const labelWidth = labelSize * 2.6;
  const barArea = area.w - labelWidth;
  const top = area.y + (area.h - rowHeight * splits.length) / 2;

  splits.forEach((split, index) => {
    const y = top + index * rowHeight + (rowHeight - barHeight) / 2;
    const ratio = 1 - clamp01((split.paceSecondsPerKm - fastest) / span);
    const grow = easeOutCubic(clamp01(phases.route * (splits.length + 3) - index));
    const barWidth = barArea * (0.42 + ratio * 0.58) * grow;
    const isFastest = !split.isPartial && split.paceSecondsPerKm === fastest;
    const label = split.isPartial ? (split.distanceMeters / 1000).toFixed(1) : `${split.index + 1}`;

    drawText(ctx, label, area.x, y + barHeight / 2 + labelSize * 0.36, {
      size: labelSize,
      weight: 650,
      color: colors.muted,
      shadow: colors.shadow,
    });

    if (barWidth <= 0) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(area.x + labelWidth, y, barWidth, barHeight, barHeight * 0.28);
    ctx.fillStyle = isFastest
      ? colors.accent
      : withAlpha(colors.text, env.isBusyBackground ? 0.22 : 0.12);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = grow;
    const paceSize = Math.min(54 * u, barHeight * 0.5);
    drawText(
      ctx,
      formatPace(split.paceSecondsPerKm),
      area.x + labelWidth + 26 * u,
      y + barHeight / 2 + paceSize * 0.36,
      {
        size: paceSize,
        weight: 700,
        family: 'display',
        color: isFastest ? onAccentColor(colors.accent) : colors.text,
        tracking: -0.02,
      },
    );

    if (isFastest) {
      const badgeSize = Math.min(26 * u, barHeight * 0.3);
      drawText(
        ctx,
        'ЛУЧШИЙ',
        area.x + labelWidth + barWidth - 26 * u,
        y + barHeight / 2 + badgeSize * 0.36,
        {
          size: badgeSize,
          weight: 800,
          color: onAccentColor(colors.accent),
          tracking: 0.14,
          align: 'right',
        },
      );
    }

    ctx.restore();
  });
}

function drawColumns(env: RenderEnv, area: Rect) {
  const { ctx, u, data } = env;
  const colors = getColors(env);
  const phases = getPhases(env.t);
  const splits = data.splits;
  const paces = splits.map((split) => split.paceSecondsPerKm);
  const fastest = Math.min(...paces);
  const slowest = Math.max(...paces);
  const span = slowest - fastest || 1;
  const gap = Math.max(4 * u, (area.w / splits.length) * 0.18);
  const barWidth = (area.w - gap * (splits.length - 1)) / splits.length;
  const labelSpace = 50 * u;
  const chartHeight = area.h - labelSpace - 60 * u;
  const step = Math.ceil(splits.length / 10);

  splits.forEach((split, index) => {
    const ratio = 1 - clamp01((split.paceSecondsPerKm - fastest) / span);
    const grow = easeOutCubic(clamp01(phases.route * (splits.length / 4 + 2) - index / 4));
    const height = chartHeight * (0.3 + ratio * 0.7) * grow;
    const x = area.x + index * (barWidth + gap);
    const bottom = area.y + 60 * u + chartHeight;
    const isFastest = split.paceSecondsPerKm === fastest && !split.isPartial;

    ctx.beginPath();
    ctx.roundRect(x, bottom - height, barWidth, height, Math.min(barWidth / 2, 10 * u));
    ctx.fillStyle = isFastest
      ? colors.accent
      : withAlpha(colors.text, env.isBusyBackground ? 0.3 : 0.16);
    ctx.fill();

    if (isFastest && grow > 0.9) {
      drawText(
        ctx,
        formatPace(split.paceSecondsPerKm),
        x + barWidth / 2,
        bottom - height - 18 * u,
        {
          size: 32 * u,
          weight: 700,
          family: 'display',
          color: colors.accent,
          align: 'center',
          shadow: colors.shadow,
        },
      );
    }

    if (index % step === 0 || index === splits.length - 1) {
      drawText(ctx, `${index + 1}`, x + barWidth / 2, bottom + 40 * u, {
        size: 24 * u,
        weight: 600,
        color: colors.muted,
        align: 'center',
        shadow: colors.shadow,
      });
    }
  });
}

export function renderSplits(env: RenderEnv) {
  const { W, H, safe, u, data } = env;

  if (data.splits.length < 2) {
    renderMinimal(env);
    return;
  }

  const x = safe.side;
  const width = W - safe.side * 2;
  const routeSize = env.format === 'square' ? 180 * u : 230 * u;

  drawRouteInRect(
    env,
    { x: W - safe.side - routeSize, y: safe.top, w: routeSize, h: routeSize },
    7,
    {
      markers: false,
    },
  );

  const headerBottom = drawHeader(env, {
    x,
    y: safe.top,
    width: width - routeSize - 30 * u,
    titleSize: 64,
  });
  const stats = env.settings.stats.slice(0, 3);
  const statOptions = { columns: Math.max(1, stats.length), valueSize: 58 };
  const statsHeight = measureStatsGrid(env, stats, statOptions);
  const statsTop = H - safe.bottom - statsHeight;
  const chartTop = Math.max(headerBottom, safe.top + routeSize) + 110 * u;
  const chartArea = { x, y: chartTop, w: width, h: statsTop - 70 * u - chartTop };

  drawText(env.ctx, 'ТЕМП ПО КИЛОМЕТРАМ', x, chartTop - 18 * u, {
    size: 24 * u,
    weight: 650,
    color: getColors(env).muted,
    tracking: 0.14,
    shadow: getColors(env).shadow,
  });

  const maxRows = Math.floor(chartArea.h / (48 * u));

  if (data.splits.length <= Math.min(14, maxRows)) {
    drawRows(env, chartArea);
  } else {
    drawColumns(env, chartArea);
  }

  drawStatsGrid(env, stats, { x, y: statsTop, w: width, h: statsHeight }, statOptions);
}
