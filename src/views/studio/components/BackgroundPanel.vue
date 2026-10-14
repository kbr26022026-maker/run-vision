<script setup lang="ts">
import { computed, ref } from 'vue';
import type { BackgroundMode, CardSettings } from '@/entities/card/card.types';
import type { PhotoAsset } from '@/entities/card/render/env';
import { getTemplate } from '@/entities/card/templates';
import { MAP_STYLE_OPTIONS, type MapStyleId } from '@/shared/lib/map/map-styles';

const props = defineProps<{
  settings: CardSettings;
  photo: PhotoAsset | null;
  mapLoading: boolean;
}>();

const emit = defineEmits<{
  pickPhoto: [capture: boolean];
  dropPhoto: [file: File];
  clearPhoto: [];
  photoColors: [];
  setMode: [mode: BackgroundMode];
  setMapStyle: [style: MapStyleId];
  'update:photoScrim': [value: number];
  'update:photoBlur': [value: number];
}>();

const template = computed(() => getTemplate(props.settings.templateId));
const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const isDropping = ref(false);

const preview = ref<HTMLCanvasElement | null>(null);

function drawThumb(element: HTMLCanvasElement | null) {
  preview.value = element;

  if (!element || !props.photo) {
    return;
  }

  const ratio = props.photo.width / props.photo.height;
  element.width = 120;
  element.height = Math.round(120 / ratio);
  element.getContext('2d')!.drawImage(props.photo.image, 0, 0, element.width, element.height);
}

function onDrop(event: DragEvent) {
  isDropping.value = false;
  const file = event.dataTransfer?.files[0];

  if (file) {
    event.preventDefault();
    emit('dropPhoto', file);
  }
}

const modes = computed(() => {
  const list: { id: BackgroundMode; label: string; icon: string }[] = [
    { id: 'palette', label: 'Цвет', icon: 'mdi-palette-swatch-outline' },
    { id: 'photo', label: 'Фото', icon: 'mdi-image-outline' },
    { id: 'transparent', label: 'Без фона', icon: 'mdi-checkerboard' },
  ];

  return template.value.supportsPhoto ? list : list.filter((mode) => mode.id !== 'photo');
});

function selectMode(mode: BackgroundMode) {
  if (mode === 'photo' && !props.photo) {
    emit('pickPhoto', false);
    return;
  }

  emit('setMode', mode);
}
</script>

<template>
  <div class="panel">
    <template v-if="template.usesMap">
      <div class="panel__section">
        <div class="rv-eyebrow">Стиль карты</div>
        <div class="map-styles">
          <button
            v-for="option in MAP_STYLE_OPTIONS"
            :key="option.id"
            type="button"
            class="map-style"
            :class="[
              `map-style--${option.id}`,
              { 'map-style--active': option.id === settings.mapStyle },
            ]"
            @click="emit('setMapStyle', option.id)"
          >
            <span class="map-style__swatch">
              <v-icon :icon="option.icon" size="20" />
            </span>
            {{ option.label }}
          </button>
        </div>
        <p class="panel__hint">
          <v-progress-circular v-if="mapLoading" indeterminate size="14" width="2" />
          {{
            mapLoading
              ? 'Рисуем карту вашего района…'
              : 'Карта строится по вашему маршруту автоматически'
          }}
        </p>
      </div>
    </template>

    <template v-else>
      <div class="rv-segmented panel__modes">
        <button
          v-for="mode in modes"
          :key="mode.id"
          type="button"
          class="rv-segmented__item"
          :class="{ 'rv-segmented__item--active': settings.backgroundMode === mode.id }"
          @click="selectMode(mode.id)"
        >
          <v-icon :icon="mode.icon" size="16" />
          {{ mode.label }}
        </button>
      </div>

      <div
        v-if="!photo && template.supportsPhoto"
        class="photo-drop"
        :class="{ 'photo-drop--active': isDropping }"
        data-drop-zone="photo"
        @dragover.prevent="isDropping = true"
        @dragleave="isDropping = false"
        @drop="onDrop"
      >
        <v-icon icon="mdi-image-plus-outline" size="28" />
        <strong>Своё фото на фоне</strong>
        <span>Селфи с забега, финиш или вид с маршрута</span>
        <div class="photo-drop__actions">
          <button
            type="button"
            class="rv-btn rv-btn--primary rv-btn--small"
            @click="emit('pickPhoto', false)"
          >
            <v-icon icon="mdi-image-multiple-outline" size="18" />
            Выбрать фото
          </button>
          <button
            v-if="isTouch"
            type="button"
            class="rv-btn rv-btn--secondary rv-btn--small"
            @click="emit('pickPhoto', true)"
          >
            <v-icon icon="mdi-camera-outline" size="18" />
            Снять
          </button>
        </div>
      </div>

      <div v-else-if="photo" class="panel__section">
        <div class="photo-row">
          <canvas
            :ref="(element) => drawThumb(element as HTMLCanvasElement | null)"
            class="photo-row__thumb"
          />
          <div class="photo-row__actions">
            <button
              type="button"
              class="rv-btn rv-btn--secondary rv-btn--small"
              @click="emit('pickPhoto', false)"
            >
              <v-icon icon="mdi-swap-horizontal" size="18" />
              Заменить
            </button>
            <button
              type="button"
              class="rv-btn rv-btn--ghost rv-btn--small"
              @click="emit('clearPhoto')"
            >
              <v-icon icon="mdi-trash-can-outline" size="18" />
              Убрать
            </button>
          </div>
        </div>

        <template v-if="settings.backgroundMode === 'photo'">
          <label class="slider">
            <span class="slider__label"
              >Затемнение <b class="rv-num">{{ Math.round(settings.photoScrim * 100) }}%</b></span
            >
            <v-slider
              :model-value="settings.photoScrim"
              :min="0"
              :max="1"
              :step="0.05"
              hide-details
              @update:model-value="emit('update:photoScrim', Number($event))"
            />
          </label>

          <label class="slider">
            <span class="slider__label"
              >Размытие <b class="rv-num">{{ Math.round(settings.photoBlur * 100) }}%</b></span
            >
            <v-slider
              :model-value="settings.photoBlur"
              :min="0"
              :max="1"
              :step="0.05"
              hide-details
              @update:model-value="emit('update:photoBlur', Number($event))"
            />
          </label>

          <button
            type="button"
            class="rv-btn rv-btn--secondary rv-btn--small rv-btn--block"
            @click="emit('photoColors')"
          >
            <v-icon icon="mdi-eyedropper-variant" size="18" />
            Подобрать цвета по фото
          </button>
        </template>
      </div>

      <p v-if="settings.backgroundMode === 'transparent'" class="panel__hint">
        <v-icon icon="mdi-information-outline" size="16" />
        PNG без фона — вставьте его поверх своего фото в Stories как стикер
      </p>
    </template>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel__modes {
  display: flex;
}

.panel__modes .rv-segmented__item {
  flex: 1 1 0;
}

.panel__hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--rv-text-muted);
  font-size: 13px;
  line-height: 1.4;
}

.photo-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 22px 16px;
  border: 1.5px dashed var(--rv-border-strong);
  border-radius: var(--rv-radius-lg);
  color: var(--rv-text-muted);
  font-size: 13px;
  text-align: center;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.photo-drop--active {
  border-color: var(--rv-accent);
  background: var(--rv-accent-soft);
}

.photo-drop .v-icon {
  color: var(--rv-accent);
}

.photo-drop strong {
  color: var(--rv-text);
  font-size: 15px;
}

.photo-drop__actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.photo-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.photo-row__thumb {
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  border-radius: 12px;
  object-fit: cover;
}

.photo-row__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.slider {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.slider__label {
  display: flex;
  justify-content: space-between;
  color: var(--rv-text-muted);
  font-size: 13px;
  font-weight: 600;
}

.slider__label b {
  color: var(--rv-text);
}

.map-styles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.map-style {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--rv-text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.map-style__swatch {
  display: grid;
  width: 100%;
  aspect-ratio: 1.3;
  place-items: center;
  border-radius: 14px;
  outline: 2px solid transparent;
  outline-offset: 2px;
}

.map-style--dark .map-style__swatch {
  background: linear-gradient(135deg, #18181b, #2a2a30);
  color: #a1a1aa;
}

.map-style--light .map-style__swatch {
  background: linear-gradient(135deg, #f4f4f5, #d4d4d8);
  color: #52525b;
}

.map-style--satellite .map-style__swatch {
  background: linear-gradient(135deg, #2f4f2f, #6b7f4f, #3d5a6c);
  color: #ffffff;
}

.map-style--active .map-style__swatch {
  outline-color: var(--rv-accent);
}

.map-style--active {
  color: var(--rv-accent);
}
</style>
