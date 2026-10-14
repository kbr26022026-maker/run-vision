import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastTone = 'info' | 'success' | 'error';

export type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

export const useUiStore = defineStore('ui', () => {
  const toast = ref<Toast | null>(null);
  let counter = 0;

  function notify(message: string, tone: ToastTone = 'info') {
    counter += 1;
    toast.value = { id: counter, message, tone };
  }

  function dismiss() {
    toast.value = null;
  }

  return { toast, notify, dismiss };
});
