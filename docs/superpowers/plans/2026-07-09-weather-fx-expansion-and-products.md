# 날씨 애니메이션 확장 & 제품 카테고리/자동완성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 날씨 패널 애니메이션을 우박·눈·황사/미세먼지·안개·흐림·번개·폭풍까지 확장하고, 온보딩의 보유 제품 카테고리를 다양화하며 내장 제품 데이터셋 기반 자동완성(특징/사용법 안내 포함)을 추가한다.

**Architecture:** `public/weather-fx.js`에 하늘 상태별 순수 계산 함수를 추가하고, 우선순위를 하나로 합치는 리졸버 `computeSkyFx`로 렌더링을 단순화한다. 제품 쪽은 새 정적 데이터셋 파일(`public/product-catalog.js`)을 추가하고, 기존 `addProductRow`/`collectProfileFromForm`을 확장해 자동완성과 커스텀 카테고리를 지원한다.

**Tech Stack:** Vanilla JS(전역 스크립트), Node 내장 테스트 러너(`node --test`), Open-Meteo Forecast API(기존) + Open-Meteo Air Quality API(신규, 키 불필요).

## Global Constraints

- 새 npm 의존성 추가 금지
- `prefers-reduced-motion: reduce` 사용자에게는 모든 신규 애니메이션도 렌더링하지 않음
- 하늘 상태는 한 번에 하나만 렌더링: **우박 > 눈 > 비 > 황사/미세먼지 > 안개 > 흐림 > 햇빛·자외선 > (맑음, 효과 없음)**
- 번개(뇌우 코드 95/96/99)와 폭풍(강풍≥50km/h + 비/우박)은 위 하늘 상태 위에 겹쳐지는 별도 효과
- 대기질 API 실패 시에도 전체 흐름은 막지 않음 (날씨 조회는 계속 성공해야 함)
- 제품 카테고리는 9개 → 15개로 확장, "기타" 선택 시 직접 입력 필드 노출
- 제품 자동완성은 실시간 외부 연동이 아닌 앱 내장 정적 데이터셋 기반이며, 화면에 "참고용 요약" 안내 문구를 항상 표시
- 신규 제품 카테고리는 추천 규칙 엔진(`buildHairRec`/`buildSkinRecs`/`buildMakeupRecs`)에 연결하지 않음 (범위 밖)

---

### Task 1: 우박·눈 강도 계산 함수

**Files:**
- Modify: `public/weather-fx.js` (RAIN_TIERS 선언 아래에 추가)
- Modify: `test/weather-fx.test.js` (파일 끝에 테스트 추가)

**Interfaces:**
- Produces: `computeHailFx(w)` — `w: { code: number, precipSum: number }` → `null | { tier, count, durMin, durMax, opMin, opMax, dark }`
- Produces: `computeSnowFx(w)` — `w: { isSnowy: boolean, precipSum: number }` → `null | { tier, count, durMin, durMax, opMin, opMax, bright }`

- [ ] **Step 1: 테스트 추가 (실패하는 테스트)**

`test/weather-fx.test.js` 파일 끝에 추가:
```js
const { computeHailFx, computeSnowFx } = require("../public/weather-fx.js");

test("computeHailFx returns null when weather code is not 96 or 99", () => {
  assert.equal(computeHailFx({ code: 61, precipSum: 10 }), null);
});

test("computeHailFx buckets precipSum into light/moderate/heavy/severe tiers", () => {
  assert.equal(computeHailFx({ code: 96, precipSum: 0 }).tier, "light");
  assert.equal(computeHailFx({ code: 96, precipSum: 3 }).tier, "moderate");
  assert.equal(computeHailFx({ code: 99, precipSum: 10 }).tier, "heavy");
  assert.equal(computeHailFx({ code: 99, precipSum: 25 }).tier, "severe");
});

test("computeSnowFx returns null when not snowy", () => {
  assert.equal(computeSnowFx({ isSnowy: false, precipSum: 10 }), null);
});

test("computeSnowFx buckets precipSum into light/moderate/heavy/blizzard tiers", () => {
  assert.equal(computeSnowFx({ isSnowy: true, precipSum: 0 }).tier, "light");
  assert.equal(computeSnowFx({ isSnowy: true, precipSum: 3 }).tier, "moderate");
  assert.equal(computeSnowFx({ isSnowy: true, precipSum: 10 }).tier, "heavy");
  assert.equal(computeSnowFx({ isSnowy: true, precipSum: 25 }).tier, "blizzard");
  assert.equal(computeSnowFx({ isSnowy: true, precipSum: 25 }).bright, true);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test`
Expected: FAIL — `computeHailFx is not a function` (아직 export되지 않음)

- [ ] **Step 3: `public/weather-fx.js`에 구현 추가**

`RAIN_TIERS`와 `computeRainFx` 사이가 아니라, `computeRainFx` 함수 **바로 아래**에 추가:
```js
const HAIL_TIERS = [
  { max: 1, tier: "light", count: 10, durMin: 2.4, durMax: 3.2, opMin: 0.4, opMax: 0.55, dark: false },
  { max: 5, tier: "moderate", count: 20, durMin: 1.6, durMax: 2.2, opMin: 0.45, opMax: 0.6, dark: false },
  { max: 15, tier: "heavy", count: 35, durMin: 1.0, durMax: 1.6, opMin: 0.5, opMax: 0.65, dark: false },
  { max: Infinity, tier: "severe", count: 55, durMin: 0.6, durMax: 1.0, opMin: 0.55, opMax: 0.7, dark: true },
];

function computeHailFx(w) {
  if (!w || (w.code !== 96 && w.code !== 99)) return null;
  const sum = Math.max(0, w.precipSum || 0);
  return HAIL_TIERS.find((t) => sum <= t.max);
}

const SNOW_TIERS = [
  { max: 1, tier: "light", count: 20, durMin: 5, durMax: 7, opMin: 0.5, opMax: 0.7, bright: false },
  { max: 5, tier: "moderate", count: 40, durMin: 4, durMax: 5.5, opMin: 0.55, opMax: 0.75, bright: false },
  { max: 15, tier: "heavy", count: 70, durMin: 3, durMax: 4.5, opMin: 0.6, opMax: 0.8, bright: false },
  { max: Infinity, tier: "blizzard", count: 110, durMin: 2, durMax: 3.5, opMin: 0.65, opMax: 0.85, bright: true },
];

function computeSnowFx(w) {
  if (!w || !w.isSnowy) return null;
  const sum = Math.max(0, w.precipSum || 0);
  return SNOW_TIERS.find((t) => sum <= t.max);
}
```

그리고 파일 맨 아래 export 가드를 다음으로 교체:
```js
if (typeof module !== "undefined" && module.exports) {
  module.exports = { computeRainFx, computeSunFx, computeHailFx, computeSnowFx };
}
```

- [ ] **Step 4: 테스트 재실행하여 통과 확인**

Run: `npm test`
Expected: PASS — 전체 테스트 통과 (기존 5개 + 신규 6개 = 11개)

- [ ] **Step 5: 커밋**

```bash
git add public/weather-fx.js test/weather-fx.test.js
git commit -m "feat: add hail and snow intensity tier calculators"
```

---

### Task 2: 황사/미세먼지·안개·흐림 계산 함수

**Files:**
- Modify: `public/weather-fx.js`
- Modify: `test/weather-fx.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `computeHazeFx(w)` — `w: { pm10: number, dust: number }` → `null | { tier, particleCount, overlayOpacity, tint: "dust"|"fine" }`
- Produces: `computeFogFx(w)` — `w: { code: number }` → `null | { bandCount, opacity }`
- Produces: `computeCloudFx(w)` — `w: { code: number }` → `null | { blobCount, opacity }`

- [ ] **Step 1: 테스트 추가**

`test/weather-fx.test.js` 파일 끝에 추가:
```js
const { computeHazeFx, computeFogFx, computeCloudFx } = require("../public/weather-fx.js");

test("computeHazeFx returns null when pm10 and dust are both low", () => {
  assert.equal(computeHazeFx({ pm10: 40, dust: 5 }), null);
});

test("computeHazeFx grades bad/veryBad by pm10 and tints by dust", () => {
  assert.equal(computeHazeFx({ pm10: 100, dust: 5 }).tier, "bad");
  assert.equal(computeHazeFx({ pm10: 100, dust: 5 }).tint, "fine");
  assert.equal(computeHazeFx({ pm10: 200, dust: 5 }).tier, "veryBad");
  assert.equal(computeHazeFx({ pm10: 10, dust: 60 }).tint, "dust");
});

test("computeFogFx returns null unless weather code is 45 or 48", () => {
  assert.equal(computeFogFx({ code: 1 }), null);
  assert.equal(computeFogFx({ code: 45 }).bandCount, 3);
  assert.equal(computeFogFx({ code: 48 }).bandCount, 3);
});

test("computeCloudFx grades by weather code 2 vs 3, null otherwise", () => {
  assert.equal(computeCloudFx({ code: 1 }), null);
  assert.equal(computeCloudFx({ code: 2 }).blobCount, 2);
  assert.equal(computeCloudFx({ code: 3 }).blobCount, 4);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test`
Expected: FAIL — `computeHazeFx is not a function`

- [ ] **Step 3: `public/weather-fx.js`에 구현 추가**

`computeSnowFx` 함수 바로 아래에 추가:
```js
const HAZE_TIERS = [
  { min: 81, max: 151, tier: "bad", particleCount: 25, overlayOpacity: 0.15 },
  { min: 151, max: Infinity, tier: "veryBad", particleCount: 45, overlayOpacity: 0.3 },
];

function computeHazeFx(w) {
  if (!w) return null;
  const pm10 = w.pm10 || 0;
  const dust = w.dust || 0;
  if (pm10 < 81 && dust < 40) return null;
  const matched = HAZE_TIERS.find((t) => pm10 >= t.min && pm10 < t.max) || HAZE_TIERS[0];
  return { ...matched, tint: dust >= 40 ? "dust" : "fine" };
}

function computeFogFx(w) {
  if (!w || (w.code !== 45 && w.code !== 48)) return null;
  return { bandCount: 3, opacity: 0.25 };
}

function computeCloudFx(w) {
  if (!w) return null;
  if (w.code === 3) return { blobCount: 4, opacity: 0.22 };
  if (w.code === 2) return { blobCount: 2, opacity: 0.14 };
  return null;
}
```

export 가드를 다음으로 교체:
```js
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    computeRainFx,
    computeSunFx,
    computeHailFx,
    computeSnowFx,
    computeHazeFx,
    computeFogFx,
    computeCloudFx,
  };
}
```

- [ ] **Step 4: 테스트 재실행하여 통과 확인**

Run: `npm test`
Expected: PASS — 전체 15개 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add public/weather-fx.js test/weather-fx.test.js
git commit -m "feat: add haze, fog, and cloud intensity calculators"
```

---

### Task 3: 번개·폭풍·통합 리졸버(`computeSkyFx`)

**Files:**
- Modify: `public/weather-fx.js`
- Modify: `test/weather-fx.test.js`

**Interfaces:**
- Consumes: Task 1/2의 모든 `computeXFx` 함수, 그리고 기존 `computeRainFx`/`computeSunFx`
- Produces: `computeLightningFx(w)` — `w: { code: number }` → `null | { flashInterval, flashOpacity }`
- Produces: `computeStormFx(w)` — `w: { code, isRainy, wind }` → `null | { intensify: true }`
- Produces: `computeSkyFx(w)` — 위 모든 계산기를 우선순위대로 호출하는 리졸버 → `null | { type: "hail"|"snow"|"rain"|"haze"|"fog"|"cloud"|"sun", ...해당 계산기의 필드, [dark], [storm] }`. 이후 `renderWeatherFx`가 소비하는 유일한 하늘-상태 함수.

- [ ] **Step 1: 테스트 추가**

`test/weather-fx.test.js` 파일 끝에 추가:
```js
const { computeLightningFx, computeStormFx, computeSkyFx } = require("../public/weather-fx.js");

test("computeLightningFx activates only on thunderstorm codes 95/96/99", () => {
  assert.equal(computeLightningFx({ code: 61 }), null);
  assert.equal(computeLightningFx({ code: 95 }).flashInterval, 4.5);
  assert.equal(computeLightningFx({ code: 96 }).flashInterval, 2.5);
});

test("computeStormFx requires strong wind plus rain or hail", () => {
  assert.equal(computeStormFx({ isRainy: true, code: 61, wind: 30 }), null);
  assert.equal(computeStormFx({ isRainy: false, code: 61, wind: 60 }), null);
  assert.deepEqual(computeStormFx({ isRainy: true, code: 61, wind: 60 }), { intensify: true });
  assert.deepEqual(computeStormFx({ isRainy: false, code: 99, wind: 60 }), { intensify: true });
});

test("computeSkyFx priority: hail beats everything else", () => {
  const w = { code: 99, isRainy: true, isSnowy: false, precipSum: 5, pm10: 200, uv: 9, wind: 0 };
  assert.equal(computeSkyFx(w).type, "hail");
});

test("computeSkyFx priority: snow beats rain", () => {
  const w = { code: 71, isRainy: true, isSnowy: true, precipSum: 3, pm10: 0, uv: 0, wind: 0 };
  assert.equal(computeSkyFx(w).type, "snow");
});

test("computeSkyFx priority: rain beats haze/fog/cloud/sun", () => {
  const w = { code: 61, isRainy: true, isSnowy: false, precipSum: 3, pm10: 200, uv: 9, wind: 0 };
  assert.equal(computeSkyFx(w).type, "rain");
});

test("computeSkyFx priority: haze beats fog/cloud/sun", () => {
  const w = { code: 45, isRainy: false, isSnowy: false, precipSum: 0, pm10: 200, uv: 9, wind: 0 };
  assert.equal(computeSkyFx(w).type, "haze");
});

test("computeSkyFx priority: fog beats cloud/sun", () => {
  const w = { code: 45, isRainy: false, isSnowy: false, precipSum: 0, pm10: 0, uv: 9, wind: 0 };
  assert.equal(computeSkyFx(w).type, "fog");
});

test("computeSkyFx priority: cloud beats sun", () => {
  const w = { code: 3, isRainy: false, isSnowy: false, precipSum: 0, pm10: 0, uv: 9, wind: 0 };
  assert.equal(computeSkyFx(w).type, "cloud");
});

test("computeSkyFx falls back to sun, then null", () => {
  const sunny = { code: 1, isRainy: false, isSnowy: false, precipSum: 0, pm10: 0, uv: 9, wind: 0 };
  assert.equal(computeSkyFx(sunny).type, "sun");

  const clear = { code: 0, isRainy: false, isSnowy: false, precipSum: 0, pm10: 0, uv: 0, wind: 0 };
  assert.equal(computeSkyFx(clear), null);
});

test("computeSkyFx intensifies rain into a storm when wind is strong", () => {
  const w = { code: 61, isRainy: true, isSnowy: false, precipSum: 0.5, pm10: 0, uv: 0, wind: 60 };
  const sky = computeSkyFx(w);
  assert.equal(sky.type, "rain");
  assert.equal(sky.dark, true);
  assert.equal(sky.storm, true);
  assert.equal(sky.count, Math.round(15 * 1.4));
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test`
Expected: FAIL — `computeLightningFx is not a function`

- [ ] **Step 3: `public/weather-fx.js`에 구현 추가**

`computeCloudFx` 함수 바로 아래에 추가:
```js
function computeLightningFx(w) {
  if (!w || ![95, 96, 99].includes(w.code)) return null;
  const intense = w.code === 96 || w.code === 99;
  return { flashInterval: intense ? 2.5 : 4.5, flashOpacity: intense ? 0.9 : 0.65 };
}

function computeStormFx(w) {
  if (!w) return null;
  const isHailCode = w.code === 96 || w.code === 99;
  if (!(w.isRainy || isHailCode)) return null;
  if ((w.wind || 0) < 50) return null;
  return { intensify: true };
}

function intensifyTier(tier, storm) {
  if (!storm) return tier;
  return { ...tier, count: Math.round(tier.count * 1.4), dark: true, storm: true };
}

function computeSkyFx(w) {
  const storm = computeStormFx(w);

  const hail = computeHailFx(w);
  if (hail) return { type: "hail", ...intensifyTier(hail, storm) };

  if (w && w.isSnowy) {
    const snow = computeSnowFx(w);
    if (snow) return { type: "snow", ...snow };
  }

  const rain = computeRainFx(w);
  if (rain) return { type: "rain", ...intensifyTier(rain, storm) };

  const haze = computeHazeFx(w);
  if (haze) return { type: "haze", ...haze };

  const fog = computeFogFx(w);
  if (fog) return { type: "fog", ...fog };

  const cloud = computeCloudFx(w);
  if (cloud) return { type: "cloud", ...cloud };

  const sun = computeSunFx(w);
  if (sun) return { type: "sun", ...sun };

  return null;
}
```

export 가드를 다음으로 교체:
```js
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    computeRainFx,
    computeSunFx,
    computeHailFx,
    computeSnowFx,
    computeHazeFx,
    computeFogFx,
    computeCloudFx,
    computeLightningFx,
    computeStormFx,
    computeSkyFx,
  };
}
```

- [ ] **Step 4: 테스트 재실행하여 통과 확인**

Run: `npm test`
Expected: PASS — 전체 25개 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add public/weather-fx.js test/weather-fx.test.js
git commit -m "feat: add lightning, storm, and unified sky-fx resolver"
```

---

### Task 4: `renderWeatherFx` 재작성 + 신규 CSS

**Files:**
- Modify: `public/weather-fx.js` (`renderWeatherFx` 함수 전체 교체)
- Modify: `public/style.css` (파일 끝에 신규 애니메이션 추가)

**Interfaces:**
- Consumes: Task 1~3의 `computeSkyFx(w)`, `computeLightningFx(w)`
- Produces: 변경 없음 — `renderWeatherFx(container, w)` 시그니처 그대로 유지 (Task 3의 `app.js:renderWeatherPanel` 호출부는 수정 불필요)

- [ ] **Step 1: `public/weather-fx.js`의 `renderWeatherFx` 함수를 다음으로 전체 교체**

기존 `renderWeatherFx` 함수(비/햇빛만 처리하던 버전)를 찾아 전체를 다음으로 교체:
```js
function renderWeatherFx(container, w) {
  if (!container) return;
  container.innerHTML = "";
  container.classList.remove(
    "weather-fx--dark",
    "weather-fx--warm",
    "weather-fx--dust",
    "weather-fx--fine",
    "weather-fx--snowbright"
  );
  container.style.removeProperty("--haze-opacity");
  container.style.removeProperty("--fog-opacity");

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const sky = computeSkyFx(w);
  if (sky) renderSkyLayer(container, sky);

  const lightning = computeLightningFx(w);
  if (lightning) {
    const flash = document.createElement("div");
    flash.className = "lightning-flash";
    flash.style.setProperty("--flash-interval", `${lightning.flashInterval}s`);
    flash.style.setProperty("--flash-opacity", lightning.flashOpacity);
    container.appendChild(flash);
  }
}

function renderFallingParticles(container, className, tier) {
  for (let i = 0; i < tier.count; i++) {
    const particle = document.createElement("span");
    particle.className = className;
    particle.style.setProperty("--left", `${Math.random() * 100}%`);
    particle.style.setProperty("--duration", `${randomBetween(tier.durMin, tier.durMax)}s`);
    particle.style.setProperty("--delay", `${(Math.random() * -tier.durMax).toFixed(2)}s`);
    particle.style.setProperty("--opacity", randomBetween(tier.opMin, tier.opMax).toFixed(2));
    container.appendChild(particle);
  }
}

function renderSkyLayer(container, sky) {
  if (sky.type === "hail") {
    container.classList.toggle("weather-fx--dark", !!sky.dark);
    renderFallingParticles(container, "hailstone", sky);
    if (sky.storm) renderWindStreaks(container);
  } else if (sky.type === "snow") {
    container.classList.toggle("weather-fx--snowbright", !!sky.bright);
    renderFallingParticles(container, "snowflake", sky);
  } else if (sky.type === "rain") {
    container.classList.toggle("weather-fx--dark", !!sky.dark);
    renderFallingParticles(container, "raindrop", sky);
    if (sky.storm) renderWindStreaks(container);
  } else if (sky.type === "haze") {
    container.classList.add(sky.tint === "dust" ? "weather-fx--dust" : "weather-fx--fine");
    container.style.setProperty("--haze-opacity", sky.overlayOpacity);
    for (let i = 0; i < sky.particleCount; i++) {
      const particle = document.createElement("span");
      particle.className = "haze-particle";
      particle.style.setProperty("--left", `${Math.random() * 100}%`);
      particle.style.setProperty("--top", `${Math.random() * 100}%`);
      particle.style.setProperty("--duration", `${randomBetween(6, 12).toFixed(2)}s`);
      particle.style.setProperty("--delay", `${(Math.random() * -10).toFixed(2)}s`);
      container.appendChild(particle);
    }
  } else if (sky.type === "fog") {
    container.style.setProperty("--fog-opacity", sky.opacity);
    for (let i = 0; i < sky.bandCount; i++) {
      const band = document.createElement("div");
      band.className = "fog-band";
      band.style.setProperty("--top", `${20 + i * 30}%`);
      band.style.setProperty("--delay", `${i * -3}s`);
      container.appendChild(band);
    }
  } else if (sky.type === "cloud") {
    for (let i = 0; i < sky.blobCount; i++) {
      const blob = document.createElement("div");
      blob.className = "cloud-blob";
      blob.style.setProperty("--top", `${10 + i * 18}%`);
      blob.style.setProperty("--opacity", sky.opacity);
      blob.style.setProperty("--duration", `${randomBetween(18, 28).toFixed(2)}s`);
      blob.style.setProperty("--delay", `${(i * -6).toFixed(2)}s`);
      container.appendChild(blob);
    }
  } else if (sky.type === "sun") {
    const glow = document.createElement("div");
    glow.className = "sun-glow";
    glow.style.setProperty("--pulse-duration", `${sky.pulseDuration}s`);
    container.appendChild(glow);

    if (sky.rays) {
      const rays = document.createElement("div");
      rays.className = "sun-rays";
      rays.style.setProperty("--rotate-duration", `${sky.rayDuration}s`);
      container.appendChild(rays);
    }

    if (sky.shimmer) {
      const shimmer = document.createElement("div");
      shimmer.className = `heat-shimmer heat-shimmer--${sky.shimmerLevel}`;
      container.appendChild(shimmer);
    }

    container.classList.toggle("weather-fx--warm", !!sky.warm);
  }
}

function renderWindStreaks(container) {
  for (let i = 0; i < 8; i++) {
    const streak = document.createElement("span");
    streak.className = "wind-streak";
    streak.style.setProperty("--top", `${Math.random() * 100}%`);
    streak.style.setProperty("--delay", `${(Math.random() * -2).toFixed(2)}s`);
    container.appendChild(streak);
  }
}
```

`randomBetween` 함수는 기존 그대로 유지 (삭제하지 않음).

- [ ] **Step 2: `public/style.css` 끝에 신규 애니메이션 추가**

```css
/* ============================================================
   날씨 패널 FX — 우박 · 눈 · 황사/미세먼지 · 안개 · 흐림 · 번개 · 폭풍
   ============================================================ */
.hailstone {
  position: absolute;
  left: var(--left);
  top: -8%;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  opacity: var(--opacity);
  animation: hailfall var(--duration) linear var(--delay) infinite;
}
@keyframes hailfall {
  0% { top: -8%; }
  100% { top: 100%; }
}

.snowflake {
  position: absolute;
  left: var(--left);
  top: -6%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  opacity: var(--opacity);
  animation: snowfall var(--duration) ease-in-out var(--delay) infinite;
}
@keyframes snowfall {
  0% { top: -6%; transform: translateX(0); }
  50% { transform: translateX(10px); }
  100% { top: 110%; transform: translateX(-10px); }
}
.weather-fx.weather-fx--snowbright { background: rgba(255, 255, 255, 0.12); }

.haze-particle {
  position: absolute;
  left: var(--left);
  top: var(--top);
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  animation: hazeDrift var(--duration) ease-in-out var(--delay) infinite;
}
@keyframes hazeDrift {
  0%, 100% { transform: translateX(0); opacity: 0.3; }
  50% { transform: translateX(14px); opacity: 0.6; }
}
.weather-fx.weather-fx--dust { background: rgba(196, 154, 68, var(--haze-opacity, 0.2)); }
.weather-fx.weather-fx--fine { background: rgba(140, 140, 140, var(--haze-opacity, 0.2)); }

.fog-band {
  position: absolute;
  left: -20%;
  right: -20%;
  top: var(--top);
  height: 22%;
  background: rgba(255, 255, 255, var(--fog-opacity, 0.25));
  filter: blur(6px);
  animation: fogDrift 9s ease-in-out var(--delay) infinite;
}
@keyframes fogDrift {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(6%); }
}

.cloud-blob {
  position: absolute;
  left: -30%;
  top: var(--top);
  width: 55%;
  height: 26%;
  border-radius: 50%;
  background: rgba(255, 255, 255, var(--opacity));
  filter: blur(4px);
  animation: cloudDrift var(--duration) linear var(--delay) infinite;
}
@keyframes cloudDrift {
  from { transform: translateX(0); }
  to { transform: translateX(160%); }
}

.lightning-flash {
  position: absolute;
  inset: 0;
  background: white;
  opacity: 0;
  animation: lightningFlash var(--flash-interval) ease-out infinite;
}
@keyframes lightningFlash {
  0%, 92% { opacity: 0; }
  93% { opacity: var(--flash-opacity); }
  94% { opacity: 0; }
  96% { opacity: var(--flash-opacity); }
  100% { opacity: 0; }
}

.wind-streak {
  position: absolute;
  left: -10%;
  top: var(--top);
  width: 40%;
  height: 2px;
  background: rgba(255, 255, 255, 0.35);
  transform: rotate(8deg);
  animation: windStreak 0.9s linear var(--delay) infinite;
}
@keyframes windStreak {
  from { transform: translateX(0) rotate(8deg); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  to { transform: translateX(220%) rotate(8deg); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .hailstone, .snowflake, .haze-particle, .fog-band, .cloud-blob, .lightning-flash, .wind-streak {
    animation: none !important;
  }
}
```

- [ ] **Step 3: 테스트 재실행 (회귀 확인)**

Run: `npm test`
Expected: PASS — 전체 25개 테스트 여전히 통과 (렌더링 함수는 Node 테스트 대상이 아니므로 개수 변화 없음)

- [ ] **Step 4: 브라우저에서 수동 확인**

```bash
npm start
```
대시보드 진입 후 개발자 도구 콘솔에서 각 상태를 순서대로 실행하며 시각적으로 확인:
```js
const fx = document.getElementById("weatherFx");
renderWeatherFx(fx, { code: 99, isRainy: true, isSnowy: false, precipSum: 20, pm10: 0, dust: 0, uv: 0, wind: 10 }); // 우박
renderWeatherFx(fx, { code: 71, isRainy: false, isSnowy: true, precipSum: 8, pm10: 0, dust: 0, uv: 0, wind: 10 });  // 눈
renderWeatherFx(fx, { code: 61, isRainy: true, isSnowy: false, precipSum: 2, pm10: 0, dust: 0, uv: 0, wind: 60 });  // 폭풍성 비 + 강풍줄무늬
renderWeatherFx(fx, { code: 95, isRainy: true, isSnowy: false, precipSum: 2, pm10: 0, dust: 0, uv: 0, wind: 10 });  // 뇌우(번개 플래시 확인, 몇 초 기다려야 보임)
renderWeatherFx(fx, { code: 1, isRainy: false, isSnowy: false, precipSum: 0, pm10: 200, dust: 60, uv: 0, wind: 0 }); // 황사(황색 톤)
renderWeatherFx(fx, { code: 45, isRainy: false, isSnowy: false, precipSum: 0, pm10: 0, dust: 0, uv: 0, wind: 0 });   // 안개
renderWeatherFx(fx, { code: 3, isRainy: false, isSnowy: false, precipSum: 0, pm10: 0, dust: 0, uv: 0, wind: 0 });   // 흐림
```
Expected: 각 호출마다 이전 효과가 사라지고 해당 상태에 맞는 애니메이션만 보여야 함. 콘솔 오류 없음.

- [ ] **Step 5: 커밋**

```bash
git add public/weather-fx.js public/style.css
git commit -m "feat: render all sky states (hail/snow/haze/fog/cloud/lightning/storm)"
```

---

### Task 5: 대기질 API 연동 + `classifyWeather` 플래그 확장

**Files:**
- Modify: `public/app.js:354-429` (`fetchWeather`, `classifyWeather` 함수)

**Interfaces:**
- Consumes: 없음 (신규 외부 API: Open-Meteo Air Quality)
- Produces: `classifyWeather(data, air)` 반환 객체에 `pm10`, `pm2_5`, `dust`, `isFoggy`, `isCloudy`, `isHail`, `isThunder` 필드 추가 — Task 4의 `computeSkyFx`/`computeHazeFx`/`computeFogFx`/`computeCloudFx`/`computeLightningFx`/`computeStormFx`가 소비하는 `code`, `isRainy`, `isSnowy`, `precipSum`, `wind`, `uv`, `pm10`, `dust` 필드는 이미 기존/신규로 모두 채워짐

- [ ] **Step 1: `fetchWeather` 함수 교체**

`public/app.js:354-365`의 `fetchWeather` 함수 전체를 다음으로 교체:
```js
async function fetchWeather(lat, lon) {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max,weather_code` +
    `&timezone=auto&forecast_days=1`;
  const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,dust&timezone=auto`;

  const [weatherRes, airRes] = await Promise.all([fetch(weatherUrl), fetch(airUrl).catch(() => null)]);
  if (!weatherRes.ok) throw new Error("weather fetch failed");
  const data = await weatherRes.json();

  let air = {};
  if (airRes && airRes.ok) {
    const airData = await airRes.json();
    air = airData.current || {};
  }

  return classifyWeather(data, air);
}
```

- [ ] **Step 2: `classifyWeather` 함수 수정**

`public/app.js:367-429`의 `classifyWeather` 함수 시그니처와 본문을 다음으로 교체 (기존 로직은 그대로 유지하고 아래 내용만 추가):
```js
function classifyWeather(data, air) {
  const cur = data.current || {};
  const daily = data.daily || {};
  const airCur = air || {};

  const humidity = cur.relative_humidity_2m ?? 50;
  const tempNow = cur.temperature_2m ?? 20;
  const tempMax = daily.temperature_2m_max?.[0] ?? tempNow;
  const tempMin = daily.temperature_2m_min?.[0] ?? tempNow;
  const windNow = cur.wind_speed_10m ?? 0;
  const windMax = daily.wind_speed_10m_max?.[0] ?? windNow;
  const wind = Math.max(windNow, windMax);
  const precipProb = daily.precipitation_probability_max?.[0] ?? 0;
  const precipSum = daily.precipitation_sum?.[0] ?? 0;
  const uv = daily.uv_index_max?.[0] ?? 0;
  const code = cur.weather_code ?? daily.weather_code?.[0] ?? 0;
  const pm10 = airCur.pm10 ?? 0;
  const pm2_5 = airCur.pm2_5 ?? 0;
  const dust = airCur.dust ?? 0;

  const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
  const SNOW_CODES = [71, 73, 75, 77, 85, 86];

  const isSnowy = SNOW_CODES.includes(code);
  const isRainy = !isSnowy && (precipProb >= 50 || precipSum > 0 || RAIN_CODES.includes(code));
  const isHumid = humidity >= 65;
  const isDry = humidity <= 35;
  const isWindy = wind >= 20;
  const isHighUV = uv >= 6;
  const isHail = code === 96 || code === 99;
  const isThunder = code === 95 || code === 96 || code === 99;
  const isFoggy = code === 45 || code === 48;
  const isCloudy = !isRainy && !isSnowy && (code === 2 || code === 3);

  let tempBand;
  if (tempMax >= 28) tempBand = "very_hot";
  else if (tempMax >= 23) tempBand = "hot";
  else if (tempMax >= 20) tempBand = "warm";
  else if (tempMax >= 17) tempBand = "mild";
  else if (tempMax >= 12) tempBand = "cool";
  else if (tempMax >= 5) tempBand = "cold";
  else tempBand = "very_cold";

  // 대시보드 헤더 색상 테마 결정 (우선순위: 눈 > 비 > 더움 > 추움 > 맑음/흐림)
  let theme = "sunny";
  if (isSnowy) theme = "snowy";
  else if (isRainy) theme = "rainy";
  else if (tempBand === "very_hot" || tempBand === "hot") theme = "hot";
  else if (tempBand === "very_cold" || tempBand === "cold") theme = "cold";
  else if (humidity >= 70) theme = "cloudy";

  return {
    tempNow,
    tempMax,
    tempMin,
    humidity,
    wind,
    precipProb,
    precipSum,
    uv,
    code,
    pm10,
    pm2_5,
    dust,
    isRainy,
    isSnowy,
    isHumid,
    isDry,
    isWindy,
    isHighUV,
    isHail,
    isThunder,
    isFoggy,
    isCloudy,
    tempBand,
    theme,
  };
}
```

- [ ] **Step 3: 브라우저에서 수동 확인**

```bash
npm start
```
대시보드 진입 → 개발자 도구 콘솔에서 `lastWeather`를 출력해 `pm10`, `dust`, `isFoggy`, `isCloudy`, `isHail`, `isThunder` 필드가 존재하는지 확인:
```js
console.log(lastWeather);
```
Expected: 위 6개 필드가 모두 숫자/불리언 값으로 존재. 네트워크 탭에서 `air-quality-api.open-meteo.com` 요청이 200으로 성공하는지도 확인.

- [ ] **Step 4: 커밋**

```bash
git add public/app.js
git commit -m "feat: fetch air quality data and classify fog/cloud/hail/thunder"
```

---

### Task 6: 제품 카테고리 확장 + "기타" 직접 입력

**Files:**
- Modify: `public/app.js` (`CATEGORY_LABEL`, `renderSummary`, `collectProfileFromForm`)
- Modify: `public/index.html` (`productRowTemplate`)
- Modify: `public/style.css`

**Interfaces:**
- Consumes: 없음
- Produces: `categoryLabel(product)` 함수 — `product: { category, customCategory? }` → `string`. Task 8에서 자동완성이 채우는 `product.category`도 이 함수로 표시됨.

- [ ] **Step 1: `public/app.js`의 `CATEGORY_LABEL` 교체**

`public/app.js:9-19`를 다음으로 교체:
```js
const CATEGORY_LABEL = {
  hair_fix: "헤어 고정",
  hair_moisture: "헤어 보습/영양",
  hair_treatment: "헤어 트리트먼트/팩",
  scalp_care: "두피 케어",
  skin_moisture: "스킨 보습",
  skin_toner: "토너/스킨",
  skin_serum: "에센스/세럼/앰플",
  skin_mist: "스킨 미스트",
  skin_sun: "선크림",
  skin_soothing: "진정 케어",
  makeup_base: "메이크업 베이스",
  makeup_fix: "메이크업 픽서",
  makeup_oilcontrol: "피지컨트롤",
  makeup_lip: "립 제품",
  other: "기타",
};

function categoryLabel(product) {
  if (product.category === "other" && product.customCategory) return product.customCategory;
  return CATEGORY_LABEL[product.category] || CATEGORY_LABEL.other;
}
```

- [ ] **Step 2: `renderSummary`에서 새 헬퍼 사용**

`public/app.js`의 `renderSummary` 함수 안, `productLines` 계산부:
```js
  const productLines =
    p.products.length > 0
      ? p.products.map((pr) => `· ${pr.name} <span style="color:var(--ink-faint)">(${CATEGORY_LABEL[pr.category]})</span>`).join("<br/>")
      : "등록된 제품 없음 — 필요할 때 종류를 제안해드릴게요.";
```
를 다음으로 교체:
```js
  const productLines =
    p.products.length > 0
      ? p.products.map((pr) => `· ${pr.name} <span style="color:var(--ink-faint)">(${categoryLabel(pr)})</span>`).join("<br/>")
      : "등록된 제품 없음 — 필요할 때 종류를 제안해드릴게요.";
```

- [ ] **Step 3: `public/index.html`의 `productRowTemplate` 교체**

`public/index.html:186-202`의 `<template id="productRowTemplate">` 전체를 다음으로 교체:
```html
<template id="productRowTemplate">
  <div class="product-row">
    <input type="text" class="product-name" placeholder="제품 이름 (예: 아토베리어 365 크림)" autocomplete="off" />
    <select class="product-category">
      <option value="hair_fix">헤어 고정 (스프레이/무스/젤)</option>
      <option value="hair_moisture">헤어 보습/영양 (에센스/오일)</option>
      <option value="hair_treatment">헤어 트리트먼트/팩</option>
      <option value="scalp_care">두피 케어</option>
      <option value="skin_moisture">스킨 보습 (크림/로션)</option>
      <option value="skin_toner">토너/스킨</option>
      <option value="skin_serum">에센스/세럼/앰플</option>
      <option value="skin_mist">스킨 미스트/수분 부스터</option>
      <option value="skin_sun">선크림/자외선 차단</option>
      <option value="skin_soothing">진정 케어</option>
      <option value="makeup_base">메이크업 베이스(프라이머/파운데이션)</option>
      <option value="makeup_fix">메이크업 픽서 스프레이</option>
      <option value="makeup_oilcontrol">피지컨트롤/파우더</option>
      <option value="makeup_lip">립 제품</option>
      <option value="other">기타</option>
    </select>
    <button type="button" class="remove-product-btn" title="삭제">✕</button>
    <input type="text" class="product-custom-category" placeholder="카테고리 직접 입력 (예: 향수)" hidden />
  </div>
</template>
```
(자동완성 드롭다운/안내 텍스트 요소는 Task 8에서 추가한다 — 이번 태스크는 카테고리 확장과 커스텀 입력에만 집중)

- [ ] **Step 4: `public/app.js`의 `addProductRow`에 커스텀 카테고리 토글 로직 추가**

`public/app.js:268-277`의 `addProductRow` 함수 전체를 다음으로 교체:
```js
function addProductRow(existing) {
  const tpl = el("productRowTemplate");
  const node = tpl.content.firstElementChild.cloneNode(true);
  const nameInput = node.querySelector(".product-name");
  const categorySelect = node.querySelector(".product-category");
  const customInput = node.querySelector(".product-custom-category");

  if (existing) {
    nameInput.value = existing.name || "";
    categorySelect.value = existing.category || "other";
    if (existing.category === "other" && existing.customCategory) {
      customInput.hidden = false;
      customInput.value = existing.customCategory;
    }
  }

  categorySelect.addEventListener("change", () => {
    customInput.hidden = categorySelect.value !== "other";
    if (categorySelect.value !== "other") customInput.value = "";
  });

  node.querySelector(".remove-product-btn").addEventListener("click", () => node.remove());
  el("productList").appendChild(node);
}
```

- [ ] **Step 5: `public/app.js`의 `collectProfileFromForm`에 `customCategory` 저장 추가**

`public/app.js:279-295`의 `collectProfileFromForm` 함수 전체를 다음으로 교체:
```js
function collectProfileFromForm() {
  const products = Array.from(document.querySelectorAll(".product-row"))
    .map((row) => {
      const name = row.querySelector(".product-name").value.trim();
      const category = row.querySelector(".product-category").value;
      const product = { name, category };
      if (category === "other") {
        const custom = row.querySelector(".product-custom-category").value.trim();
        if (custom) product.customCategory = custom;
      }
      return product;
    })
    .filter((p) => p.name.length > 0);

  return {
    gender: el("genderInput").value,
    wantsMakeup: el("wantsMakeupInput").checked,
    hairType: el("hairTypeInput").value,
    skinType: el("skinTypeInput").value,
    region: selectedCity,
    products,
  };
}
```

- [ ] **Step 6: `public/style.css`에 커스텀 카테고리 입력 스타일 추가**

`.remove-product-btn:hover { background: #ffe3e3; color: #c0392b; }` 바로 아래에 추가:
```css
.product-custom-category {
  grid-column: 1 / -1;
  margin-top: -2px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: var(--surface-soft);
  font-size: 0.85rem;
  width: 100%;
}
```

- [ ] **Step 7: 브라우저에서 수동 확인**

```bash
npm start
```
온보딩 3단계에서 "+ 제품 추가" → 카테고리를 "기타"로 변경 → 바로 아래 직접 입력 칸이 나타나는지 확인 → "향수" 입력 → 온보딩 완료 후 새로고침해도 값이 유지되는지(설정에서 다시 열어) 확인.

- [ ] **Step 8: 커밋**

```bash
git add public/app.js public/index.html public/style.css
git commit -m "feat: expand product categories and add custom category input"
```

---

### Task 7: 제품 카탈로그 데이터셋

**Files:**
- Create: `public/product-catalog.js`
- Modify: `public/index.html` (스크립트 태그 추가)

**Interfaces:**
- Produces: 전역 배열 `PRODUCT_CATALOG` — `Array<{ name: string, brand: string, category: string, features: string, usage: string, aliases: string[] }>`. Task 8의 자동완성이 이 배열을 그대로 소비한다.

- [ ] **Step 1: `public/product-catalog.js` 생성**

```js
// ============================================================
// 제품 자동완성용 내장 데이터셋 (실시간 외부 연동 아님)
// 올리브영 등에서 판매되는 잘 알려진 제품 위주로 선정한 참고용 요약.
// features/usage는 정확한 전성분표가 아니라 마케팅 레벨 요약이다.
// ============================================================
const PRODUCT_CATALOG = [
  {
    name: "아토베리어 365 크림",
    brand: "에스트라",
    category: "skin_moisture",
    features: "세라마이드와 마이크로바이옴 관련 성분으로 피부 장벽을 보습하는 크림",
    usage: "세안 후 적당량을 얼굴 전체에 발라 흡수시켜 주세요.",
    aliases: ["아토베리어365", "atobarrier 365", "에스트라 크림"],
  },
  {
    name: "자작나무 수분크림",
    brand: "라운드랩",
    category: "skin_moisture",
    features: "자작나무 수액 성분이 담긴 산뜻한 젤 타입 수분크림",
    usage: "세안 후 스킨케어 마지막 단계에서 얼굴 전체에 발라주세요.",
    aliases: ["round lab 자작나무크림", "자작나무크림"],
  },
  {
    name: "모이스처라이징 크림",
    brand: "세타필",
    category: "skin_moisture",
    features: "저자극 순한 보습 크림",
    usage: "세안 후 얼굴과 필요한 부위에 발라주세요.",
    aliases: ["cetaphil", "세타필 크림"],
  },
  {
    name: "워터슬리핑 마스크",
    brand: "라네즈",
    category: "skin_moisture",
    features: "수면 중 수분감을 채워주는 나이트 마스크",
    usage: "스킨케어 마지막 단계에서 덧발라 자고 일어나면 흡수시켜 주세요.",
    aliases: ["water sleeping mask", "라네즈 마스크"],
  },
  {
    name: "그린티 씨드 스킨",
    brand: "이니스프리",
    category: "skin_toner",
    features: "가벼운 텍스처로 피부에 수분감을 더하는 스킨",
    usage: "세안 후 코튼이나 손으로 피부에 발라 정돈해주세요.",
    aliases: ["그린티씨드스킨", "green tea seed skin"],
  },
  {
    name: "그린티 씨드 세럼",
    brand: "이니스프리",
    category: "skin_serum",
    features: "제주 그린티 성분이 담긴 보습 세럼",
    usage: "스킨(토너) 다음 단계에서 얼굴에 발라 흡수시켜 주세요.",
    aliases: ["이니스프리 세럼", "green tea seed serum"],
  },
  {
    name: "다이브인 저분자 히알루론산 세럼",
    brand: "토리든",
    category: "skin_serum",
    features: "저분자 히알루론산으로 산뜻하게 수분을 채우는 세럼",
    usage: "스킨 다음 얼굴 전체에 발라 흡수시켜 주세요.",
    aliases: ["토리든 세럼", "dive-in serum"],
  },
  {
    name: "타임레볼루션 퍼스트 트리트먼트 에센스",
    brand: "미샤",
    category: "skin_serum",
    features: "발효 성분 기반으로 피부 컨디션을 정돈하는 에센스",
    usage: "세안 후 토너 다음 단계에서 사용해주세요.",
    aliases: ["퍼스트에센스", "first treatment essence"],
  },
  {
    name: "떼르말 워터",
    brand: "라로슈포제",
    category: "skin_mist",
    features: "피부를 진정시키고 수분을 더해주는 미스트",
    usage: "세안 후나 메이크업 중간에 얼굴에서 20cm 떨어져 뿌려주세요.",
    aliases: ["떼르말워터", "thermal spring water"],
  },
  {
    name: "레드 블레미쉬 클리어 선크림",
    brand: "닥터지",
    category: "skin_sun",
    features: "민감성 피부용 저자극 선크림",
    usage: "외출 30분 전 얼굴에 골고루 바르고 2~3시간마다 덧발라주세요.",
    aliases: ["닥터지 선크림", "red blemish clear sun"],
  },
  {
    name: "안텔리오스 선크림",
    brand: "라로슈포제",
    category: "skin_sun",
    features: "민감성 피부 전용 고자외선차단 선크림",
    usage: "외출 전 충분히 바르고 2~3시간마다 덧발라주세요.",
    aliases: ["anthelios", "라로슈포제 선크림"],
  },
  {
    name: "시카페어 크림",
    brand: "닥터자르트",
    category: "skin_soothing",
    features: "병풀(시카) 추출물로 자극받은 피부를 진정시키는 크림",
    usage: "자외선이나 외부 자극 후 세안한 피부에 발라 진정시켜 주세요.",
    aliases: ["cicapair", "시카페어"],
  },
  {
    name: "킬커버 파운웨어 파운데이션",
    brand: "클리오",
    category: "makeup_base",
    features: "밀착력이 강한 커버력 파운데이션",
    usage: "메이크업 베이스 다음 소량씩 펴 발라 밀착시켜 주세요.",
    aliases: ["킬커버", "kill cover"],
  },
  {
    name: "픽싱 미스트",
    brand: "에뛰드하우스",
    category: "makeup_fix",
    features: "메이크업 마무리용 픽서 미스트",
    usage: "메이크업 마지막 단계에서 얼굴에서 20cm 떨어져 뿌려주세요.",
    aliases: ["에뛰드 픽서", "fixing mist"],
  },
  {
    name: "노세범 미네랄 파우더",
    brand: "이니스프리",
    category: "makeup_oilcontrol",
    features: "유분과 번들거림을 잡아주는 픽싱 파우더",
    usage: "메이크업 후 유분이 많은 부위에 퍼프로 가볍게 두드려주세요.",
    aliases: ["노세범 파우더", "no sebum powder"],
  },
  {
    name: "잉크 벨벳 립틴트",
    brand: "페리페라",
    category: "makeup_lip",
    features: "매트한 벨벳 텍스처의 립 틴트",
    usage: "입술에 얇게 펴 바른 뒤 살짝 두드려 밀착시켜 주세요.",
    aliases: ["잉크벨벳", "ink velvet"],
  },
  {
    name: "함빛 모발 에센스",
    brand: "려",
    category: "hair_moisture",
    features: "손상모발에 영양감을 더하는 헤어 에센스",
    usage: "수건으로 물기를 제거한 후 모발 중간~끝부분에 발라주세요.",
    aliases: ["려 에센스", "hambit hair essence"],
  },
  {
    name: "퍼펙트 오리지널 리페어 세럼",
    brand: "미쟝센",
    category: "hair_moisture",
    features: "손상모발 결을 정돈하는 헤어 세럼",
    usage: "샴푸 후 물기를 제거하고 모발 끝에 발라주세요.",
    aliases: ["미쟝센 세럼", "perfect original serum"],
  },
  {
    name: "자양윤모 트리트먼트",
    brand: "려",
    category: "hair_treatment",
    features: "두피와 모발에 영양을 주는 트리트먼트",
    usage: "샴푸 후 모발에 골고루 바르고 3~5분 후 헹궈주세요.",
    aliases: ["려 트리트먼트", "jayangyunmo"],
  },
  {
    name: "TS 샴푸",
    brand: "TS",
    category: "scalp_care",
    features: "두피 밸런스를 맞춰주는 저자극 샴푸",
    usage: "머리를 적신 후 거품을 내어 두피를 마사지하듯 감고 헹궈주세요.",
    aliases: ["ts샴푸", "ts shampoo"],
  },
  {
    name: "홀드 스프레이",
    brand: "아모스",
    category: "hair_fix",
    features: "강한 홀드력의 헤어 스타일링 스프레이",
    usage: "스타일링 마무리 단계에서 모발에서 25~30cm 떨어져 뿌려주세요.",
    aliases: ["아모스 스프레이", "hold spray"],
  },
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PRODUCT_CATALOG };
}
```

- [ ] **Step 2: `public/index.html`에 스크립트 태그 추가**

`public/index.html`의 `<script src="weather-fx.js"></script>` 줄 바로 아래에 추가:
```html
<script src="product-catalog.js"></script>
```

- [ ] **Step 3: 브라우저에서 수동 확인**

```bash
npm start
```
개발자 도구 콘솔에서 `PRODUCT_CATALOG.length`를 실행해 `21`이 나오는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add public/product-catalog.js public/index.html
git commit -m "feat: add built-in product catalog dataset"
```

---

### Task 8: 제품 자동완성 UI 연동

**Files:**
- Modify: `public/index.html` (`productRowTemplate`에 드롭다운/안내 텍스트 요소, step 3에 안내 문구 추가)
- Modify: `public/app.js` (`addProductRow`, `collectProfileFromForm`)
- Modify: `public/style.css`

**Interfaces:**
- Consumes: Task 7의 전역 `PRODUCT_CATALOG` 배열
- Produces: `profile.products[i]`에 매칭된 경우 `features`, `usage` 필드가 추가로 저장됨 (기존 `name`, `category`, `customCategory`는 그대로)

- [ ] **Step 1: `public/index.html`의 `productRowTemplate`에 드롭다운/안내 요소 추가**

Task 6에서 만든 템플릿을 다음으로 교체:
```html
<template id="productRowTemplate">
  <div class="product-row">
    <div class="product-name-wrap">
      <input type="text" class="product-name" placeholder="제품 이름 (예: 아토베리어 365 크림)" autocomplete="off" />
      <ul class="product-suggestions" hidden></ul>
    </div>
    <select class="product-category">
      <option value="hair_fix">헤어 고정 (스프레이/무스/젤)</option>
      <option value="hair_moisture">헤어 보습/영양 (에센스/오일)</option>
      <option value="hair_treatment">헤어 트리트먼트/팩</option>
      <option value="scalp_care">두피 케어</option>
      <option value="skin_moisture">스킨 보습 (크림/로션)</option>
      <option value="skin_toner">토너/스킨</option>
      <option value="skin_serum">에센스/세럼/앰플</option>
      <option value="skin_mist">스킨 미스트/수분 부스터</option>
      <option value="skin_sun">선크림/자외선 차단</option>
      <option value="skin_soothing">진정 케어</option>
      <option value="makeup_base">메이크업 베이스(프라이머/파운데이션)</option>
      <option value="makeup_fix">메이크업 픽서 스프레이</option>
      <option value="makeup_oilcontrol">피지컨트롤/파우더</option>
      <option value="makeup_lip">립 제품</option>
      <option value="other">기타</option>
    </select>
    <button type="button" class="remove-product-btn" title="삭제">✕</button>
    <input type="text" class="product-custom-category" placeholder="카테고리 직접 입력 (예: 향수)" hidden />
    <p class="product-info" hidden></p>
  </div>
</template>
```

`public/index.html`의 `<button type="button" id="addProductBtn" class="btn btn-secondary btn-add">+ 제품 추가</button>` 바로 아래에 추가:
```html
<p class="product-disclaimer">제품 정보는 참고용 요약이며, 정확한 성분은 제품 패키지나 판매처에서 확인해주세요.</p>
```

- [ ] **Step 2: `public/app.js`의 `addProductRow`를 자동완성 지원 버전으로 교체**

Task 6에서 만든 `addProductRow` 함수 전체를 다음으로 교체:
```js
function addProductRow(existing) {
  const tpl = el("productRowTemplate");
  const node = tpl.content.firstElementChild.cloneNode(true);
  const nameInput = node.querySelector(".product-name");
  const categorySelect = node.querySelector(".product-category");
  const customInput = node.querySelector(".product-custom-category");
  const suggestionsEl = node.querySelector(".product-suggestions");
  const infoEl = node.querySelector(".product-info");

  if (existing) {
    nameInput.value = existing.name || "";
    categorySelect.value = existing.category || "other";
    if (existing.category === "other" && existing.customCategory) {
      customInput.hidden = false;
      customInput.value = existing.customCategory;
    }
    if (existing.features || existing.usage) {
      node.dataset.features = existing.features || "";
      node.dataset.usage = existing.usage || "";
      showProductInfo(infoEl, existing.features, existing.usage);
    }
  }

  categorySelect.addEventListener("change", () => {
    customInput.hidden = categorySelect.value !== "other";
    if (categorySelect.value !== "other") customInput.value = "";
  });

  nameInput.addEventListener("input", () => {
    delete node.dataset.features;
    delete node.dataset.usage;
    infoEl.hidden = true;
    renderProductSuggestions(nameInput, suggestionsEl, (match) => {
      nameInput.value = `${match.brand} ${match.name}`;
      categorySelect.value = match.category;
      categorySelect.dispatchEvent(new Event("change"));
      node.dataset.features = match.features;
      node.dataset.usage = match.usage;
      showProductInfo(infoEl, match.features, match.usage);
      suggestionsEl.hidden = true;
      suggestionsEl.innerHTML = "";
    });
  });

  node.querySelector(".remove-product-btn").addEventListener("click", () => node.remove());
  el("productList").appendChild(node);
}

function showProductInfo(infoEl, features, usage) {
  if (!features && !usage) {
    infoEl.hidden = true;
    return;
  }
  infoEl.hidden = false;
  infoEl.innerHTML = `✓ ${features || ""}${usage ? ` · 사용법: ${usage}` : ""}`;
}

function renderProductSuggestions(nameInput, suggestionsEl, onSelect) {
  const query = nameInput.value.trim().toLowerCase();
  suggestionsEl.innerHTML = "";
  if (!query) {
    suggestionsEl.hidden = true;
    return;
  }

  const matches = PRODUCT_CATALOG.filter((p) => {
    const haystack = [p.name, p.brand, ...(p.aliases || [])].join(" ").toLowerCase();
    return haystack.includes(query);
  }).slice(0, 6);

  if (matches.length === 0) {
    suggestionsEl.hidden = true;
    return;
  }

  suggestionsEl.hidden = false;
  matches.forEach((match) => {
    const li = document.createElement("li");
    li.textContent = `${match.brand} ${match.name}`;
    li.addEventListener("click", () => onSelect(match));
    suggestionsEl.appendChild(li);
  });
}
```

- [ ] **Step 3: `public/app.js`의 `collectProfileFromForm`에 `features`/`usage` 저장 추가**

Task 6에서 만든 `collectProfileFromForm`의 `.map` 콜백을 다음으로 교체:
```js
    .map((row) => {
      const name = row.querySelector(".product-name").value.trim();
      const category = row.querySelector(".product-category").value;
      const product = { name, category };
      if (category === "other") {
        const custom = row.querySelector(".product-custom-category").value.trim();
        if (custom) product.customCategory = custom;
      }
      if (row.dataset.features) product.features = row.dataset.features;
      if (row.dataset.usage) product.usage = row.dataset.usage;
      return product;
    })
```

- [ ] **Step 4: `public/style.css`에 자동완성/안내 스타일 추가**

파일 끝에 추가:
```css
/* ============================================================
   제품 자동완성
   ============================================================ */
.product-row { position: relative; }
.product-name-wrap { position: relative; }

.product-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 5;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card);
  max-height: 180px;
  overflow-y: auto;
}
.product-suggestions li {
  padding: 8px 12px;
  font-size: 0.85rem;
  cursor: pointer;
}
.product-suggestions li:hover { background: var(--surface-soft); }

.product-info {
  grid-column: 1 / -1;
  margin: 2px 0 0;
  font-size: 0.78rem;
  color: var(--ink-soft);
  line-height: 1.5;
}

.product-disclaimer {
  margin: 10px 0 0;
  font-size: 0.75rem;
  color: var(--ink-faint);
}
```

- [ ] **Step 5: 브라우저에서 수동 확인**

```bash
npm start
```
온보딩 3단계에서 "+ 제품 추가" → 이름 칸에 "아토"를 입력 → "에스트라 아토베리어 365 크림"이 드롭다운에 나타나는지 확인 → 클릭 → 이름이 자동으로 채워지고, 카테고리가 "스킨 보습"으로 바뀌고, 아래에 "✓ 특징 · 사용법: …" 텍스트가 나타나는지 확인. 목록에 없는 이름(예: "테스트 제품")을 입력했을 때는 드롭다운이 뜨지 않고 자유롭게 저장되는지도 확인.

- [ ] **Step 6: 커밋**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "feat: add product catalog autocomplete with features and usage info"
```

---

### Task 9: 최종 확인 및 GitHub 푸시

**Files:**
- Verify only (변경 파일 없음)

- [ ] **Step 1: 전체 자동 테스트 재실행**

Run: `npm test`
Expected: PASS — 전체 25개 테스트 통과 (Task 1~3에서 추가된 것 포함)

- [ ] **Step 2: 서버 기동 및 전체 플로우 수동 확인**

```bash
npm start
```
1. 온보딩 전체(1~4단계)를 새 프로필로 진행 — 제품 추가 시 자동완성 사용 + "기타" 직접 입력 모두 시도
2. 대시보드에서 날씨 카드가 정상 렌더링되는지 확인 (실제 날씨에 따라 하늘 애니메이션이 자동으로 결정되는 것은 정상)
3. 개발자 도구 콘솔에 오류가 없는지 확인, `Network` 탭에서 `air-quality-api.open-meteo.com` 요청이 실패해도 나머지 화면이 정상 작동하는지 확인(임의로 오프라인 시뮬레이션은 생략 가능, 코드 리뷰로 `catch(() => null)` 처리 확인)

- [ ] **Step 3: GitHub 푸시**

```bash
git status
git push
```
Expected: `nothing to commit, working tree clean` 이후 `git push`가 fast-forward로 성공. 실패 시(non-fast-forward 등) 강제 푸시하지 말고 상황을 보고한다.

- [ ] **Step 4: 최종 커밋 로그 확인**

```bash
git log --oneline -10
```
Expected: Task 1~8의 커밋이 순서대로 보이고 원격과 동기화된 상태.
