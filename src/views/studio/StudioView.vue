<script setup lang="ts">
import {
  computed,
  markRaw,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';

import StudioPreview from './components/StudioPreview.vue';
import TemplatePicker from './components/TemplatePicker.vue';
import BackgroundPanel from './components/BackgroundPanel.vue';
import StylePanel from './components/StylePanel.vue';
import DataPanel from './components/DataPanel.vue';
import VideoExportDialog from './components/VideoExportDialog.vue';

import { useActivityStore } from '@/stores/activity.store';
import { useStudioStore } from '@/stores/studio.store';
import { useUiStore } from '@/stores/ui.store';
import { buildCardData } from '@/entities/card/card-data';
import {
  CARD_FORMATS,
  type CardFormat,
  type StudioMode,
  type TemplateId,
} from '@/entities/card/card.types';
import { getTemplate } from '@/entities/card/templates';
import { createMapSnapshot, getMapSnapshotKey } from '@/entities/card/map-snapshot';
import type { MapSnapshot } from '@/entities/card/render/env';
import { createBackdrop } from '@/entities/card/render/background';
import {
  getCardSize,
  paintBackdrop,
  type RenderCardInput,
} from '@/entities/card/render/render-card';
import {
  buildFileName,
  canCopyImages,
  canvasToBlob,
  copyImage,
  downloadBlob,
  renderToCanvas,
  shareOrDownload,
  trimTransparent,
} from '@/entities/card/export/export-image';
import { exportVideo } from '@/entities/card/export/export-video';
import { PhotoImportError } from '@/entities/card/photo';
import { pickFile } from '@/shared/lib/files/pick-file';
import type { MapStyleId } from '@/shared/lib/map/map-styles';
import { usePersistentRef } from '@/shared/lib/storage/persistent-ref';

const router = useRouter();
const activityStore = useActivityStore();
const studio = useStudioStore();
const ui = useUiStore();
const { width } = useDisplay();

const isDesktop = computed(() => width.value >= 1000);
const settings = computed(() => studio.settings);
const template = computed(() => getTemplate(settings.value.templateId));

const data = computed(() => {
  const activity = activityStore.activity;
  const analysis = activityStore.analysis;
  return activity && analysis ? markRaw(buildCardData(activity, analysis)) : null;
});

watch(
  data,
  (value) => {
    if (value) {
      studio.prepareFor(value);
    }
  },
  { immediate: true },
);

watch(
  () => [activityStore.activity, activityStore.isRestoring] as const,
  ([activity, restoring]) => {
    if (!activity && !restoring) {
      void router.replace('/activity');
    }
  },
  { immediate: true },
);

/* ---------- Map snapshots ---------- */

const snapshots = new Map<string, MapSnapshot>();
const mapSnapshot = shallowRef<MapSnapshot | null>(null);
const mapLoading = ref(false);
let mapRequest = 0;

async function loadSnapshot(
  format: CardFormat,
  style: MapStyleId,
  silent = false,
): Promise<MapSnapshot | null> {
  if (!data.value) {
    return null;
  }

  const key = getMapSnapshotKey(data.value, format, style);
  const cached = snapshots.get(key);

  if (cached) {
    return cached;
  }

  try {
    const snapshot = markRaw(await createMapSnapshot(data.value, format, style));
    snapshots.set(key, snapshot);
    return snapshot;
  } catch (error) {
    if (!silent) {
      ui.notify('Карта не загрузилась — проверьте интернет и попробуйте ещё раз', 'error');
      console.error(error);
    }
    return null;
  }
}

watch(
  () =>
    [
      data.value,
      settings.value.templateId,
      settings.value.format,
      settings.value.mapStyle,
    ] as const,
  async ([value, templateId, format, style]) => {
    if (!value || !getTemplate(templateId).usesMap) {
      return;
    }

    const request = ++mapRequest;
    const key = getMapSnapshotKey(value, format, style);

    if (!snapshots.has(key)) {
      mapLoading.value = true;
    }

    const snapshot = await loadSnapshot(format, style);

    if (request === mapRequest) {
      mapSnapshot.value = snapshot;
      mapLoading.value = false;
    }
  },
  { immediate: true },
);

/** Snapshot that matches the current format, used by the template thumbnails. */
const thumbnailMap = computed(() => {
  const current = mapSnapshot.value;

  if (current && data.value && current.key.includes(`:${settings.value.format}:`)) {
    return current;
  }

  return null;
});

/* ---------- Render input ---------- */

const assets = computed(() => ({
  photo: studio.photo,
  photoTransform: { ...studio.photoTransform },
  map:
    template.value.usesMap &&
    mapSnapshot.value?.key.includes(`:${settings.value.format}:${settings.value.mapStyle}`)
      ? mapSnapshot.value
      : null,
}));

const settingsSnapshot = computed(
  () => JSON.parse(JSON.stringify(studio.settings)) as typeof studio.settings,
);

const backdrop = computed(() => {
  const current = settingsSnapshot.value;
  const currentAssets = assets.value;
  const { width: W, height: H } = getCardSize(current);

  return markRaw(
    createBackdrop(W, H, (ctx, w, h) => paintBackdrop(ctx, w, h, current, currentAssets)),
  );
});

const renderInput = computed<Omit<RenderCardInput, 't'> | null>(() =>
  data.value
    ? {
        data: data.value,
        settings: settingsSnapshot.value,
        assets: assets.value,
        backdrop: backdrop.value,
      }
    : null,
);

/* ---------- PNG export ---------- */

const pngBlob = shallowRef<Blob | null>(null);
let pngGeneration = 0;
let pngTimer = 0;

const title = computed(() => settings.value.title.trim() || data.value?.activityName || 'Пробежка');
const pngName = computed(() =>
  buildFileName(title.value, template.value.isSticker ? 'sticker' : settings.value.format, 'png'),
);

async function producePng(input: Omit<RenderCardInput, 't'>): Promise<Blob> {
  let canvas = renderToCanvas(input);

  if (template.value.isSticker && input.settings.backgroundMode === 'transparent') {
    canvas = trimTransparent(canvas, 40);
  }

  return canvasToBlob(canvas);
}

watch(
  renderInput,
  (input) => {
    pngBlob.value = null;
    window.clearTimeout(pngTimer);

    if (!input || studio.mode !== 'photo') {
      return;
    }

    const generation = ++pngGeneration;
    // Pre-render so "Share" can open the share sheet instantly (iOS needs the user gesture).
    pngTimer = window.setTimeout(async () => {
      try {
        const blob = await producePng(input);

        if (generation === pngGeneration) {
          pngBlob.value = blob;
        }
      } catch (error) {
        console.error(error);
      }
    }, 350);
  },
  { immediate: true },
);

const isExporting = ref(false);

async function getPng(): Promise<Blob | null> {
  if (pngBlob.value) {
    return pngBlob.value;
  }

  return renderInput.value ? producePng(renderInput.value) : null;
}

async function sharePng() {
  isExporting.value = true;

  try {
    const blob = await getPng();

    if (!blob) {
      return;
    }

    const result = await shareOrDownload(blob, pngName.value, title.value);

    if (result === 'downloaded') {
      ui.notify('Картинка сохранена — загрузите её в Instagram', 'success');
    }
  } catch (error) {
    console.error(error);
    ui.notify('Не удалось поделиться картинкой', 'error');
  } finally {
    isExporting.value = false;
  }
}

async function downloadPng() {
  const blob = await getPng();

  if (blob) {
    downloadBlob(blob, pngName.value);
    ui.notify('Картинка сохранена', 'success');
  }
}

const canCopy = canCopyImages();

async function copyPng() {
  try {
    const blob = pngBlob.value ?? (renderInput.value ? producePng(renderInput.value) : null);

    if (!blob) {
      return;
    }

    await copyImage(blob);
    ui.notify(
      template.value.isSticker
        ? 'Стикер скопирован — вставьте его в Stories'
        : 'Картинка скопирована в буфер обмена',
      'success',
    );
  } catch (error) {
    console.error(error);
    ui.notify('Браузер не разрешил копирование. Используйте «Скачать»', 'error');
  }
}

/* ---------- Video export ---------- */

const video = reactive({
  open: false,
  progress: 0,
  url: null as string | null,
  blob: null as Blob | null,
  extension: 'mp4',
  error: null as string | null,
});
let videoAbort: AbortController | null = null;

const videoName = computed(() =>
  buildFileName(title.value, `${settings.value.format}-video`, video.extension),
);

async function createVideo() {
  if (!renderInput.value) {
    return;
  }

  if (template.value.usesMap && !assets.value.map) {
    ui.notify('Дождитесь, пока загрузится карта', 'info');
    return;
  }

  resetVideo();
  video.open = true;
  videoAbort = new AbortController();

  try {
    const result = await exportVideo({
      input: renderInput.value,
      durationSeconds: studio.videoDuration,
      signal: videoAbort.signal,
      onProgress: (progress) => {
        video.progress = progress;
      },
    });

    video.blob = result.blob;
    video.extension = result.extension;
    video.url = URL.createObjectURL(result.blob);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      video.open = false;
      return;
    }

    console.error(error);
    video.error = error instanceof Error ? error.message : 'Не удалось создать видео';
  }
}

function resetVideo() {
  if (video.url) {
    URL.revokeObjectURL(video.url);
  }

  video.progress = 0;
  video.url = null;
  video.blob = null;
  video.error = null;
}

function closeVideo() {
  videoAbort?.abort();
  video.open = false;
  window.setTimeout(resetVideo, 300);
}

async function shareVideo() {
  if (!video.blob) {
    return;
  }

  try {
    const result = await shareOrDownload(video.blob, videoName.value, title.value);

    if (result === 'downloaded') {
      ui.notify('Видео сохранено — загрузите его в Reels или Stories', 'success');
    }
  } catch (error) {
    console.error(error);
    ui.notify('Не удалось поделиться видео', 'error');
  }
}

function downloadVideo() {
  if (video.blob) {
    downloadBlob(video.blob, videoName.value);
  }
}

/* ---------- Photo ---------- */

async function loadPhoto(file: File) {
  try {
    await studio.setPhoto(file);
    activeTab.value = 'background';
  } catch (error) {
    ui.notify(
      error instanceof PhotoImportError ? error.message : 'Не удалось открыть фото',
      'error',
    );
  }
}

async function pickPhoto(capture: boolean) {
  const file = await pickFile({ accept: 'image/*', capture: capture ? 'environment' : undefined });

  if (file) {
    await loadPhoto(file);
  }
}

function onPreviewDrop(event: DragEvent) {
  const file = event.dataTransfer?.files[0];

  if (file && file.type.startsWith('image/')) {
    event.preventDefault();
    void loadPhoto(file);
  }
}

const canMovePhoto = computed(
  () =>
    settings.value.backgroundMode === 'photo' && Boolean(studio.photo) && !template.value.usesMap,
);

/* ---------- UI state ---------- */

type Tab = 'template' | 'background' | 'style' | 'data';

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'template', label: 'Шаблон', icon: 'mdi-view-dashboard-outline' },
  { id: 'background', label: 'Фон', icon: 'mdi-image-outline' },
  { id: 'style', label: 'Стиль', icon: 'mdi-palette-outline' },
  { id: 'data', label: 'Данные', icon: 'mdi-format-list-bulleted' },
];

const activeTab = ref<Tab>('template');
const showSafeZones = usePersistentRef('rv:safe-zones', true);

const formats = Object.entries(CARD_FORMATS) as [CardFormat, (typeof CARD_FORMATS)[CardFormat]][];
const modes: { id: StudioMode; label: string; icon: string }[] = [
  { id: 'photo', label: 'Фото', icon: 'mdi-image-outline' },
  { id: 'video', label: 'Видео', icon: 'mdi-movie-open-play-outline' },
];
const durations = [10, 15, 20] as const;

function selectTemplate(id: TemplateId) {
  studio.setTemplate(id);
}

function goBack() {
  void router.push('/activity');
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !video.open) {
    goBack();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);

  // Warm up the map snapshot so the "Map" thumbnail shows the real area.
  window.setTimeout(async () => {
    if (!template.value.usesMap && data.value) {
      const snapshot = await loadSnapshot(settings.value.format, settings.value.mapStyle, true);

      if (snapshot && !template.value.usesMap) {
        mapSnapshot.value = snapshot;
      }
    }
  }, 900);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.clearTimeout(pngTimer);
  videoAbort?.abort();
  resetVideo();
});
</script>

<template>
  <div v-if="data && renderInput" class="studio" :class="{ 'studio--desktop': isDesktop }">
    <header class="studio__header">
      <button
        type="button"
        class="rv-icon-btn"
        aria-label="Назад к тренировке"
        title="Назад (Esc)"
        @click="goBack"
      >
        <v-icon icon="mdi-arrow-left" size="22" />
      </button>

      <div class="studio__title" v-if="isDesktop">
        <span class="rv-eyebrow">Студия</span>
        <strong>{{ title }}</strong>
      </div>

      <div class="rv-segmented studio__modes">
        <button
          v-for="item in modes"
          :key="item.id"
          type="button"
          class="rv-segmented__item"
          :class="{ 'rv-segmented__item--active': studio.mode === item.id }"
          @click="studio.mode = item.id"
        >
          <v-icon v-if="isDesktop" :icon="item.icon" size="16" />
          {{ item.label }}
        </button>
      </div>

      <div class="studio__actions">
        <template v-if="studio.mode === 'photo'">
          <template v-if="isDesktop">
            <button
              type="button"
              class="rv-icon-btn"
              :class="{ 'rv-icon-btn--active': showSafeZones }"
              title="Безопасные зоны Stories"
              aria-label="Безопасные зоны Stories"
              :disabled="settings.format !== 'story'"
              @click="showSafeZones = !showSafeZones"
            >
              <v-icon icon="mdi-border-outside" size="20" />
            </button>
            <button
              v-if="canCopy"
              type="button"
              class="rv-btn rv-btn--secondary rv-btn--small"
              @click="copyPng"
            >
              <v-icon icon="mdi-content-copy" size="18" />
              {{ template.isSticker ? 'Копировать стикер' : 'Копировать' }}
            </button>
            <button
              type="button"
              class="rv-btn rv-btn--secondary rv-btn--small"
              @click="downloadPng"
            >
              <v-icon icon="mdi-download" size="18" />
              Скачать
            </button>
          </template>

          <v-menu v-else location="bottom end" offset="8">
            <template #activator="{ props: menuProps }">
              <button type="button" class="rv-icon-btn" v-bind="menuProps" aria-label="Ещё">
                <v-icon icon="mdi-dots-horizontal" size="22" />
              </button>
            </template>
            <div class="menu rv-glass">
              <button type="button" class="menu__item" @click="downloadPng">
                <v-icon icon="mdi-download" size="18" /> Скачать PNG
              </button>
              <button v-if="canCopy" type="button" class="menu__item" @click="copyPng">
                <v-icon icon="mdi-content-copy" size="18" />
                {{ template.isSticker ? 'Копировать стикер' : 'Копировать' }}
              </button>
              <button
                type="button"
                class="menu__item"
                :disabled="settings.format !== 'story'"
                @click="showSafeZones = !showSafeZones"
              >
                <v-icon
                  :icon="showSafeZones ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'"
                  size="18"
                />
                Безопасные зоны
              </button>
            </div>
          </v-menu>

          <button
            type="button"
            class="rv-btn rv-btn--primary studio__share"
            :disabled="isExporting"
            @click="sharePng"
          >
            <v-progress-circular v-if="isExporting" indeterminate size="16" width="2" />
            <v-icon v-else icon="mdi-export-variant" size="18" />
            Поделиться
          </button>
        </template>

        <button
          v-else
          type="button"
          class="rv-btn rv-btn--primary studio__share"
          @click="createVideo"
        >
          <v-icon icon="mdi-movie-open-play" size="18" />
          {{ isDesktop ? 'Создать видео' : 'Видео' }}
        </button>
      </div>
    </header>

    <main class="studio__body">
      <section class="studio__stage" @dragover.prevent @drop="onPreviewDrop">
        <StudioPreview
          class="studio__preview"
          :input="renderInput"
          :mode="studio.mode"
          :video-duration="studio.videoDuration"
          :can-move-photo="canMovePhoto"
          :show-safe-zones="showSafeZones && studio.mode === 'photo'"
          @update:photo-transform="studio.photoTransform = $event"
        >
          <template #video-extra>
            <div class="rv-segmented studio__durations" aria-label="Длительность видео">
              <button
                v-for="duration in durations"
                :key="duration"
                type="button"
                class="rv-segmented__item"
                :class="{ 'rv-segmented__item--active': studio.videoDuration === duration }"
                @click="studio.videoDuration = duration"
              >
                {{ duration }} с
              </button>
            </div>
          </template>
        </StudioPreview>

        <div class="studio__formats">
          <div class="rv-segmented">
            <button
              v-for="[id, format] in formats"
              :key="id"
              type="button"
              class="rv-segmented__item"
              :class="{ 'rv-segmented__item--active': settings.format === id }"
              @click="studio.setFormat(id)"
            >
              {{ format.label }}
              <small class="studio__format-hint">{{ format.hint }}</small>
            </button>
          </div>
        </div>
      </section>

      <aside class="studio__panel">
        <nav class="studio__tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            class="studio__tab"
            :class="{ 'studio__tab--active': activeTab === tab.id }"
            :aria-selected="activeTab === tab.id"
            @click="activeTab = tab.id"
          >
            <v-icon :icon="tab.icon" size="20" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>

        <div class="studio__tab-content">
          <TemplatePicker
            v-show="activeTab === 'template'"
            :data="data"
            :settings="settings"
            :photo="studio.photo"
            :photo-transform="studio.photoTransform"
            :map="thumbnailMap"
            :layout="isDesktop ? 'grid' : 'strip'"
            @select="selectTemplate"
          />

          <BackgroundPanel
            v-if="activeTab === 'background'"
            :settings="settings"
            :photo="studio.photo"
            :map-loading="mapLoading"
            @pick-photo="pickPhoto"
            @drop-photo="loadPhoto"
            @clear-photo="studio.clearPhoto"
            @photo-colors="studio.applyPhotoColors"
            @set-mode="studio.setBackgroundMode"
            @set-map-style="studio.settings.mapStyle = $event"
            @update:photo-scrim="studio.settings.photoScrim = $event"
            @update:photo-blur="studio.settings.photoBlur = $event"
          />

          <StylePanel
            v-if="activeTab === 'style'"
            :settings="settings"
            :has-heart-rate="data.available.heartRate"
            @set-palette="studio.setPalette"
            @set-color="studio.setCustomColor"
            @update:route-color-mode="studio.settings.routeColorMode = $event"
            @update:route-width="studio.settings.routeWidth = $event"
            @update:route-glow="studio.settings.routeGlow = $event"
          />

          <DataPanel
            v-if="activeTab === 'data'"
            :settings="settings"
            :data="data"
            :max-stats="studio.maxStats"
            @update:title="studio.settings.title = $event"
            @update:show-date="studio.settings.showDate = $event"
            @update:show-brand="studio.settings.showBrand = $event"
            @toggle="studio.toggleStat"
            @move="studio.moveStat"
          />
        </div>
      </aside>
    </main>

    <div v-if="mapLoading && template.usesMap" class="studio__loading rv-glass">
      <v-progress-circular indeterminate size="16" width="2" color="primary" />
      Рисуем карту…
    </div>

    <VideoExportDialog
      :open="video.open"
      :progress="video.progress"
      :video-url="video.url"
      :extension="video.extension"
      :error="video.error"
      @cancel="closeVideo"
      @close="closeVideo"
      @share="shareVideo"
      @download="downloadVideo"
    />
  </div>
</template>

<style scoped>
.studio {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(120% 60% at 50% 0%, rgb(212 255 63 / 6%), transparent 60%), var(--rv-bg);
}

.studio__header {
  display: flex;
  min-height: 60px;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  padding: calc(8px + var(--rv-safe-top)) 12px 8px;
}

.studio__title {
  display: flex;
  min-width: 0;
  flex: 0 1 auto;
  flex-direction: column;
}

.studio__title strong {
  overflow: hidden;
  max-width: 220px;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.studio__modes {
  margin-right: auto;
}

.studio--desktop .studio__modes {
  margin-inline: auto;
}

.studio__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.studio__share {
  min-height: 40px;
  padding: 0 16px;
  font-size: 14px;
  box-shadow: 0 8px 24px rgb(212 255 63 / 20%);
}

.studio__body {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.studio__stage {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 12px;
  padding: 4px 16px 12px;
}

.studio__preview {
  min-height: 0;
  flex: 1 1 auto;
}

.studio__formats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.studio__format-hint {
  margin-left: 2px;
  opacity: 0.55;
  font-size: 11px;
}

.studio__panel {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  border-top: 1px solid var(--rv-border);
  background: var(--rv-surface);
}

.studio__tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 2px 8px 0;
}

.studio__tab {
  display: flex;
  min-height: 48px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 0;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--rv-text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease;
}

.studio__tab:hover {
  color: var(--rv-text);
}

.studio__tab--active {
  border-bottom-color: var(--rv-accent);
  color: var(--rv-text);
}

.studio__durations .rv-segmented__item {
  min-height: 28px;
  padding: 0 9px;
  font-size: 12px;
}

.studio__tab-content {
  height: min(32dvh, 256px);
  padding: 16px 16px calc(16px + var(--rv-safe-bottom));
  overflow-y: auto;
  overscroll-behavior: contain;
}

.studio__loading {
  position: fixed;
  z-index: 30;
  top: calc(70px + var(--rv-safe-top));
  left: 50%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  transform: translateX(-50%);
}

.menu {
  display: flex;
  min-width: 220px;
  flex-direction: column;
  padding: 6px;
  border-radius: var(--rv-radius-md);
}

.menu__item {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--rv-text);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.menu__item:hover {
  background: rgb(255 255 255 / 8%);
}

.menu__item:disabled {
  opacity: 0.4;
}

/* ---------- Desktop ---------- */

.studio--desktop .studio__header {
  padding: 12px 20px;
  border-bottom: 1px solid var(--rv-border);
}

.studio--desktop .studio__body {
  flex-direction: row;
}

.studio--desktop .studio__stage {
  padding: 24px;
}

.studio--desktop .studio__panel {
  width: 380px;
  border-top: 0;
  border-left: 1px solid var(--rv-border);
}

.studio--desktop .studio__tab-content {
  height: auto;
  flex: 1 1 auto;
  padding: 20px;
}

@media (max-width: 999px) {
  .studio__header {
    gap: 6px;
    padding-inline: 8px;
  }

  .studio__modes .rv-segmented__item {
    padding: 0 10px;
  }

  .studio__share {
    padding: 0 12px;
    gap: 6px;
  }
}

@media (max-width: 380px) {
  .studio__modes .rv-segmented__item {
    padding: 0 9px;
  }

  .studio__format-hint {
    display: none;
  }
}
</style>
