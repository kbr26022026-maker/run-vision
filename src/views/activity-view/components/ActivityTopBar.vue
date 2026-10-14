<script setup lang="ts">
import BrandMark from '@/shared/ui/BrandMark.vue';
import RecentsMenu from './RecentsMenu.vue';
import type { StoredActivityMeta } from '@/entities/activity/lib/activity-storage';

defineProps<{
  recents: StoredActivityMeta[];
  activeId: string | null;
  isImporting: boolean;
}>();

const emit = defineEmits<{
  import: [];
  open: [id: string];
  remove: [id: string];
  create: [];
}>();
</script>

<template>
  <header class="topbar">
    <div class="topbar__group rv-glass">
      <BrandMark class="topbar__brand" />

      <v-menu location="bottom start" offset="10">
        <template #activator="{ props: menuProps }">
          <button
            type="button"
            class="topbar__recents"
            v-bind="menuProps"
            aria-label="Мои тренировки"
          >
            <v-icon icon="mdi-history" size="18" />
            <span class="topbar__label">Тренировки</span>
            <v-icon icon="mdi-chevron-down" size="16" class="topbar__chevron" />
          </button>
        </template>
        <RecentsMenu
          :recents="recents"
          :active-id="activeId"
          @open="emit('open', $event)"
          @remove="emit('remove', $event)"
          @import="emit('import')"
        />
      </v-menu>
    </div>

    <div class="topbar__actions">
      <button
        type="button"
        class="rv-btn rv-btn--secondary topbar__import rv-glass"
        :disabled="isImporting"
        @click="emit('import')"
      >
        <v-progress-circular v-if="isImporting" indeterminate size="16" width="2" />
        <v-icon v-else icon="mdi-tray-arrow-up" size="18" />
        <span class="topbar__label">Открыть GPX</span>
      </button>

      <button type="button" class="rv-btn rv-btn--primary topbar__create" @click="emit('create')">
        <v-icon icon="mdi-creation" size="18" />
        <span>Создать пост</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: absolute;
  z-index: 15;
  top: calc(12px + var(--rv-safe-top));
  right: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  pointer-events: none;
}

.topbar > * {
  pointer-events: auto;
}

.topbar__group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 4px 4px 10px;
  border-radius: 16px;
}

.topbar__brand {
  margin-right: 6px;
}

.topbar__recents {
  display: inline-flex;
  height: 38px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 0;
  border-radius: 12px;
  background: rgb(255 255 255 / 7%);
  color: var(--rv-text);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.topbar__recents:hover {
  background: rgb(255 255 255 / 12%);
}

.topbar__chevron {
  color: var(--rv-text-muted);
}

.topbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar__import {
  background: var(--rv-glass);
}

.topbar__create {
  box-shadow: 0 8px 24px rgb(212 255 63 / 22%);
}

@media (max-width: 720px) {
  .topbar {
    top: calc(10px + var(--rv-safe-top));
    right: 10px;
    left: 10px;
  }

  .topbar__label,
  .topbar__chevron {
    display: none;
  }

  .topbar__recents {
    width: 38px;
    justify-content: center;
    padding: 0;
  }

  .topbar__import {
    width: 44px;
    padding: 0;
  }

  .topbar__create {
    padding: 0 14px;
  }
}

@media (max-width: 380px) {
  .topbar__brand :deep(.brand__name) {
    display: none;
  }
}
</style>
