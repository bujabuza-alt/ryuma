// ── 초기화 및 이벤트 바인딩 (Initialization & Event Binding) ──

// ── 이벤트 바인딩 ──
document.getElementById('btn-covent').addEventListener('click', function(){ doEnter('covent'); });
document.getElementById('btn-paragon').addEventListener('click', function(){ doEnter('paragon'); });
document.getElementById('t1').addEventListener('click', function(){ switchTab('floor'); });
document.getElementById('t2').addEventListener('click', function(){ switchTab('reserve'); });
document.getElementById('t3').addEventListener('click', function(){ switchTab('cust'); });
document.getElementById('t4').addEventListener('click', function(){ switchTab('stock'); });
document.getElementById('custsrch').addEventListener('input', renderCustTab);
document.getElementById('custsort').addEventListener('change', renderCustTab);
// Customer tab filter pills (손님 / 취소)
document.getElementById('cust-filter-row').addEventListener('click', function(e) {
  var pill = e.target;
  if (!pill || !pill.getAttribute('data-f')) return;
  custFilterMode = pill.getAttribute('data-f');
  document.querySelectorAll('.cust-fpill').forEach(function(p){ p.classList.remove('on'); });
  pill.classList.add('on');
  renderCustTab();
});
document.getElementById('btn-cust-notion').addEventListener('click', function(){ runNotionCustBackup(); });
document.getElementById('btn-view').addEventListener('click', toggleView);
document.getElementById('bedit').addEventListener('click', toggleEdit);
document.getElementById('schcal-p').addEventListener('click', function() {
  schedCalMonth--;
  if (schedCalMonth < 0) { schedCalMonth = 11; schedCalYear--; }
  renderSchedView();
});
document.getElementById('schcal-n').addEventListener('click', function() {
  schedCalMonth++;
  if (schedCalMonth > 11) { schedCalMonth = 0; schedCalYear++; }
  renderSchedView();
});
document.getElementById('bschcaltoday').addEventListener('click', function() {
  var now = new Date();
  schedCalYear = now.getFullYear();
  schedCalMonth = now.getMonth();
  schedSelDate = today();
  renderSchedView();
});
document.getElementById('schcal-date-close').addEventListener('click', function() {
  schedSelDate = null;
  var panel = document.getElementById('schcal-date-panel');
  if (panel) panel.classList.remove('open');
  var gEl = document.getElementById('schcal-g');
  if (gEl) gEl.querySelectorAll('[data-date]').forEach(function(e){ e.classList.remove('sel'); });
});
document.getElementById('schv-btn-rv-menu').addEventListener('click', function() {
  openRvActionMenu();
});
document.getElementById('baddRv').addEventListener('click', openAddRv);
document.getElementById('bNaverImport').addEventListener('click', openNaverImport);

// ── 마감 체크리스트 (3분류 슬라이드) ──
(function() {
  var STORE_KEY = 'checklist_v2';
  var CATS = [
    { key: 'closing', label: '마감 체크' },
    { key: 'task',    label: '업무 체크' },
    { key: 'etc',     label: '기타 체크' }
  ];

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch(e) { return {}; }
  }

  function save(data) {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    if (typeof saveData === 'function' && typeof fbRef !== 'undefined' && fbRef) saveData();
  }

  function getData() {
    var data = load();
    if (data.date !== todayStr()) {
      data.date = todayStr();
      CATS.forEach(function(c) {
        if (data[c.key]) data[c.key].forEach(function(it){ it.done = false; });
      });
      save(data);
    }
    CATS.forEach(function(c) { if (!data[c.key]) data[c.key] = []; });
    return data;
  }

  function renderSlide(slide) {
    var cat = slide.getAttribute('data-cat');
    var data = getData();
    var items = data[cat];
    var list = slide.querySelector('.cl-list');

    if (items.length === 0) {
      list.innerHTML = '<li class="cl-empty">항목이 없습니다.</li>';
    } else {
      list.innerHTML = '';
      items.forEach(function(item, idx) {
        var li = document.createElement('li');
        li.className = 'cl-item' + (item.done ? ' done' : '');

        var chk = document.createElement('button');
        chk.className = 'cl-check';
        chk.textContent = item.done ? '✓' : '';
        chk.addEventListener('click', function() {
          var d = getData();
          d[cat][idx].done = !d[cat][idx].done;
          save(d);
          renderAll();
        });

        var lbl = document.createElement('span');
        lbl.className = 'cl-label';
        lbl.textContent = item.text;

        var del = document.createElement('button');
        del.className = 'cl-del';
        del.textContent = '×';
        del.addEventListener('click', function() {
          var d = getData();
          d[cat].splice(idx, 1);
          save(d);
          renderAll();
        });

        li.appendChild(chk);
        li.appendChild(lbl);
        li.appendChild(del);
        list.appendChild(li);
      });
    }
  }

  function updateHeader(idx) {
    var data = getData();
    var cat = CATS[idx].key;
    var items = data[cat];
    var done = items.filter(function(it){ return it.done; }).length;
    document.getElementById('cl-title').textContent = '✅ ' + CATS[idx].label;
    document.getElementById('cl-progress').textContent = done + ' / ' + items.length;
    document.querySelectorAll('.cl-tab').forEach(function(t, i) {
      t.classList.toggle('on', i === idx);
    });
  }

  function renderAll() {
    var track = document.getElementById('cl-track');
    var idx = Math.round(track.scrollLeft / track.clientWidth) || 0;
    document.querySelectorAll('.cl-slide').forEach(function(slide) {
      renderSlide(slide);
    });
    updateHeader(idx);
  }

  // 탭 클릭 → 해당 슬라이드로 이동
  document.querySelectorAll('.cl-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var idx = +this.getAttribute('data-idx');
      var track = document.getElementById('cl-track');
      track.scrollTo({ left: idx * track.clientWidth, behavior: 'smooth' });
      updateHeader(idx);
    });
  });

  // 스와이프 후 헤더 동기화
  var scrollTimer;
  document.getElementById('cl-track').addEventListener('scroll', function() {
    clearTimeout(scrollTimer);
    var track = this;
    scrollTimer = setTimeout(function() {
      var idx = Math.round(track.scrollLeft / track.clientWidth);
      updateHeader(idx);
    }, 80);
  });

  // 항목 추가 — 각 슬라이드의 버튼/입력 바인딩
  document.querySelectorAll('.cl-slide').forEach(function(slide) {
    var cat = slide.getAttribute('data-cat');
    var input = slide.querySelector('.cl-add-input');
    var btn   = slide.querySelector('.cl-add-btn');

    function add() {
      var text = input.value.trim();
      if (!text) return;
      var d = getData();
      d[cat].push({ text: text, done: false });
      save(d);
      input.value = '';
      renderAll();
    }

    btn.addEventListener('click', add);
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') add();
    });
  });

  renderAll();
  window.renderChecklist = renderAll;
})();
// 다크 모드 제거로 인해 테마 버튼 이벤트 바인딩 제거
document.getElementById('btn-cfg').addEventListener('click', openCfg);
document.getElementById('bcalp').addEventListener('click', function(){ calM--; if(calM<0){calM=11;calY--;} renderCal(); renderRvList(); });
document.getElementById('bcaln').addEventListener('click', function(){ calM++; if(calM>11){calM=0;calY++;} renderCal(); renderRvList(); });
document.getElementById('bcaltoday').addEventListener('click', function(){ var now=new Date(); calY=now.getFullYear(); calM=now.getMonth(); calSel=today(); renderCal(); renderRvList(); });
document.getElementById('rvsrch').addEventListener('input', renderRvList);
document.getElementById('rvsort').addEventListener('click', function(){ rvSortAsc=!rvSortAsc; renderRvList(); });
document.getElementById('btn-cust-import').addEventListener('click', openCustImport);
// 주의사항 항목 추가 버튼 바인딩
(function() {
  var input = document.getElementById('schv-notes-input');
  var btn   = document.getElementById('schv-notes-add');
  function add() {
    var text = input.value.trim();
    if (!text) return;
    addHallNote(text);
    input.value = '';
  }
  btn.addEventListener('click', add);
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter') add(); });
})();
document.getElementById('mo').addEventListener('click', function(e){ if(e.target===this) closeModal(); });
document.getElementById('mo').addEventListener('touchend', function(e){ if(e.target===this) closeModal(); });

// 마지막 날짜 초기화 (페이지 로드 시 오늘 날짜로 확실히 설정)
lastDate = today();

// floor-nav 날짜 변경 시에도 syncToday 호출되도록 보강
var originalRenderFloorNav = renderFloorNav;
renderFloorNav = function(){
  originalRenderFloorNav();
  setTimeout(syncToday, 100);   // 날짜 변경 후 syncToday 호출
};

// ── 1초마다 체크 ──
setInterval(function(){
  if(!currentStore) return;

  var nd = today();

  // 날짜가 바뀌었는지 체크
  if(nd !== lastDate){
    console.log('날짜 변경 감지: ' + lastDate + ' → ' + nd);
    lastDate = nd;
    syncToday();        // ← 묶음 해제 포함
    renderAll();
    return;
  }

  // 같은 날이면 floor 탭에서만 실시간 업데이트
  if(currentTab === 'floor'){
    if (hallViewMode === 'hall') {
      renderCanvas();
      renderStats();
      renderSidebar();
    } else {
      // 캘린더 뷰: 오늘 예약 목록만 갱신 (매초 DOM 전체 교체 방지)
      renderTodayRvList();
    }
    renderHeader();
  }
}, 1000);

// ── 자동 로그인 (이전에 인증한 기기) ──
try {
  var _auth = JSON.parse(localStorage.getItem('ryuma_auth') || 'null');
  if (_auth && _auth.store) {
    _pendingStore = _auth.store;
    doEnter(_auth.store);
  }
} catch(e) {}

// ── NFC URL 파라미터 처리 ──
// 사용법: ?action=reserve  (예약 추가 모달 자동 오픈)
(function() {
  var params = new URLSearchParams(window.location.search);
  var action = params.get('action');
  if (!action) return;
  // 앱 로딩 완료 후 실행
  function runNfcAction() {
    if (!currentStore) { setTimeout(runNfcAction, 300); return; }
    if (action === 'reserve') {
      switchTab('reserve');
      setTimeout(openAddRv, 200);
    }
    // URL 파라미터 정리 (뒤로가기 시 재실행 방지)
    history.replaceState(null, '', window.location.pathname);
  }
  setTimeout(runNfcAction, 500);
})();

// 라이트 모드 전용: 로고는 항상 검정(LOGO_BLACK) 사용
document.body.classList.add('light');
document.querySelectorAll('.sel-logo,.hd-logo').forEach(function(el){
  el.src = LOGO_BLACK;
  el.style.filter = '';
  el.style.opacity = '.9';
});
// ====== 가로모드 전환 시 캔버스 높이 자동 보정 ======
(function(){
  var _rszT;
  function _fixCv(){
    var cv=document.getElementById('cv');
    if(!cv||!cv.style.height)return;
    var max=0;
    var tcs=document.querySelectorAll('#cvi .tc');
    for(var i=0;i<tcs.length;i++){
      var b=(parseFloat(tcs[i].style.top)||0)+tcs[i].offsetHeight+20;
      if(b>max)max=b;
    }
    if(max>0&&max>parseFloat(cv.style.height||'0')){
      cv.style.height=max+'px';
    }
  }
  window.addEventListener('orientationchange',function(){
    setTimeout(_fixCv,400);
  });
  window.addEventListener('resize',function(){
    clearTimeout(_rszT);
    _rszT=setTimeout(_fixCv,250);
  });
  window.addEventListener('load',function(){setTimeout(_fixCv,600);});
})();
// =====================================================
// 가로/세로 전환 시 캔버스 재렌더링
(function(){
  var _rszT;
  window.addEventListener('orientationchange', function(){
    setTimeout(renderCanvas, 200);
    setTimeout(renderCanvas, 500);
  });
  window.addEventListener('resize', function(){
    clearTimeout(_rszT);
    _rszT = setTimeout(renderCanvas, 200);
  });
})();
