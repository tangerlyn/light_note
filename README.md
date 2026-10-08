# 벼락노트

> 강의자료를 올리면 요약 노트를 만들고, 그 자료로 퀴즈를 풀며 시험 일정에 맞춰 복습하는 대학생 공부 도구

시험 기간마다 강의자료를 처음부터 다시 읽고, 요약하고, 문제를 직접 만들어 보는 데 시간이 많이 듭니다.
벼락노트는 PDF·PPTX 강의자료를 올리면 시험 공부용 요약 노트를 만들고, 같은 자료로 객관식·OX·주관식 퀴즈를 출제합니다.
시험 날짜를 넣으면 남은 날짜에 맞춰 자료별 복습 계획도 짜 줍니다.

서버 없이 HTML, CSS, JavaScript만으로 동작하며, 모든 데이터는 브라우저의 localStorage에 저장됩니다.

---

## 팀 소개

### 숭실대학교 AI소프트웨어학부 웹프로그래밍 팀

| <img src="https://github.com/tangerlyn.png" width="150"> | <img src="https://github.com/고다원아이디.png" width="150"> | <img src="https://github.com/고승민아이디.png" width="150"> | <img src="https://github.com/김도형아이디.png" width="150"> |
| :---: | :---: | :---: | :---: |
| [팀장] [김규린](https://github.com/tangerlyn) <br/> 네비게이션 / 푸터 / 내 과목 / 저장 구조 | [고다원](https://github.com/고다원아이디) <br/> 자료 올리기 / 텍스트 추출 / 요약 노트 | [고승민](https://github.com/고승민아이디) <br/> 퀴즈 만들기 / 퀴즈 풀기 | [김도형](https://github.com/김도형아이디) <br/> 시험 일정 / 복습 계획 / 달력 |
| `tangerlyn` <br/> gyulyn7777@gmail.com | `고다원아이디` <br/> 이메일 | `고승민아이디` <br/> 이메일 | `김도형아이디` <br/> 이메일 |

---

## 주요 기능

### 내 과목 (`index.html`)
- 과목 폴더: 과목을 서류 폴더 모양으로 보여주고, 올린 자료 수만큼 폴더 사이로 종이가 비침
- 과목 관리: 과목 추가, 이름·색 수정, 삭제 (삭제 시 안의 자료와 시험 일정도 함께 정리)
- 색 선택: 색각 이상이 있어도 구분되는 6가지 폴더 색
- 정렬: 과목은 가나다순, 숫자는 크기순 (자료구조2 → 자료구조10)
- 최근 올린 자료 5개 목록

### 자료 올리기 (`material.html`)
- 파일 업로드: PDF, PPTX, DOCX, TXT 파일을 끌어다 놓거나 선택 (최대 30MB)
- 텍스트 추출: PDF는 pdf.js, PPTX·DOCX는 JSZip으로 파일 안의 XML을 풀어서 추출. PPTX는 발표자 노트까지 포함
- 스캔본 PDF 처리: 글자를 뽑을 수 없는 PDF는 파일 자체를 보내서 요약
- 텍스트 붙여넣기: 파일 없이 강의 노트를 직접 붙여넣어 저장
- 요약 노트 미리보기: 요약이 만들어지는 대로 실시간(스트리밍)으로 화면에 표시, 중간에 중지 가능

### 퀴즈 (`quiz.html`)
- 출제 범위 선택: 과목 안의 자료 중 원하는 것만 골라 출제
- 문제 구성: 객관식(최대 15) / OX(최대 10) / 주관식(최대 5) 문항 수와 난이도(기본 개념, 보통, 심화) 선택
- 형식 고정: 응답을 JSON 스키마로 받아 문항 형식을 강제하고, 형식이 틀린 문항은 걸러냄
- 시험지 + OMR 답안지: 문제는 시험지처럼, 답은 오른쪽 OMR 카드에 칠해지듯 표시
- 진행 표시: 몇 문항에 답했는지 표시, 문제 번호를 누르면 해당 문제로 이동

### 시험 일정 (`schedule.html`)
- 수험표: 다가오는 시험을 수험표 모양으로 보여주고 D-day 도장 표시
- 시험 범위: 시험마다 범위에 들어갈 자료 선택
- 복습 계획: 시험 전 최대 14일 동안 "요약 노트 읽기 → 퀴즈 풀기"를 자료별로 나눠 배치, 시험 전날은 전체 범위 퀴즈
- 완료 체크: 할 일을 체크하면 진행률 표시 (날짜가 바뀌어 계획이 다시 짜여도 체크 유지)
- 달력: 월별 달력에 시험 날짜와 복습 계획 날짜 표시

---

## 기술 스택

### 프론트엔드
- 마크업·스타일: HTML5, CSS3, Bootstrap 5.3, Bootstrap Icons
- 스크립트: JavaScript (프레임워크 없이 페이지별 모듈로 구성)
- 폰트: Hahmlet, IBM Plex Sans KR (Google Fonts)

### 라이브러리 (필요할 때만 불러옴)
- pdf.js: PDF 텍스트 추출
- JSZip: PPTX, DOCX 압축 해제
- marked: 요약 노트 마크다운 → HTML 변환
- DOMPurify: 변환된 HTML 소독 (XSS 방지)

### 외부 API
- Gemini API: 요약 노트 생성, 퀴즈 출제 (브라우저에서 REST로 직접 호출, 스트리밍 응답)

---

## 데이터 저장 구조

서버가 없으므로 모든 데이터는 브라우저 localStorage에 JSON으로 저장됩니다.

| 키 | 내용 |
|---|---|
| `cn_subjects` | 과목 목록 (이름, 색, 만든 날짜) |
| `cn_materials` | 자료 목록 (제목, 파일 형식, 쪽수, 요약 노트) |
| `cn_text_<자료 id>` | 자료 원문. 용량이 커서 자료마다 따로 저장 |
| `cn_exams` | 시험 일정 (과목, 날짜, 시간, 장소, 범위, 복습 완료 표시) |
| `cn_initialized` | 처음 방문 여부 (첫 방문 때만 예시 데이터 생성) |

- 저장 공간이 꽉 차면 원문을 먼저 저장하고, 성공했을 때만 목록에 추가해서 반쪽짜리 데이터가 남지 않게 함
- 과목을 지우면 그 과목의 자료·원문·시험 일정을 함께 정리

---

## 안정성 및 보안

### API 키 관리
- 키는 `js/config.js`에만 두고 `.gitignore`로 저장소에서 제외
- 저장소에는 빈 키가 든 `js/config.example.js`만 올림

### 요청 실패 대응
- 무료 키는 한도 초과(429)나 서버 과부하(503)가 잦아서, 잠시 기다렸다가 다시 보내고 그래도 안 되면 다른 모델로 넘어감
- 응답 형식이 깨지면 JSON을 최대한 복구해서 읽고, 안 되면 다시 요청

### XSS 방지
- 요약 노트는 DOMPurify로 소독한 뒤 화면에 표시
- 사용자가 입력한 과목명·자료 제목은 모두 이스케이프 처리

---

## 프로젝트 구조

```
light_note/
├── index.html             # 내 과목
├── material.html          # 자료 올리기
├── quiz.html              # 퀴즈 만들기 · 풀기
├── schedule.html          # 시험 일정
├── css/
│   ├── common.css         # 공통 스타일 (색, 글꼴, 네비게이션, 푸터)
│   ├── index.css
│   ├── material.css
│   ├── quiz.css
│   └── schedule.css
├── js/
│   ├── storage.js         # localStorage 저장 구조 (과목, 자료, 시험 일정)
│   ├── common.js          # 네비게이션, 푸터, 토스트 알림
│   ├── demo.js            # 첫 방문 예시 데이터
│   ├── parser.js          # PDF·PPTX·DOCX 텍스트 추출
│   ├── ai.js              # Gemini API 호출, 재시도, 요약·퀴즈 생성
│   ├── index.js
│   ├── material.js
│   ├── quiz.js
│   ├── schedule.js
│   └── config.example.js  # API 키 설정 예시
└── images/
    └── logo.png
```

---

## 실행 방법

서버 설치 없이 브라우저만 있으면 됩니다.

```bash
# 저장소 받기
git clone https://github.com/<아이디>/light_note.git
cd light_note

# API 키 설정 파일 만들기
cp js/config.example.js js/config.js
# js/config.js를 열어 GEMINI_API_KEY에 키 입력

# 실행 (macOS)
open index.html
```

Windows는 `index.html`을 더블클릭해서 열면 됩니다.

---

## 진행 상황

| 단계 | 내용 | 상태 |
|---|---|---|
| 중간 | 내 과목, 자료 올리기, 요약 노트 미리보기, 퀴즈 만들기·풀기, 시험 일정 | 완료 |
| 기말 | 요약 노트 보기 페이지, 과목 상세 페이지, 퀴즈 채점·결과, 오답노트, 학습 기록 | 진행 예정 |
