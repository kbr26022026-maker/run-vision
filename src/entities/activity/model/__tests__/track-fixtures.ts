import type { ITrackPoint } from '../activity.types';

const METERS_PER_DEGREE_LAT = 111_195;

export type Step = {
  east: number;
  north: number;
  seconds: number;
  heartRate?: number;
};

/** Builds a track from metre offsets so tests can reason about exact distances. */
export function buildTrack(
  steps: Step[],
  start = { latitude: 55.75, longitude: 37.6 },
): ITrackPoint[] {
  const metersPerDegreeLon = METERS_PER_DEGREE_LAT * Math.cos((start.latitude * Math.PI) / 180);
  let east = 0;
  let north = 0;
  let time = Date.UTC(2026, 8, 26, 6, 0, 0);

  const points: ITrackPoint[] = [
    {
      latitude: start.latitude,
      longitude: start.longitude,
      elevation: 100,
      timestamp: new Date(time),
    },
  ];

  for (const step of steps) {
    east += step.east;
    north += step.north;
    time += step.seconds * 1000;

    points.push({
      latitude: start.latitude + north / METERS_PER_DEGREE_LAT,
      longitude: start.longitude + east / metersPerDegreeLon,
      elevation: 100,
      timestamp: new Date(time),
      heartRate: step.heartRate,
    });
  }

  return points;
}

/** A straight run east at a constant pace. */
export function steadyRun(
  meters: number,
  paceSecondsPerKm: number,
  stepMeters = 10,
  heartRate = 150,
): Step[] {
  const count = Math.round(meters / stepMeters);
  return Array.from({ length: count }, () => ({
    east: stepMeters,
    north: 0,
    seconds: (paceSecondsPerKm * stepMeters) / 1000,
    heartRate,
  }));
}
