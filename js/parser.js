/* =========================================================
 * parser.js — 강의자료 파일에서 텍스트 추출
 * PDF: pdf.js / PPTX·DOCX: JSZip으로 XML을 풀어서 / TXT·MD: 그대로
 * 라이브러리는 필요할 때만 불러온다.
 * ========================================================= */

const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const MAX_FILE_MB = 30;
const SUPPORTED_EXT = ['pdf', 'pptx', 'docx', 'txt', 'md'];

const scriptCache = {};

function loadScript(url) {
  if (!scriptCache[url]) {
    scriptCache[url] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = () => {
        delete scriptCache[url];
        reject(new Error('파일 분석 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptCache[url];
}

function fileExt(name) {
  return (name.split('.').pop() || '').toLowerCase();
}

/*
 * 파일 → { text, pages, fileType, scanned, base64 }
 * scanned: 텍스트가 거의 없는 PDF(스캔본). 이때는 base64를 같이 돌려준다.
 */
async function extractText(file, onProgress = () => {}) {
  const ext = fileExt(file.name);
  if (!SUPPORTED_EXT.includes(ext)) {
    throw new Error(`지원하지 않는 형식이에요 (.${ext}). PDF, PPTX, DOCX, TXT 파일을 올려 주세요.`);
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`파일이 너무 커요. ${MAX_FILE_MB}MB 이하만 올릴 수 있어요.`);
  }

  if (ext === 'pdf') return extractPdf(file, onProgress);
  if (ext === 'pptx') return extractPptx(file, onProgress);
  if (ext === 'docx') return extractDocx(file);
  const text = await file.text();
  return { text: text.trim(), pages: 0, fileType: ext, scanned: false };
}

/* ---------- PDF ---------- */
async function extractPdf(file, onProgress) {
  await loadScript(PDFJS_URL);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;

  const parts = [];
  for (let p = 1; p <= pdf.numPages; p += 1) {
    onProgress(`PDF ${p}/${pdf.numPages}쪽 읽는 중`);
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let pageText = '';
    content.items.forEach(item => {
      pageText += item.str + (item.hasEOL ? '\n' : ' ');
    });
    pageText = pageText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
    if (pageText) parts.push(`[${p}쪽]\n${pageText}`);
  }

  const text = parts.join('\n\n');
  const scanned = text.replace(/\s|\[\d+쪽\]/g, '').length < 30 * Math.min(pdf.numPages, 5);
  const result = { text: scanned ? '' : text, pages: pdf.numPages, fileType: 'pdf', scanned };
  if (scanned) result.base64 = await toBase64(buffer);
  return result;
}

function toBase64(buffer) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(new Blob([buffer], { type: 'application/pdf' }));
  });
}

/* ---------- PPTX ---------- */
function xmlParagraphs(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  return [...doc.getElementsByTagName('a:p')]
    .map(p => [...p.getElementsByTagName('a:t')].map(t => t.textContent).join(''))
    .map(s => s.trim())
    .filter(Boolean);
}

async function extractPptx(file, onProgress) {
  await loadScript(JSZIP_URL);
  let zip;
  try {
    zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  } catch (e) {
    throw new Error('PPTX 파일을 열 수 없어요. 파일이 손상됐거나 암호가 걸려 있는지 확인해 주세요.');
  }
  const slideNames = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/(\d+)\.xml$/)[1], 10) - parseInt(b.match(/(\d+)\.xml$/)[1], 10));

  const parts = [];
  for (let i = 0; i < slideNames.length; i += 1) {
    onProgress(`슬라이드 ${i + 1}/${slideNames.length} 읽는 중`);
    const name = slideNames[i];
    const lines = xmlParagraphs(await zip.file(name).async('string'));

    /* 발표자 노트: 슬라이드의 관계 파일(_rels)에서 연결된 노트 파일을 찾는다 */
    const relName = name.replace('slides/', 'slides/_rels/') + '.rels';
    let notes = [];
    if (zip.file(relName)) {
      const rels = await zip.file(relName).async('string');
      const m = rels.match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/);
      if (m && zip.file(`ppt/notesSlides/${m[1]}`)) {
        notes = xmlParagraphs(await zip.file(`ppt/notesSlides/${m[1]}`).async('string'))
          .filter(line => !/^\d+$/.test(line));
      }
    }

    if (lines.length || notes.length) {
      let block = `[슬라이드 ${i + 1}]\n${lines.join('\n')}`;
      if (notes.length) block += `\n(노트) ${notes.join(' ')}`;
      parts.push(block.trim());
    }
  }
  return { text: parts.join('\n\n'), pages: slideNames.length, fileType: 'pptx', scanned: false };
}

/* ---------- DOCX ---------- */
async function extractDocx(file) {
  await loadScript(JSZIP_URL);
  let zip;
  try {
    zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  } catch (e) {
    throw new Error('DOCX 파일을 열 수 없어요.');
  }
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('DOCX 본문을 찾을 수 없어요.');
  const doc = new DOMParser().parseFromString(await docFile.async('string'), 'application/xml');
  const lines = [...doc.getElementsByTagName('w:p')]
    .map(p => [...p.getElementsByTagName('w:t')].map(t => t.textContent).join('').trim())
    .filter(Boolean);
  return { text: lines.join('\n'), pages: 0, fileType: 'docx', scanned: false };
}
