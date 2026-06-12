/*
 * Service worker: deja el juego jugable SIN internet después de la primera visita.
 * Estrategia:
 *  - Navegación (index.html): red primero (así llegan las versiones nuevas),
 *    caché si no hay conexión.
 *  - Resto (JS, modelos .glb, etc.): caché primero para que cargue al toque,
 *    refrescando en segundo plano (stale-while-revalidate) para no quedar viejo.
 */
const CACHE = 'city-builder-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function putInCache(req, res) {
  const cache = await caches.open(CACHE);
  await cache.put(req, res);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) putInCache(req, res.clone());
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) putInCache(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit ?? fresh;
    }),
  );
});
