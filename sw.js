// 조이코너 노트 — 앱 화면 파일만 기기에 보관 (아이 정보는 Firestore가 따로 지켜요)
// 앱 파일(app.js, app.css, index.html)은 언제나 새 것을 먼저 받고, 안 될 때만 보관본을 써요.
// 아이콘 · 글꼴은 보관본으로 바로 열어요. 새 버전을 올릴 때마다 아래 숫자를 바꿔 주세요.
const CACHE = 'joy-shell-v31';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'firebase-config.js', 'manifest.webmanifest',
  'icons/joycorner-180.png', 'icons/joycorner-192.png', 'icons/joycorner-512.png',
  'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png', 'icons/favicon-32.png',
  'fonts/Cafe24DongdongRegular.woff2', 'fonts/Cafe24DongdongLight.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => { })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // Firestore · 구글은 건드리지 않아요
  if (/version\.json$/.test(url.pathname)) return;                             // 새 버전 확인은 언제나 인터넷으로
  const fixed = /\/(icons|fonts)\//.test(url.pathname) || /\.(png|woff2)$/.test(url.pathname);
  e.respondWith(caches.open(CACHE).then(async c => {
    if (fixed) {
      const hit = await c.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(e.request); if (res && res.ok) c.put(e.request, res.clone()).catch(() => { }); return res;
    }
    try {
      const res = await fetch(e.request);
      if (res && res.ok) c.put(e.request, res.clone()).catch(() => { });
      return res;
    } catch {
      return (await c.match(e.request, { ignoreSearch: true })) || (e.request.mode === 'navigate' ? await c.match('index.html') : null) || Response.error();
    }
  }));
});

/* v28 — 공지 알림: 앱이 닫혀 있어도 (보내기 도우미가 보낸 알림을 띄워요) */
self.addEventListener('push', e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { p = { data: { body: e.data ? e.data.text() : '' } }; }
  const d = p.data || {}, n = p.notification || {};
  const title = d.title || n.title || '조이코너 노트', body = d.body || n.body || '새 소식이 있어요';
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, { body, tag: d.tag || 'joy', icon: 'icons/joycorner-192.png', badge: 'icons/favicon-32.png', data: { url: d.url || './' } }),
    self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge(1).catch(() => { }) : Promise.resolve()
  ]));
});
/* 알림을 누르면 — 열려 있는 앱으로 가서 그 공지를 열어요 (없으면 새로 열기) */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list.find(x => x.url.startsWith(self.registration.scope));
    if (c) { c.postMessage({ type: 'open', url }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});

