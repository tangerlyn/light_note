/* =========================================================
 * index.js — 내 과목 (과목 폴더 목록)
 * ========================================================= */

let subjectModal;

document.addEventListener('DOMContentLoaded', () => {
  subjectModal = new bootstrap.Modal($('subjectModal'));
  $('colorPicker').innerHTML = SUBJECT_COLORS.map((c, i) => `
    <label class="color-swatch" style="--c:${c}">
      <input type="radio" name="subjectColor" value="${c}" ${i === 0 ? 'checked' : ''} aria-label="색 ${i + 1}">
      <span></span>
    </label>`).join('');

  $('newSubjectBtn').addEventListener('click', () => openSubjectModal());
  $('subjectForm').addEventListener('submit', onSubjectSubmit);
  $('subjectGrid').addEventListener('click', onGridClick);
  renderHome();
});

function renderHome() {
  const subjects = Subjects.all();
  const materials = Materials.all();
  const attempts = Attempts.all();
  const wrongs = Wrongs.all();

  $('subjectGrid').innerHTML = subjects.map(s => folderCard(s, materials, attempts, wrongs)).join('') + `
    <div class="col-sm-6 col-lg-4 col-xl-3">
      <button type="button" class="folder-add" data-act="new">
        <span class="folder-add-tab" aria-hidden="true"></span>
        <span class="folder-add-body"><i class="bi bi-plus-lg"></i> 새 과목 추가</span>
      </button>
    </div>`;

  renderRecent(materials, attempts, subjects);
  refreshNavStatus();
}

/* 과목 = 서류 폴더. 뒤판의 탭에 과목 색, 앞판과 뒤판 사이로 자료 수만큼(최대 3장) 종이가 비친다 */
function folderCard(s, materials, attempts, wrongs) {
  const m = materials.filter(x => x.subjectId === s.id).length;
  const a = attempts.filter(x => x.subjectId === s.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const w = wrongs.filter(x => x.subjectId === s.id && !x.resolved).length;
  const last = a[0];
  const exam = Exams.nextFor(s.id);
  const sheets = Array.from({ length: Math.min(m, 3) }, (_, k) => `<span class="sheet sheet-${k + 1}"></span>`).join('');
  return `
    <div class="col-sm-6 col-lg-4 col-xl-3">
      <article class="folder" style="--c:${s.color}" data-id="${s.id}">
        <div class="folder-back" aria-hidden="true"><span class="folder-tab"></span></div>
        <div class="folder-sheets" aria-hidden="true">${sheets}</div>
        <a href="subject.html?id=${s.id}" class="folder-front">
          <h3 class="folder-name">${esc(s.name)}</h3>
          <dl class="folder-stats">
            <div><dt>자료</dt><dd>${m}</dd></div>
            <div><dt>퀴즈</dt><dd>${a.length}</dd></div>
            <div class="${w ? 'has-wrong' : ''}"><dt>오답</dt><dd>${w}</dd></div>
          </dl>
          <p class="folder-last">
            <span>${last ? `최근 퀴즈 <b>${Math.round((last.score / last.total) * 100)}점</b>` : '아직 푼 퀴즈가 없어요'}</span>
            ${exam ? `<span class="folder-dday">${esc(exam.name)} <b>${ddayLabel(exam.date)}</b></span>` : ''}
          </p>
        </a>
        <div class="dropdown folder-menu">
          <button type="button" class="btn btn-icon" data-bs-toggle="dropdown" aria-expanded="false" aria-label="${esc(s.name)} 메뉴">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><button type="button" class="dropdown-item" data-act="edit"><i class="bi bi-pencil"></i> 이름·색 바꾸기</button></li>
            <li><button type="button" class="dropdown-item text-danger" data-act="delete"><i class="bi bi-trash3"></i> 과목 삭제</button></li>
          </ul>
        </div>
      </article>
    </div>`;
}

function renderRecent(materials, attempts, subjects) {
  const nameOf = id => (subjects.find(s => s.id === id) || {}).name || '';
  const recentM = [...materials].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  $('recentMaterials').innerHTML = recentM.length
    ? recentM.map(m => `
      <li>
        <a href="material.html?id=${m.id}">
          <span class="file-chip">${fileTypeLabel(m.fileType)}</span>
          <span class="recent-title">${esc(m.title)}</span>
          <small>${esc(nameOf(m.subjectId))}</small>
          <small>${formatDate(m.createdAt)}</small>
        </a>
      </li>`).join('')
    : '<li class="empty-line">아직 올린 자료가 없어요.</li>';

  const recentA = [...attempts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  $('recentAttempts').innerHTML = recentA.length
    ? recentA.map(a => {
        const pct = Math.round((a.score / a.total) * 100);
        return `
        <li>
          <a href="quiz.html?attempt=${a.id}">
            <span class="score-chip">${pct}점</span>
            <span class="recent-title">${a.mode === 'retry' ? '오답 재도전' : esc(a.title)}</span>
            <small>${esc(nameOf(a.subjectId))}</small>
            <small>${formatDate(a.createdAt)}</small>
          </a>
        </li>`;
      }).join('')
    : '<li class="empty-line">아직 푼 퀴즈가 없어요.</li>';
}

/* ---------- 과목 추가/수정/삭제 ---------- */
function openSubjectModal(subject = null) {
  $('subjectForm').reset();
  $('subjectName').classList.remove('is-invalid');
  $('subjectId').value = subject ? subject.id : '';
  $('subjectName').value = subject ? subject.name : '';
  $('subjectModalTitle').textContent = subject ? '과목 수정' : '새 과목';
  const color = subject ? subject.color : SUBJECT_COLORS[Subjects.all().length % SUBJECT_COLORS.length];
  document.querySelectorAll('[name="subjectColor"]').forEach(r => { r.checked = r.value === color; });
  subjectModal.show();
  setTimeout(() => $('subjectName').focus(), 300);
}

function onSubjectSubmit(e) {
  e.preventDefault();
  const name = $('subjectName').value.trim();
  if (!name) {
    $('subjectName').classList.add('is-invalid');
    return;
  }
  const color = (document.querySelector('[name="subjectColor"]:checked') || {}).value || SUBJECT_COLORS[0];
  const id = $('subjectId').value;
  if (id) {
    Subjects.update(id, { name, color });
    toast(`<strong>${esc(name)}</strong> 과목을 수정했어요.`);
  } else {
    Subjects.add(name, color);
    toast(`<strong>${esc(name)}</strong> 과목을 만들었어요.`);
  }
  subjectModal.hide();
  renderHome();
}

function onGridClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'new') {
    openSubjectModal();
    return;
  }
  const id = btn.closest('[data-id]').dataset.id;
  const subject = Subjects.get(id);
  if (!subject) return;
  if (btn.dataset.act === 'edit') openSubjectModal(subject);
  if (btn.dataset.act === 'delete') {
    const n = Materials.bySubject(id).length;
    if (!confirm(`'${subject.name}' 과목을 삭제할까요?\n자료 ${n}개와 퀴즈 기록, 오답노트도 함께 삭제돼요.`)) return;
    Subjects.remove(id);
    toast(`<strong>${esc(subject.name)}</strong> 과목을 삭제했어요.`, 'info');
    renderHome();
  }
}
