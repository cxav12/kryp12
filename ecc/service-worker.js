'use strict';

const CACHE_PREFIX = 'ecc-offline-';
const CACHE_NAME = CACHE_PREFIX + (new URL(self.location.href).searchParams.get('v') || '1');
const BASE = new URL('./', self.location.href);

// Canonicalize PHP aliases and form parameters without merging different views.
function cacheKey(input) {
  const url = new URL(input, BASE);
  if (url.pathname === '/ecc/index.php') url.pathname = '/ecc/';
  if (url.pathname === '/ecc/') {
    let view = url.searchParams.get('view') || 'library';
    if (view === 'home') view = 'library';
    if (view === 'quiz') view = 'cards';
    const topic = url.searchParams.get('topic') || '';
    const params = new URLSearchParams({ view });
    if (topic) params.set('topic', topic);
    if (view === 'topic' && topic === 'fire-stations') {
      params.set('group', url.searchParams.get('group') === 'battalion' ? 'battalion' : 'station');
      // The HTML form submits both a hidden zero and a checked one; PHP uses the last value.
      const compact = url.searchParams.getAll('compact').pop();
      params.set('compact', compact === '0' ? '0' : '1');
    }
    if (view === 'topic' && topic === 'highway-exits' && url.searchParams.get('compact') === '1') {
      params.set('compact', '1');
    }
    url.search = params.toString();
  }
  return url.href;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(new URL('offline-resources.php', BASE), { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load ECC offline resources');
    const resources = await response.json();
    const cache = await caches.open(CACHE_NAME);
    // Keep installation atomic: an incomplete download must not replace a working version.
    try {
      for (const resource of resources) {
        const url = new URL(resource, BASE);
        const page = await fetch(url, { cache: 'reload' });
        if (!page.ok) throw new Error(`Could not cache ${url.pathname}${url.search}`);
        await cache.put(cacheKey(url.href), page);
      }
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  if (url.pathname !== BASE.pathname && url.pathname !== '/ecc/index.php' &&
      !url.pathname.startsWith('/ecc/assets/') && url.pathname !== '/ecc/manifest.json') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const saved = await cache.match(cacheKey(url.href));
    // Serve a consistent downloaded snapshot; a new worker refreshes it when site files change.
    return saved || fetch(event.request);
  })());
});
