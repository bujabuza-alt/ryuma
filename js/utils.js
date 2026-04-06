// ── 유틸 ──
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function uid()  { return Date.now() + '_' + Math.random().toString(36).slice(2,7); }
function pad(n) { return String(n).padStart(2,'0'); }
function fmtElapsed(ms) {
  var t=Math.floor(ms/1000), h=Math.floor(t/3600), m=Math.floor((t%3600)/60), s=t%60;
  return h ? h+':'+pad(m)+':'+pad(s) : pad(m)+':'+pad(s);
}
function fmtTime(ts) { var d=new Date(ts); return pad(d.getHours())+':'+pad(d.getMinutes()); }
function today()  { var d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function dlabel(s) {
  if (!s) return '';
  var p=s.split('-');
  return new Date(+p[0],+p[1]-1,+p[2]).toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'});
}
function fmtDateShort(s) {
  if (!s) return '';
  var p=s.split('-');
  return String(+p[0]).slice(2)+'년 '+parseInt(p[1])+'월 '+parseInt(p[2])+'일';
}
function addDays(dateStr, n) {
  var p=dateStr.split('-');
  var dt=new Date(+p[0],+p[1]-1,+p[2]);
  dt.setDate(dt.getDate()+n);
  return dt.getFullYear()+'-'+pad(dt.getMonth()+1)+'-'+pad(dt.getDate());
}
function renderFloorNav() {
  if (!S || !S.ress) return;
  var td=today(), DOW=['일','월','화','수','목','금','토'];
  // 날짜별 예약 건수 미리 계산
  var counts={};
  S.ress.forEach(function(r){if(r.st!=='cancelled'&&r.date)counts[r.date]=(counts[r.date]||0)+1;});
  var html='';
  for(var delta=-2;delta<=2;delta++){
    var d=addDays(td,delta);
    var p=d.split('-');
    var dt=new Date(+p[0],+p[1]-1,+p[2]);
    var isSel=(d===floorDate), isToday=(d===td);
    var dow=DOW[dt.getDay()];
    var cnt=counts[d]||0;
    var cls='fdn-btn'+(isSel?' sel':'')+(isToday&&!isSel?' fdn-today':'');
    // 예약 뱃지
    var cntHtml='<div class="fdn-cnt">'+(cnt>0?'<span class="fdn-cnt-badge">'+cnt+'</span>':'<span class="fdn-cnt-dot"></span>')+'</div>';
    if(isSel){
      var fullDate=String(+p[0]).slice(2)+'년 '+(+p[1])+'월 '+(+p[2])+'일';
      html+='<button class="'+cls+'" data-d="'+d+'">'
        +'<div class="fdn-dow">'+dow+(isToday?' · 오늘':'')+'</div>'
        +'<div class="fdn-full">'+fullDate+'</div>'
        +cntHtml
        +'</button>';
    } else {
      html+='<button class="'+cls+'" data-d="'+d+'">'
        +'<div class="fdn-dow">'+dow+(isToday?' · 오늘':'')+'</div>'
        +'<div class="fdn-date">'+(+p[1])+'/'+(+p[2])+'</div>'
        +cntHtml
        +'</button>';
    }
  }
  var el=document.getElementById('floor-nav');
  if(!el)return;
  el.innerHTML=html;
  el.querySelectorAll('.fdn-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      floorDate = this.getAttribute('data-d');
      S.tables.forEach(function(t){cardCache[t.id]='';});
      renderFloorNav();
      renderSidebar();
      if(viewMode==='list')renderListView();else renderCanvas();
    });
  });
}
function getVirtualTablesForDate(date) {
  return S.tables.map(function(tb){
    var res=null;
    for(var i=0;i<S.ress.length;i++){
      var r=S.ress[i];
      if(r.tableId===tb.id&&r.date===date&&r.st!=='cancelled'&&r.st!=='noshow'){res=r;break;}
    }
    if(res){
      var ro={name:res.nm,g:res.g,time:res.time,date:res.date,phone:res.phone,memo:res.memo,tags:res.tags,resId:res.id};
      return Object.assign({},tb,{st:'reserved',res:ro,seatTime:null});
    }
    return Object.assign({},tb,{st:'empty',g:0,seatTime:null,res:null});
  });
}
function mkTable(t) {
  var shape = t.shape || (t.t==='바'?'bar':t.t==='6인'?'wide':'sq');
  var sz    = t.sz    || (t.t==='바'?'s':t.t==='6인'?'l':'m');
  var cap   = t.c || (shape==='wide'?6:shape==='bar'?2:4);
  return {id:t.id, n:t.n, shape:shape, sz:sz, c:cap, px:t.px, py:t.py, st:'empty', g:0, seatTime:null, res:null};
}
function isSlaveTbl(tid) {
  return S.tables.some(function(t){ return t.mergeIds && t.mergeIds.indexOf(tid) >= 0; });
}
function getMasterOfSlave(tid) {
  return S.tables.filter(function(t){ return t.mergeIds && t.mergeIds.indexOf(tid) >= 0; })[0] || null;
}
function getNextGroupName() {
  var num = 1;
  S.tables.forEach(function(t){
    if (t.mergeName) {
      var m = t.mergeName.match(/^단체(\d+)$/);
      if (m && parseInt(m[1]) >= num) num = parseInt(m[1]) + 1;
    }
  });
  return '단체' + num;
}
function randomVividColor() {
  return VIVID_COLORS[Math.floor(Math.random() * VIVID_COLORS.length)];
}
function tblColor(st, seatTime, merged) {
  var isLight = document.body.classList.contains('light');

// 🔥 이 줄 추가
if (!seatTime && st !== 'reserved') {
  return isLight
    ? {bg:'#f5f3f0', bd:'#d8d2c8', tx:'#a09880'}
    : {bg:'#1c1a18', bd:'#3a3835', tx:'#5a5248'};
}
  if (st==='empty' && merged) return isLight
    ? {bg:'rgba(90,82,200,.07)', bd:'rgba(90,82,200,.45)', tx:'#4840b0'}
    : {bg:'rgba(90,82,200,.14)', bd:'var(--indigo)',       tx:'#a78bfa'};
  if (st==='empty')    return isLight
    ? {bg:'#f5f3f0', bd:'#d8d2c8', tx:'#a09880'}
    : {bg:'#1c1a18', bd:'#3a3835', tx:'#5a5248'};
  if (st==='reserved') return isLight
    ? {bg:'rgba(42,114,200,.08)', bd:'rgba(42,114,200,.5)', tx:'#1a5aaa'}
    : {bg:'rgba(42,114,200,.12)', bd:'var(--blue)',         tx:'#60a5fa'};
  var e = Date.now() - seatTime;
  if (e < 3600000) return isLight
    ? {bg:'rgba(200,146,42,.1)',  bd:'#b07818', tx:'#7a5210'}
    : {bg:'rgba(200,146,42,.1)',  bd:'var(--amber)', tx:'var(--amber)'};
  if (e < 5400000) return isLight
    ? {bg:'rgba(200,112,48,.12)', bd:'#c87030', tx:'#7c3810'}
    : {bg:'rgba(200,112,48,.1)',  bd:'#c87030', tx:'#c87030'};
  return isLight
    ? {bg:'rgba(196,18,48,.08)',  bd:'var(--red)', tx:'var(--red2)'}
    : {bg:'rgba(196,18,48,.12)',  bd:'var(--red)', tx:'var(--red2)'};
}
function cardSz(shape, sz, W, H) {
  var bw = {s:0.17, m:0.26, l:0.36}[sz] || 0.26;
  // 가로모드(W>H)에서는 캔버스 높이가 작으므로 카드 크기를 비례 축소
  if (W > H) bw = bw * 0.75;
  var w  = Math.round(W * bw);
  var ratio = shape==='wide' ? 0.52 : shape==='bar' ? 0.32 : 1.0;
  var h = Math.round(w * ratio);
  if (h < 28) h = 28;
  return {w:w, h:h};
}
function doneCnt() {
  var td = today();
  return (S.daily||[]).filter(function(d){ return d.date===td; }).length
       + S.ress.filter(function(r){ return r.st==='completed' && r.date===td; }).length;
}


// ── 모달 ──
function showModal(html){
  var mdc=document.getElementById('mdc'); mdc.className='md'; mdc.innerHTML=html;
  document.getElementById('mo').classList.add('on');
  var x=document.getElementById('mxbtn'); if(x)x.addEventListener('click',closeModal);
}
function closeModal(){ document.getElementById('mo').classList.remove('on'); document.getElementById('mdc').innerHTML=''; }

// ── 헬퍼 ──
// ── 인원 드롭다운 (1~50) ──
function guestSelectHtml(id, val, max) {
  // max: 착석 테이블 기반 최대인원 (없으면 50)
  var limit = max || 50;
  var html = '<select class="fi" id="'+id+'" style="font-size:16px;font-weight:700">';
  for (var i = 1; i <= limit; i++) {
    html += '<option value="'+i+'"'+(i===val?' selected':'')+'>'+i+'명</option>';
  }
  html += '</select>';
  return html;
}
function getGuestVal(id) {
  var el = document.getElementById(id);
  return el ? +el.value : 1;
}
function bindGbs(cid,ac,cb){
  var c=document.getElementById(cid); if(!c)return;
  c.querySelectorAll('.gb').forEach(function(btn){
    btn.addEventListener('click',function(){var n=+this.getAttribute('data-n');c.querySelectorAll('.gb').forEach(function(b){b.className='gb';});this.className='gb '+ac;cb(n);});
  });
}
function phHtml(id,val){ var dv=val?val.replace(/^010-?/,''):''; return '<div class="phone-wrap"><span class="phone-pfx">010</span><span class="phone-sep">-</span><input class="phone-inp" id="'+id+'" type="tel" maxlength="9" placeholder="0000-0000" value="'+esc(dv)+'"></div>'; }
function bindPh(id){ var el=document.getElementById(id); if(!el)return; el.addEventListener('input',function(){var v=this.value.replace(/\D/g,'');if(v.length>8)v=v.slice(0,8);if(v.length>4)v=v.slice(0,4)+'-'+v.slice(4);this.value=v;}); }
function getPh(id){ var el=document.getElementById(id); if(!el||!el.value.replace(/\D/g,''))return''; return'010-'+el.value; }
function tagHtml(pid,sel){ return '<div class="tag-picker" id="'+pid+'">'+S.tags.map(function(t){var on=(sel||[]).indexOf(t)>=0;return'<button type="button" class="tag-pill'+(on?' on':'')+'" data-tag="'+esc(t)+'">'+esc(t)+'</button>';}).join('')+'<button type="button" class="tag-add-btn" id="'+pid+'_mgr">⚙ 태그</button></div>'; }
function bindTag(pid){ var c=document.getElementById(pid); if(!c)return; c.querySelectorAll('.tag-pill').forEach(function(btn){btn.addEventListener('click',function(){this.classList.toggle('on');});}); var m=document.getElementById(pid+'_mgr'); if(m)m.addEventListener('click',openTagMgr); }
function getTags(pid){ var c=document.getElementById(pid); if(!c)return[]; var r=[]; c.querySelectorAll('.tag-pill.on').forEach(function(b){r.push(b.getAttribute('data-tag'));}); return r; }

// ── 토스트 알림 ──
function showToast(msg) {
  var t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);'
    + 'background:var(--surf3);color:var(--text);border:1px solid var(--border2);'
    + 'border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;'
    + 'z-index:9999;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.4);'
    + 'transition:opacity .3s ease;pointer-events:none;';
  document.body.appendChild(t);
  setTimeout(function(){ t.style.opacity='0'; }, 2200);
  setTimeout(function(){ t.parentNode && t.parentNode.removeChild(t); }, 2600);
}
