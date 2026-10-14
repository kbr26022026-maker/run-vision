<script setup lang="ts">
import { computed } from 'vue';
import type { ActivitySplit } from '@/entities/activity/model/activity-analysis';
import { formatHeartRate, formatPace } from '@/shared/lib/formatters/formatters';

const props = defineProps<{
  splits: ActivitySplit[];
}>();

const rows = computed(() => {
  const full = props.splits.filter((split) => !split.isPartial);
  const paces = (full.length ? full : props.splits).map((split) => split.paceSecondsPerKm);
  const fastest = Math.min(...paces);
  const slowest = Math.max(...paces);
  const span = slowest - fastest || 1;

  return props.splits.map((split) => ({
    ...split,
    label: split.isPartial ? (split.distanceMeters / 1000).toFixed(2) : `${split.index + 1}`,
    // Bars grow with speed, keeping a visible minimum for the slowest split.
    width: 38 + (1 - Math.min(1, Math.max(0, (split.paceSecondsPerKm - fastest) / span))) * 62,
    isFastest: !split.isPartial && split.paceSecondsPerKm === fastest,
  }));
});

const hasHeartRate = computed(() => props.splits.some((split) => split.averageHeartRate !== null));
</script>

<template>
  <section v-if="rows.length" class="splits">
    <div class="splits__header">
      <h3 class="rv-eyebrow">Сплиты</h3>
      <span class="splits__legend rv-eyebrow">темп{{ hasHeartRate ? ' · пульс' : '' }}</span>
    </div>

    <ol class="splits__list rv-num">
      <li
        v-for="row in rows"
        :key="row.index"
        class="split"
        :class="{ 'split--fastest': row.isFastest }"
      >
        <span class="split__km">{{ row.label }}</span>
        <span class="split__bar-track">
          <span class="split__bar" :style="{ width: `${row.width}%` }">
            <span class="split__pace">{{ formatPace(row.paceSecondsPerKm) }}</span>
          </span>
        </span>
        <span v-if="hasHeartRate" class="split__hr">{{
          formatHeartRate(row.averageHeartRate)
        }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.splits {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.splits__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.splits__header h3 {
  margin: 0;
}

.splits__legend {
  color: var(--rv-text-faint);
}

.splits__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.split {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.split__km {
  color: var(--rv-text-muted);
  font-weight: 600;
}

.split__bar-track {
  display: block;
  height: 26px;
}

.split__bar {
  display: flex;
  height: 100%;
  align-items: center;
  padding: 0 10px;
  border-radius: 8px;
  background: rgb(255 255 255 / 10%);
  transition: width 0.4s var(--rv-ease-out);
}

.split--fastest .split__bar {
  background: var(--rv-accent);
  color: var(--rv-on-accent);
}

.split__pace {
  font-weight: 650;
}

.split__hr {
  color: var(--rv-text-muted);
  text-align: right;
}
</style>
