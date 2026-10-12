/*
 * MedLink service worker: keeps the app shell available during power / network outages.
 * - Page navigations: network first, fall back to the cached shell (index.html).
 * - Built assets (/assets/*, fonts, icons): cache first.
 * - API calls are never cached here: offline sales are queued by the app itself (stores/offline.js)
 *   so patient data is not left in a shared HTTP cache.
 */
const VERSION = 'medlink-v1'
const SHELL = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(VERSION).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  const cacheable = url.origin === self.location.origin
    ? /^\/(assets|images|logo)\//.test(url.pathname) || /\.(svg|ico|png|webp|woff2?)$/.test(url.pathname)
    : /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)

  if (cacheable) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((response) => {
        if (response.ok || response.type === 'opaque') {
          const copy = response.clone()
          caches.open(VERSION).then((cache) => cache.put(request, copy))
        }
        return response
      })),
    )
  }
})
