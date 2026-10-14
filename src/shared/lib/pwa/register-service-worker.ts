const SHARED_CACHE = 'rv-shared-files';

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((error) => console.warn('[RunVision] Service worker не зарегистрирован:', error));
  });
}

type LaunchParams = { files: FileSystemFileHandle[] };
type LaunchQueue = { setConsumer: (consumer: (params: LaunchParams) => void) => void };

/** GPX opened via the OS "Open with RunVision" (installed PWA, File Handling API). */
export function consumeLaunchedFiles(onFile: (file: File) => void) {
  const launchQueue = (window as unknown as { launchQueue?: LaunchQueue }).launchQueue;

  launchQueue?.setConsumer(async (params) => {
    const handle = params.files[0];

    if (handle) {
      onFile(await handle.getFile());
    }
  });
}

/** GPX shared to the installed PWA from another app (Web Share Target, stored by sw.js). */
export async function consumeSharedFile(): Promise<File | null> {
  const query = window.location.hash.split('?')[1] ?? window.location.search.slice(1);

  if (!new URLSearchParams(query).has('shared') || !('caches' in window)) {
    return null;
  }

  try {
    const cache = await caches.open(SHARED_CACHE);
    const response = await cache.match('shared-file');

    if (!response) {
      return null;
    }

    await cache.delete('shared-file');
    const name = decodeURIComponent(response.headers.get('x-file-name') ?? 'shared.gpx');
    return new File([await response.blob()], name, { type: 'application/gpx+xml' });
  } catch {
    return null;
  }
}
