// ── 알바 출퇴근 기록 (Part-timer Attendance) ──
var DEFAULT_STAFF_PW = '0000';
var staffUnlocked  = false;
var staffSubTab    = 'active';   // 'active' | 'resigned' | 'logs'
var staffShiftSel  = {};         // staffId -> 'lunch' | 'dinner' (UI 선택 상태, 저장하지 않음)
var staffTimeSel   = {};         // staffId -> 분 단위 선택 시각 (UI 선택 상태, 저장하지 않음)

function getStaffPw() { return (S && S.staffPw) || DEFAULT_STAFF_PW; }

// ── 근무조 ──
function shiftRange(shift) { return shift === 'dinner' ? {s: 16*60, e: 23*60} : {s: 10*60, e: 15*60}; }
function shiftLabel(shift) { return shift === 'dinner' ? '디너' : '런치'; }
function minToStr(m) { return pad(Math.floor(m/60)) + ':' + pad(m%60); }
function nearestQuarterInRange(shift) {
  var now = new Date();
  var m = Math.round((now.getHours()*60 + now.getMinutes()) / 15) * 15;
  var r = shiftRange(shift);
  if (m < r.s) m = r.s;
  if (m > r.e) m = r.e;
  return m;
}
function shiftTimeOptionsHtml(shift, selected) {
  var r = shiftRange(shift), html = '';
  for (var m = r.s; m <= r.e; m += 15) {
    html += '<option value="' + m + '"' + (m === selected ? ' selected' : '') + '>' + minToStr(m) + '</option>';
  }
  return html;
}

// ── 잠금 화면 ──
function checkStaffLock() {
  var lockEl = document.getElementById('staff-lock');
  var contentEl = document.getElementById('staff-content');
  if (!lockEl || !contentEl) return;
  if (staffUnlocked) {
    lockEl.style.display = 'none';
    contentEl.classList.add('on');
    renderStaffTab();
  } else {
    lockEl.style.display = 'flex';
    contentEl.classList.remove('on');
    document.getElementById('staff-pw-input').value = '';
    document.getElementById('staff-pw-err').textContent = '';
  }
}
function tryStaffUnlock() {
  var input = document.getElementById('staff-pw-input');
  var errEl = document.getElementById('staff-pw-err');
  if (input.value.trim() === getStaffPw()) {
    staffUnlocked = true;
    checkStaffLock();
  } else {
    errEl.textContent = '비밀번호가 일치하지 않습니다';
    input.value = '';
  }
}
function openStaffPwChange() {
  showModal(
    '<div class="md-hd"><span class="md-title">알바 출퇴근 비밀번호 변경</span><button class="md-x" id="mxbtn">×</button></div>' +
    '<div class="mb">' +
    '<div class="fg"><label class="fl">현재 비밀번호</label><input class="fi" type="password" id="stf-pw-cur" placeholder="현재 비밀번호" inputmode="numeric" autocomplete="off"></div>' +
    '<div class="fg"><label class="fl">새 비밀번호</label><input class="fi" type="password" id="stf-pw-new" placeholder="새 비밀번호 (4자리 이상)" inputmode="numeric" autocomplete="off"></div>' +
    '<div class="fg"><label class="fl">새 비밀번호 확인</label><input class="fi" type="password" id="stf-pw-new2" placeholder="새 비밀번호 확인" inputmode="numeric" autocomplete="off"></div>' +
    '<button class="ab" style="background:var(--indigo);width:100%" id="stf-pw-save">변경</button>' +
    '</div>'
  );
  document.getElementById('stf-pw-save').addEventListener('click', function() {
    var cur = document.getElementById('stf-pw-cur').value;
    var n1  = document.getElementById('stf-pw-new').value;
    var n2  = document.getElementById('stf-pw-new2').value;
    if (cur !== getStaffPw()) { alert('현재 비밀번호가 일치하지 않습니다'); return; }
    if (!n1 || n1.length < 4) { alert('새 비밀번호는 4자리 이상 입력하세요'); return; }
    if (n1 !== n2) { alert('새 비밀번호가 일치하지 않습니다'); return; }
    S.staffPw = n1;
    saveData();
    closeModal();
    showToast('비밀번호가 변경되었습니다');
  });
}

// ── 알바생 CRUD ──
function openStaffForm(existing) {
  var isEdit = !!existing;
  showModal(
    '<div class="md-hd"><span class="md-title">' + (isEdit ? '알바생 정보 수정' : '알바생 추가') + '</span><button class="md-x" id="mxbtn">×</button></div>' +
    '<div class="mb">' +
    '<div class="fg"><label class="fl">이름</label><input class="fi" id="stf-f-name" value="' + esc(existing ? existing.name : '') + '" placeholder="이름"></div>' +
    '<div class="fg"><label class="fl">연락처</label>' + phHtml('stf-f-phone', existing ? existing.phone : '') + '</div>' +
    '<div class="fg"><label class="fl">직급/포지션</label><input class="fi" id="stf-f-position" value="' + esc(existing ? existing.position : '') + '" placeholder="예: 홀, 주방"></div>' +
    '<div class="fg"><label class="fl">입사일</label><input class="fi" type="date" id="stf-f-join" value="' + esc(existing ? existing.joinDate : today()) + '"></div>' +
    '<div class="fg"><label class="fl">메모</label><textarea class="fi" id="stf-f-memo" placeholder="간단한 정보(시급, 특이사항 등)…">' + esc(existing ? existing.memo : '') + '</textarea></div>' +
    '<button class="ab" style="background:var(--indigo);width:100%" id="stf-f-save">저장</button>' +
    '</div>'
  );
  bindPh('stf-f-phone');
  document.getElementById('stf-f-save').addEventListener('click', function() {
    var name = document.getElementById('stf-f-name').value.trim();
    if (!name) { alert('이름을 입력하세요'); return; }
    var data = {
      name: name,
      phone: getPh('stf-f-phone'),
      position: document.getElementById('stf-f-position').value.trim(),
      joinDate: document.getElementById('stf-f-join').value || today(),
      memo: document.getElementById('stf-f-memo').value.trim()
    };
    if (isEdit) {
      Object.assign(existing, data);
    } else {
      data.id = uid();
      S.staffActive.push(data);
    }
    saveData();
    closeModal();
    renderStaffTab();
    showToast((isEdit ? name + ' - 정보가 수정되었습니다' : name + ' - 알바생이 추가되었습니다'));
  });
}
function resignStaff(id) {
  var idx = S.staffActive.findIndex(function(s) { return s.id === id; });
  if (idx < 0) return;
  if (!confirm('이 알바생을 퇴사 처리하시겠습니까?')) return;
  var s = S.staffActive.splice(idx, 1)[0];
  s.resignDate = today();
  S.staffResigned.push(s);
  saveData();
  renderStaffTab();
  showToast(s.name + ' - 퇴사 처리되었습니다');
}
function rehireStaff(id) {
  var idx = S.staffResigned.findIndex(function(s) { return s.id === id; });
  if (idx < 0) return;
  if (!confirm('이 알바생을 다시 현재 알바생으로 복직 처리하시겠습니까?')) return;
  var s = S.staffResigned.splice(idx, 1)[0];
  delete s.resignDate;
  S.staffActive.push(s);
  saveData();
  renderStaffTab();
  showToast(s.name + ' - 복직 처리되었습니다');
}
function deleteStaff(id, mode) {
  if (!confirm('이 알바생 정보를 완전히 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
  var arr = mode === 'resigned' ? S.staffResigned : S.staffActive;
  var idx = arr.findIndex(function(s) { return s.id === id; });
  if (idx < 0) return;
  var name = arr[idx].name;
  arr.splice(idx, 1);
  saveData();
  renderStaffTab();
  showToast(name + ' - 정보가 삭제되었습니다');
}
function openStaffMenu(id, mode) {
  var arr = mode === 'resigned' ? S.staffResigned : S.staffActive;
  var s = (arr||[]).filter(function(x) { return x.id === id; })[0];
  if (!s) return;
  showModal(
    '<div class="md-hd"><span class="md-title">' + esc(s.name) + '</span><button class="md-x" id="mxbtn">×</button></div>' +
    '<div class="mb">' +
    '<button class="ab" style="background:var(--indigo)" id="stf-menu-edit">✏ 정보 수정</button>' +
    (mode === 'resigned'
      ? '<button class="ab" style="background:var(--green)" id="stf-menu-rehire">↺ 복직 처리</button>'
      : '<button class="ab" style="background:var(--amber)" id="stf-menu-resign">퇴사 처리</button>') +
    '<button class="ab" style="background:var(--red2)" id="stf-menu-del">삭제</button>' +
    '</div>'
  );
  document.getElementById('stf-menu-edit').addEventListener('click', function() {
    closeModal(); setTimeout(function() { openStaffForm(s); }, 150);
  });
  var rehireBtn = document.getElementById('stf-menu-rehire');
  if (rehireBtn) rehireBtn.addEventListener('click', function() { closeModal(); rehireStaff(id); });
  var resignBtn = document.getElementById('stf-menu-resign');
  if (resignBtn) resignBtn.addEventListener('click', function() { closeModal(); resignStaff(id); });
  document.getElementById('stf-menu-del').addEventListener('click', function() { closeModal(); deleteStaff(id, mode); });
}

// ── 출퇴근 기록 ──
function getTodayLogs(staffId) {
  var td = today();
  return (S.staffLogs||[]).filter(function(l) { return l.staffId === staffId && l.date === td; });
}
function getTodayShiftRecord(staffId, shift) {
  var logs = getTodayLogs(staffId).filter(function(l) { return l.shift === shift; });
  var inLog  = logs.filter(function(l) { return l.type === 'in';  }).sort(function(a,b){ return b.ts-a.ts; })[0];
  var outLog = logs.filter(function(l) { return l.type === 'out'; }).sort(function(a,b){ return b.ts-a.ts; })[0];
  return { inTime: inLog ? inLog.time : null, outTime: outLog ? outLog.time : null };
}
function recordAttendance(staff, shift, type, minutes) {
  var timeStr = minToStr(minutes);
  var text = staff.name + ' - ' + shiftLabel(shift) + ' ' + (type === 'in' ? '출근' : '퇴근') + ' 기록 완료 (' + timeStr + ')';
  if (!S.staffLogs) S.staffLogs = [];
  S.staffLogs.unshift({
    id: uid(), ts: Date.now(), date: today(), staffId: staff.id, staffName: staff.name,
    shift: shift, type: type, time: timeStr, text: text
  });
  if (S.staffLogs.length > 500) S.staffLogs.length = 500;
  saveData();
  renderStaffTab();
  showToast(text);
}

// ── 렌더링 ──
function staffCardHtml(s, mode) {
  var shift = staffShiftSel[s.id] || 'lunch';
  var timeSelected = staffTimeSel[s.id] != null ? staffTimeSel[s.id] : nearestQuarterInRange(shift);
  var isResigned = mode === 'resigned';
  var subParts = [];
  if (s.position) subParts.push(s.position);
  if (s.phone) subParts.push(s.phone);
  subParts.push(isResigned ? '퇴사일 ' + (s.resignDate||'-') : '입사일 ' + (s.joinDate||'-'));
  var rec = isResigned ? null : getTodayShiftRecord(s.id, shift);

  var html = '<div class="stf-card" data-id="' + s.id + '">' +
    '<div class="stf-hd"><div>' +
    '<div class="stf-name">' + esc(s.name) + '</div>' +
    '<div class="stf-sub">' + esc(subParts.join(' · ')) + '</div>' +
    '</div>' +
    '<button type="button" class="stf-menu-btn" data-act="menu" data-id="' + s.id + '">⋯</button>' +
    '</div>';

  if (!isResigned) {
    html += '<div class="stf-shift-row">' +
      '<button type="button" class="stf-shift-pill' + (shift==='lunch'?' on':'') + '" data-act="shift" data-shift="lunch" data-id="' + s.id + '">런치 10:00~15:00</button>' +
      '<button type="button" class="stf-shift-pill' + (shift==='dinner'?' on':'') + '" data-act="shift" data-shift="dinner" data-id="' + s.id + '">디너 16:00~23:00</button>' +
      '</div>' +
      '<div class="stf-time-row">' +
      '<select class="stf-time-sel" data-act="time" data-id="' + s.id + '">' + shiftTimeOptionsHtml(shift, timeSelected) + '</select>' +
      '</div>' +
      '<div class="stf-actions">' +
      '<button type="button" class="stf-btn-in" data-act="in" data-id="' + s.id + '">출근 기록</button>' +
      '<button type="button" class="stf-btn-out" data-act="out" data-id="' + s.id + '">퇴근 기록</button>' +
      '</div>' +
      '<div class="stf-today">오늘(' + shiftLabel(shift) + ') <b>출근 ' + (rec.inTime||'-') + ' · 퇴근 ' + (rec.outTime||'-') + '</b></div>';
  }
  html += '</div>';
  return html;
}
function renderStaffList(mode) {
  var arr = mode === 'resigned' ? (S.staffResigned||[]) : (S.staffActive||[]);
  if (!arr.length) {
    return '<div class="stf-empty">' +
      (mode === 'resigned' ? '퇴사한 알바생이 없습니다.' : '등록된 알바생이 없습니다. 상단의 + 알바생 버튼으로 추가하세요.') +
      '</div>';
  }
  return arr.map(function(s) { return staffCardHtml(s, mode); }).join('');
}
function renderStaffLogs() {
  var logs = (S.staffLogs||[]).slice(0, 100);
  if (!logs.length) return '<div class="stf-empty">출퇴근 기록이 없습니다.</div>';
  return logs.map(function(l) {
    var timeOfDay = new Date(l.ts).toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'});
    return '<div class="stf-log-row"><span>' + esc(l.text) + '</span>' +
      '<span class="stf-log-time">' + esc(l.date) + ' ' + timeOfDay + '</span></div>';
  }).join('');
}
function renderStaffTab() {
  if (!staffUnlocked) return;
  if (!S.staffActive)   S.staffActive   = [];
  if (!S.staffResigned) S.staffResigned = [];
  if (!S.staffLogs)     S.staffLogs     = [];
  document.querySelectorAll('.staff-subtab').forEach(function(btn) {
    btn.classList.toggle('on', btn.getAttribute('data-sub') === staffSubTab);
  });
  var body = document.getElementById('staff-body');
  if (!body) return;
  if (staffSubTab === 'logs') {
    body.innerHTML = renderStaffLogs();
    return;
  }
  body.innerHTML = renderStaffList(staffSubTab);
  bindStaffCardEvents();
}
function bindStaffCardEvents() {
  var body = document.getElementById('staff-body');
  body.querySelectorAll('[data-act="shift"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = btn.getAttribute('data-id');
      staffShiftSel[id] = btn.getAttribute('data-shift');
      delete staffTimeSel[id];
      renderStaffTab();
    });
  });
  body.querySelectorAll('[data-act="time"]').forEach(function(sel) {
    sel.addEventListener('change', function() {
      staffTimeSel[sel.getAttribute('data-id')] = +sel.value;
    });
  });
  body.querySelectorAll('[data-act="in"],[data-act="out"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = btn.getAttribute('data-id');
      var s = (S.staffActive||[]).filter(function(x) { return x.id === id; })[0];
      if (!s) return;
      var shift = staffShiftSel[id] || 'lunch';
      var minutes = staffTimeSel[id] != null ? staffTimeSel[id] : nearestQuarterInRange(shift);
      recordAttendance(s, shift, btn.getAttribute('data-act'), minutes);
    });
  });
  body.querySelectorAll('[data-act="menu"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      openStaffMenu(btn.getAttribute('data-id'), staffSubTab);
    });
  });
}

// ── 바인딩 ──
document.getElementById('staff-pw-enter').addEventListener('click', tryStaffUnlock);
document.getElementById('staff-pw-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') tryStaffUnlock();
});
document.getElementById('staff-btn-add').addEventListener('click', function() { openStaffForm(null); });
document.getElementById('staff-subtabs').addEventListener('click', function(e) {
  var btn = e.target.closest ? e.target.closest('.staff-subtab') : null;
  if (!btn) return;
  staffSubTab = btn.getAttribute('data-sub');
  renderStaffTab();
});
