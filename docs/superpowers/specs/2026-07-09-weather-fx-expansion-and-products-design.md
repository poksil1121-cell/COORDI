# 날씨 애니메이션 전체 확장 & 제품 카테고리/자동완성 — 설계

날짜: 2026-07-09

## 배경

- 현재 `public/weather-fx.js`는 비(`computeRainFx`)와 햇빛·자외선(`computeSunFx`)만 지원한다.
- 온보딩의 "보유 제품" 카테고리는 9개로 제한적이고, "기타" 선택 시 별도 입력 수단이 없다.
- 제품 이름은 완전 자유 입력이라, 실제로 잘 알려진 제품을 등록해도 성분/사용법 정보를 얻을 수 없다.

## 범위

1. 날씨 애니메이션을 흐림/안개/황사·미세먼지/우박/눈/번개/폭풍(강풍+비)까지 확장
2. 보유 제품 카테고리 다양화 + "기타" 선택 시 직접 입력 필드 추가
3. 잘 알려진 제품에 대한 앱 내장 데이터셋 기반 자동완성 (성분 대신 "주요 특징" + 사용법, 실시간 외부 연동 아님을 명시)

## 1. 날씨 애니메이션 확장

### 데이터 소스

- 기존 Open-Meteo Forecast API의 `weather_code`(WMO 코드)를 그대로 활용:
  - 안개: `45`, `48`
  - 흐림: `2`(partly cloudy), `3`(overcast)
  - 뇌우: `95`, `96`, `99` (번개 트리거)
  - 우박: `96`, `99` (뇌우 + 우박)
- 황사/미세먼지는 새 데이터 소스가 필요 — **Open-Meteo Air Quality API**(무료, 키 불필요)를 추가 호출:
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=..&longitude=..&current=pm10,pm2_5,dust&timezone=auto`
  응답 예: `current: { pm10, pm2_5, dust }` (단위 µg/m³). `fetchWeather`와 함께 `Promise.all`로 호출해 `classifyWeather`에 전달할 원본 데이터에 병합한다.
- 태풍은 Open-Meteo에 전용 코드가 없으므로, **강풍(시속 50km 이상) + 비/우박이 겹칠 때**를 "폭풍" 상태로 간주하는 휴리스틱으로 처리한다 (공식 태풍 특보 연동이 아님을 스펙/코드 주석에 남긴다).

### 우선순위 (하늘 상태는 한 번에 하나만 렌더링)

```
우박 > 눈 > 비 > 황사/미세먼지 > 안개 > 흐림 > 햇빛·자외선(기존) > (맑음, 효과 없음)
```

추가로 겹쳐지는(additive) 효과:
- **번개**: `weather_code`가 95/96/99일 때, 위 하늘 상태 위에 랜덤한 흰색 플래시 오버레이가 겹쳐진다 (우박/비 레이어와 함께 표시).
- **폭풍 강화**: `(isRainy || isHail) && wind >= 50` 일 때, 선택된 비/우박 레이어의 강도를 한 단계 강제로 올리고(예: 강수량이 적어도 최소 "강한" 등급으로), 어두운 오버레이와 대각선 강풍 줄무늬를 추가한다.

### 강도 계산 함수 (`public/weather-fx.js`에 순수 함수로 추가)

기존 `computeRainFx`, `computeSunFx`는 그대로 유지하고, 다음을 추가한다:

- `computeHailFx(w)`: `w.code`가 96/99일 때만 활성. `precipSum` 기준 4단계(가벼운 우박~심한 우박), 심한 단계는 어두운 오버레이 동반.
- `computeSnowFx(w)`: `w.isSnowy`일 때만 활성. `precipSum` 기준 4단계, 심한 단계는 밝은(눈 반사) 오버레이 동반.
- `computeHazeFx(w)`: `w.pm10`, `w.dust` 기준. `pm10 >= 81` 또는 `dust >= 40`일 때 활성. 등급 "나쁨"(81~150) / "매우나쁨"(151+), `dust >= 40`이면 황색 톤(황사), 아니면 회색 톤(미세먼지).
- `computeFogFx(w)`: `w.code`가 45/48일 때만 활성. 단일 강도(옅은 물결 안개 밴드).
- `computeCloudFx(w)`: `w.code`가 2/3일 때만 활성. 2=옅은 구름 조각 2개, 3=더 짙은 구름 조각 4개.
- `computeLightningFx(w)`: `w.code`가 95/96/99일 때만 활성. 96/99(우박 동반)는 더 빠르고 밝은 플래시.
- `computeStormFx(w)`: `(w.isRainy || [96,99].includes(w.code)) && w.wind >= 50`일 때만 활성.
- `computeSkyFx(w)`: 위 함수들을 우선순위대로 호출해 **하나의 하늘 상태**를 고르는 리졸버. `computeStormFx`가 활성이면 선택된 rain/hail 결과의 강도를 한 단계 올린다. `renderWeatherFx`는 `computeSkyFx`와 `computeLightningFx`만 호출하면 된다.

### 시각 요소

| 상태 | 요소 | 설명 |
|---|---|---|
| 우박 | `.hailstone` | 통통 튀는 작은 원, 낙하 후 살짝 바운스 |
| 눈 | `.snowflake` | 좌우로 흔들리며 천천히 낙하하는 원 |
| 황사/미세먼지 | `.haze-particle` + 배경 틴트 | 떠다니는 작은 입자 + 반투명 색 오버레이(회색/황색) |
| 안개 | `.fog-band` | 좌우로 느리게 흐르는 반투명 가로 밴드 3개 |
| 흐림 | `.cloud-blob` | 부드러운 타원형 블롭이 좌우로 느리게 드리프트 |
| 번개 | `.lightning-flash` | 화면 전체를 짧게 밝히는 흰색 플래시 (opacity 0→1→0) |
| 폭풍 | `.wind-streak` + 암전 | 대각선 줄무늬 + 어두운 오버레이 |

기존 원칙 유지: `.weather-fx` 오버레이 안에서만 렌더링, `pointer-events: none`, `prefers-reduced-motion: reduce`면 애니메이션 없음.

## 2. 제품 카테고리 다양화 + 직접 입력

### 카테고리 확장 (9개 → 15개)

| key | 라벨 | 그룹 |
|---|---|---|
| hair_fix | 헤어 고정 (스프레이/무스/젤) | 헤어 |
| hair_moisture | 헤어 보습/영양 (에센스/오일) | 헤어 |
| hair_treatment | 헤어 트리트먼트/팩 **(신규)** | 헤어 |
| scalp_care | 두피 케어 **(신규)** | 헤어 |
| skin_moisture | 스킨 보습 (크림/로션) | 스킨 |
| skin_toner | 토너/스킨 **(신규)** | 스킨 |
| skin_serum | 에센스/세럼/앰플 **(신규)** | 스킨 |
| skin_mist | 스킨 미스트/수분 부스터 | 스킨 |
| skin_sun | 선크림/자외선 차단 | 스킨 |
| skin_soothing | 진정 케어 **(신규)** | 스킨 |
| makeup_base | 메이크업 베이스(프라이머/파운데이션) | 메이크업 |
| makeup_fix | 메이크업 픽서 스프레이 | 메이크업 |
| makeup_oilcontrol | 피지컨트롤/파우더 | 메이크업 |
| makeup_lip | 립 제품 **(신규)** | 메이크업 |
| other | 기타 (직접 입력) | - |

### "기타" 직접 입력

- `category`가 `other`로 바뀌면 그 아래에 텍스트 입력(`.product-custom-category`)이 나타남 (그 외엔 `hidden`).
- 저장 형식: `{ name, category: "other", customCategory: "향수" }`.
- 요약/카드 등에서 카테고리 라벨을 표시할 때, `category === "other" && customCategory`이면 `customCategory` 값을 대신 표시.

### 비범위

- 규칙 기반 추천 엔진(`buildHairRec`/`buildSkinRecs`/`buildMakeupRecs`)은 기존 7개 카테고리만 계속 참조한다. 신규 8개 카테고리(트리트먼트/두피/토너/세럼/진정/립/커스텀)는 이번 작업에서는 "보유 제품 목록"에만 저장되고 추천 로직에는 연결하지 않는다 (범위가 커서 별도 작업으로 분리).

## 3. 제품 자동완성 (내장 데이터셋)

### 데이터 파일: `public/product-catalog.js`

브라우저 전역 배열 `PRODUCT_CATALOG`을 선언 (모듈 시스템 없음, 기존 `weather-fx.js`와 동일한 로딩 방식). 각 항목:

```js
{
  name: "제품명 (브랜드 제외)",
  brand: "브랜드명",
  category: "위 15개 카테고리 key 중 하나",
  features: "마케팅 레벨 주요 특징 한 문장",
  usage: "간단한 사용법 한 문장",
  aliases: ["검색용 별칭", ...]
}
```

초기 데이터셋(21개, 15개 카테고리 모두 최소 1개 이상 커버) — 실제로 올리브영 등에서 판매되는 잘 알려진 제품 위주로 선정:

1. 아토베리어 365 크림 (에스트라) — skin_moisture
2. 자작나무 수분크림 (라운드랩) — skin_moisture
3. 모이스처라이징 크림 (세타필) — skin_moisture
4. 그린티 씨드 스킨 (이니스프리) — skin_toner
5. 그린티 씨드 세럼 (이니스프리) — skin_serum
6. 다이브인 저분자 히알루론산 세럼 (토리든) — skin_serum
7. 타임레볼루션 퍼스트 트리트먼트 에센스 (미샤) — skin_serum
8. 떼르말 워터 (라로슈포제) — skin_mist
9. 레드 블레미쉬 클리어 선크림 (닥터지) — skin_sun
10. 안텔리오스 선크림 (라로슈포제) — skin_sun
11. 시카페어 크림 (닥터자르트) — skin_soothing
12. 킬커버 파운웨어 파운데이션 (클리오) — makeup_base
13. 픽싱 미스트 (에뛰드하우스) — makeup_fix
14. 노세범 미네랄 파우더 (이니스프리) — makeup_oilcontrol
15. 잉크 벨벳 립틴트 (페리페라) — makeup_lip
16. 함빛 모발 에센스 (려) — hair_moisture
17. 퍼펙트 오리지널 리페어 세럼 (미쟝센) — hair_moisture
18. 자양윤모 트리트먼트 (려) — hair_treatment
19. TS 샴푸 (TS) — scalp_care
20. 홀드 스프레이 (아모스) — hair_fix
21. 워터슬리핑 마스크 (라네즈) — skin_moisture

각 항목의 `features`/`usage`는 일반적으로 알려진 제품 설명 수준의 요약이며, 정확한 전성분표가 아니다.

### 자동완성 UI

- 온보딩 3단계 제품 입력창(`.product-name`)에 입력할 때마다 `PRODUCT_CATALOG`에서 이름/별칭에 부분일치(대소문자 무시)하는 항목을 최대 6개까지 드롭다운으로 표시.
- 드롭다운 항목 클릭 시:
  - 입력값을 `"브랜드 제품명"` 형태로 채움
  - 해당 행의 카테고리 `<select>`를 자동으로 해당 카테고리로 변경
  - 행 하단에 "✓ {features} · 사용법: {usage}" 안내 텍스트를 표시
  - 매칭된 `features`/`usage`는 해당 행의 `dataset`에 저장해두고, 저장 시 `profile.products[i]`에 함께 기록
- 목록에 없는 제품은 그대로 자유 입력 — 이 경우 `features`/`usage`는 저장하지 않음.
- 사용자가 매칭된 이름을 수정하면 저장된 `features`/`usage`/안내 텍스트는 초기화됨(더 이상 일치하지 않으므로).
- 화면 하단(제품 목록 영역)에 상시 안내 문구를 표시: "제품 정보는 참고용 요약이며, 정확한 성분은 제품 패키지나 판매처에서 확인해주세요."

## 영향 파일

- `public/weather-fx.js`: 신규 순수 함수(`computeHailFx`, `computeSnowFx`, `computeHazeFx`, `computeFogFx`, `computeCloudFx`, `computeLightningFx`, `computeStormFx`, `computeSkyFx`) 추가, `renderWeatherFx`를 새 리졸버 기반으로 재작성.
- `public/app.js`: `fetchWeather` 호출부에 대기질 API 병합 로직 추가, `classifyWeather`에 코드 기반 플래그(`isFoggy`, `isCloudy`, `isHail`, `isThunder`) 추가, `CATEGORY_LABEL` 확장, 제품 행 렌더링/수집 로직에 자동완성·커스텀 카테고리 입력 반영.
- `public/index.html`: 제품 행 템플릿에 커스텀 카테고리 입력·자동완성 드롭다운 컨테이너·안내 문구 추가.
- `public/style.css`: 신규 애니메이션 요소 스타일, 자동완성 드롭다운/안내 문구 스타일.
- `public/product-catalog.js` (신규): `PRODUCT_CATALOG` 데이터.
- `test/weather-fx.test.js`: 신규 함수들에 대한 테스트 추가.

## 비범위 (Out of scope)

- 실시간 올리브영/브랜드 API 연동 (그런 공개 API가 존재하지 않음).
- 정확한 전성분표(INCI) 제공 — "주요 특징" 요약 수준으로 한정.
- 태풍 특보 실시간 연동 (강풍+비 기반 휴리스틱으로 대체).
- 신규 제품 카테고리를 규칙 기반 추천 엔진에 연결하는 작업.
