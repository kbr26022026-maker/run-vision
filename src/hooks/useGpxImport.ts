import { useRouter } from 'vue-router';
import { useActivityStore } from '@/stores/activity.store';
import { useUiStore } from '@/stores/ui.store';
import { GpxImportError } from '@/entities/activity/parser/gpx.parser';
import { pickFile } from '@/shared/lib/files/pick-file';

export function useGpxImport() {
  const activityStore = useActivityStore();
  const ui = useUiStore();
  const router = useRouter();

  function reportError(error: unknown) {
    const message =
      error instanceof GpxImportError
        ? error.message
        : 'Не удалось открыть файл. Попробуйте другой GPX';
    ui.notify(message, 'error');

    if (!(error instanceof GpxImportError)) {
      console.error(error);
    }
  }

  async function afterImport() {
    if (router.currentRoute.value.path !== '/activity') {
      await router.push('/activity');
    }
  }

  async function importFile(file: File) {
    try {
      const activity = await activityStore.importFile(file);
      ui.notify(`Открыта тренировка «${activity.name}»`, 'success');
      await afterImport();
    } catch (error) {
      reportError(error);
    }
  }

  async function openFilePicker() {
    const file = await pickFile({ accept: '.gpx,application/gpx+xml' });

    if (file) {
      await importFile(file);
    }
  }

  async function importSample() {
    try {
      await activityStore.importSample();
      await afterImport();
    } catch (error) {
      reportError(error);
    }
  }

  async function openRecent(id: string) {
    try {
      const found = await activityStore.openRecent(id);

      if (!found) {
        ui.notify('Файл этой тренировки больше недоступен', 'error');
        return;
      }

      await afterImport();
    } catch (error) {
      reportError(error);
    }
  }

  return { importFile, openFilePicker, importSample, openRecent };
}
