// Foothold service worker: caches the whole self-contained game (vendored Phaser included)
// so it installs as a PWA and plays offline once loaded. Cache-first for game assets, with a
// network-first check on navigation so a fresh deploy is picked up promptly.
//
// CACHE_VERSION: bump this string on every push that changes any cached file (see the
// pre-push gate in the root CLAUDE.md). A stale string means players stay stuck on an old
// build even after you ship a fix - this is the ONLY thing that forces the old cache out.
const CACHE_VERSION = 'foothold-v0.20';

const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './vendor/phaser.min.js',
  './src/main.js',
  './src/lib/CrtPipeline.js',
  './src/lib/sfx.js',
  './src/lib/settings.js',
  './src/lib/ui.js',
  './src/lib/tileEditor.js',
  './src/scenes/BootScene.js',
  './src/scenes/TitleScene.js',
  './src/scenes/LevelSelectScene.js',
  './src/scenes/GameScene.js',
  './assets/icons/gold.svg',
  './assets/icons/wood.svg',
  './assets/icons/stone.svg',
  './assets/icons/special.svg',
  './assets/icons/upgrade.svg',
  './assets/icons/watchtower.svg',
  './assets/icons/arrow_back.svg',
  './assets/icons/pwa-192.png',
  './assets/icons/pwa-512.png',
  './assets/watchtower.png',
  './assets/fonts/grenze-400.woff2',
  './assets/fonts/grenze-700.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Navigations: try the network first (so a fresh deploy shows up immediately), fall back
  // to the cached shell when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html')),
    );
    return;
  }

  // Everything else (scripts, assets, fonts): cache-first, since these files are versioned
  // by CACHE_VERSION above rather than by URL.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
