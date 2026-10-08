/* =========================================================
 * schedule.js — 시험 일정
 * 시험을 수험표처럼 보여주고, 남은 날짜에 맞춰 복습 계획을 짜고,
 * 달력에 시험 날짜를 표시한다.
 * ========================================================= */

const now = new Date();
const calState = { year: now.getFullYear(), month: now.getMonth() };
const PLAN_MAX_DAYS = 14;
let examModal;
let planExamId = null;

document.addEventListener('DOMContentLoaded', () => {
  examModal = new bootstrap.Modal($('examModal'));
  /* 메뉴에서 특정 시험을 눌러 들어오면(?exam=ID) 그 시험의 복습 계획을 보여준다 */
  const fromMenu = Exams.get(param('exam'));
  const first = fromMenu || Exams.upcoming()[0];
  if (first) {
    planExamId = first.id;
    const d = parseDateKey(first.date);
    calState.year = d.getFullYear();
    calState.month = d.getMonth();
  }

  $('addExamBtn').addEventListener('click', () => openExamModal());
  $('examForm').addEventListener('submit', onExamSubmit);
  $('examSubject').addEventListener('change', () => renderScope(null));
  document.querySelector('.name-chips').addEventListener('click', e => {
    const chip = e.target.closest('[data-name]');
    if (chip) $('examName').value = chip.dataset.name;
  });
  $('ticketList').addEventListener('click', onTicketClick);
  $('pastList').addEventListener('click', onTicketClick);
  $('planExamSelect').addEventListener('change', e => { planExamId = e.target.value; renderPlan(); renderCalendar(); });
  $('planBody').addEventListener('change', onPlanCheck);
  $('calPrev').addEventListener('click', () => shiftMonth(-1));
  $('calNext').addEventListener('click', () => shiftMonth(1));
  $('calendar').addEventListener('click', e => {
    const chip = e.target.closest('[data-exam]');
    if (!chip) return;
    planExamId = chip.dataset.exam;
    renderPlan();
    renderCalendar();
    $('planTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  renderAll();
  if (fromMenu) {
    requestAnimationFrame(() => $('planTitle').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
});

function renderAll() {
  const upcoming = Exams.upcoming();
  if (!upcoming.some(x => x.id === planExamId)) planExamId = upcoming[0] ? upcoming[0].id : null;
  renderTickets(upcoming);
  renderPlanSelect(upcoming);
  renderPlan();
  renderCalendar();
  renderPast();
}

function subjectOf(exam) {
  return Subjects.get(exam.subjectId) || { name: '삭제된 과목', color: '#737985' };
}

/* ---------- 수험표 ---------- */
function renderTickets(upcoming) {
  if (!upcoming.length) {
    const hasSubject = Subjects.all().length > 0;
    $('ticketList').innerHTML = `
      <div class="col-12">
        <div class="ticket-empty">
          <strong>다가오는 시험이 없어요</strong>
          <span>${hasSubject ? '시험 날짜를 넣으면 D-day와 복습 계획이 생겨요.' : '먼저 내 과목에서 과목을 만들어 주세요.'}</span>
          ${hasSubject
            ? '<button type="button" class="btn btn-primary btn-sm mt-2" data-act="new">시험 추가</button>'
            : '<a href="index.html" class="btn btn-primary btn-sm mt-2">내 과목으로</a>'}
        </div>
      </div>`;
    return;
  }
  $('ticketList').innerHTML = upcoming.map(ticketCard).join('');
}

function scopeMaterials(exam) {
  const all = Materials.bySubject(exam.subjectId);
  const chosen = (exam.materialIds || []).filter(id => all.some(m => m.id === id));
  return chosen.length ? all.filter(m => chosen.includes(m.id)) : all;
}

function ticketCard(exam) {
  const subject = subjectOf(exam);
  const days = daysUntil(exam.date);
  const scope = scopeMaterials(exam);
  return `
    <div class="col-md-6 col-xl-4">
      <article class="ticket ${exam.id === planExamId ? 'selected' : ''}" style="--c:${subject.color}" data-id="${exam.id}">
        <header class="ticket-top">
          <span class="ticket-kind">수험표</span>
          <span class="ticket-subject">${esc(subject.name)}</span>
        </header>
        <dl class="ticket-fields">
          <div><dt>시험</dt><dd>${esc(exam.name)}</dd></div>
          <div><dt>일시</dt><dd>${formatDateKo(exam.date)}${exam.time ? ` ${esc(exam.time)}` : ''}</dd></div>
          ${exam.place ? `<div><dt>장소</dt><dd>${esc(exam.place)}</dd></div>` : ''}
          <div><dt>범위</dt><dd>${scope.length ? `자료 ${scope.length}개` : '아직 자료 없음'}</dd></div>
        </dl>
        <div class="ticket-stamp ${days <= 3 ? 'soon' : ''}" aria-label="시험까지 ${days}일">${ddayLabel(exam.date)}</div>
        <footer class="ticket-actions">
          <button type="button" class="btn btn-sm btn-light" data-act="plan">복습 계획</button>
          <button type="button" class="btn btn-sm btn-light" data-act="edit">수정</button>
          <button type="button" class="btn btn-icon ms-auto" data-act="delete" aria-label="${esc(exam.name)} 삭제"><i class="bi bi-trash3"></i></button>
        </footer>
      </article>
    </div>`;
}

function onTicketClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'new') return openExamModal();
  const id = btn.closest('[data-id]').dataset.id;
  const exam = Exams.get(id);
  if (!exam) return;
  if (btn.dataset.act === 'plan') {
    planExamId = id;
    renderAll();
    $('planTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (btn.dataset.act === 'edit') {
    openExamModal(exam);
  } else if (btn.dataset.act === 'delete') {
    if (!confirm(`'${subjectOf(exam).name} ${exam.name}' 일정을 삭제할까요?`)) return;
    Exams.remove(id);
    toast('시험 일정을 삭제했어요.', 'info');
    renderAll();
  }
}

/* ---------- 복습 계획 ---------- */
function renderPlanSelect(upcoming) {
  $('planExamSelect').innerHTML = upcoming.map(x =>
    `<option value="${x.id}" ${x.id === planExamId ? 'selected' : ''}>${esc(subjectOf(x).name)} ${esc(x.name)} (${ddayLabel(x.date)})</option>`).join('');
  $('planExamSelect').classList.toggle('d-none', upcoming.length < 2);
}

/*
 * 남은 날(최대 14일)에 "요약 노트 읽기 → 퀴즈 풀기"를 자료마다 고르게 나누고,
 * 시험 전날에는 전체 범위 퀴즈를 둔다. 할 일의 키는 날짜와 무관해서
 * 날짜가 바뀌어 계획이 다시 짜여도 완료 표시가 유지된다.
 */
function buildPlan(exam) {
  const materials = scopeMaterials(exam);
  const today = todayKey();
  const end = addDaysKey(exam.date, -1);
  let start = addDaysKey(exam.date, -PLAN_MAX_DAYS);
  if (start < today) start = today;

  const days = [];
  for (let k = start; k <= end; k = addDaysKey(k, 1)) days.push(k);
  if (!days.length) days.push(today);           // 시험 당일

  const tasks = materials.flatMap(m => [
    { key: `read:${m.id}`, type: 'read', material: m },
    { key: `quiz:${m.id}`, type: 'quiz', material: m }
  ]);
  const slots = days.length >= 2 ? days.length - 1 : days.length;
  const perDay = Math.max(1, Math.ceil(tasks.length / slots));
  const plan = days.map(date => ({ date, tasks: [] }));
  tasks.forEach((t, i) => plan[Math.min(Math.floor(i / perDay), slots - 1)].tasks.push(t));
  plan[plan.length - 1].tasks.push({ key: 'all', type: 'all' });
  return plan.filter(d => d.tasks.length);
}

function isTaskDone(exam, task) {
  return !!(exam.planDone && exam.planDone[task.key]);
}

function taskHTML(exam, task) {
  const done = isTaskDone(exam, task);
  let text;
  let link;
  if (task.type === 'read') {
    text = `요약 노트 읽기: ${esc(task.material.title)}`;
    link = '';
  } else if (task.type === 'quiz') {
    text = `퀴즈 풀기: ${esc(task.material.title)}`;
    link = `<a href="quiz.html?material=${task.material.id}" class="btn btn-sm btn-light">풀기</a>`;
  } else {
    text = '전체 범위 퀴즈 풀기';
    link = `<a href="quiz.html?subject=${exam.subjectId}" class="btn btn-sm btn-light">풀기</a>`;
  }
  return `
    <li class="plan-task ${done ? 'done' : ''}">
      <label>
        <input type="checkbox" class="form-check-input" data-key="${task.key}" ${done ? 'checked' : ''}>
        <span>${text}</span>
      </label>
      ${link}
    </li>`;
}

function renderPlan() {
  const exam = planExamId && Exams.get(planExamId);
  if (!exam) {
    $('planBody').innerHTML = '<p class="plan-empty">다가오는 시험을 추가하면 날짜별 복습 계획이 여기에 생겨요.</p>';
    return;
  }
  const subject = subjectOf(exam);
  if (!scopeMaterials(exam).length) {
    $('planBody').innerHTML = `
      <p class="plan-empty">${esc(subject.name)}에 올린 자료가 없어서 계획을 만들 수 없어요.
        <a href="material.html?subject=${exam.subjectId}">자료 올리기</a></p>`;
    return;
  }
  const plan = buildPlan(exam);
  const all = plan.flatMap(d => d.tasks);
  const doneN = all.filter(t => isTaskDone(exam, t)).length;
  const today = todayKey();

  $('planBody').innerHTML = `
    <div class="plan-summary">
      <span><strong>${esc(subject.name)} ${esc(exam.name)}</strong>까지 할 일 ${all.length}개 중 ${doneN}개 완료</span>
      <div class="progress" style="height:3px"><div class="progress-bar" style="width:${all.length ? (doneN / all.length) * 100 : 0}%"></div></div>
    </div>
    <ol class="plan-days">
      ${plan.map(day => `
        <li class="plan-day ${day.date === today ? 'today' : ''}">
          <div class="plan-date">
            <strong>${day.date === today ? '오늘' : formatDateKo(day.date)}</strong>
            <span>${daysBefore(exam.date, day.date)}</span>
          </div>
          <ul class="plan-tasks">${day.tasks.map(t => taskHTML(exam, t)).join('')}</ul>
        </li>`).join('')}
    </ol>`;
}

function daysBefore(examDate, day) {
  const left = Math.round((parseDateKey(examDate) - parseDateKey(day)) / 86400000);
  return left === 0 ? '시험 당일' : `시험 ${left}일 전`;
}

function onPlanCheck(e) {
  const box = e.target.closest('[data-key]');
  if (!box) return;
  const exam = Exams.get(planExamId);
  if (!exam) return;
  const planDone = { ...(exam.planDone || {}) };
  if (box.checked) planDone[box.dataset.key] = true;
  else delete planDone[box.dataset.key];
  Exams.update(exam.id, { planDone });
  renderPlan();
}

/* ---------- 달력 ---------- */
function shiftMonth(delta) {
  const d = new Date(calState.year, calState.month + delta, 1);
  calState.year = d.getFullYear();
  calState.month = d.getMonth();
  renderCalendar();
}

function renderCalendar() {
  const { year, month } = calState;
  $('calTitle').textContent = `${year}년 ${month + 1}월`;
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const today = todayKey();
  const exams = Exams.sorted();

  const selected = planExamId && Exams.get(planExamId);
  const planDates = new Set(selected && scopeMaterials(selected).length ? buildPlan(selected).map(d => d.date) : []);

  let cells = WEEKDAYS.map((w, i) => `<div class="cal-weekday ${i === 0 ? 'sun' : ''}">${w}</div>`).join('');
  for (let i = 0; i < first.getDay(); i += 1) cells += '<div class="cal-cell blank"></div>';
  for (let d = 1; d <= lastDay; d += 1) {
    const key = dateKey(new Date(year, month, d));
    const dayExams = exams.filter(x => x.date === key);
    cells += `
      <div class="cal-cell ${key === today ? 'today' : ''} ${dayExams.length ? 'has-exam' : ''} ${planDates.has(key) ? 'has-plan' : ''}">
        <span class="cal-num">${d}</span>
        ${dayExams.map(x => `<button type="button" class="cal-exam" style="--c:${subjectOf(x).color}" data-exam="${x.id}"
            title="${esc(subjectOf(x).name)} ${esc(x.name)}">${esc(x.name)}</button>`).join('')}
      </div>`;
  }
  $('calendar').innerHTML = cells;
}

/* ---------- 지난 시험 ---------- */
function renderPast() {
  const past = Exams.sorted().filter(x => daysUntil(x.date) < 0).reverse();
  $('pastWrap').classList.toggle('d-none', !past.length);
  $('pastCount').textContent = past.length;
  $('pastList').innerHTML = past.map(x => `
    <li data-id="${x.id}">
      <span><span class="past-dot" style="--c:${subjectOf(x).color}"></span>${esc(subjectOf(x).name)} ${esc(x.name)}</span>
      <span class="text-muted">${formatDateKo(x.date)}</span>
      <button type="button" class="btn btn-icon" data-act="delete" aria-label="삭제"><i class="bi bi-trash3"></i></button>
    </li>`).join('');
}

/* ---------- 추가/수정 창 ---------- */
function openExamModal(exam = null) {
  const subjects = Subjects.all();
  if (!subjects.length) {
    toast('먼저 내 과목에서 과목을 만들어 주세요.', 'info');
    return;
  }
  $('examForm').reset();
  ['examName', 'examDate'].forEach(id => $(id).classList.remove('is-invalid'));
  $('examModalTitle').textContent = exam ? '시험 수정' : '시험 추가';
  $('examId').value = exam ? exam.id : '';
  $('examSubject').innerHTML = subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  $('examSubject').value = exam ? exam.subjectId : subjects[0].id;
  $('examName').value = exam ? exam.name : '';
  $('examDate').value = exam ? exam.date : addDaysKey(todayKey(), 7);
  $('examTime').value = exam ? exam.time || '' : '';
  $('examPlace').value = exam ? exam.place || '' : '';
  renderScope(exam);
  examModal.show();
}

function renderScope(exam) {
  const materials = Materials.bySubject($('examSubject').value);
  const chosen = exam && exam.subjectId === $('examSubject').value ? exam.materialIds || [] : [];
  $('examScope').innerHTML = materials.length
    ? materials.map(m => `
        <label class="scope-item">
          <input type="checkbox" class="form-check-input" value="${m.id}" ${!chosen.length || chosen.includes(m.id) ? 'checked' : ''}>
          <span>${esc(m.title)}</span>
        </label>`).join('')
    : '<p class="text-muted small mb-0">이 과목에 올린 자료가 아직 없어요. 나중에 자료를 올리면 자동으로 범위에 들어가요.</p>';
}

function onExamSubmit(e) {
  e.preventDefault();
  const name = $('examName').value.trim();
  const date = $('examDate').value;
  $('examName').classList.toggle('is-invalid', !name);
  $('examDate').classList.toggle('is-invalid', !date);
  if (!name || !date) return;

  const boxes = [...document.querySelectorAll('#examScope input')];
  const checked = boxes.filter(b => b.checked).map(b => b.value);
  const data = {
    subjectId: $('examSubject').value,
    name,
    date,
    time: $('examTime').value,
    place: $('examPlace').value.trim(),
    /* 전부 체크했으면 빈 배열로 저장 → 나중에 올린 자료도 범위에 포함 */
    materialIds: checked.length === boxes.length ? [] : checked
  };
  const id = $('examId').value;
  if (id) {
    Exams.update(id, data);
    toast('시험 일정을 수정했어요.');
  } else {
    planExamId = Exams.add(data).id;
    toast(`${esc(name)} 일정을 추가했어요. ${ddayLabel(date)}`);
  }
  const d = parseDateKey(date);
  calState.year = d.getFullYear();
  calState.month = d.getMonth();
  examModal.hide();
  renderAll();
}
