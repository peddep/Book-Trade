// Push notifications only. This service worker does not cache anything or
// intercept fetches — the site is not an offline-first app, and a caching
// service worker that goes stale is a much worse bug than not having one.

self.addEventListener('push', (event) => {
  let data = { title: 'เล่มแลกเล่ม', body: '', url: '/trade' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch { /* non-JSON payload; use the defaults */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url },
    })
  );
});

// Focus an already-open tab on this site rather than piling up new ones.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/trade';
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientsList) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
