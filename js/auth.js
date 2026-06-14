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
  S = {tables:[],waits:[],ress:[],tags:[],daily:[],customers:[],inventory:[],stockCats:[],stockUnits:[]};
  cardCache = {};
  stockTab = '전체'; stockChip = 'all'; stockSearch = ''; stockSort = 'name';
  stockOrderMode = false; stockSelectedIds = [];
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

  // 로딩 표시
  showBadge('saving');
  document.getElementById('badge').textContent = '불러오는 중…';

  // ── 새 경로(tableApp/store) 확인 후 비어있으면 구버전(tableApp) 마이그레이션 ──
  fbRef.once('value').then(function(newSnap) {
    var newData = newSnap.val();

    function applyData(d) {
      if (d && d.tables && d.tables.length) S.tables = d.tables;
      if (d && d.waits)  S.waits = d.waits;
      if (d && d.ress)   S.ress  = d.ress;
      if (d && d.daily)  S.daily = d.daily;
      if (d && d.tags && d.tags.length) S.tags = d.tags;
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

      // 새 키로 저장된 localStorage도 병합
      loadData();
      var init = store === 'covent' ? INIT_COVENT : INIT_PARAGON;
      if (!S.tables.length) S.tables = init.map(mkTable);
      if (!S.daily) S.daily = [];
      if (!S.tags || !S.tags.length) S.tags = DEFAULT_TAGS.slice();
      showBadge('');
      syncToday();
      renderAll();
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
    syncToday(); renderAll(); startFb();
  });
}
function logout() {
  if (fbRef) { fbRef.off(); fbRef = null; }
  currentStore = null;
  S = {tables:[],waits:[],ress:[],tags:[],daily:[],customers:[],inventory:[],stockCats:[],stockUnits:[]};
  cardCache = {};
  editMode = false;
  try { localStorage.removeItem('ryuma_auth'); } catch(e) {}
  document.getElementById('cvi').innerHTML = '';
  document.getElementById('wrap').style.display = 'none';
  document.getElementById('sel').style.display  = '';
  showStore();
}

// ── 설정 ──
function openCfg() {
  showModal(
    '<div class="md-hd"><span class="md-title">⚙ 설정</span><button class="md-x" id="mxbtn">×</button></div>' +
    '<div class="mb">' +
    '<div class="ss-label">비밀번호 변경</div>' +
    '<div class="fg"><label class="fl">현재 비밀번호</label><input class="fi" id="pw-cur" type="password" autocomplete="current-password"></div>' +
    '<div class="fg"><label class="fl">새 비밀번호 (4자 이상)</label><input class="fi" id="pw-new" type="password" autocomplete="new-password"></div>' +
    '<button class="ab" style="background:var(--indigo);width:100%" id="pw-chg">변경하기</button>' +
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
  document.getElementById('pw-chg').addEventListener('click', function() {
    var cur = document.getElementById('pw-cur').value;
    var nw  = document.getElementById('pw-new').value;
    if (!cur || !nw) { alert('비밀번호를 입력하세요'); return; }
    if (nw.length < 4) { alert('4자 이상 입력하세요'); return; }
    fbDb.ref('tableApp/config/' + currentStore + 'Pw').once('value', function(snap) {
      var stored = snap.val() || DEFAULT_PW[currentStore];
      if (cur !== stored) { alert('현재 비밀번호가 틀렸습니다'); return; }
      fbDb.ref('tableApp/config/' + currentStore + 'Pw').set(nw)
        .then(function() { alert('✅ 비밀번호 변경 완료'); closeModal(); })
        .catch(function() { alert('저장 실패'); });
    });
  });
  document.getElementById('btn-backup').addEventListener('click', function() {
    runNotionBackup();
  });
  document.getElementById('btn-cust-backup').addEventListener('click', function() {
    runNotionCustBackup('backup-status');
  });
  document.getElementById('btn-gemini-key').addEventListener('click', function() {
    closeModal(); setTimeout(openGeminiKeyInput, 150);
  });
  document.getElementById('btn-out').addEventListener('click', function() {
    closeModal(); setTimeout(logout, 150);
  });
}
