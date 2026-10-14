/* RunVision service worker: offline app shell + Web Share Target for GPX files. */
const VERSION = 'rv-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const SHARED_CACHE = 'rv-shared-files';
const SCOPE = new URL(self.registration.scope).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([SCOPE, `${SCOPE}manifest.webmanifest`, `${SCOPE}icons/app-icon.svg`]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('rv-v') && !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function handleShareTarget(request) {
  const formData = await request.formData();
  const file = formData.getAll('gpx').find((entry) => entry instanceof File);

  if (file) {
    const cache = await caches.open(SHARED_CACHE);
    await cache.put(
      'shared-file',
      new Response(file, { headers: { 'x-file-name': encodeURIComponent(file.name) } }),
    );
  }

  return Response.redirect(`${SCOPE}#/activity?shared=1`, 303);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === 'POST' && url.pathname === `${SCOPE}share-target`) {
    event.respondWith(handleShareTarget(request));
    return;
  }

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Navigations: network first so deploys show up immediately, cache as offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(SCOPE, copy));
          return response;
        })
        .catch(() => caches.match(SCOPE)),
    );
    return;
  }

  // Hashed build assets and fonts never change: cache first.
  if (url.pathname.startsWith(`${SCOPE}assets/`) || url.pathname.startsWith(`${SCOPE}samples/`)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
