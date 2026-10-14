import { describe, expect, it } from 'vitest';
import { buildTrackSeries } from '../activity-analysis';
import { buildRouteShape, sampleIndicesByDistance } from '../route-geometry';
import { buildTrack, type Step } from './track-fixtures';

function squareLoop(side: number): Step[] {
  const step = (east: number, north: number): Step[] =>
    Array.from({ length: side / 10 }, () => ({ east: east * 10, north: north * 10, seconds: 3 }));

  return [...step(1, 0), ...step(0, 1), ...step(-1, 0), ...step(0, -1)];
}

describe('buildRouteShape', () => {
  it('keeps real proportions far from the equator', () => {
    // At 60°N one degree of longitude is half as long as one of latitude;
    // without the cos(latitude) correction a square would come out twice as wide.
    const track = buildTrack(squareLoop(500), { latitude: 60, longitude: 30 });
    const shape = buildRouteShape(track, buildTrackSeries(track));

    expect(shape.width / shape.height).toBeCloseTo(1, 1);
    expect(Math.max(shape.width, shape.height)).toBeCloseTo(1, 5);
  });

  it('maps progress from 0 at the start to 1 at the finish', () => {
    const track = buildTrack(squareLoop(300));
    const shape = buildRouteShape(track, buildTrackSeries(track));

    expect(shape.progress[0]).toBe(0);
    expect(shape.progress[shape.progress.length - 1]).toBeCloseTo(1, 5);
  });

  it('normalises colour metrics to 0–1', () => {
    const track = buildTrack(squareLoop(300));
    const shape = buildRouteShape(track, buildTrackSeries(track));

    for (const value of shape.metrics.pace) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe('sampleIndicesByDistance', () => {
  it('keeps first and last point and limits the count', () => {
    const distance = Float64Array.from({ length: 5000 }, (_, index) => index * 2);
    const indices = sampleIndicesByDistance(distance, 500);

    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(4999);
    expect(indices.length).toBeLessThanOrEqual(501);
  });
});
