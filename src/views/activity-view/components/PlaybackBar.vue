<script setup lang="ts">
import { computed } from 'vue';
import type { TrackSeries } from '@/entities/activity/model/activity-analysis';
import ElevationScrubber from './ElevationScrubber.vue';
import {
  formatClock,
  formatDistanceKm,
  formatHeartRate,
  formatPace,
} from '@/shared/lib/formatters/formatters';

export type PlaybackLength = 15 | 30 | 60 | 120 | 0;

const props = defineProps<{
  series: TrackSeries;
  currentTimeSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  playbackLength: PlaybackLength;
  compact?: boolean;
}>();

const emit = defineEmits<{
  play: [];
  pause: [];
  seek: [seconds: number];
  'update:playbackLength': [value: PlaybackLength];
  scrubStart: [];
  scrubEnd: [];
}>();

const lengthOptions: { value: PlaybackLength; label: string }[] = [
  { value: 15, label: '15 с' },
  { value: 30, label: '30 с' },
  { value: 60, label: '1 мин' },
  { value: 120, label: '2 мин' },
  { value: 0, label: 'Реальное время' },
];

const lengthLabel = computed(
  () => lengthOptions.find((option) => option.value === props.playbackLength)?.label ?? '30 с',
);

const currentIndex = computed(() => {
  const elapsed = props.series.elapsed;
  let low = 0;
  let high = elapsed.length - 1;

  while (low < high) {
    const middle = (low + high + 1) >> 1;

    if (elapsed[middle]! <= props.currentTimeSeconds) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
});

const live = computed(() => {
  const index = currentIndex.value;
  const pace = props.series.pace[index]!;
  const heartRate = props.series.heartRate[index]!;

  return {
    distance: formatDistanceKm(props.series.distance[index] ?? 0),
    pace: Number.isFinite(pace) ? formatPace(pace) : '—',
    heartRate: Number.isFinite(heartRate) ? formatHeartRate(heartRate) : null,
    elevation: Math.round(props.series.elevation[index] ?? 0),
  };
});

const totalDistance = computed(() =>
  formatDistanceKm(props.series.distance[props.series.distance.length - 1] ?? 0),
);
</script>

<template>
  <div class="playback" :class="{ 'playback--compact': compact }">
    <div class="playback__row">
      <button
        type="button"
        class="playback__play"
        :aria-label="isPlaying ? 'Пауза' : 'Воспроизвести'"
        @click="isPlaying ? emit('pause') : emit('play')"
      >
        <v-icon :icon="isPlaying ? 'mdi-pause' : 'mdi-play'" size="26" />
      </button>

      <div class="playback__live rv-num">
        <div class="live">
          <span class="live__value">{{ live.distance }}</span>
          <span class="live__unit">{{ compact ? 'км' : `/ ${totalDistance} км` }}</span>
        </div>
        <div class="live">
          <span class="live__value">{{ live.pace }}</span>
          <span class="live__unit">/км</span>
        </div>
        <div v-if="live.heartRate" class="live">
          <v-icon icon="mdi-heart" size="14" class="live__heart" />
          <span class="live__value">{{ live.heartRate }}</span>
        </div>
        <div v-if="!compact" class="live">
          <v-icon icon="mdi-image-filter-hdr" size="14" class="live__muted" />
          <span class="live__value">{{ live.elevation }}</span>
          <span class="live__unit">м</span>
        </div>
      </div>

      <v-menu location="top end" offset="8">
        <template #activator="{ props: menuProps }">
          <button
            type="button"
            class="playback__speed"
            v-bind="menuProps"
            aria-label="Длительность просмотра"
          >
            <v-icon icon="mdi-timer-outline" size="16" />
            {{ lengthLabel }}
          </button>
        </template>

        <div class="speed-menu rv-glass">
          <div class="rv-eyebrow speed-menu__title">Проиграть за</div>
          <button
            v-for="option in lengthOptions"
            :key="option.value"
            type="button"
            class="speed-menu__item"
            :class="{ 'speed-menu__item--active': option.value === playbackLength }"
            @click="emit('update:playbackLength', option.value)"
          >
            {{ option.label }}
            <v-icon v-if="option.value === playbackLength" icon="mdi-check" size="18" />
          </button>
        </div>
      </v-menu>
    </div>

    <ElevationScrubber
      :series="series"
      :current-time-seconds="currentTimeSeconds"
      :height="compact ? 44 : 56"
      @seek="emit('seek', $event)"
      @scrub-start="emit('scrubStart')"
      @scrub-end="emit('scrubEnd')"
    />

    <div class="playback__times rv-num">
      <span>{{ formatClock(currentTimeSeconds) }}</span>
      <span>{{ formatClock(durationSeconds) }}</span>
    </div>
  </div>
</template>

<style scoped>
.playback {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.playback__row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.playback__play {
  display: grid;
  flex: 0 0 48px;
  width: 48px;
  height: 48px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: var(--rv-accent);
  color: var(--rv-on-accent);
  cursor: pointer;
  box-shadow: 0 6px 20px rgb(212 255 63 / 25%);
  transition: transform 0.2s var(--rv-ease-spring);
}

.playback__play:hover {
  transform: scale(1.05);
}

.playback__play:active {
  transform: scale(0.94);
}

.playback__live {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  align-items: baseline;
  gap: 18px;
  overflow: hidden;
}

.live {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
}

.live__value {
  font-family: var(--rv-font-display);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.live__unit {
  color: var(--rv-text-muted);
  font-size: 12px;
}

.live__heart {
  align-self: center;
  color: #ff5a5f;
}

.live__muted {
  align-self: center;
  color: var(--rv-text-muted);
}

.playback__speed {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--rv-border-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--rv-text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.playback__speed:hover {
  background: rgb(255 255 255 / 8%);
}

.playback__times {
  display: flex;
  justify-content: space-between;
  margin-top: -4px;
  color: var(--rv-text-muted);
  font-size: 11px;
  font-weight: 500;
}

.speed-menu {
  display: flex;
  min-width: 200px;
  flex-direction: column;
  padding: 8px;
  border-radius: var(--rv-radius-md);
}

.speed-menu__title {
  padding: 6px 10px 8px;
}

.speed-menu__item {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--rv-text);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.speed-menu__item:hover {
  background: rgb(255 255 255 / 8%);
}

.speed-menu__item--active {
  color: var(--rv-accent);
  font-weight: 600;
}

.playback--compact .playback__row {
  gap: 12px;
}

.playback--compact .playback__live {
  gap: 12px;
}

.playback--compact .live__value {
  font-size: 16px;
}

.playback--compact .playback__speed {
  padding: 0 10px;
}
</style>
