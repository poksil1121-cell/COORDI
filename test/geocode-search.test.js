const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSearchQueries, mergeGeocodingResults } = require("../public/geocode-search.js");

test("buildSearchQueries appends admin suffixes when the query has none", () => {
  const variants = buildSearchQueries("안양");
  assert.ok(variants.includes("안양"));
  assert.ok(variants.includes("안양시"));
  assert.ok(variants.includes("안양광역시"));
  assert.equal(variants.length, 8);
});

test("buildSearchQueries does not double up when the query already ends with a suffix", () => {
  assert.deepEqual(buildSearchQueries("안양시"), ["안양시"]);
  assert.deepEqual(buildSearchQueries("광주광역시"), ["광주광역시"]);
});

test("mergeGeocodingResults dedupes identical entries across lists", () => {
  const a = { name: "안양", admin1: "x", admin2: "y", latitude: 1, longitude: 1 };
  const b = { name: "안양시", admin1: "경기도", admin2: "안양시", latitude: 2, longitude: 2, population: 595644 };
  const bDup = { ...b };
  const merged = mergeGeocodingResults([[a, b], [bDup]]);
  assert.equal(merged.length, 2);
});

test("mergeGeocodingResults sorts entries with population first, descending", () => {
  const small = { name: "광주시", admin1: "경기도", latitude: 1, longitude: 1, population: 81780 };
  const big = { name: "광주광역시", admin1: "광주광역시", latitude: 2, longitude: 2, population: 1401235 };
  const unknown = { name: "광주", admin1: "충청남도", latitude: 3, longitude: 3 };
  const merged = mergeGeocodingResults([[unknown, small, big]]);
  assert.deepEqual(merged.map((r) => r.name), ["광주광역시", "광주시", "광주"]);
});
