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

let exploreMap = null;
let exploreClickHandler = null;

function openMapExplorer(lat, lon, callbacks) {
  document.getElementById("mapModal").hidden = false;

  if (!exploreMap) {
    exploreMap = L.map("exploreMap", { zoomControl: true });
    addOsmTileLayer(exploreMap);
  }

  exploreMap.setView([lat, lon], 12);
  setTimeout(() => exploreMap.invalidateSize(), 0);

  if (exploreClickHandler) {
    exploreMap.off("click", exploreClickHandler);
  }
  exploreClickHandler = (e) => handleExploreMapClick(e, callbacks);
  exploreMap.on("click", exploreClickHandler);
}

function closeMapExplorer() {
  document.getElementById("mapModal").hidden = true;
  if (exploreMap) exploreMap.closePopup();
}

async function handleExploreMapClick(e, callbacks) {
  const { lat, lng } = e.latlng;
  const popup = L.popup()
    .setLatLng([lat, lng])
    .setContent('<p class="map-popup-loading">날씨를 조회하는 중…</p>')
    .openOn(exploreMap);

  const html = await callbacks.onFetchWeatherHtml(lat, lng);
  popup.setContent(`
    <div class="map-popup">
      ${html}
      <button type="button" class="btn btn-primary map-popup-select">이 위치로 지역 설정</button>
    </div>
  `);

  const btn = document.querySelector(".leaflet-popup-content .map-popup-select");
  if (btn) {
    btn.addEventListener("click", async () => {
      await callbacks.onSelectLocation(lat, lng);
      closeMapExplorer();
    });
  }
}

document.getElementById("mapModalClose").addEventListener("click", closeMapExplorer);
document.getElementById("mapModal").addEventListener("click", (e) => {
  if (e.target.id === "mapModal") closeMapExplorer();
});
