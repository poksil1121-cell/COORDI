// ============================================================
// 상수
// ============================================================
const STORAGE_KEY = "weatherfit_profile_v1";

const HAIR_LABEL = { straight: "직모", wavy: "반곱슬", curly: "곱슬", coily: "강한 곱슬" };
const SKIN_LABEL = { dry: "건성", oily: "지성", combination: "복합성", sensitive: "민감성" };
const GENDER_LABEL = { female: "여성", male: "남성", other: "선택 안 함" };
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

// 날씨 상태 → accent 컬러 (디자인 토큰의 --accent, --accent-ink를 실시간으로 바꿔줌)
const WEATHER_THEME = {
  sunny: { accent: "#e8a33d", ink: "#7a4d0e", mark: "☀" },
  rainy: { accent: "#4c8bf5", ink: "#1c3d7a", mark: "☔" },
  cloudy: { accent: "#8a93a6", ink: "#3c4356", mark: "☁" },
  snowy: { accent: "#7fd1e0", ink: "#0f5b68", mark: "❄" },
  hot: { accent: "#e8613f", ink: "#8a2c17", mark: "🔥" },
  cold: { accent: "#6e7fe0", ink: "#2c3aa0", mark: "🧊" },
};

// ============================================================
// 상태
// ============================================================
let profile = loadProfile();
let currentStep = 1;
let selectedCity = null; // {name, latitude, longitude, country}
let lastWeather = null;
let lastRules = null;

// ============================================================
// DOM 참조
// ============================================================
const el = (id) => document.getElementById(id);

const onboardingView = el("onboarding");
const dashboardView = el("dashboard");
const homeBtn = el("homeBtn");
const brandMark = el("brandMark");

// ============================================================
// 초기 진입
// ============================================================
init();

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

// ============================================================
// 로컬 저장소
// ============================================================
function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveProfile(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  profile = p;
}

// ============================================================
// 온보딩 (위저드)
// ============================================================
function showOnboarding(prefill) {
  onboardingView.hidden = false;
  dashboardView.hidden = true;
  currentStep = 1;
  renderStep();

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
}

function renderStep() {
  document.querySelectorAll(".wizard-step").forEach((stepEl) => {
    stepEl.classList.toggle("active", Number(stepEl.dataset.step) === currentStep);
  });
  document.querySelectorAll(".step-dot").forEach((dot) => {
    const n = Number(dot.dataset.step);
    dot.classList.toggle("active", n === currentStep);
    dot.classList.toggle("done", n < currentStep);
  });
  if (currentStep === 4) renderSummary();
}

function bindOnboardingEvents() {
  document.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentStep = Number(btn.dataset.next);
      renderStep();
    });
  });
  document.querySelectorAll("[data-prev]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentStep = Number(btn.dataset.prev);
      renderStep();
    });
  });

  el("citySearchBtn").addEventListener("click", handleCitySearch);
  el("useMyLocationBtn").addEventListener("click", handleUseMyLocation);
  el("citySearchInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCitySearch();
    }
  });

  el("addProductBtn").addEventListener("click", () => addProductRow());

  el("finishOnboarding").addEventListener("click", () => {
    const p = collectProfileFromForm();
    saveProfile(p);
    homeBtn.hidden = false;
    showDashboard();
  });
}

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
    const primary =
      addr.borough || addr.city_district || addr.city || addr.town || addr.village || addr.county || "현재 위치";
    const secondary = [addr.city, addr.province, addr.state].find((v) => v && v !== primary);
    return secondary ? `${primary} · ${secondary}` : primary;
  } catch {
    return "현재 위치";
  }
}

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
      if (row.dataset.features) product.features = row.dataset.features;
      if (row.dataset.usage) product.usage = row.dataset.usage;
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

function renderSummary() {
  const p = collectProfileFromForm();
  const productLines =
    p.products.length > 0
      ? p.products.map((pr) => `· ${pr.name} <span style="color:var(--ink-faint)">(${categoryLabel(pr)})</span>`).join("<br/>")
      : "등록된 제품 없음 — 필요할 때 종류를 제안해드릴게요.";

  el("summaryBox").innerHTML = `
    <b>지역</b> ${p.region ? p.region.name : "-"}<br/>
    <b>성별</b> ${GENDER_LABEL[p.gender]} · <b>메이크업 추천</b> ${p.wantsMakeup ? "받음" : "받지 않음"}<br/>
    <b>모발</b> ${HAIR_LABEL[p.hairType]} · <b>피부</b> ${SKIN_LABEL[p.skinType]}<br/><br/>
    <b>보유 제품</b><br/>${productLines}
  `;
}

// ============================================================
// 대시보드
// ============================================================
function bindDashboardEvents() {
  homeBtn.addEventListener("click", () => {
    const confirmed = window.confirm("정말 처음부터 다시 시작하시겠어요? 기존에 입력한 내용이 모두 사라져요.");
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    profile = null;
    selectedCity = null;
    homeBtn.hidden = true;
    showOnboarding();
  });
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

async function showDashboard() {
  onboardingView.hidden = true;
  dashboardView.hidden = false;
  el("cardsGrid").hidden = true;
  el("aiSection").hidden = true;
  el("weatherPanel").innerHTML = `<div class="weather-loading" id="weatherLoading">날씨를 불러오는 중이에요…</div>`;

  if (!profile.region) {
    el("weatherPanel").innerHTML = `<div class="weather-loading">등록된 지역이 없어요. 설정에서 지역을 선택해주세요.</div>`;
    return;
  }

  try {
    const weather = await fetchWeather(profile.region.latitude, profile.region.longitude);
    lastWeather = weather;
    renderWeatherPanel(weather);

    const rules = buildRecommendations(profile, weather);
    lastRules = rules;
    renderRecommendationCards(rules);

    el("cardsGrid").hidden = false;
    el("aiSection").hidden = false;
    el("aiResult").hidden = true;
    el("aiRecommendBtn").disabled = false;
    el("aiRecommendBtn").textContent = "🤖 AI에게 코디 조언 더 받기";
  } catch (err) {
    console.error(err);
    el("weatherPanel").innerHTML = `<div class="weather-loading">날씨 정보를 가져오지 못했어요. 잠시 후 다시 시도해주세요.</div>`;
  }
}

// ── 날씨 조회 ────────────────────────────────────────────
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

// ── 날씨 패널 렌더링 ─────────────────────────────────────
const TEMP_BAND_LABEL = {
  very_hot: "무더움",
  hot: "더움",
  warm: "따뜻함",
  mild: "선선함",
  cool: "쿨함",
  cold: "추움",
  very_cold: "매우 추움",
};

function applyTheme(themeKey) {
  const theme = WEATHER_THEME[themeKey] || WEATHER_THEME.sunny;
  document.documentElement.style.setProperty("--accent", theme.accent);
  document.documentElement.style.setProperty("--accent-ink", theme.ink);
  brandMark.textContent = theme.mark;
}

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
        ${gaugeHtml("습도", `${Math.round(w.humidity)}%`, w.humidity, "공기 중 수분 비율이에요. 65% 이상이면 습함, 35% 이하면 건조로 구분해서 추천에 반영해요. 습하면 모발 컬이 풀리기 쉽고, 건조하면 피부·모발 수분이 빠르게 손실돼요.")}
        ${gaugeHtml("바람", `${Math.round(w.wind)}`, Math.min(100, w.wind * 2.5), "시속 풍속(km/h)이에요. 20km/h 이상이면 강풍으로 분류해서 헤어 고정과 아우터를 더 신경 쓰도록 추천해요.")}
        ${gaugeHtml("강수", `${Math.round(w.precipProb)}%`, w.precipProb, "오늘 비가 올 확률이에요. 50% 이상이면 우산·방수 신발을 챙기도록 추천해요.")}
        ${gaugeHtml("자외선", `${Math.round(w.uv)}`, Math.min(100, w.uv * 9), "자외선 지수(UV Index)예요. WHO 기준 0~2 낮음, 3~5 보통, 6~7 높음, 8~10 매우높음, 11+ 위험 등급이며, 6 이상부터 선크림 재도포를 추천해요.")}
      </div>

      <div id="dashboardMiniMap" class="mini-map"></div>
    </div>
  `;

  renderWeatherFx(el("weatherFx"), w);
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
}

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

// ============================================================
// 규칙 기반 추천 엔진
// ============================================================
function findProduct(products, category) {
  return (products || []).find((p) => p.category === category);
}

const CURLY_TYPES = ["wavy", "curly", "coily"];

function buildRecommendations(profile, w) {
  return {
    hair: buildHairRec(profile, w),
    skin: buildSkinRecs(profile, w),
    makeup: profile.wantsMakeup ? buildMakeupRecs(profile, w) : null,
    outfit: buildOutfitRec(w),
  };
}

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

function buildMakeupRecs(profile, w) {
  const tips = [];

  if (w.isHumid || w.tempBand === "hot" || w.tempBand === "very_hot") {
    const fixer = findProduct(profile.products, "makeup_fix");
    const oilc = findProduct(profile.products, "makeup_oilcontrol");
    let advice = fixer
      ? `베이스 마무리 후 ${fixer.name}로 픽싱해주세요.`
      : `픽서 스프레이로 마무리하면 화장이 오래 유지돼요. 없다면 픽싱 기능이 있는 제품을 구비해보세요.`;
    if (oilc) advice += ` 중간중간 ${oilc.name}로 유분만 가볍게 정리하면 더 오래가요.`;
    tips.push({ situation: "고온·다습 · 화장 무너짐 주의", advice, tag: fixer ? "owned" : "suggested" });
  }

  if (w.isRainy) {
    tips.push({
      situation: "비 · 습기",
      advice: "워터프루프 마스카라나 아이라이너 위주로 사용하면 무너짐이 덜해요.",
      tag: "neutral",
    });
  }

  if (w.isDry) {
    tips.push({
      situation: "건조",
      advice: "매트한 파우더 베이스보다는 수분감 있는 베이스로 당김을 줄여보세요.",
      tag: "neutral",
    });
  }

  if (tips.length === 0) {
    tips.push({ situation: "평범한 날씨", advice: "평소 즐기시는 메이크업 그대로 좋아요.", tag: "neutral" });
  }
  return tips;
}

const OUTFIT_BASE = {
  very_hot: "민소매나 반팔처럼 통풍이 잘 되는 옷차림이 좋아요.",
  hot: "반팔이나 얇은 셔츠 위주로 가볍게 입으세요.",
  warm: "얇은 가디건이나 긴팔 한 장이면 충분해요.",
  mild: "얇은 니트나 자켓을 겹쳐 입기 좋은 날씨예요.",
  cool: "자켓이나 가벼운 코트를 챙기세요.",
  cold: "코트와 니트, 목도리를 준비하세요.",
  very_cold: "패딩과 목도리·장갑까지 챙기는 걸 추천해요.",
};

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

// ============================================================
// 카드 렌더링
// ============================================================
function renderRecommendationCards(rules) {
  evidenceRegistry = [];

  const hairCard = el("hairCard");
  hairCard.querySelector(".situation").textContent = rules.hair.situation;
  hairCard.querySelector(".advice").textContent = rules.hair.advice;
  const hairTag = hairCard.querySelector(".tag");
  hairTag.textContent = tagLabel(rules.hair.tag);
  hairTag.className = `tag ${rules.hair.tag}`;
  renderEvidenceTrigger(hairCard.querySelector(".evidence-trigger"), rules.hair.evidence);

  el("skinCard").querySelector(".skin-tips").innerHTML = rules.skin.map(tipBlockHtml).join("");

  const makeupCard = el("makeupCard");
  if (rules.makeup) {
    makeupCard.hidden = false;
    makeupCard.querySelector(".makeup-tips").innerHTML = rules.makeup.map(tipBlockHtml).join("");
  } else {
    makeupCard.hidden = true;
  }

  const outfitCard = el("outfitCard");
  outfitCard.querySelector(".situation").textContent = rules.outfit.situation;
  outfitCard.querySelector(".advice").textContent = rules.outfit.advice;
}

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

function tagLabel(tag) {
  if (tag === "owned") return "보유 제품 활용";
  if (tag === "suggested") return "신규 제품 제안";
  return "참고";
}

// ============================================================
// AI 코멘트 (선택 기능 — 서버의 /api/recommend 호출)
// ============================================================
async function requestAiComment() {
  const btn = el("aiRecommendBtn");
  const resultBox = el("aiResult");

  btn.disabled = true;
  btn.textContent = "AI가 코디를 정리하는 중…";
  resultBox.hidden = false;
  resultBox.className = "ai-result";
  resultBox.innerHTML = `<span class="ai-badge">AI</span><br/>잠시만 기다려주세요…`;

  try {
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, weather: lastWeather, rules: lastRules }),
    });
    const data = await res.json();

    if (!res.ok) {
      resultBox.className = "ai-result error";
      resultBox.innerHTML = `<span class="ai-badge">AI</span><br/>${data.error || "AI 추천을 가져오지 못했어요."}`;
    } else {
      resultBox.innerHTML = `<span class="ai-badge">AI</span><br/>${escapeHtml(data.comment)}`;
    }
  } catch (err) {
    resultBox.className = "ai-result error";
    resultBox.innerHTML = `<span class="ai-badge">AI</span><br/>서버에 연결할 수 없어요. npm start로 서버가 실행 중인지 확인해주세요.`;
  } finally {
    btn.disabled = false;
    btn.textContent = "🤖 AI에게 코디 조언 더 받기";
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML.replace(/\n/g, "<br/>");
}
