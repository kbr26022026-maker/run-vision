<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import type { CardData } from '@/entities/card/card-data';
import type { CardSettings, PhotoTransform, TemplateId } from '@/entities/card/card.types';
import type { MapSnapshot, PhotoAsset } from '@/entities/card/render/env';
import { getCardSize, renderCard } from '@/entities/card/render/render-card';
import { TEMPLATES, type TemplateMeta } from '@/entities/card/templates';

const props = defineProps<{
  data: CardData;
  settings: CardSettings;
  photo: PhotoAsset | null;
  photoTransform: PhotoTransform;
  map: MapSnapshot | null;
  layout: 'grid' | 'strip';
}>();

const emit = defineEmits<{
  select: [id: TemplateId];
}>();

const canvases = ref<Record<string, HTMLCanvasElement | null>>({});
const THUMB_WIDTH = 132;

function thumbSettings(template: TemplateMeta): CardSettings {
  const usePhoto =
    Boolean(props.photo) && props.settings.backgroundMode === 'photo' && template.supportsPhoto;

  return {
    ...props.settings,
    templateId: template.id,
    paletteId: template.defaultPaletteId,
    customColors: null,
    routeColorMode: template.defaultRouteColorMode,
    routeGlow: template.id === 'neon',
    backgroundMode: usePhoto ? 'photo' : template.defaultBackground,
    title: props.settings.title,
  };
}

function renderThumbs() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);

  for (const template of TEMPLATES) {
    const canvas = canvases.value[template.id];

    if (!canvas) {
      continue;
    }

    const settings = thumbSettings(template);
    const { width, height } = getCardSize(settings);
    const scale = (THUMB_WIDTH * ratio) / width;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    renderCard(
      canvas.getContext('2d')!,
      {
        data: props.data,
        settings,
        assets: { photo: props.photo, photoTransform: props.photoTransform, map: props.map },
        backdrop: null,
      },
      scale,
    );
  }
}

let timer = 0;

function scheduleRender() {
  window.clearTimeout(timer);
  timer = window.setTimeout(renderThumbs, 120);
}

watch(
  () => [
    props.data,
    props.settings.format,
    props.settings.stats,
    props.settings.title,
    props.settings.showDate,
    props.settings.showBrand,
    props.settings.backgroundMode,
    props.settings.mapStyle,
    props.photo,
    props.map,
  ],
  scheduleRender,
  { deep: true },
);

onMounted(async () => {
  await nextTick();
  renderThumbs();
  void document.fonts?.ready.then(renderThumbs);
});
</script>

<template>
  <div class="templates" :class="`templates--${layout}`" role="listbox" aria-label="Шаблоны">
    <button
      v-for="template in TEMPLATES"
      :key="template.id"
      type="button"
      role="option"
      class="template"
      :class="{ 'template--active': template.id === settings.templateId }"
      :aria-selected="template.id === settings.templateId"
      @click="emit('select', template.id)"
    >
      <span class="template__thumb" :class="{ 'template__thumb--sticker': template.isSticker }">
        <canvas :ref="(element) => (canvases[template.id] = element as HTMLCanvasElement | null)" />
      </span>
      <span class="template__name">{{ template.name }}</span>
      <span v-if="layout === 'grid'" class="template__description">{{ template.description }}</span>
    </button>
  </div>
</template>

<style scoped>
.templates--grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 12px;
}

.templates--strip {
  display: flex;
  gap: 10px;
  padding: 2px 2px 6px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
}

.templates--strip::-webkit-scrollbar {
  display: none;
}

.template {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--rv-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  scroll-snap-align: start;
}

.templates--strip .template {
  flex: 0 0 96px;
}

.template__thumb {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: 14px;
  outline: 2px solid transparent;
  outline-offset: 2px;
  background: var(--rv-surface-2);
  transition:
    outline-color 0.15s ease,
    transform 0.2s var(--rv-ease-spring);
}

.template__thumb--sticker {
  background-color: #2a2a2e;
  background-image:
    linear-gradient(45deg, #36363b 25%, transparent 25%),
    linear-gradient(-45deg, #36363b 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #36363b 75%),
    linear-gradient(-45deg, transparent 75%, #36363b 75%);
  background-position:
    0 0,
    0 6px,
    6px -6px,
    -6px 0;
  background-size: 12px 12px;
}

.template__thumb canvas {
  display: block;
  width: 100%;
  height: auto;
}

.template:hover .template__thumb {
  transform: translateY(-2px);
}

.template--active .template__thumb {
  outline-color: var(--rv-accent);
}

.template__name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template--active .template__name {
  color: var(--rv-accent);
}

.template__description {
  margin-top: -4px;
  color: var(--rv-text-muted);
  font-size: 12px;
  line-height: 1.3;
}
</style>
