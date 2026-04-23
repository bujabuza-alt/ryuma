// ── Firebase ──
var isSyncingFromRemote = false; // prevent listener→syncToday→saveData feedback loop
function loadData() {
  try {
    var d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (Array.isArray(d.tables)) S.tables = d.tables;
    if (Array.isArray(d.waits))  S.waits = d.waits;
    if (Array.isArray(d.ress))   S.ress  = d.ress;
    if (Array.isArray(d.daily))  S.daily = d.daily;
    if (Array.isArray(d.customers)) S.customers = d.customers;
    if (Array.isArray(d.inventory)) S.inventory = d.inventory;
    if (Array.isArray(d.stockCats)) S.stockCats = d.stockCats;
    if (Array.isArray(d.stockUnits)) S.stockUnits = d.stockUnits;
    S.tags = (d.tags && d.tags.length) ? d.tags : DEFAULT_TAGS.slice();
    if (!S.stockCats.length) S.stockCats = DEFAULT_STOCK_CATS.slice();
    if (!S.stockUnits.length) S.stockUnits = DEFAULT_STOCK_UNITS.slice();
    if (!S.inventory.length) S.inventory = DEFAULT_INVENTORY.slice();
  } catch(e) { S.tags = DEFAULT_TAGS.slice(); }
}
function saveData() {
  clearTimeout(saveTimer);
  showBadge('saving');
  saveTimer = setTimeout(function() {
    var ts = Date.now(); lastSavedTs = ts;

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
      _ts: ts
    };
    
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
      fbRef.set(p)
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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(e) {}
    S.tables.forEach(function(t){ cardCache[t.id]=''; });
    isSyncingFromRemote = true;
    syncToday(); renderAll();
    isSyncingFromRemote = false;
    if (currentTab === 'reserve') renderReservations();
    if (currentTab === 'stock') renderStock();
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

