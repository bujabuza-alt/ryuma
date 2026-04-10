// ── 재고 관리 (Inventory Management) ──
// ══════════════════════════════════════════════════════════
// ── 재고 관리 (Inventory Management) ──
// ══════════════════════════════════════════════════════════

var DEFAULT_STOCK_CATS  = ['식재료','소모품','포장재','주류','음료','기타','사케-세계','사케-쿠마','와인'];
var DEFAULT_STOCK_UNITS = ['개','kg','L','병','박스','팩'];

var DEFAULT_INVENTORY = (function() {
  var now = Date.now();
  var items = [
    {n:'닷사이 준마이 다이긴조 23', cat:'사케-세계'},
    {n:'닷사이 준마이 다이긴조 39', cat:'사케-세계'},
    {n:'미오', cat:'사케-세계'},
    {n:'반슈잇콘 준마이 초카라구치', cat:'사케-세계'},
    {n:'슈호 긴죠 초카라구치', cat:'사케-세계'},
    {n:'시라타키', cat:'사케-세계'},
    {n:'쿠보타 만쥬', cat:'사케-세계'},
    {n:'쿠보타 센쥬', cat:'사케-세계'},
    {n:'타카시미즈', cat:'사케-세계'},
    {n:'미무로스기 준마이다이긴조 사케미라이', cat:'사케-쿠마'},
    {n:'본 고쿠히조 다이긴조', cat:'사케-쿠마'},
    {n:'스이게이', cat:'사케-쿠마'},
    {n:'우고노츠키 준마이다이긴조 핫탄니시키', cat:'사케-쿠마'},
    {n:'유키노보우샤300', cat:'사케-쿠마'},
    {n:'유키노보우샤 720', cat:'사케-쿠마'},
    {n:'이치넨후도 토쿠베츠준마이', cat:'사케-쿠마'},
    {n:'키타야', cat:'사케-쿠마'},
    {n:'텐부', cat:'사케-쿠마'},
    {n:'토요비진 준마이긴조 초카라구치', cat:'사케-쿠마'},
    {n:'토요비진', cat:'사케-쿠마'},
    {n:'토카이자카리 토쿠베츠준마이 야마다니시키', cat:'사케-쿠마'},
    {n:'하야시혼텐', cat:'사케-쿠마'},
    {n:'핫카이산 블루라벨 생원주', cat:'사케-쿠마'},
    {n:'핫카이산 콩고신', cat:'사케-쿠마'},
    {n:'핫카이산 토쿠베츠 준마이', cat:'사케-쿠마'},
    {n:'호라이센 카스미스키', cat:'사케-쿠마'},
    {n:'엡실론 골드', cat:'와인'},
    {n:'에라주리즈 까베르네소비뇽', cat:'와인'},
    {n:'빌라 안티노리 키안티 글르시코 리제르바', cat:'와인'},
    {n:'노통 배럴 셀렉트 말백', cat:'와인'},
    {n:'싼테로 안젤리 로쏘', cat:'와인'}
  ];
  return items.map(function(item, i) {
    return {id: 'def_' + (i+1), n: item.n, cat: item.cat, unit: '병', qty: 0, min: 0, memo: '', upd: now, hist: []};
  });
})();

var stockTab        = '전체';
var stockChip       = 'all';   // 'all' | 'low' | 'out'
var stockSearch     = '';
var stockSort       = 'name';  // 'name' | 'qty_asc' | 'qty_desc' | 'recent'
var stockOrderMode  = false;
var stockSelectedIds = [];
var stockHistTab    = 'all';   // in detail modal: 'all' | 'in' | 'out'

// ── 헬퍼 ──
function stockStatus(item) {
  if (item.qty <= 0) return 'out';
  if (item.min > 0 && item.qty <= item.min) return 'warn';
  return 'ok';
}
function stockFmtTime(ts) {
  var d = new Date(ts);
  var h = d.getHours(), m = d.getMinutes();
  var ampm = h < 12 ? '오전' : '오후';
  return ampm + ' ' + pad(h % 12 || 12) + ':' + pad(m);
}
function stockFmtDate(ts) {
  var d = new Date(ts);
  return d.getFullYear() + '.' + pad(d.getMonth()+1) + '.' + pad(d.getDate());
}
function stockRelLabel(ts) {
  var td = today();
  var ds = stockFmtDate(ts).replace(/\./g,'-');
  if (ds === td) return '오늘';
  var yd = addDays(td, -1);
  if (ds === yd) return '어제';
  return stockFmtDate(ts);
}
function stockTimeAgo(ts) {
  var diff = Date.now() - ts;
  var sec  = Math.floor(diff / 1000);
  if (sec < 60) return '방금';
  var min  = Math.floor(sec / 60);
  if (min < 60) return min + '분 전';
  var hr   = Math.floor(min / 60);
  if (hr < 24) return hr + '시간 전';
  return Math.floor(hr / 24) + '일 전';
}

// ── 필터/정렬된 목록 ──
function getStockList() {
  if (!S.inventory) S.inventory = [];
  var list = S.inventory.slice();

  // 카테고리 필터
  if (stockTab !== '전체') list = list.filter(function(i){ return i.cat === stockTab; });

  // 칩 필터
  if (stockChip === 'low')  list = list.filter(function(i){ return stockStatus(i) === 'warn'; });
  if (stockChip === 'out')  list = list.filter(function(i){ return stockStatus(i) === 'out'; });

  // 검색
  var q = stockSearch.trim().toLowerCase();
  if (q) list = list.filter(function(i){ return (i.n||'').toLowerCase().indexOf(q) >= 0; });

  // 정렬
  list.sort(function(a,b){
    if (stockSort === 'qty_asc')  return (a.qty||0) - (b.qty||0);
    if (stockSort === 'qty_desc') return (b.qty||0) - (a.qty||0);
    if (stockSort === 'recent')   return (b.upd||0) - (a.upd||0);
    return (a.n||'').localeCompare(b.n||'','ko');
  });
  return list;
}

// ── 메인 렌더 ──
function renderStock() {
  if (!S.inventory) S.inventory = [];
  if (!S.stockCats || !S.stockCats.length) S.stockCats = DEFAULT_STOCK_CATS.slice();
  if (!S.stockUnits || !S.stockUnits.length) S.stockUnits = DEFAULT_STOCK_UNITS.slice();

  renderStockCats();
  renderStockChips();
  renderStockStats();
  renderStockList();
  updateStockOrderBar();
}

function renderStockCats() {
  var cats = ['전체'].concat(S.stockCats);
  var html = cats.map(function(c){
    return '<button class="scat'+(c===stockTab?' on':'')+'" data-c="'+esc(c)+'">'+esc(c)+'</button>';
  }).join('');
  var el = document.getElementById('stock-cats');
  if (!el) return;
  el.innerHTML = html;
  el.querySelectorAll('.scat').forEach(function(btn){
    btn.addEventListener('click', function(){
      stockTab = this.getAttribute('data-c');
      renderStockCats();
      renderStockList();
      renderStockStats();
    });
  });
}

function renderStockChips() {
  var chips = [
    {k:'all', label:'전체'},
    {k:'low', label:'⚠ 부족'},
    {k:'out', label:'🔴 품절'}
  ];
  var html = chips.map(function(c){
    var cls = 'schip';
    if (c.k === stockChip) cls += (c.k==='low'?' warn-on':c.k==='out'?' out-on':' on');
    return '<button class="'+cls+'" data-k="'+c.k+'">'+c.label+'</button>';
  }).join('');
  var el = document.getElementById('stock-chips');
  if (!el) return;
  el.innerHTML = html;
  el.querySelectorAll('.schip').forEach(function(btn){
    btn.addEventListener('click', function(){
      stockChip = this.getAttribute('data-k');
      renderStockChips();
      renderStockList();
      renderStockStats();
    });
  });
}

function renderStockStats() {
  if (!S.inventory) S.inventory = [];
  var total = S.inventory.length;
  var low   = S.inventory.filter(function(i){ return stockStatus(i) === 'warn'; }).length;
  var out   = S.inventory.filter(function(i){ return stockStatus(i) === 'out'; }).length;
  var el = document.getElementById('stock-stats');
  if (!el) return;
  el.innerHTML =
    '<div class="sc"><div class="si" style="background:rgba(42,114,200,.12)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></div><div><div class="sl">전체 품목</div><div class="sv" style="color:#60a5fa">'+total+'개</div></div></div>'+
    '<div class="sc"><div class="si" style="background:rgba(200,146,42,.12)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div><div class="sl">부족 경고</div><div class="sv" style="color:var(--amber)">'+low+'개</div></div></div>'+
    '<div class="sc"><div class="si" style="background:rgba(196,18,48,.12)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div><div><div class="sl">품절</div><div class="sv" style="color:var(--red2)">'+out+'개</div></div></div>';
}

function renderStockList() {
  var list = getStockList();
  var el = document.getElementById('stock-list');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="sk-empty">'+
      (stockSearch||stockTab!=='전체'||stockChip!=='all' ? '검색 결과가 없습니다' : '등록된 재고 품목이 없습니다. + 추가 버튼을 눌러 시작하세요.')+
      '</div>';
    return;
  }
  var html = list.map(function(item){
    var st = stockStatus(item);
    var isSel = stockOrderMode && stockSelectedIds.indexOf(item.id) >= 0;
    return '<div class="sk-card" data-id="'+item.id+'">'
      +'<div class="sk-bar '+st+'"></div>'
      +'<div class="sk-body">'
        +'<div class="sk-name">'+esc(item.n)+'</div>'
        +'<div class="sk-sub"><span class="sk-cat">'+esc(item.cat||'기타')+'</span>'
          +(item.memo ? '<span>'+esc(item.memo)+'</span>' : '')
          +(item.upd ? '<span>'+stockTimeAgo(item.upd)+'</span>' : '')
        +'</div>'
      +'</div>'
      +'<div class="sk-right">'
        +'<div class="sk-qty '+st+'">'+item.qty+'<span class="sk-unit"> '+esc(item.unit||'')+'</span></div>'
        +(item.min > 0 ? '<div style="font-size:10px;color:var(--text3)">최소 '+item.min+'</div>' : '<div></div>')
        +'<div class="sk-adj">'
          +'<button class="sk-adj-btn" data-id="'+item.id+'" data-d="-1">−</button>'
          +'<button class="sk-adj-btn" data-id="'+item.id+'" data-d="1">+</button>'
        +'</div>'
      +'</div>'
      +(stockOrderMode ? '<div class="sk-sel'+(isSel?' show':'')+'"><div class="sk-sel-chk">'+(isSel?'✓':'')+'</div></div>' : '')
    +'</div>';
  }).join('');
  el.innerHTML = html;

  // 카드 클릭 → 상세 or 발주 선택
  el.querySelectorAll('.sk-card').forEach(function(card){
    card.addEventListener('click', function(e){
      var id = this.getAttribute('data-id');
      if (stockOrderMode) {
        var idx = stockSelectedIds.indexOf(id);
        if (idx >= 0) stockSelectedIds.splice(idx, 1);
        else stockSelectedIds.push(id);
        renderStockList();
        updateStockOrderBar();
      } else {
        openStockDetail(id);
      }
    });
  });

  // +/- 버튼
  el.querySelectorAll('.sk-adj-btn').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var id = this.getAttribute('data-id');
      var d  = parseInt(this.getAttribute('data-d'));
      adjStockQty(id, d, '');
    });
  });
}

function updateStockOrderBar() {
  var bar = document.getElementById('stock-order-bar');
  var cnt = document.getElementById('stock-order-count');
  if (!bar) return;
  if (stockOrderMode) {
    bar.style.display = 'flex';
    if (cnt) cnt.textContent = stockSelectedIds.length + '개 선택됨';
  } else {
    bar.style.display = 'none';
  }
}

// ── 수량 조절 ──
function adjStockQty(id, delta, memo) {
  if (!S.inventory) return;
  var item = S.inventory.filter(function(i){ return i.id===id; })[0];
  if (!item) return;
  var prev = item.qty;
  item.qty = Math.max(0, (item.qty||0) + delta);
  item.upd = Date.now();
  if (!item.hist) item.hist = [];
  item.hist.unshift({d:delta, r:item.qty, ts:Date.now(), m:memo||''});
  if (item.hist.length > 200) item.hist = item.hist.slice(0, 200);
  saveData();
  renderStockList();
  renderStockStats();
  var st = stockStatus(item);
  if (st === 'out') showToast('🔴 '+item.n+': 품절');
  else if (st === 'warn') showToast('⚠ '+item.n+': 부족 ('+item.qty+' '+item.unit+')');
}

// ── 추가/편집 모달 ──
function openAddStock() {
  if (!S.stockCats || !S.stockCats.length) S.stockCats = DEFAULT_STOCK_CATS.slice();
  if (!S.stockUnits || !S.stockUnits.length) S.stockUnits = DEFAULT_STOCK_UNITS.slice();
  // Pre-select the active category filter (if one is selected)
  var activeCat = (stockTab && stockTab !== '전체') ? stockTab : null;
  var catOpts = S.stockCats.map(function(c){ return '<option value="'+esc(c)+'"'+(c===activeCat?' selected':'')+'>'+esc(c)+'</option>'; }).join('');
  var unitOpts = S.stockUnits.map(function(u){ return '<option value="'+esc(u)+'">'+esc(u)+'</option>'; }).join('');
  showModal(
    '<div class="md-hd"><div class="md-title">재고 품목 추가</div><button class="md-x" onclick="closeModal()">✕</button></div>'
    +'<div class="mb">'
    +'<div class="fg"><div class="fl">상품명 *</div><input class="fi" id="sk-n" placeholder="예: 에티오피아 원두" maxlength="40"></div>'
    +'<div class="g2">'
      +'<div class="fg"><div class="fl">카테고리</div>'
        +'<select class="fi" id="sk-cat">'+catOpts+'</select>'
      +'</div>'
      +'<div class="fg"><div class="fl">단위</div>'
        +'<select class="fi" id="sk-unit">'+unitOpts+'</select>'
      +'</div>'
    +'</div>'
    +'<div class="g2">'
      +'<div class="fg"><div class="fl">현재 수량</div><input class="fi" id="sk-qty" type="number" min="0" value="0" inputmode="numeric"></div>'
      +'<div class="fg"><div class="fl">최소 기준</div><input class="fi" id="sk-min" type="number" min="0" value="0" inputmode="numeric" placeholder="0=없음"></div>'
    +'</div>'
    +'<div class="fg"><div class="fl">메모</div><input class="fi" id="sk-memo" placeholder="선택 사항" maxlength="80"></div>'
    +'<div class="abs">'
      +'<button class="ab" style="background:var(--surf3);color:var(--text2);" onclick="closeModal()">취소</button>'
      +'<button class="ab" style="background:var(--red);" onclick="saveStockItem(null)">저장</button>'
    +'</div>'
    +'<div style="margin-top:6px;text-align:center">'
      +'<button class="bg" style="font-size:11px;" onclick="openStockListMgr()">카테고리/단위 관리 ⚙</button>'
    +'</div>'
    +'</div>'
  );
  setTimeout(function(){ var n=document.getElementById('sk-n'); if(n)n.focus(); }, 200);
}

function openEditStock(id) {
  var item = (S.inventory||[]).filter(function(i){ return i.id===id; })[0];
  if (!item) return;
  if (!S.stockCats || !S.stockCats.length) S.stockCats = DEFAULT_STOCK_CATS.slice();
  if (!S.stockUnits || !S.stockUnits.length) S.stockUnits = DEFAULT_STOCK_UNITS.slice();
  var catOpts = S.stockCats.map(function(c){ return '<option value="'+esc(c)+'"'+(c===item.cat?' selected':'')+'>'+esc(c)+'</option>'; }).join('');
  var unitOpts = S.stockUnits.map(function(u){ return '<option value="'+esc(u)+'"'+(u===item.unit?' selected':'')+'>'+esc(u)+'</option>'; }).join('');
  showModal(
    '<div class="md-hd"><div class="md-title">품목 수정</div><button class="md-x" onclick="closeModal()">✕</button></div>'
    +'<div class="mb">'
    +'<div class="fg"><div class="fl">상품명 *</div><input class="fi" id="sk-n" value="'+esc(item.n)+'" maxlength="40"></div>'
    +'<div class="g2">'
      +'<div class="fg"><div class="fl">카테고리</div>'
        +'<select class="fi" id="sk-cat">'+catOpts+'</select>'
      +'</div>'
      +'<div class="fg"><div class="fl">단위</div>'
        +'<select class="fi" id="sk-unit">'+unitOpts+'</select>'
      +'</div>'
    +'</div>'
    +'<div class="g2">'
      +'<div class="fg"><div class="fl">현재 수량</div><input class="fi" id="sk-qty" type="number" min="0" value="'+item.qty+'" inputmode="numeric"></div>'
      +'<div class="fg"><div class="fl">최소 기준</div><input class="fi" id="sk-min" type="number" min="0" value="'+item.min+'" inputmode="numeric"></div>'
    +'</div>'
    +'<div class="fg"><div class="fl">메모</div><input class="fi" id="sk-memo" value="'+esc(item.memo||'')+'" maxlength="80"></div>'
    +'<div class="abs">'
      +'<button class="ab" style="background:var(--red2);" onclick="delStockItem(\''+id+'\')">삭제</button>'
      +'<button class="ab" style="background:var(--red);" onclick="saveStockItem(\''+id+'\')">저장</button>'
    +'</div>'
    +'</div>'
  );
}

function saveStockItem(editId) {
  var n    = (document.getElementById('sk-n')||{}).value || '';
  var cat  = (document.getElementById('sk-cat')||{}).value || '기타';
  var unit = (document.getElementById('sk-unit')||{}).value || '개';
  var qty  = parseInt((document.getElementById('sk-qty')||{}).value)||0;
  var min  = parseInt((document.getElementById('sk-min')||{}).value)||0;
  var memo = (document.getElementById('sk-memo')||{}).value || '';
  if (!n.trim()) { showToast('상품명을 입력하세요'); return; }

  if (!S.inventory) S.inventory = [];
  if (editId) {
    S.inventory = S.inventory.map(function(i){
      if (i.id !== editId) return i;
      return Object.assign({}, i, {n:n.trim(), cat:cat, unit:unit, qty:qty, min:min, memo:memo, upd:Date.now()});
    });
  } else {
    S.inventory.push({id:uid(), n:n.trim(), cat:cat, unit:unit, qty:qty, min:min, memo:memo, hist:[], upd:Date.now()});
  }
  saveData();
  closeModal();
  renderStock();
  showToast(editId ? '✅ 품목이 수정되었습니다' : '✅ 품목이 추가되었습니다');
}

function delStockItem(id) {
  if (!confirm('이 품목을 삭제할까요?')) return;
  S.inventory = (S.inventory||[]).filter(function(i){ return i.id !== id; });
  saveData();
  closeModal();
  renderStock();
  showToast('🗑 품목이 삭제되었습니다');
}

// ── 상세 모달 ──
function openStockDetail(id) {
  var item = (S.inventory||[]).filter(function(i){ return i.id===id; })[0];
  if (!item) return;
  stockHistTab = 'all';
  renderStockDetailModal(id);
}

function renderStockDetailModal(id) {
  var item = (S.inventory||[]).filter(function(i){ return i.id===id; })[0];
  if (!item) return;
  var st = stockStatus(item);
  var stLabel = st==='out'?'품절':st==='warn'?'부족':'정상';
  var stColor = st==='out'?'var(--red2)':st==='warn'?'var(--amber)':'var(--green)';

  var hist = (item.hist||[]);
  var filtHist = hist;
  if (stockHistTab === 'in')  filtHist = hist.filter(function(h){ return h.d > 0; });
  if (stockHistTab === 'out') filtHist = hist.filter(function(h){ return h.d < 0; });

  // 통계
  var totalIn  = hist.reduce(function(a,h){ return a + (h.d>0?h.d:0); }, 0);
  var totalOut = hist.reduce(function(a,h){ return a + (h.d<0?Math.abs(h.d):0); }, 0);

  // 이력 그룹화 (날짜별)
  var grouped = [];
  var lastLabel = '';
  filtHist.forEach(function(h){
    var lbl = stockRelLabel(h.ts);
    if (lbl !== lastLabel) { grouped.push({label:lbl, rows:[]}); lastLabel = lbl; }
    grouped[grouped.length-1].rows.push(h);
  });

  var histHtml = '';
  if (!filtHist.length) {
    histHtml = '<div style="padding:12px;text-align:center;font-size:11px;color:var(--text3)">기록 없음</div>';
  } else {
    grouped.forEach(function(g){
      histHtml += '<div style="padding:5px 11px 3px;font-size:10px;font-weight:800;color:var(--text3);background:var(--bg);border-bottom:1px solid var(--border);">'+esc(g.label)+'</div>';
      g.rows.forEach(function(h){
        var sign = h.d > 0 ? '+' : '';
        histHtml += '<div class="sk-hist-row">'
          +'<span class="sk-hist-d">'+stockFmtTime(h.ts)+'</span>'
          +'<span class="sk-hist-delta '+(h.d>0?'in':'out')+'">'+sign+h.d+'</span>'
          +'<span class="sk-hist-res">→ '+h.r+'</span>'
          +(h.m ? '<span style="flex:1;text-align:right;font-size:10px;color:var(--text3)">'+esc(h.m)+'</span>' : '')
        +'</div>';
      });
    });
  }

  // 수량 조절 선택자
  var adjOpts = '';
  for (var i=1; i<=50; i++) adjOpts += '<option value="'+i+'">'+i+'</option>';

  showModal(
    '<div class="md-hd"><div class="md-title">'+esc(item.n)+'</div><button class="md-x" onclick="closeModal()">✕</button></div>'
    +'<div class="mb">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;background:var(--surf2);border-radius:10px;padding:12px 14px;border:1px solid var(--border);">'
      +'<div>'
        +'<div style="font-size:10px;color:var(--text3);margin-bottom:2px;">'+esc(item.cat||'기타')+' · '+esc(item.unit||'')+(item.memo?' · '+esc(item.memo):'')+'</div>'
        +'<div style="font-size:28px;font-weight:800;color:'+stColor+';">'+item.qty+' <span style="font-size:14px;font-weight:600;color:var(--text2);">'+esc(item.unit||'')+'</span></div>'
        +(item.min > 0 ? '<div style="font-size:10px;color:var(--text3);margin-top:2px;">최소 기준: '+item.min+'</div>' : '')
      +'</div>'
      +'<div style="text-align:right;">'
        +'<div style="font-size:10px;font-weight:700;color:'+stColor+';background:rgba(0,0,0,.08);border-radius:6px;padding:2px 8px;margin-bottom:6px;">'+stLabel+'</div>'
        +(item.upd ? '<div style="font-size:10px;color:var(--text3);">'+stockFmtDate(item.upd)+'</div>' : '')
      +'</div>'
    +'</div>'
    +'<div class="sk-detail-stats">'
      +'<div class="sk-detail-stat"><div class="sk-detail-stat-n">'+hist.length+'</div><div class="sk-detail-stat-l">기록 수</div></div>'
      +'<div class="sk-detail-stat"><div class="sk-detail-stat-n" style="color:var(--green);">+'+totalIn+'</div><div class="sk-detail-stat-l">총 입고</div></div>'
      +'<div class="sk-detail-stat"><div class="sk-detail-stat-n" style="color:var(--red2);">-'+totalOut+'</div><div class="sk-detail-stat-l">총 출고</div></div>'
    +'</div>'
    +'<div style="display:flex;gap:6px;align-items:center;">'
      +'<div style="font-size:12px;color:var(--text2);font-weight:700;">수량 조절:</div>'
      +'<select class="sk-qty-sel" id="sk-adj-val">'+adjOpts+'</select>'
      +'<button class="bg" style="font-size:12px;" onclick="adjStockFromDetail(\''+id+'\', -1)">출고 −</button>'
      +'<button class="bp" style="font-size:12px;" onclick="adjStockFromDetail(\''+id+'\', 1)">입고 +</button>'
    +'</div>'
    +'<div class="sk-hist-wrap">'
      +'<div class="sk-hist-hd">이력'
        +'<button class="sk-hist-tab'+(stockHistTab==='all'?' on':'')+'" onclick="stockHistTab=\'all\';renderStockDetailModal(\''+id+'\')">전체</button>'
        +'<button class="sk-hist-tab'+(stockHistTab==='in'?' on':'')+'" onclick="stockHistTab=\'in\';renderStockDetailModal(\''+id+'\')">입고</button>'
        +'<button class="sk-hist-tab'+(stockHistTab==='out'?' on':'')+'" onclick="stockHistTab=\'out\';renderStockDetailModal(\''+id+'\')">출고</button>'
      +'</div>'
      +histHtml
    +'</div>'
    +'<div class="abs">'
      +'<button class="ab" style="background:var(--surf3);color:var(--text2);" onclick="closeModal()">닫기</button>'
      +'<button class="ab" style="background:var(--indigo);" onclick="closeModal();openEditStock(\''+id+'\')">수정</button>'
    +'</div>'
    +'</div>'
  );
}

function adjStockFromDetail(id, sign) {
  var valEl = document.getElementById('sk-adj-val');
  var delta = parseInt(valEl ? valEl.value : 1) * sign;
  adjStockQty(id, delta, '');
  renderStockDetailModal(id);
}

// ── 정렬 모달 ──
function openStockSort() {
  var opts = [
    {k:'name',     label:'이름순'},
    {k:'qty_asc',  label:'수량 적은 순'},
    {k:'qty_desc', label:'수량 많은 순'},
    {k:'recent',   label:'최근 업데이트 순'}
  ];
  var html = opts.map(function(o){
    return '<button class="ab" style="background:'+(stockSort===o.k?'var(--red)':'var(--surf3)')+';color:'+(stockSort===o.k?'#fff':'var(--text2)')+';" onclick="stockSort=\''+o.k+'\';closeModal();renderStockList();">'+o.label+'</button>';
  }).join('');
  showModal(
    '<div class="md-hd"><div class="md-title">정렬</div><button class="md-x" onclick="closeModal()">✕</button></div>'
    +'<div class="mb">'
    +'<div style="display:flex;flex-direction:column;gap:8px;">'+html+'</div>'
    +'</div>'
  );
}

// ── 발주 모드 ──
function toggleStockOrderMode() {
  stockOrderMode = !stockOrderMode;
  stockSelectedIds = [];
  var btn = document.getElementById('stock-btn-order');
  if (btn) {
    btn.textContent = stockOrderMode ? '취소' : '📋 발주';
    btn.className = stockOrderMode ? 'be on' : 'bg';
  }
  renderStockList();
  updateStockOrderBar();
}

function copyStockOrderList() {
  if (!stockSelectedIds.length) { showToast('품목을 선택하세요'); return; }
  var lines = stockSelectedIds.map(function(id){
    var item = (S.inventory||[]).filter(function(i){ return i.id===id; })[0];
    if (!item) return '';
    return item.n + ' ' + (item.min > 0 ? item.min : 1) + item.unit;
  }).filter(Boolean);
  var text = '[발주 목록]\n' + lines.join('\n');
  navigator.clipboard.writeText(text).then(function(){
    showToast('📋 발주 목록이 복사되었습니다 ('+lines.length+'개)');
    toggleStockOrderMode();
  }).catch(function(){
    showToast('복사 실패 — 수동으로 복사하세요');
  });
}

// ── CSV 내보내기 ──
function exportStockCSV() {
  if (!S.inventory || !S.inventory.length) { showToast('내보낼 데이터가 없습니다'); return; }
  var BOM = '\uFEFF';
  var header = '상품명,카테고리,수량,단위,최소기준,메모\n';
  var rows = S.inventory.map(function(i){
    return [i.n,i.cat||'',i.qty,i.unit||'',i.min||0,i.memo||''].map(function(v){
      return '"'+String(v).replace(/"/g,'""')+'"';
    }).join(',');
  }).join('\n');
  var blob = new Blob([BOM+header+rows], {type:'text/csv;charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = '재고_'+today()+'.csv'; a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}

// ── 카테고리/단위 관리 모달 ──
function openStockListMgr() {
  if (!S.stockCats) S.stockCats = DEFAULT_STOCK_CATS.slice();
  if (!S.stockUnits) S.stockUnits = DEFAULT_STOCK_UNITS.slice();
  renderStockListMgrModal();
}

function renderStockListMgrModal() {
  var catsHtml = S.stockCats.map(function(c,i){
    return '<div class="list-mgr-row"><span class="list-mgr-name">'+esc(c)+'</span><button class="list-mgr-del" onclick="removeStockCat('+i+')">✕</button></div>';
  }).join('') || '<div style="padding:6px;font-size:11px;color:var(--text3)">없음</div>';
  var unitsHtml = S.stockUnits.map(function(u,i){
    return '<div class="list-mgr-row"><span class="list-mgr-name">'+esc(u)+'</span><button class="list-mgr-del" onclick="removeStockUnit('+i+')">✕</button></div>';
  }).join('') || '<div style="padding:6px;font-size:11px;color:var(--text3)">없음</div>';

  showModal(
    '<div class="md-hd"><div class="md-title">카테고리 · 단위 관리</div><button class="md-x" onclick="closeModal()">✕</button></div>'
    +'<div class="mb">'
    +'<div style="font-size:12px;font-weight:800;color:var(--text2);margin-bottom:6px;">카테고리</div>'
    +'<div style="background:var(--surf2);border:1px solid var(--border);border-radius:10px;padding:6px 10px;max-height:120px;overflow-y:auto;">'+catsHtml+'</div>'
    +'<div style="display:flex;gap:6px;margin-top:6px;">'
      +'<input class="fi" id="new-cat-inp" placeholder="새 카테고리" maxlength="20" style="flex:1;">'
      +'<button class="bp" onclick="addStockCat()">추가</button>'
    +'</div>'
    +'<div style="height:1px;background:var(--border);margin:10px 0;"></div>'
    +'<div style="font-size:12px;font-weight:800;color:var(--text2);margin-bottom:6px;">단위</div>'
    +'<div style="background:var(--surf2);border:1px solid var(--border);border-radius:10px;padding:6px 10px;max-height:100px;overflow-y:auto;">'+unitsHtml+'</div>'
    +'<div style="display:flex;gap:6px;margin-top:6px;">'
      +'<input class="fi" id="new-unit-inp" placeholder="새 단위" maxlength="10" style="flex:1;">'
      +'<button class="bp" onclick="addStockUnit()">추가</button>'
    +'</div>'
    +'<button class="ab" style="background:var(--surf3);color:var(--text2);width:100%;margin-top:10px;" onclick="closeModal()">닫기</button>'
    +'</div>'
  );
}

function addStockCat() {
  var inp = document.getElementById('new-cat-inp');
  var v = (inp||{}).value||'';
  v = v.trim();
  if (!v) return;
  if (!S.stockCats) S.stockCats = [];
  if (S.stockCats.indexOf(v) >= 0) { showToast('이미 있는 카테고리입니다'); return; }
  S.stockCats.push(v);
  saveData();
  renderStockListMgrModal();
}
function removeStockCat(idx) {
  if (!S.stockCats) return;
  S.stockCats.splice(idx, 1);
  saveData();
  renderStockListMgrModal();
}
function addStockUnit() {
  var inp = document.getElementById('new-unit-inp');
  var v = (inp||{}).value||'';
  v = v.trim();
  if (!v) return;
  if (!S.stockUnits) S.stockUnits = [];
  if (S.stockUnits.indexOf(v) >= 0) { showToast('이미 있는 단위입니다'); return; }
  S.stockUnits.push(v);
  saveData();
  renderStockListMgrModal();
}
function removeStockUnit(idx) {
  if (!S.stockUnits) return;
  S.stockUnits.splice(idx, 1);
  saveData();
  renderStockListMgrModal();
}

// ── 이벤트 바인딩 (재고) ──
document.getElementById('stock-btn-add').addEventListener('click', openAddStock);
document.getElementById('stock-btn-order').addEventListener('click', toggleStockOrderMode);
document.getElementById('stock-btn-sort').addEventListener('click', openStockSort);
document.getElementById('stock-btn-csv').addEventListener('click', exportStockCSV);
document.getElementById('stock-order-copy').addEventListener('click', copyStockOrderList);
document.getElementById('stock-order-cancel').addEventListener('click', function(){
  stockOrderMode = false; stockSelectedIds = [];
  var btn = document.getElementById('stock-btn-order');
  if (btn) { btn.textContent = '📋 발주'; btn.className = 'bg'; }
  renderStockList(); updateStockOrderBar();
});
document.getElementById('stock-srch').addEventListener('input', function(){
  stockSearch = this.value;
  renderStockList();
  renderStockStats();
});
