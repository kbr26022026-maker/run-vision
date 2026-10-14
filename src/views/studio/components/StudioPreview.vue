<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { PhotoTransform, StudioMode } from '@/entities/card/card.types';
import { clampPhotoTransform } from '@/entities/card/render/background';
import { getCardSize, renderCard, type RenderCardInput } from '@/entities/card/render/render-card';
import { SAFE_AREAS } from '@/entities/card/render/env';
import { getVideoTimeline } from '@/entities/card/export/export-video';

const props = defineProps<{
  input: Omit<RenderCardInput, 't'>;
  mode: StudioMode;
  videoDuration: number;
  canMovePhoto: boolean;
  showSafeZones: boolean;
}>();

const emit = defineEmits<{
  'update:photoTransform': [value: PhotoTransform];
}>();

const stage = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const display = ref({ width: 0, height: 0 });
const isPlaying = ref(true);
const videoTime = ref(0);

const size = computed(() => getCardSize(props.input.settings));
const isTransparent = computed(
  () =>
    props.input.settings.backgroundMode === 'transparent' &&
    !props.input.settings.templateId.startsWith('map'),
);

let resizeObserver: ResizeObserver | null = null;
let frame = 0;
let animationFrame = 0;
let lastTimestamp = 0;

function layout() {
  const element = stage.value;

  if (!element) {
    return;
  }

  const { width: cardWidth, height: cardHeight } = size.value;
  const availableWidth = element.clientWidth;
  const availableHeight = element.clientHeight;
  const scale = Math.min(availableWidth / cardWidth, availableHeight / cardHeight);

  display.value = {
    width: Math.max(1, Math.floor(cardWidth * scale)),
    height: Math.max(1, Math.floor(cardHeight * scale)),
  };
}

function draw() {
  const element = canvas.value;

  if (!element || display.value.width === 0) {
    return;
  }

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  // Never render more pixels than the export itself has.
  const pixelWidth = Math.min(size.value.width, Math.round(display.value.width * ratio));
  const scale = pixelWidth / size.value.width;
  const pixelHeight = Math.round(size.value.height * scale);

  if (element.width !== pixelWidth || element.height !== pixelHeight) {
    element.width = pixelWidth;
    element.height = pixelHeight;
  }

  const t = props.mode === 'video' ? getVideoTimeline(videoTime.value, props.videoDuration) : 1;
  renderCard(element.getContext('2d')!, { ...props.input, t }, scale);
}

function scheduleDraw() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
}

function tick(timestamp: number) {
  if (props.mode !== 'video' || !isPlaying.value) {
    animationFrame = 0;
    return;
  }

  const delta = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
  lastTimestamp = timestamp;
  videoTime.value = (videoTime.value + delta) % props.videoDuration;
  draw();
  animationFrame = requestAnimationFrame(tick);
}

function startAnimation() {
  cancelAnimationFrame(animationFrame);
  lastTimestamp = 0;

  if (props.mode === 'video' && isPlaying.value) {
    animationFrame = requestAnimationFrame(tick);
  } else {
    scheduleDraw();
  }
}

function togglePlay() {
  isPlaying.value = !isPlaying.value;
  startAnimation();
}

function seekVideo(value: number | number[]) {
  videoTime.value = Array.isArray(value) ? (value[0] ?? 0) : value;
  isPlaying.value = false;
  startAnimation();
}

watch(() => props.input, scheduleDraw);
watch(() => props.input.settings.format, layout);
watch(display, scheduleDraw, { deep: true });
watch(
  () => props.mode,
  () => {
    videoTime.value = 0;
    isPlaying.value = true;
    startAnimation();
  },
);

onMounted(() => {
  resizeObserver = new ResizeObserver(layout);

  if (stage.value) {
    resizeObserver.observe(stage.value);
  }

  layout();
  void document.fonts?.ready.then(scheduleDraw);
  startAnimation();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  cancelAnimationFrame(frame);
  cancelAnimationFrame(animationFrame);
});

/* ---------- Photo pan & zoom ---------- */

const pointers = new Map<number, { x: number; y: number }>();
let gestureStart: {
  transform: PhotoTransform;
  distance: number;
  center: { x: number; y: number };
} | null = null;
const isDraggingPhoto = ref(false);

function currentTransform() {
  return props.input.assets.photoTransform;
}

function update(transform: PhotoTransform) {
  const photo = props.input.assets.photo;

  if (!photo) {
    return;
  }

  emit(
    'update:photoTransform',
    clampPhotoTransform(photo, size.value.width, size.value.height, transform),
  );
}

function gestureSnapshot() {
  const list = [...pointers.values()];
  const center = {
    x: list.reduce((sum, point) => sum + point.x, 0) / list.length,
    y: list.reduce((sum, point) => sum + point.y, 0) / list.length,
  };
  const distance =
    list.length > 1 ? Math.hypot(list[0]!.x - list[1]!.x, list[0]!.y - list[1]!.y) : 0;

  return { transform: { ...currentTransform() }, distance, center };
}

function onPointerDown(event: PointerEvent) {
  if (!props.canMovePhoto) {
    return;
  }

  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  gestureStart = gestureSnapshot();
  isDraggingPhoto.value = true;
}

function onPointerMove(event: PointerEvent) {
  if (!gestureStart || !pointers.has(event.pointerId)) {
    return;
  }

  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const now = gestureSnapshot();
  const start = gestureStart;
  const scale =
    start.distance > 0 && now.distance > 0
      ? start.transform.scale * (now.distance / start.distance)
      : start.transform.scale;

  update({
    scale,
    x: start.transform.x + (now.center.x - start.center.x) / display.value.width,
    y: start.transform.y + (now.center.y - start.center.y) / display.value.height,
  });
}

function onPointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId);
  gestureStart = pointers.size ? gestureSnapshot() : null;
  isDraggingPhoto.value = pointers.size > 0;
}

function onWheel(event: WheelEvent) {
  if (!props.canMovePhoto) {
    return;
  }

  event.preventDefault();
  const transform = currentTransform();
  update({ ...transform, scale: transform.scale * Math.exp(-event.deltaY * 0.0015) });
}

function resetPhoto() {
  if (props.canMovePhoto) {
    update({ x: 0, y: 0, scale: 1 });
  }
}

const safeZone = computed(() => {
  if (props.input.settings.format !== 'story') {
    return null;
  }

  const safe = SAFE_AREAS.story;
  return {
    top: `${(safe.top / size.value.height) * 100}%`,
    bottom: `${(safe.bottom / size.value.height) * 100}%`,
  };
});
</script>

<template>
  <div class="preview">
    <div ref="stage" class="preview__stage">
      <div
        class="preview__frame"
        :class="{
          'preview__frame--transparent': isTransparent,
          'preview__frame--movable': canMovePhoto,
          'preview__frame--dragging': isDraggingPhoto,
        }"
        :style="{ width: `${display.width}px`, height: `${display.height}px` }"
        data-drop-zone="photo"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel="onWheel"
        @dblclick="resetPhoto"
      >
        <canvas
          ref="canvas"
          class="preview__canvas"
          role="img"
          aria-label="Предпросмотр карточки"
        />

        <template v-if="showSafeZones && safeZone">
          <div class="safe-zone safe-zone--top" :style="{ height: safeZone.top }">
            <span>Здесь будет профиль Instagram</span>
          </div>
          <div class="safe-zone safe-zone--bottom" :style="{ height: safeZone.bottom }">
            <span>Здесь поле ответа</span>
          </div>
        </template>

        <transition name="hint">
          <div
            v-if="canMovePhoto && !isDraggingPhoto"
            class="preview__hint"
            :style="{
              bottom: showSafeZones && safeZone ? `calc(${safeZone.bottom} + 12px)` : '12px',
            }"
          >
            <v-icon icon="mdi-gesture-pinch" size="16" />
            Двигайте и масштабируйте фото
          </div>
        </transition>
      </div>
    </div>

    <div v-if="mode === 'video'" class="video-bar">
      <button
        type="button"
        class="rv-icon-btn"
        :aria-label="isPlaying ? 'Пауза' : 'Воспроизвести'"
        @click="togglePlay"
      >
        <v-icon :icon="isPlaying ? 'mdi-pause' : 'mdi-play'" size="22" />
      </button>
      <v-slider
        class="video-bar__slider"
        :model-value="videoTime"
        :min="0"
        :max="videoDuration"
        :step="0.01"
        hide-details
        @update:model-value="seekVideo"
      />
      <span class="video-bar__time rv-num">{{ videoTime.toFixed(1) }} с</span>
      <slot name="video-extra" />
    </div>
  </div>
</template>

<style scoped>
.preview {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
}

.preview__stage {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
}

.preview__frame {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 8%),
    0 30px 80px rgb(0 0 0 / 55%);
  touch-action: none;
}

.preview__frame--transparent {
  background-color: #2a2a2e;
  background-image:
    linear-gradient(45deg, #3a3a3f 25%, transparent 25%),
    linear-gradient(-45deg, #3a3a3f 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #3a3a3f 75%),
    linear-gradient(-45deg, transparent 75%, #3a3a3f 75%);
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0;
  background-size: 20px 20px;
}

.preview__frame--movable {
  cursor: grab;
}

.preview__frame--dragging {
  cursor: grabbing;
}

.preview__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.safe-zone {
  position: absolute;
  right: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: repeating-linear-gradient(
    -45deg,
    rgb(255 255 255 / 7%) 0 8px,
    rgb(255 255 255 / 0%) 8px 16px
  );
  color: rgb(255 255 255 / 75%);
  font-size: 11px;
  font-weight: 600;
  pointer-events: none;
}

.safe-zone span {
  padding: 3px 8px;
  border-radius: 6px;
  background: rgb(0 0 0 / 55%);
}

.safe-zone--top {
  top: 0;
  border-bottom: 1px dashed rgb(255 255 255 / 45%);
}

.safe-zone--bottom {
  bottom: 0;
  border-top: 1px dashed rgb(255 255 255 / 45%);
}

.preview__hint {
  position: absolute;
  bottom: 12px;
  left: 50%;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgb(10 10 11 / 70%);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.hint-enter-active,
.hint-leave-active {
  transition: opacity 0.2s ease;
}

.hint-enter-from,
.hint-leave-to {
  opacity: 0;
}

.video-bar {
  display: flex;
  width: min(100%, 560px);
  align-items: center;
  gap: 10px;
  margin: 0 auto;
}

.video-bar__slider {
  flex: 1 1 auto;
}

.video-bar__time {
  min-width: 40px;
  color: var(--rv-text-muted);
  font-size: 12px;
  text-align: right;
}
</style>
