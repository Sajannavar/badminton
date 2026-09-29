/* Player page service worker (ARCHITECTURE.md §124): makes the page
   installable and opens the shell even on a bad connection. Only this
   site's own files are cached — never the club's data (that comes from Google). */
var CACHE = 'mb-shell-b210ad9'; // set per deploy by portal-site.js, so phones pick up a new loader
var SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

// Network first (so updates arrive at once), cache as the fallback.
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(function(res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function(c) { c.put(e.request, copy); }); }
    return res;
  }).catch(function() {
    return caches.match(e.request, { ignoreSearch: true }).then(function(hit) { return hit || caches.match('./index.html'); });
  }));
});
