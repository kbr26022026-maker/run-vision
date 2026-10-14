import { getAnimatedStat } from '../../card-data';
import type { RenderEnv } from '../env';
import { drawText, fitFontSize, measureText } from '../kit';
import {
  drawHeader,
  drawRouteInRect,
  drawStatsGrid,
  getColors,
  getPhases,
  measureStatsGrid,
} from './common';

/** "Big number": the distance fills the width, everything else supports it. */
export function renderHero(env: RenderEnv) {
  const { ctx, W, H, safe, u, format } = env;
  const colors = getColors(env);
  const phases = getPhases(env.t);
  const x = safe.side;
  const width = W - safe.side * 2;

  const headerBottom = drawHeader(env, { x, y: safe.top, width, titleSize: 58, titleLines: 1 });

  const secondary = env.settings.stats.filter((key) => key !== 'distance').slice(0, 3);
  const rowOptions = {
    columns: Math.max(1, secondary.length),
    valueSize: secondary.length === 3 ? 56 : 70,
    dividers: true,
  };
  const rowHeight = measureStatsGrid(env, secondary, rowOptions);
  const rowTop = H - safe.bottom - rowHeight;

  // Giant distance.
  const distance = getAnimatedStat(env.data, 'distance', phases.route).value;
  const unit = 'КМ';
  const maxNumberSize = format === 'story' ? 400 : format === 'post' ? 300 : 250;
  const unitSizeGuess = maxNumberSize * 0.26;
  const unitWidth =
    measureText(ctx, unit, { size: unitSizeGuess, weight: 600, family: 'condensed' }) + 18 * u;
  // Measure with the final value so the size does not jump while counting up.
  const numberSize = fitFontSize(
    ctx,
    env.data.stats.distance.value,
    width - unitWidth,
    maxNumberSize,
    120,
    {
      weight: 700,
      family: 'condensed',
      tracking: -0.02,
    },
  );
  const numberBaseline = rowTop - (secondary.length ? 70 : 0) * u;

  ctx.save();
  ctx.globalAlpha = phases.intro;
  const numberWidth = drawText(ctx, distance, x - numberSize * 0.03, numberBaseline, {
    size: numberSize,
    weight: 700,
    family: 'condensed',
    color: colors.text,
    tracking: -0.02,
    shadow: colors.shadow,
  });
  drawText(ctx, unit, x + numberWidth + 14 * u, numberBaseline, {
    size: numberSize * 0.26,
    weight: 600,
    family: 'condensed',
    color: colors.accent === colors.text ? colors.muted : colors.accent,
    tracking: 0.04,
    shadow: colors.shadow,
  });
  ctx.restore();

  const numberTop = numberBaseline - numberSize * 0.78;
  const routeTop = headerBottom + 60 * u;
  const routeBottom = numberTop - 50 * u;

  if (routeBottom - routeTop > 120 * u) {
    drawRouteInRect(
      env,
      { x: x + width * 0.08, y: routeTop, w: width * 0.84, h: routeBottom - routeTop },
      11,
    );
  }

  if (secondary.length) {
    ctx.save();
    ctx.fillStyle = colors.faint;
    ctx.globalAlpha = phases.intro;
    ctx.fillRect(x, rowTop - 36 * u, width, 2);
    ctx.restore();
    drawStatsGrid(env, secondary, { x, y: rowTop, w: width, h: rowHeight }, rowOptions);
  }
}
