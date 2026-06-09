// ── 초기화 및 이벤트 바인딩 (Initialization & Event Binding) ──

// ── 이벤트 바인딩 ──
document.getElementById('btn-covent').addEventListener('click', function(){ showPw('covent'); });
document.getElementById('btn-paragon').addEventListener('click', function(){ showPw('paragon'); });
document.getElementById('pw-back').addEventListener('click', showStore);
document.getElementById('pw-enter').addEventListener('click', tryEnter);
document.getElementById('pw-input').addEventListener('keydown', function(e){ if(e.key==='Enter') tryEnter(); });
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
document.getElementById('sb-vm').addEventListener('click', function(e) {
  var btn = e.target.closest('.sb-vm-btn');
  if (!btn) return;
  var vm = btn.getAttribute('data-vm');
  if (!vm) return;
  hallViewMode = vm;
  document.querySelectorAll('.sb-vm-btn').forEach(function(b){ b.classList.remove('on'); });
  btn.classList.add('on');
  renderAll();
});
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
document.getElementById('bwait').addEventListener('click', openWaitModal);
document.getElementById('baddRv').addEventListener('click', openAddRv);
document.getElementById('bNaverImport').addEventListener('click', openNaverImport);
document.getElementById('btn-theme').addEventListener('click', toggleTheme);
document.getElementById('sel-theme').addEventListener('click', toggleTheme);
document.getElementById('btn-cfg').addEventListener('click', openCfg);
document.getElementById('bcalp').addEventListener('click', function(){ calM--; if(calM<0){calM=11;calY--;} renderCal(); renderRvList(); });
document.getElementById('bcaln').addEventListener('click', function(){ calM++; if(calM>11){calM=0;calY++;} renderCal(); renderRvList(); });
document.getElementById('rvsrch').addEventListener('input', renderRvList);
document.getElementById('rvsort').addEventListener('click', function(){ rvSortAsc=!rvSortAsc; renderRvList(); });
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
    } else {
      renderSchedView();
    }
    renderSidebar();
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

initTheme();
document.getElementById('sel-logo').src = LOGO_DATA;
document.getElementById('hd-logo').src  = LOGO_DATA;
// 초기 테마에 맞는 로고 적용
(function(){
  var isLight = document.body.classList.contains('light');
  var logo = isLight ? LOGO_BLACK : LOGO_WHITE;
  document.querySelectorAll('.sel-logo,.hd-logo').forEach(function(el){ el.src=logo; el.style.filter=''; el.style.opacity=isLight?'.9':'.85'; });
})();
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
