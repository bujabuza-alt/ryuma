// ── 이미지 저장 (Image Storage) ──
var imgSearch   = '';
var IMG_MAX_DIM = 1280;   // 업로드 시 최대 가로/세로 픽셀 (용량 절약)
var IMG_QUALITY = 0.78;
var IMG_MAX_COUNT = 150;  // Firebase/로컬 저장 용량 보호를 위한 최대 보관 장수

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

function handleImageUpload(files) {
  if (!files || !files.length) return;
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
      S.images.push({ id: uid(), name: file.name, dataUrl: dataUrl, memo: '', ts: Date.now() });
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
      saveData();
      renderImagesTab();
      showToast(added + '장의 이미지가 저장되었습니다');
    }
  }
}

function deleteImage(id) {
  if (!confirm('이 이미지를 삭제하시겠습니까?')) return;
  S.images = (S.images||[]).filter(function(im) { return im.id !== id; });
  saveData();
  renderImagesTab();
  closeModal();
}

function openImageViewer(id) {
  var im = (S.images||[]).filter(function(x) { return x.id === id; })[0];
  if (!im) return;
  showModal(
    '<div class="md-hd"><span class="md-title">' + esc(im.name) + '</span><button class="md-x" id="mxbtn">×</button></div>' +
    '<div class="mb img-viewer">' +
    '<img src="' + im.dataUrl + '" alt="' + esc(im.name) + '">' +
    '<textarea class="fi" id="img-memo-input" placeholder="메모…" maxlength="200">' + esc(im.memo||'') + '</textarea>' +
    '<div style="display:flex;gap:7px">' +
    '<button class="ab" style="background:var(--indigo);display:flex;align-items:center;justify-content:center" id="img-memo-save">메모 저장</button>' +
    '<a class="ab" style="background:var(--surf3);color:var(--text2);text-decoration:none;display:flex;align-items:center;justify-content:center" href="' + im.dataUrl + '" download="' + esc(im.name) + '">↓ 다운로드</a>' +
    '</div>' +
    '<button class="ab" style="background:var(--red2);width:100%" id="img-del-btn">삭제</button>' +
    '</div>'
  );
  document.getElementById('img-memo-save').addEventListener('click', function() {
    im.memo = document.getElementById('img-memo-input').value.trim();
    saveData();
    closeModal();
    renderImagesTab();
    showToast('메모가 저장되었습니다');
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
