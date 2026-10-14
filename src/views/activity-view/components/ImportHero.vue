<script setup lang="ts">
import { ref } from 'vue';
import BrandMark from '@/shared/ui/BrandMark.vue';
import type { StoredActivityMeta } from '@/entities/activity/lib/activity-storage';
import { formatClock, formatDistanceKm, formatShortDate } from '@/shared/lib/formatters/formatters';

defineProps<{
  recents: StoredActivityMeta[];
  isImporting: boolean;
}>();

const emit = defineEmits<{
  pick: [];
  sample: [];
  open: [id: string];
}>();

type Source = 'strava' | 'garmin' | 'apple';

const helpSource = ref<Source>('strava');

const helpSteps: Record<Source, { title: string; steps: string[] }> = {
  strava: {
    title: 'Strava',
    steps: [
      'Откройте тренировку на strava.com (в браузере, не в приложении)',
      'Нажмите «⋯» слева от карты',
      'Выберите «Экспорт GPX»',
    ],
  },
  garmin: {
    title: 'Garmin Connect',
    steps: [
      'Откройте тренировку в connect.garmin.com',
      'Нажмите на шестерёнку справа вверху',
      'Выберите «Экспорт в GPX»',
    ],
  },
  apple: {
    title: 'Apple Watch',
    steps: [
      'Установите приложение для экспорта, например HealthFit или RunGap',
      'Выберите тренировку и формат GPX',
      'Сохраните файл в «Файлы» и откройте его здесь',
    ],
  },
};

const features = ['7 шаблонов', 'Stories · Пост · Квадрат', 'Видео для Reels', 'Своё фото на фоне'];
</script>

<template>
  <div class="hero">
    <div class="hero__glow" aria-hidden="true" />
    <svg
      class="hero__route"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <path
        d="M-40 620 C 160 600 180 420 330 440 S 520 640 640 520 S 760 220 900 260 S 1080 420 1260 160"
        fill="none"
        stroke="url(#hero-route)"
        stroke-width="5"
        stroke-linecap="round"
        pathLength="1"
      />
      <defs>
        <linearGradient id="hero-route" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#22d3ee" stop-opacity="0" />
          <stop offset="0.35" stop-color="#a3e635" />
          <stop offset="1" stop-color="#d4ff3f" />
        </linearGradient>
      </defs>
    </svg>

    <header class="hero__header">
      <BrandMark />
    </header>

    <main class="hero__main">
      <section class="hero__copy">
        <h1 class="hero__title rv-display">Пробежка&nbsp;—<br />в&nbsp;готовый пост</h1>
        <p class="hero__lead">
          Загрузите GPX из Strava, Garmin или Apple Watch — получите карточку или видео для Stories
          и Reels за минуту.
        </p>

        <ul class="hero__features">
          <li v-for="feature in features" :key="feature">
            <v-icon icon="mdi-check" size="14" />
            {{ feature }}
          </li>
        </ul>
      </section>

      <section class="drop rv-glass" aria-label="Загрузка тренировки">
        <div class="drop__icon">
          <v-icon icon="mdi-map-marker-path" size="30" />
        </div>
        <h2 class="drop__title">Перетащите GPX-файл сюда</h2>
        <p class="drop__hint">Файл обрабатывается только на вашем устройстве</p>

        <button
          type="button"
          class="rv-btn rv-btn--primary rv-btn--block"
          :disabled="isImporting"
          @click="emit('pick')"
        >
          <v-progress-circular v-if="isImporting" indeterminate size="18" width="2" />
          <v-icon v-else icon="mdi-tray-arrow-up" size="20" />
          Выбрать файл
        </button>

        <button
          type="button"
          class="rv-btn rv-btn--ghost rv-btn--block"
          :disabled="isImporting"
          @click="emit('sample')"
        >
          <v-icon icon="mdi-play-circle-outline" size="20" />
          Попробовать на примере
        </button>

        <div v-if="recents.length" class="drop__recents">
          <div class="rv-eyebrow">Недавние</div>
          <button
            v-for="item in recents.slice(0, 3)"
            :key="item.id"
            type="button"
            class="recent-card"
            @click="emit('open', item.id)"
          >
            <v-icon icon="mdi-run" size="18" />
            <span class="recent-card__name">{{ item.name }}</span>
            <span class="recent-card__meta rv-num">
              {{ formatShortDate(new Date(item.startedAt)) }} ·
              {{ formatDistanceKm(item.distanceMeters) }} км ·
              {{ formatClock(item.durationSeconds) }}
            </span>
          </button>
        </div>

        <details class="help">
          <summary>
            <v-icon icon="mdi-help-circle-outline" size="18" />
            Где взять GPX-файл?
          </summary>
          <div class="help__tabs rv-segmented">
            <button
              v-for="(item, key) in helpSteps"
              :key="key"
              type="button"
              class="rv-segmented__item"
              :class="{ 'rv-segmented__item--active': helpSource === key }"
              @click="helpSource = key"
            >
              {{ item.title }}
            </button>
          </div>
          <ol class="help__steps">
            <li v-for="step in helpSteps[helpSource].steps" :key="step">{{ step }}</li>
          </ol>
        </details>
      </section>
    </main>
  </div>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 100dvh;
  overflow: hidden auto;
  background: var(--rv-bg);
}

.hero__glow {
  position: absolute;
  inset: -20% -10% auto auto;
  width: 70vmax;
  height: 70vmax;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(212 255 63 / 16%) 0%, rgb(212 255 63 / 0%) 60%);
  pointer-events: none;
}

.hero__route {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.55;
  pointer-events: none;
}

.hero__route path {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: hero-draw 3.2s var(--rv-ease-out) 0.2s forwards;
}

@keyframes hero-draw {
  to {
    stroke-dashoffset: 0;
  }
}

.hero__header {
  position: relative;
  padding: calc(20px + var(--rv-safe-top)) 24px 0;
}

.hero__main {
  position: relative;
  display: grid;
  max-width: 1120px;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 420px);
  align-items: center;
  gap: 56px;
  margin: 0 auto;
  padding: 7vh 24px 48px;
}

.hero__title {
  margin: 0 0 20px;
  font-size: clamp(40px, 6.4vw, 84px);
  font-weight: 700;
  line-height: 0.98;
  letter-spacing: -0.045em;
}

.hero__lead {
  max-width: 520px;
  margin: 0 0 28px;
  color: var(--rv-text-muted);
  font-size: 18px;
  line-height: 1.5;
}

.hero__features {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hero__features li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid var(--rv-border-strong);
  border-radius: 999px;
  background: rgb(255 255 255 / 3%);
  font-size: 13px;
  font-weight: 600;
}

.hero__features li .v-icon {
  color: var(--rv-accent);
}

.drop {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 28px 24px 20px;
  border: 1px dashed rgb(255 255 255 / 18%);
  border-radius: var(--rv-radius-xl);
  text-align: center;
}

.drop__icon {
  display: grid;
  width: 64px;
  height: 64px;
  margin: 0 auto 6px;
  place-items: center;
  border-radius: 20px;
  background: var(--rv-accent-soft);
  color: var(--rv-accent);
}

.drop__title {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
}

.drop__hint {
  margin: 0 0 10px;
  color: var(--rv-text-muted);
  font-size: 13px;
}

.drop__recents {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--rv-border);
  text-align: left;
}

.recent-card {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: center;
  column-gap: 10px;
  padding: 10px 12px;
  border: 0;
  border-radius: 14px;
  background: rgb(255 255 255 / 5%);
  color: var(--rv-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.recent-card:hover {
  background: rgb(255 255 255 / 9%);
}

.recent-card .v-icon {
  grid-row: span 2;
  color: var(--rv-accent);
}

.recent-card__name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-card__meta {
  color: var(--rv-text-muted);
  font-size: 12px;
}

.help {
  margin-top: 6px;
  text-align: left;
}

.help summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  color: var(--rv-text-muted);
  font-size: 14px;
  font-weight: 600;
  list-style: none;
  cursor: pointer;
}

.help summary::-webkit-details-marker {
  display: none;
}

.help summary:hover {
  color: var(--rv-text);
}

.help__tabs {
  display: flex;
  margin: 6px 0 10px;
}

.help__tabs .rv-segmented__item {
  flex: 1 1 0;
  padding: 0 6px;
}

.help__steps {
  margin: 0;
  padding-left: 20px;
  color: var(--rv-text-muted);
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 860px) {
  .hero__main {
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
    padding: 5vh 16px 32px;
  }

  .hero__header {
    padding: calc(16px + var(--rv-safe-top)) 16px 0;
  }

  .hero__lead {
    font-size: 16px;
  }
}
</style>
