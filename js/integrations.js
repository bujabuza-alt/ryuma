// ── 외부 연동 (Integrations: Gemini, Notion) ──
// ── 네이버 예약 가져오기 (Gemini Vision API) ──
function getGeminiKey() {
  return localStorage.getItem('ryuma_gemini_key') || '';
}

function openGeminiKeyInput(cb) {
  var cur = getGeminiKey();
  showModal(
    '<div class="md-hd"><span class="md-title">Gemini API 키 설정</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb">'
    +'<div style="font-size:12px;color:var(--text2);line-height:1.8;margin-bottom:10px">'
    +'① <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--blue)">aistudio.google.com/apikey</a> 접속<br>'
    +'② <b>Create API key</b> 클릭<br>'
    +'③ 생성된 키 복사 (AIza...)<br>'
    +'<span style="color:var(--green);font-weight:700">✓ 무료 플랜: 하루 1,500회 사용 가능</span>'
    +'</div>'
    +'<div class="fg"><label class="fl">API Key</label>'
    +'<input class="fi" id="gemini-key-input" type="password" placeholder="AIza..." value="'+esc(cur)+'" style="font-size:12px;letter-spacing:.04em"></div>'
    +'<button class="ab" style="background:var(--indigo);width:100%" id="gemini-key-save">저장</button>'
    +'</div>'
  );
  document.getElementById('gemini-key-save').addEventListener('click', function() {
    var key = document.getElementById('gemini-key-input').value.trim();
    if (!key || !key.startsWith('AIza')) { alert('올바른 키를 입력하세요 (AIza로 시작)'); return; }
    localStorage.setItem('ryuma_gemini_key', key);
    closeModal();
    if (cb) setTimeout(cb, 200);
  });
}

function openNaverImport() {
  var key = getGeminiKey();
  if (!key) { openGeminiKeyInput(openNaverImport); return; }

  var imgData = null, imgMediaType = null;

  showModal(
    '<div class="md-hd"><span class="md-title">📷 네이버 예약 가져오기</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb">'
    +'<div style="font-size:11px;color:var(--text2);margin-bottom:10px">스마트플레이스 예약 상세 페이지의 스크린샷을 업로드하면 자동으로 파싱합니다</div>'
    +'<div class="nv-upload-area" id="nv-area">'
    +'<div class="nv-upload-label" id="nv-lbl">📸 여기를 눌러 스크린샷 선택</div>'
    +'<div class="nv-upload-hint">JPG · PNG 지원</div>'
    +'<img class="nv-preview" id="nv-prev" alt="preview">'
    +'</div>'
    +'<input type="file" id="nv-file" accept="image/*" style="display:none">'
    +'<div style="display:flex;gap:7px;margin-top:10px">'
    +'<button class="ab" style="flex:1;background:var(--surf3);color:var(--text2)" id="nv-sel-btn">이미지 선택</button>'
    +'<button class="ab" style="flex:1;background:var(--green)" id="nv-parse-btn" disabled>✨ 분석하기</button>'
    +'</div>'
    +'<div class="nv-status" id="nv-status"></div>'
    +'</div>'
  );

  var area = document.getElementById('nv-area');
  var fileInp = document.getElementById('nv-file');
  var parseBtn = document.getElementById('nv-parse-btn');
  var prev = document.getElementById('nv-prev');
  var status = document.getElementById('nv-status');

  function loadFile(file) {
    if (!file) return;
    imgMediaType = file.type || 'image/jpeg';
    var reader = new FileReader();
    reader.onload = function(e) {
      imgData = e.target.result.split(',')[1];
      prev.src = e.target.result;
      prev.classList.add('on');
      area.classList.add('has-img');
      document.getElementById('nv-lbl').textContent = file.name;
      parseBtn.disabled = false;
      status.textContent = '';
    };
    reader.readAsDataURL(file);
  }

  area.addEventListener('click', function() { fileInp.click(); });
  document.getElementById('nv-sel-btn').addEventListener('click', function(e) { e.stopPropagation(); fileInp.click(); });
  fileInp.addEventListener('change', function() { if (this.files[0]) loadFile(this.files[0]); });

  parseBtn.addEventListener('click', function() {
    if (!imgData) return;
    parseBtn.disabled = true;
    status.textContent = 'Gemini AI가 예약 정보를 분석 중입니다…';
    status.style.color = 'var(--amber)';
    parseNaverScreenshot(imgData, imgMediaType).then(function(parsed) {
      closeModal();
      setTimeout(function() { confirmNaverImport(parsed); }, 100);
    }).catch(function(err) {
      status.textContent = '분석 실패: ' + (err.message || '알 수 없는 오류');
      status.style.color = 'var(--red2)';
      parseBtn.disabled = false;
    });
  });
}

function parseNaverScreenshot(base64, mediaType) {
  var key = getGeminiKey();
  var prompt = '이 이미지는 네이버 스마트플레이스 예약 상세 페이지의 스크린샷입니다.\n'
    + '다음 예약 정보를 추출해서 JSON 객체만 반환하세요. 설명이나 마크다운 없이 JSON만 응답하세요:\n'
    + '{\n'
    + '  "nm": "예약자명 (문자열)",\n'
    + '  "phone": "전화번호, 010-XXXX-XXXX 형식으로 변환. 없으면 빈 문자열",\n'
    + '  "product": "상품명 (예: 홀 테이블 예약, 없으면 빈 문자열)",\n'
    + '  "date": "이용날짜 YYYY-MM-DD 형식",\n'
    + '  "time": "이용시간 HH:MM 형식 (24시간제)",\n'
    + '  "g": 인원수 숫자,\n'
    + '  "memo": "요청사항 내용 (없으면 빈 문자열)"\n'
    + '}\n'
    + '값을 찾을 수 없으면 null 또는 빈 문자열로 처리하세요.';

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + key;

  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mediaType || 'image/jpeg', data: base64 } },
          { text: prompt }
        ]
      }],
      generationConfig: { maxOutputTokens: 512, temperature: 0 }
    })
  }).then(function(res) {
    if (!res.ok) {
      return res.json().catch(function() { return {}; }).then(function(err) {
        if (res.status === 400 || res.status === 403) {
          localStorage.removeItem('ryuma_gemini_key');
          throw new Error('API 키가 유효하지 않습니다. 설정에서 다시 입력해주세요.');
        }
        var msg = err.error && err.error.message ? err.error.message : '오류 코드 ' + res.status;
        throw new Error(msg);
      });
    }
    return res.json();
  }).then(function(data) {
    var text = (data.candidates && data.candidates[0] &&
                data.candidates[0].content && data.candidates[0].content.parts &&
                data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) || '';
    var match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('응답에서 예약 정보를 찾을 수 없습니다');
    return JSON.parse(match[0]);
  });
}

function confirmNaverImport(p) {
  if (!p) { alert('파싱 결과가 없습니다'); return; }
  var d = p.date || today();
  var t = p.time || '18:00';
  var g = +(p.g) || 2;
  var memo = p.memo || '';

  showModal(
    '<div class="md-hd"><span class="md-title">가져오기 확인</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb">'
    +'<div style="background:rgba(42,154,90,.1);border:1px solid rgba(42,154,90,.3);border-radius:8px;padding:8px 11px;font-size:11px;color:var(--green);margin-bottom:12px">✓ 파싱 완료 · 내용을 확인하고 저장하세요</div>'
    +'<div class="g2">'
    +'<div class="fg"><label class="fl">이름 *</label><input class="fi" id="nvi-nm" value="'+esc(p.nm||'')+'"></div>'
    +'<div class="fg"><label class="fl">연락처</label>'+phHtml('nvi-ph', p.phone||'')+'</div></div>'
    +'<div class="g2">'
    +'<div class="fg"><label class="fl">날짜 *</label><input class="fi" id="nvi-d" type="date" value="'+esc(d)+'"></div>'
    +'<div class="fg"><label class="fl">시간 *</label><input class="fi" id="nvi-t" type="time" value="'+esc(t)+'"></div></div>'
    +'<div class="fg"><label class="fl">인원</label>'+guestSelectHtml('nvi-g', g, 50)+'</div>'
    +'<div class="fg"><label class="fl">메모</label><textarea class="fi" id="nvi-memo" rows="2">'+esc(memo)+'</textarea></div>'
    +'<div class="fg"><label class="fl">태그(선택)</label>'+tagHtml('nvi-tags',[])+'</div>'
    +'<button class="ab" style="background:var(--green);width:100%" id="nvi-save">저장</button>'
    +'</div>'
  );

  bindPh('nvi-ph');
  bindTag('nvi-tags');

  document.getElementById('nvi-save').addEventListener('click', function() {
    var nm = document.getElementById('nvi-nm').value.trim();
    var dd = document.getElementById('nvi-d').value;
    var tt = document.getElementById('nvi-t').value;
    if (!nm || !dd || !tt) { alert('이름, 날짜, 시간은 필수입니다'); return; }
    var nr = {
      id: uid(), nm: nm,
      phone: getPh('nvi-ph'),
      date: dd, time: tt,
      g: getGuestVal('nvi-g'),
      memo: document.getElementById('nvi-memo').value,
      tags: getTags('nvi-tags'),
      st: 'confirmed',
      tableId: null,
      src: 'naver'
    };
    S.ress.push(nr);
    closeModal();
    saveData();
    var notionToken = getNotionToken();
    if (notionToken) { saveOneToNotion(nr); }
    renderReservations();
    renderSidebar();
    renderHeader();
    showBadge('saved');
    setTimeout(function() { showBadge(''); }, 2000);
  });
}

function saveOneToNotion(r) {
  var token = getNotionToken();
  if (!token) return;
  var storeName = currentStore === 'covent' ? '코벤트' : '파라곤';
  var stMap = {confirmed:'확정', cancelled:'취소'};
  var body = {
    parent: { database_id: NOTION_DB_ID },
    properties: {
      '예약자명': { title: [{ text: { content: r.nm || '(이름없음)' } }] },
      '인원':     { number: r.g || 1 },
      '연락처':   { phone_number: r.phone || null },
      '메모':     { rich_text: [{ text: { content: r.memo || '' } }] },
      '매장':     { select: { name: storeName } },
      '상태':     { select: { name: stMap[r.st] || '확정' } }
    }
  };
  if (r.date) body.properties['예약날짜'] = { date: { start: r.date } };
  fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify(body)
  }).then(function(res) {
    if (!res.ok) res.json().then(function(err) {
      if (err.code === 'unauthorized') localStorage.removeItem('ryuma_notion_token');
    });
  }).catch(function(e) { console.warn('Notion save failed:', e); });
}

// ── 노션 백업 (Notion API 직접 호출) ──

function setBackupStatus(msg, color) {
  var el = document.getElementById('backup-status');
  if (el) { el.textContent = msg; el.style.color = color || 'var(--text2)'; }
}

function getNotionToken() {
  return localStorage.getItem('ryuma_notion_token') || '';
}

function openNotionTokenInput() {
  var cur = getNotionToken();
  showModal(
    '<div class="md-hd"><span class="md-title">Notion 연동 설정</span><button class="md-x" id="mxbtn">×</button></div>'
    +'<div class="mb">'
    +'<div style="font-size:12px;color:var(--text2);line-height:1.7;margin-bottom:10px">'
    +'① notion.so → 설정 → 연결 → <b>연결 개발</b><br>'
    +'② 새 Integration 생성 → Internal<br>'
    +'③ 생성된 <b>Secret 토큰</b> 복사<br>'
    +'④ 류마 예약 백업 DB → ··· → <b>Connections</b>에 추가'
    +'</div>'
    +'<div class="fg"><label class="fl">Integration Secret 토큰</label>'
    +'<input class="fi" id="notion-token-input" type="password" placeholder="secret_..." value="'+esc(cur)+'" style="font-size:12px"></div>'
    +'<button class="ab" style="background:var(--indigo);width:100%" id="notion-token-save">저장 후 백업 시작</button>'
    +'</div>'
  );
  document.getElementById('notion-token-save').addEventListener('click', function() {
    var token = document.getElementById('notion-token-input').value.trim();
    if (!token || !token.startsWith('secret_')) {
      alert('올바른 토큰을 입력하세요 (secret_으로 시작)'); return;
    }
    localStorage.setItem('ryuma_notion_token', token);
    closeModal();
    // 설정 모달 다시 열고 백업 실행
    setTimeout(function() { openCfg(); setTimeout(runNotionBackup, 300); }, 200);
  });
}

async function runNotionBackup() {
  var token = getNotionToken();
  if (!token) { openNotionTokenInput(); return; }

  if (!S.ress || !S.ress.length) {
    setBackupStatus('백업할 예약 데이터가 없습니다', 'var(--amber)'); return;
  }
  var btn = document.getElementById('btn-backup');
  if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
  setBackupStatus('백업 중…', 'var(--amber)');

  var storeName = currentStore === 'covent' ? '코벤트' : '파라곤';
  var stMap = {confirmed:'확정'};
  var ok = 0, fail = 0;
  var list = S.ress.filter(function(r){ return r.st !== 'cancelled'; });

  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    var body = {
      parent: { database_id: NOTION_DB_ID },
      properties: {
        '예약자명': { title: [{ text: { content: r.nm || '(이름없음)' } }] },
        '인원':     { number: r.g || 1 },
        '연락처':   { phone_number: r.phone || null },
        '메모':     { rich_text: [{ text: { content: r.memo || '' } }] },
        '매장':     { select: { name: storeName } },
        '상태':     { select: { name: stMap[r.st] || '확정' } }
      }
    };
    if (r.date) {
      body.properties['예약날짜'] = { date: { start: r.date } };
    }
    try {
      var res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify(body)
      });
      if (res.ok) { ok++; }
      else {
        var err = await res.json();
        if (err.code === 'unauthorized') {
          // 토큰 오류 → 재입력 유도
          if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
          setBackupStatus('토큰 오류. 다시 설정해주세요', 'var(--red2)');
          localStorage.removeItem('ryuma_notion_token');
          return;
        }
        fail++;
      }
    } catch(e) { fail++; }
    setBackupStatus('저장 중… (' + (ok+fail) + '/' + list.length + ')', 'var(--amber)');
  }

  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  if (fail === 0) {
    setBackupStatus('✅ ' + ok + '건 백업 완료!', '#2a9a5a');
  } else {
    setBackupStatus('⚠ ' + ok + '건 성공 / ' + fail + '건 실패', 'var(--red2)');
  }
}
async function runNotionCustBackup(statusElId) {
  var token = getNotionToken();
  if (!token) { openNotionTokenInput(); return; }
  var custs = getAllCustomers();
  if (!custs.length) {
    if(statusElId){var el=document.getElementById(statusElId);if(el){el.textContent='백업할 손님 데이터 없음';el.style.color='var(--amber)';}} return;
  }
  var btn = document.getElementById('btn-cust-notion');
  if (btn) { btn.disabled=true; btn.style.opacity='.6'; btn.textContent='백업 중…'; }
  var stEl = statusElId ? document.getElementById(statusElId) : null;
  if (stEl) { stEl.textContent='노션에 저장 중…'; stEl.style.color='var(--amber)'; }
  var ok=0, fail=0;
  var visitMap = {'0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9'};
  for (var i=0; i<custs.length; i++) {
    var c = custs[i];
    var vStr = c.total >= 10 ? '10이상' : (visitMap[String(c.total)] || '0');
    var body = {
      parent: { database_id: NOTION_CUST_DB_ID },
      properties: {
        '이름':     { title: [{ text: { content: c.name||c.phone||'(이름없음)' } }] },
        '전화번호': { phone_number: c.phone || null },
        '방문 횟수':{ select: { name: vStr } },
        '특이사항': { rich_text: [{ text: { content: c.memo||'' } }] }
      }
    };
    if (c.first) body.properties['첫 방문']     = { date: { start: c.first } };
    if (c.last)  body.properties['마지막 방문'] = { date: { start: c.last  } };
    try {
      var res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: { 'Authorization':'Bearer '+token, 'Content-Type':'application/json', 'Notion-Version':'2022-06-28' },
        body: JSON.stringify(body)
      });
      if (res.ok) { ok++; }
      else {
        var err = await res.json();
        if (err.code==='unauthorized') {
          if(btn){btn.disabled=false;btn.style.opacity='1';btn.textContent='☁ 노션';}
          if(stEl){stEl.textContent='토큰 오류. 다시 설정해주세요';stEl.style.color='var(--red2)';}
          localStorage.removeItem('ryuma_notion_token'); return;
        }
        fail++;
      }
    } catch(e) { fail++; }
    if(stEl) stEl.textContent='저장 중… ('+(ok+fail)+'/'+custs.length+')';
  }
  if(btn){btn.disabled=false;btn.style.opacity='1';btn.textContent='☁ 노션';}
  if(stEl){
    stEl.textContent = fail===0 ? '✅ '+ok+'명 백업 완료!' : '⚠ '+ok+'명 성공 / '+fail+'명 실패';
    stEl.style.color = fail===0 ? '#2a9a5a' : 'var(--red2)';
  }
}
