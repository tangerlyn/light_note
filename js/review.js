/* =========================================================
 * review.js — 오답노트
 * 과목·상태·유형별로 틀린 문제를 모아 보고, 메모를 남기고,
 * 다시 풀기(quiz.html?retry=1)로 보낸다.
 * ========================================================= */

const reviewState = { subject: 'all', status: 'open', type: 'all', sort: 'recent' };
const memoTimers = {};

document.addEventListener('DOMContentLoaded', () => {
  const subjects = Subjects.all();
  const fromParam = param('subject');
  if (fromParam && subjects.some(s => s.id === fromParam)) reviewState.subject = fromParam;

  $('subjectFilter').innerHTML = '<option value="all">전체 과목</option>' +
    subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  $('subjectFilter').value = reviewState.subject;

  $('subjectFilter').addEventListener('change', e => { reviewState.subject = e.target.value; renderReview(); });
  $('typeFilter').addEventListener('change', e => { reviewState.type = e.target.value; renderReview(); });
  $('sortFilter').addEventListener('change', e => { reviewState.sort = e.target.value; renderReview(); });
  document.querySelectorAll('[name="statusFilter"]').forEach(r => {
    r.addEventListener('change', () => { reviewState.status = r.value; renderReview(); });
  });

  $('wrongList').addEventListener('click', onListClick);
  $('wrongList').addEventListener('input', onMemoInput);
  renderReview();
});

function renderReview() {
  const all = Wrongs.all();
  const subjects = Subjects.all();
  const inSubject = all.filter(w => reviewState.subject === 'all' || w.subjectId === reviewState.subject);
  const open = inSubject.filter(w => !w.resolved);

  document.querySelector('[data-count="open"]').textContent = open.length;
  document.querySelector('[data-count="done"]').textContent = inSubject.length - open.length;

  $('retryBtn').href = `quiz.html?retry=1&subject=${reviewState.subject}`;
  $('retryBtn').classList.toggle('disabled', !open.length);
  $('retryBtn').textContent = `미해결 ${Math.min(open.length, 20)}문제 다시 풀기`;

  let list = inSubject;
  if (reviewState.status === 'open') list = list.filter(w => !w.resolved);
  if (reviewState.status === 'done') list = list.filter(w => w.resolved);
  if (reviewState.type !== 'all') list = list.filter(w => w.question.type === reviewState.type);
  list = [...list].sort(reviewState.sort === 'count'
    ? (a, b) => (b.wrongCount || 1) - (a.wrongCount || 1) || b.lastWrongAt.localeCompare(a.lastWrongAt)
    : (a, b) => b.lastWrongAt.localeCompare(a.lastWrongAt));

  if (!list.length) {
    const msg = reviewState.status === 'open' && !open.length
      ? ['bi-emoji-smile', '남은 오답이 없어요', '퀴즈를 풀면 틀린 문제가 여기에 모여요.']
      : ['bi-funnel', '조건에 맞는 문제가 없어요', '필터를 바꿔 보세요.'];
    $('wrongList').innerHTML = `
      <div class="empty-state">
        <i class="bi ${msg[0]} empty-icon"></i>
        <h3>${msg[1]}</h3>
        <p class="small">${msg[2]}</p>
      </div>`;
    return;
  }

  $('wrongList').innerHTML = list.map(w => wrongCard(w, subjects)).join('');
}

function wrongCard(w, subjects) {
  const q = w.question;
  const subject = subjects.find(s => s.id === w.subjectId);
  const material = w.materialId && Materials.get(w.materialId);
  const sourceLink = material
    ? `<a href="material.html?id=${material.id}">${esc(material.title)}</a>`
    : esc(w.materialTitle || '');
  return `
    <article class="q-card wrong-card ${w.resolved ? 'resolved' : ''}" data-id="${w.id}">
      <div class="wrong-meta">
        ${subject ? `<span class="subject-tag" style="--c:${subject.color}">${esc(subject.name)}</span>` : ''}
        <span class="type-badge">${QUESTION_TYPES[q.type]}</span>
        <span class="text-truncate">${sourceLink}</span>
        <span class="ms-auto text-nowrap wrong-count ${(w.wrongCount || 1) >= 2 ? 'many' : ''}">${w.wrongCount || 1}번 틀림</span>
        <span class="text-nowrap">${formatDate(w.lastWrongAt)}</span>
      </div>
      <p class="q-text">${esc(q.question)}</p>
      ${answerReviewHTML(q, w.myAnswer, false)}
      ${w.feedback ? `<p class="feedback">${esc(w.feedback)}</p>` : ''}
      <p class="explanation"><strong>해설</strong>${esc(q.explanation)}</p>
      <div class="memo-wrap">
        <textarea class="form-control memo" rows="2" placeholder="나만의 메모 (자동 저장)" aria-label="메모">${esc(w.memo || '')}</textarea>
      </div>
      <div class="wrong-actions">
        ${w.resolved
          ? `<span class="resolved-label"><i class="bi bi-check2-circle"></i> ${w.resolvedAt ? formatDate(w.resolvedAt) + ' 해결' : '해결됨'}</span>
             <button type="button" class="btn btn-sm btn-light" data-act="reopen">다시 미해결로</button>`
          : '<button type="button" class="btn btn-sm btn-light" data-act="resolve">이제 알아요</button>'}
        <button type="button" class="btn btn-icon" data-act="delete" aria-label="삭제"><i class="bi bi-trash3"></i></button>
      </div>
    </article>`;
}

function onListClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.closest('[data-id]').dataset.id;
  if (btn.dataset.act === 'resolve') {
    Wrongs.update(id, { resolved: true, resolvedAt: nowISO() });
    toast('해결됨으로 옮겼어요.');
  } else if (btn.dataset.act === 'reopen') {
    Wrongs.update(id, { resolved: false, resolvedAt: null });
    toast('미해결로 되돌렸어요.', 'info');
  } else if (btn.dataset.act === 'delete') {
    if (!confirm('이 문제를 오답노트에서 삭제할까요?')) return;
    Wrongs.remove(id);
    toast('삭제했어요.', 'info');
  }
  refreshNavStatus();
  renderReview();
}

/* 메모는 입력이 멈추고 0.5초 뒤에 저장 */
function onMemoInput(e) {
  if (!e.target.classList.contains('memo')) return;
  const id = e.target.closest('[data-id]').dataset.id;
  clearTimeout(memoTimers[id]);
  memoTimers[id] = setTimeout(() => {
    Wrongs.update(id, { memo: e.target.value });
  }, 500);
}
