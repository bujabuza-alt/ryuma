// ── 매장 선택 흐름 ──
function showStore() {
  _pendingStore = null;
  document.getElementById('step-store').style.display = '';
  document.getElementById('step-pw').style.display    = 'none';
  document.getElementById('pw-input').value = '';
  document.getElementById('pw-err').textContent = '';
}
function doEnter(store) {
  currentStore = store;
  STORAGE_KEY  = 'tv5_' + store;
  if (fbRef) fbRef.off();
  fbRef = null;
  lastSavedTs = 0;  // 매장 전환 시 반드시 초기화
  clearTimeout(fbReconnectTimer); fbReconnectTimer = null;
  fbRef = fbDb.ref('tableApp/' + store);
  S = {tables:[],waits:[],ress:[],tags:[],daily:[],customers:[],inventory:[],stockCats:[],stockUnits:[],images:[],staffPw:'',staffActive:[],staffResigned:[],staffLogs:[]};
  cardCache = {};
  stockTab = '전체'; stockChip = 'all'; stockSearch = ''; stockSort = 'name';
  stockOrderMode = false; stockSelectedIds = [];
  imgSearch = '';
  staffUnlocked = false; staffSubTab = 'active'; staffShiftSel = {}; staffTimeSel = {};
  document.getElementById('cvi').innerHTML = '';
  editMode = false;
  floorDate = today();
  calY = new Date().getFullYear();
  calM = new Date().getMonth();
  calSel = null;

  document.getElementById('hd-store').textContent = STORE_NAMES[store];
  document.getElementById('bedit').textContent = '✏️';
  document.getElementById('bedit').classList.remove('on');
  document.getElementById('sel').style.display  = 'none';
  document.getElementById('wrap').style.display = '';
  try { localStorage.setItem('ryuma_auth', JSON.stringify({store:store})); } catch(e) {}

  // 로딩 표시
  showBadge('saving');
  document.getElementById('badge').textContent = '불러오는 중…';

  // ── 새 경로(tableApp/store) 확인 후 비어있으면 구버전(tableApp) 마이그레이션 ──
  fbRef.once('value').then(function(newSnap) {
    var newData = newSnap.val();

    // 이 기기의 로컬 캐시를 먼저 baseline으로 채워둔다. 아래 applyData()가
    // 방금 받아온 서버(Firebase)의 실제 값으로 다시 덮어써서, 이 기기의
    // 로컬 캐시가 오래됐거나 비어있어도(신규 기기 등) 서버 값이 항상 이기도록 한다.
    // (과거엔 applyData() 다음에 loadData()를 호출해 순서가 반대였고, 그 결과
    // 서버에 있던 최신 태그/데이터가 이 기기의 오래된 로컬 캐시로 되돌려써진 뒤
    // 저장 시 서버까지 덮어써버리는 데이터 유실 버그가 있었다.)
    loadData();

    function applyData(d) {
      if (!d) return;
      if (d.tables && d.tables.length) S.tables = d.tables;
      if (d.waits)  S.waits = d.waits;
      if (d.ress)   S.ress  = d.ress;
      if (d.daily)  S.daily = d.daily;
      if (d.tags && d.tags.length) S.tags = d.tags;
      if (Array.isArray(d.customers)) S.customers = d.customers;
      if (Array.isArray(d.inventory)) S.inventory = d.inventory;
      if (Array.isArray(d.stockCats) && d.stockCats.length) S.stockCats = d.stockCats;
      if (Array.isArray(d.stockUnits) && d.stockUnits.length) S.stockUnits = d.stockUnits;
      if (Array.isArray(d.images)) S.images = d.images;
      if (d.staffPw) S.staffPw = d.staffPw;
      if (Array.isArray(d.staffActive)) S.staffActive = d.staffActive;
      if (Array.isArray(d.staffResigned)) S.staffResigned = d.staffResigned;
      if (Array.isArray(d.staffLogs)) S.staffLogs = d.staffLogs;
    }

    function boot() {
      // ── localStorage 구버전 키(tv5)도 확인 ──
      try {
        var oldLocal = JSON.parse(localStorage.getItem('tv5') || 'null');
        if (oldLocal && oldLocal.tables && oldLocal.tables.length && !S.tables.length) {
          // localStorage 구버전 데이터 발견 → 적용 후 Firebase에 저장
          applyData(oldLocal);
          fbRef.set({
            tables: S.tables, waits: S.waits, ress: S.ress,
            tags: S.tags, daily: S.daily, _ts: Date.now()
          }).then(function() {
            localStorage.removeItem('tv5'); // 구버전 키 정리
            console.log('localStorage 마이그레이션 완료: tv5 → tv5_' + store);
          });
        }
      } catch(e) {}

      var init = store === 'covent' ? INIT_COVENT : INIT_PARAGON;
      if (!S.tables.length) S.tables = init.map(mkTable);
      if (!S.daily) S.daily = [];
      if (!S.tags || !S.tags.length) S.tags = DEFAULT_TAGS.slice();
      showBadge('');
      syncToday();
      // 진입 시 항상 홀 현황 탭으로 이동
      switchTab('floor');
      startFb();
    }

    if (newData && newData.tables && newData.tables.length) {
      // 새 경로(tableApp/store)에 데이터 있음 → 바로 사용
      applyData(newData);
      boot();
    } else {
      // 새 경로 비어있음 → Firebase 구버전(tableApp 루트) 확인
      fbDb.ref('tableApp').once('value').then(function(oldSnap) {
        var oldFb = oldSnap.val();
        // 구버전은 tables 배열이 tableApp 바로 아래에 있음
        if (oldFb && oldFb.tables && oldFb.tables.length) {
          applyData(oldFb);
          fbRef.set({
            tables: S.tables, waits: S.waits, ress: S.ress,
            tags: S.tags, daily: S.daily, _ts: Date.now()
          }).then(function() {
            console.log('Firebase 마이그레이션 완료: tableApp → tableApp/' + store);
          });
        }
        boot();
      }).catch(function() { boot(); });
    }
  }).catch(function() {
    loadData();
    var init = store === 'covent' ? INIT_COVENT : INIT_PARAGON;
    if (!S.tables.length) S.tables = init.map(mkTable);
    if (!S.daily) S.daily = [];
    if (!S.tags || !S.tags.length) S.tags = DEFAULT_TAGS.slice();
    showBadge('');
    syncToday(); switchTab('floor'); startFb();
  });
}
function logout() {
  if (fbRef) { fbRef.off(); fbRef = null; }
  currentStore = null;
  S = {tables:[],waits:[],ress:[],tags:[],daily:[],customers:[],inventory:[],stockCats:[],stockUnits:[],images:[],staffPw:'',staffActive:[],staffResigned:[],staffLogs:[]};
  cardCache = {};
  editMode = false;
  staffUnlocked = false; staffSubTab = 'active'; staffShiftSel = {}; staffTimeSel = {};
  try { localStorage.removeItem('ryuma_auth'); } catch(e) {}
  document.getElementById('cvi').innerHTML = '';
  document.getElementById('wrap').style.display = 'none';
  document.getElementById('sel').style.display  = '';
  showStore();
}

// ── 설정 ──
function openCfg() {
  showModal(
    '<div class="md-hd"><span class="md-title">⚙ 전체 설정</span><button class="md-x" id="mxbtn">×</button></div>' +
    '<div class="mb">' +
    '<div class="ss-label">알바 출퇴근 비밀번호</div>' +
    '<div style="font-size:11px;color:var(--text2);margin-bottom:8px">"알바 출퇴근 기록" 탭 접근 비밀번호를 변경합니다</div>' +
    '<button class="ab" style="background:var(--amber);width:100%" id="btn-staff-pw">🔑 비밀번호 변경</button>' +
    '<div class="divider"></div>' +
    '<div class="ss-label">노션 백업</div>' +
    '<div style="font-size:11px;color:var(--text2);margin-bottom:8px">예약·손님 데이터를 노션에 저장합니다</div>' +
    '<div style="display:flex;gap:7px">' +
    '<button class="ab" style="background:#2e2e2e;flex:1;display:flex;align-items:center;justify-content:center;gap:5px" id="btn-backup">📋 예약 백업</button>' +
    '<button class="ab" style="background:#2e2e2e;flex:1;display:flex;align-items:center;justify-content:center;gap:5px" id="btn-cust-backup">👤 손님 백업</button>' +
    '</div>' +
    '<div id="backup-status" style="font-size:11px;text-align:center;min-height:16px;margin-top:4px"></div>' +
    '<div class="divider"></div>' +
    '<div class="ss-label">Gemini API (네이버 예약 가져오기)</div>' +
    '<div style="font-size:11px;color:var(--text2);margin-bottom:8px">스크린샷으로 예약 정보를 자동 파싱합니다 (무료)</div>' +
    '<button class="ab" style="background:var(--indigo);width:100%" id="btn-gemini-key">🔑 API 키 ' + (localStorage.getItem('ryuma_gemini_key') ? '변경' : '설정') + '</button>' +
    '<div id="gemini-key-status" style="font-size:11px;text-align:center;min-height:14px;margin-top:4px;color:var(--green)">' + (localStorage.getItem('ryuma_gemini_key') ? '✓ 설정됨' : '') +
    '</div>' +
    '<div class="divider"></div>' +
    '<button class="ab" style="background:var(--surf3);color:var(--text2);width:100%" id="btn-out">← 매장 선택으로</button>' +
    '</div>'
  );
  document.getElementById('btn-backup').addEventListener('click', function() {
    runNotionBackup();
  });
  document.getElementById('btn-cust-backup').addEventListener('click', function() {
    runNotionCustBackup('backup-status');
  });
  document.getElementById('btn-gemini-key').addEventListener('click', function() {
    closeModal(); setTimeout(openGeminiKeyInput, 150);
  });
  document.getElementById('btn-staff-pw').addEventListener('click', function() {
    closeModal(); setTimeout(openStaffPwChange, 150);
  });
  document.getElementById('btn-out').addEventListener('click', function() {
    closeModal(); setTimeout(logout, 150);
  });
}
