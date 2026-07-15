// ── 알바 출퇴근 기록 (Part-timer Attendance) ──
var DEFAULT_STAFF_PW = '0000';
var staffUnlocked = false;
var staffSubTab   = 'logs';   // 'logs' | 'active' | 'resigned'
var recEditId      = null;    // 출퇴근 기록 폼에서 수정 중인 기록 id (null = 신규 입력)
var recActiveField = 'rec-in'; // 즐겨찾기 시간 탭 시 채워질 입력칸 ('rec-in' | 'rec-out')

function getStaffPw() { return (S && S.staffPw) || DEFAULT_STAFF_PW; }

// ── 잠금 화면 ──
function checkStaffLock() {
  var lockEl = document.getElementById('staff-lock');
  var contentEl = document.getElementById('staff-content');
  if (!lockEl || !contentEl) return;
  if (staffUnlocked) {
    lockEl.style.display = 'none';
    contentEl.classList.add('on');
    migrateStaffLogsToRecords();
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

// ── 구버전 출퇴근 로그(개별 출근/퇴근 이벤트) → 날짜별 통합 기록 1회 마이그레이션 ──
function migrateStaffLogsToRecords() {
  if (S._staffLogsMigrated) return;
  S._staffLogsMigrated = true;
  if (!S.staffRecords) S.staffRecords = [];
  var logs = S.staffLogs || [];
  if (logs.length) {
    var groups = {};
    logs.forEach(function(l) {
      var key = l.staffId + '|' + l.date;
      if (!groups[key]) groups[key] = {staffId: l.staffId, staffName: l.staffName, date: l.date, ins: [], outs: []};
      if (l.type === 'in') groups[key].ins.push(l.time);
      else groups[key].outs.push(l.time);
    });
    Object.keys(groups).forEach(function(key) {
      var g = groups[key];
      g.ins.sort(); g.outs.sort();
      S.staffRecords.push({
        id: uid(), staffId: g.staffId, staffName: g.staffName, date: g.date,
        inTime: g.ins.length ? g.ins[0] : '', outTime: g.outs.length ? g.outs[g.outs.length - 1] : ''
      });
    });
  }
  saveData();
}

// ── 근무 시간 계산 (예: 10:00 출근, 14:00 퇴근 → "4시간") ──
function calcWorkedHours(inTime, outTime) {
  if (!inTime || !outTime) return null;
  var ip = inTime.split(':'), op = outTime.split(':');
  var inMin = (+ip[0]) * 60 + (+ip[1]);
  var outMin = (+op[0]) * 60 + (+op[1]);
  var diff = outMin - inMin;
  if (diff <= 0) return null;
  var h = Math.floor(diff / 60), m = diff % 60;
  return h + '시간' + (m ? ' ' + m + '분' : '');
}

// ── 출퇴근 기록 저장/삭제 (알바생+날짜 당 하나의 통합 기록) ──
function upsertStaffRecord(editId, staffId, staffName, date, inTime, outTime) {
  if (!S.staffRecords) S.staffRecords = [];
  var rec = editId ? S.staffRecords.filter(function(r) { return r.id === editId; })[0] : null;
  if (!rec) rec = S.staffRecords.filter(function(r) { return r.staffId === staffId && r.date === date; })[0];
  if (rec) {
    rec.staffId = staffId; rec.staffName = staffName; rec.date = date;
    rec.inTime = inTime; rec.outTime = outTime;
  } else {
    rec = {id: uid(), staffId: staffId, staffName: staffName, date: date, inTime: inTime, outTime: outTime};
    S.staffRecords.push(rec);
  }
  saveData();
  return rec;
}
function deleteStaffRecord(id) {
  if (!confirm('이 출퇴근 기록을 삭제하시겠습니까?')) return;
  S.staffRecords = (S.staffRecords || []).filter(function(r) { return r.id !== id; });
  if (recEditId === id) recEditId = null;
  saveData();
  renderStaffTab();
  showToast('기록이 삭제되었습니다');
}
function startEditRecord(id) {
  recEditId = id;
  renderStaffTab();
}

// ── 즐겨찾기 시간대 ──
// 즐겨찾기 추가/삭제는 입력 중인 폼(알바생·날짜·시간)을 건드리지 않도록
// 전체 탭을 다시 그리지 않고 즐겨찾기 칩 영역만 갱신한다.
function addFavTime(t) {
  if (!t) return;
  if (!S.staffFavTimes) S.staffFavTimes = [];
  if (S.staffFavTimes.indexOf(t) >= 0) { showToast('이미 즐겨찾기에 있습니다'); return; }
  S.staffFavTimes.push(t);
  S.staffFavTimes.sort();
  saveData();
  refreshFavRow();
  showToast('⭐ 즐겨찾기에 추가했습니다 (' + t + ')');
}
function removeFavTime(t) {
  S.staffFavTimes = (S.staffFavTimes || []).filter(function(x) { return x !== t; });
  saveData();
  refreshFavRow();
}
function refreshFavRow() {
  var row = document.querySelector('.stf-fav-row');
  if (!row) return;
  row.innerHTML = renderFavChipsHtml();
  bindFavChipEvents(row);
}
function bindFavChipEvents(scope) {
  scope.querySelectorAll('[data-act="fav-pick"]').forEach(function(el) {
    el.addEventListener('click', function() {
      var target = document.getElementById(recActiveField) || document.getElementById('rec-in');
      if (target) target.value = this.getAttribute('data-t');
    });
  });
  scope.querySelectorAll('[data-act="fav-del"]').forEach(function(btn) {
    btn.addEventListener('click', function() { removeFavTime(btn.getAttribute('data-t')); });
  });
}

// ── 렌더링: 알바생 목록 (현재/퇴사) ──
function staffCardHtml(s, mode) {
  var isResigned = mode === 'resigned';
  var subParts = [];
  if (s.position) subParts.push(s.position);
  if (s.phone) subParts.push(s.phone);
  subParts.push(isResigned ? '퇴사일 ' + (s.resignDate || '-') : '입사일 ' + (s.joinDate || '-'));
  return '<div class="stf-card" data-id="' + s.id + '">' +
    '<div class="stf-hd"><div>' +
    '<div class="stf-name">' + esc(s.name) + '</div>' +
    '<div class="stf-sub">' + esc(subParts.join(' · ')) + '</div>' +
    (s.memo ? '<div class="stf-sub">📝 ' + esc(s.memo) + '</div>' : '') +
    '</div>' +
    '<button type="button" class="stf-menu-btn" data-act="menu" data-id="' + s.id + '">⋯</button>' +
    '</div>' +
    '</div>';
}
function renderStaffList(mode) {
  var arr = mode === 'resigned' ? (S.staffResigned || []) : (S.staffActive || []);
  if (!arr.length) {
    return '<div class="stf-empty">' +
      (mode === 'resigned' ? '퇴사한 알바생이 없습니다.' : '등록된 알바생이 없습니다. 상단의 + 알바생 버튼으로 추가하세요.') +
      '</div>';
  }
  return arr.map(function(s) { return staffCardHtml(s, mode); }).join('');
}
function bindStaffCardEvents() {
  var body = document.getElementById('staff-body');
  body.querySelectorAll('[data-act="menu"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      openStaffMenu(btn.getAttribute('data-id'), staffSubTab);
    });
  });
}

// ── 렌더링: 출퇴근 기록 탭 (기록 입력 + 목록) ──
function renderFavChipsHtml() {
  var favs = (S.staffFavTimes || []).slice().sort();
  if (!favs.length) return '<div class="stf-fav-empty">즐겨찾는 시간이 없습니다. 시간을 선택한 뒤 "현재 값 즐겨찾기"로 추가하세요.</div>';
  return favs.map(function(t) {
    return '<span class="stf-fav-chip"><span data-act="fav-pick" data-t="' + t + '">' + esc(t) + '</span>' +
      '<button type="button" data-act="fav-del" data-t="' + t + '">✕</button></span>';
  }).join('');
}
function renderRecListHtml() {
  var recs = (S.staffRecords || []).slice().sort(function(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (a.staffName || '').localeCompare(b.staffName || '', 'ko');
  });
  if (!recs.length) return '<div class="stf-empty">출퇴근 기록이 없습니다.</div>';
  var html = '', lastDate = '';
  recs.forEach(function(r) {
    if (r.date !== lastDate) {
      html += '<div class="stf-rec-date-hd">' + esc(fmtDateShort(r.date)) + '</div>';
      lastDate = r.date;
    }
    var hrs = calcWorkedHours(r.inTime, r.outTime);
    html += '<div class="stf-rec-row' + (recEditId === r.id ? ' editing' : '') + '" data-id="' + r.id + '">' +
      '<div class="stf-rec-main">' +
      '<span class="stf-rec-name">' + esc(r.staffName || '-') + '</span>' +
      '<span class="stf-rec-time">출근 ' + esc(r.inTime || '-') + ' · 퇴근 ' + esc(r.outTime || '-') + '</span>' +
      (hrs ? '<span class="stf-rec-hours">' + hrs + ' 근무</span>' : '') +
      '</div>' +
      '<div class="stf-rec-actions">' +
      '<button type="button" data-act="rec-edit" data-id="' + r.id + '">✏</button>' +
      '<button type="button" data-act="rec-del" data-id="' + r.id + '">✕</button>' +
      '</div>' +
      '</div>';
  });
  return html;
}
function renderAttendanceTab() {
  var editRec = recEditId ? (S.staffRecords || []).filter(function(r) { return r.id === recEditId; })[0] : null;
  if (!editRec) recEditId = null;

  var activeIds = {};
  (S.staffActive || []).forEach(function(s) { activeIds[s.id] = true; });
  var staffList = (S.staffActive || []).slice();
  if (editRec && !activeIds[editRec.staffId]) {
    staffList.push({id: editRec.staffId, name: (editRec.staffName || '알 수 없음') + ' (퇴사/삭제됨)'});
  }
  var staffOpts = staffList.map(function(s) {
    return '<option value="' + esc(s.id) + '"' + (editRec && editRec.staffId === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
  }).join('');
  if (!staffOpts) staffOpts = '<option value="">등록된 알바생 없음</option>';

  var dateVal = editRec ? editRec.date : today();
  var inVal   = editRec ? (editRec.inTime || '')  : '';
  var outVal  = editRec ? (editRec.outTime || '') : '';

  return ''
    + '<div class="stf-rec-form">'
    + (editRec ? '<div class="stf-rec-editnote">✏ 기록 수정 중 <button type="button" id="rec-edit-cancel">취소</button></div>' : '')
    + '<div class="fg"><label class="fl">알바생</label><select class="fi" id="rec-staff">' + staffOpts + '</select></div>'
    + '<div class="fg"><label class="fl">날짜</label><input class="fi" type="date" id="rec-date" value="' + esc(dateVal) + '"></div>'
    + '<div class="g2">'
    +   '<div class="fg"><label class="fl">출근 시간</label><input class="fi' + (recActiveField === 'rec-in' ? ' rec-active' : '') + '" type="time" id="rec-in" value="' + esc(inVal) + '"></div>'
    +   '<div class="fg"><label class="fl">퇴근 시간</label><input class="fi' + (recActiveField === 'rec-out' ? ' rec-active' : '') + '" type="time" id="rec-out" value="' + esc(outVal) + '"></div>'
    + '</div>'
    + '<div class="stf-fav-lbl">⭐ 즐겨찾는 시간 <span>(탭하면 선택된 입력칸에 채워집니다)</span></div>'
    + '<div class="stf-fav-row">' + renderFavChipsHtml() + '</div>'
    + '<div class="stf-rec-btns">'
    +   '<button type="button" class="bg" id="rec-fav-add">☆ 현재 값 즐겨찾기</button>'
    +   '<button type="button" class="bp" id="rec-save">' + (editRec ? '수정 저장' : '저장') + '</button>'
    + '</div>'
    + '</div>'
    + '<div class="stf-rec-list-hd">출퇴근 기록</div>'
    + '<div id="rec-list">' + renderRecListHtml() + '</div>';
}
function bindAttendanceEvents() {
  var body = document.getElementById('staff-body');
  var inEl = document.getElementById('rec-in');
  var outEl = document.getElementById('rec-out');
  if (inEl) inEl.addEventListener('focus', function() {
    recActiveField = 'rec-in';
    inEl.classList.add('rec-active');
    if (outEl) outEl.classList.remove('rec-active');
  });
  if (outEl) outEl.addEventListener('focus', function() {
    recActiveField = 'rec-out';
    outEl.classList.add('rec-active');
    if (inEl) inEl.classList.remove('rec-active');
  });

  var favAddBtn = document.getElementById('rec-fav-add');
  if (favAddBtn) favAddBtn.addEventListener('click', function() {
    var el = document.getElementById(recActiveField);
    var v = el ? el.value : '';
    if (!v) { showToast('즐겨찾기로 저장할 시간을 먼저 선택하세요'); return; }
    addFavTime(v);
  });

  var saveBtn = document.getElementById('rec-save');
  if (saveBtn) saveBtn.addEventListener('click', function() {
    var staffSel = document.getElementById('rec-staff');
    var staffId = staffSel ? staffSel.value : '';
    if (!staffId) { showToast('알바생을 선택하세요'); return; }
    var date = (document.getElementById('rec-date') || {}).value || today();
    var inTime = (document.getElementById('rec-in') || {}).value || '';
    var outTime = (document.getElementById('rec-out') || {}).value || '';
    if (!inTime && !outTime) { showToast('출근 또는 퇴근 시간을 입력하세요'); return; }
    var staff = (S.staffActive || []).filter(function(x) { return x.id === staffId; })[0];
    var staffName = staff ? staff.name : (staffSel.options[staffSel.selectedIndex].textContent || '').replace(/\s*\(퇴사\/삭제됨\)\s*$/, '');
    upsertStaffRecord(recEditId, staffId, staffName, date, inTime, outTime);
    recEditId = null;
    showToast('출퇴근 기록이 저장되었습니다');
    renderStaffTab();
  });

  var cancelBtn = document.getElementById('rec-edit-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', function() { recEditId = null; renderStaffTab(); });

  bindFavChipEvents(body);
  body.querySelectorAll('[data-act="rec-edit"]').forEach(function(btn) {
    btn.addEventListener('click', function() { startEditRecord(btn.getAttribute('data-id')); });
  });
  body.querySelectorAll('[data-act="rec-del"]').forEach(function(btn) {
    btn.addEventListener('click', function() { deleteStaffRecord(btn.getAttribute('data-id')); });
  });
}

// ── 탭 렌더 ──
function renderStaffTab() {
  if (!staffUnlocked) return;
  if (!S.staffActive)   S.staffActive   = [];
  if (!S.staffResigned) S.staffResigned = [];
  if (!S.staffRecords)  S.staffRecords  = [];
  if (!S.staffFavTimes) S.staffFavTimes = [];
  document.querySelectorAll('.staff-subtab').forEach(function(btn) {
    btn.classList.toggle('on', btn.getAttribute('data-sub') === staffSubTab);
  });
  var addBtn = document.getElementById('staff-btn-add');
  if (addBtn) addBtn.style.display = (staffSubTab === 'logs') ? 'none' : '';
  var body = document.getElementById('staff-body');
  if (!body) return;
  if (staffSubTab === 'logs') {
    body.innerHTML = renderAttendanceTab();
    bindAttendanceEvents();
    return;
  }
  body.innerHTML = renderStaffList(staffSubTab);
  bindStaffCardEvents();
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
  recEditId = null;
  renderStaffTab();
});
