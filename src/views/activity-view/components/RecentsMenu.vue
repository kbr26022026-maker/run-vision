<script setup lang="ts">
import type { StoredActivityMeta } from '@/entities/activity/lib/activity-storage';
import { formatClock, formatDistanceKm, formatShortDate } from '@/shared/lib/formatters/formatters';

defineProps<{
  recents: StoredActivityMeta[];
  activeId?: string | null;
}>();

const emit = defineEmits<{
  open: [id: string];
  remove: [id: string];
  import: [];
}>();
</script>

<template>
  <div class="recents rv-glass">
    <div class="recents__title rv-eyebrow">Мои тренировки</div>

    <ul v-if="recents.length" class="recents__list">
      <li v-for="item in recents" :key="item.id">
        <button
          type="button"
          class="recent"
          :class="{ 'recent--active': item.id === activeId }"
          @click="emit('open', item.id)"
        >
          <span class="recent__icon"><v-icon icon="mdi-run" size="18" /></span>
          <span class="recent__text">
            <span class="recent__name">{{ item.name }}</span>
            <span class="recent__meta rv-num">
              {{ formatShortDate(new Date(item.startedAt)) }} ·
              {{ formatDistanceKm(item.distanceMeters) }} км ·
              {{ formatClock(item.durationSeconds) }}
            </span>
          </span>
          <span
            class="recent__remove"
            role="button"
            tabindex="0"
            :aria-label="`Удалить «${item.name}» из списка`"
            @click.stop="emit('remove', item.id)"
            @keydown.enter.stop="emit('remove', item.id)"
          >
            <v-icon icon="mdi-close" size="16" />
          </span>
        </button>
      </li>
    </ul>

    <p v-else class="recents__empty">Здесь появятся открытые тренировки</p>

    <button
      type="button"
      class="rv-btn rv-btn--secondary rv-btn--small rv-btn--block"
      @click="emit('import')"
    >
      <v-icon icon="mdi-tray-arrow-up" size="18" />
      Открыть GPX
    </button>
  </div>
</template>

<style scoped>
.recents {
  display: flex;
  width: 320px;
  max-width: calc(100vw - 24px);
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: var(--rv-radius-lg);
}

.recents__title {
  padding: 6px 8px 2px;
}

.recents__list {
  display: flex;
  max-height: 360px;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.recent {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--rv-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.recent:hover {
  background: rgb(255 255 255 / 7%);
}

.recent--active {
  background: var(--rv-accent-soft);
}

.recent__icon {
  display: grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  background: rgb(255 255 255 / 8%);
}

.recent--active .recent__icon {
  background: var(--rv-accent);
  color: var(--rv-on-accent);
}

.recent__text {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
}

.recent__name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent__meta {
  color: var(--rv-text-muted);
  font-size: 12px;
}

.recent__remove {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 8px;
  color: var(--rv-text-faint);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.recent:hover .recent__remove,
.recent__remove:focus-visible {
  opacity: 1;
}

.recent__remove:hover {
  background: rgb(255 255 255 / 10%);
  color: var(--rv-text);
}

@media (hover: none) {
  .recent__remove {
    opacity: 1;
  }
}

.recents__empty {
  margin: 0;
  padding: 8px;
  color: var(--rv-text-muted);
  font-size: 13px;
}
</style>
