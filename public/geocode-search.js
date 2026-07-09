// ============================================================
// 순수 로직: 한국 행정구역 접미사를 붙인 검색어 변형 생성 + 병합/정렬.
// DOM에 의존하지 않아 Node 테스트 러너로 직접 검증 가능.
// ============================================================
const ADMIN_SUFFIXES = ["시", "군", "구", "광역시", "특별시", "특별자치시", "특별자치도"];

function buildSearchQueries(query) {
  const trimmed = (query || "").trim();
  const hasSuffix = ADMIN_SUFFIXES.some((s) => trimmed.endsWith(s));
  const variants = [trimmed];
  if (!hasSuffix) {
    ADMIN_SUFFIXES.forEach((s) => variants.push(trimmed + s));
  }
  return variants;
}

function mergeGeocodingResults(resultLists) {
  const seen = new Set();
  const merged = [];
  resultLists.forEach((results) => {
    (results || []).forEach((r) => {
      const key = `${r.name}|${r.admin1}|${r.admin2}|${r.latitude}|${r.longitude}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(r);
    });
  });
  merged.sort((a, b) => (b.population || 0) - (a.population || 0));
  return merged;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { buildSearchQueries, mergeGeocodingResults };
}
