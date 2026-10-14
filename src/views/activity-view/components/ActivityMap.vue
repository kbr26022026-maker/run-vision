<script setup lang="ts">
import { ref, watch } from 'vue';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { IActivity } from '@/entities/activity/model/activity.types';
import type { TrackSeries } from '@/entities/activity/model/activity-analysis';
import type { RouteColorMode } from '@/shared/lib/color/color-scales';
import type { MapStyleId, ViewMode } from '@/shared/lib/map/map-styles';
import { useActivityMap, type MapPadding } from '@/hooks/useActivityMap';

const props = defineProps<{
  activity: IActivity;
  series: TrackSeries;
  mapStyle: MapStyleId;
  viewMode: ViewMode;
  colorMode: RouteColorMode;
  follow: boolean;
  padding: MapPadding;
}>();

const container = ref<HTMLDivElement | null>(null);

const map = useActivityMap(props.activity, props.series, container, {
  style: props.mapStyle,
  viewMode: props.viewMode,
  colorMode: props.colorMode,
  accentColor: '#d4ff3f',
  getPadding: () => props.padding,
});

watch(() => props.mapStyle, map.setStyle);
watch(() => props.viewMode, map.setViewMode);
watch(() => props.colorMode, map.setColorMode);
watch(() => props.follow, map.setFollow);

defineExpose({
  setPlaybackTime: map.setPlaybackTime,
  fitRoute: map.fitRoute,
  resize: map.resize,
});
</script>

<template>
  <div ref="container" class="activity-map" />
</template>

<style scoped>
.activity-map {
  position: absolute;
  inset: 0;
  background: var(--rv-bg);
}
</style>

<style>
.rv-marker {
  pointer-events: none;
  user-select: none;
}

.rv-marker--start {
  width: 18px;
  height: 18px;
  border: 4px solid #0a0a0b;
  border-radius: 50%;
  background: #3ddc97;
  box-shadow: 0 0 0 2px #3ddc97;
}

.rv-marker--finish {
  width: 20px;
  height: 20px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: conic-gradient(#0a0a0b 0 25%, #ffffff 0 50%, #0a0a0b 0 75%, #ffffff 0);
  background-size: 10px 10px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 50%);
}

.rv-marker--runner {
  position: relative;
  width: 20px;
  height: 20px;
  border: 3px solid #0a0a0b;
  border-radius: 50%;
  background: var(--rv-accent);
  box-shadow:
    0 0 0 2px var(--rv-accent),
    0 4px 14px rgb(0 0 0 / 50%);
  transition: opacity 0.2s ease;
}

.rv-marker--hidden {
  opacity: 0;
}

.rv-marker__pulse {
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  background: rgb(212 255 63 / 35%);
  animation: rv-pulse 1.8s ease-out infinite;
}

@keyframes rv-pulse {
  from {
    transform: scale(0.4);
    opacity: 1;
  }

  to {
    transform: scale(1.4);
    opacity: 0;
  }
}

.maplibregl-ctrl-attrib.maplibregl-compact {
  margin: 0 8px 8px 0 !important;
  background: rgb(18 18 20 / 70%) !important;
  color: rgb(245 245 247 / 70%);
  font-family: var(--rv-font-ui);
  font-size: 10px;
}

.maplibregl-ctrl-attrib.maplibregl-compact a {
  color: rgb(245 245 247 / 80%);
}

.maplibregl-ctrl-attrib-button {
  filter: invert(1);
  opacity: 0.7;
}
</style>
