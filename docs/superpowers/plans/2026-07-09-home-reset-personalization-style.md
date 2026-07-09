# 홈 버튼 리셋 & 개인화 & 코디 스타일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ⚙ 버튼을 집 모양 리셋 버튼으로 바꾸고, 온보딩에 닉네임/나이 입력과 대시보드 인사말을 추가하고, 코디 스타일 선택이 "오늘의 코디" 추천에 반영되게 한다.

**Architecture:** 기존 온보딩 위저드(`showOnboarding`/`collectProfileFromForm`/`renderSummary`) 패턴을 그대로 확장한다. 새 필드(닉네임/나이/스타일)는 기존 `region`/`products`처럼 `profile` 객체의 필드로 취급되고, "기타" 스타일 직접입력은 기존 제품 카테고리의 "기타" 패턴을 그대로 재사용한다.

**Tech Stack:** Vanilla JS/HTML/CSS(기존 스택), 신규 의존성 없음.

## Global Constraints

- 홈 버튼 리셋은 `window.confirm()`으로 반드시 확인받은 후에만 실행 (취소 시 아무 것도 지우지 않음)
- 닉네임·나이는 선택 입력이며 비워도 온보딩 진행 가능
- 나이는 이번 범위에서 저장·요약 표시만 하고 추천 로직에는 사용하지 않음
- 코디 스타일의 "기타" 선택 시 직접 입력 필드가 나타나는 방식은 기존 제품 카테고리 "기타" 패턴과 동일하게 구현

---

### Task 1: 홈 버튼 (아이콘 교체 + 전체 리셋)

**Files:**
- Modify: `public/index.html` (`#settingsBtn` → `#homeBtn`, 아이콘 교체)
- Modify: `public/app.js` (`settingsBtn` 참조 전부 `homeBtn`으로 변경 + 리셋 로직)

**Interfaces:**
- Produces: 변경 없음 (버튼 클릭 시 부작용만 바뀜 — 다른 함수가 이 버튼을 참조하지 않음)

- [ ] **Step 1: `public/index.html`의 버튼 마크업 교체**

`public/index.html`의 다음 블록:
```html
    <button id="settingsBtn" class="icon-btn" title="프로필 설정" hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>
```
를 다음으로 교체:
```html
    <button id="homeBtn" class="icon-btn" title="처음부터 다시 시작" hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 11.5 12 4l9 7.5"></path>
        <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"></path>
      </svg>
    </button>
```

- [ ] **Step 2: `public/app.js`의 최상단 참조 변경**

`const settingsBtn = el("settingsBtn");`를 다음으로 교체:
```js
const homeBtn = el("homeBtn");
```

- [ ] **Step 3: `init()`과 `finishOnboarding` 핸들러의 참조 변경**

`public/app.js`의 `init()` 함수:
```js
function init() {
  bindOnboardingEvents();
  bindDashboardEvents();

  if (profile) {
    settingsBtn.hidden = false;
    showDashboard();
  } else {
    showOnboarding();
  }
}
```
를 다음으로 교체:
```js
function init() {
  bindOnboardingEvents();
  bindDashboardEvents();

  if (profile) {
    homeBtn.hidden = false;
    showDashboard();
  } else {
    showOnboarding();
  }
}
```

`el("finishOnboarding").addEventListener("click", () => {` 안의 다음 줄:
```js
    settingsBtn.hidden = false;
```
를 다음으로 교체:
```js
    homeBtn.hidden = false;
```

- [ ] **Step 4: `bindDashboardEvents`에 리셋 로직 추가**

`public/app.js`의 `bindDashboardEvents` 함수 첫 줄:
```js
  settingsBtn.addEventListener("click", () => showOnboarding(profile));
```
를 다음으로 교체:
```js
  homeBtn.addEventListener("click", () => {
    const confirmed = window.confirm("정말 처음부터 다시 시작하시겠어요? 기존에 입력한 내용이 모두 사라져요.");
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    profile = null;
    selectedCity = null;
    homeBtn.hidden = true;
    showOnboarding();
  });
```

- [ ] **Step 5: 회귀 테스트 + 브라우저 확인**

Run: `npm test` — Expected: PASS

```bash
npm start
```
온보딩을 마치고 대시보드 진입 → 우측 상단 아이콘이 집 모양인지 확인 → 클릭 → 확인창에서 "취소" → 대시보드 그대로 유지되는지 확인 → 다시 클릭 → "확인" → 빈 온보딩 1단계로 이동하고 아이콘이 사라지는지, `localStorage.getItem("weatherfit_profile_v1")`이 `null`인지 확인.

- [ ] **Step 6: 커밋**

```bash
git add public/index.html public/app.js
git commit -m "feat: replace settings icon with a home button that resets the profile"
```

---

### Task 2: 개인화 — 닉네임 · 나이 + 대시보드 인사말

**Files:**
- Modify: `public/index.html` (1단계에 닉네임/나이 입력, 대시보드에 인사말 요소)
- Modify: `public/app.js` (`collectProfileFromForm`, `showOnboarding`, `renderSummary`, `showDashboard`)
- Modify: `public/style.css` (인사말 스타일)

**Interfaces:**
- Produces: `profile.nickname: string`, `profile.age: number | null` — Task 3의 `renderSummary` 확장이 그대로 이어서 사용

- [ ] **Step 1: `public/index.html` 1단계에 입력 필드 추가**

`public/index.html`의 다음 블록:
```html
        <div class="wizard-step active" data-step="1">
          <h2>기본 정보를 알려주세요</h2>
          <p class="step-desc">날씨 조회와 추천 톤을 맞추기 위한 최소한의 정보예요.</p>

          <label class="field">
            <span>성별</span>
```
를 다음으로 교체:
```html
        <div class="wizard-step active" data-step="1">
          <h2>기본 정보를 알려주세요</h2>
          <p class="step-desc">날씨 조회와 추천 톤을 맞추기 위한 최소한의 정보예요.</p>

          <label class="field">
            <span>닉네임 (선택)</span>
            <input type="text" id="nicknameInput" placeholder="예: 지수" />
          </label>

          <label class="field">
            <span>나이 (선택)</span>
            <input type="number" id="ageInput" placeholder="예: 27" min="0" max="120" />
          </label>

          <label class="field">
            <span>성별</span>
```

- [ ] **Step 2: `public/index.html` 대시보드에 인사말 요소 추가**

`public/index.html`의 다음 블록:
```html
    <!-- ───────────────── 대시보드 ───────────────── -->
    <section id="dashboard" class="view" hidden>

      <div class="weather-panel" id="weatherPanel">
```
를 다음으로 교체:
```html
    <!-- ───────────────── 대시보드 ───────────────── -->
    <section id="dashboard" class="view" hidden>

      <p id="dashboardGreeting" class="dashboard-greeting" hidden></p>

      <div class="weather-panel" id="weatherPanel">
```

- [ ] **Step 3: `collectProfileFromForm`에 닉네임/나이 추가**

`public/app.js`의 `collectProfileFromForm` 함수의 `return { ... }` 블록:
```js
  return {
    gender: el("genderInput").value,
    wantsMakeup: el("wantsMakeupInput").checked,
    hairType: el("hairTypeInput").value,
    skinType: el("skinTypeInput").value,
    region: selectedCity,
    products,
  };
```
를 다음으로 교체:
```js
  return {
    nickname: el("nicknameInput").value.trim(),
    age: el("ageInput").value ? Number(el("ageInput").value) : null,
    gender: el("genderInput").value,
    wantsMakeup: el("wantsMakeupInput").checked,
    hairType: el("hairTypeInput").value,
    skinType: el("skinTypeInput").value,
    region: selectedCity,
    products,
  };
```

- [ ] **Step 4: `showOnboarding`에 프리필/리셋 처리 추가**

`public/app.js`의 `showOnboarding` 함수:
```js
  if (prefill) {
    el("genderInput").value = prefill.gender || "female";
    el("wantsMakeupInput").checked = !!prefill.wantsMakeup;
    el("hairTypeInput").value = prefill.hairType || "straight";
    el("skinTypeInput").value = prefill.skinType || "combination";
    selectedCity = prefill.region || null;
    if (selectedCity) showSelectedCity(selectedCity);

    el("productList").innerHTML = "";
    (prefill.products || []).forEach((p) => addProductRow(p));

    el("toStep2").disabled = !selectedCity;
  } else {
    el("productList").innerHTML = "";
    el("cityResults").innerHTML = "";
    el("selectedCity").hidden = true;
    selectedCity = null;
    el("toStep2").disabled = true;
  }
```
를 다음으로 교체:
```js
  if (prefill) {
    el("nicknameInput").value = prefill.nickname || "";
    el("ageInput").value = prefill.age || "";
    el("genderInput").value = prefill.gender || "female";
    el("wantsMakeupInput").checked = !!prefill.wantsMakeup;
    el("hairTypeInput").value = prefill.hairType || "straight";
    el("skinTypeInput").value = prefill.skinType || "combination";
    selectedCity = prefill.region || null;
    if (selectedCity) showSelectedCity(selectedCity);

    el("productList").innerHTML = "";
    (prefill.products || []).forEach((p) => addProductRow(p));

    el("toStep2").disabled = !selectedCity;
  } else {
    el("nicknameInput").value = "";
    el("ageInput").value = "";
    el("productList").innerHTML = "";
    el("cityResults").innerHTML = "";
    el("selectedCity").hidden = true;
    selectedCity = null;
    el("toStep2").disabled = true;
  }
```

- [ ] **Step 5: `renderSummary`에 닉네임/나이 표시 추가**

`public/app.js`의 `renderSummary` 함수의 `el("summaryBox").innerHTML = ...` 블록:
```js
  el("summaryBox").innerHTML = `
    <b>지역</b> ${p.region ? p.region.name : "-"}<br/>
    <b>성별</b> ${GENDER_LABEL[p.gender]} · <b>메이크업 추천</b> ${p.wantsMakeup ? "받음" : "받지 않음"}<br/>
    <b>모발</b> ${HAIR_LABEL[p.hairType]} · <b>피부</b> ${SKIN_LABEL[p.skinType]}<br/><br/>
    <b>보유 제품</b><br/>${productLines}
  `;
```
를 다음으로 교체:
```js
  el("summaryBox").innerHTML = `
    <b>닉네임</b> ${p.nickname || "-"} · <b>나이</b> ${p.age ?? "-"}<br/>
    <b>지역</b> ${p.region ? p.region.name : "-"}<br/>
    <b>성별</b> ${GENDER_LABEL[p.gender]} · <b>메이크업 추천</b> ${p.wantsMakeup ? "받음" : "받지 않음"}<br/>
    <b>모발</b> ${HAIR_LABEL[p.hairType]} · <b>피부</b> ${SKIN_LABEL[p.skinType]}<br/><br/>
    <b>보유 제품</b><br/>${productLines}
  `;
```

- [ ] **Step 6: `showDashboard`에 인사말 렌더링 추가**

`public/app.js`의 `showDashboard` 함수 시작 부분:
```js
async function showDashboard() {
  onboardingView.hidden = true;
  dashboardView.hidden = false;
  el("cardsGrid").hidden = true;
```
를 다음으로 교체:
```js
async function showDashboard() {
  onboardingView.hidden = true;
  dashboardView.hidden = false;

  const greetingEl = el("dashboardGreeting");
  if (profile.nickname) {
    greetingEl.hidden = false;
    greetingEl.textContent = `${profile.nickname}님, 오늘의 웨더핏이에요`;
  } else {
    greetingEl.hidden = true;
  }

  el("cardsGrid").hidden = true;
```

- [ ] **Step 7: `public/style.css`에 인사말 스타일 추가**

파일 끝에 추가:
```css
.dashboard-greeting {
  margin: 4px 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ink);
}
```

- [ ] **Step 8: 회귀 테스트 + 브라우저 확인**

Run: `npm test` — Expected: PASS

```bash
npm start
```
온보딩 1단계에서 닉네임 "지수", 나이 "27" 입력 후 나머지 진행 → 4단계 요약에 "닉네임 지수 · 나이 27"이 보이는지 → 완료 → 대시보드 상단에 "지수님, 오늘의 웨더핏이에요"가 보이는지 확인. 닉네임을 비우고 새 프로필로 진행했을 때는 인사말 줄 자체가 안 보이는지도 확인.

- [ ] **Step 9: 커밋**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "feat: add nickname/age personalization and dashboard greeting"
```

---

### Task 3: 코디 스타일 선택 + 추천 반영

**Files:**
- Modify: `public/index.html` (2단계에 스타일 select + 커스텀 입력)
- Modify: `public/app.js` (`bindOnboardingEvents`, `collectProfileFromForm`, `showOnboarding`, `renderSummary`, `buildOutfitRec`, `buildRecommendations`)
- Modify: `public/style.css` (커스텀 입력 스타일)

**Interfaces:**
- Consumes: Task 2의 `profile` 스키마(닉네임/나이 필드는 그대로 두고 확장)
- Produces: `profile.styleType: string`, `profile.customStyle?: string`. `buildOutfitRec(profile, w)` — 기존 `buildOutfitRec(w)`에서 시그니처 변경.

- [ ] **Step 1: `public/index.html` 2단계에 스타일 select 추가**

`public/index.html`의 다음 블록:
```html
          <label class="field">
            <span>피부 타입</span>
            <select id="skinTypeInput">
              <option value="dry">건성</option>
              <option value="oily">지성</option>
              <option value="combination">복합성</option>
              <option value="sensitive">민감성</option>
            </select>
          </label>

          <div class="wizard-actions">
            <button type="button" class="btn btn-ghost" data-prev="1">이전</button>
            <button type="button" class="btn btn-primary" data-next="3">다음</button>
          </div>
        </div>
```
를 다음으로 교체:
```html
          <label class="field">
            <span>피부 타입</span>
            <select id="skinTypeInput">
              <option value="dry">건성</option>
              <option value="oily">지성</option>
              <option value="combination">복합성</option>
              <option value="sensitive">민감성</option>
            </select>
          </label>

          <label class="field">
            <span>코디 스타일</span>
            <select id="styleTypeInput">
              <option value="casual">캐주얼</option>
              <option value="minimal">미니멀</option>
              <option value="street">스트릿</option>
              <option value="feminine">페미닌</option>
              <option value="classic">클래식</option>
              <option value="sporty">스포티</option>
              <option value="vintage">빈티지</option>
              <option value="other">기타</option>
            </select>
          </label>
          <input type="text" id="customStyleInput" class="style-custom-input" placeholder="스타일 직접 입력 (예: 고프코어)" hidden />

          <div class="wizard-actions">
            <button type="button" class="btn btn-ghost" data-prev="1">이전</button>
            <button type="button" class="btn btn-primary" data-next="3">다음</button>
          </div>
        </div>
```

- [ ] **Step 2: `public/style.css`에 커스텀 입력 스타일 추가**

파일 끝에 추가:
```css
.style-custom-input {
  width: 100%;
  margin-top: -8px;
  margin-bottom: 16px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: var(--surface-soft);
  font-size: 0.85rem;
}
```

- [ ] **Step 3: `bindOnboardingEvents`에 스타일 select 토글 이벤트 추가**

`public/app.js`의 `bindOnboardingEvents` 함수 안, `el("addProductBtn").addEventListener(...)` 줄 바로 위에 추가:
```js
  el("styleTypeInput").addEventListener("change", () => {
    const custom = el("customStyleInput");
    custom.hidden = el("styleTypeInput").value !== "other";
    if (el("styleTypeInput").value !== "other") custom.value = "";
  });
```

- [ ] **Step 4: `collectProfileFromForm`에 스타일 필드 추가**

Task 2에서 수정한 `collectProfileFromForm`의 `return { ... }` 블록 전체를 다음으로 교체:
```js
  const styleType = el("styleTypeInput").value;
  const profileData = {
    nickname: el("nicknameInput").value.trim(),
    age: el("ageInput").value ? Number(el("ageInput").value) : null,
    gender: el("genderInput").value,
    wantsMakeup: el("wantsMakeupInput").checked,
    hairType: el("hairTypeInput").value,
    skinType: el("skinTypeInput").value,
    styleType,
    region: selectedCity,
    products,
  };
  if (styleType === "other") {
    const customStyle = el("customStyleInput").value.trim();
    if (customStyle) profileData.customStyle = customStyle;
  }
  return profileData;
```
(이 블록이 함수의 마지막 `return` 문을 대체하므로, 함수 끝의 `}`는 그대로 유지한다.)

- [ ] **Step 5: `showOnboarding`에 스타일 프리필/리셋 처리 추가**

Task 2에서 수정한 `showOnboarding`의 `if (prefill) { ... } else { ... }` 블록에서, `if (prefill)` 안 `el("skinTypeInput").value = prefill.skinType || "combination";` 바로 아래에 추가:
```js
    el("styleTypeInput").value = prefill.styleType || "casual";
    if (prefill.styleType === "other" && prefill.customStyle) {
      el("customStyleInput").hidden = false;
      el("customStyleInput").value = prefill.customStyle;
    } else {
      el("customStyleInput").hidden = true;
      el("customStyleInput").value = "";
    }
```
그리고 `else` 블록의 `el("ageInput").value = "";` 바로 아래에 추가:
```js
    el("styleTypeInput").value = "casual";
    el("customStyleInput").hidden = true;
    el("customStyleInput").value = "";
```

- [ ] **Step 6: 스타일 라벨/힌트 상수 + `buildOutfitRec` 수정**

`public/app.js`의 `buildOutfitRec` 함수를 찾아 그 위에 상수를 추가하고 함수를 교체한다. 다음 블록:
```js
function buildOutfitRec(w) {
  let advice = OUTFIT_BASE[w.tempBand];
  if (w.isRainy) advice += " 우산과 방수가 되는 신발도 챙기세요.";
  if (w.isSnowy) advice += " 눈길 미끄럼을 막아줄 신발을 신어주세요.";
  if (w.isWindy) advice += " 바람이 강하니 방풍 소재의 아우터가 도움이 돼요.";

  return {
    situation: `${TEMP_BAND_LABEL[w.tempBand]} · 최고 ${Math.round(w.tempMax)}° / 최저 ${Math.round(w.tempMin)}°`,
    advice,
  };
}
```
를 다음으로 교체:
```js
const STYLE_LABEL = {
  casual: "캐주얼",
  minimal: "미니멀",
  street: "스트릿",
  feminine: "페미닌",
  classic: "클래식",
  sporty: "스포티",
  vintage: "빈티지",
  other: "기타",
};

const STYLE_OUTFIT_HINT = {
  casual: "캐주얼하게 편안한 티셔츠나 데님 위주로 매치해보세요.",
  minimal: "미니멀하게 무채색 기본템으로 심플하게 매치해보세요.",
  street: "스트릿하게 오버사이즈 아우터나 스니커즈를 포인트로 매치해보세요.",
  feminine: "페미닌하게 부드러운 소재나 플레어 실루엣으로 매치해보세요.",
  classic: "클래식하게 단정한 셔츠나 슬랙스로 깔끔하게 매치해보세요.",
  sporty: "스포티하게 트레이닝복이나 스니커즈 룩으로 활동적으로 매치해보세요.",
  vintage: "빈티지하게 레트로 무드의 아이템으로 개성 있게 매치해보세요.",
};

function styleOutfitHint(profile) {
  if (profile.styleType === "other" && profile.customStyle) {
    return `${profile.customStyle} 스타일에 맞게 매치해보세요.`;
  }
  return STYLE_OUTFIT_HINT[profile.styleType] || "";
}

function buildOutfitRec(profile, w) {
  let advice = OUTFIT_BASE[w.tempBand];
  if (w.isRainy) advice += " 우산과 방수가 되는 신발도 챙기세요.";
  if (w.isSnowy) advice += " 눈길 미끄럼을 막아줄 신발을 신어주세요.";
  if (w.isWindy) advice += " 바람이 강하니 방풍 소재의 아우터가 도움이 돼요.";

  const styleHint = styleOutfitHint(profile);
  if (styleHint) advice += ` ${styleHint}`;

  return {
    situation: `${TEMP_BAND_LABEL[w.tempBand]} · 최고 ${Math.round(w.tempMax)}° / 최저 ${Math.round(w.tempMin)}°`,
    advice,
  };
}
```

- [ ] **Step 7: `buildRecommendations`가 `profile`을 넘기도록 수정**

`public/app.js`의 `buildRecommendations` 함수:
```js
function buildRecommendations(profile, w) {
  return {
    hair: buildHairRec(profile, w),
    skin: buildSkinRecs(profile, w),
    makeup: profile.wantsMakeup ? buildMakeupRecs(profile, w) : null,
    outfit: buildOutfitRec(w),
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
  };
}
```

- [ ] **Step 8: `renderSummary`에 스타일 표시 추가**

Task 2에서 수정한 `renderSummary`의 `el("summaryBox").innerHTML` 블록에서, `<b>모발</b> ... <b>피부</b> ...` 줄 바로 다음에 추가:
```js
    <b>모발</b> ${HAIR_LABEL[p.hairType]} · <b>피부</b> ${SKIN_LABEL[p.skinType]}<br/>
    <b>코디 스타일</b> ${p.styleType === "other" && p.customStyle ? p.customStyle : STYLE_LABEL[p.styleType]}<br/><br/>
```
(기존에 `<br/><br/>`로 끝나던 모발/피부 줄의 줄바꿈을 위와 같이 스타일 줄 뒤로 옮긴다.)

- [ ] **Step 9: 회귀 테스트 + 브라우저 확인**

Run: `npm test` — Expected: PASS

```bash
npm start
```
온보딩 2단계에서 "코디 스타일"을 "스트릿"으로 선택 → 4단계 요약에 "코디 스타일 스트릿"이 보이는지 → 완료 → 대시보드의 "오늘의 코디" 카드 조언 문장 끝에 "스트릿하게 오버사이즈 아우터나 스니커즈를 포인트로 매치해보세요."가 이어붙어 있는지 확인. 스타일을 "기타"로 선택하고 "고프코어"를 입력했을 때도 요약과 코디 카드에 "고프코어 스타일에 맞게 매치해보세요."가 반영되는지 확인.

- [ ] **Step 10: 커밋**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "feat: add outfit style selection and reflect it in outfit recommendations"
```

---

### Task 4: 최종 확인 및 GitHub 푸시

**Files:**
- Verify only

- [ ] **Step 1: 전체 자동 테스트 재실행**

Run: `npm test`
Expected: PASS — 기존 전체 테스트 통과 (이번 작업은 순수 UI/온보딩 로직이라 테스트 개수 변화 없음)

- [ ] **Step 2: Playwright로 전체 플로우 확인**

프로젝트 밖 scratchpad(`C:\Users\poksi\AppData\Local\Temp\claude\c--claude-weather-styling-app\95958a36-89a3-4693-8012-57876617faab\scratchpad\pw-debug`)에 이미 설치된 Playwright로 다음을 확인하는 스크립트를 실행한다:
1. 온보딩에서 닉네임 "지수", 나이 27, 코디 스타일 "스트릿"을 입력하고 완료
2. 대시보드 상단에 "지수님, 오늘의 웨더핏이에요" 텍스트 존재 확인
3. `#outfitCard .advice` 텍스트에 "스트릿하게"가 포함되는지 확인
4. 우측 상단 아이콘이 집 모양(`#homeBtn`)으로 존재하는지, 클릭 후 확인창에서 취소하면 대시보드가 유지되고, 확인을 누르면 `localStorage.getItem("weatherfit_profile_v1")`이 `null`이 되고 온보딩 1단계로 돌아가는지 확인
5. 콘솔에 `pageerror`가 없는지 확인

`window.confirm`은 헤드리스 브라우저에서 자동으로 수락되므로, 취소 케이스는 `page.on("dialog", dialog => dialog.dismiss())`로, 확인 케이스는 `dialog.accept()`로 각각 테스트한다.

Expected: 위 5가지 모두 통과.

- [ ] **Step 3: GitHub 푸시**

```bash
git status
git push
```
Expected: `nothing to commit, working tree clean` 이후 `git push`가 fast-forward로 성공.

- [ ] **Step 4: 최종 커밋 로그 확인**

```bash
git log --oneline -8
```
Expected: Task 1~3의 커밋이 순서대로 보이고 원격과 동기화된 상태.
