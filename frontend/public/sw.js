const CACHE_NAME = "amana-cache-v1";
const API_CACHE_NAME = "amana-api-cache-v1";
const API_CACHE_TTL_MS = 5 * 60 * 1000;
const OFFLINE_URL = "/offline.html";
const STATIC_ASSET_PATTERN = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|otf|webp|avif)$/;

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  OFFLINE_URL,
];

const swScope = typeof self !== "undefined" ? self : globalThis;

if (typeof swScope.addEventListener === "function") {
  swScope.addEventListener("install", (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
    );
    if (typeof swScope.skipWaiting === "function") {
      swScope.skipWaiting();
    }
  });

  swScope.addEventListener("activate", (event) => {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      })
    );
    if (swScope.clients && typeof swScope.clients.claim === "function") {
      swScope.clients.claim();
    }
  });

  swScope.addEventListener("fetch", handleFetch);
}

function isNavigationRequest(request) {
  if (!request) return false;
  if (request.mode === "navigate") return true;
  if (request.destination === "document") return true;
  const accept = request.headers && typeof request.headers.get === "function"
    ? request.headers.get("accept")
    : null;
  return typeof accept === "string" && accept.includes("text/html");
}

function handleFetch(event) {
  const { request } = event;

  // Never cache streaming/video/audio or range requests.
  if (request.headers && typeof request.headers.has === "function" && request.headers.has("range")) {
    return;
  }
  const destination = request.destination;
  if (destination === "video" || destination === "audio") {
    return;
  }

  const url = new URL(request.url);

  // App data routes (API & trades): network-first with cache fallback for GET,
  // while non-GET mutations (POST, OPTIONS, etc.) bypass caching and succeed online.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/trades/")) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Same-origin static assets: stale-while-revalidate for GET.
  if (
    typeof swScope.location !== "undefined" &&
    url.origin === swScope.location.origin &&
    (url.pathname.startsWith("/_next/") || STATIC_ASSET_PATTERN.test(url.pathname))
  ) {
    if (request.method === "GET") {
      event.respondWith(staleWhileRevalidate(request));
      return;
    }
  }

  // Document navigation requests: network-first, falling back to the cached
  // offline shell when the network is unavailable and the route is uncached.
  if (request.method === "GET" && isNavigationRequest(request)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(networkFirstWithCache(request));
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/html" },
    });
  }
}

async function cacheFirst(request) {
  if (request.method !== "GET") {
    return fetch(request);
  }
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && request.method === "GET") {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  if (request.method !== "GET") {
    return fetch(request);
  }
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok && request.method === "GET") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached || new Response("Offline", { status: 503 }));
  return cached || network;
}

async function networkFirstWithCache(request) {
  // Non-GET requests (e.g. POST mutations, CORS preflight OPTIONS, PUT, DELETE):
  // The Cache API only supports GET requests. Calling cache.put with non-GET throws TypeError.
  // Branch on request.method === "GET" before any cache.put so mutations always reach the network
  // and successful responses are returned without throwing TypeError or falling back to 503 offline JSON.
  if (request.method !== "GET") {
    try {
      return await fetch(request);
    } catch {
      return new Response(JSON.stringify({ offline: true, error: "You are offline" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok && request.method === "GET") {
      const cache = await caches.open(API_CACHE_NAME);
      const cloned = response.clone();
      const body = await cloned.text();
      cache.put(
        request,
        new Response(body, {
          headers: {
            ...Object.fromEntries(cloned.headers.entries()),
            "x-amana-cache-time": String(Date.now()),
          },
        })
      );
    }
    return response;
  } catch {
    if (request.method === "GET") {
      const cached = await caches.match(request);
      if (cached) {
        const cacheTime = cached.headers.get("x-amana-cache-time");
        if (cacheTime && Date.now() - parseInt(cacheTime) < API_CACHE_TTL_MS) {
          return cached;
        }
      }
    }
    return new Response(JSON.stringify({ offline: true, error: "You are offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({ offline: true, error: "You are offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    handleFetch,
    networkFirstWithCache,
    networkFirstNavigation,
    isNavigationRequest,
    cacheFirst,
    staleWhileRevalidate,
    networkOnly,
    CACHE_NAME,
    API_CACHE_NAME,
    OFFLINE_URL,
  };
}
