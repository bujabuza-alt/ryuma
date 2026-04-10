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
  document.getElementById('calg').querySelectorAll('.cd').forEach(function(el){
    el.addEventListener('click',function(){var d=this.getAttribute('data-d');if(!d)return;calSel=(calSel===d)?null:d;renderCal();renderRvList();});
  });
}
function rvItemHtml(r,sm,isPast){
  var s=sm[r.st||'confirmed']||sm.confirmed;
  var tbl=r.tableId?S.tables.filter(function(t){return t.id===r.tableId;})[0]:null;
  return '<div class="rvi'+(isPast?' past':'')+'" data-rid="'+esc(String(r.id))+'">'
    +'<div class="rvi-t">'+esc(r.time||'–')+'</div>'
    +'<div class="rvi-b"><div class="rvi-n">'+esc(r.nm)+'</div>'
    +'<div class="rvi-s">'+(r.date?dlabel(r.date)+' ':'')+r.g+'명'+(r.phone?' · '+esc(r.phone):'')
    +(tbl?' · <span style="color:var(--blue)">🪑'+esc(tbl.n)+'</span>':'')+'</div>'
    +(r.tags&&r.tags.length?'<div class="rvi-tags">'+r.tags.map(function(t){return'<span class="rvi-tag">'+esc(t)+'</span>';}).join('')+'</div>':'')
    +(r.memo?'<div class="rvi-m">📝'+esc(r.memo)+'</div>':'')
    +'</div><div class="rvi-st" style="color:'+s[0]+';background:'+s[1]+'">'+s[2]+'</div></div>';
}
function renderRvList(){
  var q=(document.getElementById('rvsrch').value||'').trim().toLowerCase();
  var list=S.ress.filter(function(r){return r.st!=='cancelled';});
  if(calSel) list=list.filter(function(r){return r.date===calSel;});
  if(q) list=list.filter(function(r){return (r.nm||'').toLowerCase().indexOf(q)>=0||(r.phone||'').indexOf(q)>=0;});
  document.getElementById('rvtitle').textContent=calSel?dlabel(calSel)+' 예약':'전체 예약';
  document.getElementById('rvcnt').textContent=list.length+'건';
  var sortBtn=document.getElementById('rvsort');
  if(sortBtn) sortBtn.textContent=rvSortAsc?'↑ 날짜순':'↓ 날짜순';
  var sm={confirmed:['#2a9a5a','rgba(42,154,90,.12)','확정'],pending:['var(--amber)','rgba(200,146,42,.1)','대기'],
          arrived:['var(--blue)','rgba(42,114,200,.1)','방문'],noshow:['var(--red2)','rgba(196,18,48,.1)','노쇼'],completed:['var(--indigo)','rgba(90,82,200,.1)','완료']};
  var nd=today();
  var upcomingEl=document.getElementById('rv-upcoming');
  var pastWrap=document.getElementById('rv-past-wrap');
  var pastEl=document.getElementById('rv-past');
  var pastLbl=document.getElementById('rv-past-lbl');
  function bindRvi(container){
    container.querySelectorAll('.rvi').forEach(function(el){
      el.addEventListener('click',function(){openRvDetail(this.getAttribute('data-rid'));});
    });
  }
  var showSections=!calSel&&!q;
  if(showSections){
    var activeSt={confirmed:1,pending:1,arrived:1};
    var upcoming=list.filter(function(r){return r.date>=nd && activeSt[r.st];});
    var past=list.filter(function(r){return r.st==='completed'||r.st==='noshow'||r.date<nd;});
    // 예정 예약: rvSortAsc 적용
    upcoming.sort(function(a,b){
      var ka=(a.date||'9999')+(a.time||'99:99'), kb=(b.date||'9999')+(b.time||'99:99');
      return rvSortAsc?(ka<kb?-1:1):(ka>kb?-1:1);
    });
    // 완료된 예약: 최신순 고정
    past.sort(function(a,b){
      var ka=(a.date||'0000')+(a.time||'00:00'), kb=(b.date||'0000')+(b.time||'00:00');
      return ka>kb?-1:1;
    });
    upcomingEl.innerHTML=upcoming.length
      ? '<div class="rv-sec-lbl">예정 예약 '+upcoming.length+'건</div>'+upcoming.map(function(r){return rvItemHtml(r,sm,false);}).join('')
      : '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">예정 예약 없음</div>';
    bindRvi(upcomingEl);
    if(past.length){
      pastWrap.style.display='flex';
      pastLbl.textContent='완료된 예약 '+past.length+'건';
      pastEl.innerHTML=past.map(function(r){return rvItemHtml(r,sm,true);}).join('');
      bindRvi(pastEl);
    } else {
      pastWrap.style.display='none';
    }
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
  gvRvAdd=2; var df=calSel||today(), avTid=null;
  var emptyT=S.tables.filter(function(t){return t.st==='empty';});
  var tpH='<div style="display:flex;flex-wrap:wrap;gap:5px" id="avtbl">'
    +'<button type="button" class="tag-pill on" data-tid="">미배정</button>'
    +emptyT.map(function(t){return '<button type="button" class="tag-pill" data-tid="'+t.id+'">'+esc(t.n)+'</button>';}).join('')+'</div>';
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
  if(tp) tp.querySelectorAll('[data-tid]').forEach(function(btn){
    btn.addEventListener('click',function(){tp.querySelectorAll('[data-tid]').forEach(function(b){b.classList.remove('on');});this.classList.add('on');avTid=this.getAttribute('data-tid')||null;});
  });
  document.getElementById('avsubmit').addEventListener('click',function(){
    var nm=document.getElementById('avn').value.trim(), d=document.getElementById('avd').value, t=document.getElementById('avt').value;
    if(!nm||!d||!t){alert('이름, 날짜, 시간은 필수입니다');return;}
    var tid=avTid?+avTid:null;
    var nr={id:uid(),nm:nm,phone:getPh('avp'),date:d,time:t,g:getGuestVal('g-addrv'),memo:document.getElementById('avm').value,tags:getTags('avtags'),st:document.getElementById('avs').value,tableId:tid||null};
    S.ress.push(nr);
    if(tid){
      var ro={name:nm,g:getGuestVal('g-addrv'),time:t,date:d,phone:nr.phone,memo:nr.memo,tags:nr.tags,resId:nr.id};
      S.tables=S.tables.map(function(tb){return tb.id===tid?Object.assign({},tb,{st:'reserved',res:ro}):tb;});
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
  var tbl=r.tableId?S.tables.filter(function(t){return t.id===r.tableId;})[0]:null;
  showModal('<div class="md-hd"><span class="md-title">'+esc(r.nm)+' 예약</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="ib" style="background:var(--surf2);border-color:var(--border2)">'
    +'<div class="ir"><span class="il">날짜</span><span class="iv">'+dlabel(r.date)+'</span></div>'
    +'<div class="ir"><span class="il">시간</span><span class="iv">'+esc(r.time)+'</span></div>'
    +'<div class="ir"><span class="il">인원</span><span class="iv">'+r.g+'명</span></div>'
    +(r.phone?'<div class="ir"><span class="il">연락처</span><span class="iv"><a href="tel:'+esc(r.phone)+'" style="color:#60a5fa;text-decoration:none">'+esc(r.phone)+'</a></span></div>':'')
    +(r.memo?'<div class="ir"><span class="il">메모</span><span class="iv" style="text-align:right;max-width:160px">'+esc(r.memo)+'</span></div>':'')
    +(r.tags&&r.tags.length?'<div class="ir"><span class="il">태그</span><span class="iv" style="text-align:right">'+r.tags.map(function(t){return'<span class="rvi-tag">'+esc(t)+'</span>';}).join(' ')+'</span></div>':'')
    +'<div class="ir"><span class="il">테이블</span><span class="iv" style="color:'+(tbl?'var(--blue)':'var(--text3)')+'">'+(tbl?esc(tbl.n):'미배정')+'</span></div>'
    +'<div class="ir"><span class="il">상태</span><span class="iv">'+sml[r.st]+'</span></div>'
    +'</div>'
    +'<div style="display:flex;gap:5px;margin-bottom:9px">'
    +['arrived','completed','noshow','cancelled'].map(function(s){return '<button style="flex:1;padding:8px 0;border:none;border-radius:8px;background:'+(sc[s]?sc[s][1]:'var(--surf2)')+';color:'+(sc[s]?sc[s][0]:'var(--text2)')+';font-weight:700;font-size:12px;cursor:pointer;font-family:inherit" data-st="'+s+'">'+sml[s]+'</button>';}).join('')+'</div>'
    +(!tbl?'<button class="ab" style="background:var(--blue);width:100%;margin-bottom:7px" id="bassign">🪑 테이블 배정</button>':'<button class="ab" style="background:var(--surf3);color:var(--text2);width:100%;margin-bottom:7px" id="bunassign">배정 해제</button>')
    +(r.phone?'<button class="ab" style="background:var(--surf3);color:var(--text2);width:100%;margin-bottom:7px" id="bcustinfo">👤 고객 정보</button>':'')
    +((r.st==='completed'||r.st==='noshow')?'<button class="ab" style="background:var(--green);width:100%;margin-bottom:7px" id="brestore">🔄 예약 복구 (확정으로 변경)</button>':'')
    +'<div class="abs"><button class="ab" style="background:var(--indigo)" id="bedit2">✏️ 수정</button>'
    +'<button class="ab" style="background:var(--red)" id="bcanc">완전 삭제</button></div>');
  document.getElementById('mdc').querySelectorAll('[data-st]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var st=this.getAttribute('data-st');
      S.ress=S.ress.map(function(x){return x.id==rid?Object.assign({},x,{st:st}):x;});
      if(st==='arrived'&&r.tableId){S.tables=S.tables.map(function(t){return t.id===r.tableId?Object.assign({},t,{st:'occupied',seatTime:Date.now(),g:r.g,res:null}):t;});S.tables.forEach(function(t){cardCache[t.id]='';});}
      if(st==='cancelled'&&r.tableId){S.tables=S.tables.map(function(t){return t.id===r.tableId&&t.st==='reserved'?Object.assign({},t,{st:'empty',res:null}):t;});S.tables.forEach(function(t){cardCache[t.id]='';});}
      saveData(); closeModal(); renderReservations(); renderHeader(); renderStats(); renderSidebar(); if(currentTab==='floor') renderCanvas();
    });
  });
  var ba=document.getElementById('bassign');
  if(ba) ba.addEventListener('click',function(){closeModal();openAssignTable(rid);});
  var bu=document.getElementById('bunassign');
  if(bu) bu.addEventListener('click',function(){
    if(tbl){S.tables=S.tables.map(function(t){return t.id===tbl.id?Object.assign({},t,{st:'empty',res:null}):t;});S.tables.forEach(function(t){cardCache[t.id]='';});}
    S.ress=S.ress.map(function(x){return x.id==rid?Object.assign({},x,{tableId:null}):x;});
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
    if(r.tableId){S.tables=S.tables.map(function(t){return t.id===r.tableId&&t.st==='reserved'?Object.assign({},t,{st:'empty',res:null}):t;});S.tables.forEach(function(t){cardCache[t.id]='';});}
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

  var currentDate = floorDate || today();   // ← 핵심: 현재 보고 있는 날짜

  // 간단 버전: 빈 테이블만이 아니라 모든(슬레이브 제외) 테이블에 배정 가능
  var et = S.tables.filter(function(t){ return !isSlaveTbl(t.id); });
  // 선택 UX 개선: 비어있는 테이블을 위로 정렬
  et.sort(function(a, b){
    var av = a.st === 'empty' ? 0 : 1;
    var bv = b.st === 'empty' ? 0 : 1;
    if (av !== bv) return av - bv;
    return String(a.n).localeCompare(String(b.n), 'ko');
  });

  var html = '<div class="md-hd"><span class="md-title">' + esc(r.nm) + ' — 테이블 배정</span><button class="md-x" id="mxbtn">×</button></div>';
  if (!et.length) html += '<p style="font-size:13px;color:var(--text3);text-align:center;padding:16px 0">배정 가능한 테이블 없음</p>';
  else html += '<p style="font-size:13px;color:var(--text2);margin-bottom:10px">배정할 테이블을 선택하세요</p>' +
    '<div style="display:flex;flex-direction:column;gap:6px">' +
    et.map(function(t){
      var assignedCount = S.ress.filter(function(x){
        return x.tableId === t.id && x.date === r.date && x.st !== 'cancelled' && x.st !== 'noshow';
      }).length;
      var rightInfo =
        ({'sq':'정방형','wide':'가로형','bar':'바형'}[t.shape]||t.shape) + ' ' + t.sz.toUpperCase() +
        (assignedCount > 0 ? (' · ' + assignedCount + '팀') : '');
      return '<button class="tpb" data-tid="' + t.id + '"><span>' + esc(t.n) + '</span><span class="tps">' +
        rightInfo + '</span></button>';
    }).join('') + '</div>';

  showModal(html);

  document.getElementById('mdc').querySelectorAll('.tpb').forEach(function(btn){
    btn.addEventListener('click', function(){
      var tid = +this.getAttribute('data-tid');
      var ro = {name:r.nm, g:r.g, time:r.time, date:r.date, phone:r.phone, memo:r.memo, tags:r.tags, resId:r.id};

      // 1. 예약 자체에는 언제나 tableId 저장
      S.ress = S.ress.map(function(x){ return x.id==rid ? Object.assign({},x,{tableId:tid}) : x; });

      // 2. 현재 보고 있는 날짜의 테이블 상태만 변경 (미래 예약은 오늘 영향 X)
      if (r.date === currentDate) {
        // 이미 배정/착석 중인 테이블이면 기존 대표 예약은 유지하고, 비어있을 때만 대표 예약 세팅
        S.tables = S.tables.map(function(t){
          if (t.id !== tid) return t;
          if (t.st === 'empty') return Object.assign({}, t, {st:'reserved', res:ro});
          return t;
        });
        S.tables.forEach(function(t){ cardCache[t.id] = ''; });
      }

      saveData();
      closeModal();
      renderReservations();
      // 현재 floor가 해당 날짜라면 바로 반영
      if (currentDate === (floorDate || today())) renderAll();
    });
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
    +['confirmed','pending','arrived','noshow','completed'].map(function(s){return'<option value="'+s+'"'+(r.st===s?' selected':'')+'>'+{confirmed:'확정',pending:'대기',arrived:'방문',noshow:'노쇼',completed:'완료'}[s]+'</option>';}).join('')
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

function openTagMgr(){
  function mkH(){ return '<div class="md-hd"><span class="md-title">태그 관리</span><button class="md-x" id="mxbtn">×</button></div><div class="mb"><div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px" id="tmlist">'+S.tags.map(function(t,i){return'<div style="display:flex;align-items:center;gap:3px;background:var(--surf3);border-radius:99px;padding:3px 6px 3px 11px"><span style="font-size:13px;font-weight:700;color:var(--text)">'+esc(t)+'</span><button type="button" style="border:none;background:none;color:var(--text3);font-size:14px;cursor:pointer;padding:0 3px;line-height:1" data-tidx="'+i+'">×</button></div>';}).join('')+'</div><div style="display:flex;gap:6px"><input class="fi" id="tmnew" placeholder="새 태그" style="flex:1"><button class="bp" id="tmadd">추가</button></div><button class="ab" style="background:var(--indigo);width:100%;margin-top:8px" id="tmdone">완료</button></div>'; }
  function bnd(){ document.getElementById('mxbtn').addEventListener('click',closeModal); document.getElementById('tmlist').querySelectorAll('[data-tidx]').forEach(function(btn){btn.addEventListener('click',function(){S.tags.splice(+this.getAttribute('data-tidx'),1);saveData();document.getElementById('mdc').innerHTML=mkH();bnd();});}); document.getElementById('tmadd').addEventListener('click',function(){var v=document.getElementById('tmnew').value.trim();if(!v)return;if(S.tags.indexOf(v)>=0){alert('이미 있습니다');return;}S.tags.push(v);saveData();document.getElementById('mdc').innerHTML=mkH();bnd();}); document.getElementById('tmnew').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('tmadd').click();}); document.getElementById('tmdone').addEventListener('click',closeModal); }
  document.getElementById('mdc').innerHTML=mkH(); document.getElementById('mo').classList.add('on'); bnd();
}

