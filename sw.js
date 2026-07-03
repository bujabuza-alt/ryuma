// ── Service Worker ────────────────────────────────────────
// 모든 로컬 파일 → 네트워크 우선, 오프라인 시 캐시 폴백
// CACHE_NAME을 올려서 기존 캐시(v1) 강제 삭제
var CACHE_NAME = 'table-app-v4';

// ── 설치 ─────────────────────────────────────────────────
self.addEventListener('install', function(event) {
  self.skipWaiting(); // 즉시 활성화
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(['./manifest.json']).catch(function() {});
    })
  );
});

// ── 활성화 ───────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME;
        }).map(function(key) {
          return caches.delete(key); // 구버전 캐시(v1 등) 전부 삭제
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── Fetch 전략 ───────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // 외부 요청(Firebase, CDN 등)은 그냥 통과
  if (url.includes('firebaseio.com') ||
      url.includes('googleapis.com') ||
      url.includes('gstatic.com') ||
      url.includes('firebase')) {
    return;
  }

  // 모든 로컬 리소스 → 네트워크 우선, 오프라인 시 캐시 폴백
  // script.js, style.css, index.html, manifest.json 모두 동일하게 처리
  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      // 오프라인일 때만 캐시에서 서빙
      return caches.match(event.request);
    })
  );
});
