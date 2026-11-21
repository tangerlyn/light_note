/* =========================================================
 * quiz.js — 퀴즈 만들기 · 풀기 · 채점 · 결과
 * ?subject=ID           과목의 자료 중에서 범위를 골라 출제
 * ?material=ID          해당 자료를 미리 선택
 * ?retry=1&subject=ID   오답노트의 미해결 문제 다시 풀기 (subject=all 가능)
 * ?attempt=ID           지난 퀴즈 결과 보기
 * ========================================================= */

const COUNT_LIMITS = {
  mc: { label: '객관식', hint: '보기 4개', max: 15, def: 5 },
  tf: { label: 'OX', hint: '맞다 / 틀리다', max: 10, def: 3 },
  short: { label: '주관식', hint: '단답 · 서술 (자동 채점)', max: 5, def: 2 }
};
const RETRY_MAX = 20;

const quiz = {
  subjectId: null,
  materialIds: [],
  title: '',
  difficulty: 'normal',
  mode: 'new',        // 'new' | 'retry'
  questions: [],
  answers: [],
  results: [],
  counts: { mc: COUNT_LIMITS.mc.def, tf: COUNT_LIMITS.tf.def, short: COUNT_LIMITS.short.def },
  controller: null,
  timer: null
};

document.addEventListener('DOMContentLoaded', () => {
  const attemptId = param('attempt');
  const materialId = param('material');
  const subjectId = param('subject');
  $('cancelBtn').addEventListener('click', () => quiz.controller && quiz.controller.abort());

  if (attemptId) return showAttempt(attemptId);
  if (param('retry')) return startRetry(subjectId || 'all');

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
  ['setupView', 'loadingView', 'solveView', 'resultView'].forEach(v => $(v).classList.toggle('d-none', v !== id));
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
  if (subject) {
    $('crumbSubject').textContent = subject.name;
    $('crumbSubject').href = `subject.html?id=${subject.id}`;
  } else {
    $('crumbSubject').textContent = '오답노트';
    $('crumbSubject').href = 'review.html';
  }
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
  quiz.mode = 'new';
  startSolving();
}

function startLoading(title, text) {
  quiz.controller = new AbortController();
  clearAIStatus();
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
  clearAIStatus();
  quiz.controller = null;
}

/* =========================================================
 * 오답 재도전
 * ========================================================= */
function startRetry(subjectId) {
  const wrongs = Wrongs.all()
    .filter(w => !w.resolved && (subjectId === 'all' || w.subjectId === subjectId))
    .sort((a, b) => a.lastWrongAt.localeCompare(b.lastWrongAt))
    .slice(0, RETRY_MAX);
  if (!wrongs.length) return showMessage('다시 풀 오답이 없어요.');

  quiz.mode = 'retry';
  quiz.subjectId = subjectId === 'all' ? null : subjectId;
  quiz.materialIds = [...new Set(wrongs.map(w => w.materialId).filter(Boolean))];
  quiz.title = '오답 재도전';
  quiz.questions = wrongs.map(w => ({ ...w.question, id: Store.uid(), wrongId: w.id }));
  setCrumb(quiz.subjectId, '오답 재도전');
  startSolving();
}

/* =========================================================
 * 2. 풀기
 * ========================================================= */
function startSolving() {
  quiz.answers = quiz.questions.map(() => null);
  if (quiz.mode === 'new') setCrumb(quiz.subjectId, '퀴즈 풀기');
  const subject = Subjects.get(quiz.subjectId);
  $('solveSubject').textContent = subject ? subject.name : '오답노트';
  $('solveTitle').textContent = quiz.mode === 'retry' ? `오답 다시 풀기 ${quiz.questions.length}문제` : quiz.title;
  $('questionList').innerHTML = quiz.questions.map(questionCard).join('');
  $('omrCard').innerHTML = omrSheet();
  $('questionList').addEventListener('input', onAnswer);
  $('questionList').addEventListener('change', onAnswer);
  $('omrCard').addEventListener('click', onOmrClick);
  $('submitBtn').addEventListener('click', submit);
  $('submitTopBtn').addEventListener('click', submit);
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
 * 3. 채점
 * ========================================================= */
async function submit() {
  const empty = quiz.answers.filter(a => a === null).length;
  if (empty && !confirm(`답하지 않은 문제가 ${empty}개 있어요. 그대로 제출할까요?`)) return;

  quiz.results = quiz.questions.map((q, i) => {
    const a = quiz.answers[i];
    if (q.type === 'mc') return { correct: a === q.answer_index, feedback: '' };
    if (q.type === 'tf') return { correct: a === q.answer_bool, feedback: '' };
    return a === null ? { correct: false, feedback: '답을 쓰지 않았어요.' } : null;
  });

  const shortItems = quiz.questions
    .map((q, i) => ({ q, i }))
    .filter(({ i }) => quiz.results[i] === null)
    .map(({ q, i }) => ({ id: String(i), question: q.question, modelAnswer: q.model_answer, userAnswer: quiz.answers[i] }));

  if (shortItems.length) {
    startLoading('주관식을 채점하고 있어요', `${shortItems.length}문제를 모범답안과 비교하는 중이에요.`);
    try {
      const graded = await gradeShortAnswers(shortItems, quiz.controller.signal);
      shortItems.forEach(item => {
        const g = graded.find(r => String(r.id) === item.id);
        quiz.results[Number(item.id)] = g
          ? { correct: !!g.correct, feedback: g.feedback || '' }
          : { correct: false, feedback: '채점 결과를 받지 못했어요. 모범답안과 직접 비교해 보세요.' };
      });
    } catch (e) {
      stopLoading();
      showView('solveView');
      showAIError(e);
      return;
    }
    stopLoading();
  }

  window.removeEventListener('beforeunload', warnLeave);
  saveResult();
}

function saveResult() {
  const score = quiz.results.filter(r => r.correct).length;
  const attempt = Attempts.add({
    subjectId: quiz.subjectId,
    materialIds: quiz.materialIds,
    title: quiz.title,
    difficulty: quiz.difficulty,
    mode: quiz.mode,
    questions: quiz.questions,
    answers: quiz.answers,
    results: quiz.results,
    score,
    total: quiz.questions.length
  });

  if (quiz.mode === 'new') {
    const materialTitle = id => (Materials.get(id) || {}).title || quiz.title;
    Wrongs.addMany(quiz.questions
      .map((q, i) => ({ q, i }))
      .filter(({ i }) => !quiz.results[i].correct)
      .map(({ q, i }) => ({
        subjectId: quiz.subjectId,
        materialId: quiz.materialIds.length === 1 ? quiz.materialIds[0] : '',
        materialTitle: quiz.materialIds.length === 1 ? materialTitle(quiz.materialIds[0]) : quiz.title,
        attemptId: attempt.id,
        question: q,
        myAnswer: quiz.answers[i],
        feedback: quiz.results[i].feedback
      })));
  } else {
    quiz.questions.forEach((q, i) => {
      const w = Wrongs.get(q.wrongId);
      if (!w) return;
      if (quiz.results[i].correct) {
        Wrongs.update(w.id, { resolved: true, resolvedAt: nowISO() });
      } else {
        Wrongs.update(w.id, {
          wrongCount: (w.wrongCount || 1) + 1,
          lastWrongAt: nowISO(),
          myAnswer: quiz.answers[i],
          feedback: quiz.results[i].feedback
        });
      }
    });
  }

  refreshNavStatus();
  history.replaceState(null, '', `quiz.html?attempt=${attempt.id}`);
  showResult(attempt, true);
}

/* =========================================================
 * 4. 결과
 * ========================================================= */
function showAttempt(id) {
  const attempt = Attempts.get(id);
  if (!attempt) return showMessage('퀴즈 기록을 찾을 수 없어요.');
  showResult(attempt, false);
}

function showResult(attempt, fresh) {
  setCrumb(attempt.subjectId, '퀴즈 결과');
  const { questions, answers, results, score, total } = attempt;
  const pct = Math.round((score / total) * 100);
  const wrongN = total - score;

  const byType = Object.keys(QUESTION_TYPES).map(type => {
    const idx = questions.map((q, i) => (q.type === type ? i : -1)).filter(i => i >= 0);
    if (!idx.length) return '';
    const ok = idx.filter(i => results[i].correct).length;
    return `<span class="type-score">${QUESTION_TYPES[type]} <b>${ok}</b>/${idx.length}</span>`;
  }).join('');

  let message = pct >= 90 ? '거의 완벽해요. 이 범위는 자신 있게 넘어가도 돼요.'
    : pct >= 70 ? '잘했어요. 틀린 문제만 한 번 더 보면 충분해요.'
    : pct >= 40 ? '절반 정도 맞혔어요. 요약 노트를 다시 보고 오답을 정리해 봐요.'
    : '아직 낯선 내용이 많아요. 요약 노트부터 천천히 읽어 보세요.';
  if (attempt.mode === 'retry') {
    message = `오답 ${total}문제 중 ${score}문제를 해결했어요. 맞힌 문제는 오답노트에서 '해결됨'으로 옮겨졌어요.`;
  }

  const subjectLink = attempt.subjectId ? `subject.html?id=${attempt.subjectId}` : 'index.html';
  const reviewLink = attempt.subjectId ? `review.html?subject=${attempt.subjectId}` : 'review.html';
  const againLink = attempt.mode === 'retry'
    ? (attempt.materialIds && attempt.materialIds.length === 1 ? `quiz.html?material=${attempt.materialIds[0]}` : (attempt.subjectId ? `quiz.html?subject=${attempt.subjectId}` : 'index.html'))
    : (attempt.materialIds && attempt.materialIds.length === 1 ? `quiz.html?material=${attempt.materialIds[0]}` : `quiz.html?subject=${attempt.subjectId}`);

  const when = fresh ? '방금 채점' : formatDateTime(attempt.createdAt);
  $('resultHero').innerHTML = `
    <div class="pen-score" aria-label="${pct}점">
      <span class="pen-score-num">${pct}</span><span class="pen-score-unit">점</span>
      <svg class="pen-loop" viewBox="0 0 220 120" aria-hidden="true"><path d="M150 14 C 205 22, 214 70, 182 96 C 150 120, 62 120, 26 96 C -2 76, 8 30, 52 16 C 86 5, 130 6, 168 18"/></svg>
    </div>
    <div class="result-info">
      <p class="result-kicker"><span>${when}</span><span>${attempt.mode === 'retry' ? '오답 다시 풀기' : esc(attempt.title)}</span></p>
      <h1>${total}문제 중 ${score}문제를 맞혔어요</h1>
      <p class="result-message">${message}</p>
      <div class="type-scores">${byType}</div>
      <div class="d-flex flex-wrap gap-2 mt-4">
        ${wrongN && attempt.mode === 'new' ? `<a href="${reviewLink}" class="btn btn-primary">틀린 ${wrongN}문제 오답노트에서 보기</a>` : ''}
        <a href="${againLink}" class="btn btn-outline-primary">새 퀴즈 만들기</a>
        <a href="${subjectLink}" class="btn btn-light">과목으로</a>
      </div>
    </div>`;

  const renderList = filter => {
    $('resultList').innerHTML = questions.map((q, i) => {
      const r = results[i];
      if (filter === 'wrong' && r.correct) return '';
      return resultCard(q, i, answers[i], r);
    }).join('') || '<div class="empty-state"><h3>틀린 문제가 없어요</h3></div>';
  };
  document.querySelectorAll('[name="resultFilter"]').forEach(r => {
    r.addEventListener('change', () => renderList(r.value));
  });
  renderList('all');
  showView('resultView');
}

/* 빨간 펜 채점 표시: 맞으면 번호에 동그라미, 틀리면 빗금 */
const PEN_CIRCLE = '<path d="M34 6 C 52 6, 60 20, 56 32 C 52 46, 26 50, 12 40 C 2 32, 4 14, 18 8 C 26 4, 36 4, 46 9"/>';
const PEN_SLASH = '<path d="M10 46 C 22 34, 36 20, 54 4"/>';

function resultCard(q, i, answer, r) {
  const answerBlock = answerReviewHTML(q, answer, r.correct);
  return `
    <article class="q-card result ${r.correct ? 'ok' : 'no'}" style="--d:${Math.min(i, 12) * 90}ms">
      <div class="q-head">
        <span class="q-num">${i + 1}<svg class="pen-mark" viewBox="0 0 64 52" aria-hidden="true">${r.correct ? PEN_CIRCLE : PEN_SLASH}</svg></span>
        <span class="visually-hidden">${r.correct ? '정답' : '오답'}</span>
        <span class="type-badge">${QUESTION_TYPES[q.type]}</span>
        ${q.topic ? `<span class="q-topic">${esc(q.topic)}</span>` : ''}
      </div>
      <p class="q-text">${esc(q.question)}</p>
      ${answerBlock}
      ${r.feedback ? `<p class="feedback">${esc(r.feedback)}</p>` : ''}
      <p class="explanation"><strong>해설</strong>${esc(q.explanation)}</p>
    </article>`;
}
