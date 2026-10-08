// ══════════════════════════════════════════════════════════
// ── 발주 체크 (Order Checklist) ──
// order-checklist 앱의 발주 목록 · 상품 관리 · 발주 내역 기능을 이식.
// 데이터는 S.orderProducts / S.orderItems / S.orderHistory 로 매장별 Firebase 동기화.
// ══════════════════════════════════════════════════════════

var ORDER_DEFAULT_CATS = ['채소','과일','육류','수산물','유제품','양념/소스','곡류','기타'];
var ORDER_DEFAULT_PRODUCTS = [
  {id:1,name:'양파',unit:'kg',category:'채소'},
  {id:2,name:'감자',unit:'kg',category:'채소'},
  {id:3,name:'당근',unit:'kg',category:'채소'},
  {id:4,name:'대파',unit:'단',category:'채소'},
  {id:5,name:'마늘',unit:'kg',category:'채소'},
  {id:6,name:'고추',unit:'개',category:'채소'},
  {id:7,name:'양배추',unit:'망',category:'채소'},
  {id:8,name:'가지',unit:'개',category:'채소'},
  {id:9,name:'단호박',unit:'통',category:'채소'},
  {id:10,name:'브로콜리',unit:'개',category:'채소'},
  {id:11,name:'시금치',unit:'단',category:'채소'},
  {id:12,name:'깻잎',unit:'단',category:'채소'},
  {id:13,name:'애호박',unit:'개',category:'채소'},
  {id:14,name:'무',unit:'개',category:'채소'},
  {id:15,name:'배추',unit:'포기',category:'채소'},
  {id:16,name:'돼지고기',unit:'kg',category:'육류'},
  {id:17,name:'소고기',unit:'kg',category:'육류'},
  {id:18,name:'닭고기',unit:'kg',category:'육류'},
  {id:19,name:'계란',unit:'판',category:'유제품'},
  {id:20,name:'두부',unit:'모',category:'기타'},
  {id:21,name:'쌀',unit:'kg',category:'곡류'}
];
var ORDER_HISTORY_MAX = 500;

var orderSub        = 'list';   // 'list' | 'db' | 'history'
var orderBuiltSub   = null;     // 현재 #order-body 에 그려진 서브탭 (검색창 포커스 유지용)
var orderDbSort     = 'name';   // 'name' | 'freq'
var orderSearch     = '';
var orderCollapsed  = {};       // 접힌 카테고리

// ── 데이터 정규화 / 초기화 ──
function normalizeOrderProduct(p) {
  var min = p.priceMin != null ? p.priceMin : (p.price || 0);
  var max = p.priceMax != null ? p.priceMax : (p.price || 0);
  return {
    id: p.id, name: String(p.name || ''), unit: String(p.unit || ''), category: p.category || '기타',
    priceMin: +min || 0, priceMax: +max || 0,
    usageCount: +p.usageCount || 0,
    orderDates: Array.isArray(p.orderDates) ? p.orderDates : []
  };
}

// 최초 1회: 원본 order-checklist 앱(같은 오리진의 localStorage 'orderApp')의 데이터를 가져오고,
// 없으면 원본과 동일한 기본 품목 21개로 시작한다. 서버 데이터를 받은 뒤에만 호출해야 한다.
function seedOrderDataIfNeeded() {
  if (S.orderInit) return false;
  var src = null;
  try { src = JSON.parse(localStorage.getItem('orderApp') || 'null'); } catch(e) { src = null; }
  if (src && Array.isArray(src.products) && src.products.length) {
    S.orderProducts = src.products.map(normalizeOrderProduct);
    S.orderItems    = Array.isArray(src.orderItems) ? src.orderItems.map(function(o){
      return {productId:o.productId, qty:Math.max(1, +o.qty || 1), done:!!o.done};
    }) : [];
    S.orderHistory  = Array.isArray(src.orderHistory) ? src.orderHistory.slice(0, ORDER_HISTORY_MAX) : [];
  } else {
    S.orderProducts = ORDER_DEFAULT_PRODUCTS.map(normalizeOrderProduct);
    S.orderItems = [];
    S.orderHistory = [];
  }
  S.orderInit = true;
  saveData();
  return true;
}

// 서버/로컬 데이터 적용. Firebase는 빈 배열을 저장하지 않으므로(키 자체가 사라짐)
// orderInit 플래그가 있으면 없는 키는 빈 배열로 간주한다 (다른 기기에서 목록을 비운 경우 등).
function applyOrderData(d) {
  if (!d || !d.orderInit) return;
  S.orderInit = true;
  S.orderProducts = Array.isArray(d.orderProducts) ? d.orderProducts.filter(Boolean).map(normalizeOrderProduct) : [];
  S.orderItems    = Array.isArray(d.orderItems) ? d.orderItems.filter(Boolean) : [];
  S.orderHistory  = Array.isArray(d.orderHistory) ? d.orderHistory.filter(Boolean) : [];
}

function ensureOrderState() {
  if (!Array.isArray(S.orderProducts)) S.orderProducts = [];
  if (!Array.isArray(S.orderItems))    S.orderItems = [];
  if (!Array.isArray(S.orderHistory))  S.orderHistory = [];
}

// ── 헬퍼 ──
function orderProduct(id) {
  var list = S.orderProducts || [];
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
function orderNextId() {
  var max = 99;
  (S.orderProducts || []).forEach(function(p){ if (typeof p.id === 'number' && p.id > max) max = p.id; });
  return max + 1;
}
function opMin(p) { return p.priceMin || 0; }
function opMax(p) { return p.priceMax || 0; }
function opAvg(p) { return Math.round((opMin(p) + opMax(p)) / 2); }
function opHasPrice(p) { return opMin(p) > 0 || opMax(p) > 0; }
function won(n) { return (n || 0).toLocaleString() + '원'; }
function opPriceText(p) {
  if (!opHasPrice(p)) return '단가 없음';
  var avg = opAvg(p);
  if (opMin(p) === opMax(p) || !opMin(p) || !opMax(p)) return won(avg) + '/' + p.unit;
  return won(avg) + '/' + p.unit + ' (' + opMin(p).toLocaleString() + '~' + opMax(p).toLocaleString() + ')';
}
function orderCats() {
  var cats = ORDER_DEFAULT_CATS.slice();
  (S.orderProducts || []).forEach(function(p){ if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category); });
  return cats;
}
function orderUnits() {
  var units = ['kg','g','개','단','망','박스','팩','통','판','포기','병','L'];
  (S.orderProducts || []).forEach(function(p){ if (p.unit && units.indexOf(p.unit) < 0) units.push(p.unit); });
  return units;
}
function orderFmtDate(dateStr) {
  var days = ['일','월','화','수','목','금','토'];
  var d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr || '';
  return pad(d.getMonth()+1) + '/' + pad(d.getDate()) + '(' + days[d.getDay()] + ')';
}

// 상품의 평균 발주 주기(일) 및 D-Day 계산 (발주일 2회 이상일 때)
function orderCycleInfo(p) {
  var seen = {}, dates = [];
  (p.orderDates || []).forEach(function(d){ if (!seen[d]) { seen[d] = true; dates.push(d); } });
  dates.sort();
  if (dates.length < 2) return null;
  var sum = 0;
  for (var i = 1; i < dates.length; i++) {
    sum += (new Date(dates[i] + 'T00:00:00') - new Date(dates[i-1] + 'T00:00:00')) / 86400000;
  }
  var avgCycle = Math.max(1, Math.round(sum / (dates.length - 1)));
  var next = addDays(dates[dates.length-1], avgCycle);
  var dDays = Math.round((new Date(next + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000);
  return {avgCycle: avgCycle, dDays: dDays};
}
function orderCycleBadges(p) {
  var c = orderCycleInfo(p);
  if (!c) return '';
  var dStr = c.dDays > 0 ? 'D-' + c.dDays : c.dDays === 0 ? 'D-Day' : 'D+' + Math.abs(c.dDays);
  var cls = c.dDays <= 0 ? 'due' : c.dDays <= 2 ? 'soon' : 'ok';
  return '<span class="od-badge cycle" title="평균 발주 주기 ' + c.avgCycle + '일">~' + c.avgCycle + 'd</span>'
       + '<span class="od-badge dday ' + cls + '" title="다음 발주 예상일">' + dStr + '</span>';
}

// 발주 이벤트 기록: type = 'copy' | 'clear'
function recordOrderEvent(type) {
  if (!S.orderItems.length) return;
  var td = today();
  var items = S.orderItems.map(function(o){
    var p = orderProduct(o.productId);
    return {productId:o.productId, name:p ? p.name : '?', qty:o.qty, unit:p ? p.unit : ''};
  });
  S.orderHistory.unshift({date:td, ts:Date.now(), type:type, items:items});
  if (S.orderHistory.length > ORDER_HISTORY_MAX) S.orderHistory = S.orderHistory.slice(0, ORDER_HISTORY_MAX);
  S.orderItems.forEach(function(o){
    var p = orderProduct(o.productId);
    if (!p) return;
    if (!p.orderDates) p.orderDates = [];
    if (p.orderDates.indexOf(td) < 0) p.orderDates.push(td);
    p.usageCount = (p.usageCount || 0) + 1;
  });
}

function orderPreviewText() {
  var d = new Date();
  var lines = ['[' + pad(d.getMonth()+1) + '/' + pad(d.getDate()) + ' 발주]'];
  S.orderItems.forEach(function(o){
    var p = orderProduct(o.productId);
    if (p) lines.push(p.name + ' ' + o.qty + p.unit);
  });
  return lines.join('\n');
}

function copyText(text, onDone) {
  function fallback() {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch(e) { ok = false; }
    document.body.removeChild(ta);
    if (ok) onDone(); else showToast('복사 실패 — 미리보기를 길게 눌러 복사하세요');
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onDone).catch(fallback);
  } else fallback();
}

// ══════════════════════════════════════════════════════════
// 렌더
// ══════════════════════════════════════════════════════════
function renderOrderTab() {
  ensureOrderState();
  var tabs = document.querySelectorAll('#order-subtabs .staff-toptab');
  tabs.forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-sub') === orderSub); });
  var fab = document.getElementById('order-btn-add');
  if (fab) fab.style.display = (currentTab === 'order' && orderSub === 'db') ? 'flex' : 'none';

  var body = document.getElementById('order-body');
  if (!body) return;
  if (orderBuiltSub !== orderSub) {
    orderBuiltSub = orderSub;
    body.scrollTop = 0;
    if (orderSub === 'db') {
      body.innerHTML =
        '<div class="od-wrap">'
        + '<div class="od-db-top">'
          + '<input class="rv-srch" id="od-srch" type="search" placeholder="품목 검색…" value="' + esc(orderSearch) + '">'
          + '<div class="od-seg" role="group" aria-label="정렬">'
            + '<button class="od-seg-btn" data-act="sort" data-v="name">이름순</button>'
            + '<button class="od-seg-btn" data-act="sort" data-v="freq">사용빈도순</button>'
          + '</div>'
        + '</div>'
        + '<div class="od-hint-row"><span class="od-hint">품목을 누르면 발주 목록에 담기/빼기 됩니다.</span></div>'
        + '<div id="od-db-list"></div>'
        + '</div>';
      document.getElementById('od-srch').addEventListener('input', function(){
        orderSearch = this.value;
        renderOrderDbList();
      });
    } else {
      body.innerHTML = '<div class="od-wrap" id="od-content"></div>';
    }
  }
  if (orderSub === 'list') renderOrderList();
  else if (orderSub === 'db') renderOrderDbList();
  else renderOrderHistory();
}

// ── 발주 목록 ──
function renderOrderList() {
  var el = document.getElementById('od-content');
  if (!el) return;
  var items = S.orderItems.filter(function(o){ return !!orderProduct(o.productId); });
  var total = items.length;
  var done = items.filter(function(o){ return o.done; }).length;

  var sumAvg = 0, sumLow = 0, sumHigh = 0, priced = 0;
  items.forEach(function(o){
    var p = orderProduct(o.productId);
    if (!opHasPrice(p)) return;
    priced++;
    sumAvg  += opAvg(p) * o.qty;
    sumLow  += (opMin(p) || opMax(p)) * o.qty;
    sumHigh += (opMax(p) || opMin(p)) * o.qty;
  });
  var noPrice = total - priced;

  var html = ''
    + '<div class="od-stats">'
      + '<div class="od-stat"><div class="od-stat-n">' + total + '</div><div class="od-stat-l">전체</div></div>'
      + '<div class="od-stat"><div class="od-stat-n green">' + done + '</div><div class="od-stat-l">완료</div></div>'
      + '<div class="od-stat"><div class="od-stat-n amber">' + (total - done) + '</div><div class="od-stat-l">미완료</div></div>'
    + '</div>'
    + '<div class="od-price">'
      + '<div class="od-price-l">예상 발주 금액</div>'
      + '<div class="od-price-n">' + won(sumAvg) + '</div>'
      + (sumAvg > 0 && sumLow !== sumHigh ? '<div class="od-price-range">' + won(sumLow) + ' ~ ' + won(sumHigh) + '</div>' : '')
      + '<div class="od-price-sub">' + (total === 0 ? '품목을 담으면 단가 기준으로 계산돼요' : noPrice > 0 ? '단가 미입력 ' + noPrice + '개 품목 제외' : '전체 품목 합산') + '</div>'
    + '</div>';

  if (!total) {
    html += '<div class="od-empty">'
      + '<div class="od-empty-ic">🛒</div>'
      + '<div>발주 목록이 비어 있어요</div>'
      + '<button class="bp od-empty-btn" data-act="go-db">상품 관리에서 품목 선택</button>'
      + '</div>';
    el.innerHTML = html;
    return;
  }

  html += '<div class="od-items">';
  items.forEach(function(o){
    var p = orderProduct(o.productId);
    var avg = opAvg(p);
    html += '<div class="od-item' + (o.done ? ' done' : '') + '">'
      + '<div class="od-item-top">'
        + '<button class="od-check' + (o.done ? ' on' : '') + '" data-act="done" data-id="' + o.productId + '" aria-label="' + (o.done ? '완료 취소' : '완료 체크') + '">' + (o.done ? '✓' : '') + '</button>'
        + '<div class="od-item-name">' + esc(p.name) + '</div>'
        + '<div class="od-qty">'
          + '<button class="od-qty-btn" data-act="qty" data-id="' + o.productId + '" data-d="-1" aria-label="수량 감소">−</button>'
          + '<input class="od-qty-inp" type="number" min="1" inputmode="numeric" value="' + o.qty + '" data-id="' + o.productId + '" aria-label="수량">'
          + '<button class="od-qty-btn" data-act="qty" data-id="' + o.productId + '" data-d="1" aria-label="수량 증가">+</button>'
          + '<span class="od-unit">' + esc(p.unit) + '</span>'
        + '</div>'
        + '<button class="od-del" data-act="remove" data-id="' + o.productId + '" aria-label="목록에서 빼기">×</button>'
      + '</div>'
      + '<div class="od-item-price' + (opHasPrice(p) ? '' : ' none') + '">'
        + (opHasPrice(p) ? o.qty + p.unit + ' × ' + won(avg) + ' = <b>' + won(avg * o.qty) + '</b>' : '단가 미입력')
      + '</div>'
    + '</div>';
  });
  html += '</div>';

  html += '<div class="od-preview">'
      + '<div class="od-preview-hd">발주 내용 미리보기</div>'
      + '<div class="od-preview-txt">' + esc(orderPreviewText()) + '</div>'
    + '</div>'
    + '<div class="od-actions">'
      + '<button class="od-copy" id="od-copy-btn" data-act="copy">📋 발주 내용 복사</button>'
      + '<button class="od-clear" data-act="clear">초기화</button>'
    + '</div>';
  el.innerHTML = html;

  el.querySelectorAll('.od-qty-inp').forEach(function(inp){
    inp.addEventListener('change', function(){
      setOrderQty(+this.getAttribute('data-id'), this.value);
    });
  });
}

// ── 상품 관리 ──
function renderOrderDbList() {
  var el = document.getElementById('od-db-list');
  if (!el) return;
  document.querySelectorAll('#order-body .od-seg-btn').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-v') === orderDbSort);
  });
  var q = orderSearch.trim().toLowerCase();
  var list = (S.orderProducts || []).filter(function(p){ return !q || p.name.toLowerCase().indexOf(q) >= 0; });
  if (!(S.orderProducts || []).length) {
    el.innerHTML = '<div class="od-empty"><div class="od-empty-ic">🗂</div><div>등록된 품목이 없어요</div><div class="od-empty-sub">아래 + 품목 등록 버튼으로 추가하세요</div></div>';
    return;
  }
  if (!list.length) {
    el.innerHTML = '<div class="od-empty"><div>검색 결과가 없어요</div></div>';
    return;
  }
  var html = '';
  if (orderDbSort === 'freq') {
    list.sort(function(a,b){ return (b.usageCount||0) - (a.usageCount||0) || a.name.localeCompare(b.name,'ko'); });
    html += '<div class="od-db-items">' + list.map(orderDbRowHtml).join('') + '</div>';
  } else {
    orderCats().forEach(function(cat){
      var items = list.filter(function(p){ return p.category === cat; })
        .sort(function(a,b){ return a.name.localeCompare(b.name,'ko'); });
      if (!items.length) return;
      var collapsed = !q && !!orderCollapsed[cat];
      var selCnt = items.filter(function(p){ return isInOrder(p.id); }).length;
      html += '<div class="od-cat">'
        + '<button class="od-cat-hd" data-act="cat" data-cat="' + esc(cat) + '" aria-expanded="' + (!collapsed) + '">'
          + '<span class="od-cat-name">' + esc(cat) + '</span>'
          + '<span class="od-cat-cnt">' + items.length + '개' + (selCnt ? ' · ' + selCnt + '개 담음' : '') + '</span>'
          + '<span class="od-cat-chev">' + (collapsed ? '▸' : '▾') + '</span>'
        + '</button>'
        + (collapsed ? '' : '<div class="od-db-items">' + items.map(orderDbRowHtml).join('') + '</div>')
      + '</div>';
    });
  }
  el.innerHTML = html;
}

function isInOrder(id) {
  return S.orderItems.some(function(o){ return o.productId === id; });
}

function orderDbRowHtml(p) {
  var sel = isInOrder(p.id);
  var cnt = p.usageCount || 0;
  return '<div class="od-db-row' + (sel ? ' sel' : '') + '">'
    + '<button class="od-db-main" data-act="toggle" data-id="' + p.id + '" aria-pressed="' + sel + '">'
      + '<span class="od-db-chk">' + (sel ? '✓' : '') + '</span>'
      + '<span class="od-db-info">'
        + '<span class="od-db-name">' + esc(p.name) + '</span>'
        + '<span class="od-db-meta">'
          + '<span class="od-badge unit">' + esc(p.unit) + '</span>'
          + '<span class="od-db-price' + (opHasPrice(p) ? '' : ' none') + '">' + esc(opPriceText(p)) + '</span>'
          + (orderDbSort === 'freq' ? '<span class="od-badge freq' + (cnt ? '' : ' zero') + '">' + cnt + '회</span>' : '')
          + orderCycleBadges(p)
        + '</span>'
      + '</span>'
    + '</button>'
    + '<div class="od-db-acts">'
      + '<button class="bg" data-act="edit" data-id="' + p.id + '">수정</button>'
      + '<button class="bg od-db-del" data-act="del" data-id="' + p.id + '">삭제</button>'
    + '</div>'
  + '</div>';
}

// ── 발주 내역 ──
function renderOrderHistory() {
  var el = document.getElementById('od-content');
  if (!el) return;
  var hist = S.orderHistory || [];
  if (!hist.length) {
    el.innerHTML = '<div class="od-empty"><div class="od-empty-ic">📭</div><div>아직 발주 내역이 없어요</div><div class="od-empty-sub">발주 내용 복사 또는 목록 초기화 시 자동으로 기록돼요</div></div>';
    return;
  }
  el.innerHTML = '<div class="od-hist-list">' + hist.map(function(h, idx){
    var t = h.ts ? new Date(h.ts) : null;
    var time = t ? ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes()) : '';
    var items = h.items || [];
    return '<div class="od-hist">'
      + '<div class="od-hist-hd">'
        + '<span class="od-hist-date">' + esc(orderFmtDate(h.date)) + '<span class="od-hist-time">' + time + '</span></span>'
        + '<span class="od-badge ' + (h.type === 'copy' ? 'copy' : 'clear') + '">' + (h.type === 'copy' ? '복사' : '초기화') + '</span>'
        + '<span class="od-hist-cnt">' + items.length + '개 품목</span>'
        + '<button class="bg od-hist-btn" data-act="reorder" data-idx="' + idx + '">다시 담기</button>'
        + '<button class="od-del" data-act="hist-del" data-idx="' + idx + '" aria-label="내역 삭제">×</button>'
      + '</div>'
      + '<div class="od-hist-items">' + items.map(function(it){
          return '<span class="od-chip">' + esc(it.name) + ' ' + esc(String(it.qty)) + esc(it.unit || '') + '</span>';
        }).join('') + '</div>'
    + '</div>';
  }).join('') + '</div>';
}

// ══════════════════════════════════════════════════════════
// 동작
// ══════════════════════════════════════════════════════════
function orderChanged() {
  saveData();
  renderOrderTab();
}

function toggleOrderProduct(id) {
  var idx = -1;
  S.orderItems.forEach(function(o, i){ if (o.productId === id) idx = i; });
  if (idx >= 0) { S.orderItems.splice(idx, 1); showToast('발주 목록에서 뺐어요'); }
  else { S.orderItems.push({productId:id, qty:1, done:false}); showToast('✓ 발주 목록에 담았어요'); }
  orderChanged();
}
function toggleOrderDone(id) {
  S.orderItems.forEach(function(o){ if (o.productId === id) o.done = !o.done; });
  orderChanged();
}
function changeOrderQty(id, d) {
  S.orderItems.forEach(function(o){ if (o.productId === id) o.qty = Math.max(1, (o.qty || 1) + d); });
  orderChanged();
}
function setOrderQty(id, v) {
  S.orderItems.forEach(function(o){ if (o.productId === id) o.qty = Math.max(1, parseInt(v, 10) || 1); });
  orderChanged();
}
function removeOrderItem(id) {
  S.orderItems = S.orderItems.filter(function(o){ return o.productId !== id; });
  orderChanged();
}

function copyOrderList() {
  if (!S.orderItems.length) { showToast('발주 품목이 없어요'); return; }
  var text = orderPreviewText();
  copyText(text, function(){
    recordOrderEvent('copy');
    orderChanged();
    var btn = document.getElementById('od-copy-btn');
    if (btn) { btn.textContent = '✓ 복사 완료!'; btn.classList.add('copied'); }
    showToast('📋 클립보드에 복사됐어요 (발주 내역에 기록)');
  });
}

function confirmClearOrder() {
  if (!S.orderItems.length) { showToast('발주 목록이 비어 있어요'); return; }
  showConfirm('목록 초기화', '담긴 품목과 수량을 모두 비웁니다.\n현재 목록은 발주 내역에 기록돼요.', '초기화', function(){
    recordOrderEvent('clear');
    S.orderItems = [];
    showToast('발주 목록을 초기화했어요');
    orderChanged();
  });
}

function reorderFromHistory(idx) {
  var h = (S.orderHistory || [])[idx];
  if (!h) return;
  var added = 0, missing = 0;
  (h.items || []).forEach(function(it){
    var p = orderProduct(it.productId);
    if (!p) { missing++; return; }
    var ex = S.orderItems.filter(function(o){ return o.productId === p.id; })[0];
    if (ex) ex.qty = Math.max(ex.qty, +it.qty || 1);
    else { S.orderItems.push({productId:p.id, qty:Math.max(1, +it.qty || 1), done:false}); added++; }
  });
  orderSub = 'list';
  orderChanged();
  showToast('✓ ' + added + '개 품목을 담았어요' + (missing ? ' (삭제된 품목 ' + missing + '개 제외)' : ''));
}

function deleteOrderHistory(idx) {
  showConfirm('내역 삭제', '이 발주 내역을 삭제할까요?', '삭제', function(){
    S.orderHistory.splice(idx, 1);
    orderChanged();
  });
}

// ── 품목 추가/수정 모달 ──
function openOrderProductModal(id) {
  var p = id != null ? orderProduct(id) : null;
  var catList = orderCats().map(function(c){ return '<option value="' + esc(c) + '">'; }).join('');
  var unitList = orderUnits().map(function(u){ return '<option value="' + esc(u) + '">'; }).join('');
  showModal(
    '<div class="md-hd"><div class="md-title">' + (p ? '품목 수정' : '새 품목 등록') + '</div><button class="md-x" id="mxbtn" aria-label="닫기">×</button></div>'
    + '<div class="mb">'
    + '<div class="g2">'
      + '<div class="fg"><div class="fl">품목명 *</div><input class="fi" id="op-name" maxlength="40" placeholder="예: 양배추" value="' + esc(p ? p.name : '') + '"></div>'
      + '<div class="fg"><div class="fl">단위 *</div><input class="fi" id="op-unit" maxlength="10" list="op-unit-list" placeholder="예: 망" value="' + esc(p ? p.unit : '') + '"><datalist id="op-unit-list">' + unitList + '</datalist></div>'
    + '</div>'
    + '<div class="g2">'
      + '<div class="fg"><div class="fl">최소 단가 (원)</div><input class="fi" id="op-min" type="number" min="0" inputmode="numeric" placeholder="선택" value="' + (p && p.priceMin ? p.priceMin : '') + '"></div>'
      + '<div class="fg"><div class="fl">최대 단가 (원)</div><input class="fi" id="op-max" type="number" min="0" inputmode="numeric" placeholder="선택" value="' + (p && p.priceMax ? p.priceMax : '') + '"></div>'
    + '</div>'
    + '<div class="fg"><div class="fl">카테고리</div><input class="fi" id="op-cat" maxlength="20" list="op-cat-list" placeholder="목록에서 선택 또는 직접 입력" value="' + esc(p ? p.category : '채소') + '"><datalist id="op-cat-list">' + catList + '</datalist></div>'
    + (p ? '<div class="od-modal-meta">사용 ' + (p.usageCount || 0) + '회 · 최근 발주 ' + esc((p.orderDates || []).slice(-1)[0] || '없음') + '</div>' : '')
    + '<div class="abs">'
      + (p
        ? '<button class="ab" style="background:var(--surf3);color:var(--red2);" id="op-del">삭제</button>'
        : '<button class="ab" style="background:var(--surf3);color:var(--text2);" onclick="closeModal()">취소</button>')
      + '<button class="ab" style="background:var(--red);flex:2;" id="op-save">' + (p ? '저장' : '등록하기') + '</button>'
    + '</div>'
    + '</div>'
  );
  document.getElementById('op-save').addEventListener('click', function(){ saveOrderProduct(p ? p.id : null); });
  var del = document.getElementById('op-del');
  if (del) del.addEventListener('click', function(){ confirmDeleteOrderProduct(p.id); });
  document.getElementById('op-name').addEventListener('keydown', function(e){ if (e.key === 'Enter') saveOrderProduct(p ? p.id : null); });
  if (!p) setTimeout(function(){ var n = document.getElementById('op-name'); if (n) n.focus(); }, 150);
}

function saveOrderProduct(id) {
  var name = (document.getElementById('op-name').value || '').trim();
  var unit = (document.getElementById('op-unit').value || '').trim();
  var cat  = (document.getElementById('op-cat').value || '').trim() || '기타';
  var min  = parseInt(document.getElementById('op-min').value, 10) || 0;
  var max  = parseInt(document.getElementById('op-max').value, 10) || 0;
  if (!name || !unit) { showToast('품목명과 단위를 입력해 주세요'); return; }
  if (min && max && min > max) { var t = min; min = max; max = t; }
  var dup = (S.orderProducts || []).filter(function(x){ return x.id !== id && x.name.toLowerCase() === name.toLowerCase(); })[0];
  if (dup) { showToast('이미 같은 이름의 품목이 있어요'); return; }
  if (!S.orderInit) S.orderInit = true;
  if (id != null) {
    var p = orderProduct(id);
    if (p) { p.name = name; p.unit = unit; p.category = cat; p.priceMin = min; p.priceMax = max; }
    showToast('✅ 수정했어요');
  } else {
    S.orderProducts.push({id:orderNextId(), name:name, unit:unit, category:cat, priceMin:min, priceMax:max, usageCount:0, orderDates:[]});
    delete orderCollapsed[cat];
    showToast('✅ \'' + name + '\' 등록했어요');
  }
  closeModal();
  orderChanged();
}

function confirmDeleteOrderProduct(id) {
  var p = orderProduct(id);
  if (!p) return;
  showConfirm('품목 삭제', '\'' + p.name + '\' 품목을 삭제할까요?\n발주 목록에서도 빠집니다.', '삭제', function(){
    S.orderProducts = S.orderProducts.filter(function(x){ return x.id !== id; });
    S.orderItems = S.orderItems.filter(function(o){ return o.productId !== id; });
    showToast('🗑 \'' + p.name + '\' 삭제했어요');
    orderChanged();
  });
}

// ── 재고 탭 → 발주 목록 담기 ──
function addStockItemsToOrder(ids) {
  seedOrderDataIfNeeded();
  ensureOrderState();
  var added = 0;
  ids.forEach(function(sid){
    var item = (S.inventory || []).filter(function(i){ return i.id === sid; })[0];
    if (!item) return;
    var nm = (item.n || '').trim();
    var p = (S.orderProducts || []).filter(function(x){ return x.name.toLowerCase() === nm.toLowerCase(); })[0];
    if (!p) {
      p = {id:orderNextId(), name:nm, unit:item.unit || '개', category:item.cat || '기타', priceMin:0, priceMax:0, usageCount:0, orderDates:[]};
      S.orderProducts.push(p);
    }
    if (!isInOrder(p.id)) {
      S.orderItems.push({productId:p.id, qty:item.min > 0 ? item.min : 1, done:false});
      added++;
    }
  });
  S.orderInit = true;
  saveData();
  return added;
}

// ── 이벤트 바인딩 (발주) ──
document.getElementById('order-subtabs').addEventListener('click', function(e){
  var b = e.target.closest('.staff-toptab');
  if (!b) return;
  orderSub = b.getAttribute('data-sub');
  renderOrderTab();
});
document.getElementById('order-btn-add').addEventListener('click', function(){ openOrderProductModal(null); });
document.getElementById('order-body').addEventListener('click', function(e){
  var b = e.target.closest('[data-act]');
  if (!b) return;
  var act = b.getAttribute('data-act');
  var id = b.hasAttribute('data-id') ? +b.getAttribute('data-id') : null;
  var idx = b.hasAttribute('data-idx') ? +b.getAttribute('data-idx') : null;
  if (act === 'done') toggleOrderDone(id);
  else if (act === 'qty') changeOrderQty(id, +b.getAttribute('data-d'));
  else if (act === 'remove') removeOrderItem(id);
  else if (act === 'copy') copyOrderList();
  else if (act === 'clear') confirmClearOrder();
  else if (act === 'go-db') { orderSub = 'db'; renderOrderTab(); }
  else if (act === 'sort') { orderDbSort = b.getAttribute('data-v'); renderOrderDbList(); }
  else if (act === 'cat') {
    var c = b.getAttribute('data-cat');
    if (orderCollapsed[c]) delete orderCollapsed[c]; else orderCollapsed[c] = true;
    renderOrderDbList();
  }
  else if (act === 'toggle') toggleOrderProduct(id);
  else if (act === 'edit') openOrderProductModal(id);
  else if (act === 'del') confirmDeleteOrderProduct(id);
  else if (act === 'reorder') reorderFromHistory(idx);
  else if (act === 'hist-del') deleteOrderHistory(idx);
});
