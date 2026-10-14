<script setup lang="ts">
import { MAP_STYLE_OPTIONS, type MapStyleId, type ViewMode } from '@/shared/lib/map/map-styles';
import { ROUTE_COLOR_MODE_LABELS, type RouteColorMode } from '@/shared/lib/color/color-scales';

defineProps<{
  mapStyle: MapStyleId;
  viewMode: ViewMode;
  colorMode: RouteColorMode;
  follow: boolean;
  availableColorModes: RouteColorMode[];
}>();

const emit = defineEmits<{
  'update:mapStyle': [value: MapStyleId];
  'update:viewMode': [value: ViewMode];
  'update:colorMode': [value: RouteColorMode];
  'update:follow': [value: boolean];
  fit: [];
}>();

const colorModeIcons: Record<RouteColorMode, string> = {
  solid: 'mdi-circle',
  pace: 'mdi-speedometer',
  heartRate: 'mdi-heart-pulse',
  elevation: 'mdi-image-filter-hdr',
};
</script>

<template>
  <div class="toolbar rv-glass" role="toolbar" aria-label="Управление картой">
    <v-menu location="start" offset="10">
      <template #activator="{ props: menuProps }">
        <button
          type="button"
          class="rv-icon-btn"
          v-bind="menuProps"
          aria-label="Стиль карты"
          title="Стиль карты"
        >
          <v-icon icon="mdi-layers-outline" size="20" />
        </button>
      </template>
      <div class="menu rv-glass">
        <div class="rv-eyebrow menu__title">Карта</div>
        <button
          v-for="option in MAP_STYLE_OPTIONS"
          :key="option.id"
          type="button"
          class="menu__item"
          :class="{ 'menu__item--active': option.id === mapStyle }"
          @click="emit('update:mapStyle', option.id)"
        >
          <v-icon :icon="option.icon" size="18" />
          {{ option.label }}
        </button>
      </div>
    </v-menu>

    <v-menu location="start" offset="10">
      <template #activator="{ props: menuProps }">
        <button
          type="button"
          class="rv-icon-btn"
          v-bind="menuProps"
          aria-label="Цвет трека"
          title="Цвет трека"
        >
          <v-icon icon="mdi-palette-outline" size="20" />
        </button>
      </template>
      <div class="menu rv-glass">
        <div class="rv-eyebrow menu__title">Цвет трека</div>
        <button
          v-for="mode in availableColorModes"
          :key="mode"
          type="button"
          class="menu__item"
          :class="{ 'menu__item--active': mode === colorMode }"
          @click="emit('update:colorMode', mode)"
        >
          <v-icon :icon="colorModeIcons[mode]" size="18" />
          {{ ROUTE_COLOR_MODE_LABELS[mode] }}
        </button>
      </div>
    </v-menu>

    <span class="toolbar__divider" />

    <button
      type="button"
      class="rv-icon-btn toolbar__mode"
      :aria-label="viewMode === '3d' ? 'Переключить в 2D' : 'Переключить в 3D'"
      :title="viewMode === '3d' ? 'Плоская карта' : 'Объёмный рельеф'"
      @click="emit('update:viewMode', viewMode === '3d' ? '2d' : '3d')"
    >
      {{ viewMode === '3d' ? '3D' : '2D' }}
    </button>

    <button
      type="button"
      class="rv-icon-btn"
      :class="{ 'rv-icon-btn--active': follow }"
      aria-label="Камера следует за бегуном"
      title="Камера следует за бегуном"
      :aria-pressed="follow"
      @click="emit('update:follow', !follow)"
    >
      <v-icon icon="mdi-video-3d-variant" size="20" />
    </button>

    <button
      type="button"
      class="rv-icon-btn"
      aria-label="Показать весь маршрут"
      title="Показать весь маршрут"
      @click="emit('fit')"
    >
      <v-icon icon="mdi-fit-to-screen-outline" size="20" />
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 16px;
}

.toolbar__divider {
  width: 22px;
  height: 1px;
  margin: 4px 0;
  background: var(--rv-border-strong);
}

.toolbar__mode {
  font-family: var(--rv-font-display);
  font-size: 12px;
  font-weight: 700;
}

.menu {
  display: flex;
  min-width: 190px;
  flex-direction: column;
  padding: 8px;
  border-radius: var(--rv-radius-md);
}

.menu__title {
  padding: 6px 10px 8px;
}

.menu__item {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 10px;
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

.menu__item:hover {
  background: rgb(255 255 255 / 8%);
}

.menu__item--active {
  color: var(--rv-accent);
  font-weight: 600;
}
</style>
