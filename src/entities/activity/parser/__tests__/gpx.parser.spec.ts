import { describe, expect, it } from 'vitest';
import { GpxImportError, isGpxFile, parseGpxText } from '../gpx.parser';

function gpx(extensions: (hr: number) => string) {
  const points = [0, 1, 2]
    .map(
      (index) => `
      <trkpt lat="55.75${index}" lon="37.60${index}">
        <ele>120</ele>
        <time>2026-09-26T06:0${index}:00Z</time>
        <extensions>${extensions(140 + index)}</extensions>
      </trkpt>`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
  <gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"
    xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
    xmlns:ns3="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
    <trk><name>Утренняя пробежка</name><trkseg>${points}</trkseg></trk>
  </gpx>`;
}

describe('parseGpxText', () => {
  it('reads Strava heart rate (gpxtpx prefix)', () => {
    const activity = parseGpxText(
      gpx(
        (hr) =>
          `<gpxtpx:TrackPointExtension><gpxtpx:hr>${hr}</gpxtpx:hr></gpxtpx:TrackPointExtension>`,
      ),
    );

    expect(activity.name).toBe('Утренняя пробежка');
    expect(activity.track.map((point) => point.heartRate)).toEqual([140, 141, 142]);
  });

  it('reads Garmin heart rate and cadence (ns3 prefix)', () => {
    const activity = parseGpxText(
      gpx(
        (hr) =>
          `<ns3:TrackPointExtension><ns3:hr>${hr}</ns3:hr><ns3:cad>86</ns3:cad></ns3:TrackPointExtension>`,
      ),
    );

    expect(activity.track[0]!.heartRate).toBe(140);
    expect(activity.track[0]!.cadence).toBe(172);
  });

  it('gives the same id when the same file is imported twice', () => {
    const text = gpx(() => '');
    expect(parseGpxText(text).id).toBe(parseGpxText(text).id);
  });

  it('explains what is wrong with a non-GPX file', () => {
    expect(() => parseGpxText('{"not": "gpx"}')).toThrow(GpxImportError);
  });
});

describe('isGpxFile', () => {
  it('accepts .gpx regardless of case', () => {
    expect(isGpxFile(new File([''], 'Run.GPX'))).toBe(true);
    expect(isGpxFile(new File([''], 'run.fit'))).toBe(false);
  });
});
