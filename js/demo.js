/* =========================================================
 * demo.js — 처음 방문했을 때 넣는 예시 데이터
 * 처음 열었을 때 화면이 비어 있지 않도록 과목 2개와 자료 1개를 넣는다.
 * ========================================================= */

const DEMO_TEXT = `[슬라이드 1]
5주차 CSS 박스 모델과 Flexbox
웹프로그래밍

[슬라이드 2]
박스 모델 (Box Model)
모든 HTML 요소는 사각형 박스로 그려진다.
박스는 안쪽부터 content, padding, border, margin 네 영역으로 이루어진다.
padding은 내용과 테두리 사이의 안쪽 여백, margin은 다른 요소와의 바깥 여백이다.

[슬라이드 3]
box-sizing
기본값 content-box: width는 content 영역의 너비만 뜻한다. padding과 border는 width에 더해진다.
border-box: width가 padding과 border까지 포함한 전체 너비가 된다.
예) width: 200px; padding: 20px; border: 5px; → content-box면 실제 너비 250px, border-box면 200px
(노트) 실무에서는 * { box-sizing: border-box; }를 많이 쓴다.

[슬라이드 4]
margin 상쇄 (margin collapsing)
세로로 인접한 두 블록 요소의 margin은 더해지지 않고 큰 값 하나만 적용된다.
예) 위 요소 margin-bottom: 30px, 아래 요소 margin-top: 20px → 간격은 30px
가로 margin과 flex 아이템에서는 상쇄가 일어나지 않는다.

[슬라이드 5]
display 속성
block: 한 줄을 다 차지하고 width/height 지정 가능 (div, p, h1)
inline: 내용만큼만 차지하고 width/height 무시 (span, a)
inline-block: 줄 안에 놓이지만 width/height 지정 가능

[슬라이드 6]
Flexbox
부모에 display: flex를 주면 자식들이 flex 아이템이 된다.
주축(main axis)은 flex-direction으로 정한다. 기본값 row(가로).
justify-content: 주축 방향 정렬 (flex-start, center, space-between, space-around)
align-items: 교차축 방향 정렬 (stretch가 기본값, center, flex-start)

[슬라이드 7]
flex 아이템 크기
flex-grow: 남는 공간을 나눠 가지는 비율 (기본 0)
flex-shrink: 공간이 부족할 때 줄어드는 비율 (기본 1)
flex-basis: 늘거나 줄기 전의 기본 크기
flex: 1은 flex-grow: 1, flex-shrink: 1, flex-basis: 0%의 축약형
flex-wrap: wrap을 주면 아이템이 넘칠 때 다음 줄로 넘어간다.`;

const DEMO_SUMMARY = `## 한 줄 요약
CSS 박스 모델의 네 영역과 box-sizing, margin 상쇄, display 속성, 그리고 Flexbox로 요소를 배치하는 방법을 다룬다.

## 핵심 개념
- **박스 모델**: 모든 요소는 content, padding, border, margin 네 겹의 사각형 박스로 그려진다. padding은 안쪽 여백, margin은 바깥 여백이다.
- **box-sizing**: width가 어디까지를 뜻하는지 정한다. 기본값 content-box는 content만, border-box는 padding과 border까지 포함한다.
- **margin 상쇄**: 세로로 붙은 블록 요소의 margin은 더해지지 않고 큰 값 하나만 적용된다.
- **Flexbox**: 부모에 \`display: flex\`를 주면 자식을 한 축을 따라 정렬·배분할 수 있다.

## 주제별 정리
### 박스 모델과 box-sizing (슬라이드 2~3)
- 안쪽부터 content → padding → border → margin 순서.
- \`width: 200px; padding: 20px; border: 5px\`일 때 content-box면 실제 너비 250px, border-box면 200px.
- 실무에서는 \`* { box-sizing: border-box; }\`를 많이 쓴다.

### margin 상쇄 (슬라이드 4)
- 위 요소 margin-bottom 30px + 아래 요소 margin-top 20px → 실제 간격 30px.
- 가로 margin, flex 아이템에서는 상쇄가 일어나지 않는다.

### display 속성 (슬라이드 5)
| 값 | 줄 차지 | width/height |
|---|---|---|
| block | 한 줄 전체 | 지정 가능 |
| inline | 내용만큼 | 무시됨 |
| inline-block | 내용만큼 | 지정 가능 |

### Flexbox (슬라이드 6~7)
- 주축은 \`flex-direction\`으로 정하고 기본값은 row(가로).
- \`justify-content\`는 주축, \`align-items\`는 교차축 정렬. align-items 기본값은 stretch.
- \`flex: 1\` = flex-grow 1, flex-shrink 1, flex-basis 0%.
- \`flex-wrap: wrap\`이면 넘치는 아이템이 다음 줄로 간다.

## 시험 포인트
1. 박스 모델 네 영역의 순서
2. content-box와 border-box에서 실제 너비 계산
3. margin 상쇄가 일어나는 조건과 결과 값
4. inline 요소에 width를 주면 어떻게 되는지
5. justify-content와 align-items가 각각 어느 축을 정렬하는지
6. \`flex: 1\` 축약형의 의미
7. flex-shrink의 기본값

## 용어 정리
| 용어 | 뜻 |
|---|---|
| padding | content와 border 사이의 안쪽 여백 |
| margin | 요소 바깥의 여백 |
| 주축 (main axis) | flex-direction 방향의 축 |
| 교차축 (cross axis) | 주축과 수직인 축 |
| flex-basis | 늘거나 줄기 전의 기본 크기 |`;

function seedDemoIfFirstRun() {
  try {
    if (localStorage.getItem(INIT_KEY)) return;
    localStorage.setItem(INIT_KEY, '1');
  } catch (e) {
    return;
  }
  const web = Subjects.add('웹프로그래밍', SUBJECT_COLORS[0]);
  Subjects.add('자료구조', SUBJECT_COLORS[1]);

  const material = Materials.add({
    subjectId: web.id,
    title: '5주차 CSS 박스 모델과 Flexbox (예시)',
    fileName: '5주차_CSS.pptx',
    fileType: 'pptx',
    pages: 7,
    summary: DEMO_SUMMARY
  }, DEMO_TEXT);
  if (!material) return;

  /* 시험 일정 예시: 12일 뒤 중간고사 */
  Exams.add({
    subjectId: web.id,
    name: '중간고사',
    date: addDaysKey(todayKey(), 12),
    time: '14:00',
    place: '정보과학관 21304'
  });
}
