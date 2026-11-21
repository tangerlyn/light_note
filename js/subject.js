/* =========================================================
 * subject.js — 과목 폴더 상세
 * 이 과목의 강의자료 목록과 퀴즈 기록을 보여준다.
 * ========================================================= */

const subjectId = param('id');

document.addEventListener('DOMContentLoaded', () => {
  const subject = Subjects.get(subjectId);
  if (!subject) {
    document.querySelector('main').innerHTML = `
      <div class="empty-state">
        <i class="bi bi-folder-x empty-icon"></i>
        <h3>과목을 찾을 수 없어요</h3>
        <a href="index.html" class="btn btn-primary mt-2">내 과목으로</a>
      </div>`;
    return;
  }
  document.title = `벼락노트 · ${subject.name}`;
  $('crumbName').textContent = subject.name;
  $('subjectTitle').innerHTML = `<span class="subject-dot" style="--c:${subject.color}"></span>${esc(subject.name)}`;
  $('uploadLink').href = `material.html?subject=${subject.id}`;
  $('quizLink').href = `quiz.html?subject=${subject.id}`;
  $('reviewLink').href = `review.html?subject=${subject.id}`;

  $('materialList').addEventListener('click', onMaterialClick);
  $('attemptBody').addEventListener('click', onAttemptClick);
  renderSubject();
});

function renderSubject() {
  const materials = Materials.bySubject(subjectId);
  const attempts = Attempts.bySubject(subjectId);
  const wrongs = Wrongs.all().filter(w => w.subjectId === subjectId && !w.resolved);

  $('subjectMeta').innerHTML = `<span class="meta"><span>자료 ${materials.length}개</span><span>퀴즈 ${attempts.length}회</span><span class="${wrongs.length ? 'text-omr' : ''}">남은 오답 ${wrongs.length}개</span></span>`;
  $('countMaterials').textContent = materials.length;
  $('countAttempts').textContent = attempts.length;
  $('quizLink').classList.toggle('disabled', !materials.length);

  renderMaterials(materials, attempts);
  renderAttempts(attempts, materials);
}

function renderMaterials(materials, attempts) {
  if (!materials.length) {
    $('materialList').innerHTML = `
      <li>
        <a href="material.html?subject=${subjectId}" class="upload-empty">
          <strong>첫 강의자료를 올려 보세요</strong>
          <span>PDF, PPTX, DOCX, TXT 파일이나 복사한 텍스트로 요약 노트를 만들어요.</span>
        </a>
      </li>`;
    return;
  }
  $('materialList').innerHTML = materials.map(m => {
    const quizCount = attempts.filter(a => (a.materialIds || []).includes(m.id)).length;
    const oneLine = summaryOneLine(m.summary);
    const unit = m.fileType === 'pptx' ? '장' : '쪽';
    return `
      <li class="material-row" data-id="${m.id}">
        <span class="file-chip">${fileTypeLabel(m.fileType)}</span>
        <a href="material.html?id=${m.id}" class="material-main">
          <strong>${esc(m.title)}</strong>
          <span class="material-oneline">${oneLine ? esc(oneLine) : '아직 요약 노트가 없어요'}</span>
        </a>
        <span class="material-info">
          <span>${formatDate(m.createdAt)}</span>
          <span>${m.pages ? `${m.pages}${unit}` : (m.duration ? formatDuration(m.duration) : '')}</span>
          <span>퀴즈 ${quizCount}회</span>
        </span>
        <span class="material-actions">
          <a href="quiz.html?material=${m.id}" class="btn btn-sm btn-light">퀴즈</a>
          <button type="button" class="btn btn-icon" data-act="delete" aria-label="${esc(m.title)} 삭제"><i class="bi bi-trash3"></i></button>
        </span>
      </li>`;
  }).join('');
}

/* 요약의 "한 줄 요약" 섹션 첫 문장 */
function summaryOneLine(md) {
  if (!md) return '';
  const m = md.match(/##\s*한 줄 요약\s*\n+([^\n#]+)/);
  const line = m ? m[1] : md.replace(/[#*`|>-]/g, '').trim().split('\n')[0];
  return line.trim().slice(0, 120);
}

function renderAttempts(attempts, materials) {
  $('attemptEmpty').classList.toggle('d-none', attempts.length > 0);
  $('attemptBody').innerHTML = attempts.map(a => {
    const pct = Math.round((a.score / a.total) * 100);
    const titles = (a.materialIds || [])
      .map(id => (materials.find(m => m.id === id) || {}).title)
      .filter(Boolean);
    const scope = a.mode === 'retry' ? '오답 재도전' : (titles.length ? titles.join(', ') : a.title);
    return `
      <tr data-id="${a.id}">
        <td class="text-nowrap text-muted">${formatDateTime(a.createdAt)}</td>
        <td class="scope-cell">${esc(scope)}</td>
        <td class="text-nowrap">${a.total}문항</td>
        <td class="text-nowrap">
          <span class="score-pen">${pct}<small>점</small></span>
          <span class="text-muted small ms-1">${a.score}/${a.total}</span>
        </td>
        <td class="text-end text-nowrap">
          <a href="quiz.html?attempt=${a.id}" class="btn btn-sm btn-light">결과 보기</a>
          <button type="button" class="btn btn-icon" data-act="delete" aria-label="기록 삭제"><i class="bi bi-trash3"></i></button>
        </td>
      </tr>`;
  }).join('');
}

function onMaterialClick(e) {
  const btn = e.target.closest('[data-act="delete"]');
  if (!btn) return;
  const id = btn.closest('[data-id]').dataset.id;
  const m = Materials.get(id);
  if (!m || !confirm(`'${m.title}' 자료를 삭제할까요?\n요약과 원문이 지워져요. 퀴즈 기록과 오답노트는 남아요.`)) return;
  Materials.remove(id);
  toast('자료를 삭제했어요.', 'info');
  renderSubject();
}

function onAttemptClick(e) {
  const btn = e.target.closest('[data-act="delete"]');
  if (!btn) return;
  const id = btn.closest('[data-id]').dataset.id;
  if (!confirm('이 퀴즈 기록을 삭제할까요? 오답노트에 들어간 문제는 남아요.')) return;
  Attempts.remove(id);
  toast('퀴즈 기록을 삭제했어요.', 'info');
  renderSubject();
}
