// ── 스케줄 탭 (직원·알바 월간 런치/디너 스케줄) ──
var stfSchedYear  = new Date().getFullYear();
var stfSchedMonth = new Date().getMonth(); // 0-indexed

function getScheduleEntries(date, shift) {
  return (S.staffSchedule || []).filter(function(e) { return e.date === date && e.shift === shift; });
}
// 근무자 유형(직원 → 알바생) 순, 그 안에서는 이름순으로 정렬
function staffTypeById(staffId) {
  var s = (S.staffActive || []).concat(S.staffResigned || []).filter(function(x) { return x.id === staffId; })[0];
  return s ? s.type : 'parttime';
}
function sortStaffByTypeThenName(list, typeOf) {
  return list.slice().sort(function(a, b) {
    var ta = typeOf(a) === 'employee' ? 0 : 1;
    var tb = typeOf(b) === 'employee' ? 0 : 1;
    if (ta !== tb) return ta - tb;
    return (a.name || '').localeCompare(b.name || '', 'ko');
  });
}
// 근무자를 직접 입력하지 않고, "출퇴근 기록" 탭에 등록된 직원/알바생 중에서 탭하여 켜고 끈다.
function toggleScheduleEntry(date, shift, staffId, staffName) {
  if (!S.staffSchedule) S.staffSchedule = [];
  var existing = S.staffSchedule.filter(function(e) {
    return e.date === date && e.shift === shift && e.staffId === staffId;
  })[0];
  if (existing) {
    S.staffSchedule = S.staffSchedule.filter(function(e) { return e.id !== existing.id; });
  } else {
    S.staffSchedule.push({ id: uid(), date: date, shift: shift, staffId: staffId, name: staffName });
  }
  saveData();
}

// ── 렌더링: 월간 달력 그리드 (화면 높이에 맞춰 비율로 채우기 — 창 스크롤 방지) ──
function buildScheduleCalendarHtml() {
  var dows = ['일', '월', '화', '수', '목', '금', '토'];
  var dowsHTML = '<div class="schcal-dows">' + dows.map(function(d, i) {
    return '<div class="schcal-dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') + '">' + d + '</div>';
  }).join('') + '</div>';

  var td = today();
  var firstDay = new Date(stfSchedYear, stfSchedMonth, 1).getDay();
  var daysInMonth = new Date(stfSchedYear, stfSchedMonth + 1, 0).getDate();
  var cells = [];
  for (var i = 0; i < firstDay; i++) cells.push(null);
  for (var d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function dayCellHtml(day, dow) {
    if (!day) return '<div class="sched-day empty"></div>';
    var ds = stfSchedYear + '-' + pad(stfSchedMonth + 1) + '-' + pad(day);
    var isToday = ds === td;
    var lunch  = sortStaffByTypeThenName(getScheduleEntries(ds, 'lunch'),  function(e) { return staffTypeById(e.staffId); });
    var dinner = sortStaffByTypeThenName(getScheduleEntries(ds, 'dinner'), function(e) { return staffTypeById(e.staffId); });
    var cls = 'sched-day' + (isToday ? ' today' : '') + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '');
    return '<div class="' + cls + '" data-date="' + ds + '">'
      + '<div class="sched-day-num">' + day + '</div>'
      + (lunch.length  ? '<div class="sched-shift-line lunch"><span class="sched-shift-tag">런치</span>' + esc(lunch.map(function(e){return e.name;}).join(', ')) + '</div>' : '')
      + (dinner.length ? '<div class="sched-shift-line dinner"><span class="sched-shift-tag">디너</span>' + esc(dinner.map(function(e){return e.name;}).join(', ')) + '</div>' : '')
      + '</div>';
  }

  var gridHTML = '<div class="sched-grid">';
  for (var w = 0; w < cells.length; w += 7) {
    gridHTML += '<div class="sched-week-row">';
    for (var c = 0; c < 7; c++) gridHTML += dayCellHtml(cells[w + c], c);
    gridHTML += '</div>';
  }
  gridHTML += '</div>';
  return dowsHTML + gridHTML;
}
function renderScheduleTab() {
  if (!S.staffSchedule) S.staffSchedule = [];
  var body = document.getElementById('sched-body');
  if (!body) return;
  body.innerHTML = '<div class="sched-wrap">'
    + '<div class="schcal-hd">'
    +   '<div class="schcal-nav-group">'
    +     '<button type="button" class="schcal-nav" id="sched-cal-p">‹</button>'
    +     '<span id="sched-cal-m" class="schcal-month">' + stfSchedYear + '년 ' + (stfSchedMonth + 1) + '월</span>'
    +     '<button type="button" class="schcal-nav" id="sched-cal-n">›</button>'
    +   '</div>'
    +   '<button type="button" class="cal-today-btn" id="sched-cal-today">오늘</button>'
    + '</div>'
    + buildScheduleCalendarHtml()
    + '</div>';
  bindScheduleEvents();
}
function bindScheduleEvents() {
  var body = document.getElementById('sched-body');
  if (!body) return;
  var p = document.getElementById('sched-cal-p');
  if (p) p.addEventListener('click', function() {
    stfSchedMonth--; if (stfSchedMonth < 0) { stfSchedMonth = 11; stfSchedYear--; }
    renderScheduleTab();
  });
  var n = document.getElementById('sched-cal-n');
  if (n) n.addEventListener('click', function() {
    stfSchedMonth++; if (stfSchedMonth > 11) { stfSchedMonth = 0; stfSchedYear++; }
    renderScheduleTab();
  });
  var t = document.getElementById('sched-cal-today');
  if (t) t.addEventListener('click', function() {
    var now = new Date();
    stfSchedYear = now.getFullYear(); stfSchedMonth = now.getMonth();
    renderScheduleTab();
  });
  body.querySelectorAll('.sched-day[data-date]').forEach(function(el) {
    el.addEventListener('click', function() { openScheduleDayEditor(this.getAttribute('data-date')); });
  });
}

// ── 날짜별 런치/디너 근무자 선택 모달 (등록된 직원/알바생 중에서 탭하여 선택) ──
function scheduleShiftSectionHtml(date, shift, label) {
  var activeIds = {};
  getScheduleEntries(date, shift).forEach(function(e) { activeIds[e.staffId] = true; });
  var sortedStaff = sortStaffByTypeThenName(S.staffActive || [], function(s) { return s.type; });
  var pillsHtml = '<div class="tag-picker">' + sortedStaff.map(function(s) {
    var on = !!activeIds[s.id];
    return '<button type="button" class="tag-pill' + (on ? ' on' : '') + '" data-shift="' + shift + '" data-staff-id="' + esc(s.id) + '" data-staff-name="' + esc(s.name) + '">' + esc(s.name) + '</button>';
  }).join('') + '</div>';
  return '<div class="sched-shift-editor">'
    + '<div class="sched-shift-title">' + label + '</div>'
    + pillsHtml
    + '</div>';
}
function openScheduleDayEditor(date) {
  var hasStaff = (S.staffActive || []).length > 0;
  var bodyHtml = hasStaff
    ? scheduleShiftSectionHtml(date, 'lunch', '🍽 런치') + scheduleShiftSectionHtml(date, 'dinner', '🌙 디너')
    : '<div class="stf-empty">등록된 직원/알바생이 없습니다.<br>"출퇴근 기록" 탭에서 먼저 추가해주세요.</div>';
  showModal(
    '<div class="md-hd"><span class="md-title">' + esc(fmtDateShort(date)) + ' 스케줄</span><button class="md-x" id="mxbtn">×</button></div>'
    + '<div class="mb">' + bodyHtml + '</div>'
  );
  if (!hasStaff) return;
  var mdc = document.getElementById('mdc');
  mdc.querySelectorAll('.tag-pill').forEach(function(btn) {
    btn.addEventListener('click', function() {
      toggleScheduleEntry(date, btn.getAttribute('data-shift'), btn.getAttribute('data-staff-id'), btn.getAttribute('data-staff-name'));
      renderScheduleTab();
      openScheduleDayEditor(date);
    });
  });
}
