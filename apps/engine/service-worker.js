const CACHE = 'the-engine-v1';
const ASSETS = ['./', './index.html', './engine-config.js', './app.js', './home.css', './logger.css', './library.css', './session.js', './engine.js', './library.js', './library-ui.js', './logger.js', './timer.js', './brain-bundle.js', './adaptive-bundle.js', './native-bridge.js', './connectors/whoop.js', './vendor/supabase.min.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => cached))
  );
});
