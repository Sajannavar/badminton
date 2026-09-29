/* Player page service worker (ARCHITECTURE.md §124): makes the page
   installable and opens the shell even on a bad connection. Only this
   site's own files are cached — never the club's data (that comes from Google). */
var CACHE = 'mb-shell-6e77c28'; // set per deploy by portal-site.js, so phones pick up a new loader
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

// Network first (so updates arrive at once), cache as the fallback. On a
// slow connection it doesn't wait for ever: after NET_WAIT_MS the cached copy
// opens the app, and the network answer still refreshes the cache (§131).
var NET_WAIT_MS = 4000;
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  var net = fetch(e.request).then(function(res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function(c) { return c.put(e.request, copy); }).catch(function() { /* quota */ }); }
    return res;
  });
  var cached = function() {
    return caches.match(e.request, { ignoreSearch: true }).then(function(hit) {
      return hit || (e.request.mode === 'navigate' ? caches.match('./index.html').then(function(i) { return i || caches.match('./'); }) : undefined);
    });
  };
  e.respondWith(new Promise(function(resolve, reject) {
    var done = false;
    var finish = function(r) { if (!done && r) { done = true; resolve(r); } };
    var timer = setTimeout(function() { cached().then(finish); }, NET_WAIT_MS);
    net.then(function(res) { clearTimeout(timer); finish(res); }, function() {
      clearTimeout(timer);
      cached().then(function(hit) { if (hit) finish(hit); else if (!done) { done = true; reject(new Error('offline')); } });
    });
  }));
});
