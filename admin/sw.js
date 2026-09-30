/* The club admin phone app was removed (ARCHITECTURE.md §140). This stub
   replaces its service worker on phones that installed it: it clears the
   app's saved files and sign-in, unregisters itself, and sends any open
   window to the player page. */
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k.indexOf('mb-admin') === 0; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.registration.unregister(); }).then(function() {
    return self.clients.matchAll({ type: 'window' });
  }).then(function(list) {
    list.forEach(function(c) { try { c.navigate(new URL('../', self.registration.scope).href); } catch (x) { /* */ } });
  }));
});
