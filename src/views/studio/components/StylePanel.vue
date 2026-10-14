<script setup lang="ts">
import { computed } from 'vue';
import type { CardSettings } from '@/entities/card/card.types';
import { PALETTES, resolvePalette } from '@/entities/card/palettes';
import { getTemplate } from '@/entities/card/templates';
import { ROUTE_COLOR_MODE_LABELS, type RouteColorMode } from '@/shared/lib/color/color-scales';

const props = defineProps<{
  settings: CardSettings;
  hasHeartRate: boolean;
}>();

const emit = defineEmits<{
  setPalette: [id: string];
  setColor: [key: 'background' | 'accent' | 'text', value: string];
  'update:routeColorMode': [value: RouteColorMode];
  'update:routeWidth': [value: number];
  'update:routeGlow': [value: boolean];
}>();

const current = computed(() => resolvePalette(props.settings));
const template = computed(() => getTemplate(props.settings.templateId));
const showPalettes = computed(() => !template.value.usesMap);

const colorModes = computed<RouteColorMode[]>(() =>
  (['solid', 'pace', 'heartRate', 'elevation'] as RouteColorMode[]).filter(
    (mode) => mode !== 'heartRate' || props.hasHeartRate,
  ),
);

const colorFields = [
  { key: 'background' as const, label: 'Фон' },
  { key: 'accent' as const, label: 'Маршрут' },
  { key: 'text' as const, label: 'Текст' },
];

function swatchStyle(palette: (typeof PALETTES)[number]) {
  return {
    background: palette.background2
      ? `linear-gradient(135deg, ${palette.background}, ${palette.background2})`
      : palette.background,
  };
}
</script>

<template>
  <div class="panel">
    <section v-if="showPalettes" class="panel__section">
      <div class="rv-eyebrow">Палитра</div>
      <div class="palettes">
        <button
          v-for="palette in PALETTES"
          :key="palette.id"
          type="button"
          class="palette"
          :class="{
            'palette--active': !settings.customColors && settings.paletteId === palette.id,
          }"
          :title="palette.name"
          :aria-label="palette.name"
          @click="emit('setPalette', palette.id)"
        >
          <span class="palette__swatch" :style="swatchStyle(palette)">
            <span class="palette__route" :style="{ background: palette.accent }" />
            <span class="palette__text" :style="{ background: palette.text }" />
          </span>
          <span class="palette__name">{{ palette.name }}</span>
        </button>
      </div>

      <div class="custom">
        <label v-for="field in colorFields" :key="field.key" class="custom__field">
          <span class="custom__swatch" :style="{ background: current[field.key] }">
            <input
              type="color"
              :value="current[field.key]"
              :aria-label="`Цвет: ${field.label}`"
              @input="emit('setColor', field.key, ($event.target as HTMLInputElement).value)"
            />
          </span>
          {{ field.label }}
        </label>
      </div>
    </section>

    <section class="panel__section">
      <div class="rv-eyebrow">Цвет маршрута</div>
      <div class="chips">
        <button
          v-for="mode in colorModes"
          :key="mode"
          type="button"
          class="rv-chip"
          :class="{ 'rv-chip--active': settings.routeColorMode === mode }"
          @click="emit('update:routeColorMode', mode)"
        >
          {{ ROUTE_COLOR_MODE_LABELS[mode] }}
        </button>
      </div>
    </section>

    <section class="panel__section">
      <label class="slider">
        <span class="slider__label">Толщина линии</span>
        <v-slider
          :model-value="settings.routeWidth"
          :min="0.5"
          :max="2"
          :step="0.1"
          hide-details
          @update:model-value="emit('update:routeWidth', Number($event))"
        />
      </label>

      <label class="toggle">
        <span>
          <strong>Свечение</strong>
          <small>Неоновый ореол вокруг трека</small>
        </span>
        <v-switch
          :model-value="settings.routeGlow"
          color="primary"
          hide-details
          density="compact"
          inset
          @update:model-value="emit('update:routeGlow', Boolean($event))"
        />
      </label>
    </section>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.panel__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.palettes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(62px, 1fr));
  gap: 10px 8px;
}

.palette {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--rv-text-muted);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.palette__swatch {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 14px;
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 10%);
  transition: outline-color 0.15s ease;
}

.palette__route {
  position: absolute;
  top: 50%;
  right: 18%;
  left: 18%;
  height: 5px;
  border-radius: 3px;
  transform: rotate(-24deg);
}

.palette__text {
  position: absolute;
  bottom: 16%;
  left: 18%;
  width: 34%;
  height: 4px;
  border-radius: 2px;
  opacity: 0.8;
}

.palette--active .palette__swatch {
  outline-color: var(--rv-accent);
}

.palette--active {
  color: var(--rv-text);
}

.palette__name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom {
  display: flex;
  gap: 8px;
}

.custom__field {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 6px;
  border-radius: 12px;
  background: rgb(255 255 255 / 5%);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.custom__swatch {
  position: relative;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 20%);
}

.custom__swatch input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.slider__label {
  color: var(--rv-text-muted);
  font-size: 13px;
  font-weight: 600;
}

.toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.toggle strong {
  display: block;
  font-size: 14px;
}

.toggle small {
  color: var(--rv-text-muted);
  font-size: 12px;
}

.toggle :deep(.v-switch) {
  flex: 0 0 auto;
}
</style>
