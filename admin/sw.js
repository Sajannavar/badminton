/* Club admin app service worker (ARCHITECTURE.md §140). Its own scope
   (admin/), so its alerts are separate from the player page's on the same
   phone. Caches only this page's own files; never club data. */
var CACHE = 'mb-admin-4984039';
var AUTH_CACHE = 'mb-admin-auth';
var AUTH_KEY = './__mb_admin_auth';
var SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});
self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k.indexOf('mb-admin-') === 0 && k !== CACHE && k !== AUTH_CACHE; }).map(function(k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.indexOf(new URL(self.registration.scope).pathname) !== 0) return;
  e.respondWith(fetch(e.request).then(function(res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function(c) { return c.put(e.request, copy); }).catch(function() { /* */ }); }
    return res;
  }).catch(function() {
    return caches.match(e.request, { ignoreSearch: true }).then(function(hit) { return hit || caches.match('./index.html'); });
  }));
});

self.addEventListener('message', function(e) {
  var m = e.data || {};
  if (m.type === 'auth' && /^[A-Za-z0-9]{40,128}$/.test(String(m.key || '')) && /^https:\/\//.test(String(m.api || ''))) {
    e.waitUntil(caches.open(AUTH_CACHE).then(function(c) { return c.put(AUTH_KEY, new Response(JSON.stringify({ api: m.api, key: m.key }))); }));
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
      body: JSON.stringify({ fn: 'adminLatest', args: [a.key] }) })
      .then(function(r) { return r.json(); }).then(function(j) { return j && j.result; }).catch(function() { return null; });
  }).then(function(res) {
    var u = res && res.success && res.update;
    return self.registration.showNotification(u ? u.title : '⚙ Club admin', { body: u ? u.message : 'Something new is waiting.',
      icon: '../icon-192.png', badge: '../icon-192.png', tag: u ? u.id : 'mb-admin', data: { url: './' } });
  }));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
    for (var i = 0; i < list.length; i++) { if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) { list[i].postMessage({ type: 'refresh' }); return list[i].focus(); } }
    return self.clients.openWindow(self.registration.scope);
  }));
});
