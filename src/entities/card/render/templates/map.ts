import type { RenderEnv } from '../env';
import { drawGlassPanel } from '../background';
import { drawText } from '../kit';
import { drawRoute } from '../route';
import {
  drawHeader,
  drawRouteInRect,
  drawStatsGrid,
  getColors,
  getPhases,
  getRouteStyle,
  measureStatsGrid,
} from './common';

/** Layout shares used both here and when framing the map snapshot. */
export function getMapTemplateFrame(W: number, H: number, format: RenderEnv['format']) {
  const top = format === 'story' ? 0.27 : format === 'post' ? 0.22 : 0.22;
  const bottom = format === 'story' ? 0.38 : format === 'post' ? 0.36 : 0.38;

  return {
    top: Math.round(H * top),
    bottom: Math.round(H * bottom),
    side: Math.round(W * 0.1),
  };
}

export function renderMap(env: RenderEnv) {
  const { ctx, W, H, safe, u, assets, format } = env;
  const colors = getColors(env);
  const phases = getPhases(env.t);
  const x = safe.side;
  const width = W - safe.side * 2;
  const frame = getMapTemplateFrame(W, H, format);

  // Darken the top for the title.
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.4);
  top.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  top.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.4);

  if (assets.map) {
    const scaleX = W / assets.map.width;
    const scaleY = H / assets.map.height;
    const points = new Float32Array(assets.map.points.length);

    for (let index = 0; index < points.length; index += 2) {
      points[index] = assets.map.points[index]! * scaleX;
      points[index + 1] = assets.map.points[index + 1]! * scaleY;
    }

    drawRoute(
      ctx,
      env.data.shape,
      points,
      getRouteStyle(env, 10, { casing: 'rgba(0, 0, 0, 0.55)', shadow: false }),
    );
  } else {
    drawRouteInRect(
      env,
      { x: frame.side, y: frame.top, w: W - frame.side * 2, h: H - frame.top - frame.bottom },
      10,
    );

    if (env.t >= 1) {
      drawText(ctx, 'Загружаем карту…', W / 2, H / 2, {
        size: 30 * u,
        weight: 600,
        color: colors.muted,
        align: 'center',
      });
    }
  }

  drawHeader(env, { x, y: safe.top, width });

  if (assets.map) {
    drawText(ctx, assets.map.attribution, W - 24 * u, H - 22 * u, {
      size: 16 * u,
      weight: 500,
      color: 'rgba(255, 255, 255, 0.55)',
      align: 'right',
    });
  }

  const stats = env.settings.stats;
  const padding = 44 * u;
  const statsHeight = measureStatsGrid(env, stats, { valueSize: stats.length > 4 ? 58 : 70 });

  if (stats.length) {
    const panel = {
      x: x - 20 * u,
      y: H - safe.bottom - statsHeight - padding * 2 + 20 * u,
      w: width + 40 * u,
      h: statsHeight + padding * 2,
    };

    ctx.save();
    ctx.globalAlpha = phases.intro;
    drawGlassPanel(env, panel, 40 * u);
    ctx.restore();

    drawStatsGrid(
      env,
      stats,
      { x: panel.x + padding, y: panel.y + padding, w: panel.w - padding * 2, h: statsHeight },
      { valueSize: stats.length > 4 ? 58 : 70 },
    );
  }
}
