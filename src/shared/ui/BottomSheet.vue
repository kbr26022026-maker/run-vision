<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

/**
 * Draggable sheet with two snap points: "peek" (only the #peek slot is visible) and "open".
 * Mirrors the native pattern used by Maps, Strava and Apple Fitness.
 */
const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'peek-height': [value: number];
}>();

const sheet = ref<HTMLElement | null>(null);
const peekRef = ref<HTMLElement | null>(null);
const body = ref<HTMLElement | null>(null);
const peekHeight = ref(160);
const sheetHeight = ref(600);
const dragOffset = ref<number | null>(null);

let startY = 0;
let startTranslate = 0;
let lastY = 0;
let lastTime = 0;
let velocity = 0;
let resizeObserver: ResizeObserver | null = null;

const closedTranslate = computed(() => Math.max(0, sheetHeight.value - peekHeight.value));

const translate = computed(() => {
  if (dragOffset.value !== null) {
    return dragOffset.value;
  }

  return props.open ? 0 : closedTranslate.value;
});

function measure() {
  if (peekRef.value) {
    // 22px = drag handle area above the peek content.
    peekHeight.value = peekRef.value.offsetHeight + 22;
    emit('peek-height', peekHeight.value);
  }

  if (sheet.value) {
    sheetHeight.value = sheet.value.offsetHeight;
  }
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement;

  // Let interactive controls (buttons, scrubber) keep their own gestures.
  if (target.closest('button, input, [role="slider"], a, .v-overlay')) {
    return;
  }

  // When open and the content is scrolled, dragging belongs to the scroll container.
  if (props.open && body.value && body.value.contains(target) && body.value.scrollTop > 0) {
    return;
  }

  startY = event.clientY;
  lastY = event.clientY;
  lastTime = performance.now();
  velocity = 0;
  startTranslate = translate.value;
  dragOffset.value = startTranslate;
  sheet.value?.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (dragOffset.value === null) {
    return;
  }

  const now = performance.now();
  const delta = event.clientY - startY;
  const next = startTranslate + delta;

  // Rubber-band past the ends.
  dragOffset.value =
    next < 0
      ? next / 4
      : next > closedTranslate.value
        ? closedTranslate.value + (next - closedTranslate.value) / 4
        : next;

  velocity = (event.clientY - lastY) / Math.max(now - lastTime, 1);
  lastY = event.clientY;
  lastTime = now;
}

function onPointerUp(event: PointerEvent) {
  if (dragOffset.value === null) {
    return;
  }

  const moved = Math.abs(event.clientY - startY);
  const current = dragOffset.value;
  dragOffset.value = null;

  if (moved < 6) {
    // A tap on the handle area toggles the sheet.
    if ((event.target as HTMLElement).closest('.sheet__handle-zone')) {
      emit('update:open', !props.open);
    }
    return;
  }

  if (Math.abs(velocity) > 0.45) {
    emit('update:open', velocity < 0);
    return;
  }

  emit('update:open', current < closedTranslate.value / 2);
}

onMounted(() => {
  measure();
  resizeObserver = new ResizeObserver(measure);

  if (peekRef.value) {
    resizeObserver.observe(peekRef.value);
  }

  if (sheet.value) {
    resizeObserver.observe(sheet.value);
  }
});

onBeforeUnmount(() => resizeObserver?.disconnect());

watch(
  () => props.open,
  (open) => {
    if (!open && body.value) {
      body.value.scrollTop = 0;
    }
  },
);
</script>

<template>
  <section
    ref="sheet"
    class="sheet rv-glass"
    :class="{ 'sheet--dragging': dragOffset !== null, 'sheet--open': open }"
    :style="{ transform: `translate3d(0, ${translate}px, 0)` }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div class="sheet__handle-zone">
      <button
        type="button"
        class="sheet__handle"
        :aria-label="open ? 'Свернуть панель' : 'Развернуть панель'"
        :aria-expanded="open"
        @click="emit('update:open', !open)"
      />
    </div>

    <div ref="peekRef" class="sheet__peek">
      <slot name="peek" />
    </div>

    <div ref="body" class="sheet__body" :class="{ 'sheet__body--scroll': open }">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.sheet {
  position: fixed;
  z-index: 20;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  height: min(86dvh, 760px);
  flex-direction: column;
  border-bottom: 0;
  border-radius: var(--rv-radius-xl) var(--rv-radius-xl) 0 0;
  background: var(--rv-glass-strong);
  transition: transform 0.45s var(--rv-ease-out);
  touch-action: none;
  will-change: transform;
}

.sheet--dragging {
  transition: none;
}

.sheet__handle-zone {
  display: flex;
  flex: 0 0 22px;
  align-items: center;
  justify-content: center;
}

.sheet__handle {
  width: 40px;
  height: 5px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: rgb(255 255 255 / 28%);
  cursor: pointer;
}

.sheet__peek {
  flex: 0 0 auto;
  padding: 0 16px 12px;
}

.sheet__body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 4px 16px calc(24px + var(--rv-safe-bottom));
  overflow: hidden;
}

.sheet__body--scroll {
  overflow-y: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
}
</style>
