import { defineStore } from 'pinia';
import { computed, markRaw, ref, shallowRef } from 'vue';

import type { IActivity } from '@/entities/activity/model/activity.types';
import { analyzeActivity } from '@/entities/activity/model/activity-analysis';
import { GpxImportError, isGpxFile, parseGpxText } from '@/entities/activity/parser/gpx.parser';
import {
  forgetLastActivity,
  loadGpx,
  loadLastActivityId,
  loadRecents,
  removeActivity,
  saveActivity,
  touchActivity,
  type StoredActivityMeta,
} from '@/entities/activity/lib/activity-storage';

export const SAMPLE_GPX_URL = `${import.meta.env.BASE_URL}samples/morning-run.gpx`;

export const useActivityStore = defineStore('activity', () => {
  // Tracks hold tens of thousands of points: keep them out of Vue's deep reactivity.
  const activity = shallowRef<IActivity | null>(null);
  const recents = ref<StoredActivityMeta[]>([]);
  const isImporting = ref(false);
  const isRestoring = ref(true);

  const analysis = computed(() =>
    activity.value ? markRaw(analyzeActivity(activity.value)) : null,
  );

  function setActivity(value: IActivity) {
    activity.value = markRaw(value);
  }

  function clearActivity() {
    activity.value = null;
    void forgetLastActivity();
  }

  async function importText(gpx: string, fileName: string): Promise<IActivity> {
    const parsed = parseGpxText(gpx);
    setActivity(parsed);

    recents.value = await saveActivity(
      {
        id: parsed.id,
        name: parsed.name,
        fileName,
        startedAt: parsed.startedAt.toISOString(),
        distanceMeters: analysis.value?.summary.distanceMeters ?? parsed.distanceMeters,
        durationSeconds: analysis.value?.summary.movingSeconds ?? parsed.durationSeconds,
        openedAt: new Date().toISOString(),
      },
      gpx,
    );

    return parsed;
  }

  async function importFile(file: File): Promise<IActivity> {
    if (!isGpxFile(file)) {
      throw new GpxImportError(`«${file.name}» — не GPX-файл. Нужен файл с расширением .gpx`);
    }

    isImporting.value = true;

    try {
      return await importText(await file.text(), file.name);
    } finally {
      isImporting.value = false;
    }
  }

  async function importSample(): Promise<IActivity> {
    isImporting.value = true;

    try {
      const response = await fetch(SAMPLE_GPX_URL);

      if (!response.ok) {
        throw new GpxImportError('Не удалось загрузить пример тренировки');
      }

      return await importText(await response.text(), 'morning-run.gpx');
    } finally {
      isImporting.value = false;
    }
  }

  async function openRecent(id: string): Promise<boolean> {
    if (activity.value?.id === id) {
      return true;
    }

    const gpx = await loadGpx(id);

    if (!gpx) {
      recents.value = await removeActivity(id);
      return false;
    }

    const parsed = parseGpxText(gpx);
    const meta = recents.value.find((item) => item.id === id);

    setActivity(meta ? { ...parsed, name: meta.name } : parsed);
    recents.value = await touchActivity(id);

    return true;
  }

  async function deleteRecent(id: string) {
    recents.value = await removeActivity(id);

    if (activity.value?.id === id) {
      activity.value = null;
    }
  }

  async function rename(name: string) {
    const current = activity.value;
    const trimmed = name.trim();

    if (!current || !trimmed || trimmed === current.name) {
      return;
    }

    setActivity({ ...current, name: trimmed });
    recents.value = await touchActivity(current.id, { name: trimmed });
  }

  async function restore() {
    isRestoring.value = true;

    try {
      recents.value = await loadRecents();
      const lastId = await loadLastActivityId();

      if (lastId && !activity.value) {
        await openRecent(lastId).catch(() => false);
      }
    } finally {
      isRestoring.value = false;
    }
  }

  return {
    activity,
    analysis,
    recents,
    isImporting,
    isRestoring,
    setActivity,
    clearActivity,
    importFile,
    importSample,
    openRecent,
    deleteRecent,
    rename,
    restore,
  };
});
