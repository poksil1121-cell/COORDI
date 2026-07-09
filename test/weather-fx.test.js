const test = require("node:test");
const assert = require("node:assert/strict");
const { computeRainFx, computeSunFx } = require("../public/weather-fx.js");

test("computeRainFx returns null when not rainy", () => {
  assert.equal(computeRainFx({ isRainy: false, precipSum: 20 }), null);
});

test("computeRainFx buckets precipSum into drizzle/light/moderate/heavy tiers", () => {
  assert.equal(computeRainFx({ isRainy: true, precipSum: 0 }).tier, "drizzle");
  assert.equal(computeRainFx({ isRainy: true, precipSum: 3 }).tier, "light");
  assert.equal(computeRainFx({ isRainy: true, precipSum: 10 }).tier, "moderate");
  assert.equal(computeRainFx({ isRainy: true, precipSum: 25 }).tier, "heavy");
});

test("computeRainFx marks only the heavy tier as a dark overlay", () => {
  assert.equal(computeRainFx({ isRainy: true, precipSum: 25 }).dark, true);
  assert.equal(computeRainFx({ isRainy: true, precipSum: 3 }).dark, false);
});

test("computeSunFx returns null when rainy, snowy, or uv below 3", () => {
  assert.equal(computeSunFx({ isRainy: true, isSnowy: false, uv: 9 }), null);
  assert.equal(computeSunFx({ isRainy: false, isSnowy: true, uv: 9 }), null);
  assert.equal(computeSunFx({ isRainy: false, isSnowy: false, uv: 2 }), null);
});

test("computeSunFx buckets uv into moderate/high/veryHigh tiers", () => {
  assert.equal(computeSunFx({ isRainy: false, isSnowy: false, uv: 4 }).tier, "moderate");
  assert.equal(computeSunFx({ isRainy: false, isSnowy: false, uv: 7 }).tier, "high");
  assert.equal(computeSunFx({ isRainy: false, isSnowy: false, uv: 11 }).tier, "veryHigh");
});

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
