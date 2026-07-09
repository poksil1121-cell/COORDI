# 지도 통합 & 도시 검색 정확도 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 도시 검색이 "안양"→안양시, "광주"→경기도 광주시/광주광역시처럼 실제 도시를 정확히 찾아내게 하고, 선택된 위치를 미리보기 지도로 보여주며 그 지도를 클릭하면 다른 지역 날씨를 조회하고 지역을 바꿀 수 있는 탐색 지도를 연다.

**Architecture:** 검색 쪽은 순수 함수(`buildSearchQueries`, `mergeGeocodingResults`)를 새 파일 `public/geocode-search.js`로 분리해 Node 테스트로 검증한다. 지도 쪽은 Leaflet.js 조작만 담당하는 `public/map.js` 모듈을 추가해 `createMiniMap`/`openMapExplorer`/`closeMapExplorer`를 전역으로 제공하고, 날씨 조회·저장 로직은 `app.js`가 콜백으로 넘긴다.

**Tech Stack:** Vanilla JS(전역 스크립트), Node 내장 테스트 러너, Leaflet.js 1.9.4 + OpenStreetMap 타일(CDN, 키 불필요), 기존 Open-Meteo Geocoding/Forecast API.

## Global Constraints

- 새 npm 의존성 추가 금지 (Leaflet은 CDN `<script>`/`<link>`로만 로드)
- OpenStreetMap 타일의 저작자 표시(attribution)는 항상 유지
- 검색어가 이미 행정구역 접미사(시/군/구/광역시/특별시/특별자치시/특별자치도)로 끝나면 접미사를 추가로 붙이지 않음 (중복 검색 방지)
- 미리보기 지도는 항상 `profile.region` 또는 `selectedCity`의 좌표를 그대로 사용 — 별도로 좌표를 다시 조회하지 않음
- 미리보기 지도는 드래그/줌/더블클릭줌 비활성화(정적 미리보기), 탐색 지도는 자유롭게 확대/이동 가능
- 지도 관련 코드(`map.js`)는 날씨 조회 로직을 직접 호출하지 않고 콜백으로만 받음 (관심사 분리)

---

### Task 1: 검색 정확도 개선 — 접미사 확장 검색 + 인구 기반 정렬

**Files:**
- Create: `public/geocode-search.js`
- Create: `test/geocode-search.test.js`
- Modify: `public/app.js:170-212` (`handleCitySearch` 함수)
- Modify: `public/index.html` (스크립트 태그 추가)

**Interfaces:**
- Produces: `buildSearchQueries(query)` — `query: string` → `string[]` (원본 쿼리 + 접미사 변형들, 이미 접미사로 끝나면 원본만)
- Produces: `mergeGeocodingResults(resultLists)` — `resultLists: Array<Array<GeocodingResult>>` → `GeocodingResult[]` (중복 제거 후 `population` 내림차순 정렬). `GeocodingResult`는 Open-Meteo 응답의 `{ name, admin1, admin2, latitude, longitude, population, country }` 형태.

- [ ] **Step 1: 테스트 작성 (실패하는 테스트)**

`test/geocode-search.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSearchQueries, mergeGeocodingResults } = require("../public/geocode-search.js");

test("buildSearchQueries appends admin suffixes when the query has none", () => {
  const variants = buildSearchQueries("안양");
  assert.ok(variants.includes("안양"));
  assert.ok(variants.includes("안양시"));
  assert.ok(variants.includes("안양광역시"));
  assert.equal(variants.length, 8);
});

test("buildSearchQueries does not double up when the query already ends with a suffix", () => {
  assert.deepEqual(buildSearchQueries("안양시"), ["안양시"]);
  assert.deepEqual(buildSearchQueries("광주광역시"), ["광주광역시"]);
});

test("mergeGeocodingResults dedupes identical entries across lists", () => {
  const a = { name: "안양", admin1: "x", admin2: "y", latitude: 1, longitude: 1 };
  const b = { name: "안양시", admin1: "경기도", admin2: "안양시", latitude: 2, longitude: 2, population: 595644 };
  const bDup = { ...b };
  const merged = mergeGeocodingResults([[a, b], [bDup]]);
  assert.equal(merged.length, 2);
});

test("mergeGeocodingResults sorts entries with population first, descending", () => {
  const small = { name: "광주시", admin1: "경기도", latitude: 1, longitude: 1, population: 81780 };
  const big = { name: "광주광역시", admin1: "광주광역시", latitude: 2, longitude: 2, population: 1401235 };
  const unknown = { name: "광주", admin1: "충청남도", latitude: 3, longitude: 3 };
  const merged = mergeGeocodingResults([[unknown, small, big]]);
  assert.deepEqual(merged.map((r) => r.name), ["광주광역시", "광주시", "광주"]);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '../public/geocode-search.js'`

- [ ] **Step 3: `public/geocode-search.js` 구현**

```js
// ============================================================
// 순수 로직: 한국 행정구역 접미사를 붙인 검색어 변형 생성 + 병합/정렬.
// DOM에 의존하지 않아 Node 테스트 러너로 직접 검증 가능.
// ============================================================
const ADMIN_SUFFIXES = ["시", "군", "구", "광역시", "특별시", "특별자치시", "특별자치도"];

function buildSearchQueries(query) {
  const trimmed = (query || "").trim();
  const hasSuffix = ADMIN_SUFFIXES.some((s) => trimmed.endsWith(s));
  const variants = [trimmed];
  if (!hasSuffix) {
    ADMIN_SUFFIXES.forEach((s) => variants.push(trimmed + s));
  }
  return variants;
}

function mergeGeocodingResults(resultLists) {
  const seen = new Set();
  const merged = [];
  resultLists.forEach((results) => {
    (results || []).forEach((r) => {
      const key = `${r.name}|${r.admin1}|${r.admin2}|${r.latitude}|${r.longitude}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(r);
    });
  });
  merged.sort((a, b) => (b.population || 0) - (a.population || 0));
  return merged;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { buildSearchQueries, mergeGeocodingResults };
}
```

- [ ] **Step 4: 테스트 재실행하여 통과 확인**

Run: `npm test`
Expected: PASS — 신규 4개 테스트 통과 (전체 테스트 수는 이전 총합 + 4)

- [ ] **Step 5: `public/index.html`에 스크립트 태그 추가**

`<script src="weather-fx.js"></script>` 바로 위에 추가:
```html
<script src="geocode-search.js"></script>
```

- [ ] **Step 6: `public/app.js`의 `handleCitySearch` 교체**

`public/app.js:170-212`의 `handleCitySearch` 함수를 다음으로 교체하고, 그 바로 위에 `fetchGeocodingVariants`를 추가:
```js
async function fetchGeocodingVariants(query) {
  const queries = buildSearchQueries(query);
  const responses = await Promise.all(
    queries.map((q) =>
      fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=ko&format=json`
      )
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .catch(() => ({ results: [] }))
    )
  );
  const merged = mergeGeocodingResults(responses.map((d) => d.results));
  return merged.slice(0, 12);
}

async function handleCitySearch() {
  const query = el("citySearchInput").value.trim();
  const resultsEl = el("cityResults");
  resultsEl.innerHTML = "";
  if (!query) return;

  resultsEl.innerHTML = `<li class="empty-note">검색 중…</li>`;

  try {
    const results = await fetchGeocodingVariants(query);

    resultsEl.innerHTML = "";
    if (results.length === 0) {
      resultsEl.innerHTML = `<li class="empty-note">검색 결과가 없어요. 다른 이름으로 시도해보세요.</li>`;
      return;
    }

    results.forEach((r) => {
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

- [ ] **Step 7: 브라우저에서 수동 확인**

```bash
npm start
```
온보딩 1단계에서 "안양"을 검색 → 목록 최상단에 "안양시 (경기도 · South Korea)"가 나오는지 확인. "광주"를 검색 → "광주광역시"와 "광주시 (경기도 · ...)"가 둘 다 목록에 나오는지 확인.

- [ ] **Step 8: 커밋**

```bash
git add public/geocode-search.js test/geocode-search.test.js public/app.js public/index.html
git commit -m "feat: expand city search with admin-suffix variants and population ranking"
```

---

### Task 2: Leaflet 로드 + 미리보기 지도 기초(`createMiniMap`)

**Files:**
- Modify: `public/index.html` (Leaflet CDN 링크/스크립트, `map.js` 스크립트 태그)
- Create: `public/map.js`
- Modify: `public/style.css`

**Interfaces:**
- Produces: `createMiniMap(container, lat, lon, onClick?)` — `container: HTMLElement`, `lat/lon: number`, `onClick?: () => void`. 이미 그 컨테이너에 지도가 있으면 먼저 제거하고 새로 만든다. Task 3/4가 이 함수를 호출한다.

- [ ] **Step 1: `public/index.html`의 `<head>`에 Leaflet CSS 추가**

`<link rel="stylesheet" href="style.css" />` 바로 위에 추가:
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

- [ ] **Step 2: `public/index.html`의 스크립트 태그 순서 정리**

`<script src="geocode-search.js"></script>` 바로 위에 추가 (Leaflet 전역 `L`이 다른 스크립트보다 먼저 로드되어야 함):
```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```
그리고 `<script src="app.js"></script>` 바로 위에 추가:
```html
<script src="map.js"></script>
```

- [ ] **Step 3: `public/map.js` 생성**

```js
// ============================================================
// Leaflet 지도 렌더링 전용 모듈.
// 날씨 조회/저장 로직은 모르며, app.js가 콜백으로 필요한 걸 넘겨준다.
// ============================================================
function destroyMapIfExists(container) {
  if (container._leafletMap) {
    container._leafletMap.remove();
    container._leafletMap = null;
  }
}

function addOsmTileLayer(map) {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18,
  }).addTo(map);
}

function createMiniMap(container, lat, lon, onClick) {
  if (!container || typeof L === "undefined") return;
  destroyMapIfExists(container);

  const map = L.map(container, {
    center: [lat, lon],
    zoom: 12,
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    touchZoom: false,
    keyboard: false,
  });
  addOsmTileLayer(map);
  L.marker([lat, lon]).addTo(map);

  container._leafletMap = map;

  if (onClick) {
    container.style.cursor = "pointer";
    container.addEventListener("click", onClick);
  }
}
```

- [ ] **Step 4: `public/style.css`에 미리보기 지도 스타일 추가**

파일 끝에 추가:
```css
/* ============================================================
   지도
   ============================================================ */
.mini-map {
  height: 140px;
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-top: 12px;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.15);
}
.mini-map .leaflet-control-attribution {
  font-size: 9px;
}
```

- [ ] **Step 5: 브라우저에서 수동 확인**

```bash
npm start
```
개발자 도구 콘솔에서 임시 컨테이너로 동작을 확인 (실제 화면 연동은 Task 3에서):
```js
const tmp = document.createElement("div");
tmp.style.width = "300px";
tmp.style.height = "150px";
document.body.appendChild(tmp);
createMiniMap(tmp, 37.5665, 126.9780);
```
Expected: 서울 시청 근처 지도 타일과 마커가 나타남. 콘솔 오류 없음.

- [ ] **Step 6: 커밋**

```bash
git add public/index.html public/map.js public/style.css
git commit -m "feat: load Leaflet and add mini-map primitive"
```

---

### Task 3: 온보딩 미리보기 지도 연동

**Files:**
- Modify: `public/index.html` (지역 확정 박스 아래 지도 컨테이너 추가)
- Modify: `public/app.js:214-218` (`showSelectedCity` 함수)

**Interfaces:**
- Consumes: Task 2의 `createMiniMap(container, lat, lon, onClick?)`
- Produces: 변경 없음 (`showSelectedCity(city)` 시그니처 그대로)

- [ ] **Step 1: `public/index.html`에 지도 컨테이너 추가**

`<div id="selectedCity" class="selected-city" hidden></div>` 바로 아래에 추가:
```html
<div id="regionMiniMap" class="mini-map" hidden></div>
```

- [ ] **Step 2: `public/app.js`의 `showSelectedCity` 수정**

`public/app.js:214-218`의 `showSelectedCity` 함수를 다음으로 교체:
```js
function showSelectedCity(city) {
  const box = el("selectedCity");
  box.hidden = false;
  box.textContent = `📍 선택된 지역: ${city.name}${city.country ? " · " + city.country : ""}`;

  const mapEl = el("regionMiniMap");
  mapEl.hidden = false;
  createMiniMap(mapEl, city.latitude, city.longitude);
}
```

- [ ] **Step 3: 브라우저에서 수동 확인**

```bash
npm start
```
온보딩 1단계에서 도시를 검색해 하나 선택 → "선택된 지역" 문구 아래에 그 위치를 보여주는 작은 지도가 나타나는지 확인. "📍 현재 위치 사용"으로도 동일하게 지도가 나타나는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add public/index.html public/app.js
git commit -m "feat: show mini-map preview when a region is selected in onboarding"
```

---

### Task 4: 대시보드 미리보기 지도 연동

**Files:**
- Modify: `public/app.js` (`renderWeatherPanel` 함수)
- Modify: `public/style.css`

**Interfaces:**
- Consumes: Task 2의 `createMiniMap(container, lat, lon, onClick?)`
- Produces: 변경 없음

- [ ] **Step 1: `renderWeatherPanel` 함수 수정**

`public/app.js`의 `renderWeatherPanel` 함수에서, `<div class="gauge-row">...</div>` 블록 바로 다음(`</div>\n    </div>` 앞, 즉 `.weather-content` 안 마지막)에 지도 컨테이너를 추가:
```js
      <div class="gauge-row">
        ${gaugeHtml("습도", `${Math.round(w.humidity)}%`, w.humidity)}
        ${gaugeHtml("바람", `${Math.round(w.wind)}`, Math.min(100, w.wind * 2.5))}
        ${gaugeHtml("강수", `${Math.round(w.precipProb)}%`, w.precipProb)}
        ${gaugeHtml("자외선", `${Math.round(w.uv)}`, Math.min(100, w.uv * 9))}
      </div>

      <div id="dashboardMiniMap" class="mini-map"></div>
    </div>
  `;

  renderWeatherFx(el("weatherFx"), w);
  createMiniMap(el("dashboardMiniMap"), profile.region.latitude, profile.region.longitude);
}
```
(위 코드는 기존 템플릿 리터럴의 마지막 부분과 `renderWeatherFx(...)` 호출부를 함께 보여준 것 — 실제로는 기존 `</div>\n    </div>\n  \`;\n\n  renderWeatherFx(el("weatherFx"), w);\n}` 부분을 찾아서 그 사이에 `<div id="dashboardMiniMap" class="mini-map"></div>`를 추가하고, `renderWeatherFx` 호출 다음 줄에 `createMiniMap(...)` 호출을 추가하면 된다.)

- [ ] **Step 2: `public/style.css`에 다크 배경용 여백 조정 추가**

`.mini-map` 규칙 바로 아래에 추가:
```css
.weather-content .mini-map {
  margin-top: 20px;
}
```

- [ ] **Step 3: 브라우저에서 수동 확인**

```bash
npm start
```
온보딩을 마치고 대시보드에 진입 → 날씨 패널 게이지 아래에 현재 지역 위치를 보여주는 지도가 나타나는지 확인. 지도에 찍힌 마커 위치가 화면 상단의 "📍 지역명"과 같은 곳인지 확인.

- [ ] **Step 4: 커밋**

```bash
git add public/app.js public/style.css
git commit -m "feat: show mini-map preview in the dashboard weather panel"
```

---

### Task 5: 인터랙티브 탐색 지도 모달

**Files:**
- Modify: `public/index.html` (모달 마크업)
- Modify: `public/map.js` (`openMapExplorer`, `closeMapExplorer`, 클릭 시 팝업)
- Modify: `public/style.css`

**Interfaces:**
- Consumes: 없음 (Leaflet만 사용)
- Produces: `openMapExplorer(lat, lon, callbacks)` — `callbacks: { onFetchWeatherHtml(lat, lon): Promise<string>, onSelectLocation(lat, lon): Promise<void> }`. `closeMapExplorer()` — 인자 없음. Task 6에서 이 두 함수를 미리보기 지도의 클릭 콜백으로 연결한다.

- [ ] **Step 1: `public/index.html`에 모달 마크업 추가**

`</div>` (즉 `<div id="app">`를 닫는 태그) 바로 다음, `<!-- 제품 항목 템플릿 -->` 주석 위에 추가:
```html
<div id="mapModal" class="map-modal" hidden>
  <div class="map-modal-inner">
    <button type="button" id="mapModalClose" class="icon-btn map-modal-close" title="닫기">✕</button>
    <div id="exploreMap" class="explore-map"></div>
  </div>
</div>
```

- [ ] **Step 2: `public/map.js`에 모달 로직 추가**

파일 끝에 추가:
```js
let exploreMap = null;
let exploreClickHandler = null;

function openMapExplorer(lat, lon, callbacks) {
  document.getElementById("mapModal").hidden = false;

  if (!exploreMap) {
    exploreMap = L.map("exploreMap", { zoomControl: true });
    addOsmTileLayer(exploreMap);
  }

  exploreMap.setView([lat, lon], 12);
  setTimeout(() => exploreMap.invalidateSize(), 0);

  if (exploreClickHandler) {
    exploreMap.off("click", exploreClickHandler);
  }
  exploreClickHandler = (e) => handleExploreMapClick(e, callbacks);
  exploreMap.on("click", exploreClickHandler);
}

function closeMapExplorer() {
  document.getElementById("mapModal").hidden = true;
}

async function handleExploreMapClick(e, callbacks) {
  const { lat, lng } = e.latlng;
  const popup = L.popup()
    .setLatLng([lat, lng])
    .setContent('<p class="map-popup-loading">날씨를 조회하는 중…</p>')
    .openOn(exploreMap);

  const html = await callbacks.onFetchWeatherHtml(lat, lng);
  popup.setContent(`
    <div class="map-popup">
      ${html}
      <button type="button" class="btn btn-primary map-popup-select">이 위치로 지역 설정</button>
    </div>
  `);

  const btn = document.querySelector(".leaflet-popup-content .map-popup-select");
  if (btn) {
    btn.addEventListener("click", async () => {
      await callbacks.onSelectLocation(lat, lng);
      closeMapExplorer();
    });
  }
}

document.getElementById("mapModalClose").addEventListener("click", closeMapExplorer);
document.getElementById("mapModal").addEventListener("click", (e) => {
  if (e.target.id === "mapModal") closeMapExplorer();
});
```

- [ ] **Step 3: `public/style.css`에 모달/팝업 스타일 추가**

파일 끝에 추가:
```css
.map-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(15, 20, 34, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.map-modal[hidden] { display: none; }

.map-modal-inner {
  position: relative;
  width: 100%;
  max-width: 720px;
  height: 80vh;
  background: var(--surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.map-modal-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.explore-map {
  width: 100%;
  height: 100%;
}

.map-popup { font-size: 0.85rem; line-height: 1.6; }
.map-popup-loading { font-size: 0.85rem; margin: 0; }
.map-popup .btn { margin-top: 8px; width: 100%; padding: 8px 12px; font-size: 0.82rem; }
```

- [ ] **Step 4: 브라우저에서 수동 확인**

```bash
npm start
```
개발자 도구 콘솔에서:
```js
openMapExplorer(37.5665, 126.9780, {
  onFetchWeatherHtml: async (lat, lng) => `<p>테스트 ${lat.toFixed(2)}, ${lng.toFixed(2)}</p>`,
  onSelectLocation: async (lat, lng) => console.log("selected", lat, lng),
});
```
Expected: 화면을 덮는 큰 지도 모달이 열림. 지도의 다른 지점을 클릭하면 "날씨를 조회하는 중…" → "테스트 위도, 경도" + "이 위치로 지역 설정" 버튼이 있는 팝업으로 바뀜. 버튼을 누르면 콘솔에 좌표가 로그되고 모달이 닫힘. `✕` 버튼과 어두운 바깥 영역 클릭으로도 모달이 닫히는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add public/index.html public/map.js public/style.css
git commit -m "feat: add interactive map explorer modal with click-to-check-weather"
```

---

### Task 6: 미리보기 지도 클릭 → 탐색 지도 연동

**Files:**
- Modify: `public/app.js` (`showSelectedCity`, `renderWeatherPanel`, 새 헬퍼 `fetchQuickWeatherHtml`)

**Interfaces:**
- Consumes: Task 5의 `openMapExplorer(lat, lon, callbacks)`, 기존 `fetchWeather(lat, lon)`, `reverseGeocode(lat, lon)`, `TEMP_BAND_LABEL`
- Produces: 변경 없음 (외부에서 호출하는 함수 시그니처 그대로)

- [ ] **Step 1: `fetchQuickWeatherHtml` 헬퍼 추가**

`public/app.js`의 `reverseGeocode` 함수 바로 아래에 추가:
```js
async function fetchQuickWeatherHtml(lat, lon) {
  try {
    const [name, w] = await Promise.all([reverseGeocode(lat, lon), fetchWeather(lat, lon)]);
    return `
      <p class="map-popup-title">📍 ${name}</p>
      <p class="map-popup-temp">${Math.round(w.tempNow)}° · ${TEMP_BAND_LABEL[w.tempBand]}${w.isRainy ? " · 비" : ""}${w.isSnowy ? " · 눈" : ""}</p>
      <p class="map-popup-detail">강수 ${Math.round(w.precipProb)}% · 자외선 ${Math.round(w.uv)}</p>
    `;
  } catch (err) {
    return `<p class="map-popup-loading">날씨를 가져오지 못했어요.</p>`;
  }
}
```

- [ ] **Step 2: `showSelectedCity`에 미리보기 지도 클릭 연동**

Task 3에서 만든 `showSelectedCity` 함수를 다음으로 교체:
```js
function showSelectedCity(city) {
  const box = el("selectedCity");
  box.hidden = false;
  box.textContent = `📍 선택된 지역: ${city.name}${city.country ? " · " + city.country : ""}`;

  const mapEl = el("regionMiniMap");
  mapEl.hidden = false;
  createMiniMap(mapEl, city.latitude, city.longitude, () => {
    openMapExplorer(city.latitude, city.longitude, {
      onFetchWeatherHtml: fetchQuickWeatherHtml,
      onSelectLocation: async (lat, lon) => {
        const name = await reverseGeocode(lat, lon);
        selectedCity = { name, latitude: lat, longitude: lon, country: "" };
        showSelectedCity(selectedCity);
        el("toStep2").disabled = false;
      },
    });
  });
}
```

- [ ] **Step 3: `renderWeatherPanel`에 미리보기 지도 클릭 연동**

Task 4에서 추가한 `createMiniMap(el("dashboardMiniMap"), profile.region.latitude, profile.region.longitude);` 호출을 다음으로 교체:
```js
  createMiniMap(el("dashboardMiniMap"), profile.region.latitude, profile.region.longitude, () => {
    openMapExplorer(profile.region.latitude, profile.region.longitude, {
      onFetchWeatherHtml: fetchQuickWeatherHtml,
      onSelectLocation: async (lat, lon) => {
        const name = await reverseGeocode(lat, lon);
        profile.region = { name, latitude: lat, longitude: lon, country: "" };
        saveProfile(profile);
        showDashboard();
      },
    });
  });
```

- [ ] **Step 4: 브라우저에서 수동 확인**

```bash
npm start
```
1. 온보딩 1단계에서 지역 선택 후 나타난 미리보기 지도를 클릭 → 탐색 지도 모달이 열리는지 확인 → 다른 지점을 클릭해 실제 날씨 팝업이 뜨는지 확인 → "이 위치로 지역 설정" 클릭 → 모달이 닫히고 미리보기 지도/선택된 지역 텍스트가 새 위치로 바뀌는지 확인.
2. 온보딩을 마치고 대시보드 진입 → 날씨 패널의 미리보기 지도 클릭 → 탐색 지도에서 다른 지점 선택 후 "이 위치로 지역 설정" → 대시보드가 새 지역 날씨로 새로고침되는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add public/app.js
git commit -m "feat: wire mini-map clicks to open the map explorer"
```

---

### Task 7: 최종 확인 및 GitHub 푸시

**Files:**
- Verify only (변경 파일 없음)

- [ ] **Step 1: 전체 자동 테스트 재실행**

Run: `npm test`
Expected: PASS — 이전 총 테스트 수 + Task 1에서 추가된 4개 모두 통과.

- [ ] **Step 2: 서버 기동 및 전체 플로우 수동 확인**

```bash
npm start
```
- 온보딩 전체를 새 프로필로 진행하며 도시 검색("안양", "광주" 포함) → 미리보기 지도 → 탐색 지도 → 지역 재설정까지 한 번씩 확인
- 대시보드에서도 미리보기 지도 → 탐색 지도 → 지역 재설정 확인
- 개발자 도구 콘솔에 오류 없는지 확인, Leaflet CDN 리소스(`unpkg.com`)가 네트워크 탭에서 정상 로드되는지 확인

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
Expected: Task 1~6의 커밋이 순서대로 보이고 원격과 동기화된 상태.
