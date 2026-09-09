// ── 스케줄 탭 (직원·알바 월간 런치/디너 스케줄) ──
var stfSchedYear  = new Date().getFullYear();
var stfSchedMonth = new Date().getMonth(); // 0-indexed

function getScheduleEntries(date, shift) {
  return (S.staffSchedule || []).filter(function(e) { return e.date === date && e.shift === shift; });
}
// 자주 쓰는 이름(등록된 알바생 + 과거 입력했던 이름)을 자동완성 후보로 제공
function scheduleNameSuggestions() {
  var set = {};
  (S.staffActive || []).forEach(function(s) { if (s.name) set[s.name] = true; });
  (S.staffSchedule || []).forEach(function(e) { if (e.name) set[e.name] = true; });
  return Object.keys(set).sort(function(a, b) { return a.localeCompare(b, 'ko'); });
}
function addScheduleEntry(date, shift, name) {
  name = (name || '').trim();
  if (!name) return;
  if (!S.staffSchedule) S.staffSchedule = [];
  S.staffSchedule.push({ id: uid(), date: date, shift: shift, name: name });
  saveData();
}
function deleteScheduleEntry(id) {
  S.staffSchedule = (S.staffSchedule || []).filter(function(e) { return e.id !== id; });
  saveData();
}

// ── 렌더링: 월간 달력 그리드 ──
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

  var gridHTML = '<div class="sched-grid">';
  cells.forEach(function(day, idx) {
    var dow = idx % 7;
    if (!day) { gridHTML += '<div class="sched-day empty"></div>'; return; }
    var ds = stfSchedYear + '-' + pad(stfSchedMonth + 1) + '-' + pad(day);
    var isToday = ds === td;
    var lunch  = getScheduleEntries(ds, 'lunch');
    var dinner = getScheduleEntries(ds, 'dinner');
    var cls = 'sched-day' + (isToday ? ' today' : '') + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '');
    gridHTML += '<div class="' + cls + '" data-date="' + ds + '">'
      + '<div class="sched-day-num">' + day + '</div>'
      + (lunch.length  ? '<div class="sched-shift-line lunch"><span class="sched-shift-tag">런치</span>' + esc(lunch.map(function(e){return e.name;}).join(', ')) + '</div>' : '')
      + (dinner.length ? '<div class="sched-shift-line dinner"><span class="sched-shift-tag">디너</span>' + esc(dinner.map(function(e){return e.name;}).join(', ')) + '</div>' : '')
      + '</div>';
  });
  gridHTML += '</div>';
  return dowsHTML + gridHTML;
}
function renderScheduleTab() {
  if (!S.staffSchedule) S.staffSchedule = [];
  var body = document.getElementById('sched-body');
  if (!body) return;
  body.innerHTML = ''
    + '<div class="schcal-hd">'
    +   '<div class="schcal-nav-group">'
    +     '<button type="button" class="schcal-nav" id="sched-cal-p">‹</button>'
    +     '<span id="sched-cal-m" class="schcal-month">' + stfSchedYear + '년 ' + (stfSchedMonth + 1) + '월</span>'
    +     '<button type="button" class="schcal-nav" id="sched-cal-n">›</button>'
    +   '</div>'
    +   '<button type="button" class="cal-today-btn" id="sched-cal-today">오늘</button>'
    + '</div>'
    + buildScheduleCalendarHtml();
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

// ── 날짜별 런치/디너 인원 입력 모달 ──
function scheduleShiftSectionHtml(date, shift, label) {
  var entries = getScheduleEntries(date, shift);
  var listHtml = entries.length
    ? '<div class="stf-fav-row">' + entries.map(function(e) {
        return '<span class="stf-fav-chip"><span>' + esc(e.name) + '</span>'
          + '<button type="button" data-act="sched-del" data-id="' + e.id + '">✕</button></span>';
      }).join('') + '</div>'
    : '<div class="stf-fav-empty">등록된 인원이 없습니다.</div>';
  return '<div class="sched-shift-editor">'
    + '<div class="sched-shift-title">' + label + '</div>'
    + listHtml
    + '<div class="cl-add-row">'
    +   '<input class="cl-add-input sched-add-input" data-shift="' + shift + '" list="sched-name-list" placeholder="이름 입력…" maxlength="20">'
    +   '<button type="button" class="cl-add-btn sched-add-btn" data-shift="' + shift + '">추가</button>'
    + '</div>'
    + '</div>';
}
function openScheduleDayEditor(date) {
  var names = scheduleNameSuggestions();
  showModal(
    '<div class="md-hd"><span class="md-title">' + esc(fmtDateShort(date)) + ' 스케줄</span><button class="md-x" id="mxbtn">×</button></div>'
    + '<div class="mb">'
    + '<datalist id="sched-name-list">' + names.map(function(n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>'
    + scheduleShiftSectionHtml(date, 'lunch', '🍽 런치')
    + scheduleShiftSectionHtml(date, 'dinner', '🌙 디너')
    + '</div>'
  );
  var mdc = document.getElementById('mdc');
  mdc.querySelectorAll('[data-act="sched-del"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      deleteScheduleEntry(btn.getAttribute('data-id'));
      renderScheduleTab();
      openScheduleDayEditor(date);
    });
  });
  function addFromInput(shift) {
    var input = mdc.querySelector('.sched-add-input[data-shift="' + shift + '"]');
    if (!input || !input.value.trim()) return;
    addScheduleEntry(date, shift, input.value);
    renderScheduleTab();
    openScheduleDayEditor(date);
  }
  mdc.querySelectorAll('.sched-add-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { addFromInput(btn.getAttribute('data-shift')); });
  });
  mdc.querySelectorAll('.sched-add-input').forEach(function(input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); addFromInput(input.getAttribute('data-shift')); }
    });
  });
}
