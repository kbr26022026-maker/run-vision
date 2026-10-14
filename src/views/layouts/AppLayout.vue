<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useActivityStore } from '@/stores/activity.store';
import { useUiStore } from '@/stores/ui.store';
import { useGpxImport } from '@/hooks/useGpxImport';
import { consumeLaunchedFiles, consumeSharedFile } from '@/shared/lib/pwa/register-service-worker';

const activityStore = useActivityStore();
const ui = useUiStore();
const gpx = useGpxImport();
const router = useRouter();

const isDragging = ref(false);
let dragDepth = 0;

function hasFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function onDragEnter(event: DragEvent) {
  if (!hasFiles(event)) {
    return;
  }

  event.preventDefault();
  dragDepth += 1;
  isDragging.value = true;
}

function onDragOver(event: DragEvent) {
  if (hasFiles(event)) {
    event.preventDefault();
  }
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1);

  if (dragDepth === 0) {
    isDragging.value = false;
  }
}

function onDrop(event: DragEvent) {
  dragDepth = 0;
  isDragging.value = false;

  // Photos dropped inside the studio are handled there.
  if ((event.target as HTMLElement | null)?.closest('[data-drop-zone="photo"]')) {
    return;
  }

  event.preventDefault();
  const file = event.dataTransfer?.files[0];

  if (file) {
    void gpx.importFile(file);
  }
}

const toastVisible = computed({
  get: () => ui.toast !== null,
  set: (value) => {
    if (!value) {
      ui.dismiss();
    }
  },
});

const toastIcon = computed(() => {
  switch (ui.toast?.tone) {
    case 'error':
      return 'mdi-alert-circle';
    case 'success':
      return 'mdi-check-circle';
    default:
      return 'mdi-information';
  }
});

onMounted(async () => {
  window.addEventListener('dragenter', onDragEnter);
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('dragleave', onDragLeave);
  window.addEventListener('drop', onDrop);

  consumeLaunchedFiles((file) => void gpx.importFile(file));

  const shared = await consumeSharedFile();

  if (shared) {
    await gpx.importFile(shared);
  }

  await router.isReady();

  if (router.currentRoute.value.query.shared !== undefined) {
    await router.replace({ path: '/activity', query: {} });
  }

  await activityStore.restore();
});

onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onDragEnter);
  window.removeEventListener('dragover', onDragOver);
  window.removeEventListener('dragleave', onDragLeave);
  window.removeEventListener('drop', onDrop);
});
</script>

<template>
  <v-app class="app">
    <router-view v-slot="{ Component }">
      <transition name="rv-route" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>

    <transition name="rv-fade">
      <div v-if="isDragging" class="drop-overlay" aria-live="polite">
        <div class="drop-overlay__card">
          <v-icon icon="mdi-map-marker-path" size="40" />
          <strong>Отпустите, чтобы открыть тренировку</strong>
          <span>Поддерживаются файлы .gpx</span>
        </div>
      </div>
    </transition>

    <v-snackbar
      v-model="toastVisible"
      :timeout="ui.toast?.tone === 'error' ? 6000 : 3000"
      :color="ui.toast?.tone === 'error' ? 'error' : undefined"
      class="toast"
    >
      <div class="toast__content">
        <v-icon :icon="toastIcon" size="20" />
        <span :key="ui.toast?.id">{{ ui.toast?.message }}</span>
      </div>
    </v-snackbar>
  </v-app>
</template>

<style scoped>
.app {
  min-height: 100dvh;
  background: var(--rv-bg);
}

.drop-overlay {
  position: fixed;
  z-index: 3000;
  inset: 0;
  display: grid;
  padding: 16px;
  place-items: center;
  background: rgb(10 10 11 / 70%);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  pointer-events: none;
}

.drop-overlay__card {
  display: flex;
  width: min(520px, 100%);
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 24px;
  border: 2px dashed var(--rv-accent);
  border-radius: var(--rv-radius-xl);
  background: rgb(212 255 63 / 6%);
  color: var(--rv-text);
  text-align: center;
}

.drop-overlay__card .v-icon {
  color: var(--rv-accent);
}

.drop-overlay__card strong {
  font-size: 18px;
}

.drop-overlay__card span {
  color: var(--rv-text-muted);
  font-size: 14px;
}

.toast__content {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
}

.toast :deep(.v-snackbar__wrapper) {
  margin-bottom: calc(12px + var(--rv-safe-bottom));
  border: 1px solid var(--rv-border-strong);
  background: rgb(28 28 31 / 96%);
  color: var(--rv-text);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}

.rv-route-enter-active,
.rv-route-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.32s var(--rv-ease-out);
}

.rv-route-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.99);
}

.rv-route-leave-to {
  opacity: 0;
}

.rv-fade-enter-active,
.rv-fade-leave-active {
  transition: opacity 0.18s ease;
}

.rv-fade-enter-from,
.rv-fade-leave-to {
  opacity: 0;
}
</style>
