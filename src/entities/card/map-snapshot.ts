import * as maplibregl from 'maplibre-gl';
import maplibreWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import {
  addHillshade,
  addTerrainSources,
  getMapStyle,
  type MapStyleId,
} from '@/shared/lib/map/map-styles';
import type { CardData } from './card-data';
import { CARD_FORMATS, type CardFormat } from './card.types';
import type { MapSnapshot } from './render/env';
import { getMapTemplateFrame } from './render/templates/map';

maplibregl.setWorkerUrl(maplibreWorker);

const SNAPSHOT_TIMEOUT_MS = 15000;

export function getMapSnapshotKey(data: CardData, format: CardFormat, style: MapStyleId) {
  return `${data.activityId}:${format}:${style}`;
}

export const MAP_ATTRIBUTION: Record<MapStyleId, string> = {
  dark: '© OpenStreetMap · OpenFreeMap',
  light: '© OpenStreetMap · OpenFreeMap',
  satellite: '© Esri, Maxar',
};

/**
 * Renders the route's area into an off-screen MapLibre map at the card's exact pixel size and
 * returns the image plus the route projected into the same pixel space.
 */
export async function createMapSnapshot(
  data: CardData,
  format: CardFormat,
  style: MapStyleId,
): Promise<MapSnapshot> {
  const { width, height } = CARD_FORMATS[format];
  const pixelRatio = 2;
  const cssWidth = width / pixelRatio;
  const cssHeight = height / pixelRatio;
  const frame = getMapTemplateFrame(width, height, format);

  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    left: '-20000px',
    top: '0',
    width: `${cssWidth}px`,
    height: `${cssHeight}px`,
    pointerEvents: 'none',
  });
  document.body.appendChild(container);

  const bounds = new maplibregl.LngLatBounds();

  for (let index = 0; index < data.shapeLngLat.length; index += 2) {
    bounds.extend([data.shapeLngLat[index]!, data.shapeLngLat[index + 1]!]);
  }

  const map = new maplibregl.Map({
    container,
    style: getMapStyle(style),
    interactive: false,
    attributionControl: false,
    pixelRatio,
    fadeDuration: 0,
    canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
    bounds,
    fitBoundsOptions: {
      padding: {
        top: frame.top / pixelRatio,
        bottom: frame.bottom / pixelRatio,
        left: frame.side / pixelRatio,
        right: frame.side / pixelRatio,
      },
      maxZoom: 16.5,
    },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error('Карта загружается слишком долго')),
        SNAPSHOT_TIMEOUT_MS,
      );

      map.on('style.load', () => {
        if (style !== 'satellite') {
          addTerrainSources(map);
          addHillshade(map, style);
        }
      });

      map.on('error', (event) => {
        // Single missing tiles are not fatal; the idle event still fires.
        console.warn('[RunVision] Ошибка карты:', event.error?.message);
      });

      map.once('idle', () => {
        window.clearTimeout(timer);
        resolve();
      });
    });

    const points = new Float32Array(data.shapeLngLat.length);

    for (let index = 0; index < data.shapeLngLat.length; index += 2) {
      const projected = map.project([data.shapeLngLat[index]!, data.shapeLngLat[index + 1]!]);
      points[index] = projected.x * pixelRatio;
      points[index + 1] = projected.y * pixelRatio;
    }

    const source = map.getCanvas();
    const image = document.createElement('canvas');
    image.width = width;
    image.height = height;
    image.getContext('2d')!.drawImage(source, 0, 0, width, height);

    return {
      key: getMapSnapshotKey(data, format, style),
      image,
      width,
      height,
      points,
      attribution: MAP_ATTRIBUTION[style],
    };
  } finally {
    map.remove();
    container.remove();
  }
}
