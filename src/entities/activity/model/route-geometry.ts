import type { ITrackPoint } from './activity.types';
import { getSeriesRange, type TrackSeries } from './activity-analysis';
import type { RouteColorMode } from '@/shared/lib/color/color-scales';

export type RouteShape = {
  /** Interleaved x,y pairs in a box whose longer side is 1. */
  points: Float32Array;
  /** Width / height of the shape box (both ≤ 1, the larger one equals 1). */
  width: number;
  height: number;
  /** Distance along the route (0–1) for each kept point; drives drawing animations. */
  progress: Float32Array;
  /** Index of each kept point in the original track. */
  indices: Int32Array;
  /** Colour position (0–1) for each kept point for every metric. NaN when there is no data. */
  metrics: Record<Exclude<RouteColorMode, 'solid'>, Float32Array>;
  metricRanges: Partial<Record<Exclude<RouteColorMode, 'solid'>, { min: number; max: number }>>;
};

const DEFAULT_MAX_POINTS = 1400;

/** Picks indices evenly spaced by distance so the shape keeps its detail on long routes. */
export function sampleIndicesByDistance(distance: Float64Array, maxPoints: number): number[] {
  const length = distance.length;

  if (length <= maxPoints) {
    return Array.from({ length }, (_, index) => index);
  }

  const total = distance[length - 1] ?? 0;
  const step = total / (maxPoints - 1);
  const indices = [0];
  let next = step;

  for (let index = 1; index < length - 1; index += 1) {
    if (distance[index]! >= next) {
      indices.push(index);
      next = distance[index]! + step;
    }
  }

  indices.push(length - 1);
  return indices;
}

/**
 * Equirectangular projection with longitude scaled by cos(latitude), so that one metre
 * east and one metre north take the same space and the route keeps its real proportions.
 */
export function buildRouteShape(
  track: ITrackPoint[],
  series: TrackSeries,
  maxPoints = DEFAULT_MAX_POINTS,
): RouteShape {
  const indices = sampleIndicesByDistance(series.distance, maxPoints);

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const point of track) {
    if (!Number.isFinite(point.longitude) || !Number.isFinite(point.latitude)) {
      continue;
    }

    minLon = Math.min(minLon, point.longitude);
    maxLon = Math.max(maxLon, point.longitude);
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
  }

  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lonScale = Math.max(Math.cos(midLat), 0.01);
  const rawWidth = Math.max((maxLon - minLon) * lonScale, 1e-9);
  const rawHeight = Math.max(maxLat - minLat, 1e-9);
  const size = Math.max(rawWidth, rawHeight);

  const points = new Float32Array(indices.length * 2);
  const progress = new Float32Array(indices.length);
  const total = series.distance[series.distance.length - 1] || 1;

  indices.forEach((trackIndex, order) => {
    const point = track[trackIndex]!;
    points[order * 2] = ((point.longitude - minLon) * lonScale) / size;
    points[order * 2 + 1] = (maxLat - point.latitude) / size;
    progress[order] = series.distance[trackIndex]! / total;
  });

  const metricSource = {
    pace: series.pace,
    heartRate: series.heartRate,
    elevation: series.elevation,
  };

  const metrics = {} as RouteShape['metrics'];
  const metricRanges: RouteShape['metricRanges'] = {};

  for (const key of Object.keys(metricSource) as (keyof typeof metricSource)[]) {
    const values = metricSource[key];
    const range = getSeriesRange(
      values,
      key === 'elevation' ? 0 : 0.05,
      key === 'elevation' ? 1 : 0.95,
    );
    const result = new Float32Array(indices.length).fill(Number.NaN);

    if (range) {
      metricRanges[key] = range;
      const span = range.max - range.min || 1;

      indices.forEach((trackIndex, order) => {
        const value = values[trackIndex]!;

        if (Number.isFinite(value)) {
          const t = (value - range.min) / span;
          // Lower pace numbers mean faster running, so the pace scale is inverted.
          result[order] = Math.min(1, Math.max(0, key === 'pace' ? 1 - t : t));
        }
      });

      fillGaps(result);
    }

    metrics[key] = result;
  }

  return {
    points,
    indices: Int32Array.from(indices),
    width: rawWidth / size,
    height: rawHeight / size,
    progress,
    metrics,
    metricRanges,
  };
}

/** Carries the last known value over NaN gaps (pauses, missing sensor data). */
function fillGaps(values: Float32Array) {
  let last = Number.NaN;

  for (let index = 0; index < values.length; index += 1) {
    if (Number.isNaN(values[index]!)) {
      values[index] = last;
    } else {
      last = values[index]!;
    }
  }

  const first = values.find((value) => !Number.isNaN(value)) ?? 0.5;

  for (let index = 0; index < values.length && Number.isNaN(values[index]!); index += 1) {
    values[index] = first;
  }
}
