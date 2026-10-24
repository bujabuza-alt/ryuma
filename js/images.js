// ── 이미지 (Image Storage) ──
var imgSearch   = '';
var imgCatTab   = '전체'; // 이미지 분류 필터: '전체' | S.imageCats의 항목 | '미분류'
var IMG_MAX_DIM = 1280;   // 업로드 시 최대 가로/세로 픽셀 (용량 절약)
var IMG_QUALITY = 0.78;
var IMG_MAX_COUNT = 150;  // Firebase/로컬 저장 용량 보호를 위한 최대 보관 장수
var DEFAULT_IMAGE_CATS = ['메뉴','매장','기타'];

// ── 사진 저장 위치: tableAppImages/{매장}/{사진 id} ──
// 사진(base64)은 용량이 커서 매장 데이터(tableApp/{매장})와 같이 두면 앱을 켤 때마다,
// 그리고 무엇이든 저장할 때마다 사진 전체를 주고받게 된다. 그래서 별도 경로에 사진 1장당
// 노드 1개로 저장하고, 이미지 탭을 열 때만 불러온다. (분류 목록 imageCats는 작아서 매장 데이터에 둔다)
var imgListenRef = null; // 현재 붙어있는 사진 리스너
var imgLoaded = false;   // 현재 매장의 사진을 서버에서 한 번이라도 받았는지
var imgLoadError = false;

function imgRef(store) { return fbDb.ref('tableAppImages/' + (store || currentStore)); }
// Firebase 키에 쓸 수 없는 문자( . # $ [ ] / )는 바꿔서 사용
function imgKey(id) { return String(id || uid()).replace(/[.#$\[\]\/]/g, '_'); }

// 매장 전환/로그아웃 시 사진 리스너와 상태 초기화
function resetImagesState() {
  if (imgListenRef) imgListenRef.off();
  imgListenRef = null;
  imgLoaded = false;
  imgLoadError = false;
  if (S) S.images = [];
}

// 이미지 탭을 처음 열 때 사진을 불러오고, 이후엔 다른 기기의 변경을 실시간 반영
function ensureImagesLoaded() {
  if (imgListenRef || !currentStore) return;
  var store = currentStore;
  imgLoadError = false;
  imgListenRef = imgRef(store);
  imgListenRef.on('value', function(snap) {
    if (store !== currentStore) return;
    var v = snap.val() || {};
    S.images = Object.keys(v).map(function(k) { return v[k]; }).filter(function(im) { return im && im.dataUrl; });
    imgLoaded = true;
    if (currentTab === 'images') renderImagesTab();
  }, function(err) {
    console.error('Image listener error:', err && err.code, err && err.message);
    if (store !== currentStore) return;
    imgListenRef = null;
    imgLoadError = true;
    if (currentTab === 'images') renderImagesTab();
  });
}

// 사진 쓰기 실패 알림 (오프라인이면 SDK가 대기열에 넣었다가 연결되면 저장한다)
function imgWrite(promise) {
  return promise.catch(function(err) {
    console.error('Image save failed:', err && err.code, err && err.message);
    showToast('사진 저장에 실패했습니다. 네트워크를 확인해주세요.');
  });
}

// 구버전 구조(tableApp/{매장}/images 배열)에 남아있는 사진을 새 경로로 옮긴다.
// 새 경로 쓰기가 성공한 뒤에만 옛 위치를 지우므로, 중간에 실패해도 사진이 사라지지 않고
// 다음 실행 때 다시 시도한다. 같은 id는 덮어쓰기만 하므로 여러 번 실행돼도 안전하다.
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
  }).catch(function(err) {
    console.error('사진 이전 실패 (다음 실행 때 다시 시도):', err && err.message);
  });
}

// 업로드한 이미지를 캔버스로 축소·재압축하여 dataURL로 반환
function compressImageFile(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var w = img.width, h = img.height;
        if (w > IMG_MAX_DIM || h > IMG_MAX_DIM) {
          if (w >= h) { h = Math.round(h * IMG_MAX_DIM / w); w = IMG_MAX_DIM; }
          else { w = Math.round(w * IMG_MAX_DIM / h); h = IMG_MAX_DIM; }
        }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', IMG_QUALITY));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
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
  if (!imgLoaded) {
    ensureImagesLoaded();
    if (cntEl) cntEl.textContent = '';
    grid.innerHTML = '<div class="img-empty">' + (imgLoadError ? '사진을 불러오지 못했습니다. 네트워크 확인 후 탭을 다시 열어주세요.' : '사진 불러오는 중…') + '</div>';
    return;
  }
  var list = getImageList();
  if (cntEl) cntEl.textContent = '총 ' + S.images.length + '장';
  if (!list.length) {
    grid.innerHTML = '<div class="img-empty">' +
      (imgSearch.trim() ? '검색 결과가 없습니다.' : '저장된 이미지가 없습니다. 상단의 업로드 버튼으로 추가하세요.') +
      '</div>';
    return;
  }
  grid.innerHTML = list.map(function(im) {
    return '<div class="img-card" data-id="' + im.id + '">' +
      '<img src="' + im.dataUrl + '" alt="' + esc(im.name) + '" loading="lazy">' +
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
  var upd = {};
  (S.images||[]).forEach(function(im) { if (im.cat === oldName) { im.cat = v; upd[im.id + '/cat'] = v; } });
  if (Object.keys(upd).length) imgWrite(imgRef().update(upd));
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
  var upd = {};
  (S.images||[]).forEach(function(im) { if (im.cat === name) { im.cat = ''; upd[im.id + '/cat'] = ''; } });
  if (Object.keys(upd).length) imgWrite(imgRef().update(upd));
  if (imgCatTab === name) imgCatTab = '전체';
  saveData();
  renderImageCatMgrModal();
  renderImagesTab();
}

function handleImageUpload(files) {
  if (!files || !files.length) return;
  if (!imgLoaded) { showToast('사진을 불러오는 중입니다. 잠시 후 다시 시도해주세요'); return; }
  if (!S.images) S.images = [];
  if (S.images.length >= IMG_MAX_COUNT) {
    alert('최대 ' + IMG_MAX_COUNT + '장까지 저장할 수 있습니다. 기존 이미지를 삭제한 뒤 다시 시도하세요.');
    return;
  }
  var list = Array.prototype.slice.call(files);
  var room = IMG_MAX_COUNT - S.images.length;
  if (list.length > room) list = list.slice(0, room);
  var remaining = list.length;
  var added = 0;
  if (!remaining) return;
  list.forEach(function(file) {
    if (!file.type || file.type.indexOf('image/') !== 0) {
      remaining--;
      if (remaining === 0) finish();
      return;
    }
    compressImageFile(file).then(function(dataUrl) {
      var im = { id: imgKey(uid()), name: file.name, dataUrl: dataUrl, memo: '', ts: Date.now() };
      S.images.push(im);
      imgWrite(imgRef().child(im.id).set(im));
      added++;
      remaining--;
      if (remaining === 0) finish();
    }).catch(function() {
      remaining--;
      if (remaining === 0) finish();
    });
  });
  function finish() {
    if (added > 0) {
      renderImagesTab();
      showToast(added + '장의 이미지가 저장되었습니다');
    }
  }
}

function deleteImage(id) {
  if (!confirm('이 이미지를 삭제하시겠습니까?')) return;
  S.images = (S.images||[]).filter(function(im) { return im.id !== id; });
  imgWrite(imgRef().child(id).remove());
  renderImagesTab();
  closeModal();
}

function renameImage(id) {
  var im = (S.images||[]).filter(function(x) { return x.id === id; })[0];
  if (!im) return;
  var next = (prompt('이미지 이름 변경', im.name) || '').trim();
  if (!next || next === im.name) return;
  im.name = next;
  imgWrite(imgRef().child(id).update({ name: next }));
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
  fetch(im.dataUrl).then(function(res) { return res.blob(); }).then(function(blob) {
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
    '<img src="' + im.dataUrl + '" alt="' + esc(im.name) + '">' +
    '<select class="fi" id="img-cat-select">' + catOptions + '</select>' +
    '<textarea class="fi" id="img-memo-input" placeholder="메모…" maxlength="200">' + esc(im.memo||'') + '</textarea>' +
    '<div style="display:flex;gap:7px">' +
    '<button class="ab" style="background:var(--indigo);display:flex;align-items:center;justify-content:center" id="img-memo-save">저장</button>' +
    '<button class="ab" style="background:var(--green);display:flex;align-items:center;justify-content:center" id="img-share-btn">🔗 공유</button>' +
    '</div>' +
    '<a class="ab" style="background:var(--surf3);color:var(--text2);text-decoration:none;display:flex;align-items:center;justify-content:center" href="' + im.dataUrl + '" download="' + esc(im.name) + '">↓ 다운로드</a>' +
    '<button class="ab" style="background:var(--red2);width:100%" id="img-del-btn">삭제</button>' +
    '</div>'
  );
  document.getElementById('img-rename-btn').addEventListener('click', function() {
    renameImage(id);
  });
  document.getElementById('img-memo-save').addEventListener('click', function() {
    im.memo = document.getElementById('img-memo-input').value.trim();
    im.cat = document.getElementById('img-cat-select').value;
    imgWrite(imgRef().child(id).update({ memo: im.memo, cat: im.cat }));
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
