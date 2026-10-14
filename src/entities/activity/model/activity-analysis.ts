import type { IActivity, ITrackPoint } from './activity.types';
import { getDistanceMeters } from './elevation/elevation-calculations';

/** Segments slower than this are treated as standing still and excluded from moving time. */
const MIN_MOVING_SPEED_MPS = 0.5;
/** Gaps longer than this (auto-pause, lost signal) never count as moving. */
const MAX_MOVING_GAP_SECONDS = 30;
/** Half-width of the distance window used to smooth the instantaneous pace. */
const PACE_WINDOW_METERS = 120;
const ELEVATION_SMOOTHING_POINTS = 7;

export type TrackSeries = {
  /** Cumulative distance from the start, meters. */
  distance: Float64Array;
  /** Seconds since the first point, including pauses. */
  elapsed: Float64Array;
  /** Seconds of movement since the first point. */
  moving: Float64Array;
  /** Smoothed pace, seconds per km (NaN while standing). */
  pace: Float64Array;
  elevation: Float64Array;
  heartRate: Float64Array;
  cadence: Float64Array;
};

export type ActivitySplit = {
  index: number;
  /** Length of the split in meters (1000 except for the last partial one). */
  distanceMeters: number;
  durationSeconds: number;
  paceSecondsPerKm: number;
  averageHeartRate: number | null;
  elevationGainMeters: number;
  isPartial: boolean;
};

export type ActivitySummary = {
  distanceMeters: number;
  movingSeconds: number;
  elapsedSeconds: number;
  averagePaceSecondsPerKm: number | null;
  bestPaceSecondsPerKm: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  averageCadence: number | null;
  elevationGainMeters: number;
  elevationLossMeters: number;
  minElevation: number | null;
  maxElevation: number | null;
};

export type ActivityAnalysis = {
  series: TrackSeries;
  summary: ActivitySummary;
  splits: ActivitySplit[];
};

export function buildTrackSeries(track: ITrackPoint[]): TrackSeries {
  const length = track.length;
  const distance = new Float64Array(length);
  const elapsed = new Float64Array(length);
  const moving = new Float64Array(length);
  const pace = new Float64Array(length).fill(Number.NaN);
  const elevation = new Float64Array(length);
  const heartRate = new Float64Array(length).fill(Number.NaN);
  const cadence = new Float64Array(length).fill(Number.NaN);

  const startTime = track[0]?.timestamp.getTime() ?? 0;

  for (let index = 0; index < length; index += 1) {
    const point = track[index]!;
    elevation[index] = point.elevation;
    elapsed[index] = (point.timestamp.getTime() - startTime) / 1000;

    if (point.heartRate !== undefined && point.heartRate > 0) {
      heartRate[index] = point.heartRate;
    }

    if (point.cadence !== undefined && point.cadence > 0) {
      cadence[index] = point.cadence;
    }

    if (index === 0) {
      continue;
    }

    const previous = track[index - 1]!;
    const step = getDistanceMeters(
      previous.latitude,
      previous.longitude,
      point.latitude,
      point.longitude,
    );
    const dt = elapsed[index]! - elapsed[index - 1]!;

    distance[index] = distance[index - 1]! + step;

    const isMoving = dt > 0 && dt <= MAX_MOVING_GAP_SECONDS && step / dt >= MIN_MOVING_SPEED_MPS;
    moving[index] = moving[index - 1]! + (isMoving ? dt : 0);
  }

  smoothInPlace(elevation, ELEVATION_SMOOTHING_POINTS);
  fillPace(distance, moving, pace);

  return { distance, elapsed, moving, pace, elevation, heartRate, cadence };
}

function smoothInPlace(values: Float64Array, windowSize: number) {
  if (values.length <= 2) {
    return;
  }

  const half = Math.floor(windowSize / 2);
  const source = Float64Array.from(values);

  for (let index = 0; index < values.length; index += 1) {
    const from = Math.max(0, index - half);
    const to = Math.min(values.length - 1, index + half);
    let sum = 0;

    for (let cursor = from; cursor <= to; cursor += 1) {
      sum += source[cursor]!;
    }

    values[index] = sum / (to - from + 1);
  }
}

function fillPace(distance: Float64Array, moving: Float64Array, pace: Float64Array) {
  const length = distance.length;
  let left = 0;
  let right = 0;

  for (let index = 0; index < length; index += 1) {
    const center = distance[index]!;

    while (left < index && center - distance[left]! > PACE_WINDOW_METERS) {
      left += 1;
    }

    if (right < index) {
      right = index;
    }

    while (right < length - 1 && distance[right + 1]! - center <= PACE_WINDOW_METERS) {
      right += 1;
    }

    const meters = distance[right]! - distance[left]!;
    const seconds = moving[right]! - moving[left]!;

    if (meters >= 20 && seconds > 0) {
      pace[index] = seconds / (meters / 1000);
    }
  }
}

/** Linear interpolation of `values` at a given cumulative distance. */
export function valueAtDistance(
  distance: Float64Array,
  values: Float64Array,
  targetMeters: number,
): number {
  const length = distance.length;

  if (length === 0) {
    return 0;
  }

  if (targetMeters <= distance[0]!) {
    return values[0]!;
  }

  if (targetMeters >= distance[length - 1]!) {
    return values[length - 1]!;
  }

  let low = 0;
  let high = length - 1;

  while (high - low > 1) {
    const middle = (low + high) >> 1;

    if (distance[middle]! <= targetMeters) {
      low = middle;
    } else {
      high = middle;
    }
  }

  const span = distance[high]! - distance[low]!;
  const ratio = span > 0 ? (targetMeters - distance[low]!) / span : 0;

  return values[low]! + (values[high]! - values[low]!) * ratio;
}

export function buildSplits(series: TrackSeries, splitMeters = 1000): ActivitySplit[] {
  const total = series.distance[series.distance.length - 1] ?? 0;
  const splits: ActivitySplit[] = [];

  if (total < 50) {
    return splits;
  }

  let from = 0;
  let index = 0;

  while (from < total - 1) {
    const to = Math.min(from + splitMeters, total);
    const length = to - from;

    // A trailing split shorter than 10% of a full one adds noise rather than information.
    if (length < splitMeters * 0.1 && splits.length > 0) {
      break;
    }

    const duration =
      valueAtDistance(series.distance, series.moving, to) -
      valueAtDistance(series.distance, series.moving, from);

    let heartRateSum = 0;
    let heartRateCount = 0;
    let gain = 0;
    let previousElevation = valueAtDistance(series.distance, series.elevation, from);

    for (let cursor = 0; cursor < series.distance.length; cursor += 1) {
      const meters = series.distance[cursor]!;

      if (meters < from || meters > to) {
        continue;
      }

      const heartRate = series.heartRate[cursor]!;

      if (!Number.isNaN(heartRate)) {
        heartRateSum += heartRate;
        heartRateCount += 1;
      }

      const elevation = series.elevation[cursor]!;

      if (elevation > previousElevation) {
        gain += elevation - previousElevation;
      }

      previousElevation = elevation;
    }

    splits.push({
      index,
      distanceMeters: length,
      durationSeconds: duration,
      paceSecondsPerKm: length > 0 ? duration / (length / 1000) : 0,
      averageHeartRate: heartRateCount > 0 ? heartRateSum / heartRateCount : null,
      elevationGainMeters: gain,
      isPartial: length < splitMeters - 1,
    });

    from = to;
    index += 1;
  }

  return splits;
}

function averageOf(values: Float64Array): number | null {
  let sum = 0;
  let count = 0;

  for (const value of values) {
    if (!Number.isNaN(value)) {
      sum += value;
      count += 1;
    }
  }

  return count > 0 ? sum / count : null;
}

function maxOf(values: Float64Array): number | null {
  let max = -Infinity;

  for (const value of values) {
    if (!Number.isNaN(value) && value > max) {
      max = value;
    }
  }

  return Number.isFinite(max) ? max : null;
}

export function buildSummary(series: TrackSeries, splits: ActivitySplit[]): ActivitySummary {
  const last = series.distance.length - 1;
  const distanceMeters = last >= 0 ? series.distance[last]! : 0;
  const movingSeconds = last >= 0 ? series.moving[last]! : 0;
  const elapsedSeconds = last >= 0 ? series.elapsed[last]! : 0;

  let gain = 0;
  let loss = 0;
  let minElevation = Infinity;
  let maxElevation = -Infinity;

  for (let index = 0; index < series.elevation.length; index += 1) {
    const elevation = series.elevation[index]!;
    minElevation = Math.min(minElevation, elevation);
    maxElevation = Math.max(maxElevation, elevation);

    if (index > 0) {
      const delta = elevation - series.elevation[index - 1]!;

      if (delta > 0) {
        gain += delta;
      } else {
        loss -= delta;
      }
    }
  }

  const fullSplits = splits.filter((split) => !split.isPartial);
  const bestPace = fullSplits.length
    ? Math.min(...fullSplits.map((split) => split.paceSecondsPerKm))
    : null;

  return {
    distanceMeters,
    movingSeconds,
    elapsedSeconds,
    averagePaceSecondsPerKm: distanceMeters > 0 ? movingSeconds / (distanceMeters / 1000) : null,
    bestPaceSecondsPerKm: bestPace,
    averageHeartRate: averageOf(series.heartRate),
    maxHeartRate: maxOf(series.heartRate),
    averageCadence: averageOf(series.cadence),
    elevationGainMeters: gain,
    elevationLossMeters: loss,
    minElevation: Number.isFinite(minElevation) ? minElevation : null,
    maxElevation: Number.isFinite(maxElevation) ? maxElevation : null,
  };
}

export function analyzeActivity(activity: IActivity): ActivityAnalysis {
  const series = buildTrackSeries(activity.track);
  const splits = buildSplits(series);

  return {
    series,
    splits,
    summary: buildSummary(series, splits),
  };
}

/** Robust range of a series (ignores NaN and clips outliers by percentile). */
export function getSeriesRange(
  values: Float64Array,
  lowPercentile = 0.05,
  highPercentile = 0.95,
): { min: number; max: number } | null {
  const finite = Array.from(values).filter((value) => Number.isFinite(value));

  if (finite.length === 0) {
    return null;
  }

  finite.sort((a, b) => a - b);

  const pick = (percentile: number) =>
    finite[Math.min(finite.length - 1, Math.max(0, Math.round((finite.length - 1) * percentile)))]!;

  const min = pick(lowPercentile);
  const max = pick(highPercentile);

  return max > min ? { min, max } : { min: min - 1, max: max + 1 };
}
