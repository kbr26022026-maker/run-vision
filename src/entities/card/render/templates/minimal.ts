import type { RenderEnv } from '../env';
import { drawHeader, drawRouteInRect, drawStatsGrid, measureStatsGrid } from './common';

export function renderMinimal(env: RenderEnv) {
  const { W, H, safe, u } = env;
  const x = safe.side;
  const width = W - safe.side * 2;

  const headerBottom = drawHeader(env, { x, y: safe.top, width });
  const stats = env.settings.stats;
  const statsHeight = measureStatsGrid(env, stats);
  const statsTop = H - safe.bottom - statsHeight;
  const routeTop = headerBottom + 72 * u;
  const routeBottom = statsTop - (stats.length ? 88 : 0) * u;

  drawRouteInRect(
    env,
    { x: x + 20 * u, y: routeTop, w: width - 40 * u, h: routeBottom - routeTop },
    13,
  );
  drawStatsGrid(env, stats, { x, y: statsTop, w: width, h: statsHeight });
}
