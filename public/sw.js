/*
 * Service worker: deja el juego jugable SIN internet después de la primera visita.
 * Estrategia:
 *  - Navegación (index.html): red primero (así llegan las versiones nuevas),
 *    caché si no hay conexión (y como último recurso, el index precacheado).
 *  - Resto (JS, modelos .glb, etc.): caché primero para que cargue al toque,
 *    refrescando en segundo plano (stale-while-revalidate) para no quedar viejo.
 */
const CACHE = 'city-builder-v2'; // subir este número en cada release invalida la caché vieja
const SHELL = ['./', './index.html'];

self.addEventListener('install', (e) => {
  // Precachea la cáscara para tener siempre un fallback de navegación offline.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Borra las cachés de versiones anteriores (evita servir assets viejos y que crezca sin fin).
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

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
        // Sin conexión: la respuesta cacheada de esta URL, o la cáscara precacheada.
        .catch(async () => (await caches.match(req)) || (await caches.match('./index.html')) || (await caches.match('./'))),
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
