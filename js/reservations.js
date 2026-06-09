// ── 예약 관리 (Reservation Management) ──

// ── 예약 관리 ──
function renderReservations(){ renderCal(); renderRvList(); }
function renderCal(){
  document.getElementById('calm').textContent=calY+'년 '+(calM+1)+'월';
  var fd=new Date(calY,calM,1).getDay(), dim=new Date(calY,calM+1,0).getDate();
  var td=today(), dots={};
  S.ress.filter(function(r){return r.st!=='cancelled'&&r.date;}).forEach(function(r){dots[r.date]=1;});
  var html='';
  for(var i=0;i<fd;i++) html+='<div class="cd other"></div>';
  for(var d=1;d<=dim;d++){
    var s=calY+'-'+pad(calM+1)+'-'+pad(d), dow=(fd+d-1)%7;
    var cls='cd'+(dow===0?' sun':dow===6?' sat':'')+(s===td&&s!==calSel?' today':'')+(s===calSel?' sel':'');
    html+='<div class="'+cls+'" data-d="'+s+'">'+d+(dots[s]?'<div class="dot"></div>':'')+'</div>';
  }
  document.getElementById('calg').innerHTML=html;
  var td2=today();
  document.getElementById('calg').querySelectorAll('.cd').forEach(function(el){
    el.addEventListener('click',function(e){
      var d=this.getAttribute('data-d');
      if(!d)return;
      e.stopPropagation();
      calSel=(calSel===d)?null:d;
      document.getElementById('calg').querySelectorAll('.cd[data-d]').forEach(function(c){
        c.classList.remove('sel','today');
        var cd=c.getAttribute('data-d');
        if(calSel&&cd===calSel) c.classList.add('sel');
        else if(cd===td2) c.classList.add('today');
      });
      renderRvList();
    });
  });
}
function rvItemHtml(r,sm,isPast){
  var s=sm[r.st||'confirmed']||sm.confirmed;
  var tblIds=getRvTableIds(r);
  var tbls=tblIds.map(function(tid){return S.tables.filter(function(t){return t.id===tid;})[0];}).filter(Boolean);
  return '<div class="rvi'+(isPast?' past':'')+'" data-rid="'+esc(String(r.id))+'">'
    +'<div class="rvi-t">'+esc(r.time||'–')+'</div>'
    +'<div class="rvi-b">'
    +'<div class="rvi-n">'+esc(r.nm)+'</div>'
    +'<div class="rvi-s">'+(r.date?dlabel(r.date)+' ':'')+r.g+'명</div>'
    +(r.phone?'<div class="rvi-ph">'+esc(r.phone)+'</div>':'')
    +(tbls.length?'<div class="rvi-tbl">🪑 '+tbls.map(function(t){return esc(t.n);}).join(' + ')+'</div>':'')
    +(r.tags&&r.tags.length?'<div class="rvi-tags">'+r.tags.map(function(t){return'<span class="rvi-tag">'+esc(t)+'</span>';}).join('')+'</div>':'')
    +(r.memo?'<div class="rvi-m">📝'+esc(r.memo)+'</div>':'')
    +'</div>'
    +'<div class="rvi-st" style="color:'+s[0]+';background:'+s[1]+'">'+s[2]+'</div>'
    +'</div>';
}
function renderRvList(){
  var q=(document.getElementById('rvsrch').value||'').trim().toLowerCase();
  var list=S.ress.slice();
  if(calSel) list=list.filter(function(r){return r.date===calSel;});
  if(q) list=list.filter(function(r){return (r.nm||'').toLowerCase().indexOf(q)>=0||(r.phone||'').indexOf(q)>=0;});
  document.getElementById('rvtitle').textContent=calSel?dlabel(calSel)+' 예약':'전체 예약';
  document.getElementById('rvcnt').textContent=list.length+'건';
  var sortBtn=document.getElementById('rvsort');
  if(sortBtn) sortBtn.textContent=rvSortAsc?'↑ 날짜순':'↓ 날짜순';
  var sm={confirmed:['#2a9a5a','rgba(42,154,90,.12)','확정'],pending:['var(--amber)','rgba(200,146,42,.1)','대기'],
          arrived:['var(--blue)','rgba(42,114,200,.1)','방문'],noshow:['var(--red2)','rgba(196,18,48,.1)','노쇼'],completed:['var(--indigo)','rgba(90,82,200,.1)','완료'],
          cancelled:['var(--text3)','var(--surf3)','취소']};
  var nd=today();
  var upcomingEl=document.getElementById('rv-upcoming');
  var pastWrap=document.getElementById('rv-past-wrap');
  function bindRvi(container){
    container.querySelectorAll('.rvi').forEach(function(el){
      el.addEventListener('click',function(){openRvDetail(this.getAttribute('data-rid'));});
    });
  }
  var showSections=!calSel&&!q;
  if(showSections){
    var activeSt={confirmed:1,pending:1,arrived:1};
    var todayRvs=list.filter(function(r){return r.date===nd && activeSt[r.st];});
    var futureRvs=list.filter(function(r){return r.date>nd && activeSt[r.st];});
    var past=list.filter(function(r){return r.st==='completed'||r.st==='noshow'||r.st==='cancelled'||r.date<nd;});

    todayRvs.sort(function(a,b){return (a.time||'99:99')<(b.time||'99:99')?-1:1;});
    futureRvs.sort(function(a,b){
      var ka=(a.date||'9999')+(a.time||'99:99'), kb=(b.date||'9999')+(b.time||'99:99');
      return rvSortAsc?(ka<kb?-1:1):(ka>kb?-1:1);
    });
    past.sort(function(a,b){
      var ka=(a.date||'0000')+(a.time||'00:00'), kb=(b.date||'0000')+(b.time||'00:00');
      return ka>kb?-1:1;
    });

    var html='<div class="rv-sec-lbl">오늘 예약 '+todayRvs.length+'건</div>';
    if(todayRvs.length) html+=todayRvs.map(function(r){return rvItemHtml(r,sm,false);}).join('');
    else html+='<div class="rv-empty-row">오늘 예약 없음</div>';

    if(futureRvs.length) html+='<div class="rv-sec-lbl">이후 예약 '+futureRvs.length+'건</div>'+futureRvs.map(function(r){return rvItemHtml(r,sm,false);}).join('');

    if(past.length) html+='<div class="rv-sec-lbl">완료된 예약 '+past.length+'건</div>'+past.map(function(r){return rvItemHtml(r,sm,true);}).join('');

    upcomingEl.innerHTML=html;
    bindRvi(upcomingEl);
    pastWrap.style.display='none';
  } else {
    list.sort(function(a,b){
      var ka=(a.date||'9999')+(a.time||'99:99'), kb=(b.date||'9999')+(b.time||'99:99');
      return rvSortAsc?(ka<kb?-1:1):(ka>kb?-1:1);
    });
    upcomingEl.innerHTML=list.length
      ? list.map(function(r){return rvItemHtml(r,sm,!calSel&&r.date<nd);}).join('')
      : '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">예약 없음</div>';
    bindRvi(upcomingEl);
    pastWrap.style.display='none';
  }
}
function openAddRv(){
  gvRvAdd=2; var df=calSel||today(), avTids=[];
  var allT=S.tables.filter(function(t){return !isSlaveTbl(t.id);});
  allT.sort(function(a,b){var av=a.st==='empty'?0:1,bv=b.st==='empty'?0:1;if(av!==bv)return av-bv;return String(a.n).localeCompare(String(b.n),'ko');});
  var tpH='<div style="display:flex;flex-wrap:wrap;gap:5px" id="avtbl">'
    +allT.map(function(t){return '<button type="button" class="tag-pill" data-tid="'+t.id+'" data-cap="'+t.c+'">'+esc(t.n)+' ('+t.c+'인)</button>';}).join('')+'</div>'
    +'<div id="avtbl-info" style="font-size:11px;color:var(--text3);margin-top:4px">미배정</div>';
  showModal('<div class="md-hd"><span class="md-title">예약 추가</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb"><div class="g2">'
    +'<div class="fg"><label class="fl">이름 *</label><input class="fi" id="avn" placeholder="홍길동"></div>'
    +'<div class="fg"><label class="fl">연락처</label>'+phHtml('avp','')+'</div></div>'
    +'<div class="g2"><div class="fg"><label class="fl">날짜 *</label><input class="fi" id="avd" type="date" value="'+df+'"></div>'
    +'<div class="fg"><label class="fl">시간 *</label><input class="fi" id="avt" type="time" value="18:00"></div></div>'
    +'<div class="fg"><label class="fl">인원</label>'+guestSelectHtml('g-addrv', 2, 50)+'</div>'
    +'<div class="fg"><label class="fl">테이블</label>'+tpH+'</div>'
    +'<div class="fg"><label class="fl">태그(선택)</label>'+tagHtml('avtags',[])+'</div>'
    +'<div class="fg"><label class="fl">메모</label><textarea class="fi" id="avm" placeholder="알레르기, 특별 요청 등…"></textarea></div>'
    +'<div class="fg"><label class="fl">상태</label><select class="fi" id="avs"><option value="confirmed">확정</option><option value="pending">대기</option></select></div>'
    +'<button class="ab" style="background:var(--green);width:100%" id="avsubmit">예약 등록</button></div>');
  bindPh('avp'); bindTag('avtags');
  var tp=document.getElementById('avtbl');
  var info=document.getElementById('avtbl-info');
  function updateInfo(){
    if(!avTids.length){info.textContent='미배정';return;}
    var totalCap=0;
    var names=avTids.map(function(tid){var t=allT.filter(function(x){return String(x.id)===tid;})[0];if(t)totalCap+=t.c;return t?t.n:'?';});
    info.textContent=names.join(' + ')+' · 총 '+totalCap+'인 수용';
  }
  if(tp) tp.querySelectorAll('[data-tid]').forEach(function(btn){
    btn.addEventListener('click',function(){var tid=this.getAttribute('data-tid');var idx=avTids.indexOf(tid);if(idx>=0){avTids.splice(idx,1);this.classList.remove('on');}else{avTids.push(tid);this.classList.add('on');}updateInfo();});
  });
  document.getElementById('avsubmit').addEventListener('click',function(){
    var nm=document.getElementById('avn').value.trim(), d=document.getElementById('avd').value, t=document.getElementById('avt').value;
    if(!nm||!d||!t){alert('이름, 날짜, 시간은 필수입니다');return;}
    var tableIds=avTids.map(Number), tableId=tableIds[0]||null;
    var nr={id:uid(),nm:nm,phone:getPh('avp'),date:d,time:t,g:getGuestVal('g-addrv'),memo:document.getElementById('avm').value,tags:getTags('avtags'),st:document.getElementById('avs').value,tableId:tableId,tableIds:tableIds};
    S.ress.push(nr);
    if(tableIds.length){
      var ro={name:nm,g:getGuestVal('g-addrv'),time:t,date:d,phone:nr.phone,memo:nr.memo,tags:nr.tags,resId:nr.id};
      S.tables=S.tables.map(function(tb){return tableIds.indexOf(tb.id)<0?tb:(tb.st==='empty'?Object.assign({},tb,{st:'reserved',res:ro}):tb);});
      S.tables.forEach(function(tb){cardCache[tb.id]='';});
    }
    closeModal(); saveData(); renderReservations();
  });
}
function openRvDetail(rid){
  var r=S.ress.filter(function(x){return x.id==rid;})[0]; if(!r)return;
  var sml={confirmed:'확정',pending:'대기',arrived:'방문',noshow:'노쇼',cancelled:'취소',completed:'완료'};
  var sc={confirmed:['#2a9a5a','rgba(42,154,90,.12)'],pending:['var(--amber)','rgba(200,146,42,.1)'],
          arrived:['var(--blue)','rgba(42,114,200,.1)'],noshow:['var(--red2)','rgba(196,18,48,.1)'],completed:['var(--indigo)','rgba(90,82,200,.1)'],
          cancelled:['var(--text3)','var(--surf3)']};
  var tblIds=getRvTableIds(r);
  var tbls=tblIds.map(function(tid){return S.tables.filter(function(t){return t.id===tid;})[0];}).filter(Boolean);
  showModal('<div class="md-hd"><span class="md-title">'+esc(r.nm)+' 예약</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="ib" style="background:var(--surf2);border-color:var(--border2)">'
    +'<div class="ir"><span class="il">날짜</span><span class="iv">'+dlabel(r.date)+'</span></div>'
    +'<div class="ir"><span class="il">시간</span><span class="iv">'+esc(r.time)+'</span></div>'
    +'<div class="ir"><span class="il">인원</span><span class="iv">'+r.g+'명</span></div>'
    +(r.phone?'<div class="ir"><span class="il">연락처</span><span class="iv"><a href="tel:'+esc(r.phone)+'" style="color:#60a5fa;text-decoration:none">'+esc(r.phone)+'</a></span></div>':'')
    +(r.memo?'<div class="ir"><span class="il">메모</span><span class="iv" style="text-align:right;max-width:160px">'+esc(r.memo)+'</span></div>':'')
    +(r.tags&&r.tags.length?'<div class="ir"><span class="il">태그</span><span class="iv" style="text-align:right">'+r.tags.map(function(t){return'<span class="rvi-tag">'+esc(t)+'</span>';}).join(' ')+'</span></div>':'')
    +'<div class="ir"><span class="il">테이블</span><span class="iv" style="color:'+(tbls.length?'var(--blue)':'var(--text3)')+'">'+(tbls.length?tbls.map(function(t){return esc(t.n);}).join(' + '):'미배정')+'</span></div>'
    +'<div class="ir"><span class="il">상태</span><span class="iv">'+sml[r.st]+'</span></div>'
    +'</div>'
    +'<div style="display:flex;gap:5px;margin-bottom:9px">'
    +['completed','noshow','cancelled'].map(function(s){return '<button style="flex:1;padding:8px 0;border:none;border-radius:8px;background:'+(sc[s]?sc[s][1]:'var(--surf2)')+';color:'+(sc[s]?sc[s][0]:'var(--text2)')+';font-weight:700;font-size:12px;cursor:pointer;font-family:inherit" data-st="'+s+'">'+sml[s]+'</button>';}).join('')+'</div>'
    +(!tbls.length?'<button class="ab" style="background:var(--blue);width:100%;margin-bottom:7px" id="bassign">🪑 테이블 배정</button>':'<button class="ab" style="background:var(--surf3);color:var(--text2);width:100%;margin-bottom:7px" id="bunassign">배정 해제</button>')
    +(r.phone?'<button class="ab" style="background:var(--surf3);color:var(--text2);width:100%;margin-bottom:7px" id="bcustinfo">👤 고객 정보</button>':'')
    +((r.st==='completed'||r.st==='noshow')?'<button class="ab" style="background:var(--green);width:100%;margin-bottom:7px" id="brestore">🔄 예약 복구 (확정으로 변경)</button>':'')
    +'<div class="abs"><button class="ab" style="background:var(--indigo)" id="bedit2">✏️ 수정</button>'
    +'<button class="ab" style="background:var(--red)" id="bcanc">완전 삭제</button></div>');
  document.getElementById('mdc').querySelectorAll('[data-st]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var st=this.getAttribute('data-st');
      S.ress=S.ress.map(function(x){return x.id==rid?Object.assign({},x,{st:st}):x;});
      if(st==='arrived'&&tblIds.length){S.tables=S.tables.map(function(t){return tblIds.indexOf(t.id)>=0?Object.assign({},t,{st:'occupied',seatTime:Date.now(),g:r.g,res:null}):t;});S.tables.forEach(function(t){cardCache[t.id]='';});}
      if(st==='cancelled'&&tblIds.length){S.tables=S.tables.map(function(t){return tblIds.indexOf(t.id)>=0&&t.st==='reserved'?Object.assign({},t,{st:'empty',res:null}):t;});S.tables.forEach(function(t){cardCache[t.id]='';});}
      saveData(); closeModal(); renderReservations(); renderHeader(); renderStats(); renderSidebar(); if(currentTab==='floor') renderCanvas();
    });
  });
  var ba=document.getElementById('bassign');
  if(ba) ba.addEventListener('click',function(){closeModal();openAssignTable(rid);});
  var bu=document.getElementById('bunassign');
  if(bu) bu.addEventListener('click',function(){
    if(tbls.length){var ids=tbls.map(function(t){return t.id;});S.tables=S.tables.map(function(t){return ids.indexOf(t.id)>=0?Object.assign({},t,{st:'empty',res:null}):t;});S.tables.forEach(function(t){cardCache[t.id]='';});}
    S.ress=S.ress.map(function(x){return x.id==rid?Object.assign({},x,{tableId:null,tableIds:[]}):x;});
    saveData(); closeModal(); renderReservations();
  });
  var bci=document.getElementById('bcustinfo');
  if(bci) bci.addEventListener('click',function(){closeModal();openCustInfo(r.phone,r.nm);});
  var brestore=document.getElementById('brestore');
  if(brestore) brestore.addEventListener('click',function(){
    S.ress=S.ress.map(function(x){return x.id==rid?Object.assign({},x,{st:'confirmed'}):x;});
    saveData(); closeModal(); renderReservations();
  });
  document.getElementById('bedit2').addEventListener('click',function(){closeModal();openEditRv(rid);});
  document.getElementById('bcanc').addEventListener('click',function(){
    if(!confirm('예약을 삭제할까요?'))return;
    if(tblIds.length){S.tables=S.tables.map(function(t){return tblIds.indexOf(t.id)>=0&&t.st==='reserved'?Object.assign({},t,{st:'empty',res:null}):t;});S.tables.forEach(function(t){cardCache[t.id]='';});}
    S.ress=S.ress.filter(function(x){return x.id!=rid;}); saveData(); closeModal(); renderReservations();
  });
}
function openCustInfo(phone, name) {
  if(!S.customers)S.customers=[];
  var cust=null;
  for(var ci=0;ci<S.customers.length;ci++){if(S.customers[ci].phone===phone){cust=S.customers[ci];break;}}
  if(!cust)cust={phone:phone,name:name,memo:''};
  // 방문 통계
  var visits=S.ress.filter(function(r){return r.phone===phone&&(r.st==='arrived'||r.st==='completed');});
  visits.sort(function(a,b){return a.date<b.date?-1:1;});
  var total=visits.length;
  var first=visits.length?visits[0].date:null;
  var last=visits.length?visits[visits.length-1].date:null;
  // 최근 방문 5건 (최신순)
  var recent=visits.slice().reverse().slice(0,5);
  // 아바타 (이름 첫 글자)
  var avatarChar=(cust.name||name||'?').charAt(0);
  // 최근 방문 내역 HTML
  var visitsHtml='';
  if(recent.length){
    visitsHtml='<div class="ci-visits"><div class="ci-visits-hd">최근 방문 내역</div>'
      +recent.map(function(r){
        var tbl=r.tableId?S.tables.filter(function(t){return t.id===r.tableId;})[0]:null;
        return '<div class="ci-visit-row">'
          +'<span class="ci-visit-date">'+fmtDateShort(r.date)+'</span>'
          +(r.time?'<span class="ci-visit-time">'+r.time+'</span>':'')
          +(tbl?'<span class="ci-visit-tbl">🪑'+esc(tbl.n)+'</span>':'<span class="ci-visit-time">'+r.g+'명</span>')
          +'</div>';
      }).join('')
      +'</div>';
  }
  showModal('<div class="md-hd"><span class="md-title">고객 정보</span><button class="md-x" id="mxbtn">×</button></div>'
    // 프로필 헤더
    +'<div style="text-align:center;padding:6px 0 10px;border-bottom:1px solid var(--border);margin-bottom:10px">'
    +'<div class="ci-avatar">'+esc(avatarChar)+'</div>'
    +'<div class="ci-name">'+esc(cust.name||name)+' 님</div>'
    +'<div class="ci-phone"><a href="tel:'+esc(phone)+'" style="color:var(--blue);text-decoration:none">'+esc(phone)+'</a></div>'
    +'</div>'
    // 통계 그리드
    +'<div class="ci-stats">'
    +'<div class="ci-stat"><div class="ci-stat-n">'+total+'</div><div class="ci-stat-l">총 방문</div></div>'
    +'<div class="ci-stat"><div class="ci-stat-n" style="font-size:12px;margin-top:2px">'+(first?fmtDateShort(first):'—')+'</div><div class="ci-stat-l">최초 방문</div></div>'
    +'<div class="ci-stat"><div class="ci-stat-n" style="font-size:12px;margin-top:2px">'+(last?fmtDateShort(last):'—')+'</div><div class="ci-stat-l">마지막 방문</div></div>'
    +'</div>'
    // 최근 방문 내역
    +visitsHtml
    // 메모
    +'<div class="fg"><label class="fl">메모</label>'
    +'<textarea class="fi" id="ci-memo" rows="2" placeholder="특이사항, 선호 테이블 등…">'+esc(cust.memo||'')+'</textarea></div>'
    +'<button class="ab" style="background:var(--blue);width:100%" id="ci-save">저장</button>');
  document.getElementById('ci-save').addEventListener('click',function(){
    if(!S.customers)S.customers=[];
    var memo=document.getElementById('ci-memo').value;
    var found=false;
    S.customers=S.customers.map(function(c){
      if(c.phone===phone){found=true;return{phone:phone,name:name,memo:memo};}
      return c;
    });
    if(!found)S.customers.push({phone:phone,name:name,memo:memo});
    closeModal();saveData();
  });
}
function openAssignTable(rid) {
  var r = S.ress.filter(function(x){ return x.id == rid; })[0];
  if (!r) return;

  var currentDate = floorDate || today();
  var et = S.tables.filter(function(t){ return !isSlaveTbl(t.id); });
  et.sort(function(a, b){
    var av = a.st === 'empty' ? 0 : 1;
    var bv = b.st === 'empty' ? 0 : 1;
    if (av !== bv) return av - bv;
    return String(a.n).localeCompare(String(b.n), 'ko');
  });

  // 마스터 테이블의 수용인원 = 마스터 자신 + 병합된 슬레이브 테이블의 합산
  function getEffectiveCap(t) {
    var cap = t.c || 0;
    if (t.mergeIds && t.mergeIds.length) {
      t.mergeIds.forEach(function(mid) {
        var slave = S.tables.filter(function(x){ return String(x.id) === String(mid); })[0];
        if (slave) cap += (slave.c || 0);
      });
    }
    return cap;
  }

  // selTids는 String 타입으로 통일하여 숫자/문자열 ID 혼재 시 indexOf 오류 방지
  var selTids = getRvTableIds(r).map(String);

  var html = '<div class="md-hd"><span class="md-title">' + esc(r.nm) + ' — 테이블 배정</span><button class="md-x" id="mxbtn">×</button></div>';
  if (!et.length) html += '<p style="font-size:13px;color:var(--text3);text-align:center;padding:16px 0">배정 가능한 테이블 없음</p>';
  else html += '<p style="font-size:13px;color:var(--text2);margin-bottom:6px">테이블을 선택하세요 (복수 선택 가능)</p>'
    + '<div id="assign-info" style="font-size:11px;color:var(--text3);margin-bottom:8px">미배정</div>'
    + '<div style="display:flex;flex-direction:column;gap:6px">'
    + et.map(function(t){
      var assignedCount = S.ress.filter(function(x){
        return getRvTableIds(x).map(String).indexOf(String(t.id))>=0 && x.date===r.date && x.st!=='cancelled' && x.st!=='noshow' && x.id!=rid;
      }).length;
      var effCap = getEffectiveCap(t);
      var mergeLabel = (t.mergeIds && t.mergeIds.length) ? (' +' + t.mergeIds.length + '테이블') : '';
      var rightInfo = ({'sq':'정방형','wide':'가로형','bar':'바형'}[t.shape]||t.shape) + ' ' + t.sz.toUpperCase() + mergeLabel + ' · ' + effCap + '인'
        + (assignedCount > 0 ? (' · ' + assignedCount + '팀') : '');
      var isSel = selTids.indexOf(String(t.id)) >= 0;
      return '<button class="tpb' + (isSel ? ' on' : '') + '" data-tid="' + t.id + '"><span>' + esc(t.n) + '</span><span class="tps">' + rightInfo + '</span></button>';
    }).join('')
    + '</div>'
    + '<button class="ab" style="background:var(--blue);width:100%;margin-top:10px" id="bassign-ok">배정 완료</button>';

  showModal(html);

  function updateAssignInfo(){
    var el=document.getElementById('assign-info'); if(!el)return;
    if(!selTids.length){el.textContent='미배정';return;}
    var totalCap=0;
    var names=selTids.map(function(tid){
      var t=et.filter(function(x){ return String(x.id)===tid; })[0];
      if(t) totalCap += getEffectiveCap(t);
      return t ? t.n : '?';
    });
    var capColor = (r.g > totalCap) ? 'var(--red2)' : 'var(--text3)';
    el.innerHTML = '<span>' + names.join(' + ') + ' · 총 ' + totalCap + '인 수용'
      + (r.g > totalCap ? ' <span style="color:var(--red2);font-weight:700">(예약 ' + r.g + '명 초과 ⚠)</span>' : '') + '</span>';
  }
  updateAssignInfo();

  document.getElementById('mdc').querySelectorAll('.tpb').forEach(function(btn){
    btn.addEventListener('click', function(){
      // getAttribute 결과는 항상 문자열이므로 그대로 사용 (+ 변환 제거)
      var tid = this.getAttribute('data-tid');
      var idx = selTids.indexOf(tid);
      if(idx>=0){selTids.splice(idx,1);this.classList.remove('on');}
      else{selTids.push(tid);this.classList.add('on');}
      updateAssignInfo();
    });
  });

  var bOk = document.getElementById('bassign-ok');
  if(bOk) bOk.addEventListener('click', function(){
    // 수용인원 초과 시 확인 다이얼로그
    if(selTids.length) {
      var totalCap = selTids.reduce(function(sum, tid){
        var t = et.filter(function(x){ return String(x.id) === tid; })[0];
        return sum + (t ? getEffectiveCap(t) : 0);
      }, 0);
      if(totalCap < r.g) {
        if(!confirm(r.g + '명 예약이지만 선택 테이블 총 수용인원은 ' + totalCap + '명입니다.\n계속 배정하시겠습니까?')) return;
      }
    }

    // 기존 배정 해제 — String 비교로 ID 타입 혼재 방지
    var oldTblIds = getRvTableIds(r);
    if(oldTblIds.length){
      S.tables = S.tables.map(function(t){
        return oldTblIds.map(String).indexOf(String(t.id))>=0 && t.st==='reserved'
          ? Object.assign({},t,{st:'empty',res:null}) : t;
      });
    }

    // 저장 시 원래 숫자 ID 형식 유지 (숫자 파싱 가능한 경우 숫자로 변환)
    var savedIds = selTids.map(function(s){ var n = +s; return isNaN(n) ? s : n; });
    var tableId = savedIds[0] != null ? savedIds[0] : null;
    S.ress = S.ress.map(function(x){
      return x.id==rid ? Object.assign({},x,{tableId:tableId, tableIds:savedIds.slice()}) : x;
    });

    if(selTids.length && r.date===currentDate){
      var ro = {name:r.nm, g:r.g, time:r.time, date:r.date, phone:r.phone, memo:r.memo, tags:r.tags, resId:r.id};
      S.tables = S.tables.map(function(t){
        if(selTids.indexOf(String(t.id))<0) return t;
        return t.st==='empty' ? Object.assign({},t,{st:'reserved',res:ro}) : t;
      });
    }
    S.tables.forEach(function(t){ cardCache[t.id]=''; });
    saveData(); closeModal(); renderReservations();
    if(currentDate===(floorDate||today())) renderAll();
  });
}
function openEditRv(rid){
  var r=S.ress.filter(function(x){return x.id==rid;})[0]; if(!r)return;
  gvRvEdit=r.g||2;
  showModal('<div class="md-hd"><span class="md-title">예약 수정</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb"><div class="g2">'
    +'<div class="fg"><label class="fl">이름 *</label><input class="fi" id="evn" value="'+esc(r.nm)+'"></div>'
    +'<div class="fg"><label class="fl">연락처</label>'+phHtml('evp',r.phone||'')+'</div></div>'
    +'<div class="g2"><div class="fg"><label class="fl">날짜 *</label><input class="fi" id="evd" type="date" value="'+esc(r.date||'')+'"></div>'
    +'<div class="fg"><label class="fl">시간 *</label><input class="fi" id="evt" type="time" value="'+esc(r.time||'')+'"></div></div>'
    +'<div class="fg"><label class="fl">인원</label>'+guestSelectHtml('g-editrv', gvRvEdit, 50)+'</div>'
    +'<div class="fg"><label class="fl">태그(선택)</label>'+tagHtml('evtags',r.tags||[])+'</div>'
    +'<div class="fg"><label class="fl">메모</label><textarea class="fi" id="evm">'+esc(r.memo||'')+'</textarea></div>'
    +'<div class="fg"><label class="fl">상태</label><select class="fi" id="evs">'
    +['confirmed','pending','noshow','completed'].map(function(s){return'<option value="'+s+'"'+(r.st===s?' selected':'')+'>'+{confirmed:'확정',pending:'대기',noshow:'노쇼',completed:'완료'}[s]+'</option>';}).join('')
    +'</select></div>'
    +'<button class="ab" style="background:var(--green);width:100%" id="evsubmit">저장</button></div>');
  bindPh('evp'); bindTag('evtags');
  document.getElementById('evsubmit').addEventListener('click',function(){
    var nm=document.getElementById('evn').value.trim(), d=document.getElementById('evd').value, t=document.getElementById('evt').value;
    if(!nm||!d||!t){alert('이름, 날짜, 시간은 필수입니다');return;}
    S.ress=S.ress.map(function(x){return x.id==rid?Object.assign({},x,{nm:nm,phone:getPh('evp'),date:d,time:t,g:getGuestVal('g-editrv'),memo:document.getElementById('evm').value,tags:getTags('evtags'),st:document.getElementById('evs').value}):x;});
    closeModal(); saveData(); renderReservations();
  });
}


function renderCancelTab(){
  var q=(document.getElementById('cancelsrch').value||'').trim().toLowerCase();
  var list=S.ress.filter(function(r){return r.st==='cancelled';});
  if(q) list=list.filter(function(r){return (r.nm||'').toLowerCase().indexOf(q)>=0||(r.phone||'').indexOf(q)>=0;});
  list.sort(function(a,b){
    var ka=(a.date||'0000')+(a.time||'00:00'), kb=(b.date||'0000')+(b.time||'00:00');
    return ka>kb?-1:1;
  });
  var el=document.getElementById('cancel-list');
  if(!el)return;
  if(!list.length){
    el.innerHTML='<div style="padding:32px;text-align:center;color:var(--text3);font-size:13px">취소된 예약 없음</div>';
    return;
  }
  el.innerHTML=list.map(function(r){
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
  el.querySelectorAll('.rvi').forEach(function(el2){
    el2.addEventListener('click',function(){openRvDetail(this.getAttribute('data-rid'));});
  });
}

function openTagMgr(pid){
  var mo2=document.getElementById('mo2'), mdc2=document.getElementById('mdc2');
  var sel=pid?getTags(pid):[];
  function mkH(){ return '<div class="md-hd"><span class="md-title">태그 관리</span><button class="md-x" id="tm2x">×</button></div><div class="mb"><div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px" id="tmlist">'+S.tags.map(function(t,i){return'<div style="display:flex;align-items:center;gap:3px;background:var(--surf3);border-radius:99px;padding:3px 6px 3px 11px"><span style="font-size:13px;font-weight:700;color:var(--text)">'+esc(t)+'</span><button type="button" style="border:none;background:none;color:var(--text3);font-size:14px;cursor:pointer;padding:0 3px;line-height:1" data-tidx="'+i+'">×</button></div>';}).join('')+'</div><div style="display:flex;gap:6px"><input class="fi" id="tmnew" placeholder="새 태그" style="flex:1"><button class="bp" id="tmadd">추가</button></div><button class="ab" style="background:var(--indigo);width:100%;margin-top:8px" id="tmdone">완료</button></div>'; }
  function returnToParent(){ mo2.classList.remove('on'); mdc2.innerHTML=''; if(pid){var tp=document.getElementById(pid);if(tp){var html=S.tags.map(function(t){var on=sel.indexOf(t)>=0;return'<button type="button" class="tag-pill'+(on?' on':'')+'" data-tag="'+esc(t)+'">'+esc(t)+'</button>';}).join('')+'<button type="button" class="tag-add-btn" id="'+pid+'_mgr">⚙ 태그</button>';tp.innerHTML=html;tp.querySelectorAll('.tag-pill').forEach(function(b){b.addEventListener('click',function(){this.classList.toggle('on');});});var mgr=document.getElementById(pid+'_mgr');if(mgr)mgr.addEventListener('click',function(){openTagMgr(pid);});}}}
  function bnd(){ document.getElementById('tm2x').addEventListener('click',returnToParent); document.getElementById('tmlist').querySelectorAll('[data-tidx]').forEach(function(btn){btn.addEventListener('click',function(){S.tags.splice(+this.getAttribute('data-tidx'),1);saveData();mdc2.innerHTML=mkH();bnd();});}); document.getElementById('tmadd').addEventListener('click',function(){var v=document.getElementById('tmnew').value.trim();if(!v)return;if(S.tags.indexOf(v)>=0){alert('이미 있습니다');return;}S.tags.push(v);saveData();mdc2.innerHTML=mkH();bnd();}); document.getElementById('tmnew').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('tmadd').click();}); document.getElementById('tmdone').addEventListener('click',returnToParent); }
  mdc2.innerHTML=mkH(); mo2.classList.add('on'); bnd();
}

