# 벼락노트

강의자료(PDF, PPTX, DOCX, TXT)를 올리면 요약 노트를 만들고, 그 자료로 퀴즈를 풀며 시험 일정에 맞춰 복습 계획을 세우는 웹사이트입니다.
서버 없이 HTML, CSS, JavaScript로만 동작하고 데이터는 브라우저의 localStorage에 저장합니다.

## 실행 방법

1. `js/config.example.js`를 복사해서 `js/config.js`로 저장합니다.
2. `js/config.js`의 `GEMINI_API_KEY`에 키를 넣습니다.
3. `index.html`을 브라우저로 엽니다.

`js/config.js`는 `.gitignore`에 들어 있어 저장소에 올라가지 않습니다.

## 페이지

| 페이지 | 파일 | 내용 |
|---|---|---|
| 내 과목 | `index.html` | 과목 폴더 추가·수정·삭제, 최근 올린 자료 |
| 자료 올리기 | `material.html` | 파일에서 텍스트 추출, 요약 노트 미리보기, 저장 |
| 퀴즈 | `quiz.html` | 출제 범위·문항 수·난이도 선택, 시험지와 OMR 답안지로 풀기 |
| 시험 일정 | `schedule.html` | 수험표, D-day, 날짜별 복습 계획, 달력 |

## 사용 기술

- Bootstrap 5.3, Bootstrap Icons
- localStorage (과목, 자료, 시험 일정 저장)
- pdf.js, JSZip (PDF, PPTX, DOCX 텍스트 추출)
- marked, DOMPurify (요약 노트 마크다운 표시)
- Gemini API (요약, 퀴즈 생성)

## 폴더 구조

```
index.html  material.html  quiz.html  schedule.html
css/   common.css  index.css  material.css  quiz.css  schedule.css
js/    storage.js  common.js  demo.js  index.js
       parser.js  ai.js  material.js  quiz.js  schedule.js
       config.example.js
images/logo.png
```
