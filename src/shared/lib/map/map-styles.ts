import type { StyleSpecification } from 'maplibre-gl';
import type * as maplibregl from 'maplibre-gl';

export type MapStyleId = 'dark' | 'light' | 'satellite';
export type ViewMode = '2d' | '3d';

export const MAP_2D_PITCH = 0;
export const MAP_3D_PITCH = 60;
export const TERRAIN_EXAGGERATION = 1.5;

export const MAP_STYLE_OPTIONS: { id: MapStyleId; label: string; icon: string }[] = [
  { id: 'dark', label: 'Тёмная', icon: 'mdi-weather-night' },
  { id: 'light', label: 'Светлая', icon: 'mdi-white-balance-sunny' },
  { id: 'satellite', label: 'Спутник', icon: 'mdi-satellite-variant' },
];

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0a0a0b' } },
    { id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-saturation': -0.15 } },
  ],
};

export function getMapStyle(id: MapStyleId): string | StyleSpecification {
  switch (id) {
    case 'light':
      return 'https://tiles.openfreemap.org/styles/positron';
    case 'satellite':
      return SATELLITE_STYLE;
    default:
      return 'https://tiles.openfreemap.org/styles/dark';
  }
}

/** Mapzen/Tilezen terrain tiles hosted on AWS Open Data (no key, CORS enabled). */
export const TERRAIN_SOURCE_ID = 'rv-terrain';
export const HILLSHADE_SOURCE_ID = 'rv-hillshade';

const TERRAIN_TILES = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'];

export function addTerrainSources(map: maplibregl.Map) {
  if (!map.getSource(TERRAIN_SOURCE_ID)) {
    map.addSource(TERRAIN_SOURCE_ID, {
      type: 'raster-dem',
      tiles: TERRAIN_TILES,
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 14,
      attribution: 'Terrain: Mapzen, AWS Open Data',
    });
  }

  // A separate source for hillshade avoids terrain/hillshade resolution conflicts.
  if (!map.getSource(HILLSHADE_SOURCE_ID)) {
    map.addSource(HILLSHADE_SOURCE_ID, {
      type: 'raster-dem',
      tiles: TERRAIN_TILES,
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 14,
    });
  }
}

export function addHillshade(map: maplibregl.Map, style: MapStyleId) {
  if (map.getLayer('rv-hillshade') || style === 'satellite') {
    return;
  }

  const firstSymbol = map.getStyle().layers.find((layer) => layer.type === 'symbol');

  map.addLayer(
    {
      id: 'rv-hillshade',
      type: 'hillshade',
      source: HILLSHADE_SOURCE_ID,
      paint:
        style === 'dark'
          ? {
              'hillshade-exaggeration': 0.35,
              'hillshade-shadow-color': '#000000',
              'hillshade-highlight-color': '#2a2a2e',
              'hillshade-accent-color': '#000000',
            }
          : {
              'hillshade-exaggeration': 0.25,
              'hillshade-shadow-color': '#9aa3ad',
              'hillshade-highlight-color': '#ffffff',
            },
    },
    firstSymbol?.id,
  );
}
