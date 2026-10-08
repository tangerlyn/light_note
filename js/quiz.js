/* =========================================================
 * quiz.js — 퀴즈 만들기 · 풀기
 * ?subject=ID    과목의 자료 중에서 범위를 골라 출제
 * ?material=ID   해당 자료를 미리 선택
 * (채점과 결과 화면은 다음 단계에서 붙인다)
 * ========================================================= */

const QUESTION_TYPES = {
  mc: '객관식',
  tf: 'OX',
  short: '주관식'
};

const COUNT_LIMITS = {
  mc: { label: '객관식', hint: '보기 4개', max: 15, def: 5 },
  tf: { label: 'OX', hint: '맞다 / 틀리다', max: 10, def: 3 },
  short: { label: '주관식', hint: '단답 · 서술', max: 5, def: 2 }
};

const quiz = {
  subjectId: null,
  materialIds: [],
  title: '',
  difficulty: 'normal',
  questions: [],
  answers: [],
  counts: { mc: COUNT_LIMITS.mc.def, tf: COUNT_LIMITS.tf.def, short: COUNT_LIMITS.short.def },
  controller: null,
  timer: null
};

document.addEventListener('DOMContentLoaded', () => {
  const materialId = param('material');
  const subjectId = param('subject');
  $('cancelBtn').addEventListener('click', () => quiz.controller && quiz.controller.abort());

  if (materialId) {
    const m = Materials.get(materialId);
    if (!m) return showMessage('자료를 찾을 수 없어요.');
    initSetup(m.subjectId, [materialId]);
  } else if (subjectId && Subjects.get(subjectId)) {
    initSetup(subjectId, []);
  } else {
    showMessage('과목을 찾을 수 없어요.');
  }
});

function showView(id) {
  ['setupView', 'loadingView', 'solveView'].forEach(v => $(v).classList.toggle('d-none', v !== id));
  window.scrollTo({ top: 0 });
}

function showMessage(msg) {
  document.querySelector('main').innerHTML = `
    <div class="empty-state">
      <i class="bi bi-exclamation-circle empty-icon"></i>
      <h3>${esc(msg)}</h3>
      <a href="index.html" class="btn btn-primary mt-2">내 과목으로</a>
    </div>`;
}

function setCrumb(subjectId, current) {
  const subject = Subjects.get(subjectId);
  $('crumbSubject').textContent = subject ? subject.name : '';
  $('crumbSubject').href = 'index.html';
  $('crumbCurrent').textContent = current;
}

/* =========================================================
 * 1. 설정
 * ========================================================= */
function initSetup(subjectId, preselect) {
  quiz.subjectId = subjectId;
  setCrumb(subjectId, '퀴즈 만들기');
  const materials = Materials.bySubject(subjectId);

  if (!materials.length) {
    $('materialChecks').innerHTML = `
      <div class="empty-state">
        <h3>이 과목에 자료가 없어요</h3>
        <a href="material.html?subject=${subjectId}" class="btn btn-primary mt-2">자료 올리기</a>
      </div>`;
  } else {
    const pre = preselect.length ? preselect : [materials[0].id];
    $('materialChecks').innerHTML = materials.map(m => `
      <label class="material-check">
        <input type="checkbox" class="form-check-input" value="${m.id}" ${pre.includes(m.id) ? 'checked' : ''}>
        <div class="flex-grow-1 min-w-0">
          <strong class="d-block text-truncate">${esc(m.title)}</strong>
          <span class="meta"><span>${fileTypeLabel(m.fileType)}</span><span>${(m.charCount || m.summary.length).toLocaleString()}자</span><span>${formatDate(m.createdAt)}</span></span>
        </div>
      </label>`).join('');
  }

  $('countRows').innerHTML = Object.entries(COUNT_LIMITS).map(([type, cfg]) => `
    <div class="count-row">
      <div>
        <strong class="count-label">${cfg.label}</strong>
        <small class="text-muted d-block">${cfg.hint}</small>
      </div>
      <div class="stepper" data-type="${type}">
        <button type="button" data-step="-1" aria-label="${cfg.label} 줄이기"><i class="bi bi-dash"></i></button>
        <span id="count-${type}">${quiz.counts[type]}</span>
        <button type="button" data-step="1" aria-label="${cfg.label} 늘리기"><i class="bi bi-plus"></i></button>
      </div>
    </div>`).join('');

  $('countRows').addEventListener('click', e => {
    const btn = e.target.closest('[data-step]');
    if (!btn) return;
    const type = btn.closest('[data-type]').dataset.type;
    const next = quiz.counts[type] + Number(btn.dataset.step);
    quiz.counts[type] = Math.max(0, Math.min(COUNT_LIMITS[type].max, next));
    $(`count-${type}`).textContent = quiz.counts[type];
    updateSetup();
  });
  $('materialChecks').addEventListener('change', updateSetup);
  $('selectAllBtn').addEventListener('click', () => {
    const boxes = [...document.querySelectorAll('#materialChecks input')];
    const all = boxes.every(b => b.checked);
    boxes.forEach(b => { b.checked = !all; });
    updateSetup();
  });
  $('generateBtn').addEventListener('click', generate);

  updateSetup();
  showView('setupView');
}

function selectedMaterialIds() {
  return [...document.querySelectorAll('#materialChecks input:checked')].map(b => b.value);
}

function updateSetup() {
  const total = quiz.counts.mc + quiz.counts.tf + quiz.counts.short;
  $('totalCount').textContent = total;
  $('generateBtn').disabled = !total || !selectedMaterialIds().length;
}

async function generate() {
  quiz.materialIds = selectedMaterialIds();
  quiz.difficulty = document.querySelector('[name="difficulty"]:checked').value;
  const sources = quiz.materialIds.map(id => Materials.quizSource(id)).filter(Boolean);
  quiz.title = sources.map(s => s.title).join(', ');

  startLoading('문제를 만들고 있어요', `${sources.length}개 자료에서 ${$('totalCount').textContent}문항을 출제하는 중이에요.`);
  try {
    quiz.questions = await generateQuiz({
      materials: sources,
      counts: quiz.counts,
      difficulty: quiz.difficulty,
      signal: quiz.controller.signal
    });
  } catch (e) {
    stopLoading();
    showView('setupView');
    showAIError(e);
    return;
  }
  stopLoading();
  startSolving();
}

function startLoading(title, text) {
  quiz.controller = new AbortController();
  $('loadingTitle').textContent = title;
  $('loadingText').textContent = text;
  const started = Date.now();
  $('loadingTimer').textContent = '0초';
  quiz.timer = setInterval(() => {
    $('loadingTimer').textContent = `${Math.round((Date.now() - started) / 1000)}초`;
  }, 1000);
  showView('loadingView');
}

function stopLoading() {
  clearInterval(quiz.timer);
  quiz.controller = null;
}

/* =========================================================
 * 2. 풀기
 * ========================================================= */
function startSolving() {
  quiz.answers = quiz.questions.map(() => null);
  setCrumb(quiz.subjectId, '퀴즈 풀기');
  const subject = Subjects.get(quiz.subjectId);
  $('solveSubject').textContent = subject ? subject.name : '';
  $('solveTitle').textContent = quiz.title;
  $('questionList').innerHTML = quiz.questions.map(questionCard).join('');
  $('omrCard').innerHTML = omrSheet();
  $('questionList').addEventListener('input', onAnswer);
  $('questionList').addEventListener('change', onAnswer);
  $('omrCard').addEventListener('click', onOmrClick);
  $('submitBtn').addEventListener('click', submit);
  window.addEventListener('beforeunload', warnLeave);
  updateProgress();
  showView('solveView');
}

function warnLeave(e) {
  e.preventDefault();
  e.returnValue = '';
}

function questionCard(q, i) {
  let body = '';
  if (q.type === 'mc') {
    body = `<div class="choices">${q.choices.map((c, k) => `
      <label class="choice">
        <input type="radio" name="q${i}" value="${k}">
        <span class="choice-key">${k + 1}</span>
        <span class="choice-text">${esc(c)}</span>
      </label>`).join('')}</div>`;
  } else if (q.type === 'tf') {
    body = `<div class="choices tf">
      <label class="choice"><input type="radio" name="q${i}" value="true"><span class="choice-key">O</span><span class="choice-text">맞다</span></label>
      <label class="choice"><input type="radio" name="q${i}" value="false"><span class="choice-key">X</span><span class="choice-text">틀리다</span></label>
    </div>`;
  } else {
    body = `<textarea class="form-control short-input" name="q${i}" rows="3" placeholder="핵심어가 들어가면 표현이 달라도 괜찮아요." aria-label="${i + 1}번 답"></textarea>`;
  }
  return `
    <article class="q-card" data-idx="${i}" id="q-${i}">
      <div class="q-head">
        <span class="q-num">${i + 1}</span>
        <span class="type-badge">${QUESTION_TYPES[q.type]}</span>
        ${q.topic ? `<span class="q-topic">${esc(q.topic)}</span>` : ''}
      </div>
      <p class="q-text">${esc(q.question)}</p>
      ${body}
    </article>`;
}

/* ---------- OMR 답안지: 답을 고르면 해당 칸이 까맣게 칠해진다 ---------- */
function omrSheet() {
  const rows = quiz.questions.map((q, i) => {
    let cells;
    if (q.type === 'mc') {
      cells = [0, 1, 2, 3].map(k => `<button type="button" class="omr-bubble" data-q="${i}" data-v="${k}" aria-label="${i + 1}번 ${k + 1}">${k + 1}</button>`).join('');
    } else if (q.type === 'tf') {
      cells = `<button type="button" class="omr-bubble" data-q="${i}" data-v="true" aria-label="${i + 1}번 O">O</button>
               <button type="button" class="omr-bubble" data-q="${i}" data-v="false" aria-label="${i + 1}번 X">X</button>`;
    } else {
      cells = `<button type="button" class="omr-write" data-q="${i}" data-go="1">서술형</button>`;
    }
    return `<div class="omr-row" data-row="${i}">
      <button type="button" class="omr-no" data-q="${i}" data-go="1" aria-label="${i + 1}번 문제로 이동">${i + 1}</button>
      <div class="omr-cells">${cells}</div>
    </div>`;
  }).join('');
  return `<div class="omr-head"><span>답안지</span><span>${quiz.questions.length}문항</span></div><div class="omr-body">${rows}</div>`;
}

function onOmrClick(e) {
  const btn = e.target.closest('[data-q]');
  if (!btn) return;
  const i = Number(btn.dataset.q);
  if (btn.dataset.go) {
    const card = $(`q-${i}`);
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const field = card.querySelector('textarea, input');
    if (field && field.tagName === 'TEXTAREA') setTimeout(() => field.focus({ preventScroll: true }), 300);
    return;
  }
  const radio = document.querySelector(`[name="q${i}"][value="${btn.dataset.v}"]`);
  if (!radio) return;
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
}

function syncOmr(i) {
  const a = quiz.answers[i];
  document.querySelectorAll(`.omr-bubble[data-q="${i}"]`).forEach(b => {
    b.classList.toggle('filled', a !== null && String(a) === b.dataset.v);
  });
  const w = document.querySelector(`.omr-write[data-q="${i}"]`);
  if (w) w.classList.toggle('filled', a !== null);
  const row = document.querySelector(`.omr-row[data-row="${i}"]`);
  if (row) row.classList.toggle('done', a !== null);
}

function onAnswer(e) {
  const card = e.target.closest('[data-idx]');
  if (!card) return;
  const i = Number(card.dataset.idx);
  const q = quiz.questions[i];
  if (q.type === 'mc') quiz.answers[i] = Number(e.target.value);
  else if (q.type === 'tf') quiz.answers[i] = e.target.value === 'true';
  else quiz.answers[i] = e.target.value.trim() || null;
  card.classList.toggle('answered', quiz.answers[i] !== null);
  syncOmr(i);
  updateProgress();
}

function updateProgress() {
  const done = quiz.answers.filter(a => a !== null).length;
  const total = quiz.questions.length;
  $('solveCount').textContent = `${total}문항 중 ${done}문항 표기`;
  $('solveProgress').style.width = `${(done / total) * 100}%`;
}

/* =========================================================
 * 3. 제출 (채점은 다음 단계)
 * ========================================================= */
function submit() {
  const empty = quiz.answers.filter(a => a === null).length;
  if (empty && !confirm(`답하지 않은 문제가 ${empty}개 있어요. 그대로 제출할까요?`)) return;
  toast('채점 기능은 준비 중이에요. 답안은 화면에 그대로 남아 있어요.', 'info');
}
