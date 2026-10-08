/* =========================================================
 * index.js — 내 과목 (과목 폴더 목록)
 * 과목 추가·수정·삭제와 최근 올린 자료
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

  $('subjectGrid').innerHTML = subjects.map(s => folderCard(s, materials)).join('') + `
    <div class="col-sm-6 col-lg-4 col-xl-3">
      <button type="button" class="folder-add" data-act="new">
        <span class="folder-add-tab" aria-hidden="true"></span>
        <span class="folder-add-body"><i class="bi bi-plus-lg"></i> 새 과목 추가</span>
      </button>
    </div>`;

  renderRecent(materials, subjects);
}

/* 과목 = 서류 폴더. 뒤판의 탭에 과목 색, 앞판과 뒤판 사이로 자료 수만큼(최대 3장) 종이가 비친다 */
function folderCard(s, materials) {
  const list = materials.filter(x => x.subjectId === s.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sheets = Array.from({ length: Math.min(list.length, 3) }, (_, k) => `<span class="sheet sheet-${k + 1}"></span>`).join('');
  return `
    <div class="col-sm-6 col-lg-4 col-xl-3">
      <article class="folder" style="--c:${s.color}" data-id="${s.id}">
        <div class="folder-back" aria-hidden="true"><span class="folder-tab"></span></div>
        <div class="folder-sheets" aria-hidden="true">${sheets}</div>
        <div class="folder-front">
          <h3 class="folder-name">${esc(s.name)}</h3>
          <dl class="folder-stats">
            <div><dt>자료</dt><dd>${list.length}</dd></div>
          </dl>
          <p class="folder-last">
            <span>${list.length ? `최근 자료 <b>${formatDate(list[0].createdAt)}</b>` : '아직 올린 자료가 없어요'}</span>
          </p>
          <div class="folder-actions">
            <a href="material.html?subject=${s.id}">자료 올리기</a>
            <a href="quiz.html?subject=${s.id}">퀴즈 만들기</a>
          </div>
        </div>
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

function renderRecent(materials, subjects) {
  const nameOf = id => (subjects.find(s => s.id === id) || {}).name || '';
  const recent = [...materials].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  $('recentMaterials').innerHTML = recent.length
    ? recent.map(m => `
      <li class="recent-row">
        <span class="file-chip">${fileTypeLabel(m.fileType)}</span>
        <span class="recent-title">${esc(m.title)}</span>
        <small>${esc(nameOf(m.subjectId))}</small>
        <small>${formatDate(m.createdAt)}</small>
      </li>`).join('')
    : '<li class="empty-line">아직 올린 자료가 없어요.</li>';
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
    if (!confirm(`'${subject.name}' 과목을 삭제할까요?\n안에 있는 자료 ${n}개도 함께 삭제돼요.`)) return;
    Subjects.remove(id);
    toast(`<strong>${esc(subject.name)}</strong> 과목을 삭제했어요.`, 'info');
    renderHome();
  }
}
