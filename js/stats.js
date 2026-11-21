/* =========================================================
 * stats.js — 학습 기록
 * 이미 저장된 퀴즈 기록·자료·오답노트만으로 계산한다 (AI 호출 없음).
 * 차트 규칙: 위쪽 필터 한 줄이 아래 전부에 적용되고, 모든 값은
 * 툴팁 없이도 글자나 표로 읽을 수 있다.
 * ========================================================= */

const statsState = { year: new Date().getFullYear(), subject: 'all' };
/* 데이터 막대 색: 히트맵 램프의 3단계 (색각 검사 통과) */
const HEAT_LEVELS = ['l0', 'l1', 'l2', 'l3', 'l4'];
const tips = new Map();
let tipSeq = 0;

document.addEventListener('DOMContentLoaded', () => {
  $('subjectFilter').innerHTML = '<option value="all">전체 과목</option>' +
    Subjects.all().map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  $('yearFilter').innerHTML = recordYears().map(y => `<option value="${y}">${y}년</option>`).join('');
  $('yearFilter').addEventListener('change', e => { statsState.year = Number(e.target.value); renderStats(); });
  $('subjectFilter').addEventListener('change', e => { statsState.subject = e.target.value; renderStats(); });
  bindTooltip();
  renderStats();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderStats, 150);
  });
});

/* ---------- 데이터 모으기 ---------- */
/* 기록이 있는 해 (올해는 항상 포함), 최근 해부터 */
function recordYears() {
  const years = new Set([new Date().getFullYear()]);
  Attempts.all().forEach(a => years.add(new Date(a.createdAt).getFullYear()));
  Materials.all().forEach(m => years.add(new Date(m.createdAt).getFullYear()));
  return [...years].sort((a, b) => b - a);
}

/* 선택한 해의 1월 1일 ~ 12월 31일. 집계는 오늘까지만 */
function getRange() {
  const y = statsState.year;
  const yearStart = `${y}-01-01`;
  const yearEnd = `${y}-12-31`;
  const today = todayKey();
  return { yearStart, yearEnd, start: yearStart, end: today < yearEnd ? today : yearEnd };
}

function collect(range) {
  const all = statsState.subject === 'all';
  const ok = id => all || id === statsState.subject;
  const inRange = key => key >= range.start && key <= range.end;

  const attempts = Attempts.all()
    .filter(a => (a.subjectId ? ok(a.subjectId) : all) && inRange(dateKey(a.createdAt)))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const materials = Materials.all().filter(m => ok(m.subjectId) && inRange(dateKey(m.createdAt)));
  const resolved = Wrongs.all().filter(w => w.resolved && w.resolvedAt && ok(w.subjectId) && inRange(dateKey(w.resolvedAt)));

  const byDay = new Map();
  const bump = (key, field) => {
    const d = byDay.get(key) || { quiz: 0, mat: 0, fixed: 0 };
    d[field] += 1;
    byDay.set(key, d);
  };
  attempts.forEach(a => bump(dateKey(a.createdAt), 'quiz'));
  materials.forEach(m => bump(dateKey(m.createdAt), 'mat'));
  resolved.forEach(w => bump(dateKey(w.resolvedAt), 'fixed'));

  const openWrongs = Wrongs.all().filter(w => !w.resolved && ok(w.subjectId)).length;
  return { attempts, materials, resolved, byDay, openWrongs };
}

const dayTotal = d => (d ? d.quiz + d.mat + d.fixed : 0);
const level = n => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4);
const pctOf = a => Math.round((a.score / a.total) * 100);

/* ---------- 전체 ---------- */
function renderStats() {
  tips.clear();
  hideTip();
  const range = getRange();
  const data = collect(range);
  renderSummary(data);
  renderHeatmap(data, range);
  renderDayTable(data);
  renderSubjects(data);
  renderTypes(data);
}

function renderSummary(data) {
  const days = data.byDay.size;
  const label = statsState.year === new Date().getFullYear() ? `올해(${statsState.year}년)` : `${statsState.year}년`;
  if (!days) {
    $('statsSummary').textContent = `${label} 동안 기록이 없어요. 자료를 올리고 퀴즈를 풀면 여기에 쌓여요.`;
    return;
  }
  /* 오늘(또는 어제)까지 이어진 연속 공부 일수 */
  let streak = 0;
  let k = data.byDay.has(todayKey()) ? todayKey() : addDaysKey(todayKey(), -1);
  while (data.byDay.has(k)) { streak += 1; k = addDaysKey(k, -1); }

  const parts = [`${label} 동안 ${days}일 공부했어요.`];
  if (data.attempts.length) {
    const avg = Math.round(data.attempts.reduce((s, a) => s + pctOf(a), 0) / data.attempts.length);
    parts.push(`퀴즈 ${data.attempts.length}회를 풀었고 평균 ${avg}점이에요.`);
  }
  if (streak >= 2) parts.push(`오늘까지 ${streak}일 연속이에요.`);
  if (data.openWrongs) parts.push(`남은 오답은 ${data.openWrongs}개예요.`);
  $('statsSummary').textContent = parts.join(' ');
}

/* ---------- 툴팁 (값이 먼저, 이름은 뒤) ---------- */
function tip(title, rows) {
  const id = `t${tipSeq += 1}`;
  tips.set(id, { title, rows });
  return id;
}

function bindTooltip() {
  const show = el => {
    const t = tips.get(el.dataset.tip);
    if (!t) return;
    const box = $('chartTip');
    box.replaceChildren();
    const head = document.createElement('div');
    head.className = 'tip-title';
    head.textContent = t.title;
    box.appendChild(head);
    t.rows.forEach(([value, label, color]) => {
      const row = document.createElement('div');
      row.className = 'tip-row';
      if (color) {
        const key = document.createElement('span');
        key.className = 'tip-key';
        key.style.background = color;
        row.appendChild(key);
      }
      const v = document.createElement('strong');
      v.textContent = value;
      const l = document.createElement('span');
      l.textContent = label;
      row.append(v, l);
      box.appendChild(row);
    });
    box.hidden = false;
    const r = el.getBoundingClientRect();
    const bw = box.offsetWidth;
    let left = r.left + r.width / 2 - bw / 2 + window.scrollX;
    left = Math.max(8 + window.scrollX, Math.min(left, window.scrollX + document.documentElement.clientWidth - bw - 8));
    box.style.left = `${left}px`;
    box.style.top = `${r.top + window.scrollY - box.offsetHeight - 10}px`;
    el.classList.add('hover');
  };
  const hide = el => {
    if (el) el.classList.remove('hover');
    hideTip();
  };
  document.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); if (el) show(el); });
  document.addEventListener('pointerout', e => { const el = e.target.closest('[data-tip]'); if (el) hide(el); });
  document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) show(el); });
  document.addEventListener('focusout', e => { const el = e.target.closest('[data-tip]'); if (el) hide(el); });
}

function hideTip() {
  $('chartTip').hidden = true;
}

/* ---------- 공부한 날 (히트맵: 1월~12월) ---------- */
function renderHeatmap(data, range) {
  /* 1월 1일이 든 주의 일요일부터 12월 31일이 든 주의 토요일까지 */
  const gridStart = addDaysKey(range.yearStart, -parseDateKey(range.yearStart).getDay());
  const gridEnd = addDaysKey(range.yearEnd, 6 - parseDateKey(range.yearEnd).getDay());
  const today = todayKey();
  const cells = [];
  const months = [];
  let col = -1;
  for (let key = gridStart; key <= gridEnd; key = addDaysKey(key, 1)) {
    const d = parseDateKey(key);
    if (d.getDay() === 0) col += 1;
    /* 그 달의 1일이 들어 있는 주에 달 이름 */
    if (d.getDate() === 1 && key >= range.yearStart && key <= range.yearEnd) months.push({ col, label: `${d.getMonth() + 1}월` });

    if (key < range.yearStart || key > range.yearEnd) {
      cells.push('<span class="hm-cell out"></span>');
    } else if (key > today) {
      cells.push(`<span class="hm-cell future" role="img" aria-label="${formatDateKo(key)}"></span>`);
    } else {
      const day = data.byDay.get(key);
      const n = dayTotal(day);
      const rows = n
        ? [[`${day.quiz}회`, '퀴즈'], [`${day.mat}개`, '올린 자료'], [`${day.fixed}개`, '해결한 오답']].filter(r => r[0][0] !== '0')
        : [['기록 없음', '']];
      const id = tip(formatDateKo(key), rows);
      const aria = n ? `${formatDateKo(key)} 활동 ${n}건` : `${formatDateKo(key)} 기록 없음`;
      cells.push(`<span class="hm-cell ${HEAT_LEVELS[level(n)]} ${key === today ? 'today' : ''}" data-tip="${id}" ${n ? 'tabindex="0"' : ''} role="img" aria-label="${aria}"></span>`);
    }
  }
  const cols = col + 1;

  /* 칸 크기: 한 해(53주)가 자리 폭에 꼭 맞게, 9~18px */
  const gap = 3;
  const avail = $('heatmapWrap').clientWidth - 30;
  const cell = Math.max(9, Math.min(18, Math.floor(avail / cols) - gap));
  $('heatmap').style.setProperty('--cell', `${cell}px`);
  const weekLabels = ['', '월', '', '수', '', '금', ''];
  $('heatmap').innerHTML = `
    <div class="hm-months" style="--cols:${cols}">
      ${months.map(m => `<span style="grid-column:${m.col + 1}">${m.label}</span>`).join('')}
    </div>
    <div class="hm-body">
      <div class="hm-days">${weekLabels.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="hm-grid" style="--cols:${cols}">${cells.join('')}</div>
    </div>`;

  /* 화면이 좁아 가로로 스크롤되면 오늘이 보이게 */
  const wrap = $('heatmapWrap');
  const todayCell = $('heatmap').querySelector('.hm-cell.today');
  if (todayCell && wrap.scrollWidth > wrap.clientWidth) {
    wrap.scrollLeft = Math.max(0, todayCell.offsetLeft - wrap.clientWidth + 60);
  }
}

function renderDayTable(data) {
  const days = [...data.byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  $('dayTable').innerHTML = days.length
    ? days.map(([key, d]) => `
        <tr><td>${formatDateKo(key)}</td><td class="num">${d.quiz}</td><td class="num">${d.mat}</td><td class="num">${d.fixed}</td></tr>`).join('')
    : '<tr><td colspan="4" class="text-muted">이 기간에 기록이 없어요.</td></tr>';
}

/* ---------- 과목별 퀴즈 점수 (표) ---------- */
function renderSubjects(data) {
  const subjects = statsState.subject === 'all' ? Subjects.all() : Subjects.all().filter(s => s.id === statsState.subject);
  if (!subjects.length) {
    $('subjectRows').innerHTML = '<p class="empty-note">과목이 없어요.</p>';
    return;
  }
  const rows = subjects.map(s => {
    const list = data.attempts.filter(a => a.subjectId === s.id);
    const avg = list.length ? Math.round(list.reduce((sum, a) => sum + pctOf(a), 0) / list.length) : null;
    const best = list.length ? Math.max(...list.map(pctOf)) : null;
    const last = list.length ? pctOf(list[list.length - 1]) : null;
    return `
      <div class="sm-row">
        <span class="sm-name"><span class="sm-key" style="background:${s.color}"></span>${esc(s.name)}</span>
        <span class="num">${list.length}회</span>
        <span class="num">${avg === null ? '-' : `${avg}점`}</span>
        <span class="num">${best === null ? '-' : `${best}점`}</span>
        <span class="num">${last === null ? '-' : `${last}점`}</span>
      </div>`;
  }).join('');

  $('subjectRows').innerHTML = `
    <div class="sm-row sm-headrow">
      <span>과목</span><span class="num">퀴즈</span><span class="num">평균</span><span class="num">최고</span><span class="num">최근</span>
    </div>${rows}`;
}

/* ---------- 가로 막대 공통 ---------- */
function hbar({ label, ratio, value, sub, tipId }) {
  const inner = `
    <span class="hbar-label">${esc(label)}</span>
    <span class="hbar-track"><span class="hbar" style="width:${Math.max(ratio * 100, ratio > 0 ? 2 : 0)}%"></span></span>
    <span class="hbar-value"><strong>${value}</strong>${sub ? ` <small>${sub}</small>` : ''}</span>`;
  return `<div class="hbar-row" data-tip="${tipId}" tabindex="0">${inner}</div>`;
}

/* ---------- 유형별 정답률 ---------- */
function renderTypes(data) {
  const stat = { mc: [0, 0], tf: [0, 0], short: [0, 0] };
  data.attempts.forEach(a => a.questions.forEach((q, i) => {
    if (!stat[q.type]) return;
    stat[q.type][1] += 1;
    if (a.results[i] && a.results[i].correct) stat[q.type][0] += 1;
  }));
  const rows = Object.keys(stat).filter(t => stat[t][1]);
  if (!rows.length) {
    $('typeBars').innerHTML = '<p class="empty-note">이 기간에 푼 문제가 없어요.</p>';
    return;
  }
  $('typeBars').innerHTML = rows.map(t => {
    const [ok, total] = stat[t];
    const pct = Math.round((ok / total) * 100);
    return hbar({
      label: QUESTION_TYPES[t],
      ratio: ok / total,
      value: `${pct}%`,
      sub: `${total}문제 중 ${ok}`,
      tipId: tip(QUESTION_TYPES[t], [[`${pct}%`, '정답률'], [`${ok}/${total}`, '맞힌 문제']])
    });
  }).join('');
}
