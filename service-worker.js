/*
 * Cache-first service worker for polygone.art
 *
 * Why: blob.polygone.art serves every asset with `Cache-Control: public, max-age=0`,
 * so the browser revalidates on every use and gets a `304 Not Modified` back. With
 * hundreds of thumbnails in the gallery that's hundreds of network round-trips.
 *
 * These are archived, immutable assets (poly.google.com shut down in 2021), so we
 * serve them cache-first: once a file is in Cache Storage we return it with NO network
 * request at all. This also makes the gallery work offline.
 */

const CACHE = 'polygone-blob-v1'
const BLOB_HOST = 'blob.polygone.art'
// Generous cap so the cache can't grow without bound if someone scrolls the whole
// archive at every thumbnail size. Oldest entries (insertion order) are trimmed first.
const MAX_ENTRIES = 4000

// Everything under /assets/ is immutable (thumbnails, data.json, posters, GLTF models).
// We intentionally do NOT cache /data/*.csv (those grow as the archive is updated) or
// /archives/*.zip (large explicit downloads).
function shouldCache(url) {
  return url.hostname === BLOB_HOST && url.pathname.startsWith('/assets/')
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

async function trim(cache) {
  const keys = await cache.keys()
  if (keys.length <= MAX_ENTRIES) return
  const excess = keys.length - MAX_ENTRIES
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i])
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (!shouldCache(url)) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)

    const cached = await cache.match(url.href)
    if (cached) return cached // hit: no network, no 304

    // Miss: fetch once and store. The server sends `Access-Control-Allow-Origin: *`,
    // so we request in `cors` mode to store a readable (non-opaque) response, which
    // avoids the large storage-quota padding browsers apply to opaque responses.
    try {
      const response = await fetch(url.href, { mode: 'cors', credentials: 'omit' })
      if (response.ok) {
        await cache.put(url.href, response.clone())
        event.waitUntil(trim(cache))
      }
      return response
    } catch {
      // Offline and not cached: let the original request fail naturally.
      return fetch(request)
    }
  })())
})
