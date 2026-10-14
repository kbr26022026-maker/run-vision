<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { IActivity } from '@/entities/activity/model/activity.types';
import type { ActivitySummary } from '@/entities/activity/model/activity-analysis';
import {
  formatActivityDateTime,
  formatClock,
  formatDistanceKm,
  formatHeartRate,
  formatPace,
} from '@/shared/lib/formatters/formatters';

const props = defineProps<{
  activity: IActivity;
  summary: ActivitySummary;
}>();

const emit = defineEmits<{
  rename: [name: string];
}>();

const isEditing = ref(false);
const draft = ref('');
const input = ref<HTMLInputElement | null>(null);

async function startEditing() {
  draft.value = props.activity.name;
  isEditing.value = true;
  await nextTick();
  input.value?.select();
}

function commit() {
  if (!isEditing.value) {
    return;
  }

  isEditing.value = false;
  emit('rename', draft.value);
}

const stats = computed(() => {
  const summary = props.summary;
  const items = [
    { label: 'Время', value: formatClock(summary.movingSeconds), unit: '' },
    { label: 'Темп', value: formatPace(summary.averagePaceSecondsPerKm), unit: '/км' },
    {
      label: 'Пульс',
      value: formatHeartRate(summary.averageHeartRate),
      unit: summary.averageHeartRate ? 'уд/мин' : '',
    },
    { label: 'Набор', value: `${Math.round(summary.elevationGainMeters)}`, unit: 'м' },
    {
      label: 'Каденс',
      value: summary.averageCadence ? `${Math.round(summary.averageCadence)}` : '—',
      unit: summary.averageCadence ? 'шаг/мин' : '',
    },
    {
      label: 'Лучший км',
      value: formatPace(summary.bestPaceSecondsPerKm),
      unit: summary.bestPaceSecondsPerKm ? '/км' : '',
    },
  ];

  return items;
});
</script>

<template>
  <section class="summary">
    <div class="summary__meta rv-eyebrow">
      <v-icon icon="mdi-run-fast" size="14" />
      Бег · {{ formatActivityDateTime(activity.startedAt) }}
    </div>

    <div class="summary__title-row">
      <input
        v-if="isEditing"
        ref="input"
        v-model="draft"
        class="summary__title-input rv-display"
        maxlength="60"
        aria-label="Название тренировки"
        @blur="commit"
        @keydown.enter.prevent="commit"
        @keydown.esc.prevent="isEditing = false"
      />
      <button
        v-else
        type="button"
        class="summary__title rv-display"
        title="Переименовать"
        @click="startEditing"
      >
        {{ activity.name }}
        <v-icon icon="mdi-pencil-outline" size="16" class="summary__edit" />
      </button>
    </div>

    <div class="summary__hero rv-num">
      <span class="summary__distance rv-display">{{
        formatDistanceKm(summary.distanceMeters)
      }}</span>
      <span class="summary__distance-unit">км</span>
    </div>

    <div class="summary__grid">
      <div v-for="stat in stats" :key="stat.label" class="stat">
        <span class="stat__label">{{ stat.label }}</span>
        <span class="stat__value rv-num">
          {{ stat.value }}
          <small v-if="stat.unit">{{ stat.unit }}</small>
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.summary__meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.summary__title-row {
  min-height: 34px;
}

.summary__title {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--rv-text);
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
  text-align: left;
  cursor: text;
}

.summary__edit {
  flex: 0 0 auto;
  color: var(--rv-text-faint);
  transition: color 0.15s ease;
}

.summary__title:hover .summary__edit {
  color: var(--rv-text);
}

.summary__title-input {
  width: 100%;
  padding: 2px 8px;
  margin-left: -8px;
  border: 1px solid var(--rv-accent);
  border-radius: 10px;
  outline: none;
  background: rgb(255 255 255 / 6%);
  color: var(--rv-text);
  font-size: 22px;
  font-weight: 600;
}

.summary__hero {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 4px 0 6px;
}

.summary__distance {
  font-size: 64px;
  font-weight: 700;
  line-height: 0.95;
  letter-spacing: -0.05em;
}

.summary__distance-unit {
  color: var(--rv-text-muted);
  font-size: 20px;
  font-weight: 600;
}

.summary__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.stat {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: var(--rv-radius-md);
  background: rgb(255 255 255 / 5%);
}

.stat__label {
  color: var(--rv-text-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.stat__value {
  font-family: var(--rv-font-display);
  font-size: 17px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.stat__value small {
  white-space: nowrap;
  color: var(--rv-text-muted);
  font-family: var(--rv-font-ui);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
}
</style>
