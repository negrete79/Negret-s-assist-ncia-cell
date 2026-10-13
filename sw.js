/* NEGRET'S — Service Worker (offline-first) */
const VERSION = 'negrets-v1.0.0';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg'
];

/* Instalação: cacheia o app shell (tolerante — um arquivo 404 não derruba o SW) */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all(APP_SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

/* Ativação: remove versões antigas do cache e assume o controle */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Estratégias por tipo de requisição */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Navegação: rede primeiro, cache como fallback (app abre mesmo sem internet) */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* Mesma origem (ícones, manifest...): cache primeiro, atualiza em segundo plano */
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  /* CDNs (jsPDF, fontes Google): stale-while-revalidate — offline após a 1ª visita */
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
