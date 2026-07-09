# 조합표 새로고침 & 내 의상(사진 분석) & 상품 추천 자리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 코디 조합표에 새로고침(다양한 조합 재생성)을 추가하고, 사진으로 실제 의상을 등록해 그 의상을 조합표에 우선 반영하는 기능(Claude 비전 분석)을 추가하고, 상품 추천은 준비중 자리로 남긴다.

**Architecture:** `OUTFIT_TABLE`을 카테고리별 배열로 확장해 무작위 재추첨이 가능하게 하고, `buildOutfitTable`이 `profile.wardrobe`(사용자가 등록한 실제 의상)를 카탈로그보다 먼저 확인한다. 사진 분석은 기존 `/api/recommend`와 동일한 "선택적 API 키" 패턴으로 새 엔드포인트 `/api/analyze-clothing`을 추가해 처리한다.

**Tech Stack:** 기존 스택(Vanilla JS, Express) 그대로. 신규 의존성 없음 — 이미지 리사이즈는 브라우저 `<canvas>`로 처리.

## Global Constraints

- "무한 생성"이 아니라 스타일별 옵션 풀(카테고리당 2개)에서 무작위 재추첨임을 코드/문구 모두에서 정직하게 유지
- `/api/analyze-clothing`은 `ANTHROPIC_API_KEY`가 없으면 400 + 안내 메시지를 반환하고, 앱의 나머지 기능에는 영향 없음 (기존 `/api/recommend`와 동일한 원칙)
- 의상 사진은 서버에 영구 저장하지 않음 — 분석 요청 때만 경유하고, 실제 저장은 클라이언트 `localStorage`(`profile.wardrobe`)에서만 이루어짐
- 상품 추천 섹션은 실제 이커머스 연동 없이 "준비중" 정적 안내로만 구현
- 새 npm 의존성 추가 금지

---

### Task 1: 조합표 배열화 + 새로고침 버튼

**Files:**
- Modify: `public/app.js` (`OUTFIT_TABLE`, `buildOutfitTable`, `renderOutfitTable`, `bindDashboardEvents`)
- Modify: `public/index.html` (`#outfitTableRefreshBtn` 추가)
- Modify: `public/style.css` (새로고침 버튼 스타일)

**Interfaces:**
- Produces: `pickRandom(array)` — `array: T[]` → `T`. Task 4가 그대로 재사용.
- Produces: `buildOutfitTable(profile, w)`가 반환하는 각 필드(`top`/`bottom`/`socks`/`shoes`)가 문자열이 아니라 `{ text: string, fromWardrobe: boolean }` 객체로 바뀜 — Task 4에서 `fromWardrobe`를 실제로 `true`로 채우기 전까지는 항상 `false`.

- [ ] **Step 1: `OUTFIT_TABLE`을 배열 기반으로 교체**

`public/app.js`의 `OUTFIT_TABLE` 상수 전체를 다음으로 교체:
```js
const OUTFIT_TABLE = {
  casual: {
    top: {
      hot: ["루즈핏 반팔 티셔츠 · 화이트", "그래픽 반팔 티셔츠 · 베이지"],
      mild: ["오버사이즈 스웨트셔츠 · 그레이", "체크 셔츠 · 레드"],
      cold: ["후드 집업 + 히트텍 이너 · 네이비", "무스탕 자켓 · 브라운"],
    },
    bottom: ["스트레이트 데님 팬츠 · 블루", "와이드 치노 팬츠 · 베이지"],
    socks: ["무지 크루 삭스 · 화이트", "스트라이프 삭스 · 네이비"],
    shoes: ["캔버스 스니커즈 · 화이트", "로우탑 스니커즈 · 블랙"],
  },
  minimal: {
    top: {
      hot: ["무지 반팔 티셔츠 · 오프화이트", "리브 니트 탱크 + 셔츠 · 그레이"],
      mild: ["라운드넥 니트 · 그레이", "심플 셋업 재킷 · 베이지"],
      cold: ["울 코트 + 터틀넥 · 차콜", "롱 니트 가디건 · 아이보리"],
    },
    bottom: ["테이퍼드 슬랙스 · 블랙", "스트레이트 슬랙스 · 그레이"],
    socks: ["발목 삭스 · 블랙", "무지 크루 삭스 · 화이트"],
    shoes: ["미니멀 로퍼 · 블랙", "화이트 스니커즈 · 화이트"],
  },
  street: {
    top: {
      hot: ["그래픽 반팔 티셔츠 · 블랙", "박시 반팔 · 화이트"],
      mild: ["오버사이즈 후드 + 워크자켓 · 카키", "빅사이즈 체크셔츠 · 레드"],
      cold: ["패딩 아우터 + 후드 레이어드 · 블랙", "롱패딩 + 그래픽 후드 · 카키"],
    },
    bottom: ["와이드 카고 팬츠 · 카키", "배기 데님 팬츠 · 블루"],
    socks: ["로고 크루 삭스 · 화이트", "레터링 삭스 · 블랙"],
    shoes: ["청키 스니커즈 · 화이트/블랙", "하이탑 스니커즈 · 블랙"],
  },
  feminine: {
    top: {
      hot: ["프릴 블라우스 · 라이트핑크", "레이스 반팔 탑 · 화이트"],
      mild: ["니트 가디건 + 슬립 원피스 · 아이보리", "퍼프소매 블라우스 · 라벤더"],
      cold: ["울 코트 + 니트 레이어드 · 베이지", "무스탕 코트 · 아이보리"],
    },
    bottom: ["플레어 스커트 · 라벤더", "롱 플리츠 스커트 · 베이지"],
    socks: ["레이스 삭스 · 화이트", "리본 삭스 · 아이보리"],
    shoes: ["메리제인 플랫 · 베이지", "리본 플랫슈즈 · 화이트"],
  },
  classic: {
    top: {
      hot: ["린넨 셔츠 · 라이트블루", "피케 카라 티셔츠 · 네이비"],
      mild: ["브이넥 니트 + 셔츠 레이어드 · 네이비", "트위드 재킷 · 그레이"],
      cold: ["울 코트 + 셔츠 · 그레이", "캐시미어 코트 · 차콜"],
    },
    bottom: ["슬랙스 · 차콜", "테일러드 팬츠 · 네이비"],
    socks: ["발목 삭스 · 네이비", "무지 삭스 · 그레이"],
    shoes: ["로퍼 · 브라운", "더비 슈즈 · 블랙"],
  },
  sporty: {
    top: {
      hot: ["드라이핏 반팔 티셔츠 · 블랙", "메시 반팔 저지 · 네온"],
      mild: ["트레이닝 재킷 · 네이비/화이트", "후디 · 그레이"],
      cold: ["플리스 집업 + 패딩 베스트 · 블랙", "롱패딩 스포츠 라인 · 네이비"],
    },
    bottom: ["조거 팬츠 · 블랙", "트랙 팬츠 · 네이비"],
    socks: ["스포츠 크루 삭스 · 화이트", "쿠셔닝 삭스 · 블랙"],
    shoes: ["러닝화 · 화이트/네온", "트레이닝화 · 블랙"],
  },
  vintage: {
    top: {
      hot: ["레트로 스트라이프 반팔 · 브라운톤", "하와이안 셔츠 · 그린"],
      mild: ["체크 니트 베스트 + 셔츠 · 머스타드", "코듀로이 셔츠 · 브라운"],
      cold: ["코듀로이 자켓 · 카멜", "빈티지 무스탕 · 브라운"],
    },
    bottom: ["와이드 코듀로이 팬츠 · 브라운", "스트레이트 진 · 워시블루"],
    socks: ["레트로 스트라이프 삭스 · 크림", "무지 울 삭스 · 브라운"],
    shoes: ["로퍼 또는 첼시부츠 · 브라운", "레트로 러닝화 · 크림"],
  },
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
```

- [ ] **Step 2: `buildOutfitTable` 수정 (배열에서 무작위 선택)**

`public/app.js`의 `buildOutfitTable` 함수를 다음으로 교체:
```js
function buildOutfitTable(profile, w) {
  const table = OUTFIT_TABLE[profile.styleType];
  if (!table) return null;

  const tempGroup = ["very_hot", "hot"].includes(w.tempBand)
    ? "hot"
    : ["cold", "very_cold"].includes(w.tempBand)
    ? "cold"
    : "mild";

  const top = { text: pickRandom(table.top[tempGroup]), fromWardrobe: false };
  const bottom = { text: pickRandom(table.bottom), fromWardrobe: false };
  const socks = { text: pickRandom(table.socks), fromWardrobe: false };
  let shoesText = pickRandom(table.shoes);
  if (w.isRainy) shoesText += " (방수 소재 추천)";
  if (w.isSnowy) shoesText += " (미끄럼 방지 밑창 추천)";
  const shoes = { text: shoesText, fromWardrobe: false };

  return { top, bottom, socks, shoes };
}
```

- [ ] **Step 3: `renderOutfitTable` 수정 (객체 필드 렌더링 + 새로고침 버튼 표시 제어)**

`public/app.js`의 `renderOutfitTable` 함수를 다음으로 교체:
```js
function renderOutfitTable(container, table) {
  const refreshBtn = el("outfitTableRefreshBtn");
  if (!table) {
    container.innerHTML = `<p class="empty-note">직접 입력한 스타일의 조합표는 아직 준비 중이에요.</p>`;
    if (refreshBtn) refreshBtn.hidden = true;
    return;
  }
  if (refreshBtn) refreshBtn.hidden = false;

  const row = (label, entry) => `
    <div class="outfit-table-row">
      <span class="outfit-table-label">${label}</span>
      <span>${entry.text}${entry.fromWardrobe ? ' <span class="wardrobe-badge">내 옷</span>' : ""}</span>
    </div>
  `;
  container.innerHTML = row("상의", table.top) + row("하의", table.bottom) + row("양말", table.socks) + row("신발", table.shoes);
}
```

- [ ] **Step 4: `public/index.html`에 새로고침 버튼 추가**

`public/index.html`의 다음 블록:
```html
          <div class="outfit-table-section">
            <h4>조합표</h4>
            <div id="outfitTableBody"></div>
          </div>
```
를 다음으로 교체:
```html
          <div class="outfit-table-section">
            <h4>조합표</h4>
            <div id="outfitTableBody"></div>
            <button type="button" id="outfitTableRefreshBtn" class="btn btn-secondary btn-outfit-refresh">🔄 다른 조합 보기</button>
          </div>
```

- [ ] **Step 5: `bindDashboardEvents`에 새로고침 클릭 핸들러 추가**

`public/app.js`의 `bindDashboardEvents` 함수에서 `el("evidenceModal").addEventListener(...)` 블록 바로 다음에 추가:
```js
  el("outfitTableRefreshBtn").addEventListener("click", () => {
    if (!lastWeather) return;
    const table = buildOutfitTable(profile, lastWeather);
    renderOutfitTable(el("outfitTableBody"), table);
  });
```

- [ ] **Step 6: `public/style.css`에 새로고침 버튼 스타일 추가**

파일 끝에 추가:
```css
.btn-outfit-refresh {
  width: 100%;
  margin-top: 10px;
  padding: 8px 12px;
  font-size: 0.82rem;
}
```

- [ ] **Step 7: 회귀 테스트 + 브라우저 확인**

Run: `npm test` — Expected: PASS

```bash
npm start
```
온보딩에서 스타일을 "캐주얼"로 선택해 완료 → "오늘의 코디" 카드에서 "🔄 다른 조합 보기"를 여러 번 눌러 조합표 내용이 바뀌는지 확인. 스타일을 "기타"로 직접 입력했을 때는 새로고침 버튼이 안 보이는지 확인.

- [ ] **Step 8: 커밋**

```bash
git add public/app.js public/index.html public/style.css
git commit -m "feat: add a refresh button that redraws the outfit combination table"
```

---

### Task 2: 서버 의상 분석 엔드포인트

**Files:**
- Modify: `server.js` (`/api/analyze-clothing` 엔드포인트, `express.json()` 크기 제한 상향)

**Interfaces:**
- Produces: `POST /api/analyze-clothing` — 요청 바디 `{ imageBase64: string, mediaType: string }` → 성공 시 `200 { category: "top"|"bottom"|"socks"|"shoes"|"outer", color: string, style: string }`, 키 없거나 입력 누락 시 `400 { error: string }`, Anthropic API 오류 시 `502 { error: string }`

- [ ] **Step 1: `express.json()` 크기 제한 상향**

`server.js`의 다음 줄:
```js
app.use(express.json());
```
를 다음으로 교체:
```js
app.use(express.json({ limit: '5mb' }));
```
(이미지 base64 전송을 위해 기본 100kb 제한을 늘림)

- [ ] **Step 2: `/api/analyze-clothing` 엔드포인트 추가**

`server.js`의 `app.listen(PORT, ...)` 호출 바로 위에 추가:
```js
/**
 * 사용자가 올린 의상 사진 한 장을 Claude에게 보내 카테고리·색상·스타일을
 * 분석해서 돌려주는 엔드포인트.
 *
 * - ANTHROPIC_API_KEY가 없으면 /api/recommend와 동일하게 안내 메시지만 반환하고
 *   앱의 나머지 기능에는 영향이 없습니다.
 * - 이미지는 서버에 저장하지 않고 분석 요청 때만 경유합니다.
 */
app.post('/api/analyze-clothing', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.includes('여기에-발급받은-키')) {
    return res.status(400).json({
      error:
        'ANTHROPIC_API_KEY가 설정되지 않았어요. 프로젝트 루트에 .env 파일을 만들고 API 키를 추가한 뒤 서버를 다시 시작해주세요.',
    });
  }

  const { imageBase64, mediaType } = req.body || {};
  if (!imageBase64 || !mediaType) {
    return res.status(400).json({ error: '분석할 이미지가 없어요.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: buildClothingAnalysisPrompt(),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
              { type: 'text', text: '이 옷 사진을 분석해서 JSON으로만 응답해주세요.' },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API 오류:', response.status, errText);
      return res.status(502).json({ error: '의상 분석 중 문제가 발생했어요. API 키와 모델명을 확인해주세요.' });
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    const parsed = parseClothingAnalysis(text);
    if (!parsed) {
      return res.status(502).json({ error: '사진에서 의상 정보를 읽지 못했어요. 다른 사진으로 시도해주세요.' });
    }

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버에서 예상치 못한 오류가 발생했어요.' });
  }
});

function buildClothingAnalysisPrompt() {
  return `당신은 옷 사진을 분석하는 패션 분류기입니다.
사용자가 올린 의상 사진 한 장을 보고 아래 JSON 형식으로만 응답하세요. 다른 설명, 마크다운, 코드블록 없이 순수 JSON 객체 하나만 출력하세요.

{"category": "top|bottom|socks|shoes|outer 중 하나", "color": "대표 색상(한글, 1~2단어)", "style": "제품 종류를 짧게 설명하는 한글 문구(예: 오버사이즈 후드 집업)"}

사진에 옷이 여러 개 보이면 가장 크게 보이는 하나만 분석하세요. 확신이 없어도 가장 가까운 카테고리를 고르세요.`;
}

function parseClothingAnalysis(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const obj = JSON.parse(jsonMatch[0]);
    const validCategories = ['top', 'bottom', 'socks', 'shoes', 'outer'];
    if (!validCategories.includes(obj.category)) return null;
    if (!obj.color || !obj.style) return null;
    return { category: obj.category, color: String(obj.color), style: String(obj.style) };
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: 서버가 정상적으로 뜨는지 확인**

```bash
npm start
```
Expected: 콘솔에 `✅ 서버가 실행되었어요: http://localhost:3000`가 뜨고 에러 없음(문법 오류가 있으면 여기서 바로 드러남).

- [ ] **Step 4: API 키 없을 때 400 응답 확인**

```bash
curl -s -X POST http://localhost:3000/api/analyze-clothing -H "Content-Type: application/json" -d "{\"imageBase64\":\"abc\",\"mediaType\":\"image/jpeg\"}"
```
Expected: `{"error":"ANTHROPIC_API_KEY가 설정되지 않았어요. ..."}` (이 프로젝트의 `.env`에 실제 키가 없다는 전제 — `.env` 파일이 없거나 `.env.example`의 플레이스홀더 그대로인 상태가 정상적인 로컬 개발 환경).

- [ ] **Step 5: 이미지/타입 누락 시 400 확인 (키가 설정된 경우를 가정한 방어 로직 점검)**

코드 리딩으로 확인: `imageBase64`/`mediaType` 체크가 API 키 체크보다 아래에 있으므로, 키가 없는 로컬 환경에서는 항상 키 없음 메시지가 먼저 반환된다 — 이건 의도된 동작이다(키 없는 게 더 근본적인 차단 요인이므로).

- [ ] **Step 6: 커밋**

```bash
git add server.js
git commit -m "feat: add a clothing photo analysis endpoint using the existing optional AI key"
```

---

### Task 3: 클라이언트 — 내 의상 모달 + 사진 업로드/분석/저장/삭제

**Files:**
- Modify: `public/index.html` (내 의상 관리 버튼 + 모달 마크업)
- Modify: `public/app.js` (이미지 리사이즈 헬퍼, 모달 열기/닫기, 업로드/분석/저장/삭제 로직)
- Modify: `public/style.css` (모달/목록/썸네일 스타일)

**Interfaces:**
- Consumes: `profile`(전역), `saveProfile(p)`, `lastWeather`(전역)
- Produces: `profile.wardrobe: Array<{ id, category, color, style, imageDataUrl }>` (localStorage에 저장됨). `renderWardrobeList()` — 인자 없음, `#wardrobeList`를 다시 그림. Task 4가 `profile.wardrobe`를 그대로 소비한다.

- [ ] **Step 1: `public/index.html`에 "내 의상 관리" 버튼 추가**

Task 1에서 추가한 다음 블록:
```html
          <div class="outfit-table-section">
            <h4>조합표</h4>
            <div id="outfitTableBody"></div>
            <button type="button" id="outfitTableRefreshBtn" class="btn btn-secondary btn-outfit-refresh">🔄 다른 조합 보기</button>
          </div>
```
를 다음으로 교체:
```html
          <div class="outfit-table-section">
            <h4>조합표</h4>
            <div id="outfitTableBody"></div>
            <button type="button" id="outfitTableRefreshBtn" class="btn btn-secondary btn-outfit-refresh">🔄 다른 조합 보기</button>
            <button type="button" id="openWardrobeBtn" class="btn btn-ghost btn-outfit-refresh">👕 내 의상 관리</button>
          </div>
```

- [ ] **Step 2: `public/index.html`에 내 의상 모달 마크업 추가**

`#evidenceModal` 블록 바로 다음에 추가:
```html
<div id="wardrobeModal" class="map-modal" hidden>
  <div class="map-modal-inner evidence-modal-inner">
    <button type="button" id="wardrobeModalClose" class="icon-btn map-modal-close" title="닫기">✕</button>
    <div class="wardrobe-modal-body">
      <h3>👕 내 의상</h3>
      <p class="coming-soon-note">사진을 올리면 AI가 카테고리·색상·스타일을 분석해서 등록해요. 등록된 의상은 조합표에 우선 사용돼요.</p>
      <input type="file" id="wardrobePhotoInput" accept="image/*" hidden />
      <button type="button" id="wardrobeAddBtn" class="btn btn-secondary">+ 사진으로 의상 추가</button>
      <p id="wardrobeStatus" class="wardrobe-status" hidden></p>
      <div id="wardrobeList" class="wardrobe-list"></div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: `public/app.js`에 카테고리 라벨 + 이미지 리사이즈 헬퍼 추가**

`buildOutfitTable` 함수 바로 위에 추가:
```js
const WARDROBE_CATEGORY_LABEL = { top: "상의", bottom: "하의", socks: "양말", shoes: "신발", outer: "아우터" };

function resizeImageToDataUrl(file, maxSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => reject(new Error("이미지를 불러오지 못했어요."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("파일을 읽지 못했어요."));
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 4: `public/app.js`에 모달 열기/닫기/목록/삭제/업로드 로직 추가**

같은 위치(Step 3에서 추가한 코드 바로 아래)에 추가:
```js
function renderWardrobeList() {
  const list = el("wardrobeList");
  const items = profile.wardrobe || [];
  if (items.length === 0) {
    list.innerHTML = `<p class="empty-note">아직 등록된 의상이 없어요.</p>`;
    return;
  }
  list.innerHTML = items
    .map(
      (item) => `
        <div class="wardrobe-item">
          <img src="${item.imageDataUrl}" alt="${item.style}" class="wardrobe-thumb" />
          <div class="wardrobe-item-info">
            <span class="wardrobe-item-category">${WARDROBE_CATEGORY_LABEL[item.category] || item.category}</span>
            <span class="wardrobe-item-desc">${item.style} · ${item.color}</span>
          </div>
          <button type="button" class="wardrobe-remove-btn" data-wardrobe-id="${item.id}" title="삭제">✕</button>
        </div>
      `
    )
    .join("");
}

function refreshOutfitTableIfPossible() {
  if (!lastWeather) return;
  const table = buildOutfitTable(profile, lastWeather);
  renderOutfitTable(el("outfitTableBody"), table);
}

async function handleWardrobePhotoSelected(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;

  const statusEl = el("wardrobeStatus");
  statusEl.hidden = false;
  statusEl.textContent = "사진을 분석하는 중…";

  try {
    const dataUrl = await resizeImageToDataUrl(file, 480);
    const base64 = dataUrl.split(",")[1];
    const mediaType = dataUrl.match(/^data:(.*?);base64/)[1];

    const res = await fetch("/api/analyze-clothing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mediaType }),
    });
    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = data.error || "분석에 실패했어요.";
      return;
    }

    const item = {
      id: `w${Date.now()}`,
      category: data.category,
      color: data.color,
      style: data.style,
      imageDataUrl: dataUrl,
    };
    profile.wardrobe = profile.wardrobe || [];
    profile.wardrobe.push(item);
    saveProfile(profile);

    statusEl.textContent = "의상을 등록했어요!";
    renderWardrobeList();
    refreshOutfitTableIfPossible();
  } catch (err) {
    statusEl.textContent = "사진을 처리하지 못했어요. 다시 시도해주세요.";
  }
}
```

- [ ] **Step 5: `bindDashboardEvents`에 내 의상 모달 이벤트 바인딩 추가**

Task 1의 Step 5에서 추가한 새로고침 핸들러 바로 다음에 추가:
```js
  el("openWardrobeBtn").addEventListener("click", () => {
    renderWardrobeList();
    el("wardrobeModal").hidden = false;
  });
  el("wardrobeModalClose").addEventListener("click", () => {
    el("wardrobeModal").hidden = true;
  });
  el("wardrobeModal").addEventListener("click", (e) => {
    if (e.target.id === "wardrobeModal") el("wardrobeModal").hidden = true;
  });
  el("wardrobeAddBtn").addEventListener("click", () => el("wardrobePhotoInput").click());
  el("wardrobePhotoInput").addEventListener("change", handleWardrobePhotoSelected);
  el("wardrobeList").addEventListener("click", (e) => {
    const btn = e.target.closest(".wardrobe-remove-btn");
    if (!btn) return;
    profile.wardrobe = (profile.wardrobe || []).filter((item) => item.id !== btn.dataset.wardrobeId);
    saveProfile(profile);
    renderWardrobeList();
    refreshOutfitTableIfPossible();
  });
```

- [ ] **Step 6: `public/style.css`에 모달/목록/썸네일 스타일 추가**

파일 끝에 추가:
```css
.wardrobe-modal-body h3 { margin: 0 0 8px; font-size: 1.05rem; }
.wardrobe-status {
  margin: 10px 0 0;
  font-size: 0.82rem;
  color: var(--ink-soft);
}
.wardrobe-list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wardrobe-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
}
.wardrobe-thumb {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  flex-shrink: 0;
}
.wardrobe-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.82rem;
}
.wardrobe-item-category { font-weight: 600; color: var(--ink-soft); }
.wardrobe-remove-btn {
  border: none;
  background: var(--surface-soft);
  color: var(--ink-faint);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
}
.wardrobe-remove-btn:hover { background: #ffe3e3; color: #c0392b; }
.wardrobe-badge {
  display: inline-block;
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 16%, white);
  color: var(--accent-ink);
  font-size: 0.68rem;
  font-weight: 600;
  vertical-align: middle;
}
```

- [ ] **Step 7: 브라우저에서 수동/Playwright 확인**

```bash
npm start
```
프로젝트 밖 scratchpad(`C:\Users\poksi\AppData\Local\Temp\claude\c--claude-weather-styling-app\95958a36-89a3-4693-8012-57876617faab\scratchpad\pw-debug`)의 Playwright로:
1. 대시보드에서 "👕 내 의상 관리" 클릭 → 모달이 열리는지
2. 파일 입력에 임의의 작은 테스트 이미지를 업로드했을 때(로컬에 `ANTHROPIC_API_KEY`가 없는 게 정상이므로) `#wardrobeStatus`에 서버가 반환한 안내 메시지("ANTHROPIC_API_KEY가 설정되지 않았어요…")가 표시되는지 확인
3. 콘솔에 `pageerror`가 없는지 확인

Expected: 위 3가지 모두 통과 (실제 이미지 분석 성공 경로는 API 키가 있는 배포 환경에서만 검증 가능하므로 이번 단계에서는 "키 없음" 경로까지 정상 동작하는 것으로 검증을 마친다).

- [ ] **Step 8: 커밋**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "feat: add wardrobe photo upload/analysis modal on the client"
```

---

### Task 4: 조합표에 내 의상 우선 반영

**Files:**
- Modify: `public/app.js` (`buildOutfitTable`)

**Interfaces:**
- Consumes: Task 1의 `pickRandom`, Task 3의 `profile.wardrobe`
- Produces: 변경 없음 (`buildOutfitTable(profile, w)` 시그니처 그대로, 반환값의 `fromWardrobe`가 실제로 `true`가 될 수 있게 됨)

- [ ] **Step 1: `buildOutfitTable`에 의상 조회 헬퍼 추가 및 반영**

`public/app.js`의 `buildOutfitTable` 함수(Task 1에서 만든 버전) 바로 위에 추가:
```js
function wardrobeOption(profile, category) {
  const items = (profile.wardrobe || []).filter((item) => item.category === category);
  if (items.length === 0) return null;
  const item = pickRandom(items);
  return { text: `${item.style} · ${item.color}`, fromWardrobe: true };
}
```

그리고 `buildOutfitTable` 함수 전체를 다음으로 교체:
```js
function buildOutfitTable(profile, w) {
  const table = OUTFIT_TABLE[profile.styleType];
  if (!table) return null;

  const tempGroup = ["very_hot", "hot"].includes(w.tempBand)
    ? "hot"
    : ["cold", "very_cold"].includes(w.tempBand)
    ? "cold"
    : "mild";

  const top = wardrobeOption(profile, "top") || { text: pickRandom(table.top[tempGroup]), fromWardrobe: false };
  const bottom = wardrobeOption(profile, "bottom") || { text: pickRandom(table.bottom), fromWardrobe: false };
  const socks = wardrobeOption(profile, "socks") || { text: pickRandom(table.socks), fromWardrobe: false };

  const shoesOption = wardrobeOption(profile, "shoes") || { text: pickRandom(table.shoes), fromWardrobe: false };
  let shoesText = shoesOption.text;
  if (w.isRainy) shoesText += " (방수 소재 추천)";
  if (w.isSnowy) shoesText += " (미끄럼 방지 밑창 추천)";
  const shoes = { text: shoesText, fromWardrobe: shoesOption.fromWardrobe };

  return { top, bottom, socks, shoes };
}
```

- [ ] **Step 2: Playwright로 내 의상 우선 반영 확인**

수동으로 `profile.wardrobe`를 채워서 확인한다 (사진 분석 없이 조합 로직만 검증):
```js
// 브라우저 콘솔 또는 Playwright page.evaluate에서
profile.wardrobe = [{ id: "w1", category: "top", color: "네이비", style: "니트 스웨터", imageDataUrl: "" }];
saveProfile(profile);
refreshOutfitTableIfPossible();
```
Expected: 조합표의 "상의" 항목이 "니트 스웨터 · 네이비 내 옷"으로 바뀌고, 다른 항목(하의/양말/신발)은 기존 카탈로그 값 유지.

- [ ] **Step 3: 회귀 테스트**

Run: `npm test` — Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add public/app.js
git commit -m "feat: prefer the user's own wardrobe items when building the outfit table"
```

---

### Task 5: 상품 추천 (준비중 자리)

**Files:**
- Modify: `public/index.html` (상품 추천 섹션 추가)
- Modify: `public/style.css` (섹션 스타일 — 기존 `.coming-soon-badge`/`.coming-soon-note` 재사용)

**Interfaces:**
- 없음 (정적 마크업)

- [ ] **Step 1: `public/index.html`에 상품 추천 섹션 추가**

`.style-reference-section` 블록 바로 다음에 추가:
```html
          <div class="outfit-table-section commerce-section">
            <h4>이 조합과 어울리는 상품 <span class="coming-soon-badge">준비중</span></h4>
            <p class="coming-soon-note">추후 실제 판매처와 연동해서 상의·하의·양말·신발 각각에 어울리는 상품을 보여드릴 예정이에요.</p>
          </div>
```

- [ ] **Step 2: 브라우저에서 확인**

```bash
npm start
```
"오늘의 코디" 카드 맨 아래에 "이 조합과 어울리는 상품 [준비중]" 섹션이 보이는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add public/index.html
git commit -m "feat: add a placeholder section for future product recommendations"
```

---

### Task 6: 최종 확인 및 GitHub 푸시

**Files:**
- Verify only

- [ ] **Step 1: 전체 자동 테스트 재실행**

Run: `npm test`
Expected: PASS — 기존 전체 테스트 통과.

- [ ] **Step 2: Playwright로 전체 플로우 확인**

프로젝트 밖 scratchpad Playwright로 다음을 확인한다:
1. 온보딩에서 스타일 선택 후 완료 → 조합표 새로고침 버튼을 3번 눌러 매번 값이 바뀌는지(적어도 한 번은 이전과 다른지) 확인
2. "내 의상 관리" 모달 열기/닫기, 파일 업로드 시 API 키 없음 안내가 뜨는지 확인
3. `profile.wardrobe`를 콘솔에서 채운 뒤 새로고침하면 "내 옷" 배지가 붙은 항목이 조합표에 나오는지 확인
4. "이 조합과 어울리는 상품 [준비중]" 섹션이 보이는지 확인
5. 콘솔에 `pageerror`가 없는지 확인

Expected: 위 5가지 모두 통과.

- [ ] **Step 3: GitHub 푸시**

```bash
git status
git push
```
Expected: `nothing to commit, working tree clean` 이후 `git push`가 fast-forward로 성공.

- [ ] **Step 4: 최종 커밋 로그 확인**

```bash
git log --oneline -10
```
Expected: Task 1~5의 커밋이 순서대로 보이고 원격과 동기화된 상태.
