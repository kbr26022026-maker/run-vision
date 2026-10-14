import { ref, watch, type Ref } from 'vue';

/** A ref mirrored to localStorage. Storage failures (private mode, quota) are ignored. */
export function usePersistentRef<T>(
  key: string,
  initial: T,
  validate?: (value: unknown) => value is T,
): Ref<T> {
  let start = initial;

  try {
    const raw = localStorage.getItem(key);

    if (raw !== null) {
      const parsed = JSON.parse(raw) as unknown;

      if (!validate || validate(parsed)) {
        start = parsed as T;
      }
    }
  } catch {
    // ignore
  }

  const state = ref(start) as Ref<T>;

  watch(
    state,
    (value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // ignore
      }
    },
    { deep: true },
  );

  return state;
}

export function oneOf<T extends string | number>(values: readonly T[]) {
  return (value: unknown): value is T => values.includes(value as T);
}
