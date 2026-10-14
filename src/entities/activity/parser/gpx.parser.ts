import { parseGPX } from '@we-gold/gpxjs';
import type { IActivity, ITrackPoint } from '../model/activity.types';

/**
 * Garmin writes `ns3:hr`, Strava `gpxtpx:hr`, others plain `hr` – sometimes nested inside a
 * `*:TrackPointExtension` element. Search by local tag name at any depth.
 */
function findExtensionNumber(value: unknown, localNames: string[], depth = 0): number | undefined {
  if (!value || typeof value !== 'object' || depth > 3) {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>);

  for (const [key, entry] of entries) {
    const localName = key.slice(key.lastIndexOf(':') + 1).toLowerCase();

    if (!localNames.includes(localName)) {
      continue;
    }

    const number = typeof entry === 'number' ? entry : Number(entry);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  for (const [, entry] of entries) {
    const nested = findExtensionNumber(entry, localNames, depth + 1);

    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

function getCadence(value: number | undefined): number | undefined {
  if (value === undefined || value <= 0) {
    return undefined;
  }
  return value * 2;
}

export class GpxImportError extends Error {}

export function isGpxFile(file: File): boolean {
  return /\.gpx$/i.test(file.name) || file.type === 'application/gpx+xml';
}

/** Stable id so that importing the same file twice reuses its history entry. */
function buildActivityId(points: ITrackPoint[], distanceMeters: number): string {
  const first = points[0]!;
  return `${first.timestamp.getTime().toString(36)}-${Math.round(distanceMeters).toString(36)}-${points.length.toString(36)}`;
}

export function parseGpxText(xml: string): IActivity {
  if (!xml.includes('<gpx')) {
    throw new GpxImportError('Это не похоже на GPX-файл. Экспортируйте тренировку в формате .gpx');
  }

  const [parsedFile, error] = parseGPX(xml);

  if (error || !parsedFile) {
    throw new GpxImportError('Не получилось прочитать GPX-файл: он повреждён или неполный');
  }

  const track = parsedFile.tracks[0];

  if (!track || !track.points.length) {
    throw new GpxImportError(
      'В файле нет трека с точками — возможно, это маршрут без записи тренировки',
    );
  }

  const points: ITrackPoint[] = track.points
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
    .map((point) => {
      const cadence = findExtensionNumber(point.extensions, ['cad', 'cadence']);

      return {
        latitude: point.latitude,
        longitude: point.longitude,
        elevation: point.elevation ?? 0,
        timestamp: point.time ?? new Date(0),
        heartRate: findExtensionNumber(point.extensions, ['hr', 'heartrate']),
        cadence: getCadence(cadence),
      };
    });

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (!firstPoint || !lastPoint || points.length < 2) {
    throw new GpxImportError('В треке слишком мало точек, чтобы построить маршрут');
  }

  const durationSeconds = track.duration.movingDuration;
  const distanceMeters = track.distance.total;

  const averagePaceSecondsPerKm =
    distanceMeters > 0 ? durationSeconds / (distanceMeters / 1000) : 0;

  return {
    id: buildActivityId(points, distanceMeters),
    name: track.name?.trim() || parsedFile.metadata.name?.trim() || 'Пробежка',
    startedAt: firstPoint.timestamp,
    finishedAt: lastPoint.timestamp,
    durationSeconds,
    distanceMeters,
    averagePaceSecondsPerKm,
    track: points,
  };
}

export async function parseGpx(file: File): Promise<IActivity> {
  return parseGpxText(await file.text());
}
