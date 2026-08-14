// ── Firebase ──
var isSyncingFromRemote = false; // prevent listener→syncToday→saveData feedback loop
var saveErrorModalOpen = false;
var pendingSaveAfterReconnect = false;

// ── Firebase 실시간 연결 상태 추적 ──
// navigator.onLine은 OS 네트워크 인터페이스 상태만 알려줄 뿐, 와이파이는 켜져 있는데
// 화면 꺼짐/절전모드/네트워크 전환 등으로 Firebase 웹소켓만 조용히 끊기는 경우를 잡지 못한다.
// 공식 특수 경로(.info/connected)를 구독해 "진짜" 연결 상태를 추적한다.
var fbConnected = true;
(function startFbConnMonitor() {
  if (typeof fbDb === 'undefined' || !fbDb) return;
  fbDb.ref('.info/connected').on('value', function(snap) {
    var was = fbConnected;
    fbConnected = snap.val() === true;
    // 끊겼다가 복구된 순간, 직전 저장이 실패해 대기 중이었다면 자동으로 재시도
    if (!was && fbConnected && (saveErrorModalOpen || pendingSaveAfterReconnect)) {
      pendingSaveAfterReconnect = false;
      closeSaveErrorModal();
      saveData();
    }
  });
})();

// ── REST API 폴백 저장 ──
// Firebase JS SDK는 지속적인 웹소켓 연결이 있어야 저장이 성공한다. 매장 네트워크(공유기/
// 방화벽)가 일반 HTTPS 요청은 허용하면서 이런 장시간 연결만 막거나 불안정하게 만드는
// 경우가 흔한데, 이때는 페이지·이미지 등은 정상적으로 로딩되면서 저장(웹소켓 필요)만
// 계속 실패하는 것처럼 보인다. 이 앱은 Firebase Auth를 쓰지 않으므로(보안 규칙이 인증
// 없이 열려 있음), 단순 HTTPS PATCH 요청인 REST API로도 SDK와 동일하게 저장할 수 있다.
function restSaveFallback(payload) {
  var base = (fbApp && fbApp.options && fbApp.options.databaseURL) || '';
  if (!base || !currentStore) return Promise.reject(new Error('REST fallback: no db url/store'));
  var url = base + '/tableApp/' + currentStore + '.json';
  return fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function(res) {
    if (!res.ok) throw new Error('REST PATCH failed: ' + res.status);
    return res.json();
  });
}

// ── 저장 실패 팝업 ──
function getSaveErrorInfo(code, message) {
  if (code === 'PERMISSION_DENIED') {
    return {
      reason: '이 매장 계정에 저장 권한이 없습니다 (Firebase 보안 규칙에 의해 차단됨).',
      fix: '① 로그아웃 후 다시 로그인해보세요.<br>② 계속되면 관리자에게 문의해 계정 권한 또는 Firebase 보안 규칙을 확인해달라고 요청하세요.'
    };
  }
  if (code === 'OFFLINE' || code === 'TIMEOUT' || !fbConnected) {
    return {
      reason: '서버와의 실시간 연결이 끊긴 상태입니다. Wi-Fi가 켜져 있어도 화면 꺼짐·절전모드·네트워크 전환 등으로 끊길 수 있습니다.',
      fix: '연결이 복구되면 자동으로 다시 저장을 시도합니다. 계속되면 Wi-Fi를 껐다 켜거나 앱을 새로고침해주세요.'
    };
  }
  return {
    reason: '알 수 없는 오류로 저장에 실패했습니다.' + (message ? ' (' + esc(message) + ')' : ''),
    fix: '잠시 후 "다시 시도"를 눌러주세요. 계속 실패하면 앱을 새로고침하거나 관리자에게 문의하세요.'
  };
}
function showSaveErrorModal(code, message) {
  if (saveErrorModalOpen) return;
  var mo2 = document.getElementById('mo2'), mdc2 = document.getElementById('mdc2');
  if (!mo2 || !mdc2) return;
  var info = getSaveErrorInfo(code, message);
  saveErrorModalOpen = true;
  mdc2.innerHTML =
    '<div class="md-hd"><span class="md-title">⚠ 저장 실패</span><button class="md-x" id="se-x">×</button></div>' +
    '<div class="mb">' +
    '<div style="font-size:13px;color:var(--text);line-height:1.6"><b>원인</b><br>' + esc(info.reason) + '</div>' +
    '<div style="font-size:13px;color:var(--text);line-height:1.6"><b>해결 방법</b><br>' + info.fix + '</div>' +
    '<div style="font-size:12px;color:var(--text2);background:var(--surf3);border-radius:8px;padding:8px 10px;line-height:1.5">💾 입력하신 내용은 이 기기에 임시 저장되어 사라지지 않습니다. 저장에 성공하면 자동으로 동기화됩니다.</div>' +
    '<div style="display:flex;gap:7px">' +
    '<button class="ab" style="background:var(--surf3);color:var(--text2);flex:1" id="se-close">닫기</button>' +
    '<button class="ab" style="background:var(--indigo);flex:1" id="se-retry">다시 시도</button>' +
    '</div>' +
    '</div>';
  mo2.classList.add('on');
  document.getElementById('se-x').addEventListener('click', closeSaveErrorModal);
  document.getElementById('se-close').addEventListener('click', closeSaveErrorModal);
  document.getElementById('se-retry').addEventListener('click', function() { closeSaveErrorModal(); saveData(); });
}
function closeSaveErrorModal() {
  if (!saveErrorModalOpen) return;
  var mo2 = document.getElementById('mo2'), mdc2 = document.getElementById('mdc2');
  if (mo2) mo2.classList.remove('on');
  if (mdc2) mdc2.innerHTML = '';
  saveErrorModalOpen = false;
}
function loadData() {
  try {
    var d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    // 재로드 후 Firebase 리스너가 구버전 데이터로 로컬을 덮어쓰는 것을 방지하기 위해
    // localStorage에 저장된 마지막 타임스탬프를 복원한다.
    if (d._ts) lastSavedTs = d._ts;
    if (Array.isArray(d.tables)) S.tables = d.tables;
    if (Array.isArray(d.waits))  S.waits = d.waits;
    if (Array.isArray(d.ress))   S.ress  = d.ress;
    if (Array.isArray(d.daily))  S.daily = d.daily;
    if (Array.isArray(d.customers)) S.customers = d.customers;
    if (Array.isArray(d.inventory)) S.inventory = d.inventory;
    if (Array.isArray(d.stockCats)) S.stockCats = d.stockCats;
    if (Array.isArray(d.stockUnits)) S.stockUnits = d.stockUnits;
    if (Array.isArray(d.images)) S.images = d.images;
    if (Array.isArray(d.staffActive)) S.staffActive = d.staffActive;
    if (Array.isArray(d.staffResigned)) S.staffResigned = d.staffResigned;
    if (Array.isArray(d.staffLogs)) S.staffLogs = d.staffLogs;
    if (Array.isArray(d.staffRecords)) S.staffRecords = d.staffRecords;
    if (Array.isArray(d.staffFavTimes)) S.staffFavTimes = d.staffFavTimes;
    if (d._staffLogsMigrated) S._staffLogsMigrated = d._staffLogsMigrated;
    S.staffPw = d.staffPw || DEFAULT_STAFF_PW;
    S.tags = (d.tags && d.tags.length) ? d.tags : DEFAULT_TAGS.slice();
    if (!S.stockCats.length) S.stockCats = DEFAULT_STOCK_CATS.slice();
    if (!S.stockUnits.length) S.stockUnits = DEFAULT_STOCK_UNITS.slice();
    if (!S.inventory.length) S.inventory = DEFAULT_INVENTORY.slice();
    if (!S.images) S.images = [];
    if (!S.staffActive) S.staffActive = [];
    if (!S.staffResigned) S.staffResigned = [];
    if (!S.staffLogs) S.staffLogs = [];
    if (!S.staffRecords) S.staffRecords = [];
    if (!S.staffFavTimes) S.staffFavTimes = [];
  } catch(e) { S.tags = DEFAULT_TAGS.slice(); S.staffPw = S.staffPw || DEFAULT_STAFF_PW; }
}

// ── 데이터 백업(파일로 내보내기/가져오기) ──
// Firebase 마이그레이션 버그 등으로 원격 데이터가 유실되는 사고에 대비해,
// 매장의 전체 데이터를 사용자가 직접 파일로 내려받아 보관하고 필요 시 복원할 수 있게 한다.
function getConfirmItemsForBackup() {
  try {
    var raw = localStorage.getItem('confirm_items_v1_' + (currentStore || ''));
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}
function exportBackupToFile() {
  var payload = {
    _backupType: 'ryuma_backup',
    _backupVersion: 1,
    _exportedAt: new Date().toISOString(),
    store: currentStore,
    tables: S.tables || [],
    waits: S.waits || [],
    ress: S.ress || [],
    tags: S.tags || [],
    daily: S.daily || [],
    customers: S.customers || [],
    inventory: S.inventory || [],
    stockCats: S.stockCats || [],
    stockUnits: S.stockUnits || [],
    images: S.images || [],
    staffPw: S.staffPw || DEFAULT_STAFF_PW,
    staffActive: S.staffActive || [],
    staffResigned: S.staffResigned || [],
    staffLogs: S.staffLogs || [],
    staffRecords: S.staffRecords || [],
    staffFavTimes: S.staffFavTimes || [],
    confirmItems: getConfirmItemsForBackup()
  };
  var json = JSON.stringify(payload, null, 2);
  var blob = new Blob([json], {type:'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'ryuma_backup_' + (currentStore || 'store') + '_' + today() + '.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}
function importBackupFromFile(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var data;
    try { data = JSON.parse(e.target.result); } catch(err) {
      alert('올바른 백업 파일이 아닙니다 (JSON 형식이 아님).');
      return;
    }
    if (!data || typeof data !== 'object' || !Array.isArray(data.tables)) {
      alert('올바른 백업 파일이 아닙니다.');
      return;
    }
    if (!confirm('백업 파일을 불러오면 현재 매장(' + (STORE_NAMES[currentStore]||currentStore) + ')의 데이터가 파일 내용으로 덮어씌워집니다.\n계속하시겠습니까?')) return;

    if (Array.isArray(data.tables)) S.tables = data.tables;
    if (Array.isArray(data.waits)) S.waits = data.waits;
    if (Array.isArray(data.ress)) S.ress = data.ress;
    if (Array.isArray(data.tags) && data.tags.length) S.tags = data.tags;
    if (Array.isArray(data.daily)) S.daily = data.daily;
    if (Array.isArray(data.customers)) S.customers = data.customers;
    if (Array.isArray(data.inventory)) S.inventory = data.inventory;
    if (Array.isArray(data.stockCats) && data.stockCats.length) S.stockCats = data.stockCats;
    if (Array.isArray(data.stockUnits) && data.stockUnits.length) S.stockUnits = data.stockUnits;
    if (Array.isArray(data.images)) S.images = data.images;
    if (data.staffPw) S.staffPw = data.staffPw;
    if (Array.isArray(data.staffActive)) S.staffActive = data.staffActive;
    if (Array.isArray(data.staffResigned)) S.staffResigned = data.staffResigned;
    if (Array.isArray(data.staffLogs)) S.staffLogs = data.staffLogs;
    if (Array.isArray(data.staffRecords)) S.staffRecords = data.staffRecords;
    if (Array.isArray(data.staffFavTimes)) S.staffFavTimes = data.staffFavTimes;

    if (data.confirmItems && data.confirmItems.cats && data.confirmItems.cats.length) {
      try { localStorage.setItem('confirm_items_v1_' + (currentStore||''), JSON.stringify(data.confirmItems)); } catch(err) {}
      if (typeof renderConfirmItems === 'function') renderConfirmItems();
    }

    S.tables.forEach(function(t){ cardCache[t.id]=''; });
    saveData();
    closeModal();
    if (currentTab === 'floor') renderAll();
    else if (currentTab === 'cust') renderCustTab();
    else if (currentTab === 'stock') renderStock();
    else if (currentTab === 'images') renderImagesTab();
    else if (currentTab === 'staff' && staffUnlocked) renderStaffTab();
    showToast('백업 파일에서 데이터를 불러왔습니다');
  };
  reader.onerror = function() { alert('파일을 읽는 중 오류가 발생했습니다.'); };
  reader.readAsText(file);
}
var saveDirty = false; // saveData() 예약(디바운스 대기) 중이면 true — flushPendingSave가 참조
function saveData() {
  saveDirty = true;
  clearTimeout(saveTimer);
  showBadge('saving');
  saveTimer = setTimeout(doActualSave, 400);
}
// 탭/앱이 백그라운드로 전환되기 직전에 즉시 호출해, 아직 실행되지 않은 디바운스 저장을
// 그대로 날려버리지 않고 바로 실행한다. 모바일에서는 화면이 꺼지거나 다른 앱으로
// 전환되면 400ms 타이머가 지연되거나 아예 실행되지 않을 수 있어(백그라운드 탭 스로틀링),
// "편집 직후 바로 앱을 전환/종료"하는 흔한 사용 패턴에서 조용히 저장이 누락되는 원인이 된다.
function flushPendingSave() {
  if (!saveDirty) return;
  clearTimeout(saveTimer);
  doActualSave();
}
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden') flushPendingSave();
});
window.addEventListener('pagehide', flushPendingSave);
function doActualSave() {
    saveDirty = false;
    var ts = Date.now(); lastSavedTs = ts;

    // 이 기기에 아직 로컬로 내려받은 확인사항이 없으면(신규 기기, 캐시 삭제 직후 등)
    // 원격 데이터를 빈 값으로 덮어써 지워버리지 않도록 payload에서 아예 제외한다.
    var ci = null;
    try {
      var ciRaw = localStorage.getItem('confirm_items_v1_' + (currentStore||''));
      if (ciRaw) ci = JSON.parse(ciRaw);
    } catch(e) { ci = null; }
    var hasConfirmItems = !!(ci && ci.cats && ci.cats.length);

    var p = {
      tables: S.tables,
      waits: S.waits,
      ress: S.ress,
      tags: S.tags,
      daily: S.daily,
      customers: S.customers || [],
      inventory: S.inventory || [],
      stockCats: S.stockCats || [],
      stockUnits: S.stockUnits || [],
      images: S.images || [],
      staffPw: S.staffPw || DEFAULT_STAFF_PW,
      staffActive: S.staffActive || [],
      staffResigned: S.staffResigned || [],
      staffLogs: S.staffLogs || [],
      staffRecords: S.staffRecords || [],
      staffFavTimes: S.staffFavTimes || [],
      _ts: ts
    };
    if (S._staffLogsMigrated) p._staffLogsMigrated = S._staffLogsMigrated;
    if (hasConfirmItems) p.confirmItems = ci;

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch(e) {}
    // 로컬 저장은 항상 수행하고, Firebase 연결이 있을 때만 원격 동기화
    if (!fbRef) {
      showBadge('saved');
      setTimeout(function(){ showBadge(''); }, 2000);
      return;
    }
    // 주의: fbConnected(.info/connected)는 매장 네트워크(웹소켓 불안정 등) 상황에 따라
    // 실제로는 쓰기가 가능한데도 false로 잘못 보고될 수 있다. 그래서 이 값만으로 저장을
    // 사전에 차단하지 않고, 항상 실제 쓰기를 시도한 뒤 그 결과(성공/실패/타임아웃)로
    // 판단한다. fbConnected는 재연결 시 자동 재시도(startFbConnMonitor) 용도로만 쓴다.
    var retries = 0;
    var settled = false; // SDK 성공/REST 폴백 성공/최종 실패 중 하나로 이미 마무리됐는지
    function onSaveSucceeded() {
      if (settled) return;
      settled = true;
      clearTimeout(fbSaveTimeout);
      showBadge('saved'); setTimeout(function(){ showBadge(''); }, 2000);
      closeSaveErrorModal();
    }
    function onSaveFailed(code, message) {
      if (settled) return;
      settled = true;
      clearTimeout(fbSaveTimeout);
      showBadge('err');
      setTimeout(function(){ showBadge(''); }, 8000);
      if (code !== 'PERMISSION_DENIED') pendingSaveAfterReconnect = true;
      showSaveErrorModal(code, message);
    }
    // SDK 쓰기가 30초 넘도록 응답이 없을 때(웹소켓이 조용히 막혀 있는 매장 네트워크 등):
    // 포기하기 전에 일반 HTTPS REST 방식으로 한 번 더 시도해본다.
    var fbSaveTimeout = setTimeout(function() {
      restSaveFallback(p).then(onSaveSucceeded).catch(function(restErr) {
        console.error('Firebase REST save fallback failed:', restErr);
        onSaveFailed('TIMEOUT', null);
      });
    }, 30000);
    function tryWrite() {
      // set() 대신 update()를 사용해, 이번 저장에 포함되지 않은 필드(예: 위에서 제외한
      // confirmItems)는 원격에 남아있는 값을 그대로 보존한다.
      fbRef.update(p)
        .then(onSaveSucceeded)
        .catch(function(err) {
          var code = (err && err.code) || '';
          // PERMISSION_DENIED는 재시도해도 해결되지 않음
          if (code === 'PERMISSION_DENIED') {
            console.error('Firebase save failed [' + code + ']:', err && err.message);
            console.warn('Firebase 보안 규칙을 확인하세요 — Firebase 콘솔 > Realtime Database > 규칙');
            onSaveFailed(code, err && err.message);
          } else if (retries >= 2) {
            // SDK(웹소켓) 경로가 계속 실패 — 매장 네트워크가 웹소켓만 막고 일반 HTTPS는
            // 허용하는 경우일 수 있으므로 REST API로 마지막 시도
            console.error('Firebase SDK save failed [' + code + '], REST 폴백 시도:', err && err.message);
            restSaveFallback(p).then(onSaveSucceeded).catch(function(restErr) {
              console.error('Firebase REST save fallback also failed:', restErr);
              onSaveFailed(code, err && err.message);
            });
          } else {
            retries++;
            setTimeout(tryWrite, retries * 3000);
          }
        });
    }
    tryWrite();
}
var fbReconnectTimer = null;
function startFb() {
  if (!fbRef) return;
  fbRef.off();
  var listenStore = currentStore; // 이 리스너가 등록된 매장 기억
  fbRef.on('value', function(snap) {
    clearTimeout(fbReconnectTimer);
    var d = snap.val();
    if (!d) return;
    if (!S) return;
    if (listenStore !== currentStore) return; // 매장 바뀌었으면 무시
    if (d._ts && d._ts === lastSavedTs) return;
    if (d._ts && lastSavedTs && d._ts < lastSavedTs - 1000) return;
    if (d.tables && d.tables.length) S.tables = d.tables;
    if (d.waits)  S.waits = d.waits;
    if (d.ress)   S.ress  = d.ress;
    if (d.daily)  S.daily = d.daily;
    if (d.customers) S.customers = d.customers;
    if (d.tags && d.tags.length) S.tags = d.tags;
    if (Array.isArray(d.inventory)) S.inventory = d.inventory;
    if (Array.isArray(d.stockCats) && d.stockCats.length) S.stockCats = d.stockCats;
    if (Array.isArray(d.stockUnits) && d.stockUnits.length) S.stockUnits = d.stockUnits;
    if (Array.isArray(d.images)) S.images = d.images;
    if (Array.isArray(d.staffActive)) S.staffActive = d.staffActive;
    if (Array.isArray(d.staffResigned)) S.staffResigned = d.staffResigned;
    if (Array.isArray(d.staffLogs)) S.staffLogs = d.staffLogs;
    if (Array.isArray(d.staffRecords)) S.staffRecords = d.staffRecords;
    if (Array.isArray(d.staffFavTimes)) S.staffFavTimes = d.staffFavTimes;
    if (d._staffLogsMigrated) S._staffLogsMigrated = d._staffLogsMigrated;
    if (d.staffPw) S.staffPw = d.staffPw;
    if (d.confirmItems && d.confirmItems.cats && d.confirmItems.cats.length) {
      try { localStorage.setItem('confirm_items_v1_' + (currentStore||''), JSON.stringify(d.confirmItems)); } catch(e) {}
      if (typeof renderConfirmItems === 'function') renderConfirmItems();
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(e) {}
    S.tables.forEach(function(t){ cardCache[t.id]=''; });
    isSyncingFromRemote = true;
    syncToday(); renderAll();
    isSyncingFromRemote = false;
    if (currentTab === 'stock') renderStock();
    if (currentTab === 'images') renderImagesTab();
    if (currentTab === 'staff' && staffUnlocked) renderStaffTab();
  }, function(err) {
    var code = (err && err.code) || '';
    showBadge('err');
    setTimeout(function(){ showBadge(''); }, 8000);
    console.error('Firebase listener error:', code, err && err.message);
    // PERMISSION_DENIED는 재시도해도 해결되지 않으므로 루프를 멈춤
    if (code === 'PERMISSION_DENIED') {
      console.warn('Firebase: 쓰기 권한 없음 — Firebase 콘솔에서 보안 규칙을 확인하세요.');
      return;
    }
    clearTimeout(fbReconnectTimer);
    fbReconnectTimer = setTimeout(function() {
      if (currentStore === listenStore) startFb();
    }, 10000);
  });
}
function showBadge(s) {
  var el = document.getElementById('badge');
  if (!el) return; // 추가 (핵심)

  el.style.color = ({saving:'#c8922a',saved:'#2a9a5a',err:'var(--red2)'})[s] || 'transparent';
  el.textContent  = ({saving:'저장 중…',saved:'✓ 저장됨',err:'⚠ 실패'})[s] || '';
}

