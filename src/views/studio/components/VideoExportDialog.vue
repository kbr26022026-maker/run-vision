<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  open: boolean;
  progress: number;
  videoUrl: string | null;
  extension: string;
  error: string | null;
}>();

const emit = defineEmits<{
  cancel: [];
  close: [];
  share: [];
  download: [];
}>();

const isRendering = computed(() => !props.videoUrl && !props.error);
const percent = computed(() => Math.round(props.progress * 100));
</script>

<template>
  <v-dialog :model-value="open" max-width="440" persistent scrim="rgba(0,0,0,0.7)">
    <div class="video-dialog rv-glass">
      <template v-if="isRendering">
        <div class="video-dialog__progress">
          <v-progress-circular :model-value="percent" size="96" width="6" color="primary">
            <span class="rv-num video-dialog__percent">{{ percent }}%</span>
          </v-progress-circular>
        </div>
        <h2 class="video-dialog__title">Собираем видео</h2>
        <p class="video-dialog__text">
          Каждый кадр рисуется прямо на устройстве — обычно это занимает несколько секунд
        </p>
        <button
          type="button"
          class="rv-btn rv-btn--secondary rv-btn--block"
          @click="emit('cancel')"
        >
          Отменить
        </button>
      </template>

      <template v-else-if="error">
        <v-icon icon="mdi-alert-circle-outline" size="44" class="video-dialog__error-icon" />
        <h2 class="video-dialog__title">Не получилось</h2>
        <p class="video-dialog__text">{{ error }}</p>
        <button type="button" class="rv-btn rv-btn--secondary rv-btn--block" @click="emit('close')">
          Закрыть
        </button>
      </template>

      <template v-else-if="videoUrl">
        <video class="video-dialog__video" :src="videoUrl" autoplay loop muted playsinline />
        <div class="video-dialog__actions">
          <button type="button" class="rv-btn rv-btn--primary rv-btn--block" @click="emit('share')">
            <v-icon icon="mdi-export-variant" size="20" />
            Поделиться
          </button>
          <div class="video-dialog__row">
            <button type="button" class="rv-btn rv-btn--secondary" @click="emit('download')">
              <v-icon icon="mdi-download" size="18" />
              Скачать .{{ extension }}
            </button>
            <button type="button" class="rv-btn rv-btn--ghost" @click="emit('close')">
              Готово
            </button>
          </div>
        </div>
      </template>
    </div>
  </v-dialog>
</template>

<style scoped>
.video-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 28px 22px 22px;
  border-radius: var(--rv-radius-xl);
  text-align: center;
}

.video-dialog__progress {
  margin-bottom: 6px;
}

.video-dialog__percent {
  font-family: var(--rv-font-display);
  font-size: 20px;
  font-weight: 700;
}

.video-dialog__title {
  margin: 0;
  font-family: var(--rv-font-display);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.video-dialog__text {
  margin: 0 0 6px;
  color: var(--rv-text-muted);
  font-size: 14px;
  line-height: 1.45;
}

.video-dialog__error-icon {
  color: var(--rv-danger);
}

.video-dialog__video {
  display: block;
  max-width: 100%;
  max-height: 56dvh;
  border-radius: 16px;
  background: #000000;
}

.video-dialog__actions {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 8px;
}

.video-dialog__row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}
</style>
