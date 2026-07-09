# 애니메이션 현실감 개선 & 코디 조합표 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비를 제외한 날씨 애니메이션(우박/눈/황사·미세먼지/안개/흐림/번개/폭풍/햇빛)을 더 자연스럽게 다듬고, 헤어/스킨케어 카드의 배지 문구를 정리하고, "오늘의 코디" 카드에 조합표와 추천 스타일(준비중) 섹션을 추가한다.

**Architecture:** 기존 `public/weather-fx.js`의 `computeXFx`/`renderSkyLayer` 구조를 그대로 유지하고 파라미터(개수·크기·랜덤 범위)와 CSS 키프레임만 다듬는다. 코디 조합표는 `buildOutfitRec` 옆에 새 `OUTFIT_TABLE` 데이터 + `buildOutfitTable(profile, w)` 함수를 추가하고, `renderRecommendationCards`에서 그 결과를 표로 렌더링한다.

**Tech Stack:** 기존 스택 그대로(Vanilla JS/CSS), 신규 의존성 없음.

## Global Constraints

- 비 애니메이션(`raindrop`/`computeRainFx`)은 건드리지 않는다
- `prefers-reduced-motion: reduce`에서는 여전히 애니메이션이 렌더링되지 않아야 한다
- 코디 조합표 데이터는 실제 SNS 게시물을 그대로 가져온 것이 아니라 스타일별 일반적인 아이템 구성을 참고한 예시임을 유지한다 ("기타" 커스텀 스타일은 조합표 데이터 없음 → 준비중 안내)
- 스킨케어 "신규 제품 제안" 준비중 툴팁은 스킨케어 카드에만 적용, 메이크업 카드는 그대로 유지

---

### Task 1: 우박·눈 애니메이션 개선

**Files:**
- Modify: `public/weather-fx.js` (`SNOW_TIERS`, `renderFallingParticles`)
- Modify: `public/style.css` (`.hailstone`, `@keyframes hailfall`, `.snowflake`, `@keyframes snowfall`)

**Interfaces:**
- Consumes: 없음
- Produces: 변경 없음 (기존 `computeHailFx`/`computeSnowFx`/`renderFallingParticles` 시그니처 그대로, `SNOW_TIERS` 각 항목에 `sizeMin`/`sizeMax` 필드만 추가됨 — 기존 `.tier`/`.bright` 필드를 확인하는 테스트에는 영향 없음)

- [ ] **Step 1: `SNOW_TIERS`에 크기 범위 추가**

`public/weather-fx.js`의 `SNOW_TIERS` 배열을 다음으로 교체:
```js
const SNOW_TIERS = [
  { max: 1, tier: "light", count: 20, durMin: 5, durMax: 7, opMin: 0.5, opMax: 0.7, bright: false, sizeMin: 3, sizeMax: 6 },
  { max: 5, tier: "moderate", count: 40, durMin: 4, durMax: 5.5, opMin: 0.55, opMax: 0.75, bright: false, sizeMin: 3, sizeMax: 7 },
  { max: 15, tier: "heavy", count: 70, durMin: 3, durMax: 4.5, opMin: 0.6, opMax: 0.8, bright: false, sizeMin: 4, sizeMax: 8 },
  { max: Infinity, tier: "blizzard", count: 110, durMin: 2, durMax: 3.5, opMin: 0.65, opMax: 0.85, bright: true, sizeMin: 4, sizeMax: 9 },
];
```

- [ ] **Step 2: `renderFallingParticles`가 크기 변수를 지원하도록 수정**

`public/weather-fx.js`의 `renderFallingParticles` 함수를 다음으로 교체:
```js
function renderFallingParticles(container, className, tier) {
  for (let i = 0; i < tier.count; i++) {
    const particle = document.createElement("span");
    particle.className = className;
    particle.style.setProperty("--left", `${Math.random() * 100}%`);
    particle.style.setProperty("--duration", `${randomBetween(tier.durMin, tier.durMax)}s`);
    particle.style.setProperty("--delay", `${(Math.random() * -tier.durMax).toFixed(2)}s`);
    particle.style.setProperty("--opacity", randomBetween(tier.opMin, tier.opMax).toFixed(2));
    if (tier.sizeMin && tier.sizeMax) {
      particle.style.setProperty("--size", `${randomBetween(tier.sizeMin, tier.sizeMax).toFixed(1)}px`);
    }
    container.appendChild(particle);
  }
}
```

- [ ] **Step 3: `npm test`로 회귀 확인**

Run: `npm test`
Expected: PASS — `SNOW_TIERS`에 필드를 추가했을 뿐 `.tier`/`.bright`를 확인하는 기존 테스트는 그대로 통과.

- [ ] **Step 4: `public/style.css`의 `.hailstone`/`@keyframes hailfall` 교체**

다음 블록:
```css
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
```
를 다음으로 교체:
```css
.hailstone {
  position: absolute;
  left: var(--left);
  top: -8%;
  width: 6px;
  height: 6px;
  border-radius: 40% 60% 55% 45%;
  background: rgba(226, 232, 240, 0.92);
  box-shadow: 0 0 2px rgba(255, 255, 255, 0.5);
  opacity: var(--opacity);
  animation: hailfall var(--duration) cubic-bezier(0.55, 0, 1, 0.45) var(--delay) infinite;
}
@keyframes hailfall {
  0% { top: -8%; transform: rotate(0deg); }
  85% { top: 96%; transform: rotate(160deg); }
  90% { top: 90%; transform: rotate(180deg); }
  95% { top: 97%; transform: rotate(190deg); }
  100% { top: 94%; transform: rotate(200deg); opacity: 0; }
}
```

- [ ] **Step 5: `public/style.css`의 `.snowflake`/`@keyframes snowfall` 교체**

다음 블록:
```css
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
```
를 다음으로 교체:
```css
.snowflake {
  position: absolute;
  left: var(--left);
  top: -6%;
  width: var(--size, 6px);
  height: var(--size, 6px);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.55) 70%);
  box-shadow: 0 0 3px rgba(255, 255, 255, 0.4);
  opacity: var(--opacity);
  animation: snowfall var(--duration) ease-in-out var(--delay) infinite;
}
@keyframes snowfall {
  0% { top: -6%; transform: translateX(0) rotate(0deg); }
  25% { transform: translateX(12px) rotate(45deg); }
  50% { transform: translateX(-8px) rotate(90deg); }
  75% { transform: translateX(10px) rotate(135deg); }
  100% { top: 110%; transform: translateX(-6px) rotate(180deg); }
}
```

- [ ] **Step 6: 브라우저에서 수동 확인**

```bash
npm start
```
개발자 도구 콘솔에서:
```js
renderWeatherFx(document.getElementById("weatherFx"), { code: 99, isRainy: true, isSnowy: false, precipSum: 20, pm10: 0, dust: 0, uv: 0, wind: 10 });
```
잠시 후:
```js
renderWeatherFx(document.getElementById("weatherFx"), { code: 71, isRainy: false, isSnowy: true, precipSum: 8, pm10: 0, dust: 0, uv: 0, wind: 10 });
```
Expected: 우박은 불규칙한 회색 알갱이가 회전하며 떨어지다 바닥 근처에서 살짝 튕기는 느낌, 눈은 크기가 서로 다른 눈송이가 회전하며 자연스럽게 흔들리는 느낌.

- [ ] **Step 7: 커밋**

```bash
git add public/weather-fx.js public/style.css
git commit -m "feat: make hail and snow animations look more natural"
```

---

### Task 2: 황사·미세먼지 / 안개 / 흐림 애니메이션 개선

**Files:**
- Modify: `public/weather-fx.js` (`HAZE_TIERS`, `renderSkyLayer`의 haze/fog/cloud 분기, `computeFogFx`)
- Modify: `test/weather-fx.test.js` (`computeFogFx`의 `bandCount` 기대값 변경)
- Modify: `public/style.css` (`.haze-particle`, `.fog-band`, `.cloud-blob`, `@keyframes cloudDrift`, 신규 `.haze-cloud`)

**Interfaces:**
- Consumes: 없음
- Produces: `computeFogFx`가 이제 `{ bandCount: 5, opacity: 0.25 }`를 반환 (기존 `3` → `5`로 변경, 테스트도 함께 갱신)

- [ ] **Step 1: 안개 밴드 개수 테스트 갱신 (실패 확인)**

`test/weather-fx.test.js`의 다음 줄:
```js
  assert.equal(computeFogFx({ code: 45 }).bandCount, 3);
  assert.equal(computeFogFx({ code: 48 }).bandCount, 3);
```
를 다음으로 교체:
```js
  assert.equal(computeFogFx({ code: 45 }).bandCount, 5);
  assert.equal(computeFogFx({ code: 48 }).bandCount, 5);
```

Run: `npm test`
Expected: FAIL — 아직 구현이 3을 반환하므로 이 두 assertion에서 실패.

- [ ] **Step 2: `computeFogFx` 수정**

`public/weather-fx.js`의 `computeFogFx` 함수:
```js
function computeFogFx(w) {
  if (!w || (w.code !== 45 && w.code !== 48)) return null;
  return { bandCount: 3, opacity: 0.25 };
}
```
를 다음으로 교체:
```js
function computeFogFx(w) {
  if (!w || (w.code !== 45 && w.code !== 48)) return null;
  return { bandCount: 5, opacity: 0.25 };
}
```

Run: `npm test`
Expected: PASS

- [ ] **Step 3: `HAZE_TIERS`에 구름층 개수 추가 + 입자 수 축소**

`public/weather-fx.js`의 `HAZE_TIERS` 배열을 다음으로 교체:
```js
const HAZE_TIERS = [
  { min: 81, max: 151, tier: "bad", particleCount: 15, cloudCount: 2, overlayOpacity: 0.18 },
  { min: 151, max: Infinity, tier: "veryBad", particleCount: 28, cloudCount: 3, overlayOpacity: 0.32 },
];
```

- [ ] **Step 4: `renderSkyLayer`의 haze/fog/cloud 분기 교체**

`public/weather-fx.js`의 `renderSkyLayer` 함수에서 다음 블록:
```js
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
```
를 다음으로 교체:
```js
  } else if (sky.type === "haze") {
    container.classList.add(sky.tint === "dust" ? "weather-fx--dust" : "weather-fx--fine");
    container.style.setProperty("--haze-opacity", sky.overlayOpacity);
    for (let i = 0; i < sky.cloudCount; i++) {
      const cloud = document.createElement("div");
      cloud.className = "haze-cloud";
      cloud.style.setProperty("--top", `${10 + i * 25}%`);
      cloud.style.setProperty("--duration", `${randomBetween(22, 34).toFixed(2)}s`);
      cloud.style.setProperty("--delay", `${(i * -8).toFixed(2)}s`);
      container.appendChild(cloud);
    }
    for (let i = 0; i < sky.particleCount; i++) {
      const particle = document.createElement("span");
      particle.className = "haze-particle";
      particle.style.setProperty("--left", `${Math.random() * 100}%`);
      particle.style.setProperty("--top", `${Math.random() * 100}%`);
      particle.style.setProperty("--duration", `${randomBetween(8, 16).toFixed(2)}s`);
      particle.style.setProperty("--delay", `${(Math.random() * -14).toFixed(2)}s`);
      container.appendChild(particle);
    }
  } else if (sky.type === "fog") {
    container.style.setProperty("--fog-opacity", sky.opacity);
    for (let i = 0; i < sky.bandCount; i++) {
      const band = document.createElement("div");
      band.className = "fog-band";
      band.style.setProperty("--top", `${10 + i * 18}%`);
      band.style.setProperty("--delay", `${(i * -2.4).toFixed(2)}s`);
      band.style.setProperty("--band-opacity", (sky.opacity * (0.6 + i * 0.1)).toFixed(2));
      container.appendChild(band);
    }
  } else if (sky.type === "cloud") {
    for (let i = 0; i < sky.blobCount; i++) {
      const blob = document.createElement("div");
      blob.className = "cloud-blob";
      const depth = i / Math.max(1, sky.blobCount - 1);
      blob.style.setProperty("--top", `${8 + i * 16}%`);
      blob.style.setProperty("--opacity", (sky.opacity * (1 - depth * 0.4)).toFixed(2));
      blob.style.setProperty("--scale", (1 - depth * 0.3).toFixed(2));
      blob.style.setProperty("--duration", `${randomBetween(20, 34).toFixed(2)}s`);
      blob.style.setProperty("--delay", `${(i * -7).toFixed(2)}s`);
      container.appendChild(blob);
    }
  } else if (sky.type === "sun") {
```

- [ ] **Step 5: `public/style.css` 스타일 교체**

다음 블록:
```css
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
```
를 다음으로 교체:
```css
.haze-particle {
  position: absolute;
  left: var(--left);
  top: var(--top);
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  filter: blur(0.5px);
  animation: hazeDrift var(--duration) ease-in-out var(--delay) infinite;
}
.haze-cloud {
  position: absolute;
  left: -20%;
  top: var(--top);
  width: 70%;
  height: 40%;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.5);
  background: currentColor;
  opacity: 0.5;
  filter: blur(18px);
  animation: cloudDrift var(--duration) linear var(--delay) infinite;
}
.weather-fx--dust .haze-cloud { color: rgba(196, 154, 68, 0.5); }
.weather-fx--fine .haze-cloud { color: rgba(140, 140, 140, 0.5); }
```

다음 블록:
```css
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
```
를 다음으로 교체:
```css
.fog-band {
  position: absolute;
  left: -20%;
  right: -20%;
  top: var(--top);
  height: 18%;
  background: rgba(255, 255, 255, var(--band-opacity, var(--fog-opacity, 0.25)));
  filter: blur(8px);
  animation: fogDrift 11s ease-in-out var(--delay) infinite;
}
```

다음 블록:
```css
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
```
를 다음으로 교체:
```css
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
  from { transform: translateX(0) scale(var(--scale, 1)); }
  to { transform: translateX(160%) scale(var(--scale, 1)); }
}
```

- [ ] **Step 6: 브라우저에서 수동 확인**

```bash
npm start
```
콘솔에서:
```js
renderWeatherFx(document.getElementById("weatherFx"), { code: 1, isRainy: false, isSnowy: false, precipSum: 0, pm10: 200, dust: 60, uv: 0, wind: 0 });
```
Expected: 날아다니는 점보다 뿌옇게 낀 느낌의 큰 블러 레이어가 두드러짐.
```js
renderWeatherFx(document.getElementById("weatherFx"), { code: 45, isRainy: false, isSnowy: false, precipSum: 0, pm10: 0, dust: 0, uv: 0, wind: 0 });
```
Expected: 안개 밴드가 5겹으로 층져 보임.
```js
renderWeatherFx(document.getElementById("weatherFx"), { code: 3, isRainy: false, isSnowy: false, precipSum: 0, pm10: 0, dust: 0, uv: 0, wind: 0 });
```
Expected: 구름이 크기/투명도가 다르게 겹쳐서 원근감이 느껴짐.

- [ ] **Step 7: 커밋**

```bash
git add public/weather-fx.js test/weather-fx.test.js public/style.css
git commit -m "feat: make haze, fog, and cloud animations look more atmospheric"
```

---

### Task 3: 번개·폭풍·햇빛 애니메이션 개선

**Files:**
- Modify: `public/weather-fx.js` (`renderWeatherFx`의 lightning 렌더링, `renderWindStreaks`)
- Modify: `public/style.css` (`.lightning-flash` 옆에 `.lightning-bolt` 신규, `.wind-streak`, `.sun-rays`, `.heat-shimmer`)

**Interfaces:**
- Consumes: 없음
- Produces: 변경 없음

- [ ] **Step 1: `renderWeatherFx`의 번개 렌더링에 번개 줄기 추가**

`public/weather-fx.js`의 `renderWeatherFx` 함수에서 다음 블록:
```js
  const lightning = computeLightningFx(w);
  if (lightning) {
    const flash = document.createElement("div");
    flash.className = "lightning-flash";
    flash.style.setProperty("--flash-interval", `${lightning.flashInterval}s`);
    flash.style.setProperty("--flash-opacity", lightning.flashOpacity);
    container.appendChild(flash);
  }
```
를 다음으로 교체:
```js
  const lightning = computeLightningFx(w);
  if (lightning) {
    const flash = document.createElement("div");
    flash.className = "lightning-flash";
    flash.style.setProperty("--flash-interval", `${lightning.flashInterval}s`);
    flash.style.setProperty("--flash-opacity", lightning.flashOpacity);
    container.appendChild(flash);

    const bolt = document.createElement("div");
    bolt.className = "lightning-bolt";
    bolt.style.setProperty("--bolt-left", `${Math.round(20 + Math.random() * 60)}%`);
    bolt.style.setProperty("--flash-interval", `${lightning.flashInterval}s`);
    container.appendChild(bolt);
  }
```

- [ ] **Step 2: `renderWindStreaks`에 랜덤 길이/속도/투명도 추가**

`public/weather-fx.js`의 `renderWindStreaks` 함수를 다음으로 교체:
```js
function renderWindStreaks(container) {
  for (let i = 0; i < 8; i++) {
    const streak = document.createElement("span");
    streak.className = "wind-streak";
    streak.style.setProperty("--top", `${Math.random() * 100}%`);
    streak.style.setProperty("--delay", `${(Math.random() * -2).toFixed(2)}s`);
    streak.style.setProperty("--duration", `${randomBetween(0.6, 1.3).toFixed(2)}s`);
    streak.style.setProperty("--width", `${Math.round(randomBetween(25, 50))}%`);
    streak.style.setProperty("--stroke-opacity", randomBetween(0.25, 0.45).toFixed(2));
    container.appendChild(streak);
  }
}
```

- [ ] **Step 3: `public/style.css`에 `.lightning-bolt` 추가**

`.lightning-flash`/`@keyframes lightningFlash` 블록 바로 다음에 추가:
```css
.lightning-bolt {
  position: absolute;
  top: 0;
  left: var(--bolt-left, 60%);
  width: 40px;
  height: 55%;
  background: rgba(255, 255, 255, 0.85);
  clip-path: polygon(40% 0%, 60% 0%, 45% 40%, 65% 40%, 30% 100%, 40% 55%, 20% 55%);
  opacity: 0;
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.8));
  animation: boltFlash var(--flash-interval) ease-out infinite;
}
@keyframes boltFlash {
  0%, 92% { opacity: 0; }
  93% { opacity: 0.9; }
  94% { opacity: 0; }
  96% { opacity: 0.7; }
  100% { opacity: 0; }
}
```

- [ ] **Step 4: `public/style.css`의 `.wind-streak` 교체**

다음 블록:
```css
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
```
를 다음으로 교체:
```css
.wind-streak {
  position: absolute;
  left: -10%;
  top: var(--top);
  width: var(--width, 40%);
  height: 2px;
  background: rgba(255, 255, 255, var(--stroke-opacity, 0.35));
  transform: rotate(8deg);
  animation: windStreak var(--duration, 0.9s) linear var(--delay) infinite;
}
```

- [ ] **Step 5: `public/style.css`의 `.sun-rays`/`.heat-shimmer` 교체**

다음 블록:
```css
.sun-rays {
  position: absolute;
  top: 12%;
  right: 10%;
  width: 90px;
  height: 90px;
  background: conic-gradient(from 0deg, transparent 0 10%, rgba(255, 214, 120, 0.35) 12%, transparent 14% 100%);
  animation: sunRotate var(--rotate-duration) linear infinite;
}
```
를 다음으로 교체:
```css
.sun-rays {
  position: absolute;
  top: 12%;
  right: 10%;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: repeating-conic-gradient(rgba(255, 214, 120, 0.32) 0deg 6deg, transparent 6deg 24deg);
  mix-blend-mode: screen;
  animation: sunRotate var(--rotate-duration) linear infinite;
}
```

다음 블록:
```css
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
```
를 다음으로 교체:
```css
.heat-shimmer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 35%;
  background: linear-gradient(to top, rgba(255, 255, 255, 0.1), transparent);
  filter: blur(3px);
  animation: shimmer 2.4s ease-in-out infinite;
}
.heat-shimmer--light { opacity: 0.35; animation-duration: 3s; }
.heat-shimmer--heavy { opacity: 0.55; animation-duration: 1.6s; filter: blur(4px); }

@keyframes shimmer {
  0%, 100% { transform: translateY(0) scaleY(1); }
  50% { transform: translateY(-6px) scaleY(1.08); }
}
```

- [ ] **Step 6: 회귀 테스트 + 브라우저 확인**

Run: `npm test` — Expected: PASS

```bash
npm start
```
콘솔에서:
```js
renderWeatherFx(document.getElementById("weatherFx"), { code: 95, isRainy: true, isSnowy: false, precipSum: 3, pm10: 0, dust: 0, uv: 0, wind: 10 });
```
Expected: 몇 초 기다리면 화면 플래시와 함께 옅은 지그재그 번개 줄기가 겹쳐 보임.
```js
renderWeatherFx(document.getElementById("weatherFx"), { code: 61, isRainy: true, isSnowy: false, precipSum: 0.5, pm10: 0, dust: 0, uv: 0, wind: 60 });
```
Expected: 강풍 줄무늬 길이/속도가 제각각으로 보임.
```js
renderWeatherFx(document.getElementById("weatherFx"), { code: 1, isRainy: false, isSnowy: false, precipSum: 0, pm10: 0, dust: 0, uv: 9, wind: 0 });
```
Expected: 햇살이 뚜렷한 부채꼴 모양으로 회전하고, 아지랑이가 줄무늬 대신 부드럽게 흐려지는 느낌으로 보임.

- [ ] **Step 7: 커밋**

```bash
git add public/weather-fx.js public/style.css
git commit -m "feat: make lightning, storm, and sun animations look more natural"
```

---

### Task 4: 헤어 "참고" 배지 제거 + 스킨케어 "준비중" 툴팁

**Files:**
- Modify: `public/app.js` (`renderRecommendationCards`, `tipBlockHtml`)

**Interfaces:**
- Consumes: 없음
- Produces: `tipBlockHtml(tip, showComingSoonHint)` — 기존 `tipBlockHtml(tip)`에서 2번째 파라미터(`boolean`, 기본 동작은 스킨/메이크업 호출부에서 명시적으로 넘김) 추가

- [ ] **Step 1: 헤어카드 "참고" 배지 숨김 처리**

`public/app.js`의 `renderRecommendationCards` 함수에서 다음 블록:
```js
  const hairTag = hairCard.querySelector(".tag");
  hairTag.textContent = tagLabel(rules.hair.tag);
  hairTag.className = `tag ${rules.hair.tag}`;
```
를 다음으로 교체:
```js
  const hairTag = hairCard.querySelector(".tag");
  if (rules.hair.tag === "neutral") {
    hairTag.hidden = true;
  } else {
    hairTag.hidden = false;
    hairTag.textContent = tagLabel(rules.hair.tag);
    hairTag.className = `tag ${rules.hair.tag}`;
  }
```

- [ ] **Step 2: `tipBlockHtml`에 준비중 힌트 파라미터 추가**

`public/app.js`의 `tipBlockHtml` 함수를 다음으로 교체:
```js
function tipBlockHtml(tip, showComingSoonHint) {
  const evidenceButton = tip.evidence
    ? `<button type="button" class="evidence-trigger tooltip-trigger" data-tooltip="${tip.evidence.summary}" data-evidence-id="${registerEvidence(tip.evidence)}">💡 전문가 팁</button>`
    : "";
  const isComingSoon = showComingSoonHint && tip.tag === "suggested";
  const tagAttrs = isComingSoon
    ? `class="tag ${tip.tag} tooltip-trigger" tabindex="0" data-tooltip="아직 실제 제품 추천으로 연동되기 전이에요. 준비 중인 기능이에요."`
    : `class="tag ${tip.tag}"`;
  return `
    <div class="tip-block">
      <p class="situation">${tip.situation}</p>
      <p class="advice">${tip.advice}</p>
      <span ${tagAttrs}>${tagLabel(tip.tag)}</span>
      ${evidenceButton}
    </div>
  `;
}
```

- [ ] **Step 3: 스킨/메이크업 호출부 수정**

`public/app.js`의 `renderRecommendationCards` 함수에서 다음 두 줄:
```js
  el("skinCard").querySelector(".skin-tips").innerHTML = rules.skin.map(tipBlockHtml).join("");
```
및
```js
    makeupCard.querySelector(".makeup-tips").innerHTML = rules.makeup.map(tipBlockHtml).join("");
```
를 각각 다음으로 교체:
```js
  el("skinCard").querySelector(".skin-tips").innerHTML = rules.skin.map((tip) => tipBlockHtml(tip, true)).join("");
```
```js
    makeupCard.querySelector(".makeup-tips").innerHTML = rules.makeup.map((tip) => tipBlockHtml(tip, false)).join("");
```

- [ ] **Step 4: 회귀 테스트 + 브라우저 확인**

Run: `npm test` — Expected: PASS

```bash
npm start
```
습도가 평범한 날 헤어 카드에 배지가 안 보이는지(또는 콘솔에서 `renderRecommendationCards({...lastRules, hair: {...lastRules.hair, tag: "neutral"}})`로 강제 확인), 스킨케어 카드의 "신규 제품 제안" 배지에 마우스를 올리면 "아직 실제 제품 추천으로 연동되기 전이에요…" 툴팁이 뜨는지, 메이크업 카드의 "신규 제품 제안"(있다면)에는 그 툴팁이 안 뜨는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add public/app.js
git commit -m "feat: hide the neutral hair tag and add a coming-soon hint to skincare suggestions"
```

---

### Task 5: 코디 조합표

**Files:**
- Modify: `public/app.js` (`OUTFIT_TABLE` 데이터, `buildOutfitTable(profile, w)`, `buildRecommendations`, `renderRecommendationCards`, `renderOutfitTable` 헬퍼)
- Modify: `public/index.html` (`#outfitCard`에 조합표 컨테이너 추가)
- Modify: `public/style.css` (조합표 스타일)

**Interfaces:**
- Produces: `buildOutfitTable(profile, w)` — `null | { top: string, bottom: string, socks: string, shoes: string }`. "기타" 커스텀 스타일이거나 매칭되는 데이터가 없으면 `null`.
- Produces: `rules.outfitTable`(`buildRecommendations`가 반환하는 객체에 추가된 필드)

- [ ] **Step 1: `public/index.html`의 `#outfitCard`에 조합표 컨테이너 추가**

`public/index.html`의 다음 블록:
```html
        <article class="rec-card" id="outfitCard">
          <h3><span class="card-icon">👕</span>오늘의 코디</h3>
          <p class="situation"></p>
          <p class="advice"></p>
        </article>
```
를 다음으로 교체:
```html
        <article class="rec-card" id="outfitCard">
          <h3><span class="card-icon">👕</span>오늘의 코디</h3>
          <p class="situation"></p>
          <p class="advice"></p>
          <div class="outfit-table-section">
            <h4>조합표</h4>
            <div id="outfitTableBody"></div>
          </div>
        </article>
```

- [ ] **Step 2: `public/app.js`에 `OUTFIT_TABLE` 데이터 + `buildOutfitTable` 추가**

`public/app.js`의 `STYLE_OUTFIT_HINT` 상수 바로 아래(`function styleOutfitHint` 함수 위)에 추가:
```js
const OUTFIT_TABLE = {
  casual: {
    top: { hot: "루즈핏 반팔 티셔츠 · 화이트/베이지", mild: "오버사이즈 스웨트셔츠 · 그레이", cold: "후드 집업 + 히트텍 이너 · 네이비" },
    bottom: "스트레이트 데님 팬츠 · 블루",
    socks: "무지 크루 삭스 · 화이트",
    shoes: "캔버스 스니커즈 · 화이트",
  },
  minimal: {
    top: { hot: "무지 반팔 티셔츠 · 오프화이트", mild: "라운드넥 니트 · 그레이", cold: "울 코트 + 터틀넥 · 차콜" },
    bottom: "테이퍼드 슬랙스 · 블랙",
    socks: "발목 삭스 · 블랙",
    shoes: "미니멀 로퍼 · 블랙",
  },
  street: {
    top: { hot: "그래픽 반팔 티셔츠 · 블랙", mild: "오버사이즈 후드 + 워크자켓 · 카키", cold: "패딩 아우터 + 후드 레이어드 · 블랙" },
    bottom: "와이드 카고 팬츠 · 카키",
    socks: "로고 크루 삭스 · 화이트",
    shoes: "청키 스니커즈 · 화이트/블랙",
  },
  feminine: {
    top: { hot: "프릴 블라우스 · 라이트핑크", mild: "니트 가디건 + 슬립 원피스 · 아이보리", cold: "울 코트 + 니트 레이어드 · 베이지" },
    bottom: "플레어 스커트 · 라벤더",
    socks: "레이스 삭스 · 화이트",
    shoes: "메리제인 플랫 · 베이지",
  },
  classic: {
    top: { hot: "린넨 셔츠 · 라이트블루", mild: "브이넥 니트 + 셔츠 레이어드 · 네이비", cold: "울 코트 + 셔츠 · 그레이" },
    bottom: "슬랙스 · 차콜",
    socks: "발목 삭스 · 네이비",
    shoes: "로퍼 · 브라운",
  },
  sporty: {
    top: { hot: "드라이핏 반팔 티셔츠 · 블랙", mild: "트레이닝 재킷 · 네이비/화이트", cold: "플리스 집업 + 패딩 베스트 · 블랙" },
    bottom: "조거 팬츠 · 블랙",
    socks: "스포츠 크루 삭스 · 화이트",
    shoes: "러닝화 · 화이트/네온",
  },
  vintage: {
    top: { hot: "레트로 스트라이프 반팔 · 브라운톤", mild: "체크 니트 베스트 + 셔츠 · 머스타드", cold: "코듀로이 자켓 · 카멜" },
    bottom: "와이드 코듀로이 팬츠 · 브라운",
    socks: "레트로 스트라이프 삭스 · 크림",
    shoes: "로퍼 또는 첼시부츠 · 브라운",
  },
};

function buildOutfitTable(profile, w) {
  const table = OUTFIT_TABLE[profile.styleType];
  if (!table) return null;

  const tempGroup = ["very_hot", "hot"].includes(w.tempBand)
    ? "hot"
    : ["cold", "very_cold"].includes(w.tempBand)
    ? "cold"
    : "mild";

  let shoes = table.shoes;
  if (w.isRainy) shoes += " (방수 소재 추천)";
  if (w.isSnowy) shoes += " (미끄럼 방지 밑창 추천)";

  return {
    top: table.top[tempGroup],
    bottom: table.bottom,
    socks: table.socks,
    shoes,
  };
}
```

- [ ] **Step 3: `buildRecommendations`에 `outfitTable` 필드 추가**

`public/app.js`의 `buildRecommendations` 함수:
```js
function buildRecommendations(profile, w) {
  return {
    hair: buildHairRec(profile, w),
    skin: buildSkinRecs(profile, w),
    makeup: profile.wantsMakeup ? buildMakeupRecs(profile, w) : null,
    outfit: buildOutfitRec(profile, w),
  };
}
```
를 다음으로 교체:
```js
function buildRecommendations(profile, w) {
  return {
    hair: buildHairRec(profile, w),
    skin: buildSkinRecs(profile, w),
    makeup: profile.wantsMakeup ? buildMakeupRecs(profile, w) : null,
    outfit: buildOutfitRec(profile, w),
    outfitTable: buildOutfitTable(profile, w),
  };
}
```

- [ ] **Step 4: `renderRecommendationCards`에 조합표 렌더링 추가**

`public/app.js`의 `renderRecommendationCards` 함수 끝부분:
```js
  const outfitCard = el("outfitCard");
  outfitCard.querySelector(".situation").textContent = rules.outfit.situation;
  outfitCard.querySelector(".advice").textContent = rules.outfit.advice;
}
```
를 다음으로 교체:
```js
  const outfitCard = el("outfitCard");
  outfitCard.querySelector(".situation").textContent = rules.outfit.situation;
  outfitCard.querySelector(".advice").textContent = rules.outfit.advice;
  renderOutfitTable(el("outfitTableBody"), rules.outfitTable);
}

function renderOutfitTable(container, table) {
  if (!table) {
    container.innerHTML = `<p class="empty-note">직접 입력한 스타일의 조합표는 아직 준비 중이에요.</p>`;
    return;
  }
  container.innerHTML = `
    <div class="outfit-table-row"><span class="outfit-table-label">상의</span><span>${table.top}</span></div>
    <div class="outfit-table-row"><span class="outfit-table-label">하의</span><span>${table.bottom}</span></div>
    <div class="outfit-table-row"><span class="outfit-table-label">양말</span><span>${table.socks}</span></div>
    <div class="outfit-table-row"><span class="outfit-table-label">신발</span><span>${table.shoes}</span></div>
  `;
}
```

- [ ] **Step 5: `public/style.css`에 조합표 스타일 추가**

파일 끝에 추가:
```css
.outfit-table-section {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}
.outfit-table-section h4 {
  margin: 0 0 8px;
  font-size: 0.82rem;
  color: var(--ink-soft);
}
.outfit-table-row {
  display: flex;
  gap: 10px;
  padding: 6px 0;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--surface-soft);
}
.outfit-table-row:last-child { border-bottom: none; }
.outfit-table-label {
  flex: 0 0 44px;
  font-weight: 600;
  color: var(--ink-soft);
}
```

- [ ] **Step 6: 회귀 테스트 + 브라우저 확인**

Run: `npm test` — Expected: PASS

```bash
npm start
```
온보딩에서 코디 스타일을 "스트릿"으로 선택해 완료 → 대시보드 "오늘의 코디" 카드 아래에 "조합표" 섹션이 상의/하의/양말/신발로 나오는지 확인. 홈 버튼으로 리셋 후 스타일을 "기타"로 직접 입력해서 완료하면 "직접 입력한 스타일의 조합표는 아직 준비 중이에요"가 나오는지 확인.

- [ ] **Step 7: 커밋**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "feat: add a style-and-weather-based outfit combination table"
```

---

### Task 6: 추천 스타일 (준비중 자리)

**Files:**
- Modify: `public/index.html` (`#outfitCard`에 추천 스타일 섹션 추가)
- Modify: `public/style.css` (준비중 배지/섹션 스타일)

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (정적 마크업)

- [ ] **Step 1: `public/index.html`에 추천 스타일 섹션 추가**

Task 5에서 추가한 다음 블록:
```html
          <div class="outfit-table-section">
            <h4>조합표</h4>
            <div id="outfitTableBody"></div>
          </div>
        </article>
```
를 다음으로 교체:
```html
          <div class="outfit-table-section">
            <h4>조합표</h4>
            <div id="outfitTableBody"></div>
          </div>

          <div class="outfit-table-section style-reference-section">
            <h4>추천 스타일 <span class="coming-soon-badge">준비중</span></h4>
            <p class="coming-soon-note">곧 실제 코디 이미지를 참고해서 비슷한 스타일을 보여드릴 예정이에요.</p>
          </div>
        </article>
```

- [ ] **Step 2: `public/style.css`에 준비중 배지 스타일 추가**

파일 끝에 추가:
```css
.coming-soon-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #fff3d6;
  color: #8a6100;
  font-size: 0.68rem;
  font-weight: 600;
  vertical-align: middle;
}
.coming-soon-note {
  margin: 0;
  font-size: 0.82rem;
  color: var(--ink-faint);
  line-height: 1.5;
}
```

- [ ] **Step 3: 브라우저에서 수동 확인**

```bash
npm start
```
대시보드의 "오늘의 코디" 카드 맨 아래에 "추천 스타일 [준비중]"과 안내 문구가 조합표 밑에 나오는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add public/index.html public/style.css
git commit -m "feat: add a placeholder style-reference section for future image integration"
```

---

### Task 7: 최종 확인 및 GitHub 푸시

**Files:**
- Verify only

- [ ] **Step 1: 전체 자동 테스트 재실행**

Run: `npm test`
Expected: PASS — 기존 전체 테스트 통과 (Task 2에서 `computeFogFx`의 `bandCount` 기대값만 3→5로 갱신됨, 개수는 동일).

- [ ] **Step 2: Playwright로 전체 플로우 확인 + 스크린샷**

프로젝트 밖 scratchpad(`C:\Users\poksi\AppData\Local\Temp\claude\c--claude-weather-styling-app\95958a36-89a3-4693-8012-57876617faab\scratchpad\pw-debug`)에 이미 설치된 Playwright로 다음을 확인한다:
1. 온보딩에서 코디 스타일 "스트릿" 선택 후 완료 → 대시보드에서 조합표(상의/하의/양말/신발)와 "추천 스타일 준비중" 섹션이 보이는지 스크린샷으로 확인
2. 콘솔에서 각 날씨 상태(우박/눈/황사/안개/흐림/번개/폭풍/햇빛)를 강제 렌더링해 스크린샷을 남기고 눈으로 확인
3. 헤어 카드의 "참고" 배지가 안 보이는지, 스킨케어 "신규 제품 제안"에 준비중 툴팁이 뜨는지 확인
4. 콘솔에 `pageerror`가 없는지 확인

Expected: 위 4가지 모두 통과.

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
