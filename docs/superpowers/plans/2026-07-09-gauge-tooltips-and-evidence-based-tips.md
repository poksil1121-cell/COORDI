# 게이지 툴팁 & 근거 기반 제품 추천 설명 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 날씨 패널 게이지에 의미 설명 툴팁을 추가하고, 헤어/스킨케어 카드의 조언에 근거·출처를 보여주는 "💡 전문가 팁" 모달을 추가한다.

**Architecture:** 순수 CSS `::after` 툴팁을 `.tooltip-trigger` 공용 클래스로 구현해 게이지와 근거 트리거 버튼 양쪽에서 재사용한다. 근거 데이터는 `buildHairRec`/`buildSkinRecs`가 반환하는 tip 객체에 `evidence` 필드로 붙이고, 렌더링 시 인덱스 기반 레지스트리에 등록해 클릭 시 조회 후 기존 `#mapModal`과 같은 오버레이 패턴의 새 모달(`#evidenceModal`)에 표시한다.

**Tech Stack:** Vanilla JS/CSS(기존 스택 그대로), 신규 의존성 없음.

## Global Constraints

- 실제 존재하지 않는 특정 논문/저자를 인용하지 않는다 — 출처는 실제 기관의 공개 가이드라인(미국피부과학회 AAD, 세계보건기구 WHO) 또는 "일반적으로 알려진 ○○과학 원리"로만 표현한다
- 근거 모달에는 항상 "일반 정보이며 개인차가 있을 수 있고 지속되는 증상은 전문가와 상담 권장" 문구를 표시한다
- 게이지 툴팁 내용은 앱이 실제로 사용하는 판정 기준값(습도 65%/35%, 바람 20km/h, 강수 50%, 자외선 6 등)과 정확히 일치시킨다
- 새 npm 의존성 추가 금지

---

### Task 1: 게이지 CSS 툴팁

**Files:**
- Modify: `public/app.js` (`gaugeHtml` 함수, `renderWeatherPanel`의 호출부)
- Modify: `public/style.css` (`.weather-panel`/`.weather-fx` 조정, `.tooltip-trigger` 신규)

**Interfaces:**
- Produces: `.tooltip-trigger` CSS 클래스 — `data-tooltip` 속성 값을 호버/포커스 시 말풍선으로 보여주는 공용 스타일. Task 2/3의 근거 트리거 버튼도 이 클래스를 재사용한다.
- Produces: `gaugeHtml(label, value, pct, tooltip)` — 기존 3-인자 시그니처에 `tooltip: string` 파라미터 추가.

- [ ] **Step 1: `public/app.js`의 `gaugeHtml` 함수 교체**

`public/app.js`에서 `function gaugeHtml(label, value, pct) {`로 시작하는 함수를 다음으로 교체:
```js
function gaugeHtml(label, value, pct, tooltip) {
  return `
    <div class="gauge-item tooltip-trigger" tabindex="0" data-tooltip="${tooltip}">
      <div class="gauge" style="--pct:${pct}">
        <div class="gauge-inner">${value}</div>
      </div>
      <span class="gauge-label">${label}</span>
    </div>
  `;
}
```

- [ ] **Step 2: `renderWeatherPanel`의 게이지 호출부 수정**

`public/app.js`의 `renderWeatherPanel` 함수 안, 다음 블록:
```js
      <div class="gauge-row">
        ${gaugeHtml("습도", `${Math.round(w.humidity)}%`, w.humidity)}
        ${gaugeHtml("바람", `${Math.round(w.wind)}`, Math.min(100, w.wind * 2.5))}
        ${gaugeHtml("강수", `${Math.round(w.precipProb)}%`, w.precipProb)}
        ${gaugeHtml("자외선", `${Math.round(w.uv)}`, Math.min(100, w.uv * 9))}
      </div>
```
를 다음으로 교체:
```js
      <div class="gauge-row">
        ${gaugeHtml("습도", `${Math.round(w.humidity)}%`, w.humidity, "공기 중 수분 비율이에요. 65% 이상이면 습함, 35% 이하면 건조로 구분해서 추천에 반영해요. 습하면 모발 컬이 풀리기 쉽고, 건조하면 피부·모발 수분이 빠르게 손실돼요.")}
        ${gaugeHtml("바람", `${Math.round(w.wind)}`, Math.min(100, w.wind * 2.5), "시속 풍속(km/h)이에요. 20km/h 이상이면 강풍으로 분류해서 헤어 고정과 아우터를 더 신경 쓰도록 추천해요.")}
        ${gaugeHtml("강수", `${Math.round(w.precipProb)}%`, w.precipProb, "오늘 비가 올 확률이에요. 50% 이상이면 우산·방수 신발을 챙기도록 추천해요.")}
        ${gaugeHtml("자외선", `${Math.round(w.uv)}`, Math.min(100, w.uv * 9), "자외선 지수(UV Index)예요. WHO 기준 0~2 낮음, 3~5 보통, 6~7 높음, 8~10 매우높음, 11+ 위험 등급이며, 6 이상부터 선크림 재도포를 추천해요.")}
      </div>
```

- [ ] **Step 3: `public/style.css`에서 `.weather-panel`/`.weather-fx` 조정**

게이지 위로 뜨는 툴팁이 패널 바깥으로 나가야 잘리지 않는다. 현재 `.weather-panel`이 `overflow: hidden`이라 툴팁이 잘리므로, 그 역할을 `.weather-fx`(둥근 모서리를 상속받도록)로 옮긴다.

`.weather-panel {` 블록(342번째 줄 근처)의 `overflow: hidden;` 줄을 삭제:
```css
.weather-panel {
  position: relative;
  margin-top: 10px;
  border-radius: var(--radius-lg);
  padding: 22px;
  background: linear-gradient(160deg, var(--ink) 0%, color-mix(in srgb, var(--ink) 82%, var(--accent)) 100%);
  color: white;
  box-shadow: var(--shadow-card);
  transition: background 0.5s ease;
}
```

`.weather-fx {` 블록에 `border-radius: inherit;` 추가:
```css
.weather-fx {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
  transition: background 0.6s ease;
}
```

- [ ] **Step 4: `public/style.css`에 `.tooltip-trigger` 추가**

파일 끝에 추가:
```css
/* ============================================================
   공용 툴팁 (게이지, 전문가 팁 트리거에서 재사용)
   ============================================================ */
.tooltip-trigger {
  position: relative;
  cursor: help;
}
.tooltip-trigger::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  width: 200px;
  max-width: 60vw;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: rgba(20, 24, 38, 0.95);
  color: white;
  font-size: 0.72rem;
  line-height: 1.5;
  text-align: left;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 20;
}
.tooltip-trigger:hover::after,
.tooltip-trigger:focus::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
```

- [ ] **Step 5: 회귀 테스트 + 브라우저 확인**

Run: `npm test` — Expected: PASS (기존 테스트 전부, 이번 태스크는 순수 UI라 개수 변화 없음)

```bash
npm start
```
온보딩을 마치고 대시보드 진입 → 습도/바람/강수/자외선 게이지에 마우스를 올려 툴팁이 뜨는지, 패널 밖으로 잘리지 않는지 확인. 비/눈 등 날씨 애니메이션이 여전히 패널의 둥근 모서리 안에서만 보이는지(모서리 밖으로 새지 않는지)도 확인.

- [ ] **Step 6: 커밋**

```bash
git add public/app.js public/style.css
git commit -m "feat: add explanatory tooltips to weather gauges"
```

---

### Task 2: 근거 모달 인프라 + 헤어 카드 연동

**Files:**
- Modify: `public/index.html` (`#hairCard`에 트리거 버튼, `#evidenceModal` 마크업 추가)
- Modify: `public/app.js` (`buildHairRec`에 evidence 추가, 레지스트리·모달 함수, `renderRecommendationCards` 연동, `bindDashboardEvents` 이벤트 바인딩)
- Modify: `public/style.css` (모달/트리거 스타일)

**Interfaces:**
- Produces: `registerEvidence(evidence)` — `evidence: {summary, rationale, source}` → `number`(등록된 인덱스). Task 3이 그대로 재사용.
- Produces: `openEvidenceModal(evidence)` / `closeEvidenceModal()` — 인자 없이 호출하는 `closeEvidenceModal`. Task 3이 그대로 재사용.
- Produces: `buildHairRec`가 반환하는 객체에 `evidence?: {summary, rationale, source}` 필드 추가 (조건에 해당 없으면 `undefined`).

- [ ] **Step 1: `public/index.html`에 헤어카드 트리거 버튼 추가**

`public/index.html`의 다음 블록:
```html
        <article class="rec-card" id="hairCard">
          <h3><span class="card-icon">💇</span>헤어 스타일링</h3>
          <p class="situation"></p>
          <p class="advice"></p>
          <span class="tag"></span>
        </article>
```
을 다음으로 교체:
```html
        <article class="rec-card" id="hairCard">
          <h3><span class="card-icon">💇</span>헤어 스타일링</h3>
          <p class="situation"></p>
          <p class="advice"></p>
          <span class="tag"></span>
          <button type="button" class="evidence-trigger tooltip-trigger" hidden></button>
        </article>
```

- [ ] **Step 2: `public/index.html`에 근거 모달 마크업 추가**

`#mapModal` 블록 바로 다음에 추가:
```html
<div id="evidenceModal" class="map-modal" hidden>
  <div class="map-modal-inner evidence-modal-inner">
    <button type="button" id="evidenceModalClose" class="icon-btn map-modal-close" title="닫기">✕</button>
    <div id="evidenceModalBody" class="evidence-modal-body"></div>
  </div>
</div>
```

- [ ] **Step 3: `public/app.js`의 `buildHairRec`에 evidence 추가**

`public/app.js`의 `buildHairRec` 함수 전체를 다음으로 교체:
```js
const HAIR_EVIDENCE_HUMID_CURLY = {
  summary: "습도가 높으면 모발 큐티클이 부풀어 컬이 쉽게 풀려요.",
  rationale:
    "모발은 케라틴 단백질의 수소결합으로 형태가 유지되는데, 대기 습도가 높아지면 수분이 케라틴에 흡수되며 이 결합이 약해져 웨이브·컬이 쉽게 펴지거나 부스스해져요. 홀드력이 강한 스타일링 제품(스프레이, 무스)은 모발 표면에 방수 피막을 만들어 외부 수분 흡수를 줄여줘요.",
  source: "일반적으로 알려진 모발과학(트라이콜로지) 원리예요.",
};
const HAIR_EVIDENCE_HUMID_STRAIGHT = {
  summary: "습도가 높으면 모발이 붕뜨고 부스스해지기 쉬워요.",
  rationale:
    "습한 공기에서는 모발 표면의 정전기 균형과 큐티클 결이 흐트러지기 쉬워, 직모도 뿌리가 붕 뜨거나 잔머리가 일어나기 쉬워요. 가벼운 고정 스프레이는 모발 표면에 얇은 피막을 형성해 형태를 붙잡아줘요.",
  source: "일반적으로 알려진 모발과학 원리예요.",
};
const HAIR_EVIDENCE_DRY = {
  summary: "건조한 공기는 모발의 수분을 빼앗아 정전기와 갈라짐을 유발해요.",
  rationale:
    "모발 큐티클층이 건조해지면 표면이 거칠어지고 정전기가 발생하기 쉬우며, 모발 내부 수분이 부족하면 끝이 갈라지기 쉬워요. 에센스나 오일 타입 제품은 모발 표면에 유분막을 형성해 수분 증발을 줄여줘요.",
  source: "일반적으로 알려진 모발과학 원리예요.",
};

function buildHairRec(profile, w) {
  const fix = findProduct(profile.products, "hair_fix");
  const moist = findProduct(profile.products, "hair_moisture");
  const isCurly = CURLY_TYPES.includes(profile.hairType);

  let situation, advice, tag, evidence;

  if (w.isRainy || w.isHumid) {
    situation = `습도 ${Math.round(w.humidity)}%${w.isRainy ? " · 비 소식" : ""}`;
    if (isCurly) {
      evidence = HAIR_EVIDENCE_HUMID_CURLY;
      if (fix) {
        advice = `습한 날엔 컬이 쉽게 풀려요. ${fix.name}로 평소보다 고정을 한 단계 더 확실하게 해주는 게 좋아요.`;
        tag = "owned";
      } else {
        advice = `습한 날엔 곱슬·웨이브 모발의 컬이 쉽게 풀려요. 홀드력이 강한 헤어 스프레이나 무스를 준비해두면 스타일이 오래 유지돼요.`;
        tag = "suggested";
      }
    } else {
      evidence = HAIR_EVIDENCE_HUMID_STRAIGHT;
      advice = `직모도 습한 날엔 붕뜸이나 부스스함이 생기기 쉬워요. ${fix ? fix.name + "를 " : "가벼운 고정 스프레이를 "}뿌리 쪽에 살짝 뿌려주면 도움이 돼요.`;
      tag = fix ? "owned" : "neutral";
    }
  } else if (w.isDry) {
    situation = `습도 ${Math.round(w.humidity)}% · 건조`;
    evidence = HAIR_EVIDENCE_DRY;
    if (moist) {
      advice = `건조한 날엔 모발도 정전기와 갈라짐이 생기기 쉬워요. ${moist.name}를 평소보다 조금 더 발라 마무리해주세요.`;
      tag = "owned";
    } else {
      advice = `건조한 날엔 모발 정전기가 심해질 수 있어요. 헤어 에센스나 오일 타입 제품을 발라 마무리하면 도움이 돼요.`;
      tag = "suggested";
    }
  } else {
    situation = `쾌적한 습도 (${Math.round(w.humidity)}%)`;
    advice = `오늘은 습도가 평범해서 평소 루틴 그대로 스타일링해도 좋아요.`;
    tag = "neutral";
  }

  if (w.isWindy) {
    advice += ` 바람이 강한 날이니 스타일링 마무리 고정을 한 번 더 체크해보세요.`;
  }

  return { situation, advice, tag, evidence };
}
```

- [ ] **Step 4: `public/app.js`에 근거 레지스트리 + 모달 함수 추가**

`buildHairRec` 함수 정의 바로 위에 추가:
```js
let evidenceRegistry = [];

function registerEvidence(evidence) {
  evidenceRegistry.push(evidence);
  return evidenceRegistry.length - 1;
}

function renderEvidenceTrigger(trigger, evidence) {
  if (!trigger) return;
  if (!evidence) {
    trigger.hidden = true;
    return;
  }
  trigger.hidden = false;
  trigger.textContent = "💡 전문가 팁";
  trigger.dataset.tooltip = evidence.summary;
  trigger.dataset.evidenceId = registerEvidence(evidence);
}

function openEvidenceModal(evidence) {
  el("evidenceModalBody").innerHTML = `
    <h3>💡 전문가 팁</h3>
    <p class="evidence-summary">${evidence.summary}</p>
    <h4>근거</h4>
    <p class="evidence-rationale">${evidence.rationale}</p>
    <h4>출처</h4>
    <p class="evidence-source">${evidence.source}</p>
    <p class="evidence-disclaimer">이 설명은 일반적인 정보이며 개인 피부·모발 상태에 따라 다를 수 있어요. 증상이 지속되면 전문가와 상담해주세요.</p>
  `;
  el("evidenceModal").hidden = false;
}

function closeEvidenceModal() {
  el("evidenceModal").hidden = true;
}
```

- [ ] **Step 5: `renderRecommendationCards`에서 레지스트리 초기화 + 헤어카드 트리거 렌더링**

`public/app.js`의 `renderRecommendationCards` 함수 시작 부분:
```js
function renderRecommendationCards(rules) {
  const hairCard = el("hairCard");
  hairCard.querySelector(".situation").textContent = rules.hair.situation;
  hairCard.querySelector(".advice").textContent = rules.hair.advice;
  const hairTag = hairCard.querySelector(".tag");
  hairTag.textContent = tagLabel(rules.hair.tag);
  hairTag.className = `tag ${rules.hair.tag}`;
```
를 다음으로 교체:
```js
function renderRecommendationCards(rules) {
  evidenceRegistry = [];

  const hairCard = el("hairCard");
  hairCard.querySelector(".situation").textContent = rules.hair.situation;
  hairCard.querySelector(".advice").textContent = rules.hair.advice;
  const hairTag = hairCard.querySelector(".tag");
  hairTag.textContent = tagLabel(rules.hair.tag);
  hairTag.className = `tag ${rules.hair.tag}`;
  renderEvidenceTrigger(hairCard.querySelector(".evidence-trigger"), rules.hair.evidence);
```

- [ ] **Step 6: `bindDashboardEvents`에 클릭 위임 + 모달 닫기 바인딩 추가**

`public/app.js`의 `bindDashboardEvents` 함수를 다음으로 교체:
```js
function bindDashboardEvents() {
  settingsBtn.addEventListener("click", () => showOnboarding(profile));
  el("aiRecommendBtn").addEventListener("click", requestAiComment);

  el("cardsGrid").addEventListener("click", (e) => {
    const trigger = e.target.closest(".evidence-trigger");
    if (!trigger) return;
    const id = Number(trigger.dataset.evidenceId);
    const evidence = evidenceRegistry[id];
    if (evidence) openEvidenceModal(evidence);
  });
  el("evidenceModalClose").addEventListener("click", closeEvidenceModal);
  el("evidenceModal").addEventListener("click", (e) => {
    if (e.target.id === "evidenceModal") closeEvidenceModal();
  });
}
```

- [ ] **Step 7: `public/style.css`에 모달/트리거 스타일 추가**

파일 끝에 추가:
```css
/* ============================================================
   근거 기반 전문가 팁
   ============================================================ */
.evidence-trigger {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface-soft);
  color: var(--accent-ink);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
}
.evidence-trigger:hover { background: var(--line); }

.evidence-modal-inner {
  height: auto;
  max-height: 80vh;
  overflow-y: auto;
  padding: 32px 26px 26px;
}
.evidence-modal-body h3 { margin: 0 0 10px; font-size: 1.05rem; }
.evidence-modal-body h4 { margin: 16px 0 6px; font-size: 0.85rem; color: var(--ink-soft); }
.evidence-modal-body p { margin: 0; line-height: 1.7; font-size: 0.9rem; }
.evidence-summary { font-weight: 600; }
.evidence-disclaimer { margin-top: 16px; font-size: 0.78rem; color: var(--ink-faint); }
```

- [ ] **Step 8: 회귀 테스트 + 브라우저 확인**

Run: `npm test` — Expected: PASS

```bash
npm start
```
대시보드에서 헤어 스타일링 카드에 "💡 전문가 팁" 버튼이 보이는지(습도가 평범한 날은 버튼이 없어야 함 — 그 경우엔 브라우저 콘솔에서 `renderRecommendationCards({hair: {situation:"", advice:"", tag:"suggested", evidence: HAIR_EVIDENCE_DRY}, skin:[], makeup:null, outfit:{situation:"",advice:""}})`처럼 강제로 호출해 확인 가능) 확인. 버튼에 마우스를 올려 요약 툴팁이 뜨는지, 클릭하면 근거·출처·안내문구가 담긴 모달이 뜨는지, ✕ 버튼과 바깥 클릭으로 닫히는지 확인.

- [ ] **Step 9: 커밋**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "feat: add evidence-based expert tip modal for hair recommendations"
```

---

### Task 3: 스킨케어 카드 연동

**Files:**
- Modify: `public/app.js` (`buildSkinRecs`, `tipBlockHtml`)

**Interfaces:**
- Consumes: Task 2의 `registerEvidence(evidence)`
- Produces: 변경 없음 (`buildSkinRecs`가 반환하는 각 tip에 `evidence?` 필드 추가, `tipBlockHtml(tip)` 시그니처 그대로)

- [ ] **Step 1: `buildSkinRecs`에 evidence 추가**

`public/app.js`의 `buildSkinRecs` 함수 전체를 다음으로 교체:
```js
const SKIN_EVIDENCE_DRY = {
  summary: "건조한 환경에서는 피부 장벽의 수분이 빠르게 증발해요.",
  rationale:
    "각질층(피부 최외곽 장벽)은 세라마이드와 자연보습인자로 수분을 붙잡는데, 대기 습도가 낮으면 피부 표면의 경피수분손실(TEWL)이 늘어나 장벽이 약해지고 당김·각질이 생기기 쉬워요. 보습 크림·로션을 두껍게 발라 폐색막(occlusive layer)을 만들면 수분 증발을 줄일 수 있어요.",
  source: "미국피부과학회(AAD)의 일반 보습 관리 권고와 일치하는 원리예요.",
};
const SKIN_EVIDENCE_UV = {
  summary: "자외선 지수가 높을 때는 자외선 차단이 피부 노화·손상 예방의 핵심이에요.",
  rationale:
    "자외선(UVA/UVB)은 피부 콜라겐을 분해하고 색소침착·광노화를 유발해요. SPF30 이상의 자외선차단제를 충분량 도포하고 2~3시간마다 덧바르는 게 차단 효과를 유지하는 표준적인 방법이에요.",
  source: "미국피부과학회(AAD)와 세계보건기구(WHO)가 공통으로 권고하는 자외선 차단 가이드라인이에요.",
};
const SKIN_EVIDENCE_HUMID = {
  summary: "고온다습 환경에서는 피지 분비가 늘어 유분·번들거림이 쉽게 생겨요.",
  rationale:
    "체온이 오르면 피지선 활동이 증가해 피지 분비가 늘고, 습도가 높으면 땀과 뒤섞여 번들거림·모공 막힘이 쉬워져요. 산뜻한 미스트나 가벼운 텍스처 제품은 무거운 유분 추가 없이 피부를 정돈해줘요.",
  source: "일반적으로 알려진 피부생리학(피지선 기능) 원리예요.",
};

function buildSkinRecs(profile, w) {
  const tips = [];

  if (w.isDry) {
    const m = findProduct(profile.products, "skin_moisture");
    tips.push({
      situation: `습도 ${Math.round(w.humidity)}% · 건조`,
      advice: m
        ? `${m.name}를 평소보다 한 겹 더 덧발라 수분 손실을 막아주세요.`
        : `보습 크림이나 로션을 평소보다 두껍게 발라 수분 손실을 막아주는 게 좋아요.`,
      tag: m ? "owned" : "suggested",
      evidence: SKIN_EVIDENCE_DRY,
    });
  }

  if (w.isHighUV) {
    const s = findProduct(profile.products, "skin_sun");
    tips.push({
      situation: `자외선 지수 ${Math.round(w.uv)}`,
      advice: s
        ? `${s.name}를 아침에 바르고 2~3시간마다 덧바르는 걸 잊지 마세요.`
        : `자외선이 강한 날이에요. SPF 30 이상의 선크림을 준비해서 아침에 바르고 2~3시간마다 덧바르는 걸 추천해요.`,
      tag: s ? "owned" : "suggested",
      evidence: SKIN_EVIDENCE_UV,
    });
  }

  if (w.isHumid || w.tempBand === "hot" || w.tempBand === "very_hot") {
    const mist = findProduct(profile.products, "skin_mist");
    tips.push({
      situation: `고온·다습`,
      advice: mist
        ? `${mist.name}로 중간중간 피부를 가볍게 정돈해주세요. 유분이 늘어날 수 있으니 산뜻한 제품 위주로 마무리하는 걸 추천해요.`
        : `유분이 늘어나기 쉬운 날씨예요. 산뜻한 미스트나 가벼운 텍스처의 제품으로 마무리해보세요.`,
      tag: mist ? "owned" : "suggested",
      evidence: SKIN_EVIDENCE_HUMID,
    });
  }

  if (tips.length === 0) {
    tips.push({
      situation: "평범한 습도·자외선",
      advice: "특별히 신경 쓸 조건은 없어요. 평소 스킨케어 루틴을 유지하세요.",
      tag: "neutral",
    });
  }
  return tips;
}
```

- [ ] **Step 2: `tipBlockHtml`에 트리거 버튼 렌더링 추가**

`public/app.js`의 `tipBlockHtml` 함수 전체를 다음으로 교체:
```js
function tipBlockHtml(tip) {
  const evidenceButton = tip.evidence
    ? `<button type="button" class="evidence-trigger tooltip-trigger" data-tooltip="${tip.evidence.summary}" data-evidence-id="${registerEvidence(tip.evidence)}">💡 전문가 팁</button>`
    : "";
  return `
    <div class="tip-block">
      <p class="situation">${tip.situation}</p>
      <p class="advice">${tip.advice}</p>
      <span class="tag ${tip.tag}">${tagLabel(tip.tag)}</span>
      ${evidenceButton}
    </div>
  `;
}
```

- [ ] **Step 3: 회귀 테스트 + 브라우저 확인**

Run: `npm test` — Expected: PASS

```bash
npm start
```
대시보드의 스킨케어 카드에서 건조/자외선/고온다습 조건에 해당하는 팁마다 "💡 전문가 팁" 버튼이 보이는지, 호버 시 요약, 클릭 시 근거·출처가 담긴 모달이 뜨는지 확인. 실제 날씨에 따라 조건이 다 안 뜰 수 있으므로, 안 뜨는 조건은 개발자 도구 콘솔에서 `renderRecommendationCards({hair: lastRules.hair, skin: [{situation:"테스트", advice:"테스트", tag:"suggested", evidence: SKIN_EVIDENCE_UV}], makeup: lastRules.makeup, outfit: lastRules.outfit})`로 강제 렌더링해 확인 가능.

- [ ] **Step 4: 커밋**

```bash
git add public/app.js
git commit -m "feat: add evidence-based expert tip triggers to skincare recommendations"
```

---

### Task 4: 최종 확인 및 GitHub 푸시

**Files:**
- Verify only

- [ ] **Step 1: 전체 자동 테스트 재실행**

Run: `npm test`
Expected: PASS — 기존 전체 테스트 통과 (이번 작업은 순수 UI라 테스트 개수 변화 없음)

- [ ] **Step 2: Playwright로 실제 동작 확인**

프로젝트 밖 scratchpad에 이미 설치된 Playwright로 다음을 확인하는 스크립트를 실행한다: 온보딩 완료 → 대시보드 진입 → 게이지 호버 시 `::after` 툴팁의 `getComputedStyle(...).opacity`가 0→1로 바뀌는지 → 헤어/스킨 카드의 `.evidence-trigger` 클릭 시 `#evidenceModal`이 `hidden=false`가 되고 `#evidenceModalBody`에 "근거"/"출처" 텍스트가 포함되는지 → 콘솔에 `pageerror`가 없는지.

Expected: 툴팁 표시, 모달 오픈, 콘솔 에러 없음.

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
