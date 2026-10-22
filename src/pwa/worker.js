/* BUILD_ID y STATIC_FILES se generan a partir de los archivos públicos del build. */
const PREFIX = 'lf-public-';
const CACHE = PREFIX + BUILD_ID;
const allowed = new Set(STATIC_FILES.map(path => new URL(path, self.location.origin).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC_FILES.map(path => new Request(new URL(path, self.location.origin), { credentials: 'omit', cache: 'reload' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  // Auth, SQL, funciones, POST y cualquier origen ajeno pasan directamente a la red.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(new Request(request, { cache: 'no-store' })).catch(async () => {
      const cache = await caches.open(CACHE);
      return await cache.match('/offline.html') || new Response('Conéctate a Internet para abrir tu hogar.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }));
    return;
  }
  if (!allowed.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(request) || fetch(new Request(request, { credentials: 'omit' }));
  })());
});
