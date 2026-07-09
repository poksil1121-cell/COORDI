# 위치 서비스 개선 & 날씨 패널 애니메이션 — 설계

날짜: 2026-07-09

## 배경

- 현재 지역 설정은 도시 이름 검색(Open-Meteo Geocoding API)만 제공하며, GPS 기반 "현재 위치" 기능이 없다.
- 대시보드의 날씨 패널은 정적인 숫자/게이지만 보여주고, 비·햇빛·자외선 강도를 시각적으로 체감하기 어렵다.

## 범위

1. 위치 서비스 정확도 개선 (GPS 현재 위치 + 도시 검색 결과 개선)
2. 날씨 패널 내부에 비/햇빛·자외선 애니메이션 추가

## 1. 위치 서비스 개선

### 1-A. GPS 기반 "현재 위치 사용"

- 온보딩 1단계 및 설정(프로필 수정) 화면의 지역 검색 필드 옆에 `📍 현재 위치 사용` 버튼을 추가한다.
- 클릭 시 흐름:
  1. `navigator.geolocation` 지원 여부 확인. 미지원이면 "이 브라우저는 위치 서비스를 지원하지 않아요. 도시를 검색해주세요." 안내.
  2. 지원 시 `navigator.geolocation.getCurrentPosition`을 `{ enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }` 옵션으로 호출. 버튼은 로딩 중 "위치를 확인하는 중…" 표시 후 비활성화.
  3. 좌표 확보 성공 시, OpenStreetMap Nominatim 역지오코딩(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=..&lon=..&zoom=10&addressdetails=1`, `Accept-Language: ko`)으로 지명을 조회.
     - 응답의 `address.city || address.town || address.village || address.county` 를 지역명으로, `address.state`를 지역 보조정보로, `address.country`를 국가로 사용해 라벨 구성 (예: "강남구 · 서울특별시 · 대한민국").
     - 역지오코딩 실패(네트워크 오류 등) 시에도 좌표는 유효하므로 이름은 "현재 위치"로 대체하고 계속 진행한다.
  4. 결과를 기존 `selectedCity` 형식 `{ name, latitude, longitude, country }`으로 저장 — 이후 날씨 조회·프로필 저장 로직은 변경 없이 그대로 재사용된다.
- 오류 처리 (`PositionError.code` 기준):
  - `PERMISSION_DENIED` → "위치 권한이 거부됐어요. 브라우저 설정에서 허용하거나 도시를 검색해주세요."
  - `TIMEOUT` / `POSITION_UNAVAILABLE` → "현재 위치를 확인할 수 없어요. 다시 시도하거나 도시를 검색해주세요."
- 실패해도 기존 도시 검색 흐름을 막지 않는다 (버튼 재활성화, 검색창은 그대로 사용 가능).

### 1-B. 도시 검색 결과 정확도 개선

- 검색 결과 개수를 `count=5` → `count=10`으로 확대.
- 동명 지역 구분을 위해 결과 라벨에 `admin1`뿐 아니라 `admin2`(있는 경우)도 포함: `"{name} ({admin2 · }{admin1 · }{country})"`.

## 2. 날씨 패널 애니메이션

### 공통 원칙

- `.weather-panel` 내부에 절대 위치 오버레이 레이어(`.weather-fx`)를 추가하고 그 위에 기존 콘텐츠를 쌓는다. 오버레이는 `pointer-events: none`, `overflow: hidden`으로 기존 레이아웃/클릭에 영향 없음.
- 순수 CSS 애니메이션 + JS로 개수/속도만 동적 결정 (캔버스 없음, 가벼운 DOM 요소 방식).
- `prefers-reduced-motion: reduce`인 사용자에게는 애니메이션을 렌더링하지 않고 정적 상태로 표시.
- `renderWeatherPanel(w)` 호출 시 `w`(분류된 날씨 객체)를 기반으로 `.weather-fx` 내용을 새로 생성.

### 2-A. 비 애니메이션 (강수량 연동)

- 활성 조건: `w.isRainy === true`.
- 강도는 `w.precipSum`(mm, 일일 총 강수량)을 기준으로 4단계:

| 단계 | precipSum 범위 | 빗줄기 개수 | 낙하 속도 | 비고 |
|---|---|---|---|---|
| 이슬비 | 0 ~ 1mm | ~15 | 느림 | 연한 투명도 |
| 약한 비 | 1 ~ 5mm | ~30 | 보통 | |
| 보통 비 | 5 ~ 15mm | ~55 | 빠름 | |
| 강한 비 | 15mm~ | ~90 | 매우 빠름 | 배경에 약한 암전 오버레이 추가 |

- `w.precipSum`이 0이지만 `w.isRainy`가 true인 경우(강수확률 기반 예보), 최소 "이슬비" 단계를 적용해 항상 시각적 신호를 준다.
- 각 빗줄기는 랜덤한 `left`, `animation-delay`, `animation-duration`(단계별 범위 내)을 가진 `<span class="raindrop">` 요소로 생성.

### 2-B. 햇빛·자외선 애니메이션 (자외선 지수 연동)

- 활성 조건: `!w.isRainy && !w.isSnowy` 이고 `w.uv >= 3`.
- 강도는 `w.uv`(`uv_index_max`) 기준 4단계:

| 단계 | uv 범위 | 효과 |
|---|---|---|
| 낮음 | 0 ~ 2 | 애니메이션 없음 (기존 정적 표시 유지) |
| 보통 | 3 ~ 5 | 은은한 글로우 pulse |
| 높음 | 6 ~ 7 | 회전하는 햇살 선 + 옅은 heat-shimmer 물결선 |
| 매우높음 | 8+ | 더 빠른 회전/pulse + 진한 heat-shimmer + 따뜻한 색 오버레이 |

- 구현 요소:
  - `.sun-glow`: `radial-gradient` 기반 pseudo-element, `scale`/`opacity` pulse 애니메이션 (속도는 단계별로 증가).
  - `.sun-rays`: `conic-gradient` 또는 다수의 선형 요소를 중심 기준 회전(`@keyframes rotate`), 회전 속도가 단계별로 증가.
  - `.heat-shimmer`: 하단에 가로로 흐르는 얇은 물결선 여러 개, `skewX`/`opacity`를 오가는 애니메이션으로 아지랑이 표현. 보통 단계 이상에서만 표시.

## 영향 파일

- `public/index.html`: 온보딩 지역 필드에 "현재 위치 사용" 버튼 추가.
- `public/app.js`: 위치 조회 로직, 역지오코딩 호출, 도시 검색 라벨 개선, `renderWeatherPanel`에서 `.weather-fx` 생성 로직 추가.
- `public/style.css`: 위치 버튼 스타일, `.weather-fx`/`.raindrop`/`.sun-glow`/`.sun-rays`/`.heat-shimmer` 애니메이션 정의, `prefers-reduced-motion` 대응.

## 비범위 (Out of scope)

- 대시보드에서 위치를 다시 GPS로 즉시 갱신하는 별도 버튼 (설정 화면을 통해서만 위치 재설정).
- 눈/흐림/바람에 대한 신규 애니메이션 (요청 범위는 비·햇빛/자외선에 한정).
- 실시간(주기적) 위치 추적 — 위치는 한 번 조회 후 프로필에 저장되는 기존 구조를 그대로 따름.
