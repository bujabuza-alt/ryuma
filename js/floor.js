// ── 홀 현황 (Floor View) ──
var custFilterMode = 'active'; // 'active' | 'cancel'
var hallViewMode = 'monthly';  // 'monthly' | 'weekly' | 'hall'
var schedCalYear  = new Date().getFullYear();
var schedCalMonth = new Date().getMonth(); // 0-indexed
var schedSelDate  = null; // currently selected date in schedule calendar
// ── 헤더/통계 ──
function renderHeader() {
  document.getElementById('hdate').textContent = new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'});
  var occ = S.tables.filter(function(t){ return t.st==='occupied'; }).length;
  var rsv = S.tables.filter(function(t){ return t.st==='reserved'; }).length;
  document.getElementById('c1').textContent = '착석 '+occ+'/'+S.tables.length;
  document.getElementById('c2').textContent = '예약 '+rsv;
  document.getElementById('c3').textContent = '완료 '+doneCnt();
}
function renderStats() {
  var guests = S.tables.reduce(function(a,t){ return a+(t.st==='occupied'?t.g:0); }, 0);
  var occ    = S.tables.filter(function(t){ return t.st==='occupied'; }).length;
  var emp    = S.tables.filter(function(t){ return t.st==='empty'; }).length;
  document.getElementById('s1').textContent = guests+'명';
  document.getElementById('s2').textContent = occ+'개';
  document.getElementById('s3').textContent = emp+'개';
}

// ── 사이드바 ──
function renderSidebar() {
  var c = document.getElementById('sb-scroll');
  var td = today();
  var sideDate = floorDate || td;
  var isToday = (sideDate === td);
  var html = '';
  var stC = {confirmed:'#2a9a5a', pending:'var(--amber)', arrived:'var(--blue)'};
  var stL = {confirmed:'확정', pending:'대기', arrived:'방문'};
  var rvList = S.ress.filter(function(r){
    return r.date===sideDate && r.st!=='cancelled' && r.st!=='noshow' && r.st!=='completed';
  }).sort(function(a,b){ return (a.time||'')<(b.time||'')?-1:1; });
  var secLabel = isToday ? '오늘 예약' : fmtDateShort(sideDate)+' 예약';
  html += '<div class="sb-sec"><span class="sb-sec-t">'+secLabel+'</span><span class="sb-sec-c">'+rvList.length+'건</span></div>';
  if (rvList.length) {
    rvList.forEach(function(r) {
      var floorTbls=getRvTableIds(r).map(function(tid){return S.tables.filter(function(t){return t.id===tid;})[0];}).filter(Boolean);
      var sc  = stC[r.st] || '#5a5248';
      html += '<div class="ri" data-rid="'+esc(String(r.id))+'">'
        + '<div class="ri-top"><span class="ri-time">'+esc(r.time||'–')+'</span>'
        + '<span class="ri-name">'+esc(r.nm)+'</span><span class="ri-g">'+esc(String(r.g))+'명</span></div>'
        + '<div class="ri-sub"><span class="ri-dot" style="background:'+sc+'"></span>'
        + '<span>'+esc(stL[r.st]||r.st)+'</span>'
        + (floorTbls.length ? '<span class="ri-tbl">· 🪑'+floorTbls.map(function(t){return esc(t.n);}).join('+')+' </span>' : '<span style="color:var(--amber)">· 미배정</span>')
        + '</div></div>';
    });
  } else { html += '<div class="sb-empty">'+(isToday?'오늘':fmtDateShort(sideDate))+' 예약 없음</div>'; }

  var walkins = (S.daily||[]).filter(function(d){ return d.date===sideDate; });
  var rvDone  = S.ress.filter(function(r){ return r.st==='completed' && r.date===sideDate; });
  var doneTotal = walkins.length + rvDone.length;
  var doneLabel = isToday ? '완료' : fmtDateShort(sideDate)+' 완료';
  html += '<div class="sb-sec"><span class="sb-sec-t">'+doneLabel+'</span><span class="sb-sec-c">'+doneTotal+'팀</span></div>';
  if (doneTotal) {
    var items = [];
    walkins.forEach(function(d){ items.push({isRes:false,name:d.tname,g:d.g,sub:fmtTime(d.seatTime)+'→'+fmtTime(d.endTime),k:d.endTime}); });
    rvDone.forEach(function(r){ items.push({isRes:true,name:r.nm,g:r.g,sub:r.time||'—',k:r.time?parseInt(r.time.replace(':',''),10):0}); });
    items.sort(function(a,b){ return a.k-b.k; });
    items.forEach(function(it) {
      html += '<div class="di"><div class="di-top">'
        + '<span class="di-badge" style="background:'+(it.isRes?'rgba(42,114,200,.15)':'rgba(42,154,90,.15)')+';color:'+(it.isRes?'var(--blue)':'var(--green)')+'">'+(it.isRes?'예약':'워크인')+'</span>'
        + '<span class="di-name">'+esc(it.name)+'</span><span class="di-g">'+esc(String(it.g))+'명</span></div>'
        + '<div class="di-sub">'+esc(it.sub)+'</div></div>';
    });
  } else { html += '<div class="sb-empty">완료 없음</div>'; }

  c.innerHTML = html;
  c.querySelectorAll('.ri').forEach(function(el){ el.addEventListener('click', function(){ openRvDetail(this.getAttribute('data-rid')); }); });
}

// ── 탭 전환 ──
function switchTab(t) {
  currentTab = t;
  document.getElementById('t1').className = 'tab' + (t==='floor'?' on':'');
  document.getElementById('t2').className = 'tab' + (t==='reserve'?' on':'');
  document.getElementById('t3').className = 'tab' + (t==='cust'?' on':'');
  document.getElementById('t4').className = 'tab' + (t==='stock'?' on':'');
  document.getElementById('sb').style.display   = t==='floor'?'flex':'none';
  document.getElementById('main').style.display = t==='floor'?'flex':'none';
  if (t==='reserve') document.getElementById('rv').classList.add('on');
  else document.getElementById('rv').classList.remove('on');
  if (t==='cust') document.getElementById('cust').classList.add('on');
  else document.getElementById('cust').classList.remove('on');
  if (t==='stock') document.getElementById('stock').classList.add('on');
  else document.getElementById('stock').classList.remove('on');
  // FAB visibility managed here since it lives outside #stock
  var fab = document.getElementById('stock-btn-add');
  if (fab) fab.style.display = (t==='stock') ? 'flex' : 'none';
  // bedit/btn-view shown only in hall canvas mode; renderAll() handles this for floor tab
  document.getElementById('bedit').style.display = (t==='floor' && hallViewMode==='hall') ? '' : 'none';
  document.getElementById('btn-view').style.display = (t==='floor' && hallViewMode==='hall') ? '' : 'none';
  if (t==='floor') renderAll();
  else if (t==='reserve') renderReservations();
  else if (t==='cust') renderCustTab();
  else if (t==='stock') renderStock();
}
function getAllCustomers() {
  var map = {};
  S.ress.forEach(function(r) {
    if (!r.phone) return;
    if (!map[r.phone]) map[r.phone] = {name:'', phone:r.phone, latestDate:'', visitDates:[], memo:''};
    if ((r.date||'') >= map[r.phone].latestDate) {
      map[r.phone].latestDate = r.date||'';
      map[r.phone].name = r.nm||'';
    }
    if (r.st==='arrived' || r.st==='completed') map[r.phone].visitDates.push(r.date);
  });
  (S.customers||[]).forEach(function(c) {
    if (!map[c.phone]) map[c.phone] = {name:c.name||'', phone:c.phone, latestDate:'', visitDates:[], memo:''};
    map[c.phone].memo = c.memo||'';
    if (!map[c.phone].name) map[c.phone].name = c.name||'';
  });
  return Object.keys(map).map(function(phone) {
    var c = map[phone]; c.visitDates.sort();
    c.total = c.visitDates.length;
    c.first = c.visitDates.length ? c.visitDates[0] : null;
    c.last  = c.visitDates.length ? c.visitDates[c.visitDates.length-1] : null;
    return c;
  });
}
function renderCustTab() {
  var q = (document.getElementById('custsrch').value||'').trim().toLowerCase();
  var sortEl = document.getElementById('custsort');
  // Show sort control only in active-customer mode
  if (sortEl) sortEl.style.display = custFilterMode === 'active' ? '' : 'none';

  if (custFilterMode === 'cancel') {
    // ── 취소된 예약 표시 ──
    var list = S.ress.filter(function(r){ return r.st === 'cancelled'; });
    if (q) list = list.filter(function(r){ return (r.nm||'').toLowerCase().indexOf(q)>=0||(r.phone||'').indexOf(q)>=0; });
    list.sort(function(a,b){
      var ka=(a.date||'0000')+(a.time||'00:00'), kb=(b.date||'0000')+(b.time||'00:00');
      return ka>kb?-1:1;
    });
    var html='';
    if(!list.length){
      html='<div style="padding:32px;text-align:center;color:var(--text3);font-size:13px">취소된 예약 없음</div>';
    } else {
      html=list.map(function(r){
        var tbl=r.tableId?S.tables.filter(function(t){return t.id===r.tableId;})[0]:null;
        return '<div class="rvi" data-rid="'+esc(String(r.id))+'">'
          +'<div class="rvi-t">'+esc(r.time||'–')+'</div>'
          +'<div class="rvi-b"><div class="rvi-n">'+esc(r.nm)+'</div>'
          +'<div class="rvi-s">'+(r.date?dlabel(r.date)+' ':'')+r.g+'명'+(r.phone?' · '+esc(r.phone):'')
          +(tbl?' · <span style="color:var(--blue)">🪑'+esc(tbl.n)+'</span>':'')+'</div>'
          +(r.tags&&r.tags.length?'<div class="rvi-tags">'+r.tags.map(function(t){return'<span class="rvi-tag">'+esc(t)+'</span>';}).join('')+'</div>':'')
          +(r.memo?'<div class="rvi-m">📝'+esc(r.memo)+'</div>':'')
          +'</div><div class="rvi-st" style="color:var(--text3);background:var(--surf3)">취소</div></div>';
      }).join('');
    }
    document.getElementById('custlist').innerHTML=html;
    document.getElementById('custlist').querySelectorAll('.rvi').forEach(function(el){
      el.addEventListener('click',function(){openRvDetail(this.getAttribute('data-rid'));});
    });
  } else {
    // ── 활성 손님 목록 표시 ──
    var sortBy = sortEl ? (sortEl.value||'visits') : 'visits';
    var custs = getAllCustomers();
    if (q) custs = custs.filter(function(c){return (c.name||'').toLowerCase().indexOf(q)>=0||(c.phone||'').indexOf(q)>=0;});
    custs.sort(function(a,b){
      if (sortBy==='visits') return b.total - a.total;
      if (sortBy==='recent') return (b.last||'')>(a.last||'')?1:(b.last||'')<(a.last||'')?-1:0;
      return (a.name||'').localeCompare(b.name||'','ko');
    });
    var html='';
    custs.forEach(function(c){
      var av=(c.name||c.phone||'?').charAt(0);
      html+='<div class="cust-card" data-phone="'+esc(c.phone)+'" data-name="'+esc(c.name||'')+'">'
        +'<div class="cust-av">'+esc(av)+'</div>'
        +'<div class="cust-main">'
        +'<div class="cust-name">'+esc(c.name||c.phone)+'</div>'
        +'<div class="cust-phone">'+esc(c.phone)+'</div>'
        +'<div class="cust-meta">'
        +(c.first?'<div class="cust-meta-item">첫 방문 <b>'+fmtDateShort(c.first)+'</b></div>':'')
        +(c.last&&c.last!==c.first?'<div class="cust-meta-item">최근 <b>'+fmtDateShort(c.last)+'</b></div>':'')
        +(c.memo?'<div class="cust-meta-item">📝 '+esc(c.memo.slice(0,24))+'</div>':'')
        +'</div>'
        +'</div>'
        +(c.total>0?'<div class="cust-badge">'+c.total+'회</div>':'<div class="cust-no-visit">방문 없음</div>')
        +'</div>';
    });
    if(!html) html='<div style="padding:32px;text-align:center;color:var(--text3);font-size:13px">손님 정보 없음</div>';
    document.getElementById('custlist').innerHTML=html;
    document.getElementById('custlist').querySelectorAll('.cust-card').forEach(function(el){
      el.addEventListener('click',function(){openCustInfo(this.getAttribute('data-phone'),this.getAttribute('data-name'));});
    });
  }
}

// ── 캔버스 렌더 ──
function renderCanvas() {
  var panel = document.getElementById('cv'), inner = document.getElementById('cvi');
  var W = panel.offsetWidth;
  if (!W) { setTimeout(renderCanvas, 50); return; }
  var isLandscape = window.innerWidth > window.innerHeight;
  var H = Math.round(W * (isLandscape ? 0.7 : 1.25));
  if (parseInt(panel.style.height) !== H) panel.style.height = H+'px';
  var now = Date.now();
  var activeDate = floorDate || today();
  var displayTables = (activeDate === today()) ? S.tables : getVirtualTablesForDate(activeDate);

  var visible = {};
  displayTables.forEach(function(tb){ visible[tb.id] = true; });
  inner.querySelectorAll('.tc').forEach(function(node){
    var id = +(node.id || '').replace('tc','');
    if (!visible[id]) node.remove();
  });
  displayTables.forEach(function(tb) {
    var card = document.getElementById('tc'+tb.id);
    if (!card) {
      card = document.createElement('div'); card.id = 'tc'+tb.id;
      inner.appendChild(card); bindCard(card, tb.id); cardCache[tb.id]='';
    }
    var isSlave = isSlaveTbl(tb.id);
    var masterForSlave = isSlave ? getMasterOfSlave(tb.id) : null;
    var isMaster = !!(tb.mergeIds && tb.mergeIds.length);
    var isMerged = isMaster || isSlave;
    var groupColor = isSlave ? (masterForSlave && masterForSlave.mergeColor) : tb.mergeColor;
    var groupName  = isSlave ? (masterForSlave && (masterForSlave.mergeName || masterForSlave.n)) : (tb.mergeName || null);

    // 슬레이브 테이블: 그룹 색상 적용, 빈 상태로 처리
    var c;
    if (groupColor && isMerged) {
      var _gr=parseInt(groupColor.slice(1,3),16), _gg=parseInt(groupColor.slice(3,5),16), _gb=parseInt(groupColor.slice(5,7),16);
      c = {bg:'rgba('+_gr+','+_gg+','+_gb+',.18)', bd:groupColor, tx:groupColor};
    } else {
      c = tblColor(tb.st, tb.seatTime, isMerged);
    }
    var sz = cardSz(tb.shape||'sq', tb.sz||'m', W, H);
    var x  = Math.max(0, Math.min(W-sz.w, Math.round(tb.px/100*W)));
    var y  = Math.max(0, Math.min(H-sz.h, Math.round(tb.py/100*H)));
    card.style.left=x+'px'; card.style.top=y+'px';
    card.style.width=sz.w+'px'; card.style.height=sz.h+'px';
    card.style.background=c.bg; card.style.borderColor=c.bd;
    card.style.borderWidth=tb.st==='occupied'?'2px':'1.5px';
    card.style.padding=(tb.shape==='bar')?'5px 9px':'8px 9px 7px';
    card.style.cursor=editMode?'grab':'pointer';
    card.style.boxShadow=editMode?'0 0 0 2px rgba(196,18,48,.3)':'';
    if (isSlave && !editMode) card.style.opacity='0.82';
    else card.style.opacity='';
    var wasDrag = card.classList.contains('drag');
    var cls = 'tc' + (wasDrag?' drag':'');
    if (isMaster) cls += ' merge-master';
    if (isSlave)  cls += ' merge-slave';
    if (mergeSelectMode && isMergeSelectable(tb.id, mergeMasterId)) cls += ' merge-candidate';
    if (mergeSelectMode && mergeSelectedIds.indexOf(tb.id) >= 0) cls += ' merge-selected';
    card.className = cls;
    var isLightMode = document.body.classList.contains('light');
    var dot = tb.st==='occupied'?'#2a9a5a':tb.st==='reserved'?'var(--blue)':(isMerged?(groupColor||'var(--indigo)'):(isLightMode?'#c8c0b0':'#3a3835'));
    var elMin = tb.st==='occupied'?Math.floor((now-tb.seatTime)/60000):0;
    var assigned = getAssignedReservationsForTable(tb.id, activeDate);
    var assignedTotal = assigned.length;
    var extraTeams = Math.max(0, assignedTotal - 1);
    var mergedCount = (tb.mergeIds && tb.mergeIds.length) ? tb.mergeIds.length : 0;
    var key = tb.st+'|'+tb.g+'|'+(tb.seatTime||0)+'|'+elMin+'|'+(tb.res?JSON.stringify(tb.res):'')+
              '|'+editMode+'|'+tb.shape+'|'+tb.sz+'|'+(isMerged?1:0)+'|'+assignedTotal+'|'+mergedCount+
              '|'+(isSlave?'s':'m')+'|'+(groupColor||'')+'|'+(groupName||'');
    if (cardCache[tb.id]===key) return;
    cardCache[tb.id]=key;
    var html='';
    var isBar = tb.shape==='bar';
    var elapsed = tb.st==='occupied' ? now - tb.seatTime : 0;
    var isOvertime = elapsed >= 5400000;
    var elapsedTxt = elapsed ? (isOvertime ? '+' : '') + fmtElapsed(elapsed) : '';
    var dotColor = editMode ? 'rgba(196,18,48,.5)' : dot;

    // 슬레이브 테이블: 그룹 소속 표시
    if (isSlave) {
      var slaveNameColor = groupColor || '#a78bfa';
      if (isBar) {
        html = '<div style="display:flex;justify-content:space-between;align-items:center;width:100%;height:100%">'
             + '<div class="tc-name" style="color:'+slaveNameColor+'">'+esc(tb.n)+'</div>'
             + '<div style="font-size:9px;color:'+slaveNameColor+';opacity:.8;text-align:right">🔗'+(groupName?esc(groupName):'묶음')+'</div>'
             + '</div>';
      } else {
        html = '<div class="tc-hd">'
             + '<div class="tc-name" style="color:'+slaveNameColor+'">'+esc(tb.n)+'</div>'
             + '<div style="width:7px;height:7px;border-radius:50%;background:'+slaveNameColor+';flex-shrink:0;margin-top:2px"></div>'
             + '</div>'
             + '<div class="tc-info"><div style="font-size:10px;color:'+slaveNameColor+';font-weight:700;opacity:.85">🔗 '+(groupName?esc(groupName):'묶음')+'</div></div>';
      }
      card.innerHTML = html;
      return;
    }

    if (isBar) {
      html = '<div style="display:flex;justify-content:space-between;align-items:center;width:100%;height:100%">'
           + '<div class="tc-name" style="color:'+c.tx+'">'+esc(tb.n)+'</div>';
      if (editMode) {
        html += '<div class="tc-dot" style="background:'+dotColor+'"></div>';
      } else if (tb.st==='occupied') {
        html += '<div class="tc-bar-r">'
              + '<div class="tc-strong" style="color:'+c.tx+'">'+fmtTime(tb.seatTime||Date.now())+'</div>'
              + '<div class="tc-meta" style="color:'+c.tx+'">'+esc(String(tb.g))+'명 · '+elapsedTxt+'</div>'
              + '</div>';
      } else if (tb.st==='reserved') {
        var priNameB = esc(tb.res&&tb.res.name||'');
        var priTimeB = esc(tb.res&&tb.res.time||'');
        var priGB = tb.res&&tb.res.g ? esc(String(tb.res.g))+'명' : '';
        var priTagsB = (tb.res&&tb.res.tags&&tb.res.tags.length)
          ? tb.res.tags.slice(0,2).map(function(tg){ return '<span class="tc-tag">'+esc(tg)+'</span>'; }).join('')
          : '';
        html += '<div class="tc-bar-r">'
              + (priNameB ? '<div style="font-size:15px;font-weight:900;color:'+c.tx+';line-height:1.2">'+priNameB+'</div>' : '')
              + '<div style="font-size:12px;font-weight:700;color:'+c.tx+'">'+('<b>'+(priTimeB||'시간 미정')+'</b>')+(priGB ? ' · '+priGB : '')+'</div>'
              + (priTagsB ? '<div class="tc-tags">'+priTagsB+'</div>' : '')
              + '</div>';
      } else {
        html += '<div class="tc-dot" style="background:'+dotColor+'"></div>';
      }
      html += '</div>';
    } else {
      // Square / Wide
      html = '<div class="tc-hd">'
           + '<div class="tc-name" style="color:'+c.tx+'">'+esc(tb.n)+'</div>'
           + '<div class="tc-dot" style="background:'+dotColor+'"></div>'
           + '</div>';

      if (!editMode) {
        if (tb.st==='occupied') {
          html += '<div class="tc-info">'
                + '<div class="tc-info-row" style="color:'+c.tx+'">'+fmtTime(tb.seatTime||Date.now())+'</div>'
                + '<div class="tc-info-sub" style="color:'+c.tx+'">'+esc(String(tb.g))+'명 · '+(isOvertime?'<span style="font-weight:800">'+elapsedTxt+'</span>':elapsedTxt)+'</div>'
                + '</div>';
        } else if (tb.st==='reserved') {
          var resName = esc(tb.res&&tb.res.name||'');
          var resTime = esc(tb.res&&tb.res.time||'');
          var resG = tb.res&&tb.res.g ? esc(String(tb.res.g))+'명' : '';
          var resTags = (tb.res&&tb.res.tags&&tb.res.tags.length)
            ? tb.res.tags.slice(0,2).map(function(tg){ return '<span class="tc-tag">'+esc(tg)+'</span>'; }).join('')
            : '';
          html += '<div class="tc-info">'
                + (resName ? '<div style="font-size:16px;font-weight:900;color:'+c.tx+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.2">'+resName+'</div>' : '')
                + '<div style="font-size:13px;font-weight:700;color:'+c.tx+';margin-top:1px">'+('<b>'+(resTime||'시간 미정')+'</b>')+(resG ? ' · '+resG : '')+'</div>'
                + (resTags ? '<div class="tc-tags">'+resTags+'</div>' : '')
                + '</div>';
        } else if (isMaster) {
          var masterLabel = groupName ? esc(groupName) : getMergedNames(tb.id).join(' + ');
          html += '<div class="tc-info">'
                + '<div style="font-size:10px;color:'+(groupColor||'#a78bfa')+';font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🔗 '+masterLabel+'</div>'
                + '</div>';
        }
      }
    }
    if (!editMode && extraTeams > 0) {
      html += '<div class="tc-team-pill" style="position:absolute;left:8px;bottom:6px">+'+extraTeams+'팀</div>';
    }
    if (mergedCount > 0) {
      html += '<div class="merge-badge">+'+mergedCount+'</div>';
    }
    card.innerHTML = html;
  });
}

// ── 드래그 ──
function bindCard(card, tid) {
  var dragging=false, lpt=null, tapAt=0, lastMergeTapTime=0;
  card.addEventListener('touchstart', function(e){
    tapAt=Date.now();
    if(!editMode && !mergeSelectMode) return;
    if(!editMode) return; // mergeSelectMode는 touchend에서 처리
    var touch=e.touches[0];
    lpt=setTimeout(function(){ dragging=true; card.classList.add('drag'); startDrag(card,tid,touch.clientX,touch.clientY); },180);
  }, {passive:true});
  card.addEventListener('touchmove', function(e){
    if(!editMode)return; if(lpt){clearTimeout(lpt);lpt=null;} if(!dragging)return; e.preventDefault();
    moveDrag(e.touches[0].clientX, e.touches[0].clientY, card, tid);
  }, {passive:false});
  card.addEventListener('touchend', function(){
    if(lpt){clearTimeout(lpt);lpt=null;}
    if(dragging){dragging=false;card.classList.remove('drag');snapCard(tid);saveData();return;}
    if(mergeSelectMode && Date.now()-tapAt<400){
      lastMergeTapTime=Date.now();
      toggleMergeCandidate(tid); return;
    }
    if(!editMode && Date.now()-tapAt<280) openTableModal(tid);
  });
  card.addEventListener('mousedown', function(e){
    if(!editMode)return; dragging=true; card.classList.add('drag'); startDrag(card,tid,e.clientX,e.clientY);
    function onMove(ev){moveDrag(ev.clientX,ev.clientY,card,tid);}
    function onUp(){dragging=false;card.classList.remove('drag');snapCard(tid);saveData();document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);}
    document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp);
  });
  card.addEventListener('click', function(){
    if (mergeSelectMode) {
      if (Date.now()-lastMergeTapTime < 450) return; // 터치 후 중복 클릭 방지
      toggleMergeCandidate(tid); return;
    }
    openTableModal(tid);
  });
}
function startDrag(card,tid,cx,cy){
  var r=card.getBoundingClientRect(); dragOffset={x:cx-r.left,y:cy-r.top};
  dragPanelRect=document.getElementById('cv').getBoundingClientRect();
}
function moveDrag(cx,cy,card,tid){
  if(!dragPanelRect)return;
  var p=document.getElementById('cv'), W=p.offsetWidth, H=p.offsetHeight;
  var tb=S.tables.filter(function(t){return t.id===tid;})[0];
  var sz=cardSz(tb?tb.shape:'sq', tb?tb.sz:'m', W, H);
  var nx=Math.max(0,Math.min(W-sz.w, cx-dragPanelRect.left-dragOffset.x));
  var ny=Math.max(0,Math.min(H-sz.h, cy-dragPanelRect.top-dragOffset.y));
  card.style.left=nx+'px'; card.style.top=ny+'px';
  S.tables=S.tables.map(function(t){return t.id===tid?Object.assign({},t,{px:nx/W*100,py:ny/H*100}):t;});
  cardCache[tid]='';
}
function snapCard(tid){
  var p=document.getElementById('cv'), W=p.offsetWidth, H=p.offsetHeight;
  var SNAP=Math.round(W*.04), GAP=Math.round(W*.015);
  var me=S.tables.filter(function(t){return t.id===tid;})[0]; if(!me)return;
  var sz=cardSz(me.shape,me.sz,W,H), px=me.px/100*W, py=me.py/100*H;
  var xa=[0,W-sz.w], ya=[0,H-sz.h];
  S.tables.filter(function(t){return t.id!==tid;}).forEach(function(t){
    var s2=cardSz(t.shape,t.sz,W,H), ox=t.px/100*W, oy=t.py/100*H;
    xa.push(ox, ox+s2.w+GAP, ox+s2.w-sz.w); ya.push(oy, oy+s2.h+GAP, oy+s2.h-sz.h);
  });
  var bx=px,bdx=SNAP; xa.forEach(function(a){var d=Math.abs(px-a);if(d<bdx){bdx=d;bx=a;}});
  var by=py,bdy=SNAP; ya.forEach(function(a){var d=Math.abs(py-a);if(d<bdy){bdy=d;by=a;}});
  bx=Math.max(0,Math.min(W-sz.w,bx)); by=Math.max(0,Math.min(H-sz.h,by));
  var card=document.getElementById('tc'+tid);
  if(card){card.style.transition='left .18s,top .18s';card.style.left=bx+'px';card.style.top=by+'px';setTimeout(function(){if(card)card.style.transition='';},200);}
  S.tables=S.tables.map(function(t){return t.id===tid?Object.assign({},t,{px:bx/W*100,py:by/H*100}):t;});
}
function toggleEdit(){
  editMode=!editMode;
  var btn=document.getElementById('bedit'), cv=document.getElementById('cv'), hint=document.getElementById('ehint');
  var vbtn=document.getElementById('btn-view');
  S.tables.forEach(function(t){cardCache[t.id]='';});
  if(editMode){
    btn.textContent='✅'; btn.classList.add('on');
    // 편집 모드는 항상 홀 캔버스 뷰로 전환
    hallViewMode='hall';
    cv.classList.add('em'); hint.textContent='테이블 탭 → 편집/삭제 · 길게 누르고 드래그';
    if(vbtn) vbtn.style.display='none';
    if(viewMode!=='canvas'){ viewMode='canvas'; updateViewUI(); }
    var ab=document.createElement('button'); ab.id='baddtbl'; ab.className='bp';
    ab.style.cssText='position:absolute;bottom:10px;right:10px;z-index:10;font-size:11px;padding:6px 10px;';
    ab.textContent='+ 테이블 추가';
    ab.addEventListener('click',function(e){e.stopPropagation();openAddTableModal();});
    cv.appendChild(ab);
    renderAll();
  } else {
    btn.textContent='✏️'; btn.classList.remove('on');
    cv.classList.remove('em'); hint.textContent='';
    if(vbtn) vbtn.style.display='';
    var a2=document.getElementById('baddtbl'); if(a2)a2.remove(); saveData();
    // 편집 완료 후 스케줄 뷰로 복귀
    var activeVm = document.querySelector('.sb-vm-btn.on');
    hallViewMode = activeVm ? (activeVm.getAttribute('data-vm')||'monthly') : 'monthly';
    renderAll();
  }
}

// ── 테이블 형태/크기 선택 ──
function toggleView(){
  viewMode = (viewMode==='canvas') ? 'list' : 'canvas';
  updateViewUI();
  if(viewMode==='list') renderListView();
  else renderCanvas();
}
function updateViewUI(){
  var btn=document.getElementById('btn-view');
  var cv=document.getElementById('cv');
  var lv=document.getElementById('listview');
  var leg=document.getElementById('leg');
  if(viewMode==='list'){
    if(cv) cv.style.display='none';
    if(lv) lv.classList.add('on');
    if(leg) leg.style.display='none';
    if(btn) btn.textContent='⊞';
  } else {
    if(cv) cv.style.display='';
    if(lv) lv.classList.remove('on');
    if(leg) leg.style.display='';
    if(btn) btn.textContent='☰';
  }
}
function renderListView(){
  var el=document.getElementById('listview'); if(!el)return;
  var now=Date.now();
  var shapeLabel={'sq':'정방형','wide':'가로형','bar':'바형'};
  var html='';
  var activeDate = floorDate || today();
  var displayTables=(activeDate===today())?S.tables:getVirtualTablesForDate(activeDate);
  displayTables=displayTables.filter(function(tb){ return !isSlaveTbl(tb.id); });
  displayTables.forEach(function(tb){
    var activeDate = floorDate || today();
    var assignedCnt = getAssignedReservationsForTable(tb.id, activeDate).length;
    var extraTeams = Math.max(0, assignedCnt - 1);
    var isMerged = !!(tb.mergeIds && tb.mergeIds.length) || isSlaveTbl(tb.id);
    var c=tblColor(tb.st,tb.seatTime,isMerged);
    var statusHtml='', subHtml='', timeHtml='';
    var barColor=c.bd;
    if(tb.st==='occupied'){
      statusHtml='<div class="lv-status" style="color:'+c.tx+'">착석중</div>';
      subHtml=tb.g+'명';
      timeHtml='<div style="text-align:right"><div style="font-weight:800;font-size:13px;color:'+c.tx+'">'+fmtElapsed(now-tb.seatTime)+'</div><div style="font-size:10px;color:var(--text3)">'+fmtTime(tb.seatTime)+' 착석</div></div>';
    } else if(tb.st==='reserved'){
      statusHtml='<div class="lv-status" style="color:var(--blue)">예약</div>';
      subHtml=esc(tb.res&&tb.res.name||'')+(tb.res&&tb.res.g?' · '+tb.res.g+'명':'');
      timeHtml='<div style="font-weight:800;font-size:14px;color:var(--blue)">'+esc(tb.res&&tb.res.time||'')+'</div>';
    } else {
      statusHtml='<div class="lv-status" style="color:'+(isMerged?'#a78bfa':'var(--text3)')+'">빈 테이블'+(isMerged?' · 합석':'')+'</div>';
      subHtml=({sq:'정방형',wide:'가로형',bar:'바형'}[tb.shape]||'')+' · '+tb.c+'인';
      barColor=isMerged?'var(--indigo)':c.bd;
    }
    html+='<div class="lv-item" data-tid="'+tb.id+'">'
      +'<div class="lv-bar" style="background:'+barColor+'"></div>'
      +'<div class="lv-name">'+esc(tb.n)+'</div>'
      +'<div class="lv-info">'+statusHtml+'<div class="lv-sub">'+subHtml+'</div></div>'
      +(extraTeams>0?'<div class="tc-team-pill" style="margin-left:2px">+'+extraTeams+'팀</div>':'')
      +timeHtml
      +'</div>';
  });
  if(!html) html='<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">테이블 없음</div>';
  el.innerHTML=html;
  el.querySelectorAll('.lv-item').forEach(function(item){
    item.addEventListener('click',function(){
      openTableModal(+this.getAttribute('data-tid'));
    });
  });
}
// ── 테이블 묶기 ──
// merges: [{masterId, slaveIds:[]}] — S.tables 각 테이블에 mergeGroup 필드로 저장
function getMergedCap(tid) {
  var tb = S.tables.filter(function(t){ return t.id===tid; })[0];
  if (!tb) return 50;
  var base = tb.c || 4;
  if (!tb.mergeIds || !tb.mergeIds.length) return Math.max(base, 50);
  var extra = 0;
  tb.mergeIds.forEach(function(mid){
    var mt = S.tables.filter(function(t){ return t.id===mid; })[0];
    if (mt) extra += (mt.c || 4);
  });
  return base + extra;
}
function getMergedNames(tid) {
  var tb = S.tables.filter(function(t){ return t.id===tid; })[0];
  if (!tb || !tb.mergeIds || !tb.mergeIds.length) return [];
  return tb.mergeIds.map(function(mid){
    var mt = S.tables.filter(function(t){ return t.id===mid; })[0];
    return mt ? mt.n : '';
  }).filter(Boolean);
}
function getAssignedReservationsForTable(tid, date) {
  return S.ress.filter(function(r){
    return getRvTableIds(r).indexOf(tid)>=0 && r.date===date && r.st!=='cancelled' && r.st!=='noshow';
  }).sort(function(a,b){
    return (a.time||'')<(b.time||'')?-1:1;
  });
}
function isMergeSelectable(tid, masterId) {
  if (tid === masterId) return false;
  var t = S.tables.filter(function(x){ return x.id===tid; })[0];
  if (!t) return false;
  if (t.st !== 'empty') return false;
  var isSlave = S.tables.some(function(mt){
    return mt.id !== masterId && mt.mergeIds && mt.mergeIds.indexOf(tid) >= 0;
  });
  return !isSlave;
}
function teardownMergeToolbar() {
  var bar = document.getElementById('merge-toolbar');
  if (bar) bar.remove();
}
function finishMergeSelection(save) {
  if (save && mergeMasterId != null && mergeSelectedIds.length > 0) {
    confirmAndSaveMerge();
    return;
  }
  if (save && mergeMasterId != null) {
    // 선택된 테이블 없이 저장 → 기존 묶음 해제
    S.tables = S.tables.map(function(t){
      if (t.id === mergeMasterId) return Object.assign({}, t, {mergeIds:[], mergeName:undefined, mergeColor:undefined});
      return t;
    });
  }
  mergeSelectMode = false;
  mergeMasterId = null;
  mergeSelectedIds = [];
  teardownMergeToolbar();
  var hint=document.getElementById('ehint');
  if (hint) hint.textContent='';
  if (save) saveData();
  renderAll();
}
function confirmAndSaveMerge() {
  var ids = mergeSelectedIds.slice();
  var masterId = mergeMasterId;
  var master = S.tables.filter(function(t){ return t.id===masterId; })[0];
  var defaultName = (master && master.mergeName) || getNextGroupName();
  var defaultColor = (master && master.mergeColor) || randomVividColor();
  var selectedColor = defaultColor;

  var swatchesHtml = VIVID_COLORS.map(function(col){
    var isSelected = col === defaultColor;
    return '<button type="button" class="merge-color-swatch" data-color="'+col+'"'
      +' style="background:'+col+';'+(isSelected?'outline:3px solid #fff;outline-offset:2px;':'')+'"></button>';
  }).join('');

  teardownMergeToolbar();
  showModal('<div class="md-hd"><span class="md-title">묶음 그룹 설정</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb">'
    +'<div class="fg"><label class="fl">그룹 이름 <span style="color:var(--text3);font-weight:400">(비워두면 자동)</span></label>'
    +'<input class="fi" id="merge-gname" placeholder="'+esc(defaultName)+'" value="'+esc(defaultName)+'"></div>'
    +'<div class="fg"><label class="fl">그룹 색상</label>'
    +'<div class="merge-color-row" id="merge-color-row">'+swatchesHtml+'</div></div>'
    +'<div style="font-size:11px;color:var(--text3)">묶을 테이블: '+ids.map(function(mid){var t=S.tables.filter(function(x){return x.id===mid;})[0];return t?esc(t.n):'?';}).join(', ')+'</div>'
    +'<button class="ab" style="background:var(--indigo);width:100%" id="merge-confirm-btn">묶기 완료</button>'
    +'</div>');

  document.getElementById('merge-color-row').querySelectorAll('.merge-color-swatch').forEach(function(btn){
    btn.addEventListener('click', function(){
      selectedColor = this.getAttribute('data-color');
      document.getElementById('merge-color-row').querySelectorAll('.merge-color-swatch').forEach(function(b){
        b.style.outline=''; b.style.outlineOffset='';
      });
      this.style.outline='3px solid #fff';
      this.style.outlineOffset='2px';
    });
  });

  document.getElementById('merge-confirm-btn').addEventListener('click', function(){
    var nm = (document.getElementById('merge-gname').value||'').trim() || defaultName;
    S.tables = S.tables.map(function(t){
      if (t.id === masterId) return Object.assign({}, t, {mergeIds: ids, mergeName: nm, mergeColor: selectedColor});
      return t;
    });
    mergeSelectMode = false;
    mergeMasterId = null;
    mergeSelectedIds = [];
    var hint=document.getElementById('ehint');
    if (hint) hint.textContent='';
    closeModal();
    saveData();
    renderAll();
  });
}
function startMergeSelection(masterId) {
  var master = S.tables.filter(function(t){ return t.id===masterId; })[0];
  if (!master) return;
  mergeSelectMode = true;
  mergeMasterId = masterId;
  mergeSelectedIds = (master.mergeIds || []).filter(function(mid){ return isMergeSelectable(mid, masterId); });
  if (viewMode !== 'canvas') { viewMode='canvas'; updateViewUI(); }
  var hint=document.getElementById('ehint');
  if (hint) hint.textContent='묶을 테이블 선택 후 저장';
  teardownMergeToolbar();
  var cv = document.getElementById('cv');
  if (cv) {
    var bar = document.createElement('div');
    bar.id = 'merge-toolbar';
    bar.style.cssText = 'position:absolute;left:10px;right:10px;bottom:10px;z-index:12;display:flex;gap:8px;';
    bar.innerHTML =
      '<button type="button" class="ab" id="merge-cancel" style="background:var(--surf3);color:var(--text2)">취소</button>' +
      '<button type="button" class="ab" id="merge-save2" style="background:var(--indigo)">묶기 저장</button>';
    cv.appendChild(bar);
    document.getElementById('merge-cancel').addEventListener('click', function(e){ e.stopPropagation(); finishMergeSelection(false); });
    document.getElementById('merge-save2').addEventListener('click', function(e){ e.stopPropagation(); finishMergeSelection(true); });
  }
  renderCanvas();
}
function toggleMergeCandidate(tid) {
  if (!mergeSelectMode || mergeMasterId == null) return;
  if (!isMergeSelectable(tid, mergeMasterId)) return;
  var idx = mergeSelectedIds.indexOf(tid);
  if (idx >= 0) mergeSelectedIds.splice(idx, 1);
  else mergeSelectedIds.push(tid);
  renderCanvas();
}
function openMergeModal(masterId) {
  var master = S.tables.filter(function(t){ return t.id===masterId; })[0];
  if (!master) return;
  // 현재 묶인 테이블 목록
  var currentMergeIds = master.mergeIds ? master.mergeIds.slice() : [];
  // 묶을 수 있는 테이블: 빈 테이블 중 자신 제외, 다른 곳에 묶이지 않은 것
  var available = S.tables.filter(function(t){
    if (t.id === masterId) return false;
    if (t.st !== 'empty') return false;
    // 이미 다른 테이블의 slave인지 확인
    var isSlave = S.tables.some(function(mt){
      return mt.id !== masterId && mt.mergeIds && mt.mergeIds.indexOf(t.id) >= 0;
    });
    return !isSlave;
  });
  var itemsHtml = available.length ? available.map(function(t){
    var isMerged = currentMergeIds.indexOf(t.id) >= 0;
    return '<button type="button" class="tpb" data-mid="'+t.id+'" style="border-color:'+(isMerged?'var(--indigo)':'var(--border2)')+';background:'+(isMerged?'rgba(90,82,200,.12)':'var(--surf2)')+'">'
      +'<span style="color:'+(isMerged?'#a78bfa':'var(--text)')+'">'+esc(t.n)+'</span>'
      +'<span class="tps">'+t.c+'인 '+(isMerged?'✓ 묶임':'')+'</span></button>';
  }).join('') : '<p style="color:var(--text3);font-size:13px;text-align:center;padding:16px 0">묶을 수 있는 빈 테이블 없음</p>';

  var totalCap = master.c + currentMergeIds.reduce(function(a,mid){
    var mt=S.tables.filter(function(t){return t.id===mid;})[0]; return a+(mt?mt.c:0);
  },0);

  showModal('<div class="md-hd"><span class="md-title">'+esc(master.n)+' 테이블 묶기</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb">'
    +'<div style="font-size:12px;color:var(--text2);margin-bottom:10px">테이블을 선택하면 합쳐서 운영할 수 있어요<br>현재 최대 <span id="merge-cap-disp" style="font-weight:800;color:var(--indigo)">'+totalCap+'명</span></div>'
    +'<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px" id="merge-list">'+itemsHtml+'</div>'
    +'<div class="abs">'
    +'<button class="ab" style="background:var(--red)" id="merge-clear">묶기 해제</button>'
    +'<button class="ab" style="background:var(--indigo)" id="merge-save">저장</button>'
    +'</div></div>');

  // 토글
  document.getElementById('merge-list').querySelectorAll('[data-mid]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var mid = +this.getAttribute('data-mid');
      var idx = currentMergeIds.indexOf(mid);
      if (idx >= 0) currentMergeIds.splice(idx, 1);
      else currentMergeIds.push(mid);
      // UI 업데이트
      var newTotal = master.c + currentMergeIds.reduce(function(a,m){
        var mt=S.tables.filter(function(t){return t.id===m;})[0]; return a+(mt?mt.c:0);
      },0);
      document.getElementById('merge-cap-disp').textContent = newTotal+'명';
      var isMergedNow = currentMergeIds.indexOf(mid) >= 0;
      this.style.borderColor = isMergedNow?'var(--indigo)':'var(--border2)';
      this.style.background  = isMergedNow?'rgba(90,82,200,.12)':'var(--surf2)';
      this.querySelector('span').style.color = isMergedNow?'#a78bfa':'var(--text)';
      this.querySelector('.tps').textContent = S.tables.filter(function(t){return t.id===mid;})[0].c+'인 '+(isMergedNow?'✓ 묶임':'');
    });
  });
  document.getElementById('merge-save').addEventListener('click', function(){
    S.tables = S.tables.map(function(t){
      if (t.id === masterId) return Object.assign({},t,{mergeIds: currentMergeIds.slice()});
      return t;
    });
    closeModal(); saveData(); renderAll();
  });
  document.getElementById('merge-clear').addEventListener('click', function(){
    S.tables = S.tables.map(function(t){
      if (t.id === masterId) return Object.assign({},t,{mergeIds:[]});
      return t;
    });
    closeModal(); saveData(); renderAll();
  });
}
function shapeHtml(sel) {
  var shapes=[{k:'sq',l:'정방형',w:32,h:32},{k:'wide',l:'가로형',w:38,h:22},{k:'bar',l:'바형',w:44,h:16}];
  var html='<div class="shape-grid" id="shape-picker">';
  shapes.forEach(function(s){
    html+='<button type="button" class="shape-btn'+(s.k===sel?' on':'')+'" data-shape="'+s.k+'">'
      +'<div class="shape-preview" style="width:'+s.w+'px;height:'+s.h+'px;margin:0 auto"></div>'
      +'<div class="shape-label">'+s.l+'</div></button>';
  });
  return html+'</div>';
}
function sizeHtml(sel) {
  var sizes=[{k:'s',l:'S',sub:'작게'},{k:'m',l:'M',sub:'보통'},{k:'l',l:'L',sub:'크게'}];
  var html='<div class="size-row" id="size-picker">';
  sizes.forEach(function(s){
    html+='<button type="button" class="size-btn'+(s.k===sel?' on':'')+'" data-sz="'+s.k+'">'
      +'<div class="size-label">'+s.l+'</div><div class="size-sub">'+s.sub+'</div></button>';
  });
  return html+'</div>';
}
function bindPickers() {
  var sp=document.getElementById('shape-picker'), szp=document.getElementById('size-picker');
  if(sp) sp.querySelectorAll('.shape-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      sp.querySelectorAll('.shape-btn').forEach(function(b){b.classList.remove('on');});
      this.classList.add('on'); _editShape=this.getAttribute('data-shape');
    });
  });
  if(szp) szp.querySelectorAll('.size-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      szp.querySelectorAll('.size-btn').forEach(function(b){b.classList.remove('on');});
      this.classList.add('on'); _editSz=this.getAttribute('data-sz');
    });
  });
}
function tblCap(shape,sz){ if(shape==='bar')return 2; return {s:2,m:4,l:6}[sz]||4; }
function openAddTableModal(){
  _editShape='sq'; _editSz='m';
  showModal('<div class="md-hd"><span class="md-title">테이블 추가</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb"><div class="fg"><label class="fl">테이블 이름</label><input class="fi" id="atn" placeholder="예: 룸1, 테라스A"></div>'
    +'<div class="fg"><label class="fl">형태</label>'+shapeHtml('sq')+'</div>'
    +'<div class="fg"><label class="fl">크기</label>'+sizeHtml('m')+'</div>'
    +'<button class="ab" style="background:var(--red);width:100%;margin-top:4px" id="atsubmit">추가</button></div>');
  bindPickers();
  document.getElementById('atsubmit').addEventListener('click',function(){
    var nm=document.getElementById('atn').value.trim(); if(!nm){alert('이름을 입력하세요');return;}
    var newId=Date.now();
    S.tables.push({id:newId,n:nm,shape:_editShape,sz:_editSz,c:tblCap(_editShape,_editSz),px:35,py:40,st:'empty',g:0,seatTime:null,res:null});
    cardCache[newId]=''; closeModal(); saveData(); renderCanvas();
  });
}
function openEditTableModal(tid){
  var tb=S.tables.filter(function(t){return t.id===tid;})[0]; if(!tb)return;
  _editShape=tb.shape||'sq'; _editSz=tb.sz||'m';
  showModal('<div class="md-hd"><span class="md-title">테이블 편집</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb"><div class="fg"><label class="fl">테이블 이름</label><input class="fi" id="etn" value="'+esc(tb.n)+'"></div>'
    +'<div class="fg"><label class="fl">형태</label>'+shapeHtml(_editShape)+'</div>'
    +'<div class="fg"><label class="fl">크기</label>'+sizeHtml(_editSz)+'</div>'
    +'<button class="ab" style="background:var(--indigo);width:100%;margin-top:4px" id="etsubmit">저장</button></div>');
  bindPickers();
  document.getElementById('etsubmit').addEventListener('click',function(){
    var nm=document.getElementById('etn').value.trim(); if(!nm){alert('이름을 입력하세요');return;}
    S.tables=S.tables.map(function(t){return t.id===tid?Object.assign({},t,{n:nm,shape:_editShape,sz:_editSz,c:tblCap(_editShape,_editSz)}):t;});
    cardCache[tid]=''; closeModal(); saveData(); renderCanvas();
  });
}
function deleteTable(tid){
  var tb=S.tables.filter(function(t){return t.id===tid;})[0]; if(!tb)return;
  if(tb.st!=='empty'){alert('빈 테이블만 삭제 가능합니다');return;}
  if(!confirm('"'+tb.n+'" 테이블을 삭제할까요?'))return;
  S.tables=S.tables.filter(function(t){return t.id!==tid;});
  var card=document.getElementById('tc'+tid); if(card)card.remove(); delete cardCache[tid];
  saveData(); renderCanvas();
}

// ── 대기자 ──
function openWaitModal(){
  gvWait=2; var n=new Date(), nt=pad(n.getHours())+':'+pad(n.getMinutes());
  showModal('<div class="md-hd"><span class="md-title">대기자 추가</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb"><div class="fg"><label class="fl">이름</label><input class="fi" id="wn" placeholder="고객 이름"></div>'
    +'<div class="fg"><label class="fl">인원</label>'+guestSelectHtml('g-wait', 2, 50)+'</div>'
    +'<div class="g2"><div class="fg"><label class="fl">연락처(선택)</label>'+phHtml('wp','')+'</div>'
    +'<div class="fg"><label class="fl">접수 시간</label><input class="fi" id="wt" type="time" value="'+nt+'"></div></div>'
    +'<div class="fg"><label class="fl">태그(선택)</label>'+tagHtml('wtags',[])+'</div>'
    +'<div class="fg"><label class="fl">메모(선택)</label><textarea class="fi" id="wm" placeholder="특이사항…"></textarea></div>'
    +'<button class="ab" style="background:var(--red);width:100%" id="wsubmit">대기 등록</button></div>');
  bindPh('wp'); bindTag('wtags');
  document.getElementById('wsubmit').addEventListener('click',function(){
    var nm=document.getElementById('wn').value.trim(); if(!nm){alert('이름을 입력하세요');return;}
    S.waits.push({id:uid(),nm:nm,g:getGuestVal('g-wait'),phone:getPh('wp'),time:document.getElementById('wt').value,
      tags:getTags('wtags'),memo:document.getElementById('wm').value,since:Date.now()});
    closeModal(); saveData(); renderAll();
  });
}
function openSeatWaiter(wid){
  var w=S.waits.filter(function(x){return x.id==wid;})[0]; if(!w)return;
  var avail=S.tables.filter(function(t){return t.st==='empty'&&t.c>=w.g;});
  var tbH=avail.length
    ?avail.map(function(t){return '<button class="tpb" data-tid="'+t.id+'"><span>'+esc(t.n)+'</span><span class="tps">'+({'sq':'정방형','wide':'가로형','bar':'바형'}[t.shape]||t.shape)+' '+t.sz.toUpperCase()+'·'+t.c+'인</span></button>';}).join('')
    :'<p style="color:var(--text3);font-size:13px;text-align:center;padding:10px 0">적합한 빈 테이블 없음</p>';
  showModal('<div class="md-hd"><span class="md-title">'+esc(w.nm)+'('+w.g+'명) 착석</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="ib" style="background:var(--surf2);border-color:var(--border2)">'
    +'<div class="ir"><span class="il">대기 경과</span><span class="iv">'+fmtElapsed(Date.now()-w.since)+'</span></div>'
    +(w.time?'<div class="ir"><span class="il">접수</span><span class="iv">'+esc(w.time)+'</span></div>':'')
    +(w.phone?'<div class="ir"><span class="il">연락처</span><span class="iv"><a href="tel:'+esc(w.phone)+'" style="color:#60a5fa;text-decoration:none">'+esc(w.phone)+'</a></span></div>':'')
    +(w.memo?'<div class="ir"><span class="il">메모</span><span class="iv" style="text-align:right;max-width:160px">'+esc(w.memo)+'</span></div>':'')
    +'</div><p style="font-size:13px;color:var(--text2);margin-bottom:9px">착석할 테이블을 선택하세요</p>'
    +'<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">'+tbH+'</div>'
    +'<button class="ab" style="background:var(--red);width:100%" id="wdel">대기자 삭제</button>');
  document.getElementById('mdc').querySelectorAll('.tpb').forEach(function(btn){
    btn.addEventListener('click',function(){
      var tid=+this.getAttribute('data-tid');
      S.tables=S.tables.map(function(t){return t.id===tid?Object.assign({},t,{st:'occupied',g:w.g,seatTime:Date.now()}):t;});
      S.waits=S.waits.filter(function(x){return x.id!=wid;}); closeModal(); saveData(); renderAll();
    });
  });
  document.getElementById('wdel').addEventListener('click',function(){
    S.waits=S.waits.filter(function(x){return x.id!=wid;}); closeModal(); saveData(); renderAll();
  });
}

// ── 테이블 모달 ──
function openTableModal(tid){
  // 편집 모드 및 실제 테이블 데이터는 항상 S.tables에서 가져옴
  var realTb = S.tables.filter(function(t){ return t.id === tid; })[0];
  if(!realTb) return;

  // 슬레이브 테이블 → 마스터 모달로 이동
  if (isSlaveTbl(tid)) {
    var master = getMasterOfSlave(tid);
    if (master) { openTableModal(master.id); return; }
  }

  if(editMode){
    showModal('<div class="md-hd"><span class="md-title">'+esc(realTb.n)+' 테이블</span><button class="md-x" id="mxbtn">×</button></div>'
      +'<div class="mb">'
      +'<button class="ab" style="background:var(--indigo);width:100%" id="tbl-edit-btn">✏️ 이름 · 형태 변경</button>'
      +'<button class="ab" style="background:var(--red);width:100%;margin-top:0" id="tbl-del-btn">🗑 테이블 삭제</button>'
      +'</div>');
    document.getElementById('tbl-edit-btn').addEventListener('click',function(){ closeModal(); openEditTableModal(tid); });
    document.getElementById('tbl-del-btn').addEventListener('click',function(){ closeModal(); deleteTable(tid); });
    return;
  }

  // 현재 보고 있는 날짜에 맞는 테이블 상태 가져오기
  var activeDate = floorDate || today();
  var isViewingToday = (activeDate === today());
  var tb = isViewingToday ? realTb : (getVirtualTablesForDate(activeDate).filter(function(t){ return t.id === tid; })[0] || realTb);

  gvFloor = tb.g || 2;

  if(tb.st==='occupied') showOccupied(tb, isViewingToday);
  else if(tb.st==='reserved') showReserved(tb, isViewingToday);
  else showEmpty(tb, isViewingToday);

// ====================== 여기부터 추가 ======================
  // 묶여있는 테이블인 경우 "묶음 풀기" 버튼을 모달에 추가
  if (tb.mergeIds && tb.mergeIds.length > 0) {
    setTimeout(() => {
      const unmergeBtn = document.createElement('button');
      unmergeBtn.className = 'ab';
      unmergeBtn.style.cssText = 'background:var(--red); width:100%; margin-top:8px;';
      unmergeBtn.innerHTML = '🔓 테이블 묶음 풀기';
      unmergeBtn.id = 'btn-unmerge';

      // 모달에 버튼 추가 (.mb가 있으면 거기에, 없으면 #mdc에 직접 추가)
      const mbArea = document.querySelector('#mdc .mb') || document.querySelector('#mdc');
      if (mbArea) {
        mbArea.appendChild(unmergeBtn);
      }

      // 버튼 클릭 시 → 확인창 없이 바로 풀기
      unmergeBtn.addEventListener('click', function() {
        unmergeTables(tid);
      });
    }, 30);   // 모달이 완전히 렌더링된 후에 버튼 추가
  }
  // ====================== 여기까지 추가 ======================

  }function tableAssignedListHtml(tid){
  var d = floorDate || today();
  var list = getAssignedReservationsForTable(tid, d).filter(function(r){ return r.st!=='completed'; });
  if (!list.length) return '';
  var stMap = {confirmed:'확정', pending:'대기', arrived:'방문'};
  return '<div class="fg" style="margin-top:2px">'
    + '<div class="fl" style="font-weight:700">이 테이블 배정 예약 목록</div>'
    + '<div style="display:flex;flex-direction:column;gap:5px;max-height:130px;overflow:auto;padding-right:2px">'
    + list.map(function(r){
      return '<div style="background:var(--surf2);border:1px solid var(--border);border-radius:8px;padding:7px 9px;font-size:11px">'
        + '<div style="display:flex;justify-content:space-between;gap:6px"><b style="color:var(--text)">'+esc(r.nm||'이름없음')+'</b><span style="color:var(--text3)">'+esc(r.time||'시간미정')+'</span></div>'
        + '<div style="margin-top:2px;color:var(--text2)">'+esc(String(r.g||0))+'명 · '+esc(stMap[r.st]||r.st)+'</div>'
        + '</div>';
    }).join('')
    + '</div></div>';
}
function showEmpty(tb, isViewingToday){
  var cap = getMergedCap(tb.id);
  var mergedNames = getMergedNames(tb.id);
  var assignedList = tableAssignedListHtml(tb.id);
  var mergeInfo = mergedNames.length>0
    ? '<div class="fg" style="margin-bottom:0"><div style="font-size:11px;color:var(--text3);margin-bottom:4px">묶인 테이블</div><div class="merge-chip">🔗 '+esc(mergedNames.join(' + '))+'</div></div>'
    : '';
  // 오늘이 아닌 날짜에서는 착석/묶기 버튼 숨김
  var actionHtml = isViewingToday
    ? '<div class="abs" style="margin-top:4px">'
      +'<button class="ab" style="background:var(--blue)" id="bseat">착석</button>'
      +'<button class="ab" style="background:var(--indigo)" id="bres2">예약 등록</button>'
      +'</div>'
      +assignedList
      +'<button class="ab" style="background:var(--surf3);color:var(--text2);width:100%;margin-top:6px;font-size:13px" id="bmerge">🔗 테이블 묶기</button>'
    : '<div class="abs" style="margin-top:4px">'
      +'<button class="ab" style="background:var(--indigo)" id="bres2">예약 등록</button>'
      +'</div>'
      +assignedList;
  showModal('<div class="md-hd"><span class="md-title">'+esc(tb.n)+' — 착석</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb">'
    +mergeInfo
    +(isViewingToday ? '<div class="fg"><label class="fl">인원 (최대 '+cap+'명)</label>'+guestSelectHtml('g-floor', Math.min(tb.g||2, cap), cap)+'</div>' : '')
    +actionHtml
    +'</div>');
  if(isViewingToday){
    document.getElementById('bseat').addEventListener('click',function(){
      var g = getGuestVal('g-floor');
      S.tables=S.tables.map(function(t){return t.id===tb.id?Object.assign({},t,{st:'occupied',g:g,seatTime:Date.now()}):t;});
      closeModal(); saveData(); renderAll();
    });
    document.getElementById('bmerge').addEventListener('click',function(){closeModal();startMergeSelection(tb.id);});
  }
  document.getElementById('bres2').addEventListener('click',function(){closeModal();openResModal(tb.id);});
}
function showOccupied(tb, isViewingToday){
  var c=tblColor(tb.st,tb.seatTime), elapsed=Date.now()-tb.seatTime;
  var assignedList = tableAssignedListHtml(tb.id);
  // 오늘이 아닌 날짜 열람 시에는 완료 처리 버튼 숨김 (가상 테이블엔 occupied 없지만 방어 처리)
  var doneBtn = (isViewingToday !== false)
    ? '<button class="ab" style="background:var(--indigo);width:100%" id="bclr">✓ 완료 처리</button>'
    : '';
  var txfrSwapHtml = (isViewingToday !== false)
    ? '<div class="abs" style="margin-top:2px">'
      + '<button class="ab" style="background:var(--red)" id="btransfer">↗ 이동</button>'
      + '<button class="ab" style="background:var(--amber);color:#1a1410" id="bswap">⇄ 맞교환</button>'
      + '</div>'
    : '';
  showModal('<div class="md-hd"><span class="md-title">'+esc(tb.n)+' — 착석중</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="ib" style="background:var(--surf2);border-color:'+c.bd+'">'
    +'<div class="ir"><span class="il">착석 인원</span><span class="iv">'+tb.g+'명</span></div>'
    +'<div class="ir"><span class="il">착석 시간</span><span class="iv">'+fmtTime(tb.seatTime)+'</span></div>'
    +'<div class="ir"><span class="il">경과</span><span class="iv" style="color:'+(elapsed>5400000?'var(--red2)':'var(--text)')+'">'+fmtElapsed(elapsed)+'</span></div>'
    +'</div>'+assignedList+doneBtn+txfrSwapHtml);
  if(isViewingToday !== false){
    document.getElementById('bclr').addEventListener('click',function(){
      if(!S.daily)S.daily=[];
      if(tb.res && tb.res.resId) {
        S.ress = S.ress.map(function(x){ return x.id==tb.res.resId ? Object.assign({},x,{st:'completed'}) : x; });
      } else {
        S.daily.push({id:uid(),date:today(),type:'walkin',tname:tb.n,g:tb.g,seatTime:tb.seatTime,endTime:Date.now()});
      }
      S.tables=S.tables.map(function(t){return t.id===tb.id?Object.assign({},t,{st:'empty',g:0,seatTime:null,res:null}):t;});
      closeModal(); saveData(); renderAll();
    });
    document.getElementById('btransfer').addEventListener('click', function(){
      closeModal(); openTransferModal(tb.id);
    });
    document.getElementById('bswap').addEventListener('click', function(){
      closeModal(); openSwapModal(tb.id);
    });
  }
}
function showReserved(tb, isViewingToday){
  var r=tb.res||{};
  var assignedList = tableAssignedListHtml(tb.id);
  // 오늘이 아닌 날짜에서는 착석 처리 비활성화
  var seatBtnHtml = isViewingToday
    ? '<button class="ab" style="background:var(--blue)" id="bseatr">착석 처리</button>'
    : '<button class="ab" style="background:var(--surf3);color:var(--text3);cursor:not-allowed" disabled>착석 처리</button>';
  showModal('<div class="md-hd"><span class="md-title">'+esc(tb.n)+' — 예약</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="ib" style="background:rgba(42,114,200,.08);border-color:rgba(42,114,200,.3)">'
    +'<div class="ir"><span class="il">예약자</span><span class="iv">'+esc(r.name||'')+'</span></div>'
    +'<div class="ir"><span class="il">인원</span><span class="iv">'+esc(String(r.g||''))+'명</span></div>'
    +'<div class="ir"><span class="il">시간</span><span class="iv">'+esc(r.time||'')+'</span></div>'
    +(r.phone?'<div class="ir"><span class="il">연락처</span><span class="iv"><a href="tel:'+esc(r.phone)+'" style="color:#60a5fa;text-decoration:none">'+esc(r.phone)+'</a></span></div>':'')
    +(r.memo?'<div class="ir"><span class="il">메모</span><span class="iv" style="text-align:right;max-width:160px">'+esc(r.memo)+'</span></div>':'')
    +'</div>'+assignedList+'<div class="abs">'+seatBtnHtml
    +'<button class="ab" style="background:var(--red)" id="bcancr">예약 취소</button></div>');
  if(isViewingToday){
    document.getElementById('bseatr').addEventListener('click',function(){
      S.tables=S.tables.map(function(t){return t.id===tb.id?Object.assign({},t,{st:'occupied',seatTime:Date.now(),g:r.g||tb.c,res:null}):t;});
      if(r.resId) S.ress=S.ress.map(function(x){return x.id==r.resId?Object.assign({},x,{st:'arrived'}):x;});
      closeModal(); saveData(); renderAll();
    });
  }
  document.getElementById('bcancr').addEventListener('click',function(){
    // 오늘이면 실제 테이블 상태도 초기화, 미래/과거 날짜면 예약 데이터만 처리
    if(isViewingToday){
      S.tables=S.tables.map(function(t){return t.id===tb.id?Object.assign({},t,{st:'empty',g:0,seatTime:null,res:null}):t;});
    }
    if(r.resId) S.ress=S.ress.map(function(x){return x.id==r.resId?Object.assign({},x,{st:'cancelled',tableId:null,tableIds:[]}):x;});
    closeModal(); saveData(); renderAll();
  });
}
function openResModal(tid){
  activeResTableId=tid;
  var tb=S.tables.filter(function(t){return t.id===tid;})[0];
  var cap = getMergedCap(tid);
  showModal('<div class="md-hd"><span class="md-title">'+esc(tb.n)+' 예약 등록</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb"><div class="fg"><label class="fl">예약자 이름</label><input class="fi" id="rn" placeholder="고객 이름"></div>'
    +'<div class="fg"><label class="fl">인원 (최대 '+cap+'명)</label>'+guestSelectHtml('g-res', 2, cap)+'</div>'
    +'<div class="g2"><div class="fg"><label class="fl">예약 날짜</label><input class="fi" id="rd" type="date" value="'+today()+'"></div>'
    +'<div class="fg"><label class="fl">예약 시간</label><input class="fi" id="rt" type="time" value="18:00"></div></div>'
    +'<div class="fg"><label class="fl">연락처(선택)</label>'+phHtml('rp','')+'</div>'
    +'<div class="fg"><label class="fl">태그(선택)</label>'+tagHtml('rtags',[])+'</div>'
    +'<div class="fg"><label class="fl">메모(선택)</label><textarea class="fi" id="rm" placeholder="알레르기, 특별 요청 등…"></textarea></div>'
    +'<button class="ab" style="background:var(--indigo);width:100%" id="rsubmit">예약 등록</button></div>');
  bindPh('rp'); bindTag('rtags');
  document.getElementById('rsubmit').addEventListener('click',function(){
    var nm=document.getElementById('rn').value.trim(), rd=document.getElementById('rd').value, rt=document.getElementById('rt').value;
    if(!nm||!rt){alert('이름과 시간을 입력하세요');return;}
    var g=getGuestVal('g-res'), phone=getPh('rp'), memo=document.getElementById('rm').value, tags=getTags('rtags');
    var ro={name:nm,g:g,time:rt,date:rd,phone:phone,memo:memo,tags:tags};
    S.tables=S.tables.map(function(t){return t.id===activeResTableId?Object.assign({},t,{st:'reserved',res:ro}):t;});
    S.ress.push({id:uid(),nm:nm,phone:phone,date:rd,time:rt,g:g,memo:memo,tags:tags,st:'confirmed',tableId:activeResTableId});
    closeModal(); saveData(); renderAll();
  });
}

// ── 날짜 동기화 ──
function syncToday(){
  var td = today();        // 오늘 날짜
  var currentFloorDate = floorDate || td;   // 현재 보고 있는 날짜 (floor-nav 사용 시)
  var changed = false;

  // ==================== 실제 캘린더 날짜가 바뀌었을 때 모든 테이블 묶음 자동 해제 ====================
  // floor-nav 선택 날짜(floorDate)가 아닌 실제 오늘(td) 기준으로 비교
  if (td !== lastDate) {
    console.log('날짜 변경 감지: ' + lastDate + ' → ' + td);

    S.tables.forEach(function(t) {
      if (t.mergeIds && t.mergeIds.length > 0) {
        delete t.mergeIds;
        changed = true;
      }
      if (t.isMergedChild) {
        delete t.isMergedChild;
        changed = true;
      }
    });

    // 빈 테이블들은 empty로 초기화
    S.tables.forEach(function(t) {
      if (t.st !== 'reserved' && t.st !== 'occupied') {
        t.st = 'empty';
        t.res = null;
      }
    });

    if (changed) {
      console.log('✅ 날짜 변경으로 모든 테이블 묶음이 자동 해제되었습니다.');
    }

    lastDate = td;   // 실제 오늘 날짜로 업데이트 (floor-nav 선택 날짜 X)
  }

  // ==================== 기존 로직 (예약 → 착석 자동 적용) ====================
  // 오늘(td) 날짜의 예약만 S.tables에 반영; 미래/과거 날짜는 getVirtualTablesForDate()로 처리
  S.ress.forEach(function(r){
    if(r.date === td && r.st === 'confirmed' && r.tableId){
      var tbl = S.tables.filter(function(t){ return t.id === r.tableId; })[0];
      if(tbl && tbl.st === 'empty'){
        var ro = {
          name: r.nm, g: r.g, time: r.time, date: r.date,
          phone: r.phone, memo: r.memo, tags: r.tags, resId: r.id
        };
        S.tables = S.tables.map(function(t){
          return t.id === r.tableId ? Object.assign({}, t, {st: 'reserved', res: ro}) : t;
        });
        changed = true;
      }
    }
  });

  if(changed){
    S.tables.forEach(function(t){ cardCache[t.id] = ''; });
    if (!isSyncingFromRemote) saveData();
    renderAll();
  }
}
// ── 오늘 예약 현황 렌더 ──
function renderTodayRvList() {
  var listEl = document.getElementById('today-rv-list');
  var cntEl  = document.getElementById('today-rv-cnt');
  if (!listEl) return;
  var td = today();
  var todayRvs = S.ress.filter(function(r) {
    return r.date === td && r.st !== 'cancelled' && r.st !== 'completed';
  }).sort(function(a, b) {
    return (a.time||'') < (b.time||'') ? -1 : 1;
  });
  if (cntEl) cntEl.textContent = todayRvs.length + '건';
  if (!todayRvs.length) {
    listEl.innerHTML = '<div class="schrv-empty">오늘 예약 없습니다</div>';
    return;
  }
  var html = '';
  todayRvs.forEach(function(r) {
    var tblIds = getRvTableIds(r);
    var tbls = tblIds.map(function(tid){ return S.tables.filter(function(t){return t.id===tid;})[0]; }).filter(Boolean);
    var tblLabel = tbls.length ? tbls.map(function(t){return esc(t.n);}).join('+') : '미배정';
    html += '<div class="schrv-item" data-rid="'+esc(String(r.id))+'">'
      + '<div class="schrv-time">'+esc(r.time||'–')+'</div>'
      + '<div class="schrv-body">'
      + '<div class="schrv-name">'+esc(r.nm||'·')+'</div>'
      + '<div class="schrv-info">'+esc(String(r.g))+'명 · <span style="color:var(--blue)">'+esc(tblLabel)+'</span></div>'
      + (r.tags&&r.tags.length?'<div class="schrv-tags">'+r.tags.map(function(tg){return'<span class="schrv-tag-confirm">'+esc(tg)+'</span>';}).join('')+'</div>':'')
      + '</div>'
      + '</div>';
  });
  listEl.innerHTML = html;
  listEl.querySelectorAll('.schrv-item').forEach(function(el) {
    el.addEventListener('click', function() { openRvDetail(this.getAttribute('data-rid')); });
  });
}

// ── 스케줄 뷰 렌더 ──
function renderSchedView() {
  var mEl = document.getElementById('schcal-m');
  if (mEl) mEl.textContent = schedCalYear+'년 '+(schedCalMonth+1)+'월';

  var gEl = document.getElementById('schcal-g');
  if (!gEl) return;

  var td = today();
  var dows = ['일','월','화','수','목','금','토'];
  var dowsHTML = '<div class="schcal-dows">';
  dows.forEach(function(d, i) {
    var cls = 'schcal-dow'+(i===0?' sun':i===6?' sat':'');
    dowsHTML += '<div class="'+cls+'">'+d+'</div>';
  });
  dowsHTML += '</div>';

  var gridHTML = '';
  if (hallViewMode === 'weekly') {
    var todayDate = new Date();
    var weekStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - todayDate.getDay());
    gridHTML += '<div class="schcal-week">';
    for (var i = 0; i < 7; i++) {
      var wd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
      var ds = wd.getFullYear()+'-'+pad(wd.getMonth()+1)+'-'+pad(wd.getDate());
      var isT = ds === td;
      var rvCnt = S.ress.filter(function(r){ return r.date===ds && r.st!=='cancelled' && r.st!=='completed'; }).length;
      var cls = 'schcal-wday'+(isT?' today':'')+(i===0?' sun':i===6?' sat':'');
      gridHTML += '<div class="'+cls+'" data-date="'+ds+'">'
        + '<div class="schcal-wday-name">'+dows[i]+'</div>'
        + '<div class="schcal-wday-num">'+wd.getDate()+(rvCnt?'<div class="schcal-dot"></div>':'')+'</div>'
        + '</div>';
    }
    gridHTML += '</div>';
  } else {
    var firstDay = new Date(schedCalYear, schedCalMonth, 1).getDay();
    var daysInMonth = new Date(schedCalYear, schedCalMonth+1, 0).getDate();
    gridHTML += '<div class="schcal-days">';
    for (var i = 0; i < firstDay; i++) {
      gridHTML += '<div class="schcal-day empty"></div>';
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var ds = schedCalYear+'-'+pad(schedCalMonth+1)+'-'+pad(d);
      var isT = ds === td;
      var dow = (firstDay + d - 1) % 7;
      var rvCnt = S.ress.filter(function(r){ return r.date===ds && r.st!=='cancelled' && r.st!=='completed'; }).length;
      var cls = 'schcal-day'+(isT?' today':'')+(dow===0?' sun':dow===6?' sat':'');
      gridHTML += '<div class="'+cls+'" data-date="'+ds+'">'+d+(rvCnt?'<div class="schcal-dot"></div>':'')+'</div>';
    }
    gridHTML += '</div>';
  }

  gEl.innerHTML = dowsHTML + gridHTML;

  gEl.querySelectorAll('[data-date]').forEach(function(el) {
    el.addEventListener('click', function() {
      var clickedDate = this.getAttribute('data-date');
      if (schedSelDate === clickedDate) {
        schedSelDate = null;
        gEl.querySelectorAll('[data-date]').forEach(function(e){ e.classList.remove('sel'); });
        var panel = document.getElementById('schcal-date-panel');
        if (panel) panel.classList.remove('open');
      } else {
        schedSelDate = clickedDate;
        gEl.querySelectorAll('[data-date]').forEach(function(e){ e.classList.remove('sel'); });
        this.classList.add('sel');
        renderSchedDatePanel(clickedDate);
      }
    });
  });

  // Re-apply selected state on re-render (called every second)
  if (schedSelDate) {
    var selEls = gEl.querySelectorAll('[data-date="'+schedSelDate+'"]');
    selEls.forEach(function(e){ e.classList.add('sel'); });
    renderSchedDatePanel(schedSelDate);
  }

  renderTodayRvList();
}

function renderSchedRvList(filterDate) {
  var listEl = document.getElementById('schrv-list');
  var cntEl  = document.getElementById('schrv-cnt');
  if (!listEl) return;

  var td = today();
  var upcoming = S.ress.filter(function(r) {
    if (r.st === 'cancelled' || r.st === 'completed') return false;
    return filterDate ? r.date === filterDate : r.date > td;
  }).sort(function(a, b) {
    var ka = (a.date||'')+(a.time||''), kb = (b.date||'')+(b.time||'');
    return ka < kb ? -1 : 1;
  });

  if (cntEl) cntEl.textContent = upcoming.length+'건';

  if (!upcoming.length) {
    listEl.innerHTML = '<div class="schrv-empty">예정된 예약이 없습니다</div>';
    return;
  }

  var stColor = {confirmed:'var(--green)', pending:'var(--amber)', arrived:'var(--blue)'};
  var html = '';
  upcoming.forEach(function(r) {
    var dateLabel = dlabel(r.date);
    html += '<div class="schrv-item" data-rid="'+esc(String(r.id))+'">'
      + '<div class="schrv-time">'+esc(r.time||'–')+'</div>'
      + '<div class="schrv-body">'
      + '<div class="schrv-name">'+(r.nm ? esc(r.nm) : '<span style="color:var(--text3)">·</span>')+'</div>'
      + '<div class="schrv-info">'+esc(dateLabel)+' '+esc(String(r.g))+'명'+(r.phone?' · '+esc(r.phone):'')+'</div>'
      + '<div class="schrv-tags">'
      + (r.st==='confirmed'?'<span class="schrv-tag-confirm">확정</span>':'')
      + (r.st==='pending'?'<span class="schrv-tag-pending">대기</span>':'')
      + (r.st==='arrived'?'<span class="schrv-tag-pending" style="color:var(--blue);background:rgba(42,114,200,.12)">방문</span>':'')
      + '<span class="schrv-tag-call">전화</span>'
      + '</div>'
      + '</div>'
      + '</div>';
  });

  listEl.innerHTML = html;
  listEl.querySelectorAll('.schrv-item').forEach(function(el) {
    el.addEventListener('click', function() { openRvDetail(this.getAttribute('data-rid')); });
  });
}

function renderSchedDatePanel(date) {
  var panel   = document.getElementById('schcal-date-panel');
  var titleEl = document.getElementById('schcal-date-title');
  var cntEl   = document.getElementById('schcal-date-cnt');
  var listEl  = document.getElementById('schcal-date-list');
  if (!panel) return;

  var rvs = S.ress.filter(function(r) {
    return r.date === date && r.st !== 'cancelled' && r.st !== 'completed';
  }).sort(function(a,b){ return (a.time||'')<(b.time||'')?-1:1; });

  if (titleEl) titleEl.textContent = dlabel(date) + ' 예약';
  if (cntEl)   cntEl.textContent   = rvs.length + '건';
  panel.classList.add('open');

  if (!listEl) return;
  if (!rvs.length) {
    listEl.innerHTML = '<div class="schrv-empty">예약이 없습니다</div>';
    return;
  }
  var html = '';
  rvs.forEach(function(r) {
    var tblIds = getRvTableIds(r);
    var tbls   = tblIds.map(function(tid){ return S.tables.filter(function(t){return t.id===tid;})[0]; }).filter(Boolean);
    var tblLabel = tbls.length ? tbls.map(function(t){return esc(t.n);}).join('+') : '미배정';
    html += '<div class="schrv-item" data-rid="'+esc(String(r.id))+'">'
      + '<div class="schrv-time">'+esc(r.time||'–')+'</div>'
      + '<div class="schrv-body">'
      + '<div class="schrv-name">'+esc(r.nm||'·')+'</div>'
      + '<div class="schrv-info">'+esc(String(r.g))+'명 · <span style="color:var(--blue)">'+esc(tblLabel)+'</span></div>'
      + (r.tags&&r.tags.length?'<div class="schrv-tags">'+r.tags.map(function(tg){return'<span class="schrv-tag-confirm">'+esc(tg)+'</span>';}).join('')+'</div>':'')
      + '</div>'
      + '</div>';
  });
  listEl.innerHTML = html;
  listEl.querySelectorAll('.schrv-item').forEach(function(el) {
    el.addEventListener('click', function() { openRvDetail(this.getAttribute('data-rid')); });
  });
}

function renderAll(){
  renderHeader();
  var schv    = document.getElementById('sched-view');
  var sbEl    = document.getElementById('sb');
  var cvEl    = document.getElementById('cv');
  var legEl   = document.getElementById('leg');
  var statsEl = document.getElementById('stats');
  var lvEl    = document.getElementById('listview');
  var fnEl    = document.getElementById('floor-nav');
  var bedit   = document.getElementById('bedit');
  var bview   = document.getElementById('btn-view');
  if (hallViewMode === 'hall') {
    if (sbEl)   sbEl.style.display   = 'flex';
    if (schv)   schv.classList.remove('on');
    if (cvEl)   cvEl.style.display   = '';
    if (legEl)  legEl.style.display  = '';
    if (statsEl)statsEl.style.display= '';
    if (fnEl)   fnEl.style.display   = '';
    if (bedit)  bedit.style.display  = '';
    if (bview)  bview.style.display  = '';
    renderSidebar(); renderStats(); renderFloorNav();
    if(viewMode==='list') renderListView(); else renderCanvas();
  } else {
    if (sbEl)   sbEl.style.display   = 'none';
    if (schv)   schv.classList.add('on');
    if (cvEl)   cvEl.style.display   = 'none';
    if (legEl)  legEl.style.display  = 'none';
    if (statsEl)statsEl.style.display= 'none';
    if (fnEl)   fnEl.style.display   = 'none';
    if (lvEl)   { lvEl.classList.remove('on'); lvEl.style.display = 'none'; }
    if (bedit)  bedit.style.display  = 'none';
    if (bview)  bview.style.display  = 'none';
    renderSchedView();
  }
}

// ── 테이블 묶음 풀기 (Unmerge) ──
function unmergeTables(masterId) {
  const master = S.tables.find(t => t.id === masterId);
  if (!master) {
    alert('테이블을 찾을 수 없습니다.');
    return;
  }

  if (!master.mergeIds || master.mergeIds.length === 0) {
    alert('이 테이블은 다른 테이블과 묶여있지 않습니다.');
    return;
  }

  const childIds = [...master.mergeIds];  // 복사
  delete master.mergeIds;                 // 마스터의 묶음 정보 제거
  delete master.mergeName;
  delete master.mergeColor;

  // 자식 테이블들 모두 빈 테이블로 초기화
  S.tables.forEach(t => {
    if (childIds.includes(t.id)) {
      t.st = 'empty';
      t.res = null;
      delete t.isMergedChild;
      cardCache[t.id] = '';   // 캐시 초기화
    }
  });

  cardCache[masterId] = '';   // 마스터 캐시도 초기화

  saveData();                 // Firebase에 저장
  renderCanvas();             // 화면 새로 그리기
  renderSidebar();            // 사이드바도 갱신
  renderStats();

  closeModal();
  showToast('✅ 테이블 묶음이 완전히 해제되었습니다.');
}
// ── 날짜が変わ면 모든 테이블 묶음 자동 해제 ──
function unmergeAllTables() {
  let changed = false;

  // 슬레이브 ID를 먼저 수집 (delete 전에)
  var slaveIds = [];
  S.tables.forEach(t => {
    if (t.mergeIds && t.mergeIds.length > 0) {
      t.mergeIds.forEach(mid => slaveIds.push(mid));
      delete t.mergeIds;
      delete t.mergeName;
      delete t.mergeColor;
      changed = true;
    }
    if (t.isMergedChild) {
      delete t.isMergedChild;
      changed = true;
    }
  });

  // 슬레이브였던 테이블들만 empty로 초기화 (예약/착석 중인 건 건드리지 않음)
  if (slaveIds.length > 0) {
    S.tables.forEach(t => {
      if (slaveIds.indexOf(t.id) >= 0 && t.st !== 'reserved' && t.st !== 'occupied') {
        t.st = 'empty';
        t.res = null;
      }
    });
  }

  if (changed) {
    Object.keys(cardCache).forEach(key => cardCache[key] = '');
    saveData();
    console.log('✅ 날짜 변경으로 모든 테이블 묶음이 자동 해제되었습니다.');
  }
}

// ── 테이블 이동 (Transfer) ──
function openTransferModal(srcId) {
  var src = S.tables.filter(function(t){ return t.id === srcId; })[0];
  if (!src) return;
  var targets = S.tables.filter(function(t){
    return t.id !== srcId && t.st === 'empty' && !isSlaveTbl(t.id);
  });
  var shapeMap = {sq:'정방형', wide:'가로형', bar:'바형'};
  var tbHtml = targets.length
    ? targets.map(function(t){
        return '<button class="tpb" data-tid="'+t.id+'" style="border-left:3px solid var(--red)">'
          +'<span>'+esc(t.n)+'</span>'
          +'<span class="tps">빈 테이블 · '+(shapeMap[t.shape]||t.shape)+' · '+t.c+'인</span></button>';
      }).join('')
    : '<p style="color:var(--text3);font-size:13px;text-align:center;padding:16px 0">이동 가능한 빈 테이블이 없습니다</p>';
  showModal(
    '<div class="md-hd"><span class="md-title">'+esc(src.n)+' → 테이블 이동</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb">'
    +'<div style="font-size:12px;color:var(--text2);background:rgba(196,18,48,.07);border:1px solid rgba(196,18,48,.2);border-radius:9px;padding:9px 11px">'
    +'착석 인원 <b style="color:var(--text)">'+src.g+'명</b>과 착석 정보가 선택한 빈 테이블로 이동됩니다.<br>'
    +'<span style="color:var(--text3)">'+esc(src.n)+'은 빈 테이블이 됩니다.</span></div>'
    +'<div style="display:flex;flex-direction:column;gap:6px">'+tbHtml+'</div>'
    +'</div>'
  );
  document.getElementById('mdc').querySelectorAll('.tpb').forEach(function(btn){
    btn.addEventListener('click', function(){
      var dstId = +this.getAttribute('data-tid');
      var dst = S.tables.filter(function(t){ return t.id === dstId; })[0];
      if (!dst) return;
      showModal(
        '<div class="md-hd"><span class="md-title">이동 확인</span><button class="md-x" id="mxbtn">×</button></div>'
        +'<div class="mb">'
        +'<div class="ib" style="background:rgba(196,18,48,.07);border-color:rgba(196,18,48,.35)">'
        +'<div class="ir"><span class="il">출발 테이블</span><span class="iv">'+esc(src.n)+'</span></div>'
        +'<div class="ir"><span class="il">목적지 테이블</span><span class="iv" style="color:var(--red)">'+esc(dst.n)+'</span></div>'
        +'<div class="ir"><span class="il">착석 인원</span><span class="iv">'+src.g+'명</span></div>'
        +'<div class="ir"><span class="il">착석 시간</span><span class="iv">'+fmtTime(src.seatTime)+'</span></div>'
        +'<div class="ir" style="margin-bottom:0"><span class="il">경과 시간</span><span class="iv">'+fmtElapsed(Date.now()-src.seatTime)+'</span></div>'
        +'</div>'
        +'<div class="abs">'
        +'<button class="ab" style="background:var(--surf3);color:var(--text2)" id="txfr-cancel">취소</button>'
        +'<button class="ab" style="background:var(--red)" id="txfr-confirm">이동 확인</button>'
        +'</div></div>'
      );
      document.getElementById('txfr-cancel').addEventListener('click', closeModal);
      document.getElementById('txfr-confirm').addEventListener('click', function(){
        executeTransfer(srcId, dstId);
      });
    });
  });
}

function executeTransfer(srcId, dstId) {
  var src = S.tables.filter(function(t){ return t.id === srcId; })[0];
  var dst = S.tables.filter(function(t){ return t.id === dstId; })[0];
  if (!src || !dst) return;
  var srcName = src.n, dstName = dst.n;
  S.tables = S.tables.map(function(t) {
    if (t.id === srcId) return Object.assign({}, t, {st:'empty', g:0, seatTime:null, res:null});
    if (t.id === dstId) return Object.assign({}, t, {st:src.st, g:src.g, seatTime:src.seatTime, res:src.res});
    return t;
  });
  S.ress = S.ress.map(function(r) {
    if (r.tableId === srcId) return Object.assign({}, r, {tableId: dstId});
    return r;
  });
  cardCache[srcId] = '';
  cardCache[dstId] = '';
  closeModal();
  saveData();
  renderAll();
  showToast(srcName + ' → ' + dstName + ' 이동 완료');
}

// ── 테이블 맞교환 (Swap) ──
function openSwapModal(srcId) {
  var src = S.tables.filter(function(t){ return t.id === srcId; })[0];
  if (!src) return;
  var targets = S.tables.filter(function(t){
    return t.id !== srcId && t.st !== 'empty' && !isSlaveTbl(t.id);
  });
  var tbHtml = targets.length
    ? targets.map(function(t){
        var isOcc = t.st === 'occupied';
        var stLabel = isOcc ? t.g+'명 착석중 · '+fmtElapsed(Date.now()-t.seatTime) : '예약 · '+esc(t.res&&t.res.name||'');
        var stColor = isOcc ? 'var(--amber)' : 'var(--blue)';
        return '<button class="tpb" data-tid="'+t.id+'" style="border-left:3px solid '+stColor+'">'
          +'<span>'+esc(t.n)+'</span>'
          +'<span class="tps" style="color:'+stColor+'">'+stLabel+'</span></button>';
      }).join('')
    : '<p style="color:var(--text3);font-size:13px;text-align:center;padding:16px 0">교환 가능한 테이블이 없습니다</p>';
  var srcLabel = src.st==='occupied' ? src.g+'명 착석중' : '예약';
  showModal(
    '<div class="md-hd"><span class="md-title">'+esc(src.n)+' — 테이블 맞교환</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb">'
    +'<div style="font-size:12px;color:var(--text2);background:rgba(200,146,42,.08);border:1px solid rgba(200,146,42,.3);border-radius:9px;padding:9px 11px">'
    +'<b style="color:var(--amber)">'+esc(src.n)+'</b> ('+srcLabel+')의 손님 정보를<br>'
    +'교환할 테이블의 손님 정보와 <b>완전히 맞바꿉니다.</b></div>'
    +'<div style="display:flex;flex-direction:column;gap:6px">'+tbHtml+'</div>'
    +'</div>'
  );
  document.getElementById('mdc').querySelectorAll('.tpb').forEach(function(btn){
    btn.addEventListener('click', function(){
      var dstId = +this.getAttribute('data-tid');
      var dst = S.tables.filter(function(t){ return t.id === dstId; })[0];
      if (!dst) return;
      var srcInfo = src.st==='occupied'
        ? src.g+'명 · '+fmtTime(src.seatTime)+' 착석'
        : '예약 · '+(src.res&&src.res.name||'');
      var dstInfo = dst.st==='occupied'
        ? dst.g+'명 · '+fmtTime(dst.seatTime)+' 착석'
        : '예약 · '+(dst.res&&dst.res.name||'');
      showModal(
        '<div class="md-hd"><span class="md-title">테이블 맞교환 확인</span><button class="md-x" id="mxbtn">×</button></div>'
        +'<div class="mb">'
        +'<div class="ib" style="background:rgba(200,146,42,.07);border-color:rgba(200,146,42,.4)">'
        +'<div class="ir"><span class="il" style="color:var(--amber);font-weight:800">⇄ 교환 대상</span></div>'
        +'<div class="ir"><span class="il">'+esc(src.n)+'</span><span class="iv">'+srcInfo+'</span></div>'
        +'<div class="ir" style="margin-bottom:0"><span class="il">'+esc(dst.n)+'</span><span class="iv">'+dstInfo+'</span></div>'
        +'</div>'
        +'<div style="font-size:12px;color:var(--text3);text-align:center">착석 인원 · 시간 · 예약 정보가 서로 교환됩니다</div>'
        +'<div class="abs">'
        +'<button class="ab" style="background:var(--surf3);color:var(--text2)" id="swap-cancel">취소</button>'
        +'<button class="ab" style="background:var(--amber);color:#1a1410" id="swap-confirm">맞교환 확인</button>'
        +'</div></div>'
      );
      document.getElementById('swap-cancel').addEventListener('click', closeModal);
      document.getElementById('swap-confirm').addEventListener('click', function(){
        executeSwap(srcId, dstId);
      });
    });
  });
}

function executeSwap(tid1, tid2) {
  var t1 = S.tables.filter(function(t){ return t.id === tid1; })[0];
  var t2 = S.tables.filter(function(t){ return t.id === tid2; })[0];
  if (!t1 || !t2) return;
  var n1 = t1.n, n2 = t2.n;
  var snap1 = {st:t1.st, g:t1.g, seatTime:t1.seatTime, res:t1.res};
  var snap2 = {st:t2.st, g:t2.g, seatTime:t2.seatTime, res:t2.res};
  S.tables = S.tables.map(function(t) {
    if (t.id === tid1) return Object.assign({}, t, snap2);
    if (t.id === tid2) return Object.assign({}, t, snap1);
    return t;
  });
  S.ress = S.ress.map(function(r) {
    if (r.tableId === tid1) return Object.assign({}, r, {tableId: tid2});
    else if (r.tableId === tid2) return Object.assign({}, r, {tableId: tid1});
    return r;
  });
  cardCache[tid1] = '';
  cardCache[tid2] = '';
  closeModal();
  saveData();
  renderAll();
  showToast(n1 + ' ⇄ ' + n2 + ' 맞교환 완료');
}

