# 오늘 웨더핏 — 날씨 기반 맞춤 코디 서비스

기온·습도·바람·강수량 데이터를 받아와서 그날의 **헤어 스타일링 / 스킨케어 / (선택) 메이크업 / 코디**를
추천해주는 개인 맞춤 웹 서비스입니다. 처음 실행할 때 등록한 보유 제품을 기준으로,
상황에 맞는 제품이 있으면 그 제품을 활용하는 법을, 없으면 어떤 종류의 제품이 필요한지 제안합니다.

- 날씨 데이터: [Open-Meteo](https://open-meteo.com) — API 키 없이 바로 사용 가능
- AI 맞춤 코멘트(선택): Anthropic Claude API — 이 기능만 API 키가 필요해요

---

## 1. VS Code에서 열기

1. 압축을 풀고 폴더 전체를 VS Code로 엽니다. (`code weather-styling-app` 또는 File → Open Folder)
2. VS Code 하단 터미널을 엽니다: `` Ctrl(⌘) + ` ``
3. Node.js 18 이상이 필요합니다. 설치되어 있는지 확인:
   ```bash
   node -v
   ```
   없다면 https://nodejs.org 에서 LTS 버전을 설치하세요.

## 2. 설치 및 실행

```bash
npm install
npm start
```

터미널에 `✅ 서버가 실행되었어요: http://localhost:3000` 이 보이면
브라우저에서 **http://localhost:3000** 으로 접속하세요.

코드를 수정하면서 바로 반영해서 보고 싶다면:
```bash
npm run dev
```

## 3. (선택) AI 맞춤 코멘트 기능 켜기

이 기능은 규칙 기반 추천을 더 자연스러운 문장으로 다듬어주는 **보너스 기능**이에요.
설정하지 않아도 헤어/스킨/메이크업/코디 추천은 정상적으로 동작합니다.

1. 프로젝트 루트의 `.env.example`을 복사해서 `.env` 파일을 만듭니다.
   ```bash
   cp .env.example .env
   ```
2. https://console.anthropic.com 에서 API 키를 발급받아 `.env`의 `ANTHROPIC_API_KEY`에 넣습니다.
3. 서버를 다시 시작하면 (`npm start`) 대시보드의 **"🤖 AI에게 코디 조언 더 받기"** 버튼이 동작합니다.

> 비용이 걱정된다면 `.env`의 `ANTHROPIC_MODEL`을 `claude-haiku-4-5-20251001`로 바꿔보세요.

---

## 사용 흐름

1. **처음 실행 시 온보딩**
   - 성별 / 메이크업 추천 여부 / 지역 검색
   - 모발 타입, 피부 타입
   - 보유 중인 제품 등록 (제품명 + 카테고리 선택) — 없으면 비워둬도 됩니다
2. **대시보드**
   - 오늘 날씨(기온, 습도, 바람, 강수확률, 자외선)를 계기판 형태로 표시
   - 헤어 / 스킨케어 / (선택) 메이크업 / 코디 카드가 상황에 맞게 자동 생성
     - `보유 제품 활용` 태그: 등록한 제품 중 딱 맞는 게 있어서 그걸로 추천
     - `신규 제품 제안` 태그: 등록한 제품이 없어서 어떤 종류가 필요한지 제안
   - "AI에게 코디 조언 더 받기" 버튼으로 더 자연스러운 코멘트 받기 (선택)
3. **프로필 수정**
   - 우측 상단 ⚙ 아이콘으로 언제든 지역 / 모발·피부 타입 / 보유 제품을 다시 편집할 수 있어요

프로필 데이터는 브라우저의 `localStorage`에만 저장되며, 별도 서버 DB에는 저장되지 않습니다.

---

## 폴더 구조

```
weather-styling-app/
├── package.json
├── .env.example        # 복사해서 .env로 사용
├── server.js           # Express 서버 + /api/recommend (AI 코멘트)
└── public/
    ├── index.html      # 온보딩 + 대시보드 화면
    ├── style.css        # 날씨 상태에 따라 accent 컬러가 바뀌는 디자인
    └── app.js           # 날씨 조회, 규칙 기반 추천 엔진, AI 연동
```

## 추천 로직을 바꾸고 싶다면

`public/app.js`의 아래 함수들을 수정하면 됩니다.

- `buildHairRec` — 습도/강수/바람 조건에 따른 헤어 추천
- `buildSkinRecs` — 건조/자외선/고온다습 조건에 따른 스킨케어 추천
- `buildMakeupRecs` — 메이크업 추천 (온보딩에서 "메이크업 추천 받기"를 켠 경우만 노출)
- `buildOutfitRec` / `OUTFIT_BASE` — 기온대별 코디 추천 문구

새로운 제품 카테고리를 추가하려면 `index.html`의 `#productRowTemplate`과
`style.css`, `app.js`의 `CATEGORY_LABEL`을 함께 업데이트해주세요.
