import type { ExpressionSpecification } from 'maplibre-gl';
import type { RouteShape } from '@/entities/activity/model/route-geometry';
import { sampleScale, getScaleStops, type RouteColorMode } from '@/shared/lib/color/color-scales';

const GRADIENT_STOPS = 96;

/** Builds a `line-gradient` expression that colours the route along its length. */
export function buildRouteGradient(
  shape: RouteShape,
  mode: RouteColorMode,
  solidColor: string,
): ExpressionSpecification {
  if (mode === 'solid') {
    // `line-gradient` only accepts expressions, so a solid colour is a two-stop gradient.
    return ['interpolate', ['linear'], ['line-progress'], 0, solidColor, 1, solidColor];
  }

  const metric = shape.metrics[mode];
  const stops = getScaleStops(mode);
  const expression: unknown[] = ['interpolate', ['linear'], ['line-progress']];
  let cursor = 0;
  let lastPosition = -1;

  for (let step = 0; step <= GRADIENT_STOPS; step += 1) {
    const position = step / GRADIENT_STOPS;

    while (cursor < shape.progress.length - 1 && shape.progress[cursor + 1]! <= position) {
      cursor += 1;
    }

    // Average a small neighbourhood so single GPS spikes do not produce colour flicker.
    let sum = 0;
    let count = 0;
    const radius = Math.max(1, Math.round(shape.progress.length / GRADIENT_STOPS / 2));

    for (let offset = -radius; offset <= radius; offset += 1) {
      const value = metric[cursor + offset];

      if (value !== undefined && Number.isFinite(value)) {
        sum += value;
        count += 1;
      }
    }

    if (position <= lastPosition) {
      continue;
    }

    expression.push(position, sampleScale(stops, count ? sum / count : 0.5));
    lastPosition = position;
  }

  return expression as ExpressionSpecification;
}
