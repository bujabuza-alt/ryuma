// ── 초기화 및 이벤트 바인딩 (Initialization & Event Binding) ──

// ── 이벤트 바인딩 ──
document.getElementById('btn-covent').addEventListener('click', function(){ doEnter('covent'); });
document.getElementById('btn-paragon').addEventListener('click', function(){ doEnter('paragon'); });
document.getElementById('t1').addEventListener('click', function(){ switchTab('floor'); });
document.getElementById('t2').addEventListener('click', function(){ switchTab('reserve'); });
document.getElementById('t3').addEventListener('click', function(){ switchTab('cust'); });
document.getElementById('t4').addEventListener('click', function(){ switchTab('stock'); });
document.getElementById('t5').addEventListener('click', function(){ switchTab('images'); });
document.getElementById('t6').addEventListener('click', function(){ switchTab('staff'); });
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

// ── 확인 사항 (구 주의사항 + 마감 체크리스트 통합, 카테고리 동적 관리) ──
(function() {
  var LEGACY_CL_KEY = 'checklist_v2';
  var DEFAULT_CATS = [
    { key: 'precaution', label: '주의사항' },
    { key: 'closing',    label: '마감 체크' },
    { key: 'task',       label: '업무 체크' },
    { key: 'etc',        label: '기타 체크' }
  ];
  var activeIdx = 0;

  function storeKey() { return 'confirm_items_v1_' + (currentStore || ''); }
  function legacyNotesKey() { return 'hall_notes_items_' + (currentStore || ''); }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }

  // 기존 주의사항(hall_notes_items_*) / 체크리스트(checklist_v2) 데이터를 최초 1회 이전
  function migrate() {
    var ck = {};
    try { ck = JSON.parse(localStorage.getItem(LEGACY_CL_KEY) || '{}'); } catch(e) {}
    var notes = [];
    try { notes = JSON.parse(localStorage.getItem(legacyNotesKey()) || '[]'); } catch(e) {}

    var data = { date: todayStr(), cats: DEFAULT_CATS.map(function(c){ return {key:c.key,label:c.label}; }), items: {} };
    data.items.precaution = notes.map(function(t) { return { text: t, done: false }; });
    ['closing','task','etc'].forEach(function(k) {
      data.items[k] = Array.isArray(ck[k]) ? ck[k] : [];
    });
    save(data);
    return data;
  }

  function load() {
    var raw;
    try { raw = localStorage.getItem(storeKey()); } catch(e) { raw = null; }
    if (!raw) return migrate();
    try { return JSON.parse(raw); } catch(e) { return migrate(); }
  }

  function save(data) {
    try { localStorage.setItem(storeKey(), JSON.stringify(data)); } catch(e) {}
    if (typeof saveData === 'function' && typeof fbRef !== 'undefined' && fbRef) saveData();
  }

  function getData() {
    var data = load();
    if (!data.cats || !data.cats.length) data.cats = DEFAULT_CATS.map(function(c){ return {key:c.key,label:c.label}; });
    if (!data.items) data.items = {};
    data.cats.forEach(function(c) { if (!Array.isArray(data.items[c.key])) data.items[c.key] = []; });
    if (data.date !== todayStr()) {
      data.date = todayStr();
      data.cats.forEach(function(c) {
        data.items[c.key].forEach(function(it){ it.done = false; });
      });
      save(data);
    }
    return data;
  }

  function newCatKey() { return 'cat_' + Date.now() + '_' + Math.floor(Math.random()*1000); }

  function clampIdx(data) {
    if (activeIdx > data.cats.length - 1) activeIdx = data.cats.length - 1;
    if (activeIdx < 0) activeIdx = 0;
  }

  function render() {
    var data = getData();
    clampIdx(data);
    var tabsEl  = document.getElementById('cf-tabs');
    var trackEl = document.getElementById('cf-track');
    if (!tabsEl || !trackEl) return;

    tabsEl.innerHTML = data.cats.map(function(c, i) {
      return '<button type="button" class="cl-tab'+(i===activeIdx?' on':'')+'" data-idx="'+i+'">'+esc(c.label)+'</button>';
    }).join('') + '<button type="button" class="cl-tab cl-tab-add" id="cf-add-cat">＋</button>';

    trackEl.innerHTML = data.cats.map(function(c) {
      var items = data.items[c.key] || [];
      var listHtml = items.length ? items.map(function(item, idx) {
        return '<li class="cl-item'+(item.done ? ' done' : '')+'" data-idx="'+idx+'">'
          + '<button type="button" class="cl-check" data-act="chk">'+(item.done ? '✓' : '')+'</button>'
          + '<span class="cl-label" data-act="edit">'+esc(item.text)+'</span>'
          + '<button type="button" class="cl-del" data-act="del">×</button>'
          + '</li>';
      }).join('') : '<li class="cl-empty">항목이 없습니다.</li>';

      return '<div class="cl-slide" data-cat="'+c.key+'">'
        + '<ul class="cl-list">'+listHtml+'</ul>'
        + '<div class="cl-add-row">'
        + '<input class="cl-add-input" type="text" placeholder="항목 추가…" maxlength="60">'
        + '<button type="button" class="cl-add-btn">추가</button>'
        + '</div>'
        + '</div>';
    }).join('');

    var activeCat = data.cats[activeIdx];
    var activeItems = activeCat ? (data.items[activeCat.key] || []) : [];
    var done = activeItems.filter(function(it){ return it.done; }).length;
    var titleEl = document.getElementById('cf-title');
    var progEl  = document.getElementById('cf-progress');
    var delEl   = document.getElementById('cf-del-cat');
    if (titleEl) titleEl.textContent = '✅ 확인 사항';
    if (progEl)  progEl.textContent  = done + ' / ' + activeItems.length;
    if (delEl)   delEl.style.display = data.cats.length > 1 ? '' : 'none';

    bindEvents(data);

    requestAnimationFrame(function() {
      trackEl.scrollLeft = activeIdx * trackEl.clientWidth;
    });
  }

  function bindEvents(data) {
    var tabsEl  = document.getElementById('cf-tabs');
    var trackEl = document.getElementById('cf-track');
    var delEl   = document.getElementById('cf-del-cat');

    tabsEl.querySelectorAll('.cl-tab[data-idx]').forEach(function(tab) {
      var idx = +tab.getAttribute('data-idx');
      tab.addEventListener('click', function() { activeIdx = idx; render(); });
      var pressTimer = null;
      tab.addEventListener('touchstart', function() {
        pressTimer = setTimeout(function() { renameCat(idx); }, 550);
      });
      tab.addEventListener('touchend', function() { clearTimeout(pressTimer); });
      tab.addEventListener('touchmove', function() { clearTimeout(pressTimer); });
      tab.addEventListener('dblclick', function() { renameCat(idx); });
    });

    var addCatBtn = document.getElementById('cf-add-cat');
    if (addCatBtn) addCatBtn.addEventListener('click', function() {
      var name = (prompt('새 카테고리 이름을 입력하세요') || '').trim();
      if (!name) return;
      var d = getData();
      d.cats.push({ key: newCatKey(), label: name });
      save(d);
      activeIdx = d.cats.length - 1;
      render();
    });

    if (delEl) delEl.onclick = function() {
      var d = getData();
      if (d.cats.length <= 1) return;
      var cat = d.cats[activeIdx];
      if (!cat) return;
      if (!confirm('"'+cat.label+'" 카테고리를 삭제할까요? 안의 항목도 함께 삭제됩니다.')) return;
      delete d.items[cat.key];
      d.cats.splice(activeIdx, 1);
      save(d);
      activeIdx = 0;
      render();
    };

    trackEl.querySelectorAll('.cl-slide').forEach(function(slide) {
      var cat = slide.getAttribute('data-cat');
      var input = slide.querySelector('.cl-add-input');
      var btn   = slide.querySelector('.cl-add-btn');

      function add() {
        var text = input.value.trim();
        if (!text) return;
        var d = getData();
        (d.items[cat] = d.items[cat] || []).push({ text: text, done: false });
        save(d);
        render();
      }
      btn.addEventListener('click', add);
      input.addEventListener('keydown', function(e) { if (e.key === 'Enter') add(); });

      slide.querySelectorAll('.cl-item[data-idx]').forEach(function(li) {
        var idx = +li.getAttribute('data-idx');
        li.querySelector('[data-act="chk"]').addEventListener('click', function() {
          var d = getData();
          d.items[cat][idx].done = !d.items[cat][idx].done;
          save(d); render();
        });
        li.querySelector('[data-act="del"]').addEventListener('click', function() {
          var d = getData();
          d.items[cat].splice(idx, 1);
          save(d); render();
        });
        li.querySelector('[data-act="edit"]').addEventListener('click', function() {
          var d = getData();
          var cur = d.items[cat][idx].text;
          var next = prompt('항목 내용 수정', cur);
          if (next === null) return;
          next = next.trim();
          if (!next) return;
          d.items[cat][idx].text = next;
          save(d); render();
        });
      });
    });

    trackEl.onscroll = handleScroll;
  }

  var scrollTimer;
  function handleScroll() {
    var trackEl = document.getElementById('cf-track');
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
      var idx = Math.round(trackEl.scrollLeft / trackEl.clientWidth);
      if (idx !== activeIdx && idx >= 0) { activeIdx = idx; render(); }
    }, 100);
  }

  function renameCat(idx) {
    var d = getData();
    var c = d.cats[idx];
    if (!c) return;
    var next = (prompt('카테고리 이름 수정', c.label) || '').trim();
    if (!next) return;
    d.cats[idx].label = next;
    save(d);
    render();
  }

  render();
  window.renderConfirmItems = render;
})();
// 다크 모드 제거로 인해 테마 버튼 이벤트 바인딩 제거
document.getElementById('btn-cfg').addEventListener('click', openCfg);
document.getElementById('bcalp').addEventListener('click', function(){ calM--; if(calM<0){calM=11;calY--;} renderCal(); renderRvList(); });
document.getElementById('bcaln').addEventListener('click', function(){ calM++; if(calM>11){calM=0;calY++;} renderCal(); renderRvList(); });
document.getElementById('bcaltoday').addEventListener('click', function(){ var now=new Date(); calY=now.getFullYear(); calM=now.getMonth(); calSel=today(); renderCal(); renderRvList(); });
document.getElementById('rvsrch').addEventListener('input', renderRvList);
document.getElementById('rvsort').addEventListener('click', function(){ rvSortAsc=!rvSortAsc; renderRvList(); });
document.getElementById('btn-cust-import').addEventListener('click', openCustImport);
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
// #sel은 기본적으로 숨겨둔 상태(index.html)이므로, 자동 로그인 대상이 아닐 때만
// 매장 선택 화면을 보여준다 (앱 실행 시 이전 화면이 잠깐 보이는 현상 방지)
try {
  var _auth = JSON.parse(localStorage.getItem('ryuma_auth') || 'null');
  if (_auth && _auth.store) {
    _pendingStore = _auth.store;
    doEnter(_auth.store);
  } else {
    document.getElementById('sel').style.display = 'flex';
  }
} catch(e) {
  document.getElementById('sel').style.display = 'flex';
}

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
