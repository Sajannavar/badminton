/* Player page service worker (ARCHITECTURE.md §124): makes the page
   installable and opens the shell even on a bad connection. Only this
   site's own files are cached — never the club's data (that comes from Google). */
var CACHE = 'mb-shell-15508d0'; // set per deploy by portal-site.js, so phones pick up a new loader
var SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE && k !== AUTH_CACHE; }).map(function(k) { return caches.delete(k); }));
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

// ── Phone notifications (§133) ──────────────────────────
// The club's app sends an empty "tap"; we ask the player page for the newest
// update (with the link and 30-day key the page gave us) and show it.
var AUTH_KEY = './__mb_auth';
var AUTH_CACHE = 'mb-auth';          // kept across deploys (the shell cache is replaced each build)
self.addEventListener('message', function(e) {
  var m = e.data || {};
  if (m.type === 'auth' && /^[A-Za-z0-9]{24,128}$/.test(String(m.token || '')) && /^https:\/\//.test(String(m.api || ''))) {
    e.waitUntil(caches.open(AUTH_CACHE).then(function(c) { return c.put(AUTH_KEY, new Response(JSON.stringify({ api: m.api, token: m.token, key: String(m.key || '') }))); }));
  } else if (m.type === 'forget') {
    e.waitUntil(caches.delete(AUTH_CACHE));
  }
});

function readAuth() {
  return caches.open(AUTH_CACHE).then(function(c) { return c.match(AUTH_KEY); }).then(function(r) { return r ? r.json() : null; }).catch(function() { return null; });
}

self.addEventListener('push', function(e) {
  e.waitUntil(readAuth().then(function(a) {
    if (!a) return null;
    return fetch(a.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', credentials: 'omit',
      body: JSON.stringify({ fn: 'latestUpdate', args: [a.token, { key: a.key }] }) })
      .then(function(r) { return r.json(); }).then(function(j) { return { a: a, res: j && j.result }; }).catch(function() { return { a: a, res: null }; });
  }).then(function(x) {
    var u = x && x.res && x.res.success && x.res.update;
    var title = u ? u.title : '🏸 News from your club';
    var body = u ? u.message : 'Tap to see what’s new.';
    return self.registration.showNotification(title, { body: body, icon: 'icon-192.png', badge: 'icon-192.png', tag: u ? u.id : 'mb-update',
      data: { url: './' + (x && x.a ? '#t=' + x.a.token : '') } });
  }));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || './', self.location.href).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
    for (var i = 0; i < list.length; i++) { if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) { list[i].postMessage({ type: 'refresh' }); return list[i].focus(); } }
    return self.clients.openWindow(url);
  }));
});
