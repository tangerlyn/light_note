/* =========================================================
 * material.js — 강의자료 올리기
 * ?subject=ID  파일(PDF·PPTX·DOCX·TXT)이나 붙여넣은 글에서 텍스트를 뽑고,
 *              요약 노트를 만들어 미리보기로 보여준 뒤 저장한다.
 * ========================================================= */

const MARKED_URL = 'https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js';
const PURIFY_URL = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js';

const upload = {
  source: 'file',   // 'file' | 'paste'
  parsed: null,     // extractText 결과 + fileName
  controller: null  // 요약 중지용 AbortController
};

document.addEventListener('DOMContentLoaded', () => {
  preloadMarkdown();
  const subjectId = param('subject');
  if (subjectId && Subjects.get(subjectId)) initUpload(subjectId);
  else showNotFound();
});

function showNotFound() {
  document.querySelector('main').innerHTML = `
    <div class="empty-state">
      <i class="bi bi-folder-x empty-icon"></i>
      <h3>과목을 찾을 수 없어요</h3>
      <a href="index.html" class="btn btn-primary mt-2">내 과목으로</a>
    </div>`;
}

/* ---------- 마크다운 (요약 노트) ---------- */
/* 요약은 마크다운으로 오므로 HTML로 바꾸고 DOMPurify로 소독한다 */
async function renderMarkdown(md) {
  await Promise.all([loadScript(MARKED_URL), loadScript(PURIFY_URL)]);
  return window.DOMPurify.sanitize(window.marked.parse(md || ''));
}

/* 스트리밍 중에는 라이브러리 로딩을 기다리지 않도록 동기 버전도 둔다 */
function renderMarkdownSync(md) {
  if (window.marked && window.DOMPurify) return window.DOMPurify.sanitize(window.marked.parse(md || ''));
  return `<pre class="stream-raw">${esc(md)}</pre>`;
}

function preloadMarkdown() {
  return Promise.all([loadScript(MARKED_URL), loadScript(PURIFY_URL)]).catch(() => {});
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

const PLACEHOLDER = '<div class="stream-placeholder"><p>요약이 만들어지는 대로 여기에 표시돼요.</p></div>';

/* ---------- 올리기 ---------- */
function initUpload(subjectId) {
  const subject = Subjects.get(subjectId);
  upload.subjectId = subjectId;
  document.title = `벼락노트 · ${subject.name} 자료 올리기`;
  $('crumbSubject').textContent = subject.name;
  $('crumbSubject').href = 'index.html';
  $('crumbCurrent').textContent = '자료 올리기';
  $('uploadView').classList.remove('d-none');

  bindDropZone($('dropZone'), $('fileInput'), handleFile);

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

/* 지금 선택된 입력(파일/붙여넣기)에서 원문을 꺼낸다 */
function currentSource() {
  if (upload.source === 'paste') {
    const text = $('pasteText').value.trim();
    return text ? { text, fileType: 'text', pages: 0, fileName: '', scanned: false } : null;
  }
  return upload.parsed;
}

function updateButtons() {
  const src = currentSource();
  const busy = !!upload.controller;
  const hasTitle = !!$('titleInput').value.trim();
  $('summarizeBtn').disabled = busy || !src || !hasTitle;
  $('saveOnlyBtn').disabled = busy || !src || !hasTitle || (src && src.scanned);
}

/* 다음 자료를 올릴 수 있게 입력칸을 비운다 (미리보기는 남겨 둔다) */
function resetInputs() {
  upload.parsed = null;
  $('parsedInfo').innerHTML = '';
  $('pasteText').value = '';
  $('pasteCount').textContent = '0자';
  $('titleInput').value = '';
  updateButtons();
}

async function saveMaterial(withSummary) {
  const src = currentSource();
  const title = $('titleInput').value.trim();
  if (!src || !title) return;

  let summary = '';
  if (withSummary) {
    upload.controller = new AbortController();
    updateButtons();
    $('stopBtn').classList.remove('d-none');
    setStatus($('streamStatus'), '<span class="spinner-border spinner-border-sm"></span> 자료를 읽고 있어요. 분량에 따라 1~2분 걸릴 수 있어요.');
    $('streamBox').innerHTML = '';
    const renderer = makeStreamRenderer($('streamBox'));
    const onText = delta => {
      if (!renderer.text) setStatus($('streamStatus'), '<span class="spinner-border spinner-border-sm"></span> 요약을 쓰고 있어요...');
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
        : PLACEHOLDER;
      showAIError(e);
      return;
    } finally {
      upload.controller = null;
      $('stopBtn').classList.add('d-none');
      updateButtons();
    }
    $('streamBox').innerHTML = await renderMarkdown(summary);
  }

  const material = Materials.add({
    subjectId: upload.subjectId,
    title,
    fileName: src.fileName,
    fileType: src.fileType,
    pages: src.pages,
    summary
  }, src.text);

  if (!material) {
    setStatus($('streamStatus'), '');
    toast('저장 공간이 부족해서 자료를 저장하지 못했어요. 오래된 자료를 지워 주세요.', 'danger');
    return;
  }
  setStatus($('streamStatus'), `<i class="bi bi-check-circle"></i> <strong>${esc(title)}</strong> 저장됨`);
  if (!withSummary) $('streamBox').innerHTML = PLACEHOLDER;
  toast(withSummary ? '요약 노트를 저장했어요.' : '자료를 저장했어요.');
  resetInputs();
}
