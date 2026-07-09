// ============================================================
// Leaflet 지도 렌더링 전용 모듈.
// 날씨 조회/저장 로직은 모르며, app.js가 콜백으로 필요한 걸 넘겨준다.
// ============================================================
function destroyMapIfExists(container) {
  if (container._leafletMap) {
    container._leafletMap.remove();
    container._leafletMap = null;
  }
}

function addOsmTileLayer(map) {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18,
  }).addTo(map);
}

function createMiniMap(container, lat, lon, onClick) {
  if (!container || typeof L === "undefined") return;
  destroyMapIfExists(container);

  const map = L.map(container, {
    center: [lat, lon],
    zoom: 12,
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    touchZoom: false,
    keyboard: false,
  });
  addOsmTileLayer(map);
  L.marker([lat, lon]).addTo(map);

  container._leafletMap = map;

  if (onClick) {
    container.style.cursor = "pointer";
    container.addEventListener("click", onClick);
  }
}
