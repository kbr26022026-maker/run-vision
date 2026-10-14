<script setup lang="ts">
import { computed } from 'vue';
import { ALL_STATS, type CardData } from '@/entities/card/card-data';
import type { CardSettings, StatKey } from '@/entities/card/card.types';

const props = defineProps<{
  settings: CardSettings;
  data: CardData;
  maxStats: number;
}>();

const emit = defineEmits<{
  'update:title': [value: string];
  'update:showDate': [value: boolean];
  'update:showBrand': [value: boolean];
  toggle: [key: StatKey];
  move: [key: StatKey, direction: -1 | 1];
}>();

const selected = computed(() => props.settings.stats);
const available = computed(() =>
  ALL_STATS.filter((key) => props.data.available[key] && !selected.value.includes(key)),
);
const isFull = computed(() => selected.value.length >= props.maxStats);
</script>

<template>
  <div class="panel">
    <label class="field">
      <span class="rv-eyebrow">Заголовок</span>
      <input
        class="field__input"
        type="text"
        maxlength="48"
        :value="settings.title"
        :placeholder="data.activityName"
        @input="emit('update:title', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <div class="toggles">
      <label class="toggle">
        <span>Дата</span>
        <v-switch
          :model-value="settings.showDate"
          color="primary"
          hide-details
          density="compact"
          inset
          @update:model-value="emit('update:showDate', Boolean($event))"
        />
      </label>
      <label class="toggle">
        <span>Логотип RunVision</span>
        <v-switch
          :model-value="settings.showBrand"
          color="primary"
          hide-details
          density="compact"
          inset
          @update:model-value="emit('update:showBrand', Boolean($event))"
        />
      </label>
    </div>

    <section class="stats">
      <div class="stats__header">
        <span class="rv-eyebrow">Показатели на карточке</span>
        <span class="stats__count rv-num">{{ selected.length }} / {{ maxStats }}</span>
      </div>

      <ol v-if="selected.length" class="stats__list">
        <li v-for="(key, index) in selected" :key="key" class="stat">
          <span class="stat__index rv-num">{{ index + 1 }}</span>
          <span class="stat__text">
            <strong>{{ data.stats[key].label }}</strong>
            <small class="rv-num">{{ data.stats[key].value }} {{ data.stats[key].unit }}</small>
          </span>
          <button
            type="button"
            class="rv-icon-btn stat__btn"
            :disabled="index === 0"
            aria-label="Выше"
            @click="emit('move', key, -1)"
          >
            <v-icon icon="mdi-chevron-up" size="20" />
          </button>
          <button
            type="button"
            class="rv-icon-btn stat__btn"
            :disabled="index === selected.length - 1"
            aria-label="Ниже"
            @click="emit('move', key, 1)"
          >
            <v-icon icon="mdi-chevron-down" size="20" />
          </button>
          <button
            type="button"
            class="rv-icon-btn stat__btn"
            aria-label="Убрать"
            @click="emit('toggle', key)"
          >
            <v-icon icon="mdi-close" size="18" />
          </button>
        </li>
      </ol>

      <div v-if="available.length" class="stats__available">
        <button
          v-for="key in available"
          :key="key"
          type="button"
          class="rv-chip"
          :disabled="isFull"
          @click="emit('toggle', key)"
        >
          <v-icon icon="mdi-plus" size="16" />
          {{ data.stats[key].label }}
        </button>
      </div>
      <p v-if="isFull" class="stats__hint">
        Максимум {{ maxStats }} показателей — уберите один, чтобы добавить другой
      </p>
    </section>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field__input {
  height: 46px;
  padding: 0 14px;
  border: 1px solid var(--rv-border-strong);
  border-radius: 14px;
  outline: none;
  background: rgb(255 255 255 / 4%);
  color: var(--rv-text);
  font: inherit;
  font-size: 15px;
  transition: border-color 0.15s ease;
}

.field__input:focus {
  border-color: var(--rv-accent);
}

.field__input::placeholder {
  color: var(--rv-text-faint);
}

.toggles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 14px;
  border-radius: 14px;
  background: rgb(255 255 255 / 4%);
}

.toggle {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.toggle :deep(.v-switch) {
  flex: 0 0 auto;
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stats__header {
  display: flex;
  justify-content: space-between;
}

.stats__count {
  color: var(--rv-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.stats__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stat {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 6px 6px 12px;
  border-radius: 14px;
  background: rgb(255 255 255 / 5%);
}

.stat__index {
  width: 20px;
  color: var(--rv-accent);
  font-size: 13px;
  font-weight: 700;
}

.stat__text {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.stat__text strong {
  font-size: 14px;
}

.stat__text small {
  color: var(--rv-text-muted);
  font-size: 12px;
}

.stat__btn {
  width: 34px;
  height: 34px;
  color: var(--rv-text-muted);
}

.stat__btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.stats__available {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stats__available .rv-chip:disabled {
  opacity: 0.4;
  cursor: default;
}

.stats__hint {
  margin: 0;
  color: var(--rv-text-muted);
  font-size: 12px;
}
</style>
