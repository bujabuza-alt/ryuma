// ── Firebase ──
var isSyncingFromRemote = false; // prevent listener→syncToday→saveData feedback loop
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
    S.staffPw = d.staffPw || DEFAULT_STAFF_PW;
    S.tags = (d.tags && d.tags.length) ? d.tags : DEFAULT_TAGS.slice();
    if (!S.stockCats.length) S.stockCats = DEFAULT_STOCK_CATS.slice();
    if (!S.stockUnits.length) S.stockUnits = DEFAULT_STOCK_UNITS.slice();
    if (!S.inventory.length) S.inventory = DEFAULT_INVENTORY.slice();
    if (!S.images) S.images = [];
    if (!S.staffActive) S.staffActive = [];
    if (!S.staffResigned) S.staffResigned = [];
    if (!S.staffLogs) S.staffLogs = [];
  } catch(e) { S.tags = DEFAULT_TAGS.slice(); S.staffPw = S.staffPw || DEFAULT_STAFF_PW; }
}
function saveData() {
  clearTimeout(saveTimer);
  showBadge('saving');
  saveTimer = setTimeout(function saveDataTick() {
    // 로그인 직후 서버 데이터가 아직 다 반영되기 전(NFC/단축어 자동화처럼
    // 아주 빠르게 조작되는 경우 포함)에는 저장을 미루고, 데이터가 준비되면
    // 그때 실제 최신 상태로 저장한다. 사용자가 입력한 내용은 S에 이미
    // 반영되어 있으므로 유실되지 않고, 준비되지 않은 빈 상태가 서버를
    // 덮어쓰는 것만 막는다.
    if (!dataReady) { saveTimer = setTimeout(saveDataTick, 200); return; }
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
      _ts: ts
    };
    if (hasConfirmItems) p.confirmItems = ci;

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch(e) {}
    // 로컬 저장은 항상 수행하고, Firebase 연결이 있을 때만 원격 동기화
    if (!fbRef) {
      showBadge('saved');
      setTimeout(function(){ showBadge(''); }, 2000);
      return;
    }
    var retries = 0;
    var fbSaveTimeout = setTimeout(function() { showBadge('err'); setTimeout(function(){ showBadge(''); }, 8000); }, 30000);
    function tryWrite() {
      // set() 대신 update()를 사용해, 이번 저장에 포함되지 않은 필드(예: 위에서 제외한
      // confirmItems)는 원격에 남아있는 값을 그대로 보존한다.
      fbRef.update(p)
        .then(function() { clearTimeout(fbSaveTimeout); showBadge('saved'); setTimeout(function(){ showBadge(''); }, 2000); })
        .catch(function(err) {
          var code = (err && err.code) || '';
          // PERMISSION_DENIED는 재시도해도 해결되지 않음
          if (code === 'PERMISSION_DENIED' || retries >= 2) {
            clearTimeout(fbSaveTimeout);
            showBadge('err');
            setTimeout(function(){ showBadge(''); }, 8000);
            console.error('Firebase save failed [' + code + ']:', err && err.message);
            if (code === 'PERMISSION_DENIED') {
              console.warn('Firebase 보안 규칙을 확인하세요 — Firebase 콘솔 > Realtime Database > 규칙');
            }
          } else {
            retries++;
            setTimeout(tryWrite, retries * 3000);
          }
        });
    }
    tryWrite();
  }, 400);
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
    if (currentTab === 'reserve') renderReservations();
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

