/* =========================================================
 * storage.js — 벼락노트 데이터 모듈
 * 과목(폴더)과 강의자료를 localStorage에 저장한다.
 * 자료 원문은 용량이 커서 자료마다 별도 키(cn_text_<id>)에 둔다.
 * ========================================================= */

const KEYS = {
  subjects: 'cn_subjects',
  materials: 'cn_materials'
};
const TEXT_PREFIX = 'cn_text_';
const INIT_KEY = 'cn_initialized';

/* 색각 이상이 있어도 서로 구분되는 6색. 흰 글씨 대비 4.5:1 이상 */
const SUBJECT_COLORS = ['#2f5fb3', '#b0561a', '#11845b', '#7b4bb0', '#c0395a', '#00809c'];

/* ---------- 날짜 ---------- */
function nowISO() {
  return new Date().toISOString();
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/* ---------- 저장소 기본 ---------- */
let uidCounter = 0;

const Store = {
  load(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw);
    } catch (e) {
      console.warn('[Store] 불러오기 실패:', key, e);
    }
    return JSON.parse(JSON.stringify(fallback));
  },

  /* 저장 공간이 꽉 차면 false 반환 */
  save(key, data) {
    try {
      localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('[Store] 저장 실패:', key, e);
      if (typeof onStorageFull === 'function') onStorageFull();
      return false;
    }
  },

  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* 무시 */ }
  },

  uid() {
    uidCounter += 1;
    return Date.now().toString(36) + uidCounter.toString(36) + Math.random().toString(36).slice(2, 6);
  }
};

/* ---------- API 키 (js/config.js에서 읽음) ---------- */
const Settings = {
  getApiKey() {
    return typeof GEMINI_API_KEY === 'string' ? GEMINI_API_KEY.trim() : '';
  }
};

/* ---------- 과목 ---------- */
const Subjects = {
  /* 모든 화면에서 과목은 가나다순 (숫자는 크기 순: 자료구조2 → 자료구조10) */
  all() {
    return Store.load(KEYS.subjects).sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
  },
  get(id) {
    return this.all().find(s => s.id === id) || null;
  },
  add(name, color) {
    const list = this.all();
    const subject = { id: Store.uid(), name, color, createdAt: nowISO(), updatedAt: nowISO() };
    list.push(subject);
    Store.save(KEYS.subjects, list);
    return subject;
  },
  update(id, patch) {
    const list = this.all();
    const s = list.find(x => x.id === id);
    if (!s) return null;
    Object.assign(s, patch, { updatedAt: nowISO() });
    Store.save(KEYS.subjects, list);
    return s;
  },
  touch(id) {
    this.update(id, {});
  },
  /* 과목을 지우면 안의 자료도 함께 지운다 */
  remove(id) {
    Materials.all().filter(m => m.subjectId === id).forEach(m => Store.remove(TEXT_PREFIX + m.id));
    Store.save(KEYS.materials, Materials.all().filter(m => m.subjectId !== id));
    Store.save(KEYS.subjects, this.all().filter(s => s.id !== id));
  }
};

/* ---------- 자료 ---------- */
const Materials = {
  all() {
    return Store.load(KEYS.materials);
  },
  bySubject(subjectId) {
    return this.all()
      .filter(m => m.subjectId === subjectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  get(id) {
    return this.all().find(m => m.id === id) || null;
  },
  getText(id) {
    try { return localStorage.getItem(TEXT_PREFIX + id) || ''; } catch (e) { return ''; }
  },
  /* 원문을 먼저 저장하고, 성공했을 때만 목록에 추가 */
  add(meta, text) {
    const material = {
      id: Store.uid(),
      subjectId: meta.subjectId,
      title: meta.title,
      fileName: meta.fileName || '',
      fileType: meta.fileType || 'text',
      pages: meta.pages || 0,
      charCount: text.length,
      summary: meta.summary || '',
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    if (!Store.save(TEXT_PREFIX + material.id, text)) return null;
    const list = this.all();
    list.push(material);
    if (!Store.save(KEYS.materials, list)) {
      Store.remove(TEXT_PREFIX + material.id);
      return null;
    }
    Subjects.touch(material.subjectId);
    return material;
  },
  remove(id) {
    Store.remove(TEXT_PREFIX + id);
    Store.save(KEYS.materials, this.all().filter(m => m.id !== id));
  },
  /* 퀴즈에 넣을 본문: 원문이 없으면(스캔 PDF) 요약으로 대신 */
  quizSource(id) {
    const m = this.get(id);
    if (!m) return null;
    const text = this.getText(id);
    return { title: m.title, text: text.trim() ? text : m.summary };
  }
};
