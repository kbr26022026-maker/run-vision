import { getScaleStops, withAlpha } from '@/shared/lib/color/color-scales';
import { formatHeartRate, formatPace } from '@/shared/lib/formatters/formatters';
import type { RenderEnv } from '../env';
import { drawText } from '../kit';
import { getPointsBounds } from '../route';
import {
  drawHeader,
  drawRouteInRect,
  drawStatsGrid,
  getColors,
  getPhases,
  measureStatsGrid,
} from './common';

function drawSynthGrid(env: RenderEnv, color: string) {
  const { ctx, W, H } = env;
  const horizon = H * 0.66;
  const depth = H - horizon;

  ctx.save();
  ctx.lineWidth = 2;

  // Horizontal lines bunch up toward the horizon and fade into it, like a perspective floor.
  for (let index = 1; index <= 14; index += 1) {
    const ratio = (index / 14) ** 1.9;
    const y = horizon + depth * ratio;
    ctx.strokeStyle = withAlpha(color, 0.18 * Math.min(1, ratio * 2.2));
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  const vertical = ctx.createLinearGradient(0, horizon, 0, H);
  vertical.addColorStop(0, withAlpha(color, 0));
  vertical.addColorStop(0.35, withAlpha(color, 0.1));
  vertical.addColorStop(1, withAlpha(color, 0.2));
  ctx.strokeStyle = vertical;

  for (let index = -10; index <= 10; index += 1) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + index * 18, horizon);
    ctx.lineTo(W / 2 + index * W * 0.16, H);
    ctx.stroke();
  }

  ctx.restore();
}

function legendLabels(env: RenderEnv): [string, string, string] | null {
  const mode = env.settings.routeColorMode;

  if (mode === 'pace' && env.data.paceRange) {
    return [
      'ТЕМП',
      `${formatPace(env.data.paceRange.max)} медленнее`,
      `быстрее ${formatPace(env.data.paceRange.min)}`,
    ];
  }

  if (mode === 'heartRate' && env.data.heartRateRange) {
    return [
      'ПУЛЬС',
      `${formatHeartRate(env.data.heartRateRange.min)} уд/мин`,
      `${formatHeartRate(env.data.heartRateRange.max)} уд/мин`,
    ];
  }

  if (mode === 'elevation' && env.data.elevationRange) {
    return [
      'ВЫСОТА',
      `${Math.round(env.data.elevationRange.min)} м`,
      `${Math.round(env.data.elevationRange.max)} м`,
    ];
  }

  return null;
}

export function renderNeon(env: RenderEnv) {
  const { ctx, W, H, safe, u, settings } = env;
  const colors = getColors(env);
  const phases = getPhases(env.t);
  const x = safe.side;
  const width = W - safe.side * 2;

  if (settings.backgroundMode === 'palette') {
    drawSynthGrid(env, colors.accent);
  }

  const headerBottom = drawHeader(env, { x, y: safe.top, width, align: 'center', titleSize: 72 });

  const stats = settings.stats.slice(0, 3);
  const statOptions = {
    columns: Math.max(1, stats.length),
    valueSize: 64,
    align: 'center' as const,
    valueColor: colors.accent,
  };
  const statsHeight = measureStatsGrid(env, stats, statOptions);
  const statsTop = H - safe.bottom - statsHeight;

  const legend = legendLabels(env);
  const legendHeight = legend ? 90 * u : 0;
  const legendTop = statsTop - 70 * u - legendHeight;

  const routeRect = {
    x: x + 30 * u,
    y: headerBottom + 80 * u,
    w: width - 60 * u,
    h: legendTop - 60 * u - (headerBottom + 80 * u),
  };

  // Halo behind the route.
  if (settings.backgroundMode !== 'transparent') {
    const center = { x: routeRect.x + routeRect.w / 2, y: routeRect.y + routeRect.h / 2 };
    const radius = Math.max(routeRect.w, routeRect.h) * 0.6;
    const halo = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
    halo.addColorStop(0, withAlpha(colors.accent, 0.18 * phases.intro));
    halo.addColorStop(1, withAlpha(colors.accent, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
  }

  const points = drawRouteInRect(env, routeRect, 12, { glow: true });
  const bounds = getPointsBounds(points);

  if (legend) {
    const barWidth = Math.min(width * 0.62, Math.max(bounds.w, width * 0.45));
    const barX = (W - barWidth) / 2;
    const barY = legendTop + 44 * u;
    const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    const stops = getScaleStops(
      settings.routeColorMode === 'solid' ? 'pace' : settings.routeColorMode,
    );
    stops.forEach(([position, color]) => gradient.addColorStop(position, color));

    ctx.save();
    ctx.globalAlpha = phases.outro;
    drawText(ctx, legend[0], W / 2, legendTop + 22 * u, {
      size: 22 * u,
      weight: 700,
      color: colors.muted,
      tracking: 0.2,
      align: 'center',
      shadow: colors.shadow,
    });
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, 12 * u, 6 * u);
    ctx.fill();
    drawText(ctx, legend[1], barX, barY + 50 * u, {
      size: 24 * u,
      weight: 600,
      color: colors.muted,
      shadow: colors.shadow,
    });
    drawText(ctx, legend[2], barX + barWidth, barY + 50 * u, {
      size: 24 * u,
      weight: 600,
      color: colors.muted,
      align: 'right',
      shadow: colors.shadow,
    });
    ctx.restore();
  }

  drawStatsGrid(env, stats, { x, y: statsTop, w: width, h: statsHeight }, statOptions);
}
