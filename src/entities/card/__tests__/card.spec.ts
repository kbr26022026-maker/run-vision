import { describe, expect, it } from 'vitest';
import { analyzeActivity } from '@/entities/activity/model/activity-analysis';
import type { IActivity } from '@/entities/activity/model/activity.types';
import { buildTrack, steadyRun } from '@/entities/activity/model/__tests__/track-fixtures';
import { sampleScale, getLuminance } from '@/shared/lib/color/color-scales';
import { buildCardData, getAnimatedStat, getDefaultStats } from '../card-data';
import { getVideoTimeline } from '../export/export-video';
import { clampPhotoTransform, getPhotoPlacement } from '../render/background';

function activityFrom(meters: number, pace: number): IActivity {
  const track = buildTrack(steadyRun(meters, pace));

  return {
    id: 'test',
    name: 'Тест',
    startedAt: track[0]!.timestamp,
    finishedAt: track[track.length - 1]!.timestamp,
    durationSeconds: 0,
    distanceMeters: 0,
    averagePaceSecondsPerKm: 0,
    track,
  };
}

describe('buildCardData', () => {
  const activity = activityFrom(3000, 300);
  const data = buildCardData(activity, analyzeActivity(activity));

  it('formats the headline stats', () => {
    expect(data.stats.distance.value).toBe('3.00');
    expect(data.stats.duration.value).toBe('15:00');
    expect(data.stats.pace.value).toBe('5:00');
  });

  it('counts up distance and time for the video', () => {
    expect(getAnimatedStat(data, 'distance', 0.5).value).toBe('1.50');
    expect(getAnimatedStat(data, 'duration', 0).value).toBe('0:00');
    expect(getAnimatedStat(data, 'pace', 0.2).value).toBe('5:00');
  });

  it('suggests only stats that exist in the file', () => {
    expect(getDefaultStats(data)).toEqual(['distance', 'duration', 'pace', 'heartRate']);
  });
});

describe('getVideoTimeline', () => {
  it('holds the finished card at the end', () => {
    expect(getVideoTimeline(0, 15)).toBe(0);
    expect(getVideoTimeline(14, 15)).toBe(1);
    expect(getVideoTimeline(6, 15)).toBeGreaterThan(0.4);
    expect(getVideoTimeline(6, 15)).toBeLessThan(0.6);
  });
});

describe('photo placement', () => {
  const photo = { width: 4000, height: 3000 };

  it('covers the card at zoom 1', () => {
    const placement = getPhotoPlacement(photo, 1080, 1920, { x: 0, y: 0, scale: 1 });

    expect(placement.h).toBeCloseTo(1920);
    expect(placement.w).toBeGreaterThanOrEqual(1080);
  });

  it('never lets the photo reveal the card edge', () => {
    const clamped = clampPhotoTransform(photo, 1080, 1920, { x: 5, y: 5, scale: 0.2 });
    const placement = getPhotoPlacement(photo, 1080, 1920, clamped);

    expect(clamped.scale).toBe(1);
    expect(clamped.y).toBe(0);
    expect(placement.x).toBeLessThanOrEqual(0);
    expect(placement.x + placement.w).toBeGreaterThanOrEqual(1080);
  });
});

describe('colour helpers', () => {
  it('samples scale endpoints exactly', () => {
    const stops = [
      [0, '#000000'],
      [1, '#ffffff'],
    ] as const;

    expect(sampleScale(stops, 0)).toBe('#000000');
    expect(sampleScale(stops, 1)).toBe('#ffffff');
    expect(sampleScale(stops, 0.5)).toBe('#808080');
  });

  it('computes luminance', () => {
    expect(getLuminance('#ffffff')).toBeCloseTo(1);
    expect(getLuminance('#000000')).toBeCloseTo(0);
  });
});
