import { del, get, set } from 'idb-keyval';

export type StoredActivityMeta = {
  id: string;
  name: string;
  fileName: string;
  startedAt: string;
  distanceMeters: number;
  durationSeconds: number;
  openedAt: string;
};

const RECENTS_KEY = 'rv:recents';
const LAST_KEY = 'rv:last';
const MAX_RECENTS = 12;

const gpxKey = (id: string) => `rv:gpx:${id}`;

/** IndexedDB can be unavailable (private mode, blocked storage); the app must keep working. */
async function safe<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.warn('[RunVision] Хранилище недоступно:', error);
    return fallback;
  }
}

export function loadRecents(): Promise<StoredActivityMeta[]> {
  return safe(async () => (await get<StoredActivityMeta[]>(RECENTS_KEY)) ?? [], []);
}

export function loadLastActivityId(): Promise<string | null> {
  return safe(async () => (await get<string>(LAST_KEY)) ?? null, null);
}

export function loadGpx(id: string): Promise<string | null> {
  return safe(async () => (await get<string>(gpxKey(id))) ?? null, null);
}

export async function saveActivity(
  meta: StoredActivityMeta,
  gpx: string,
): Promise<StoredActivityMeta[]> {
  return safe(async () => {
    const recents = (await get<StoredActivityMeta[]>(RECENTS_KEY)) ?? [];
    const next = [meta, ...recents.filter((item) => item.id !== meta.id)];
    const removed = next.splice(MAX_RECENTS);

    await set(gpxKey(meta.id), gpx);
    await set(RECENTS_KEY, next);
    await set(LAST_KEY, meta.id);
    await Promise.all(removed.map((item) => del(gpxKey(item.id))));

    return next;
  }, [meta]);
}

export async function touchActivity(id: string, patch: Partial<StoredActivityMeta> = {}) {
  return safe(async () => {
    const recents = (await get<StoredActivityMeta[]>(RECENTS_KEY)) ?? [];
    const current = recents.find((item) => item.id === id);

    if (!current) {
      return recents;
    }

    const updated = { ...current, ...patch, openedAt: new Date().toISOString() };
    const next = [updated, ...recents.filter((item) => item.id !== id)];

    await set(RECENTS_KEY, next);
    await set(LAST_KEY, id);

    return next;
  }, [] as StoredActivityMeta[]);
}

export async function removeActivity(id: string): Promise<StoredActivityMeta[]> {
  return safe(async () => {
    const recents = (await get<StoredActivityMeta[]>(RECENTS_KEY)) ?? [];
    const next = recents.filter((item) => item.id !== id);

    await set(RECENTS_KEY, next);
    await del(gpxKey(id));

    if ((await get<string>(LAST_KEY)) === id) {
      await del(LAST_KEY);
    }

    return next;
  }, []);
}

export async function forgetLastActivity() {
  await safe(() => del(LAST_KEY), undefined);
}
