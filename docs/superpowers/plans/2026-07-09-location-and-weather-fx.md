# 위치 서비스 개선 & 날씨 패널 애니메이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GPS 기반 현재 위치 지원 + 도시 검색 정확도 개선, 그리고 날씨 패널에 강수량/자외선 강도에 비례한 비·햇빛 애니메이션을 추가한다.

**Architecture:** 순수 계산 로직(강수량→비 강도, 자외선→햇빛 강도)을 DOM에 의존하지 않는 새 파일 `public/weather-fx.js`로 분리해 Node의 내장 테스트 러너로 검증하고, DOM 렌더링/이벤트 바인딩은 기존 `public/app.js`에서 그 로직을 소비한다. 위치 쪽은 기존 `selectedCity` 데이터 구조를 그대로 재사용해 GPS 결과도 도시 검색 결과와 동일하게 취급한다.

**Tech Stack:** Vanilla JS(브라우저 전역 스크립트, 모듈 시스템 없음), Express 정적 서빙, Node 내장 테스트 러너(`node --test`), 브라우저 Geolocation API, OpenStreetMap Nominatim(역지오코딩, 키 불필요), Open-Meteo Geocoding API(기존).

## Global Constraints

- Node >= 18 (기존 `package.json` engines 필드 유지, `node:test`/`node:assert` 내장 모듈 사용)
- 새 npm 의존성 추가 금지 (fetch, Geolocation API, node:test 모두 내장/브라우저 제공)
- `prefers-reduced-motion: reduce` 사용자에게는 애니메이션을 렌더링하지 않음
- 기존 `profile.region` 저장 형식 `{ name, latitude, longitude, country }` 을 그대로 유지 (GPS 결과도 동일 형식)
- 역지오코딩(Nominatim)은 API 키 없이 호출, 실패해도 좌표 자체는 유효하므로 이름만 "현재 위치"로 대체하고 흐름을 막지 않음
- 애니메이션은 `.weather-panel` 내부에만 그리며 `pointer-events: none`으로 기존 클릭/레이아웃에 영향 없음

---

### Task 1: Git 저장소 초기화

**Files:**
- Create: `.git/` (git init)
- Verify: `.gitignore` (기존 파일, `.env`/`node_modules` 제외 여부 확인)

**Interfaces:**
- Consumes: 없음
- Produces: 로컬 git 저장소, 이후 모든 태스크가 커밋 대상으로 사용

- [ ] **Step 1: 현재 .gitignore 확인**

Run: `cat .gitignore`
Expected output에 최소 다음 라인이 포함되어야 함:
```
node_modules/
.env
```
포함되어 있지 않으면 해당 라인을 추가한다.

- [ ] **Step 2: git 저장소 초기화**

```bash
git init
git add .
git status
```
Expected: `.env`, `node_modules/` 가 `git status` 출력에 나타나지 않아야 함 (나타나면 Step 1의 `.gitignore`를 고치고 `git rm -r --cached <path>` 후 다시 확인).

- [ ] **Step 3: 최초 커밋**

```bash
git commit -m "chore: initial commit of weather-styling-app"
```

---

### Task 2: 순수 로직 함수 — 비/자외선 강도 계산 (`public/weather-fx.js`)

**Files:**
- Create: `public/weather-fx.js`
- Create: `test/weather-fx.test.js`
- Modify: `package.json` (test 스크립트 추가)

**Interfaces:**
- Produces: `computeRainFx(w)` — `w: { isRainy: boolean, precipSum: number }` → `null | { tier: string, count: number, durMin: number, durMax: number, opMin: number, opMax: number, dark: boolean }`
- Produces: `computeSunFx(w)` — `w: { isRainy: boolean, isSnowy: boolean, uv: number }` → `null | { tier: string, pulseDuration: number, rays: boolean, rayDuration?: number, shimmer: boolean, shimmerLevel?: string, warm: boolean }`
- 두 함수는 브라우저 전역(`<script>` 태그, `window`에 그냥 선언)과 Node(`require`) 양쪽에서 동일하게 동작해야 함 — 파일 안에 `document`/`window` 참조를 두지 않는다 (Task 3에서 별도로 `renderWeatherFx`를 같은 파일에 추가할 때도 이 두 함수는 순수 함수로 유지).

- [ ] **Step 1: 테스트 파일 작성 (실패하는 테스트)**

`test/weather-fx.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { computeRainFx, computeSunFx } = require("../public/weather-fx.js");

test("computeRainFx returns null when not rainy", () => {
  assert.equal(computeRainFx({ isRainy: false, precipSum: 20 }), null);
});

test("computeRainFx buckets precipSum into drizzle/light/moderate/heavy tiers", () => {
  assert.equal(computeRainFx({ isRainy: true, precipSum: 0 }).tier, "drizzle");
  assert.equal(computeRainFx({ isRainy: true, precipSum: 3 }).tier, "light");
  assert.equal(computeRainFx({ isRainy: true, precipSum: 10 }).tier, "moderate");
  assert.equal(computeRainFx({ isRainy: true, precipSum: 25 }).tier, "heavy");
});

test("computeRainFx marks only the heavy tier as a dark overlay", () => {
  assert.equal(computeRainFx({ isRainy: true, precipSum: 25 }).dark, true);
  assert.equal(computeRainFx({ isRainy: true, precipSum: 3 }).dark, false);
});

test("computeSunFx returns null when rainy, snowy, or uv below 3", () => {
  assert.equal(computeSunFx({ isRainy: true, isSnowy: false, uv: 9 }), null);
  assert.equal(computeSunFx({ isRainy: false, isSnowy: true, uv: 9 }), null);
  assert.equal(computeSunFx({ isRainy: false, isSnowy: false, uv: 2 }), null);
});

test("computeSunFx buckets uv into moderate/high/veryHigh tiers", () => {
  assert.equal(computeSunFx({ isRainy: false, isSnowy: false, uv: 4 }).tier, "moderate");
  assert.equal(computeSunFx({ isRainy: false, isSnowy: false, uv: 7 }).tier, "high");
  assert.equal(computeSunFx({ isRainy: false, isSnowy: false, uv: 11 }).tier, "veryHigh");
});
```

- [ ] **Step 2: package.json에 test 스크립트 추가**

`package.json`의 `"scripts"` 블록을 다음으로 교체:
```json
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "node --test"
  },
```

- [ ] **Step 3: 테스트 실행하여 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '../public/weather-fx.js'`

- [ ] **Step 4: `public/weather-fx.js` 구현**

```js
// ============================================================
// 순수 로직: 강수량 → 비 애니메이션 강도, 자외선 → 햇빛 애니메이션 강도
// DOM에 의존하지 않아 Node 테스트 러너로 직접 검증 가능.
// ============================================================

const RAIN_TIERS = [
  { max: 1, tier: "drizzle", count: 15, durMin: 3.2, durMax: 4.5, opMin: 0.25, opMax: 0.4, dark: false },
  { max: 5, tier: "light", count: 30, durMin: 2.2, durMax: 3.2, opMin: 0.3, opMax: 0.5, dark: false },
  { max: 15, tier: "moderate", count: 55, durMin: 1.4, durMax: 2.2, opMin: 0.35, opMax: 0.55, dark: false },
  { max: Infinity, tier: "heavy", count: 90, durMin: 0.8, durMax: 1.4, opMin: 0.45, opMax: 0.65, dark: true },
];

function computeRainFx(w) {
  if (!w || !w.isRainy) return null;
  const sum = Math.max(0, w.precipSum || 0);
  return RAIN_TIERS.find((t) => sum <= t.max);
}

const SUN_TIERS = [
  { min: 3, max: 6, tier: "moderate", pulseDuration: 3.5, rays: false, shimmer: false, warm: false },
  {
    min: 6,
    max: 8,
    tier: "high",
    pulseDuration: 2.5,
    rays: true,
    rayDuration: 14,
    shimmer: true,
    shimmerLevel: "light",
    warm: false,
  },
  {
    min: 8,
    max: Infinity,
    tier: "veryHigh",
    pulseDuration: 1.8,
    rays: true,
    rayDuration: 8,
    shimmer: true,
    shimmerLevel: "heavy",
    warm: true,
  },
];

function computeSunFx(w) {
  if (!w || w.isRainy || w.isSnowy) return null;
  const uv = w.uv || 0;
  if (uv < 3) return null;
  return SUN_TIERS.find((t) => uv >= t.min && uv < t.max) || null;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { computeRainFx, computeSunFx };
}
```

- [ ] **Step 5: 테스트 재실행하여 통과 확인**

Run: `npm test`
Expected: PASS — 6개 테스트 모두 통과

- [ ] **Step 6: 커밋**

```bash
git add public/weather-fx.js test/weather-fx.test.js package.json
git commit -m "feat: add pure rain/uv intensity tier calculators"
```

---

### Task 3: 날씨 패널에 `.weather-fx` 레이어 연결 (DOM 렌더링)

**Files:**
- Modify: `public/weather-fx.js` (같은 파일에 `renderWeatherFx` 추가 — DOM 사용, Node 테스트 대상 아님)
- Modify: `public/app.js:388-415` (`renderWeatherPanel` 함수 — 템플릿에 `.weather-fx`/`.weather-content` 추가, `renderWeatherFx` 호출)
- Modify: `public/index.html` (weather-fx.js 스크립트 태그 추가)
- Modify: `public/style.css` (`.weather-panel`, `.weather-fx`, `.weather-content` 포지셔닝)

**Interfaces:**
- Consumes: Task 2의 `computeRainFx(w)`, `computeSunFx(w)`
- Produces: `renderWeatherFx(container, w)` — `container: HTMLElement`, `w: 날씨 분류 객체(classifyWeather 반환값)`. 내부에서 `container.innerHTML`을 비우고 강도에 맞는 자식 엘리먼트를 생성. 반환값 없음.

- [ ] **Step 1: `public/weather-fx.js` 끝부분에 `renderWeatherFx` 추가**

파일 맨 아래, `if (typeof module ...)` 블록 **바로 위**에 추가 (export 가드는 그대로 유지):
```js
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function renderWeatherFx(container, w) {
  if (!container) return;
  container.innerHTML = "";
  container.classList.remove("weather-fx--dark", "weather-fx--warm");

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const rain = computeRainFx(w);
  if (rain) {
    container.classList.toggle("weather-fx--dark", !!rain.dark);
    for (let i = 0; i < rain.count; i++) {
      const drop = document.createElement("span");
      drop.className = "raindrop";
      drop.style.setProperty("--left", `${Math.random() * 100}%`);
      drop.style.setProperty("--duration", `${randomBetween(rain.durMin, rain.durMax)}s`);
      drop.style.setProperty("--delay", `${(Math.random() * -rain.durMax).toFixed(2)}s`);
      drop.style.setProperty("--opacity", randomBetween(rain.opMin, rain.opMax).toFixed(2));
      container.appendChild(drop);
    }
  }

  const sun = computeSunFx(w);
  if (sun) {
    const glow = document.createElement("div");
    glow.className = "sun-glow";
    glow.style.setProperty("--pulse-duration", `${sun.pulseDuration}s`);
    container.appendChild(glow);

    if (sun.rays) {
      const rays = document.createElement("div");
      rays.className = "sun-rays";
      rays.style.setProperty("--rotate-duration", `${sun.rayDuration}s`);
      container.appendChild(rays);
    }

    if (sun.shimmer) {
      const shimmer = document.createElement("div");
      shimmer.className = `heat-shimmer heat-shimmer--${sun.shimmerLevel}`;
      container.appendChild(shimmer);
    }

    container.classList.toggle("weather-fx--warm", !!sun.warm);
  }
}
```
그리고 export 가드를 다음으로 교체 (렌더 함수는 DOM 전용이라 export하지 않음, 계산 함수만 export):
```js
if (typeof module !== "undefined" && module.exports) {
  module.exports = { computeRainFx, computeSunFx };
}
```
(이 줄은 변경 없음 — `renderWeatherFx`는 브라우저 전역 스코프에만 존재)

- [ ] **Step 2: `public/index.html`에 스크립트 태그 추가**

`public/index.html`의 `<script src="app.js"></script>` 줄(현재 202번째 줄) **바로 위**에 추가:
```html
<script src="weather-fx.js"></script>
```

- [ ] **Step 3: `public/app.js`의 `renderWeatherPanel` 수정**

`public/app.js:388-415`의 `renderWeatherPanel` 함수 전체를 다음으로 교체:
```js
function renderWeatherPanel(w) {
  applyTheme(w.theme);

  const today = new Date();
  const dateStr = today.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

  el("weatherPanel").innerHTML = `
    <div class="weather-fx" id="weatherFx"></div>
    <div class="weather-content">
      <div class="weather-head">
        <div>
          <p class="weather-location">📍 ${profile.region.name}</p>
          <p class="weather-date">${dateStr}</p>
        </div>
        <span class="weather-condition">${TEMP_BAND_LABEL[w.tempBand]}${w.isRainy ? " · 비" : ""}${w.isSnowy ? " · 눈" : ""}</span>
      </div>

      <div class="weather-temp">
        <span class="now">${Math.round(w.tempNow)}°</span>
        <span class="range">${Math.round(w.tempMin)}° / ${Math.round(w.tempMax)}°</span>
      </div>

      <div class="gauge-row">
        ${gaugeHtml("습도", `${Math.round(w.humidity)}%`, w.humidity)}
        ${gaugeHtml("바람", `${Math.round(w.wind)}`, Math.min(100, w.wind * 2.5))}
        ${gaugeHtml("강수", `${Math.round(w.precipProb)}%`, w.precipProb)}
        ${gaugeHtml("자외선", `${Math.round(w.uv)}`, Math.min(100, w.uv * 9))}
      </div>
    </div>
  `;

  renderWeatherFx(el("weatherFx"), w);
}
```

- [ ] **Step 4: `public/style.css`에 포지셔닝 규칙 추가**

`public/style.css`의 `.weather-panel { ... }` 블록(현재 310-318번째 줄)을 다음으로 교체:
```css
.weather-panel {
  position: relative;
  overflow: hidden;
  margin-top: 10px;
  border-radius: var(--radius-lg);
  padding: 22px;
  background: linear-gradient(160deg, var(--ink) 0%, color-mix(in srgb, var(--ink) 82%, var(--accent)) 100%);
  color: white;
  box-shadow: var(--shadow-card);
  transition: background 0.5s ease;
}

.weather-fx {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  transition: background 0.6s ease;
}
.weather-fx.weather-fx--dark { background: rgba(0, 0, 0, 0.18); }
.weather-fx.weather-fx--warm { background: radial-gradient(circle at 80% 15%, rgba(255, 170, 60, 0.22), transparent 60%); }

.weather-content { position: relative; z-index: 1; }
```

- [ ] **Step 5: 브라우저에서 수동 확인**

```bash
npm start
```
브라우저에서 `http://localhost:3000` 접속 → 온보딩을 마치고 대시보드 진입 → 개발자 도구 콘솔에서 다음을 실행:
```js
renderWeatherFx(document.getElementById("weatherFx"), { isRainy: true, precipSum: 25, isSnowy: false, uv: 9 });
```
Expected: 콘솔 오류 없이 실행되고, 개발자 도구 Elements 패널에서 `#weatherFx` 안에 `.raindrop` span 90개와 `.sun-glow`/`.sun-rays`/`.heat-shimmer` 엘리먼트가 생성되어 있어야 함 (아직 CSS 애니메이션은 Task 4/5에서 추가하므로 화면에는 안 보여도 정상).

- [ ] **Step 6: 커밋**

```bash
git add public/weather-fx.js public/app.js public/index.html public/style.css
git commit -m "feat: wire weather-fx layer into weather panel rendering"
```

---

### Task 4: 비 애니메이션 CSS

**Files:**
- Modify: `public/style.css` (파일 끝에 추가)

**Interfaces:**
- Consumes: Task 3에서 생성되는 `.raindrop` 엘리먼트와 그 위에 설정된 CSS 커스텀 프로퍼티 `--left`, `--duration`, `--delay`, `--opacity`

- [ ] **Step 1: `public/style.css` 끝에 raindrop 애니메이션 추가**

```css
/* ============================================================
   날씨 패널 FX — 비
   ============================================================ */
.raindrop {
  position: absolute;
  left: var(--left);
  top: -10%;
  width: 1.5px;
  height: 14%;
  background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.85));
  opacity: var(--opacity);
  transform: rotate(8deg);
  animation: rainfall var(--duration) linear var(--delay) infinite;
}

@keyframes rainfall {
  from { top: -10%; }
  to { top: 110%; }
}
```

- [ ] **Step 2: 브라우저에서 수동 확인**

`npm start` 후 대시보드에서 개발자 도구 콘솔에 다음을 각각 실행하며 빗줄기 개수/속도가 눈에 띄게 달라지는지 확인:
```js
renderWeatherFx(document.getElementById("weatherFx"), { isRainy: true, precipSum: 0.5, isSnowy: false, uv: 0 }); // 이슬비
renderWeatherFx(document.getElementById("weatherFx"), { isRainy: true, precipSum: 25, isSnowy: false, uv: 0 });  // 강한 비 + 암전
```
Expected: 이슬비는 가늘고 느린 빗줄기 15개, 강한 비는 굵고 빠른 빗줄기 90개 + 패널이 살짝 어두워짐.

- [ ] **Step 3: 커밋**

```bash
git add public/style.css
git commit -m "feat: add rain intensity animation to weather panel"
```

---

### Task 5: 햇빛·자외선 애니메이션 CSS

**Files:**
- Modify: `public/style.css` (파일 끝에 추가)

**Interfaces:**
- Consumes: Task 3에서 생성되는 `.sun-glow`, `.sun-rays`, `.heat-shimmer` 엘리먼트와 CSS 커스텀 프로퍼티 `--pulse-duration`, `--rotate-duration`

- [ ] **Step 1: `public/style.css` 끝에 sun/heat-shimmer 애니메이션 추가**

```css
/* ============================================================
   날씨 패널 FX — 햇빛 · 자외선
   ============================================================ */
.sun-glow {
  position: absolute;
  top: 12%;
  right: 10%;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 214, 120, 0.55), transparent 70%);
  animation: sunPulse var(--pulse-duration) ease-in-out infinite;
}

@keyframes sunPulse {
  0%, 100% { transform: scale(0.9); opacity: 0.7; }
  50% { transform: scale(1.15); opacity: 1; }
}

.sun-rays {
  position: absolute;
  top: 12%;
  right: 10%;
  width: 90px;
  height: 90px;
  background: conic-gradient(from 0deg, transparent 0 10%, rgba(255, 214, 120, 0.35) 12%, transparent 14% 100%);
  animation: sunRotate var(--rotate-duration) linear infinite;
}

@keyframes sunRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.heat-shimmer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 40%;
  background: repeating-linear-gradient(to right, transparent 0, rgba(255, 255, 255, 0.08) 8px, transparent 16px);
  animation: shimmer 2.4s ease-in-out infinite;
}
.heat-shimmer--light { opacity: 0.35; animation-duration: 3s; }
.heat-shimmer--heavy { opacity: 0.55; animation-duration: 1.6s; }

@keyframes shimmer {
  0%, 100% { transform: translateX(0) skewX(0deg); }
  50% { transform: translateX(6px) skewX(1.5deg); }
}

@media (prefers-reduced-motion: reduce) {
  .raindrop, .sun-glow, .sun-rays, .heat-shimmer {
    animation: none !important;
  }
}
```

- [ ] **Step 2: 브라우저에서 수동 확인**

개발자 도구 콘솔에서:
```js
renderWeatherFx(document.getElementById("weatherFx"), { isRainy: false, precipSum: 0, isSnowy: false, uv: 4 });  // 보통
renderWeatherFx(document.getElementById("weatherFx"), { isRainy: false, precipSum: 0, isSnowy: false, uv: 11 }); // 매우높음
```
Expected: uv 4는 은은한 글로우 pulse만, uv 11은 빠른 회전 햇살 + 진한 아지랑이 + 따뜻한 색 오버레이가 보여야 함. OS 설정에서 "동작 줄이기(reduce motion)"를 켠 상태로 새로고침하면 애니메이션이 전혀 재생되지 않아야 함.

- [ ] **Step 3: 커밋**

```bash
git add public/style.css
git commit -m "feat: add sun/UV intensity animation to weather panel"
```

---

### Task 6: 도시 검색 결과 정확도 개선

**Files:**
- Modify: `public/app.js:158-199` (`handleCitySearch` 함수)

**Interfaces:**
- Consumes: 없음 (기존 Open-Meteo Geocoding API 응답 필드 `admin1`, `admin2` 사용)
- Produces: 변경 없음 (기존 `selectedCity` 형식 유지)

- [ ] **Step 1: `handleCitySearch` 수정**

`public/app.js:158-199`의 `handleCitySearch` 함수 전체를 다음으로 교체:
```js
async function handleCitySearch() {
  const query = el("citySearchInput").value.trim();
  const resultsEl = el("cityResults");
  resultsEl.innerHTML = "";
  if (!query) return;

  resultsEl.innerHTML = `<li class="empty-note">검색 중…</li>`;

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query
    )}&count=10&language=ko&format=json`;
    const res = await fetch(url);
    const data = await res.json();

    resultsEl.innerHTML = "";
    if (!data.results || data.results.length === 0) {
      resultsEl.innerHTML = `<li class="empty-note">검색 결과가 없어요. 다른 이름으로 시도해보세요.</li>`;
      return;
    }

    data.results.forEach((r) => {
      const li = document.createElement("li");
      const adminParts = [r.admin2, r.admin1].filter(Boolean).join(" · ");
      const region = adminParts ? `${adminParts} · ` : "";
      li.textContent = `${r.name} (${region}${r.country || ""})`;
      li.addEventListener("click", () => {
        selectedCity = {
          name: r.name,
          latitude: r.latitude,
          longitude: r.longitude,
          country: r.country,
        };
        showSelectedCity(selectedCity);
        resultsEl.innerHTML = "";
        el("toStep2").disabled = false;
      });
      resultsEl.appendChild(li);
    });
  } catch (err) {
    resultsEl.innerHTML = `<li class="empty-note">지역 검색 중 오류가 발생했어요. 인터넷 연결을 확인해주세요.</li>`;
  }
}
```

- [ ] **Step 2: 브라우저에서 수동 확인**

`npm start` 후 온보딩 1단계에서 "서울"로 검색 → 결과 목록에 `구/군 · 시/도 · 국가` 형태로 최대 10개까지 표시되는지 확인 (예: "강남구 · 서울특별시 · South Korea" 유사 형태, 실제 표기는 Open-Meteo 응답에 따라 다를 수 있음).

- [ ] **Step 3: 커밋**

```bash
git add public/app.js
git commit -m "feat: show more disambiguating detail in city search results"
```

---

### Task 7: GPS 기반 현재 위치 사용

**Files:**
- Modify: `public/index.html` (지역 검색 필드 아래 버튼/에러 박스 추가)
- Modify: `public/app.js` (`bindOnboardingEvents`에 이벤트 바인딩 추가, `handleUseMyLocation`/`showLocationError`/`reverseGeocode` 함수 추가)
- Modify: `public/style.css` (버튼/에러 박스 스타일)

**Interfaces:**
- Consumes: 전역 `selectedCity` 변수, `showSelectedCity(city)` 함수 (기존)
- Produces: 변경 없음 — GPS 결과도 `selectedCity = { name, latitude, longitude, country }` 형식으로 저장되어 이후 로직(프로필 저장, 날씨 조회)은 그대로 재사용

- [ ] **Step 1: `public/index.html` 수정**

`public/index.html:67-69`의 다음 블록:
```html
          <ul id="cityResults" class="city-results"></ul>
          <div id="selectedCity" class="selected-city" hidden></div>
```
을 다음으로 교체:
```html
          <button type="button" id="useMyLocationBtn" class="btn btn-ghost btn-location">📍 현재 위치 사용</button>
          <ul id="cityResults" class="city-results"></ul>
          <div id="selectedCity" class="selected-city" hidden></div>
          <div id="locationError" class="location-error" hidden></div>
```

- [ ] **Step 2: `public/style.css`에 버튼/에러 스타일 추가**

`.search-row { display: flex; gap: 8px; }` 블록(현재 227번째 줄) 바로 아래에 추가:
```css
.btn-location {
  width: 100%;
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--surface-soft);
  border: 1px solid var(--line);
}
.btn-location:hover:not(:disabled) { background: var(--line); }

.location-error {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: #ffe9e9;
  color: #a94442;
  font-size: 0.82rem;
}
```

- [ ] **Step 3: `public/app.js`의 `bindOnboardingEvents`에 이벤트 바인딩 추가**

`public/app.js:140`의 다음 줄:
```js
  el("citySearchBtn").addEventListener("click", handleCitySearch);
```
바로 아래에 추가:
```js
  el("useMyLocationBtn").addEventListener("click", handleUseMyLocation);
```

- [ ] **Step 4: `public/app.js`에 위치 조회 함수 추가**

`handleCitySearch` 함수(Task 6에서 수정된 버전) 바로 아래에 추가:
```js
async function handleUseMyLocation() {
  const btn = el("useMyLocationBtn");
  el("locationError").hidden = true;

  if (!("geolocation" in navigator)) {
    showLocationError("이 브라우저는 위치 서비스를 지원하지 않아요. 도시를 검색해주세요.");
    return;
  }

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "위치를 확인하는 중…";

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      const name = await reverseGeocode(latitude, longitude);
      selectedCity = { name, latitude, longitude, country: "" };
      showSelectedCity(selectedCity);
      el("cityResults").innerHTML = "";
      el("toStep2").disabled = false;
      btn.disabled = false;
      btn.textContent = originalText;
    },
    (err) => {
      btn.disabled = false;
      btn.textContent = originalText;
      if (err.code === err.PERMISSION_DENIED) {
        showLocationError("위치 권한이 거부됐어요. 브라우저 설정에서 허용하거나 도시를 검색해주세요.");
      } else {
        showLocationError("현재 위치를 확인할 수 없어요. 다시 시도하거나 도시를 검색해주세요.");
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
  );
}

function showLocationError(message) {
  const box = el("locationError");
  box.hidden = false;
  box.textContent = message;
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "ko" } });
    if (!res.ok) throw new Error("reverse geocode failed");
    const data = await res.json();
    const addr = data.address || {};
    const place = addr.city || addr.town || addr.village || addr.county || "현재 위치";
    return addr.state ? `${place} · ${addr.state}` : place;
  } catch {
    return "현재 위치";
  }
}
```

- [ ] **Step 5: 브라우저에서 수동 확인**

`npm start` 후 온보딩 1단계에서 "📍 현재 위치 사용" 클릭 → 브라우저 위치 권한 팝업 허용 → 버튼이 "위치를 확인하는 중…"으로 바뀌었다가 "선택된 지역: …" 박스가 나타나고 "다음" 버튼이 활성화되는지 확인. 브라우저 설정에서 위치 권한을 차단한 상태로도 시도해 에러 메시지가 뜨고 도시 검색은 여전히 동작하는지 확인.

- [ ] **Step 6: 커밋**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "feat: add GPS-based current location option"
```

---

### Task 8: 최종 통합 확인 및 GitHub 배포

**Files:**
- Verify only (변경 파일 없음)

**Interfaces:**
- Consumes: Task 1~7의 모든 결과물

- [ ] **Step 1: 전체 자동 테스트 재실행**

```bash
npm test
```
Expected: PASS — Task 2에서 작성한 6개 테스트 모두 통과.

- [ ] **Step 2: 서버 기동 및 전체 플로우 수동 확인**

```bash
npm start
```
브라우저에서 `http://localhost:3000` 접속:
1. 온보딩 1단계에서 도시 검색 또는 "📍 현재 위치 사용"으로 지역 선택 → 2~4단계 진행 → "오늘의 코디 보기" 클릭
2. 대시보드에서 실제 날씨에 따라 카드가 정상 렌더링되는지 확인 (비/맑음 여부에 따라 애니메이션이 자동으로 보이거나 안 보이는 것은 정상 — 실제 날씨 데이터 기준이므로)
3. 개발자 도구 콘솔에 오류가 없는지 확인

- [ ] **Step 3: GitHub 원격 저장소 연결 및 푸시**

```bash
git remote add origin https://github.com/poksil1121-cell/COORDI.git
git branch -M main
git push -u origin main
```
Expected: 푸시 성공. 실패 시(예: 원격에 이미 커밋이 있어 non-fast-forward 오류) 강제 푸시하지 말고 사용자에게 상황을 보고한다.

- [ ] **Step 4: 최종 상태 확인**

```bash
git status
git log --oneline -10
```
Expected: working tree clean, 커밋 히스토리에 Task 1~7의 커밋이 순서대로 보임.
