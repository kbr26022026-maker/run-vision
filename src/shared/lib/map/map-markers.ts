import * as maplibregl from 'maplibre-gl';

function createMarker(className: string, html = '') {
  const element = document.createElement('div');
  element.className = `rv-marker ${className}`;
  element.innerHTML = html;
  return element;
}

export function createStartMarker(map: maplibregl.Map, coordinate: maplibregl.LngLatLike) {
  return new maplibregl.Marker({ element: createMarker('rv-marker--start'), anchor: 'center' })
    .setLngLat(coordinate)
    .addTo(map);
}

export function createFinishMarker(map: maplibregl.Map, coordinate: maplibregl.LngLatLike) {
  return new maplibregl.Marker({ element: createMarker('rv-marker--finish'), anchor: 'center' })
    .setLngLat(coordinate)
    .addTo(map);
}

export function createRunnerMarker(map: maplibregl.Map, coordinate: maplibregl.LngLatLike) {
  return new maplibregl.Marker({
    element: createMarker('rv-marker--runner', '<span class="rv-marker__pulse"></span>'),
    anchor: 'center',
  })
    .setLngLat(coordinate)
    .addTo(map);
}
