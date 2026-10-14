import { getAnimatedStat } from '../../card-data';
import type { RenderEnv } from '../env';
import { drawText, fitFontSize, measureText } from '../kit';
import { drawRouteInRect, getColors, getPhases } from './common';

/** Compact block (route + numbers) designed to be pasted over a photo in Stories. */
export function renderSticker(env: RenderEnv) {
  const { ctx, W, H, safe, u, data, settings } = env;
  const colors = getColors(env);
  const phases = getPhases(env.t);
  const width = W - safe.side * 2;

  const routeHeight = Math.min(H * 0.34, 560 * u);
  const distanceSize = fitFontSize(ctx, `${data.stats.distance.value} км`, width, 168 * u, 90 * u, {
    weight: 800,
    family: 'display',
    tracking: -0.04,
  });
  const secondary = settings.stats
    .filter((key) => key !== 'distance')
    .slice(0, 3)
    .map((key) => {
      const stat = data.stats[key];
      return `${stat.value}${stat.unit ? ` ${stat.unit}` : ''}`;
    })
    .join('   ·   ');
  const lineSize = 40 * u;
  const brandSize = settings.showBrand ? 24 * u : 0;
  const blockHeight =
    routeHeight +
    50 * u +
    distanceSize +
    (secondary ? 30 * u + lineSize : 0) +
    (brandSize ? 40 * u + brandSize : 0);
  const top = safe.top + (H - safe.top - safe.bottom - blockHeight) / 2;

  drawRouteInRect(
    env,
    { x: safe.side + width * 0.08, y: top, w: width * 0.84, h: routeHeight },
    13,
    {
      color: colors.accent,
      shadow: true,
    },
  );

  let y = top + routeHeight + 50 * u + distanceSize * 0.82;
  const distance = getAnimatedStat(data, 'distance', phases.route).value;
  const unitSize = distanceSize * 0.42;
  const numberStyle = {
    size: distanceSize,
    weight: 800,
    family: 'display' as const,
    tracking: -0.04,
  };
  const unitStyle = { size: unitSize, weight: 700, family: 'display' as const };
  // Lay out with the final value so the block does not shift while the number counts up.
  const finalNumberWidth = measureText(ctx, data.stats.distance.value, numberStyle);
  const blockWidth = finalNumberWidth + 16 * u + measureText(ctx, 'км', unitStyle);
  const startX = (W - blockWidth) / 2;

  ctx.save();
  ctx.globalAlpha = phases.intro;
  drawText(ctx, distance, startX, y, { ...numberStyle, color: colors.text, shadow: true });
  drawText(ctx, 'км', startX + finalNumberWidth + 16 * u, y, {
    ...unitStyle,
    color: colors.text,
    shadow: true,
  });
  ctx.restore();

  if (secondary) {
    y += 30 * u + lineSize;
    ctx.save();
    ctx.globalAlpha = phases.outro;
    drawText(ctx, secondary, W / 2, y, {
      size: lineSize,
      weight: 650,
      color: colors.text,
      align: 'center',
      shadow: true,
    });
    ctx.restore();
  }

  if (brandSize) {
    y += 40 * u + brandSize;
    drawText(ctx, 'RUNVISION', W / 2, y, {
      size: brandSize,
      weight: 700,
      family: 'display',
      color: colors.muted,
      tracking: 0.24,
      align: 'center',
      shadow: true,
    });
  }
}
