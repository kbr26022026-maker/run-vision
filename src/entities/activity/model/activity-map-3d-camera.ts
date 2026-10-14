import * as maplibregl from 'maplibre-gl';

export type CameraTarget = {
  coordinate: maplibregl.LngLat;
  bearing: number;
  pitch: number;
};

type CameraControllerOptions = {
  smoothing?: number;
  bearingSmoothing?: number;
  bearingThreshold?: number;
};

export function getBearing(from: maplibregl.LngLatLike, to: maplibregl.LngLatLike): number {
  const start = maplibregl.LngLat.convert(from);
  const end = maplibregl.LngLat.convert(to);
  const startLatitude = (start.lat * Math.PI) / 180;
  const endLatitude = (end.lat * Math.PI) / 180;
  const longitudeDelta = ((end.lng - start.lng) * Math.PI) / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(endLatitude);
  const x =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDelta);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function normalizeBearingDelta(delta: number): number {
  return ((delta + 540) % 360) - 180;
}

export function normalizeLongitudeDelta(delta: number): number {
  return ((delta + 540) % 360) - 180;
}

export function createCameraController(map: maplibregl.Map, options: CameraControllerOptions = {}) {
  const smoothing = options.smoothing ?? 8;
  const bearingSmoothing = options.bearingSmoothing ?? 4;
  const bearingThreshold = options.bearingThreshold ?? 30;
  let animationFrame = 0;
  let lastFrameTime = 0;
  let target: CameraTarget | null = null;
  let enabled = false;
  let targetBearing = map.getBearing();

  function animate(timestamp: number) {
    if (!enabled || !target) {
      animationFrame = 0;
      lastFrameTime = 0;
      return;
    }

    if (lastFrameTime === 0) {
      lastFrameTime = timestamp;
    }

    const deltaSeconds = Math.min((timestamp - lastFrameTime) / 1000, 0.1);
    lastFrameTime = timestamp;

    const positionProgress = 1 - Math.exp(-smoothing * deltaSeconds);
    const bearingProgress = 1 - Math.exp(-bearingSmoothing * deltaSeconds);

    const currentCenter = map.getCenter();
    const currentBearing = map.getBearing();

    const longitudeDelta = normalizeLongitudeDelta(target.coordinate.lng - currentCenter.lng);

    const nextLongitude = currentCenter.lng + longitudeDelta * positionProgress;
    const nextLatitude =
      currentCenter.lat + (target.coordinate.lat - currentCenter.lat) * positionProgress;

    const bearingDelta = normalizeBearingDelta(targetBearing - currentBearing);
    const nextBearing = currentBearing + bearingDelta * bearingProgress;

    map.jumpTo({
      center: [nextLongitude, nextLatitude],
      bearing: nextBearing,
      pitch: target.pitch,
      zoom: map.getZoom(),
    });

    animationFrame = requestAnimationFrame(animate);
  }

  function start() {
    if (!enabled || animationFrame) return;
    lastFrameTime = 0;
    animationFrame = requestAnimationFrame(animate);
  }

  function stop() {
    enabled = false;
    target = null;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastFrameTime = 0;
  }

  function enable() {
    enabled = true;
    targetBearing = map.getBearing();
    start();
  }

  function disable() {
    stop();
  }

  function setTarget(coordinate: maplibregl.LngLatLike, bearing: number, pitch: number) {
    const normalizedBearing = ((bearing % 360) + 360) % 360;
    const bearingDelta = normalizeBearingDelta(normalizedBearing - targetBearing);
    if (Math.abs(bearingDelta) >= bearingThreshold) {
      targetBearing = normalizedBearing;
    }
    target = {
      coordinate: maplibregl.LngLat.convert(coordinate),
      bearing: targetBearing,
      pitch,
    };
    start();
  }

  function setCurrentTarget(pitch: number) {
    target = {
      coordinate: map.getCenter(),
      bearing: map.getBearing(),
      pitch,
    };
    targetBearing = map.getBearing();
  }

  function destroy() {
    stop();
  }

  return {
    enable,
    disable,
    setTarget,
    setCurrentTarget,
    start,
    stop,
    destroy,
  };
}
