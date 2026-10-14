import type { IActivity } from '@/entities/activity/model/activity.types';
import type { ActivityAnalysis, ActivitySplit } from '@/entities/activity/model/activity-analysis';
import {
  buildRouteShape,
  sampleIndicesByDistance,
  type RouteShape,
} from '@/entities/activity/model/route-geometry';
import {
  formatActivityDate,
  formatClock,
  formatDistanceKm,
  formatHeartRate,
  formatPace,
  formatTimeOfDay,
} from '@/shared/lib/formatters/formatters';
import type { StatDisplay, StatKey } from './card.types';

export const STAT_LABELS: Record<StatKey, string> = {
  distance: 'Дистанция',
  duration: 'Время',
  pace: 'Темп',
  heartRate: 'Пульс',
  maxHeartRate: 'Макс. пульс',
  cadence: 'Каденс',
  elevationGain: 'Набор высоты',
  bestPace: 'Лучший км',
  startTime: 'Старт',
};

export const ALL_STATS: StatKey[] = [
  'distance',
  'duration',
  'pace',
  'heartRate',
  'elevationGain',
  'cadence',
  'maxHeartRate',
  'bestPace',
  'startTime',
];

export type CardData = {
  activityId: string;
  activityName: string;
  date: string;
  time: string;
  startedAt: Date;
  stats: Record<StatKey, StatDisplay>;
  available: Record<StatKey, boolean>;
  shape: RouteShape;
  /** Track coordinates of the shape points, for projecting onto a map snapshot. */
  shapeLngLat: Float64Array;
  splits: ActivitySplit[];
  /** Smoothed elevation profile, normalised to 0–1, ~160 samples. */
  elevationProfile: Float32Array;
  distanceMeters: number;
  movingSeconds: number;
  paceRange: { min: number; max: number } | null;
  heartRateRange: { min: number; max: number } | null;
  elevationRange: { min: number; max: number } | null;
};

export function buildCardData(activity: IActivity, analysis: ActivityAnalysis): CardData {
  const { summary, series, splits } = analysis;
  const shape = buildRouteShape(activity.track, series, 1200);

  const shapeLngLat = new Float64Array(shape.indices.length * 2);
  shape.indices.forEach((trackIndex, order) => {
    const point = activity.track[trackIndex]!;
    shapeLngLat[order * 2] = point.longitude;
    shapeLngLat[order * 2 + 1] = point.latitude;
  });

  const profileIndices = sampleIndicesByDistance(series.distance, 160);
  const profileValues = profileIndices.map((index) => series.elevation[index]!);
  const minElevation = Math.min(...profileValues);
  const maxElevation = Math.max(...profileValues);
  const elevationSpan = Math.max(maxElevation - minElevation, 25);
  const elevationProfile = Float32Array.from(
    profileValues.map((value) => (value - minElevation) / elevationSpan),
  );

  const hasHeartRate = summary.averageHeartRate !== null;
  const hasCadence = summary.averageCadence !== null;

  const stats: Record<StatKey, StatDisplay> = {
    distance: {
      label: STAT_LABELS.distance,
      value: formatDistanceKm(summary.distanceMeters),
      unit: 'км',
    },
    duration: { label: STAT_LABELS.duration, value: formatClock(summary.movingSeconds), unit: '' },
    pace: {
      label: STAT_LABELS.pace,
      value: formatPace(summary.averagePaceSecondsPerKm),
      unit: '/км',
    },
    heartRate: {
      label: STAT_LABELS.heartRate,
      value: formatHeartRate(summary.averageHeartRate),
      unit: 'уд/мин',
    },
    maxHeartRate: {
      label: STAT_LABELS.maxHeartRate,
      value: formatHeartRate(summary.maxHeartRate),
      unit: 'уд/мин',
    },
    cadence: {
      label: STAT_LABELS.cadence,
      value: hasCadence ? `${Math.round(summary.averageCadence!)}` : '—',
      unit: 'шаг/мин',
    },
    elevationGain: {
      label: STAT_LABELS.elevationGain,
      value: `${Math.round(summary.elevationGainMeters)}`,
      unit: 'м',
    },
    bestPace: {
      label: STAT_LABELS.bestPace,
      value: formatPace(summary.bestPaceSecondsPerKm),
      unit: '/км',
    },
    startTime: {
      label: STAT_LABELS.startTime,
      value: formatTimeOfDay(activity.startedAt),
      unit: '',
    },
  };

  return {
    activityId: activity.id,
    activityName: activity.name,
    date: formatActivityDate(activity.startedAt),
    time: formatTimeOfDay(activity.startedAt),
    startedAt: activity.startedAt,
    stats,
    available: {
      distance: true,
      duration: true,
      pace: summary.averagePaceSecondsPerKm !== null,
      heartRate: hasHeartRate,
      maxHeartRate: hasHeartRate,
      cadence: hasCadence,
      elevationGain: true,
      bestPace: summary.bestPaceSecondsPerKm !== null,
      startTime: true,
    },
    shape,
    shapeLngLat,
    splits,
    elevationProfile,
    distanceMeters: summary.distanceMeters,
    movingSeconds: summary.movingSeconds,
    paceRange: shape.metricRanges.pace ?? null,
    heartRateRange: shape.metricRanges.heartRate ?? null,
    elevationRange: shape.metricRanges.elevation ?? null,
  };
}

/** Stat values while a video counts up from zero (`progress` 0–1). */
export function getAnimatedStat(data: CardData, key: StatKey, progress: number): StatDisplay {
  const stat = data.stats[key];

  if (progress >= 1) {
    return stat;
  }

  if (key === 'distance') {
    return { ...stat, value: formatDistanceKm(data.distanceMeters * progress) };
  }

  if (key === 'duration') {
    return { ...stat, value: formatClock(data.movingSeconds * progress) };
  }

  return stat;
}

export function getDefaultStats(data: CardData): StatKey[] {
  return (['distance', 'duration', 'pace', 'heartRate', 'elevationGain'] as StatKey[])
    .filter((key) => data.available[key])
    .slice(0, 4);
}
