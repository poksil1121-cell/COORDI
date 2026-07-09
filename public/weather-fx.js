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
