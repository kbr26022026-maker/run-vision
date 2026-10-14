import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import * as maplibregl from 'maplibre-gl';
import maplibreWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

import type { IActivity } from '@/entities/activity/model/activity.types';
import type { TrackSeries } from '@/entities/activity/model/activity-analysis';
import { buildRouteShape, sampleIndicesByDistance } from '@/entities/activity/model/route-geometry';
import {
  createCameraController,
  getBearing,
} from '@/entities/activity/model/activity-map-3d-camera';
import type { RouteColorMode } from '@/shared/lib/color/color-scales';
import {
  addHillshade,
  addTerrainSources,
  getMapStyle,
  MAP_2D_PITCH,
  MAP_3D_PITCH,
  TERRAIN_EXAGGERATION,
  TERRAIN_SOURCE_ID,
  type MapStyleId,
  type ViewMode,
} from '@/shared/lib/map/map-styles';
import {
  createFinishMarker,
  createRunnerMarker,
  createStartMarker,
} from '@/shared/lib/map/map-markers';
import { buildRouteGradient } from '@/shared/lib/map/route-gradient';

maplibregl.setWorkerUrl(maplibreWorker);

type Coordinate = [number, number];

export type MapPadding = { top: number; right: number; bottom: number; left: number };

export type ActivityMapOptions = {
  style: MapStyleId;
  viewMode: ViewMode;
  colorMode: RouteColorMode;
  accentColor: string;
  getPadding: () => MapPadding;
};

const ROUTE_SOURCE = 'rv-route';
const REMAINING_SOURCE = 'rv-route-remaining';
const FOLLOW_ZOOM = 16.2;

export function useActivityMap(
  activity: IActivity,
  series: TrackSeries,
  container: Ref<HTMLDivElement | null>,
  options: ActivityMapOptions,
) {
  let map: maplibregl.Map | null = null;
  let camera: ReturnType<typeof createCameraController> | null = null;
  const markers: maplibregl.Marker[] = [];
  let runner: maplibregl.Marker | null = null;

  const state = { ...options, follow: false, isStyleReady: false };
  const coordinates: Coordinate[] = activity.track.map((point) => [
    point.longitude,
    point.latitude,
  ]);
  const shape = buildRouteShape(activity.track, series, 1400);
  const overlayIndices = sampleIndicesByDistance(series.distance, 1400);
  let lastOverlayIndex = -1;
  let playbackActive = false;

  const bounds = coordinates.reduce(
    (result, coordinate) => result.extend(coordinate),
    new maplibregl.LngLatBounds(coordinates[0]!, coordinates[0]!),
  );

  function whenReady(action: () => void) {
    if (map && state.isStyleReady) {
      action();
    }
  }

  function routeLineColor() {
    return buildRouteGradient(shape, state.colorMode, state.accentColor);
  }

  function addRouteLayers() {
    if (!map || map.getSource(ROUTE_SOURCE)) {
      return;
    }

    map.addSource(ROUTE_SOURCE, {
      type: 'geojson',
      lineMetrics: true,
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } },
    });

    map.addSource(REMAINING_SOURCE, {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
    });

    const layout = { 'line-cap': 'round', 'line-join': 'round' } as const;
    const isLight = state.style === 'light';

    map.addLayer({
      id: 'rv-route-casing',
      type: 'line',
      source: ROUTE_SOURCE,
      layout,
      paint: {
        'line-color': isLight ? '#ffffff' : '#000000',
        'line-opacity': isLight ? 0.9 : 0.55,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 5, 16, 11],
      },
    });

    map.addLayer({
      id: 'rv-route-glow',
      type: 'line',
      source: ROUTE_SOURCE,
      layout,
      paint: {
        'line-gradient': routeLineColor(),
        'line-blur': 8,
        'line-opacity': isLight ? 0.25 : 0.45,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 10, 16, 22],
      },
    });

    map.addLayer({
      id: 'rv-route-line',
      type: 'line',
      source: ROUTE_SOURCE,
      layout,
      paint: {
        'line-gradient': routeLineColor(),
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 6.5],
      },
    });

    map.addLayer({
      id: 'rv-route-remaining-glow',
      type: 'line',
      source: REMAINING_SOURCE,
      layout,
      paint: {
        'line-color': isLight ? '#f2f3f5' : '#0c0c0d',
        'line-blur': 6,
        'line-opacity': 0.85,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 12, 16, 24],
      },
    });

    map.addLayer({
      id: 'rv-route-remaining',
      type: 'line',
      source: REMAINING_SOURCE,
      layout,
      paint: {
        'line-color': isLight ? '#d9dce1' : '#2a2a2e',
        'line-opacity': 0.92,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 16, 7.5],
      },
    });
  }

  function applyTerrain() {
    if (!map) {
      return;
    }

    addTerrainSources(map);
    addHillshade(map, state.style);
    map.setTerrain(
      state.viewMode === '3d'
        ? { source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION }
        : null,
    );
  }

  function handleStyleLoad() {
    state.isStyleReady = true;
    applyTerrain();
    addRouteLayers();
    lastOverlayIndex = -1;
  }

  function fitRoute(animate = true) {
    if (!map) {
      return;
    }

    camera?.disable();
    state.follow = false;

    const pitch = state.viewMode === '3d' ? MAP_3D_PITCH - 12 : MAP_2D_PITCH;
    // cameraForBounds ignores pitch, so frame the route flat and then tilt with a slight zoom-out
    // to keep the far end of the route in view.
    const target = map.cameraForBounds(bounds, {
      padding: options.getPadding(),
      bearing: 0,
      maxZoom: 16.5,
    });

    if (!target) {
      return;
    }

    map.easeTo({
      ...target,
      zoom: (target.zoom ?? map.getZoom()) - (pitch > 0 ? 0.35 : 0),
      pitch,
      bearing: pitch > 0 ? -12 : 0,
      duration: animate ? 1100 : 0,
      essential: true,
    });
  }

  function initialize() {
    if (!container.value || coordinates.length === 0) {
      return;
    }

    map = new maplibregl.Map({
      container: container.value,
      style: getMapStyle(state.style),
      bounds,
      fitBoundsOptions: { padding: options.getPadding() },
      pitch: 0,
      maxPitch: 75,
      attributionControl: false,
      renderWorldCopies: false,
      fadeDuration: 150,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    camera = createCameraController(map, {
      smoothing: 6,
      bearingSmoothing: 3,
      bearingThreshold: 45,
    });

    map.on('style.load', handleStyleLoad);

    map.once('load', () => {
      markers.push(createStartMarker(map!, coordinates[0]!));
      markers.push(createFinishMarker(map!, coordinates[coordinates.length - 1]!));
      runner = createRunnerMarker(map!, coordinates[0]!);
      runner.getElement().classList.add('rv-marker--hidden');
      fitRoute(false);

      if (state.viewMode === '3d') {
        // Fly in from the flat overview: a small "wow" moment that also explains the 3D toggle.
        window.setTimeout(() => fitRoute(true), 250);
      }
    });
  }

  function findIndex(seconds: number): number {
    const elapsed = series.elapsed;
    let low = 0;
    let high = elapsed.length - 1;

    while (low < high) {
      const middle = (low + high + 1) >> 1;

      if (elapsed[middle]! <= seconds) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    return low;
  }

  function positionAt(seconds: number): { coordinate: Coordinate; index: number } {
    const index = findIndex(seconds);
    const current = coordinates[index]!;
    const next = coordinates[index + 1];

    if (!next) {
      return { coordinate: current, index };
    }

    const span = series.elapsed[index + 1]! - series.elapsed[index]!;
    const ratio =
      span > 0 ? Math.min(1, Math.max(0, (seconds - series.elapsed[index]!) / span)) : 0;

    return {
      coordinate: [
        current[0] + (next[0] - current[0]) * ratio,
        current[1] + (next[1] - current[1]) * ratio,
      ],
      index,
    };
  }

  function updateRemaining(index: number, coordinate: Coordinate) {
    const source = map?.getSource(REMAINING_SOURCE) as maplibregl.GeoJSONSource | undefined;

    if (!source) {
      return;
    }

    if (!playbackActive) {
      if (lastOverlayIndex !== -2) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        });
        lastOverlayIndex = -2;
      }
      return;
    }

    let start = 0;

    while (start < overlayIndices.length && overlayIndices[start]! <= index) {
      start += 1;
    }

    if (start === lastOverlayIndex) {
      return;
    }

    lastOverlayIndex = start;
    const remaining = [
      coordinate,
      ...overlayIndices.slice(start).map((trackIndex) => coordinates[trackIndex]!),
    ];

    source.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: remaining.length > 1 ? remaining : [] },
    });
  }

  function setPlaybackTime(seconds: number, active: boolean) {
    if (!map || !runner) {
      return;
    }

    playbackActive = active;
    const { coordinate, index } = positionAt(seconds);

    runner.setLngLat(coordinate);
    runner.getElement().classList.toggle('rv-marker--hidden', !active && seconds <= 0);
    updateRemaining(index, coordinate);

    if (state.follow && camera) {
      const previous = coordinates[Math.max(index - 3, 0)]!;
      const next = coordinates[Math.min(index + 3, coordinates.length - 1)]!;

      if (previous[0] !== next[0] || previous[1] !== next[1]) {
        camera.setTarget(coordinate, getBearing(previous, next), currentPitch());
      }
    }
  }

  function currentPitch() {
    return state.viewMode === '3d' ? MAP_3D_PITCH : MAP_2D_PITCH;
  }

  function setViewMode(mode: ViewMode) {
    state.viewMode = mode;

    whenReady(() => {
      map!.setTerrain(
        mode === '3d' ? { source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION } : null,
      );
    });

    if (!map) {
      return;
    }

    if (state.follow) {
      camera?.setCurrentTarget(currentPitch());
    } else {
      map.easeTo({
        pitch: currentPitch(),
        bearing: mode === '2d' ? 0 : map.getBearing(),
        duration: 700,
      });
    }
  }

  function setStyle(style: MapStyleId) {
    if (!map || style === state.style) {
      return;
    }

    state.style = style;
    state.isStyleReady = false;
    map.setStyle(getMapStyle(style), { diff: false });
  }

  function setColorMode(mode: RouteColorMode) {
    state.colorMode = mode;

    whenReady(() => {
      map!.setPaintProperty('rv-route-line', 'line-gradient', routeLineColor());
      map!.setPaintProperty('rv-route-glow', 'line-gradient', routeLineColor());
    });
  }

  function setFollow(enabled: boolean) {
    state.follow = enabled;

    if (!map || !camera) {
      return;
    }

    if (!enabled) {
      camera.disable();
      return;
    }

    const center = runner?.getLngLat() ?? map.getCenter();

    map.easeTo({ center, zoom: FOLLOW_ZOOM, pitch: currentPitch(), duration: 800 });
    map.once('moveend', () => {
      if (state.follow) {
        camera?.setCurrentTarget(currentPitch());
        camera?.enable();
      }
    });
  }

  function resize() {
    map?.resize();
  }

  onMounted(initialize);

  onBeforeUnmount(() => {
    camera?.destroy();
    markers.forEach((marker) => marker.remove());
    runner?.remove();
    map?.remove();
    map = null;
    camera = null;
  });

  return {
    setPlaybackTime,
    setViewMode,
    setStyle,
    setColorMode,
    setFollow,
    fitRoute,
    resize,
  };
}
