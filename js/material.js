/* =========================================================
 * material.js — 강의자료 올리기 & 요약 노트 보기
 * ?subject=ID  → 올리기 모드 (파일 분석 또는 녹음 받아쓰기 → 요약 → 저장)
 * ?id=ID       → 보기 모드 (요약 노트, 원문, 관련 퀴즈)
 * ========================================================= */

const upload = {
  source: 'file',   // 'file' | 'audio' | 'paste'
  parsed: null,     // extractText 결과 + fileName
  audio: null,      // inspectAudio 결과 (+ 받아쓴 text)
  controller: null  // 요약 중지용 AbortController
};

document.addEventListener('DOMContentLoaded', () => {
  preloadMarkdown();
  const id = param('id');
  const subjectId = param('subject');
  if (id) initDetail(id);
  else if (subjectId && Subjects.get(subjectId)) initUpload(subjectId);
  else showNotFound();
});

function showNotFound() {
  document.querySelector('main').innerHTML = `
    <div class="empty-state">
      <i class="bi bi-file-earmark-x empty-icon"></i>
      <h3>자료를 찾을 수 없어요</h3>
      <a href="index.html" class="btn btn-primary mt-2">내 과목으로</a>
    </div>`;
}

function setCrumb(subject, current) {
  $('crumbSubject').textContent = subject.name;
  $('crumbSubject').href = `subject.html?id=${subject.id}`;
  $('crumbCurrent').textContent = current;
}

/* 스트리밍 텍스트를 프레임마다 한 번만 다시 그린다 */
function makeStreamRenderer(target) {
  let buffer = '';
  let scheduled = false;
  return {
    push(delta) {
      buffer += delta;
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        target.innerHTML = renderMarkdownSync(buffer) + '<span class="caret"></span>';
      });
    },
    get text() { return buffer; }
  };
}

function setStatus(el, html) {
  el.innerHTML = html;
  el.classList.toggle('d-none', !html);
}

/* =========================================================
 * 올리기 모드
 * ========================================================= */
function initUpload(subjectId) {
  const subject = Subjects.get(subjectId);
  upload.subjectId = subjectId;
  document.title = `벼락노트 · ${subject.name} 자료 올리기`;
  setCrumb(subject, '자료 올리기');
  $('uploadView').classList.remove('d-none');

  bindDropZone($('dropZone'), $('fileInput'), handleFile);
  bindDropZone($('audioZone'), $('audioInput'), handleAudio);

  document.querySelectorAll('[data-src]').forEach(tab => {
    tab.addEventListener('shown.bs.tab', () => {
      upload.source = tab.dataset.src;
      updateButtons();
    });
  });
  $('pasteText').addEventListener('input', () => {
    $('pasteCount').textContent = `${$('pasteText').value.trim().length.toLocaleString()}자`;
    updateButtons();
  });
  $('titleInput').addEventListener('input', updateButtons);
  $('summarizeBtn').addEventListener('click', () => saveMaterial(true));
  $('saveOnlyBtn').addEventListener('click', () => saveMaterial(false));
  $('stopBtn').addEventListener('click', () => upload.controller && upload.controller.abort());

  window.addEventListener('beforeunload', e => {
    if (upload.controller) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

function bindDropZone(zone, input, onFile) {
  input.addEventListener('change', e => {
    if (e.target.files[0]) onFile(e.target.files[0]);
    e.target.value = '';
  });
  ['dragenter', 'dragover'].forEach(t => zone.addEventListener(t, e => {
    e.preventDefault();
    zone.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(t => zone.addEventListener(t, e => {
    e.preventDefault();
    zone.classList.remove('over');
  }));
  zone.addEventListener('drop', e => {
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });
}

async function handleFile(file) {
  upload.parsed = null;
  updateButtons();
  $('parsedInfo').innerHTML = `
    <div class="parsed-box">
      <span class="spinner-border spinner-border-sm text-primary"></span>
      <span id="parseProgress">${esc(file.name)} 분석 중...</span>
    </div>`;
  try {
    const result = await extractText(file, msg => {
      const p = $('parseProgress');
      if (p) p.textContent = msg;
    });
    if (!result.text && !result.scanned) throw new Error('파일에서 텍스트를 찾지 못했어요.');
    upload.parsed = { ...result, fileName: file.name };
    if (!$('titleInput').value.trim()) $('titleInput').value = file.name.replace(/\.[^.]+$/, '');
    renderParsedInfo();
  } catch (e) {
    $('parsedInfo').innerHTML = `<div class="parsed-box error"><i class="bi bi-exclamation-circle"></i> ${esc(e.message)}</div>`;
  }
  updateButtons();
}

function renderParsedInfo() {
  const p = upload.parsed;
  const unit = p.fileType === 'pptx' ? '슬라이드' : '쪽';
  $('parsedInfo').innerHTML = `
    <div class="parsed-box ok">
      <div class="d-flex align-items-center gap-2 mb-1">
        <i class="bi bi-file-earmark-check"></i>
        <strong class="text-truncate">${esc(p.fileName)}</strong>
      </div>
      <div class="meta">
        <span>${fileTypeLabel(p.fileType)}</span>
        ${p.pages ? `<span>${p.pages}${unit}</span>` : ''}
        <span>${p.text.length.toLocaleString()}자 추출</span>
      </div>
      ${p.scanned ? `
        <div class="scan-note">
          <i class="bi bi-info-circle"></i>
          글자를 뽑을 수 없는 PDF(스캔본)예요. 이미지에서 내용을 읽어 요약해요.
          원문 텍스트는 저장되지 않고, 퀴즈는 요약 노트를 바탕으로 만들어져요.
        </div>` : `
        <details class="mt-2">
          <summary class="small">추출된 텍스트 미리보기</summary>
          <pre class="raw-preview">${esc(p.text.slice(0, 3000))}${p.text.length > 3000 ? '\n...' : ''}</pre>
        </details>`}
    </div>`;
}

/* ---------- 녹음 파일 ---------- */
async function handleAudio(file) {
  upload.audio = null;
  updateButtons();
  $('audioInfo').innerHTML = `
    <div class="parsed-box">
      <span class="spinner-border spinner-border-sm text-primary"></span>
      <span>${esc(file.name)} 확인 중...</span>
    </div>`;
  try {
    upload.audio = { ...(await inspectAudio(file)), text: '' };
    if (!$('titleInput').value.trim()) $('titleInput').value = file.name.replace(/\.[^.]+$/, '');
    renderAudioInfo();
  } catch (e) {
    $('audioInfo').innerHTML = `<div class="parsed-box error"><i class="bi bi-exclamation-circle"></i> ${esc(e.message)}</div>`;
  }
  updateButtons();
}

function renderAudioInfo() {
  const a = upload.audio;
  $('audioInfo').innerHTML = `
    <div class="parsed-box ok">
      <div class="d-flex align-items-center gap-2 mb-1">
        <i class="bi bi-file-earmark-music"></i>
        <strong class="text-truncate">${esc(a.fileName)}</strong>
      </div>
      <div class="meta">
        <span>${formatMB(a.size)}</span>
        ${a.duration ? `<span>${formatDuration(a.duration)}</span>` : ''}
        ${a.text ? `<span>받아쓰기 완료 ${a.text.length.toLocaleString()}자</span>` : ''}
      </div>
      ${a.text ? `
        <details class="mt-2">
          <summary class="small">받아쓴 텍스트 미리보기</summary>
          <pre class="raw-preview">${esc(a.text.slice(0, 3000))}${a.text.length > 3000 ? '\n...' : ''}</pre>
        </details>` : `
        <p class="small text-muted mt-2 mb-0">녹음 파일은 저장하지 않고, 받아쓴 글만 자료로 저장해요.</p>`}
    </div>`;
}

/* 지금 선택된 입력(파일/녹음/붙여넣기)에서 원문을 꺼낸다 */
function currentSource() {
  if (upload.source === 'paste') {
    const text = $('pasteText').value.trim();
    return text ? { text, fileType: 'text', pages: 0, fileName: '', scanned: false } : null;
  }
  if (upload.source === 'audio') {
    const a = upload.audio;
    return a ? { audio: a, text: a.text, fileType: 'audio', pages: 0, duration: a.duration, fileName: a.fileName, scanned: false } : null;
  }
  return upload.parsed;
}

/* 받아쓰기 (화면 오른쪽에 받아쓰는 글이 실시간으로 나온다). 실패하면 null */
async function runTranscribe(a, withSummary) {
  const step = withSummary ? '(1/2) ' : '';
  setStatus($('streamStatus'), `<span class="spinner-border spinner-border-sm"></span> ${step}녹음을 받아쓰고 있어요. 녹음 길이에 따라 몇 분 걸릴 수 있어요.`);
  $('streamBox').innerHTML = '<pre class="transcript-stream"></pre>';
  const out = $('streamBox').querySelector('pre');
  let written = '';
  try {
    const base64 = await fileToBase64(a.file);
    const text = await transcribeAudio({
      base64,
      mimeType: a.mimeType,
      signal: upload.controller.signal,
      onText: delta => {
        if (!written) setStatus($('streamStatus'), `<span class="spinner-border spinner-border-sm"></span> ${step}받아쓰는 중이에요...`);
        written += delta;
        out.textContent = written;
      }
    });
    a.text = text.trim();
    renderAudioInfo();
    return a.text;
  } catch (e) {
    setStatus($('streamStatus'), '');
    $('streamBox').innerHTML = written
      ? `<pre class="transcript-stream">${esc(written)}</pre><p class="text-danger small mt-3">받아쓰기가 중간에 멈췄어요. 저장되지 않았어요.</p>`
      : '<div class="stream-placeholder"><p>요약이 만들어지는 대로 여기에 표시돼요.</p></div>';
    showAIError(e instanceof AIError ? e : new AIError(e.message || '녹음 파일을 읽지 못했어요.'));
    return null;
  }
}

function updateButtons() {
  const src = currentSource();
  const busy = !!upload.controller;
  const hasTitle = !!$('titleInput').value.trim();
  $('summarizeBtn').disabled = busy || !src || !hasTitle;
  $('saveOnlyBtn').disabled = busy || !src || !hasTitle || (src && src.scanned);
}

async function saveMaterial(withSummary) {
  const src = currentSource();
  const title = $('titleInput').value.trim();
  if (!src || !title) return;

  /* 녹음은 먼저 받아쓴다 (이미 받아쓴 적 있으면 다시 하지 않음) */
  if (src.audio && !src.audio.text) {
    upload.controller = new AbortController();
    updateButtons();
    $('stopBtn').classList.remove('d-none');
    const text = await runTranscribe(src.audio, withSummary);
    upload.controller = null;
    $('stopBtn').classList.add('d-none');
    updateButtons();
    if (!text) return;
    src.text = text;
  }

  let summary = '';
  if (withSummary) {
    upload.controller = new AbortController();
    clearAIStatus();
    updateButtons();
    $('stopBtn').classList.remove('d-none');
    setStatus($('streamStatus'), `<span class="spinner-border spinner-border-sm"></span> ${src.audio ? '(2/2) 받아쓴 내용을 읽고 있어요.' : '자료를 읽고 있어요. 분량에 따라 1~2분 걸릴 수 있어요.'}`);
    $('streamBox').innerHTML = '';
    const renderer = makeStreamRenderer($('streamBox'));
    const onText = delta => {
      if (!renderer.text) {
        clearAIStatus();
        setStatus($('streamStatus'), `<span class="spinner-border spinner-border-sm"></span> ${src.audio ? '(2/2) ' : ''}요약을 쓰고 있어요...`);
      }
      renderer.push(delta);
    };
    try {
      summary = src.scanned
        ? await summarizePdf({ title, base64: src.base64, onText, signal: upload.controller.signal })
        : await summarizeText({ title, text: src.text, onText, signal: upload.controller.signal });
    } catch (e) {
      setStatus($('streamStatus'), '');
      $('streamBox').innerHTML = renderer.text
        ? renderMarkdownSync(renderer.text) + '<p class="text-danger small mt-3">요약이 중간에 멈췄어요. 저장되지 않았어요.</p>'
        : '<div class="stream-placeholder"><p>요약이 만들어지는 대로 여기에 표시돼요.</p></div>';
      showAIError(e);
      return;
    } finally {
      clearAIStatus();
      upload.controller = null;
      $('stopBtn').classList.add('d-none');
      updateButtons();
    }
    $('streamBox').innerHTML = await renderMarkdown(summary);
    setStatus($('streamStatus'), '');
  }

  const material = Materials.add({
    subjectId: upload.subjectId,
    title,
    fileName: src.fileName,
    fileType: src.fileType,
    pages: src.pages,
    duration: src.duration || 0,
    summary,
    summaryFromPdf: !!src.scanned
  }, src.text);

  if (!material) {
    toast('저장 공간이 부족해서 자료를 저장하지 못했어요. 오래된 자료를 지워 주세요.', 'danger');
    return;
  }
  toast(withSummary ? '요약 노트를 저장했어요.' : '자료를 저장했어요.');
  location.href = `material.html?id=${material.id}`;
}

/* =========================================================
 * 보기 모드
 * ========================================================= */
let detailId = null;
let regenController = null;

function initDetail(id) {
  const m = Materials.get(id);
  if (!m) {
    showNotFound();
    return;
  }
  detailId = id;
  const subject = Subjects.get(m.subjectId) || { id: m.subjectId, name: '과목' };
  document.title = `벼락노트 · ${m.title}`;
  setCrumb(subject, m.title);
  $('detailView').classList.remove('d-none');

  $('quizBtn').href = `quiz.html?material=${m.id}`;
  $('sideWrongLink').href = `review.html?subject=${m.subjectId}`;
  $('renameBtn').addEventListener('click', startRename);
  $('regenBtn').addEventListener('click', regenerateSummary);
  $('copyBtn').addEventListener('click', copySummary);
  $('deleteBtn').addEventListener('click', () => {
    if (!confirm(`'${m.title}' 자료를 삭제할까요?\n요약과 원문이 지워져요. 퀴즈 기록과 오답노트는 남아요.`)) return;
    Materials.remove(m.id);
    location.href = `subject.html?id=${m.subjectId}`;
  });
  renderDetail();
}

async function renderDetail() {
  const m = Materials.get(detailId);
  const text = Materials.getText(detailId);
  const unit = m.fileType === 'pptx' ? '슬라이드' : '쪽';
  $('materialTitle').textContent = m.title;
  $('materialMeta').innerHTML = `
    <span class="meta">
      <span class="file-badge-sm">${fileTypeLabel(m.fileType)}</span>
      ${m.fileName ? `<span>${esc(m.fileName)}</span>` : ''}
      ${m.pages ? `<span>${m.pages}${unit}</span>` : ''}
      ${m.duration ? `<span>녹음 ${formatDuration(m.duration)}</span>` : ''}
      <span>${m.charCount.toLocaleString()}자</span>
      <span>${formatDate(m.createdAt)}</span>
    </span>`;

  $('regenBtn').disabled = !text;
  $('rawTabBtn').textContent = m.fileType === 'audio' ? '받아쓴 텍스트' : '원문 텍스트';
  if (m.summary) {
    $('summaryBody').innerHTML = await renderMarkdown(m.summary);
  } else {
    $('summaryBody').innerHTML = `
      <div class="empty-state">
        <h3>아직 요약 노트가 없어요</h3>
        <button type="button" class="btn btn-primary mt-2" onclick="regenerateSummary()">요약 만들기</button>
      </div>`;
  }
  $('rawText').textContent = text || '스캔 PDF라서 원문 텍스트가 없어요. 요약 노트는 PDF를 직접 읽어서 만들었어요.';

  const attempts = Attempts.all()
    .filter(a => (a.materialIds || []).includes(detailId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  $('sideAttempts').innerHTML = attempts.length
    ? attempts.slice(0, 6).map(a => `
        <li><a href="quiz.html?attempt=${a.id}">
          <span>${formatDateTime(a.createdAt)}</span>
          <strong class="score-pen">${Math.round((a.score / a.total) * 100)}<small>점</small></strong>
        </a></li>`).join('')
    : '<li class="text-muted small">아직 없어요. 오른쪽 위 버튼으로 퀴즈를 만들어 보세요.</li>';

  const wrongCount = Wrongs.all().filter(w => w.materialId === detailId && !w.resolved).length;
  $('sideWrongText').textContent = wrongCount
    ? `이 자료에서 틀린 문제 ${wrongCount}개가 남아 있어요.`
    : '이 자료에서 남은 오답이 없어요.';
}

async function regenerateSummary() {
  const m = Materials.get(detailId);
  const text = Materials.getText(detailId);
  if (!text || regenController) return;
  if (m.summary && !confirm('지금 요약을 지우고 새로 만들까요?')) return;

  regenController = new AbortController();
  $('regenBtn').disabled = true;
  bootstrap.Tab.getOrCreateInstance(document.querySelector('[data-bs-target="#tabSummary"]')).show();
  setStatus($('detailStatus'), `<span class="spinner-border spinner-border-sm"></span> 요약을 다시 만들고 있어요.
    <button type="button" class="btn btn-sm btn-link text-danger p-0 ms-2" id="regenStop">중지</button>`);
  $('regenStop').addEventListener('click', () => regenController && regenController.abort());
  $('summaryBody').innerHTML = '';
  const renderer = makeStreamRenderer($('summaryBody'));

  try {
    const summary = await summarizeText({ title: m.title, text, onText: d => renderer.push(d), signal: regenController.signal });
    Materials.update(detailId, { summary });
    toast('요약 노트를 새로 만들었어요.');
  } catch (e) {
    showAIError(e);
  } finally {
    clearAIStatus();
    regenController = null;
    setStatus($('detailStatus'), '');
    renderDetail();
  }
}

function startRename() {
  const m = Materials.get(detailId);
  $('titleWrap').innerHTML = `
    <form class="d-flex gap-2 mb-1" id="renameForm">
      <input type="text" class="form-control form-control-lg" id="renameInput" maxlength="80" value="${esc(m.title)}">
      <button type="submit" class="btn btn-primary">저장</button>
      <button type="button" class="btn btn-light" id="renameCancel">취소</button>
    </form>`;
  $('renameInput').focus();
  const restore = () => {
    $('titleWrap').innerHTML = '<h1 id="materialTitle"></h1>';
    renderDetail();
  };
  $('renameCancel').addEventListener('click', restore);
  $('renameForm').addEventListener('submit', e => {
    e.preventDefault();
    const title = $('renameInput').value.trim();
    if (!title) return;
    Materials.update(detailId, { title });
    document.title = `벼락노트 · ${title}`;
    $('crumbCurrent').textContent = title;
    toast('제목을 바꿨어요.');
    restore();
  });
}

async function copySummary() {
  const m = Materials.get(detailId);
  if (!m.summary) {
    toast('복사할 요약이 없어요.', 'warning');
    return;
  }
  try {
    await navigator.clipboard.writeText(m.summary);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = m.summary;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('요약 노트(마크다운)를 복사했어요.');
}
