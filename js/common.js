/* =========================================================
 * common.js — 모든 페이지 공통 UI
 * 네비게이션, 토스트 알림, 마크다운 렌더링, 헬퍼
 * ========================================================= */

const MARKED_URL = 'https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js';
const PURIFY_URL = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js';

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
  return { pdf: 'PDF', pptx: 'PPT', docx: 'DOC', txt: 'TXT', md: 'MD', text: '텍스트', audio: '녹음' }[type] || type.toUpperCase();
}

/* AI가 쓴 마크다운을 안전한 HTML로 (DOMPurify로 소독) */
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

/* 채점된 문항의 정답/내 답 비교 표시 (퀴즈 결과 · 오답노트 공통) */
function answerReviewHTML(q, answer, correct) {
  if (q.type === 'mc') {
    return `<div class="choices review">${q.choices.map((c, k) => {
      const cls = k === q.answer_index ? 'is-answer' : (k === answer ? 'is-wrong' : '');
      return `<div class="choice ${cls}">
        <span class="choice-key">${k + 1}</span>
        <span class="choice-text">${esc(c)}</span>
        ${k === q.answer_index ? '<span class="choice-tag ok">정답</span>' : ''}
        ${k === answer && k !== q.answer_index ? '<span class="choice-tag no">내 답</span>' : ''}
      </div>`;
    }).join('')}</div>`;
  }
  return `
    <dl class="answer-compare">
      <dt>내 답</dt><dd class="${correct ? '' : 'mine-wrong'}">${esc(userAnswerText(q, answer))}</dd>
      <dt>${q.type === 'short' ? '모범답안' : '정답'}</dt><dd>${esc(correctAnswerText(q))}</dd>
    </dl>`;
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
  toast('브라우저 저장 공간이 부족해요. 오래된 자료나 퀴즈 기록을 지워 주세요.', 'danger');
}

/* 요약·퀴즈 실패를 토스트로 */
function showAIError(e) {
  if (e.kind === 'aborted') return;
  toast(esc(e.message), 'danger');
}

/* ---------- 네비게이션 (메가 메뉴) ----------
 * 데스크톱: 메뉴에 마우스를 올리거나 Tab으로 들어가면 네 메뉴의 하위 항목이 한 판에 펼쳐진다.
 * 휴대폰: ☰ 안에서 각 메뉴 옆 ▾ 버튼으로 하위 항목을 펼친다.
 */
const NAV_ITEMS = [
  { key: 'subjects', href: 'index.html', label: '내 과목', pages: ['home', 'subject', 'material', 'quiz'] },
  { key: 'exams', href: 'schedule.html', label: '시험 일정', pages: ['schedule'] },
  { key: 'wrongs', href: 'review.html', label: '오답노트', pages: ['review'] },
  { key: 'stats', href: 'stats.html', label: '학습 기록', pages: ['stats'] }
];
const MENU_LIMIT = 4;

function renderNav() {
  const wrap = $('cn-nav');
  if (!wrap) return;
  const page = document.body.dataset.page;
  wrap.innerHTML = `
    <nav class="navbar navbar-expand-md cn-navbar" id="cnNavbar">
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
          <ul class="navbar-nav cn-menu" id="cnMenu">
            ${NAV_ITEMS.map(it => `
              <li class="nav-item mega-item" data-menu="${it.key}">
                <div class="mega-top">
                  <a class="nav-link ${it.pages.includes(page) ? 'active' : ''}" href="${it.href}" ${it.pages.includes(page) ? 'aria-current="page"' : ''}>${it.label}</a>
                  <button type="button" class="mega-toggle" aria-expanded="false" aria-label="${it.label} 하위 메뉴 펼치기"><i class="bi bi-chevron-down"></i></button>
                </div>
                <div class="mega-col" id="mega-${it.key}"></div>
              </li>`).join('')}
          </ul>
        </div>
      </div>
      <div class="mega-backdrop" aria-hidden="true"></div>
    </nav>`;
  bindMegaMenu();
  refreshNavStatus();
}

/* 메뉴 내용은 저장된 데이터로 그때그때 만든다 (다른 페이지에서 데이터가 바뀌면 다시 호출) */
function refreshNavStatus() {
  if (!$('cnMenu')) return;
  $('mega-subjects').innerHTML = megaSubjects();
  $('mega-exams').innerHTML = megaExams();
  $('mega-wrongs').innerHTML = megaWrongs();
  $('mega-stats').innerHTML = megaStats();
}

function megaSubjects() {
  const subjects = Subjects.all();
  if (!subjects.length) return '<p class="mega-empty">아직 만든 과목이 없어요.</p><a class="mega-more" href="index.html">과목 만들기</a>';
  return `<ul class="mega-list">
    ${subjects.slice(0, MENU_LIMIT).map(s => `
      <li><a href="subject.html?id=${s.id}"><span class="mega-key" style="background:${s.color}"></span><span class="mega-text">${esc(s.name)}</span></a></li>`).join('')}
  </ul>`;
}

function megaExams() {
  const exams = Exams.upcoming();
  if (!exams.length) return '<p class="mega-empty">다가오는 시험이 없어요.</p><a class="mega-more" href="schedule.html">시험 추가하기</a>';
  return `<ul class="mega-list">
    ${exams.slice(0, MENU_LIMIT).map(x => {
      const s = Subjects.get(x.subjectId) || { name: '', color: '#737985' };
      return `<li><a href="schedule.html?exam=${x.id}">
        <span class="mega-key" style="background:${s.color}"></span>
        <span class="mega-text">${esc(s.name)} ${esc(x.name)}</span>
        <span class="mega-dday">${ddayLabel(x.date)}</span>
      </a></li>`;
    }).join('')}
  </ul>`;
}

/* 과목별 미해결 오답 수 (많은 순, 최대 4줄). 누르면 그 과목의 미해결 문제만 보인다 */
function megaWrongs() {
  const counts = new Map();
  Wrongs.all().filter(w => !w.resolved).forEach(w => counts.set(w.subjectId, (counts.get(w.subjectId) || 0) + 1));
  const rows = Subjects.all()
    .filter(s => counts.get(s.id))
    .sort((a, b) => counts.get(b.id) - counts.get(a.id))
    .slice(0, MENU_LIMIT);
  if (!rows.length) return '<p class="mega-empty">미해결 오답이 없어요.</p>';
  return `<ul class="mega-list">
    ${rows.map(s => `
      <li><a href="review.html?subject=${s.id}">
        <span class="mega-key" style="background:${s.color}"></span>
        <span class="mega-text">${esc(s.name)}</span>
        <span class="mega-count">${counts.get(s.id)}문제</span>
      </a></li>`).join('')}
  </ul>`;
}

/* 이번 주(월요일~오늘) 공부한 날 수와 퀴즈 평균 */
function megaStats() {
  const today = todayKey();
  const weekStart = addDaysKey(today, -((parseDateKey(today).getDay() + 6) % 7));
  const inWeek = iso => { const k = dateKey(iso); return k >= weekStart && k <= today; };
  const days = new Set();
  const attempts = Attempts.all().filter(a => inWeek(a.createdAt));
  attempts.forEach(a => days.add(dateKey(a.createdAt)));
  Materials.all().filter(m => inWeek(m.createdAt)).forEach(m => days.add(dateKey(m.createdAt)));
  Wrongs.all().filter(w => w.resolved && w.resolvedAt && inWeek(w.resolvedAt)).forEach(w => days.add(dateKey(w.resolvedAt)));
  const avg = attempts.length
    ? Math.round(attempts.reduce((sum, a) => sum + (a.score / a.total) * 100, 0) / attempts.length)
    : null;
  return `<div class="mega-figure">
    <span>이번 주 <strong>${days.size}</strong>일 공부</span>
    <span>${avg === null ? '이번 주 푼 퀴즈 없음' : `이번 주 평균 <strong>${avg}</strong>점`}</span>
  </div>`;
}

function bindMegaMenu() {
  const nav = $('cnNavbar');
  const menu = $('cnMenu');
  const desktop = () => window.matchMedia('(min-width: 768px)').matches;
  let closeTimer;

  const open = () => {
    if (!desktop()) return;
    clearTimeout(closeTimer);
    /* 펼친 판 높이 = 가장 긴 열 + 여백 */
    const h = Math.max(...[...menu.querySelectorAll('.mega-col')].map(c => c.scrollHeight));
    nav.style.setProperty('--mega-h', `${h + 40}px`);
    nav.classList.add('mega-open');
  };
  const close = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => nav.classList.remove('mega-open'), 120);
  };

  menu.addEventListener('mouseenter', open);
  nav.addEventListener('mouseleave', close);
  nav.querySelector('.mega-backdrop').addEventListener('mouseenter', () => clearTimeout(closeTimer));
  menu.addEventListener('focusin', open);
  nav.addEventListener('focusout', e => { if (!nav.contains(e.relatedTarget)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') nav.classList.remove('mega-open'); });

  /* 휴대폰: ▾ 버튼으로 하위 메뉴 열고 닫기 */
  menu.addEventListener('click', e => {
    const btn = e.target.closest('.mega-toggle');
    if (!btn) return;
    const li = btn.closest('.mega-item');
    const opened = li.classList.toggle('open');
    btn.setAttribute('aria-expanded', opened);
  });
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

/* (예전에 재시도 상태 문구를 지우던 함수 — 호출부 호환용으로 남겨 둠) */
function clearAIStatus() {}

/* ---------- 시작 ---------- */
seedDemoIfFirstRun();
renderNav();
renderFooter();
