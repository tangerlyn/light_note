/* =========================================================
 * common.js — 모든 페이지 공통 UI
 * 네비게이션, 푸터, 토스트 알림, 헬퍼
 * ========================================================= */

/* ---------- 헬퍼 ---------- */
function $(id) {
  return document.getElementById(id);
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function param(name) {
  return new URLSearchParams(location.search).get(name);
}

function fileTypeLabel(type) {
  return { pdf: 'PDF', pptx: 'PPT', docx: 'DOC', txt: 'TXT', md: 'MD', text: '텍스트' }[type] || type.toUpperCase();
}

/* ---------- 토스트 ---------- */
function toast(message, type = 'success') {
  let wrap = $('cn-toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'cn-toast-wrap';
    wrap.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(wrap);
  }
  const icons = {
    success: 'bi-check-circle-fill',
    danger: 'bi-x-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill'
  };
  const el = document.createElement('div');
  el.className = `toast cn-toast cn-toast-${type} border-0`;
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="d-flex align-items-center">
      <div class="toast-body"><i class="bi ${icons[type] || icons.info} me-2"></i>${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="닫기"></button>
    </div>`;
  wrap.appendChild(el);
  const t = new bootstrap.Toast(el, { delay: type === 'danger' ? 6000 : 3000 });
  el.addEventListener('hidden.bs.toast', () => el.remove());
  t.show();
}

/* storage.js에서 저장 실패 시 호출 */
function onStorageFull() {
  toast('브라우저 저장 공간이 부족해요. 오래된 자료를 지워 주세요.', 'danger');
}

/* 요약·퀴즈 실패를 토스트로 */
function showAIError(e) {
  if (e.kind === 'aborted') return;
  toast(esc(e.message), 'danger');
}

/* ---------- 네비게이션 ---------- */
const NAV_ITEMS = [
  { href: 'index.html', label: '내 과목', pages: ['home', 'material', 'quiz'] }
];

function renderNav() {
  const wrap = $('cn-nav');
  if (!wrap) return;
  const page = document.body.dataset.page;
  wrap.innerHTML = `
    <nav class="navbar navbar-expand-md cn-navbar">
      <div class="container">
        <a class="navbar-brand" href="index.html">
          <img src="images/logo.png" alt="" class="brand-logo" width="32" height="32">
          <span class="brand-name">벼락노트</span>
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#cnNavMenu"
                aria-controls="cnNavMenu" aria-expanded="false" aria-label="메뉴 열기">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="cnNavMenu">
          <ul class="navbar-nav cn-menu">
            ${NAV_ITEMS.map(it => {
              const on = it.pages.includes(page);
              return `<li class="nav-item">
                <a class="nav-link ${on ? 'active' : ''}" href="${it.href}" ${on ? 'aria-current="page"' : ''}>${it.label}</a>
              </li>`;
            }).join('')}
          </ul>
        </div>
      </div>
    </nav>`;
}

function renderFooter() {
  const wrap = $('cn-footer');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="container cn-footer-inner">
      <div>
        <strong class="footer-title">벼락노트</strong>
        <p class="footer-desc">강의자료를 요약하고 퀴즈와 오답노트로 복습하는 대학생 공부 도구</p>
      </div>
      <p class="footer-copy">&copy; ${new Date().getFullYear()} 벼락노트. All rights reserved.</p>
    </div>`;
}

/* ---------- 시작 ---------- */
seedDemoIfFirstRun();
renderNav();
renderFooter();
