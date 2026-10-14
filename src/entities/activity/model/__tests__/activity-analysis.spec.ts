import { describe, expect, it } from 'vitest';
import { buildSplits, buildSummary, buildTrackSeries, valueAtDistance } from '../activity-analysis';
import { buildTrack, steadyRun } from './track-fixtures';

describe('buildTrackSeries', () => {
  it('accumulates distance and moving time', () => {
    const series = buildTrackSeries(buildTrack(steadyRun(2000, 300)));

    expect(series.distance[series.distance.length - 1]).toBeCloseTo(2000, -1);
    expect(series.moving[series.moving.length - 1]).toBeCloseTo(600, 0);
  });

  it('excludes standing still from moving time', () => {
    const track = buildTrack([
      ...steadyRun(1000, 300),
      { east: 0, north: 0, seconds: 20 }, // waiting at a traffic light
      ...steadyRun(1000, 300),
    ]);
    const series = buildTrackSeries(track);

    expect(series.elapsed[series.elapsed.length - 1]).toBeCloseTo(620, 0);
    expect(series.moving[series.moving.length - 1]).toBeCloseTo(600, 0);
  });

  it('computes a smoothed pace close to the real one', () => {
    const series = buildTrackSeries(buildTrack(steadyRun(1500, 330)));
    const middle = Math.floor(series.pace.length / 2);

    expect(series.pace[middle]).toBeCloseTo(330, 0);
  });
});

describe('buildSplits', () => {
  it('creates one split per kilometre with its own pace', () => {
    const track = buildTrack([
      ...steadyRun(1000, 360),
      ...steadyRun(1000, 300),
      ...steadyRun(500, 330),
    ]);
    const splits = buildSplits(buildTrackSeries(track));

    expect(splits).toHaveLength(3);
    expect(splits[0]!.paceSecondsPerKm).toBeCloseTo(360, 0);
    expect(splits[1]!.paceSecondsPerKm).toBeCloseTo(300, 0);
    expect(splits[2]!.isPartial).toBe(true);
    expect(splits[2]!.distanceMeters).toBeCloseTo(500, -1);
  });

  it('drops a tiny trailing split', () => {
    const splits = buildSplits(buildTrackSeries(buildTrack(steadyRun(2050, 300))));

    expect(splits).toHaveLength(2);
  });
});

describe('buildSummary', () => {
  it('reports average and best pace and heart rate', () => {
    const track = buildTrack([...steadyRun(1000, 360, 10, 140), ...steadyRun(1000, 300, 10, 160)]);
    const series = buildTrackSeries(track);
    const summary = buildSummary(series, buildSplits(series));

    expect(summary.averagePaceSecondsPerKm).toBeCloseTo(330, 0);
    expect(summary.bestPaceSecondsPerKm).toBeCloseTo(300, 0);
    expect(summary.averageHeartRate).toBeCloseTo(150, 0);
    expect(summary.maxHeartRate).toBe(160);
  });
});

describe('valueAtDistance', () => {
  it('interpolates between samples', () => {
    const distance = Float64Array.from([0, 100, 200]);
    const values = Float64Array.from([0, 10, 30]);

    expect(valueAtDistance(distance, values, 150)).toBe(20);
    expect(valueAtDistance(distance, values, -5)).toBe(0);
    expect(valueAtDistance(distance, values, 500)).toBe(30);
  });
});
