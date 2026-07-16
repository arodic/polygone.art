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

const CACHE = 'polygone-blob-v6'
const BLOB_HOST = 'blob.polygone.art'

// Platform budgets: iOS/Safari is the stingiest (quota pressure + eviction); desktop
// can hold more of the archive for offline browsing. Tuned for thumbnail + model mixes.
const MB = 1024 * 1024
const BUDGET_IOS = 50 * MB
const BUDGET_ANDROID = 100 * MB
const BUDGET_DESKTOP = 100 * MB
const BUDGET_FALLBACK = 5000 * MB

function detectMaxCacheBytes() {
  const nav = self.navigator
  if (!nav) return BUDGET_FALLBACK

  // Prefer UA-CH when available (Chromium service workers).
  const uaData = nav.userAgentData
  if (uaData) {
    const platform = (uaData.platform || '').toLowerCase()
    if (platform === 'android') return BUDGET_ANDROID
    if (platform === 'ios') return BUDGET_IOS
    if (uaData.mobile) return BUDGET_ANDROID
    return BUDGET_DESKTOP
  }

  const ua = nav.userAgent || ''
  // iPhone / iPod, or iPad (including desktop-UA iPadOS).
  if (
    /iPhone|iPod/.test(ua) ||
    (/iPad/.test(ua) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints || 0) > 1))
  ) {
    return BUDGET_IOS
  }
  if (/Android/i.test(ua)) return BUDGET_ANDROID
  if (/Mobile/i.test(ua)) return BUDGET_ANDROID
  return BUDGET_DESKTOP
}

let maxCacheBytes = detectMaxCacheBytes()

// Optionally tighten the budget against the origin's actual storage quota.
async function refineBudgetFromStorage() {
  try {
    if (!navigator.storage?.estimate) return
    const { quota } = await navigator.storage.estimate()
    if (!quota || !Number.isFinite(quota)) return
    // Stay within ~25% of origin quota so we don't crowd out other origin data.
    maxCacheBytes = Math.min(maxCacheBytes, Math.floor(quota * 0.25))
  } catch {
    // estimate() can fail; keep the UA-derived budget.
  }
}

// Everything under /assets/ is immutable (thumbnails, data.json, posters, GLTF models).
// We intentionally do NOT cache /data/*.csv (those grow as the archive is updated) or
// /archives/*.zip (large explicit downloads).
function shouldCache(url) {
  return url.hostname === BLOB_HOST && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/data/'))
}

async function responseBytes(response) {
  const header = response.headers.get('content-length')
  if (header) {
    const n = parseInt(header, 10)
    if (Number.isFinite(n) && n >= 0) return n
  }
  try {
    const blob = await response.clone().blob()
    return blob.size
  } catch {
    return 0
  }
}

async function trim(cache) {
  const keys = await cache.keys()
  if (keys.length === 0) return

  const entries = []
  let total = 0
  for (const request of keys) {
    const response = await cache.match(request)
    const size = response ? await responseBytes(response) : 0
    entries.push({ request, size })
    total += size
  }

  // Cache Storage iteration order is insertion order; drop oldest first.
  let i = 0
  while (total > maxCacheBytes && i < entries.length) {
    await cache.delete(entries[i].request)
    total -= entries[i].size
    i++
  }
}

async function storeInCache(cache, request, response) {
  try {
    await cache.put(request, response)
    await trim(cache)
  } catch {
    // QuotaExceededError (common on mobile) must not break the fetch handler.
    // Drop oldest half, then retry once; if that still fails, skip caching.
    try {
      const keys = await cache.keys()
      const drop = Math.max(1, Math.floor(keys.length / 2))
      for (let i = 0; i < drop; i++) {
        await cache.delete(keys[i])
      }
      await cache.put(request, response)
      await trim(cache)
    } catch {
      // Serve the network response without storing it.
    }
  }
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await refineBudgetFromStorage()
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

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
    try {
      const cache = await caches.open(CACHE)

      const cached = await cache.match(request)
      if (cached) return cached // hit: no network, no 304

      // Miss: fetch once and store. The server sends `Access-Control-Allow-Origin: *`,
      // so we request in `cors` mode to store a readable (non-opaque) response, which
      // avoids the large storage-quota padding browsers apply to opaque responses.
      const response = await fetch(request.url, { mode: 'cors', credentials: 'omit' })
      if (response.ok) {
        event.waitUntil(storeInCache(cache, request, response.clone()))
      }
      return response
    } catch {
      // Offline and not cached: let the original request fail naturally.
      return fetch(request)
    }
  })())
})
