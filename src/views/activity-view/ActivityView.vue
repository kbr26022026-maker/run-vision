<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';

import ActivityMap from './components/ActivityMap.vue';
import ActivityTopBar from './components/ActivityTopBar.vue';
import ActivitySummary from './components/ActivitySummary.vue';
import ImportHero from './components/ImportHero.vue';
import MapToolbar from './components/MapToolbar.vue';
import PlaybackBar, { type PlaybackLength } from './components/PlaybackBar.vue';
import SplitsList from './components/SplitsList.vue';
import BottomSheet from '@/shared/ui/BottomSheet.vue';
import BrandMark from '@/shared/ui/BrandMark.vue';

import { useActivityStore } from '@/stores/activity.store';
import { useGpxImport } from '@/hooks/useGpxImport';
import { oneOf, usePersistentRef } from '@/shared/lib/storage/persistent-ref';
import type { MapStyleId, ViewMode } from '@/shared/lib/map/map-styles';
import type { RouteColorMode } from '@/shared/lib/color/color-scales';
import type { MapPadding } from '@/hooks/useActivityMap';

const activityStore = useActivityStore();
const router = useRouter();
const gpx = useGpxImport();
const { width } = useDisplay();

const isDesktop = computed(() => width.value >= 900);

const activity = computed(() => activityStore.activity);
const analysis = computed(() => activityStore.analysis);

const mapStyle = usePersistentRef<MapStyleId>(
  'rv:map-style',
  'dark',
  oneOf(['dark', 'light', 'satellite'] as const),
);
const viewMode = usePersistentRef<ViewMode>('rv:view-mode', '3d', oneOf(['2d', '3d'] as const));
const colorMode = usePersistentRef<RouteColorMode>(
  'rv:route-color',
  'pace',
  oneOf(['solid', 'pace', 'heartRate', 'elevation'] as const),
);
const playbackLength = usePersistentRef<PlaybackLength>(
  'rv:playback-length',
  30,
  oneOf([15, 30, 60, 120, 0] as const),
);
const follow = ref(false);
const isSheetOpen = ref(false);
const sheetPeekHeight = ref(170);

const mapRef = ref<InstanceType<typeof ActivityMap> | null>(null);

const availableColorModes = computed<RouteColorMode[]>(() => {
  const modes: RouteColorMode[] = ['solid', 'pace'];
  const series = analysis.value?.series;

  if (series?.heartRate.some((value) => Number.isFinite(value))) {
    modes.push('heartRate');
  }

  modes.push('elevation');
  return modes;
});

watch(availableColorModes, (modes) => {
  if (!modes.includes(colorMode.value)) {
    colorMode.value = 'pace';
  }
});

const mapPadding = computed<MapPadding>(() =>
  isDesktop.value
    ? { top: 100, right: 90, bottom: 190, left: 440 }
    : { top: 90, right: 72, bottom: sheetPeekHeight.value + 30, left: 28 },
);

/* ---------- Playback ---------- */

const currentTime = ref(0);
const isPlaying = ref(false);
let frame = 0;
let lastFrame = 0;
let resumeAfterScrub = false;

const duration = computed(() => analysis.value?.series.elapsed.at(-1) ?? 0);

const speed = computed(() => {
  if (!playbackLength.value || duration.value <= 0) {
    return 1;
  }

  return duration.value / playbackLength.value;
});

function syncMap() {
  mapRef.value?.setPlaybackTime(
    currentTime.value,
    isPlaying.value || (currentTime.value > 0 && currentTime.value < duration.value),
  );
}

function tick(timestamp: number) {
  if (!isPlaying.value) {
    return;
  }

  const delta = Math.min((timestamp - lastFrame) / 1000, 0.1);
  lastFrame = timestamp;
  currentTime.value = Math.min(duration.value, currentTime.value + delta * speed.value);

  if (currentTime.value >= duration.value) {
    isPlaying.value = false;
  }

  syncMap();

  if (isPlaying.value) {
    frame = requestAnimationFrame(tick);
  }
}

function play() {
  if (!activity.value || isPlaying.value) {
    return;
  }

  if (currentTime.value >= duration.value) {
    currentTime.value = 0;
  }

  isPlaying.value = true;
  lastFrame = performance.now();
  frame = requestAnimationFrame(tick);
}

function pause() {
  isPlaying.value = false;
  cancelAnimationFrame(frame);
  syncMap();
}

function seek(seconds: number) {
  currentTime.value = Math.min(Math.max(seconds, 0), duration.value);
  syncMap();
}

function handleScrubStart() {
  resumeAfterScrub = isPlaying.value;
  pause();
}

function handleScrubEnd() {
  if (resumeAfterScrub) {
    play();
  }
}

watch(
  () => activity.value?.id,
  () => {
    pause();
    currentTime.value = 0;
    follow.value = false;
    isSheetOpen.value = false;
  },
);

/* ---------- Actions ---------- */

function fitRoute() {
  follow.value = false;
  mapRef.value?.fitRoute(true);
}

function createPost() {
  pause();
  void router.push('/studio');
}

function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;

  if (!activity.value || target?.closest('input, textarea, [contenteditable]')) {
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    if (isPlaying.value) {
      pause();
    } else {
      play();
    }
  } else if (event.key === 'ArrowRight') {
    seek(currentTime.value + duration.value * 0.02);
  } else if (event.key === 'ArrowLeft') {
    seek(currentTime.value - duration.value * 0.02);
  } else if (event.key.toLowerCase() === 'f') {
    fitRoute();
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown));

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div v-if="activity && analysis" class="screen">
    <ActivityMap
      :key="activity.id"
      ref="mapRef"
      :activity="activity"
      :series="analysis.series"
      :map-style="mapStyle"
      :view-mode="viewMode"
      :color-mode="colorMode"
      :follow="follow"
      :padding="mapPadding"
    />

    <div class="screen__scrim" aria-hidden="true" />

    <ActivityTopBar
      :recents="activityStore.recents"
      :active-id="activity.id"
      :is-importing="activityStore.isImporting"
      @import="gpx.openFilePicker"
      @open="gpx.openRecent"
      @remove="activityStore.deleteRecent"
      @create="createPost"
    />

    <MapToolbar
      class="screen__toolbar"
      :map-style="mapStyle"
      :view-mode="viewMode"
      :color-mode="colorMode"
      :follow="follow"
      :available-color-modes="availableColorModes"
      @update:map-style="mapStyle = $event"
      @update:view-mode="viewMode = $event"
      @update:color-mode="colorMode = $event"
      @update:follow="follow = $event"
      @fit="fitRoute"
    />

    <template v-if="isDesktop">
      <aside class="panel rv-glass">
        <ActivitySummary
          :activity="activity"
          :summary="analysis.summary"
          @rename="activityStore.rename"
        />
        <SplitsList :splits="analysis.splits" />
      </aside>

      <div class="playback-dock rv-glass">
        <PlaybackBar
          :series="analysis.series"
          :current-time-seconds="currentTime"
          :duration-seconds="duration"
          :is-playing="isPlaying"
          :playback-length="playbackLength"
          @play="play"
          @pause="pause"
          @seek="seek"
          @scrub-start="handleScrubStart"
          @scrub-end="handleScrubEnd"
          @update:playback-length="playbackLength = $event"
        />
      </div>
    </template>

    <BottomSheet v-else v-model:open="isSheetOpen" @peek-height="sheetPeekHeight = $event">
      <template #peek>
        <PlaybackBar
          compact
          :series="analysis.series"
          :current-time-seconds="currentTime"
          :duration-seconds="duration"
          :is-playing="isPlaying"
          :playback-length="playbackLength"
          @play="play"
          @pause="pause"
          @seek="seek"
          @scrub-start="handleScrubStart"
          @scrub-end="handleScrubEnd"
          @update:playback-length="playbackLength = $event"
        />
      </template>

      <div class="sheet-content">
        <ActivitySummary
          :activity="activity"
          :summary="analysis.summary"
          @rename="activityStore.rename"
        />
        <button type="button" class="rv-btn rv-btn--primary rv-btn--block" @click="createPost">
          <v-icon icon="mdi-creation" size="20" />
          Создать пост или видео
        </button>
        <SplitsList :splits="analysis.splits" />
      </div>
    </BottomSheet>
  </div>

  <div v-else-if="activityStore.isRestoring" class="splash">
    <BrandMark compact class="splash__mark" />
  </div>

  <ImportHero
    v-else
    :recents="activityStore.recents"
    :is-importing="activityStore.isImporting"
    @pick="gpx.openFilePicker"
    @sample="gpx.importSample"
    @open="gpx.openRecent"
  />
</template>

<style scoped>
.screen {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--rv-bg);
}

.screen__scrim {
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  left: 0;
  height: 120px;
  background: linear-gradient(to bottom, rgb(10 10 11 / 55%), rgb(10 10 11 / 0%));
  pointer-events: none;
}

.screen__toolbar {
  position: absolute;
  z-index: 10;
  top: calc(76px + var(--rv-safe-top));
  right: 12px;
}

.panel {
  position: absolute;
  z-index: 10;
  top: calc(76px + var(--rv-safe-top));
  bottom: 16px;
  left: 12px;
  display: flex;
  width: 380px;
  flex-direction: column;
  gap: 28px;
  padding: 22px 20px;
  overflow-y: auto;
  border-radius: var(--rv-radius-xl);
  scrollbar-width: thin;
  scrollbar-color: rgb(255 255 255 / 15%) transparent;
}

.playback-dock {
  position: absolute;
  z-index: 10;
  right: 76px;
  bottom: 16px;
  left: 416px;
  max-width: 980px;
  margin: 0 auto;
  padding: 14px 18px 10px;
  border-radius: var(--rv-radius-xl);
}

.sheet-content {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.splash {
  display: grid;
  min-height: 100dvh;
  place-items: center;
}

.splash__mark {
  animation: splash-pulse 1.2s ease-in-out infinite alternate;
}

.splash__mark :deep(.brand__mark) {
  width: 56px;
  height: 56px;
}

@keyframes splash-pulse {
  from {
    opacity: 0.4;
    transform: scale(0.94);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (max-width: 899px) {
  .screen__toolbar {
    top: calc(68px + var(--rv-safe-top));
    right: 10px;
  }
}
</style>
