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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { computeRainFx, computeSunFx };
}
