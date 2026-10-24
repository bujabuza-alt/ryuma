// ── 이미지 (Image Storage) ──
var imgSearch   = '';
var imgCatTab   = '전체'; // 이미지 분류 필터: '전체' | S.imageCats의 항목 | '미분류'
var IMG_MAX_DIM = 1280;   // 업로드 시 최대 가로/세로 픽셀 (용량 절약)
var IMG_QUALITY = 0.78;
var IMG_MAX_COUNT = 150;  // Firebase/로컬 저장 용량 보호를 위한 최대 보관 장수
var DEFAULT_IMAGE_CATS = ['메뉴','매장','기타'];

// ── 사진 저장 위치 ──
// · 원본:   tableAppImages/{매장}/{사진 id}        → {id, name, dataUrl, memo, cat, ts}
// · 목록용: tableAppImages/_meta/{매장}/{사진 id}  → {id, name, memo, cat, ts, thumb}
// 원본(1장 수백 KB)을 전부 받아야 목록이 뜨던 구조라 사진이 많으면 이미지 탭이 한참 동안
// "불러오는 중"에 머물렀고, 그동안 새 사진 저장도 막혀 있었다. 그래서 목록은 작은 썸네일만
// 받아 그리고, 원본은 사진을 열거나 공유·다운로드할 때 1장씩만 받는다.
// 새 사진 저장은 목록 로딩을 기다리지 않는다. (분류 목록 imageCats는 작아서 매장 데이터에 둔다)
var IMG_THUMB_DIM = 320;  // 목록용 썸네일 최대 가로/세로 픽셀
var IMG_THUMB_QUALITY = 0.7;
var IMG_WRITE_REST_DELAY = 15000; // SDK 쓰기가 이 시간 안에 끝나지 않으면 REST로도 저장
var IMG_FULL_CACHE_MAX = 20;      // 메모리에 들고 있을 원본 장수

var imgListenRef = null; // 현재 붙어있는 목록(썸네일) 리스너
var imgLoaded = false;   // 현재 매장의 사진 목록을 서버에서 한 번이라도 받았는지
var imgLoadError = false;
var imgFullCache = {};   // id → 원본 dataUrl
var imgFullCacheOrder = [];
var imgMetaSyncing = false;   // 썸네일이 없는 기존 사진을 변환 중인지
var imgMetaSyncLeft = 0;      // 변환 남은 장수
var imgMetaSyncChecked = false; // 이번 실행에서 변환 대상을 확인했는지

function imgRef(store) { return fbDb.ref('tableAppImages/' + (store || currentStore)); }
function imgMetaRef(store) { return fbDb.ref('tableAppImages/_meta/' + (store || currentStore)); }
function imgFullPath(store, id) { return 'tableAppImages/' + store + '/' + id; }
function imgMetaPath(store, id) { return 'tableAppImages/_meta/' + store + '/' + id; }
// Firebase 키에 쓸 수 없는 문자( . # $ [ ] / )는 바꿔서 사용
function imgKey(id) { return String(id || uid()).replace(/[.#$\[\]\/]/g, '_'); }

// 매장 전환/로그아웃 시 사진 리스너와 상태 초기화
function resetImagesState() {
  if (imgListenRef) imgListenRef.off();
  imgListenRef = null;
  imgLoaded = false;
  imgLoadError = false;
  imgFullCache = {};
  imgFullCacheOrder = [];
  imgMetaSyncing = false;
  imgMetaSyncLeft = 0;
  imgMetaSyncChecked = false;
  if (S) S.images = [];
}

// 이미지 탭을 처음 열 때 목록(썸네일)을 불러오고, 이후엔 다른 기기의 변경을 실시간 반영
function ensureImagesLoaded() {
  if (imgListenRef || !currentStore) return;
  var store = currentStore;
  imgLoadError = false;
  imgListenRef = imgMetaRef(store);
  imgListenRef.on('value', function(snap) {
    if (store !== currentStore) return;
    var v = snap.val() || {};
    S.images = Object.keys(v).map(function(k) { return v[k]; }).filter(function(im) { return im && im.id; });
    imgLoaded = true;
    if (!imgMetaSyncChecked) { imgMetaSyncChecked = true; syncMissingImageMeta(store); }
    if (currentTab === 'images') renderImagesTab();
  }, function(err) {
    console.error('Image listener error:', err && err.code, err && err.message);
    if (store !== currentStore) return;
    imgListenRef = null;
    imgLoadError = true;
    if (currentTab === 'images') renderImagesTab();
  });
}

function imgDbBaseUrl() { return (fbApp && fbApp.options && fbApp.options.databaseURL) || ''; }

// 여러 경로를 한 번에 쓰기 (원본+목록을 함께 바꾸므로 둘이 어긋나지 않는다)
// 매장 네트워크가 웹소켓만 막는 경우 SDK 쓰기가 끝나지 않으므로, 일정 시간 뒤 REST로도 같은
// 내용을 저장한다. 같은 값을 두 번 쓰는 것이라 둘 다 반영돼도 결과는 같다.
// (보안 규칙이 인증 없이 열려 있어 REST로도 쓸 수 있다 — firebase.js의 restSaveFallback 참고)
function imgRestPatch(updates) {
  var base = imgDbBaseUrl();
  if (!base) return Promise.reject(new Error('no db url'));
  return fetch(base + '/.json', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  }).then(function(res) {
    if (!res.ok) throw new Error('REST PATCH failed: ' + res.status);
  });
}
function imgWrite(updates) {
  return new Promise(function(resolve, reject) {
    var settled = false;
    function done() {
      if (settled) return;
      settled = true;
      clearTimeout(restTimer);
      resolve();
    }
    var restTimer = setTimeout(function() {
      imgRestPatch(updates).then(done).catch(function(err) {
        console.error('Image REST save failed:', err && err.message);
      });
    }, IMG_WRITE_REST_DELAY);
    fbDb.ref().update(updates).then(done).catch(function(err) {
      console.error('Image save failed:', err && err.code, err && err.message);
      clearTimeout(restTimer);
      if (settled) return;
      imgRestPatch(updates).then(done).catch(function() {
        settled = true;
        reject(err);
      });
    });
  }).catch(function(err) {
    showToast('사진 저장에 실패했습니다. 네트워크를 확인해주세요.');
    throw err;
  });
}
// 사진 정보(이름·메모·분류)를 원본과 목록 양쪽에 반영. changes: {id: {필드: 값}}
function imgUpdateFields(changes) {
  var store = currentStore, upd = {};
  Object.keys(changes).forEach(function(id) {
    Object.keys(changes[id]).forEach(function(f) {
      upd[imgMetaPath(store, id) + '/' + f] = changes[id][f];
      upd[imgFullPath(store, id) + '/' + f] = changes[id][f];
    });
  });
  if (!Object.keys(upd).length) return Promise.resolve();
  return imgWrite(upd).catch(function() {});
}

function cacheFullImage(id, dataUrl) {
  if (!imgFullCache[id]) imgFullCacheOrder.push(id);
  imgFullCache[id] = dataUrl;
  while (imgFullCacheOrder.length > IMG_FULL_CACHE_MAX) delete imgFullCache[imgFullCacheOrder.shift()];
}
// 원본 1장 받기 (메모리 캐시). SDK 응답이 늦거나 실패하면 REST로도 요청해 먼저 온 쪽을 쓴다.
function loadFullImage(id) {
  if (imgFullCache[id]) return Promise.resolve(imgFullCache[id]);
  var store = currentStore;
  return new Promise(function(resolve, reject) {
    var settled = false, sdkFailed = false, restState = 'idle'; // idle | running | failed
    function ok(dataUrl) {
      if (settled) return;
      settled = true;
      clearTimeout(restTimer);
      if (store === currentStore) cacheFullImage(id, dataUrl);
      resolve(dataUrl);
    }
    function maybeReject() {
      if (settled || !sdkFailed || restState !== 'failed') return;
      settled = true;
      reject(new Error('image load failed'));
    }
    function restFailed() { restState = 'failed'; maybeReject(); }
    function viaRest() {
      if (restState !== 'idle') return;
      var base = imgDbBaseUrl();
      if (!base) { restFailed(); return; }
      restState = 'running';
      fetch(base + '/' + imgFullPath(store, id) + '/dataUrl.json').then(function(res) {
        if (!res.ok) throw new Error('REST GET failed: ' + res.status);
        return res.json();
      }).then(function(v) { if (v) ok(v); else restFailed(); }).catch(restFailed);
    }
    function sdkFail() {
      sdkFailed = true;
      clearTimeout(restTimer);
      viaRest();
      maybeReject();
    }
    var restTimer = setTimeout(viaRest, 8000);
    imgRef(store).child(id).child('dataUrl').once('value').then(function(snap) {
      if (snap.val()) ok(snap.val()); else sdkFail();
    }).catch(sdkFail);
  });
}

// 썸네일이 없는 기존 사진(목록용 정보가 생기기 전에 저장된 사진)을 찾아 1장씩 썸네일을 만든다.
// 원본 키 목록만(shallow) 받아서 비교하므로 확인 자체는 가볍다. 변환하는 동안에도 목록 보기와
// 새 사진 저장은 그대로 된다.
function syncMissingImageMeta(store) {
  if (imgMetaSyncing || store !== currentStore) return;
  var base = imgDbBaseUrl();
  if (!base) return;
  imgMetaSyncing = true;
  fetch(base + '/tableAppImages/' + store + '.json?shallow=true').then(function(res) {
    if (!res.ok) throw new Error('shallow GET failed: ' + res.status);
    return res.json();
  }).then(function(keys) {
    if (store !== currentStore) return;
    var have = {};
    (S.images || []).forEach(function(im) { have[im.id] = true; });
    var missing = Object.keys(keys || {}).filter(function(k) { return !have[k]; });
    imgMetaSyncLeft = missing.length;
    if (missing.length) console.log('썸네일 없는 사진 ' + missing.length + '장 변환 시작');
    if (currentTab === 'images') renderImagesTab();
    return missing.reduce(function(chain, id) {
      return chain.then(function() {
        if (store !== currentStore) return;
        return buildMetaFor(store, id).catch(function(err) {
          console.error('썸네일 변환 실패 (' + id + '):', err && err.message);
        }).then(function() {
          imgMetaSyncLeft = Math.max(0, imgMetaSyncLeft - 1);
          if (currentTab === 'images' && store === currentStore) renderImagesTab();
        });
      });
    }, Promise.resolve());
  }).catch(function(err) {
    console.error('썸네일 변환 대상 확인 실패 (다음 실행 때 다시 시도):', err && err.message);
  }).then(function() {
    if (store !== currentStore) return;
    imgMetaSyncing = false;
    imgMetaSyncLeft = 0;
    if (currentTab === 'images') renderImagesTab();
  });
}
function buildMetaFor(store, id) {
  return imgRef(store).child(id).once('value').then(function(snap) {
    var im = snap.val();
    if (!im || !im.dataUrl) return;
    return makeThumbFromDataUrl(im.dataUrl).catch(function() { return ''; }).then(function(thumb) {
      var meta = { id: id, name: im.name || '', memo: im.memo || '', cat: im.cat || '', ts: im.ts || Date.now(), thumb: thumb };
      var upd = {};
      upd[imgMetaPath(store, id)] = meta;
      return imgWrite(upd);
    });
  });
}

// 구버전 구조(tableApp/{매장}/images 배열)에 남아있는 사진을 새 경로로 옮긴다.
// 새 경로 쓰기가 성공한 뒤에만 옛 위치를 지우므로, 중간에 실패해도 사진이 사라지지 않고
// 다음 실행 때 다시 시도한다. 같은 id는 덮어쓰기만 하므로 여러 번 실행돼도 안전하다.
// (썸네일은 이미지 탭을 열 때 syncMissingImageMeta가 만든다)
function migrateImagesOut(store, images) {
  var arr = Array.isArray(images) ? images : Object.keys(images || {}).map(function(k) { return images[k]; });
  var upd = {};
  arr.forEach(function(im) {
    if (!im || !im.dataUrl) return;
    var key = imgKey(im.id);
    var copy = {};
    Object.keys(im).forEach(function(k) { if (im[k] !== undefined) copy[k] = im[k]; });
    copy.id = key;
    upd[key] = copy;
  });
  var oldRef = fbDb.ref('tableApp/' + store + '/images');
  var p = Object.keys(upd).length ? imgRef(store).update(upd) : Promise.resolve();
  p.then(function() {
    return oldRef.remove();
  }).then(function() {
    console.log('사진 이전 완료: tableApp/' + store + '/images → tableAppImages/' + store + ' (' + Object.keys(upd).length + '장)');
    // 이미지 탭이 이미 열려 있으면 옮긴 사진의 썸네일을 바로 만든다
    if (imgLoaded && store === currentStore) syncMissingImageMeta(store);
  }).catch(function(err) {
    console.error('사진 이전 실패 (다음 실행 때 다시 시도):', err && err.message);
  });
}

function loadImageEl(src) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() { resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}
function drawScaled(img, maxDim, quality) {
  var w = img.width, h = img.height;
  if (w > maxDim || h > maxDim) {
    if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; }
    else { w = Math.round(w * maxDim / h); h = maxDim; }
  }
  var canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}
function makeThumbFromDataUrl(dataUrl) {
  return loadImageEl(dataUrl).then(function(img) { return drawScaled(img, IMG_THUMB_DIM, IMG_THUMB_QUALITY); });
}

// 업로드한 이미지를 캔버스로 축소·재압축하여 원본용/썸네일용 dataURL로 반환
function compressImageFile(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) { resolve(e.target.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  }).then(loadImageEl).then(function(img) {
    return { full: drawScaled(img, IMG_MAX_DIM, IMG_QUALITY), thumb: drawScaled(img, IMG_THUMB_DIM, IMG_THUMB_QUALITY) };
  });
}

function getImageList() {
  if (!S.images) S.images = [];
  var q = imgSearch.trim().toLowerCase();
  var list = S.images.slice().sort(function(a, b) { return (b.ts||0) - (a.ts||0); });
  if (imgCatTab === '미분류') {
    list = list.filter(function(im) { return !im.cat; });
  } else if (imgCatTab !== '전체') {
    list = list.filter(function(im) { return im.cat === imgCatTab; });
  }
  if (q) {
    list = list.filter(function(im) {
      return (im.name||'').toLowerCase().indexOf(q) >= 0 || (im.memo||'').toLowerCase().indexOf(q) >= 0;
    });
  }
  return list;
}

function renderImagesTab() {
  var grid = document.getElementById('img-grid');
  var cntEl = document.getElementById('img-count');
  if (!grid) return;
  if (!S.images) S.images = [];
  if (!S.imageCats || !S.imageCats.length) S.imageCats = DEFAULT_IMAGE_CATS.slice();
  renderImageCats();
  if (!imgLoaded) ensureImagesLoaded();
  // 목록을 받기 전이라도 방금 저장한 사진은 바로 보여준다
  if (!imgLoaded && !S.images.length) {
    if (cntEl) cntEl.textContent = '';
    grid.innerHTML = '<div class="img-empty">' + (imgLoadError ? '사진을 불러오지 못했습니다. 네트워크 확인 후 탭을 다시 열어주세요.' : '사진 불러오는 중…') + '</div>';
    return;
  }
  var list = getImageList();
  if (cntEl) cntEl.textContent = (imgLoaded ? '총 ' + S.images.length + '장' : '사진 불러오는 중…') + (imgMetaSyncLeft > 0 ? ' · 기존 사진 목록 정리 중 (' + imgMetaSyncLeft + '장 남음)' : '');
  if (!list.length) {
    grid.innerHTML = '<div class="img-empty">' +
      (imgSearch.trim() ? '검색 결과가 없습니다.' : '저장된 이미지가 없습니다. 상단의 업로드 버튼으로 추가하세요.') +
      '</div>';
    return;
  }
  grid.innerHTML = list.map(function(im) {
    return '<div class="img-card" data-id="' + im.id + '">' +
      (im.thumb ? '<img src="' + im.thumb + '" alt="' + esc(im.name) + '" loading="lazy" decoding="async">' : '<div class="img-card-ph">🖼</div>') +
      '<button type="button" class="img-card-del" data-id="' + im.id + '" title="삭제">×</button>' +
      (im.cat ? '<div class="img-card-cat">' + esc(im.cat) + '</div>' : '') +
      '<div class="img-card-name">' + esc(im.name) + '</div>' +
      '</div>';
  }).join('');
  grid.querySelectorAll('.img-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.classList.contains('img-card-del')) return;
      openImageViewer(card.getAttribute('data-id'));
    });
  });
  grid.querySelectorAll('.img-card-del').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteImage(btn.getAttribute('data-id'));
    });
  });
}

// ── 이미지 분류(카테고리) 칩 바 ──
function renderImageCats() {
  var bar = document.getElementById('img-cats');
  if (!bar) return;
  if (!S.imageCats || !S.imageCats.length) S.imageCats = DEFAULT_IMAGE_CATS.slice();
  var tabs = ['전체'].concat(S.imageCats, ['미분류']);
  if (imgCatTab !== '전체' && tabs.indexOf(imgCatTab) < 0) imgCatTab = '전체';
  bar.innerHTML = tabs.map(function(c) {
    return '<button class="scat' + (c === imgCatTab ? ' on' : '') + '" data-c="' + esc(c) + '">' + esc(c) + '</button>';
  }).join('') + '<button class="bg img-cat-mgr-btn" id="img-cat-mgr-btn" title="분류 관리">⚙</button>';
  bar.querySelectorAll('.scat').forEach(function(btn) {
    btn.addEventListener('click', function() {
      imgCatTab = this.getAttribute('data-c');
      renderImagesTab();
    });
  });
  var mgrBtn = document.getElementById('img-cat-mgr-btn');
  if (mgrBtn) mgrBtn.addEventListener('click', openImageCatMgr);
}

// ── 이미지 분류 관리 모달 ──
function openImageCatMgr() {
  if (!S.imageCats || !S.imageCats.length) S.imageCats = DEFAULT_IMAGE_CATS.slice();
  renderImageCatMgrModal();
}

function renderImageCatMgrModal() {
  var catsHtml = S.imageCats.map(function(c, i) {
    return '<div class="list-mgr-row"><span class="list-mgr-name">' + esc(c) + '</span>'
      + '<button class="list-mgr-edit" onclick="renameImageCat(' + i + ')">✏</button>'
      + '<button class="list-mgr-del" onclick="removeImageCat(' + i + ')" aria-label="삭제">×</button></div>';
  }).join('') || '<div style="padding:6px;font-size:11px;color:var(--text3)">없음</div>';

  showModal(
    '<div class="md-hd"><div class="md-title">이미지 분류 관리</div><button class="md-x" onclick="closeModal()" aria-label="닫기">×</button></div>'
    + '<div class="mb">'
    + '<div style="background:var(--surf2);border:1px solid var(--border);border-radius:10px;padding:6px 10px;max-height:160px;overflow-y:auto;">' + catsHtml + '</div>'
    + '<div style="display:flex;gap:6px;margin-top:6px;">'
      + '<input class="fi" id="new-imgcat-inp" placeholder="새 분류" maxlength="20" style="flex:1;">'
      + '<button class="bp" onclick="addImageCat()">추가</button>'
    + '</div>'
    + '<button class="ab" style="background:var(--surf3);color:var(--text2);width:100%;margin-top:10px;" onclick="closeModal()">닫기</button>'
    + '</div>'
  );
}

function addImageCat() {
  var inp = document.getElementById('new-imgcat-inp');
  var v = ((inp||{}).value || '').trim();
  if (!v) return;
  if (!S.imageCats) S.imageCats = [];
  if (S.imageCats.indexOf(v) >= 0) { showToast('이미 있는 분류입니다'); return; }
  S.imageCats.push(v);
  saveData();
  renderImageCatMgrModal();
  renderImageCats();
}
function renameImageCat(idx) {
  if (!S.imageCats) return;
  var oldName = S.imageCats[idx];
  var v = prompt('분류 이름 수정', oldName);
  if (v === null) return;
  v = v.trim();
  if (!v || v === oldName) return;
  if (S.imageCats.indexOf(v) >= 0) { showToast('이미 있는 분류입니다'); return; }
  if (!imgLoaded) { showToast('사진을 불러온 뒤 다시 시도해주세요'); return; }
  S.imageCats[idx] = v;
  var changes = {};
  (S.images||[]).forEach(function(im) { if (im.cat === oldName) { im.cat = v; changes[im.id] = { cat: v }; } });
  imgUpdateFields(changes);
  if (imgCatTab === oldName) imgCatTab = v;
  saveData();
  renderImageCatMgrModal();
  renderImagesTab();
  showToast('분류 이름이 수정되었습니다');
}
function removeImageCat(idx) {
  if (!S.imageCats) return;
  var name = S.imageCats[idx];
  if (!imgLoaded) { showToast('사진을 불러온 뒤 다시 시도해주세요'); return; }
  var cnt = (S.images||[]).filter(function(im) { return im.cat === name; }).length;
  var msg = cnt > 0
    ? '"' + name + '" 분류를 삭제할까요?\n이 분류를 사용 중인 이미지 ' + cnt + '장은 "미분류"로 표시됩니다.'
    : '"' + name + '" 분류를 삭제할까요?';
  if (!confirm(msg)) return;
  S.imageCats.splice(idx, 1);
  var changes = {};
  (S.images||[]).forEach(function(im) { if (im.cat === name) { im.cat = ''; changes[im.id] = { cat: '' }; } });
  imgUpdateFields(changes);
  if (imgCatTab === name) imgCatTab = '전체';
  saveData();
  renderImageCatMgrModal();
  renderImagesTab();
}

// 새 사진 저장: 목록 로딩을 기다리지 않고 바로 저장한다 (목록이 아직 없으면 장수 제한만 건너뜀)
function handleImageUpload(files) {
  if (!files || !files.length || !currentStore) return;
  if (!S.images) S.images = [];
  if (imgLoaded && S.images.length >= IMG_MAX_COUNT) {
    alert('최대 ' + IMG_MAX_COUNT + '장까지 저장할 수 있습니다. 기존 이미지를 삭제한 뒤 다시 시도하세요.');
    return;
  }
  var store = currentStore;
  var list = Array.prototype.slice.call(files).filter(function(f) { return f.type && f.type.indexOf('image/') === 0; });
  if (imgLoaded) list = list.slice(0, IMG_MAX_COUNT - S.images.length);
  if (!list.length) return;
  showToast(list.length + '장 저장 중…');
  var saved = 0, failed = 0;
  // 큰 사진을 동시에 여러 장 디코딩하면 기기 메모리가 부족해질 수 있어 1장씩 처리
  list.reduce(function(chain, file) {
    return chain.then(function() {
      if (store !== currentStore) return;
      return compressImageFile(file).then(function(out) {
        var id = imgKey(uid());
        var ts = Date.now();
        var full = { id: id, name: file.name, dataUrl: out.full, memo: '', cat: '', ts: ts };
        var meta = { id: id, name: file.name, memo: '', cat: '', ts: ts, thumb: out.thumb };
        cacheFullImage(id, out.full);
        if (!imgListenRef) S.images.push(meta); // 리스너가 붙어 있으면 SDK가 바로 목록에 반영한다
        if (currentTab === 'images') renderImagesTab();
        var upd = {};
        upd[imgFullPath(store, id)] = full;
        upd[imgMetaPath(store, id)] = meta;
        // 다음 사진 압축은 저장 응답을 기다리지 않고 진행
        imgWrite(upd).then(function() { saved++; }, function() { failed++; }).then(report);
      }).catch(function(err) {
        console.error('Image compress failed:', err);
        failed++;
        report();
      });
    });
  }, Promise.resolve());
  function report() {
    if (saved + failed < list.length) return;
    if (saved) showToast(saved + '장의 이미지가 저장되었습니다' + (failed ? ' (' + failed + '장 실패)' : ''));
  }
}

function deleteImage(id) {
  if (!confirm('이 이미지를 삭제하시겠습니까?')) return;
  S.images = (S.images||[]).filter(function(im) { return im.id !== id; });
  delete imgFullCache[id];
  var upd = {};
  upd[imgFullPath(currentStore, id)] = null;
  upd[imgMetaPath(currentStore, id)] = null;
  imgWrite(upd).catch(function() {});
  renderImagesTab();
  closeModal();
}

function renameImage(id) {
  var im = (S.images||[]).filter(function(x) { return x.id === id; })[0];
  if (!im) return;
  var next = (prompt('이미지 이름 변경', im.name) || '').trim();
  if (!next || next === im.name) return;
  im.name = next;
  imgUpdateFields(makeChange(id, { name: next }));
  renderImagesTab();
  openImageViewer(id);
  showToast('이름이 변경되었습니다');
}

// 이미지 공유: 파일 공유(Web Share API)를 지원하는 기기는 사진 앱/메신저 등으로 바로 공유,
// 미지원 기기는 다운로드를 안내한다.
function shareImage(id) {
  var im = (S.images||[]).filter(function(x) { return x.id === id; })[0];
  if (!im) return;
  if (!navigator.share) {
    showToast('이 기기는 공유 기능을 지원하지 않습니다. 다운로드를 이용해주세요.');
    return;
  }
  loadFullImage(id).then(function(dataUrl) { return fetch(dataUrl); }).then(function(res) { return res.blob(); }).then(function(blob) {
    var file = new File([blob], im.name || 'image.jpg', { type: blob.type || 'image/jpeg' });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return navigator.share({ title: im.name });
    }
    return navigator.share({ files: [file] });
  }).catch(function(err) {
    if (err && err.name === 'AbortError') return;
    showToast('공유에 실패했습니다.');
  });
}

function openImageViewer(id) {
  var im = (S.images||[]).filter(function(x) { return x.id === id; })[0];
  if (!im) return;
  if (!S.imageCats || !S.imageCats.length) S.imageCats = DEFAULT_IMAGE_CATS.slice();
  var catOptions = '<option value="">미분류</option>' + S.imageCats.map(function(c) {
    return '<option value="' + esc(c) + '"' + (im.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>';
  }).join('');
  showModal(
    '<div class="md-hd"><span class="md-title">' + esc(im.name) + '</span>' +
    '<span style="display:flex;align-items:center;gap:6px">' +
    '<button class="md-x" id="img-rename-btn" title="이름 변경" aria-label="이름 변경" style="font-size:13px">✏</button>' +
    '<button class="md-x" id="mxbtn" aria-label="닫기">×</button>' +
    '</span></div>' +
    '<div class="mb img-viewer">' +
    '<img id="img-viewer-img" data-id="' + esc(id) + '" src="' + (imgFullCache[id] || im.thumb || '') + '" alt="' + esc(im.name) + '">' +
    (imgFullCache[id] ? '' : '<div class="img-viewer-loading" id="img-viewer-loading">원본 불러오는 중…</div>') +
    '<select class="fi" id="img-cat-select">' + catOptions + '</select>' +
    '<textarea class="fi" id="img-memo-input" placeholder="메모…" maxlength="200">' + esc(im.memo||'') + '</textarea>' +
    '<div style="display:flex;gap:7px">' +
    '<button class="ab" style="background:var(--indigo);display:flex;align-items:center;justify-content:center" id="img-memo-save">저장</button>' +
    '<button class="ab" style="background:var(--green);display:flex;align-items:center;justify-content:center" id="img-share-btn">🔗 공유</button>' +
    '</div>' +
    '<button class="ab" style="background:var(--surf3);color:var(--text2);display:flex;align-items:center;justify-content:center" id="img-download-btn">↓ 다운로드</button>' +
    '<button class="ab" style="background:var(--red2);width:100%" id="img-del-btn">삭제</button>' +
    '</div>'
  );
  document.getElementById('img-rename-btn').addEventListener('click', function() {
    renameImage(id);
  });
  document.getElementById('img-memo-save').addEventListener('click', function() {
    im.memo = document.getElementById('img-memo-input').value.trim();
    im.cat = document.getElementById('img-cat-select').value;
    imgUpdateFields(makeChange(id, { memo: im.memo, cat: im.cat }));
    closeModal();
    renderImagesTab();
    showToast('저장되었습니다');
  });
  document.getElementById('img-share-btn').addEventListener('click', function() {
    shareImage(id);
  });
  document.getElementById('img-del-btn').addEventListener('click', function() {
    deleteImage(id);
  });
  document.getElementById('img-download-btn').addEventListener('click', function() {
    downloadImage(id);
  });
  // 목록에는 썸네일만 있으므로 원본은 열 때 받아서 바꿔 끼운다
  if (!imgFullCache[id]) {
    loadFullImage(id).then(function(dataUrl) {
      var el = document.getElementById('img-viewer-img');
      if (el && el.getAttribute('data-id') === id) el.src = dataUrl;
      var ld = document.getElementById('img-viewer-loading');
      if (ld) ld.remove();
    }).catch(function() {
      var ld = document.getElementById('img-viewer-loading');
      if (ld) ld.textContent = '원본을 불러오지 못했습니다. 네트워크를 확인해주세요.';
    });
  }
}

function makeChange(id, fields) { var c = {}; c[id] = fields; return c; }

function downloadImage(id) {
  var im = (S.images||[]).filter(function(x) { return x.id === id; })[0];
  if (!im) return;
  loadFullImage(id).then(function(dataUrl) {
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = im.name || 'image.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }).catch(function() {
    showToast('원본을 불러오지 못했습니다. 네트워크를 확인해주세요.');
  });
}

// ── 바인딩 ──
document.getElementById('img-upload-input').addEventListener('change', function(e) {
  handleImageUpload(e.target.files);
  e.target.value = '';
});
document.getElementById('img-srch').addEventListener('input', function(e) {
  imgSearch = e.target.value;
  renderImagesTab();
});
