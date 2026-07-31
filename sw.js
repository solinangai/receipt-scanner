/* Receipt Scanner — service worker: offline app shell + Android share target. */
const VERSION = 'rs-v5';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION && k !== 'rs-share').map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Share target (Android): stash the shared files, then hand control back to the app.
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const files = form.getAll('files').filter(Boolean);
        if (files.length) {
          const body = new FormData();
          files.forEach((f) => body.append('files', f, f.name));
          const cache = await caches.open('rs-share');
          await cache.put('pending', new Response(body));
        }
      } catch (err) { /* fall through — the app just opens normally */ }
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }

  // Never intercept the API (POST) — only same-origin GETs for the shell.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
