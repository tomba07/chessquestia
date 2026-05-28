const CACHE = "chessquestia-v3";

const SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/sw.js",
  "/maia-worker.js",
  "/assets/app-icons/favicon-32.png",
  "/assets/app-icons/apple-touch-icon.png",
  "/assets/app-icons/icon-192.png",
  "/assets/app-icons/icon-512.png",
];

const SOLO_ENGINE = [
  "/data/all_moves_maia3.json",
  "/data/all_moves_maia3_reversed.json",
  "/maia3/maia3_simplified.onnx",
  "/ort/ort.wasm.min.js",
  "/ort/ort-wasm.wasm",
  "/ort/ort-wasm-simd.wasm",
  "/cm-chessboard/assets/pieces/staunty.svg",
];

const STATIC_PREFIXES = [
  "/assets/",
  "/cm-chessboard/assets/",
  "/data/",
  "/maia3/",
  "/ort/",
];

const STATIC_EXTENSIONS = [
  ".css",
  ".js",
  ".json",
  ".map",
  ".mjs",
  ".onnx",
  ".png",
  ".svg",
  ".wasm",
  ".webmanifest",
];

function isApiLikeRequest(url) {
  return url.pathname.startsWith("/api/")
    || url.pathname.startsWith("/auth/")
    || url.pathname === "/dev-reload"
    || url.pathname === "/health";
}

function isStaticRequest(url) {
  return STATIC_PREFIXES.some(prefix => url.pathname.startsWith(prefix))
    || STATIC_EXTENSIONS.some(extension => url.pathname.endsWith(extension));
}

async function precacheCurrentBuild(cache) {
  const response = await fetch("/index.html", { cache: "reload" });
  if (!response.ok) return;
  await cache.put("/index.html", response.clone());
  await cache.put("/", response.clone());
  const html = await response.text();
  const assetUrls = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)]
    .map(match => new URL(match[1], self.location.origin))
    .filter(url => url.origin === self.location.origin)
    .map(url => url.pathname + url.search);
  await cache.addAll([...new Set(assetUrls)]);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([...SHELL, ...SOLO_ENGINE]);
    await precacheCurrentBuild(cache);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function navigationFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put("/index.html", response.clone());
    }
    return response;
  } catch {
    return await caches.match("/index.html") || caches.match("/");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!["GET", "HEAD"].includes(request.method)) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApiLikeRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationFallback(request));
    return;
  }

  if (isStaticRequest(url)) {
    event.respondWith(cacheFirst(request));
  }
});
