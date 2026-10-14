<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TrackSeries } from '@/entities/activity/model/activity-analysis';
import { valueAtDistance } from '@/entities/activity/model/activity-analysis';
import { sampleIndicesByDistance } from '@/entities/activity/model/route-geometry';
import { formatDistanceKm } from '@/shared/lib/formatters/formatters';

const props = defineProps<{
  series: TrackSeries;
  currentTimeSeconds: number;
  height?: number;
}>();

const emit = defineEmits<{
  seek: [seconds: number];
  scrubStart: [];
  scrubEnd: [];
}>();

const WIDTH = 1000;
const chartHeight = computed(() => props.height ?? 64);
const PADDING_TOP = 6;

const totalDistance = computed(() => props.series.distance[props.series.distance.length - 1] ?? 0);

const points = computed(() => {
  const indices = sampleIndicesByDistance(props.series.distance, 320);
  let min = Infinity;
  let max = -Infinity;

  for (const index of indices) {
    min = Math.min(min, props.series.elevation[index]!);
    max = Math.max(max, props.series.elevation[index]!);
  }

  // Flat runs should look flat, not like mountains: keep at least 30 m of vertical range.
  const range = Math.max(max - min, 30);
  const base = min - (range - (max - min)) / 2;
  const total = totalDistance.value || 1;

  return indices.map((index) => ({
    x: (props.series.distance[index]! / total) * WIDTH,
    y:
      PADDING_TOP +
      (1 - (props.series.elevation[index]! - base) / range) * (chartHeight.value - PADDING_TOP - 2),
  }));
});

const linePath = computed(() =>
  points.value
    .map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(''),
);

const areaPath = computed(() => {
  const list = points.value;

  if (!list.length) {
    return '';
  }

  return `${linePath.value}L${list[list.length - 1]!.x} ${chartHeight.value}L0 ${chartHeight.value}Z`;
});

const currentDistance = computed(() => valueAtDistanceByTime(props.currentTimeSeconds));

function valueAtDistanceByTime(seconds: number) {
  // Invert elapsed(distance) with a binary search over the time axis.
  const elapsed = props.series.elapsed;
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

  const next = Math.min(low + 1, elapsed.length - 1);
  const span = elapsed[next]! - elapsed[low]!;
  const ratio = span > 0 ? Math.min(1, Math.max(0, (seconds - elapsed[low]!) / span)) : 0;

  return (
    props.series.distance[low]! +
    (props.series.distance[next]! - props.series.distance[low]!) * ratio
  );
}

const progressX = computed(() =>
  totalDistance.value > 0 ? (currentDistance.value / totalDistance.value) * WIDTH : 0,
);

const playheadY = computed(() => {
  const list = points.value;
  const x = progressX.value;
  const nextIndex = list.findIndex((point) => point.x >= x);

  if (nextIndex <= 0) {
    return list[0]?.y ?? chartHeight.value;
  }

  const a = list[nextIndex - 1]!;
  const b = list[nextIndex]!;
  const ratio = b.x > a.x ? (x - a.x) / (b.x - a.x) : 0;

  return a.y + (b.y - a.y) * ratio;
});

const hover = ref<{ x: number; distance: number; elevation: number } | null>(null);
const isScrubbing = ref(false);
const root = ref<HTMLElement | null>(null);

function locate(event: PointerEvent) {
  const rect = root.value!.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  const distance = ratio * totalDistance.value;

  return { ratio, distance };
}

function seekTo(event: PointerEvent) {
  const { distance } = locate(event);
  emit('seek', valueAtDistance(props.series.distance, props.series.elapsed, distance));
}

function handlePointerDown(event: PointerEvent) {
  isScrubbing.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  emit('scrubStart');
  seekTo(event);
}

function handlePointerMove(event: PointerEvent) {
  const { ratio, distance } = locate(event);

  hover.value = {
    x: ratio * 100,
    distance,
    elevation: valueAtDistance(props.series.distance, props.series.elevation, distance),
  };

  if (isScrubbing.value) {
    seekTo(event);
  }
}

function handlePointerUp() {
  if (isScrubbing.value) {
    isScrubbing.value = false;
    emit('scrubEnd');
  }
}
</script>

<template>
  <div
    ref="root"
    class="scrubber"
    :style="{ height: `${chartHeight}px` }"
    role="slider"
    aria-label="Перемотка по профилю высоты"
    :aria-valuenow="Math.round(progressX / 10)"
    aria-valuemin="0"
    aria-valuemax="100"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
    @pointerleave="hover = null"
  >
    <svg :viewBox="`0 0 ${WIDTH} ${chartHeight}`" preserveAspectRatio="none" class="scrubber__svg">
      <defs>
        <linearGradient id="rv-elevation-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#d4ff3f" stop-opacity="0.45" />
          <stop offset="100%" stop-color="#d4ff3f" stop-opacity="0" />
        </linearGradient>
        <clipPath id="rv-elevation-played">
          <rect x="0" y="0" :width="progressX" :height="chartHeight" />
        </clipPath>
      </defs>

      <path :d="areaPath" class="scrubber__area-muted" />
      <path :d="linePath" class="scrubber__line-muted" vector-effect="non-scaling-stroke" />

      <g clip-path="url(#rv-elevation-played)">
        <path :d="areaPath" fill="url(#rv-elevation-fill)" />
        <path :d="linePath" class="scrubber__line" vector-effect="non-scaling-stroke" />
      </g>
    </svg>

    <div class="scrubber__playhead" :style="{ left: `${progressX / 10}%` }">
      <span class="scrubber__dot" :style="{ top: `${playheadY}px` }" />
    </div>

    <div v-if="hover" class="scrubber__hover" :style="{ left: `${hover.x}%` }">
      <span class="scrubber__tooltip rv-num">
        {{ formatDistanceKm(hover.distance) }} км · {{ Math.round(hover.elevation) }} м
      </span>
    </div>
  </div>
</template>

<style scoped>
.scrubber {
  position: relative;
  width: 100%;
  cursor: ew-resize;
  touch-action: none;
  user-select: none;
}

.scrubber__svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.scrubber__area-muted {
  fill: rgb(255 255 255 / 6%);
}

.scrubber__line-muted {
  fill: none;
  stroke: rgb(255 255 255 / 28%);
  stroke-width: 1.5;
}

.scrubber__line {
  fill: none;
  stroke: var(--rv-accent);
  stroke-width: 2;
}

.scrubber__playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 1.5px solid rgb(255 255 255 / 85%);
  pointer-events: none;
}

.scrubber__dot {
  position: absolute;
  left: -7px;
  width: 12px;
  height: 12px;
  margin-top: -6px;
  border: 2px solid #0a0a0b;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgb(212 255 63 / 45%);
}

.scrubber__hover {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px dashed rgb(255 255 255 / 40%);
  pointer-events: none;
}

.scrubber__tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  padding: 3px 8px;
  border-radius: 8px;
  background: rgb(255 255 255 / 92%);
  color: #0a0a0b;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  transform: translateX(-50%);
}
</style>
