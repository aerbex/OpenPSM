/* ==========================================================================
   Map-based Field Position Picker with INVEKOS Overlay
   ========================================================================== */

import {
  fetchInvekosFields,
  parseCoordinatesFromInput,
  calculateDistance,
  getBboxCenter,
} from "./invekos.js";
import { clearError } from "./ui.js";
import { escapeHtml } from "./utils.js";

let currentMapRowIndex = 0;
let map = null;
let marker = null;
let invekosLayer = null;
let selectedFieldLayer = null;
let loadingControl = null;
let leafletLoaded = false;
let leafletLoadPromise = null;
let currentAbortController = null;
let isModalOpen = false;
let lastFocusedElement = null;
let baseLayer = null;
let orthoLayer = null;
let isOrthoActive = true;
let selectedFieldData = null;
let lastMapView = null;
let geoSession = 0;

const AUSTRIA_CENTER = [47.5162, 14.5501];
const AUSTRIA_ZOOM = 7;
const FIELD_ZOOM = 16;

export function initMapPicker() {
  initMapPickerForRow(0);
  initMapModalEvents();
}

export function initMapPickerForRow(index) {
  const btn = document.getElementById(`btn-map-${index}`);
  if (!btn) return;
  btn.addEventListener("click", () => {
    currentMapRowIndex = index;
    openMapPicker();
  });
}

function initMapModalEvents() {
  const modal = document.getElementById("map-modal");
  const overlay = document.getElementById("map-modal-overlay");
  const closeBtn = document.getElementById("map-modal-close");
  const confirmBtn = document.getElementById("btn-map-confirm");
  const cancelBtn = document.getElementById("btn-map-cancel");

  if (overlay) overlay.addEventListener("click", closeMapPicker);
  if (closeBtn) closeBtn.addEventListener("click", closeMapPicker);
  if (confirmBtn) confirmBtn.addEventListener("click", confirmMapPicker);
  if (cancelBtn) cancelBtn.addEventListener("click", closeMapPicker);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.hasAttribute("hidden")) {
      closeMapPicker();
    }
  });
}

async function ensureLeafletLoaded() {
  if (leafletLoaded || window.L) {
    leafletLoaded = true;
    return;
  }
  if (leafletLoadPromise) {
    return leafletLoadPromise;
  }

  leafletLoadPromise = new Promise((resolve, reject) => {
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    cssLink.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    cssLink.crossOrigin = "";
    document.head.appendChild(cssLink);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "";
    script.onload = () => {
      leafletLoaded = true;
      resolve();
    };
    script.onerror = () => {
      cssLink.remove();
      script.remove();
      leafletLoadPromise = null;
      reject(new Error("Leaflet konnte nicht geladen werden."));
    };
    document.head.appendChild(script);
  });

  return leafletLoadPromise;
}

export async function openMapPicker() {
  const modal = document.getElementById("map-modal");
  if (!modal) return;

  isModalOpen = true;
  lastFocusedElement = document.activeElement;
  clearMapModalError();
  modal.removeAttribute("hidden");
  document.body.style.overflow = "hidden";

  // Focus management: move focus to close button
  const closeBtn = document.getElementById("map-modal-close");
  if (closeBtn) closeBtn.focus();

  try {
    await ensureLeafletLoaded();
  } catch (err) {
    console.warn(err);
    showMapModalError(
      "Kartenbibliothek konnte nicht geladen werden. Bitte prüfen Sie Ihre Internetverbindung."
    );
    return;
  }

  if (!map) {
    initMap();
  }

  // Reset state
  clearMarker();
  clearInvekosOverlays();
  deselectField();

  // Need visible container for Leaflet to measure correctly
  setTimeout(() => {
    if (!map || !isModalOpen) return;
    map.invalidateSize();

    // Bump session so any stale geolocation callbacks from prior opens are ignored
    geoSession++;

    // Determine initial centre only after size is valid
    const locationInput = document.getElementById(`location-${currentMapRowIndex}`);
    const existingCoords = parseCoordinatesFromInput(locationInput?.value);

    if (existingCoords) {
      map.setView([existingCoords.lat, existingCoords.lon], FIELD_ZOOM);
      setMarker(existingCoords.lat, existingCoords.lon);
      loadInvekosOverlays(existingCoords.lon, existingCoords.lat);
    } else if (lastMapView) {
      map.setView(lastMapView.center, lastMapView.zoom);
      if (lastMapView.lat != null && lastMapView.lon != null) {
        setMarker(lastMapView.lat, lastMapView.lon);
        loadInvekosOverlays(lastMapView.lon, lastMapView.lat);
      }
    } else if (navigator.geolocation) {
      const session = geoSession;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!isModalOpen || session !== geoSession) return;
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          map.setView([lat, lon], FIELD_ZOOM);
          setMarker(lat, lon);
          loadInvekosOverlays(lon, lat);
        },
        () => {
          if (!isModalOpen || session !== geoSession) return;
          map.setView(AUSTRIA_CENTER, AUSTRIA_ZOOM);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      map.setView(AUSTRIA_CENTER, AUSTRIA_ZOOM);
    }
  }, 100);
}

export function closeMapPicker() {
  const modal = document.getElementById("map-modal");
  if (!modal) return;
  isModalOpen = false;
  modal.setAttribute("hidden", "");
  document.body.style.overflow = "";

  // Abort any in-flight INVEKOS fetch
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  // Restore focus
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

export function confirmMapPicker() {
  if (selectedFieldData) {
    if (map) {
      lastMapView = {
        center: [map.getCenter().lat, map.getCenter().lng],
        zoom: map.getZoom(),
        lat: selectedFieldData.lat,
        lon: selectedFieldData.lon,
      };
    }
    selectFieldFromMap(selectedFieldData.properties, selectedFieldData.lat, selectedFieldData.lon);
    return;
  }
  if (!marker) return;
  const input = document.getElementById(`location-${currentMapRowIndex}`);
  if (!input) {
    showMapModalError("Fehler: Die zugehörige Fläche wurde entfernt.");
    return;
  }
  const latLng = marker.getLatLng();
  if (map) {
    lastMapView = {
      center: [map.getCenter().lat, map.getCenter().lng],
      zoom: map.getZoom(),
      lat: latLng.lat,
      lon: latLng.lng,
    };
  }
  input.value = `${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)}`;
  clearError(`error-location-${currentMapRowIndex}`);
  closeMapPicker();
}

function initMap() {
  const container = document.getElementById("map-container");
  if (!container || !window.L) return;

  map = window.L.map(container).setView(AUSTRIA_CENTER, AUSTRIA_ZOOM);

  orthoLayer = window.L.tileLayer(
    "https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg",
    {
      attribution: '&copy; <a href="https://basemap.at">basemap.at</a>',
      maxZoom: 19,
      subdomains: ["mapsneu"],
    }
  ).addTo(map);

  baseLayer = window.L.tileLayer(
    "https://mapsneu.wien.gv.at/basemap/geolandbasemap/normal/google3857/{z}/{y}/{x}.png",
    {
      attribution: '&copy; <a href="https://basemap.at">basemap.at</a>',
      maxZoom: 19,
      subdomains: ["mapsneu"],
    }
  );

  const layerToggle = window.L.control({ position: "topright" });
  layerToggle.onAdd = () => {
    const div = window.L.DomUtil.create("div", "map-layer-toggle");
    div.innerHTML = `<button type="button" id="btn-layer-toggle" class="btn-layer-toggle" title="Zwischen Luftbild und Karte wechseln">Karte</button>`;
    div.querySelector("button").addEventListener("click", toggleBaseLayer);
    return div;
  };
  layerToggle.addTo(map);

  map.on("click", (e) => {
    setMarker(e.latlng.lat, e.latlng.lng);
    loadInvekosOverlays(e.latlng.lng, e.latlng.lat);
  });
}

function toggleBaseLayer() {
  if (!map) return;
  const btn = document.getElementById("btn-layer-toggle");
  if (isOrthoActive) {
    map.removeLayer(orthoLayer);
    baseLayer.addTo(map);
    if (btn) {
      btn.textContent = "Luftbild";
      btn.title = "Zu Luftbild wechseln";
    }
  } else {
    map.removeLayer(baseLayer);
    orthoLayer.addTo(map);
    if (btn) {
      btn.textContent = "Karte";
      btn.title = "Zu Karte wechseln";
    }
  }
  isOrthoActive = !isOrthoActive;
}

function setMarker(lat, lon) {
  if (!map || !window.L || !isModalOpen) return;
  if (marker) {
    marker.setLatLng([lat, lon]);
  } else {
    marker = window.L.marker([lat, lon]).addTo(map);
  }
  deselectField();
  setConfirmButtonState(true);
}

function clearMarker() {
  if (marker && map) {
    map.removeLayer(marker);
    marker = null;
  }
  if (!selectedFieldData) {
    setConfirmButtonState(false);
  }
}

function setConfirmButtonState(enabled) {
  const btn = document.getElementById("btn-map-confirm");
  if (btn) btn.disabled = !enabled;
}

async function loadInvekosOverlays(lon, lat) {
  if (!map || !window.L || !isModalOpen) return;
  showLoading(true);

  // Abort previous in-flight fetch
  if (currentAbortController) {
    currentAbortController.abort();
  }
  currentAbortController = new AbortController();

  try {
    const features = await fetchInvekosFields(lon, lat, currentAbortController.signal);
    if (!isModalOpen) return;

    clearInvekosOverlays();

    if (!features || features.length === 0) {
      showLoading(false);
      return;
    }

    // Sort by distance to centre
    const enriched = features.map((f) => {
      const center = getBboxCenter(f.bbox);
      const distance = center
        ? calculateDistance(lat, lon, center.lat, center.lon)
        : Infinity;
      return { feature: f, distance };
    });
    enriched.sort((a, b) => a.distance - b.distance);

    invekosLayer = window.L.geoJSON(
      enriched.map((e) => e.feature),
      {
        style: {
          color: "#2d5a27",
          weight: 2,
          opacity: 0.9,
          fillColor: "#2d5a27",
          fillOpacity: 0.08,
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          const name = props.snar_bezeichnung || "Unbekannter Schlag";
          const area = props.sl_flaeche_brutto_ha;
          const areaText =
            typeof area === "number" ? `${area.toFixed(3)} ha` : "";

          const tooltipHtml = areaText
            ? `${escapeHtml(name)}<br><span style="font-size:0.85em;color:#555">${escapeHtml(areaText)}</span>`
            : escapeHtml(name);

          layer.bindTooltip(tooltipHtml, {
            permanent: true,
            direction: "auto",
            className: "invekos-map-label",
            offset: [0, -5],
          });

          layer.on("click", (e) => {
            window.L.DomEvent.stopPropagation(e);
            const center = getBboxCenter(feature.bbox);
            const fieldLat = center ? center.lat : lat;
            const fieldLon = center ? center.lon : lon;
            selectFieldOnMap(props, fieldLat, fieldLon, layer);
          });
        },
      }
    ).addTo(map);
  } catch (err) {
    if (err.name !== "AbortError") {
      console.warn("INVEKOS overlay fetch failed:", err);
    }
  } finally {
    showLoading(false);
  }
}

function clearInvekosOverlays() {
  if (invekosLayer && map) {
    map.removeLayer(invekosLayer);
    invekosLayer = null;
  }
  selectedFieldLayer = null;
  selectedFieldData = null;
}

function highlightFieldLayer(layer) {
  if (selectedFieldLayer) {
    resetFieldStyle(selectedFieldLayer);
  }
  layer.setStyle({
    color: "#b71c1c",
    weight: 3,
    fillColor: "#b71c1c",
    fillOpacity: 0.2,
  });
  layer.bringToFront();
  selectedFieldLayer = layer;
}

function resetFieldStyle(layer) {
  layer.setStyle({
    color: "#2d5a27",
    weight: 2,
    fillColor: "#2d5a27",
    fillOpacity: 0.08,
  });
}

function selectFieldOnMap(properties, fieldLat, fieldLon, layer) {
  if (selectedFieldLayer === layer) {
    deselectField();
    return;
  }
  if (selectedFieldLayer) {
    deselectField();
  }
  selectedFieldData = { properties, lat: fieldLat, lon: fieldLon };
  highlightFieldLayer(layer);
  if (invekosLayer) {
    invekosLayer.eachLayer((l) => {
      if (l !== layer) {
        l.closeTooltip();
      }
    });
  }
  const btn = document.getElementById("btn-map-confirm");
  if (btn) {
    btn.textContent = "Schlag übernehmen";
    btn.disabled = false;
  }
}

function deselectField() {
  if (selectedFieldLayer) {
    resetFieldStyle(selectedFieldLayer);
    selectedFieldLayer = null;
  }
  selectedFieldData = null;
  if (invekosLayer) {
    invekosLayer.eachLayer((l) => {
      l.openTooltip();
    });
  }
  const btn = document.getElementById("btn-map-confirm");
  if (btn) {
    btn.textContent = "Position übernehmen";
    btn.disabled = !marker;
  }
}

function selectFieldFromMap(properties, userLat, userLon) {
  const plotName = document.getElementById(`plot-name-${currentMapRowIndex}`);
  const location = document.getElementById(`location-${currentMapRowIndex}`);
  const treatedArea = document.getElementById(`treated-area-${currentMapRowIndex}`);
  const plotSizeInvekos = document.getElementById(
    `plot-size-invekos-${currentMapRowIndex}`
  );

  if (!plotName || !location || !treatedArea || !plotSizeInvekos) {
    showMapModalError("Fehler: Die zugehörige Fläche wurde entfernt.");
    return;
  }

  if (!plotName.value && properties.snar_bezeichnung) {
    plotName.value = properties.snar_bezeichnung;
    clearError(`error-plot-name-${currentMapRowIndex}`);
  }

  if (plotSizeInvekos && properties.sl_flaeche_brutto_ha != null) {
    const num = Number(properties.sl_flaeche_brutto_ha);
    if (Number.isFinite(num)) {
      plotSizeInvekos.value = num.toFixed(3);
    }
  }

  if (
    treatedArea &&
    !treatedArea.value &&
    properties.sl_flaeche_brutto_ha != null
  ) {
    const num = Number(properties.sl_flaeche_brutto_ha);
    if (Number.isFinite(num)) {
      treatedArea.value = num.toFixed(3);
      clearError(`error-treated-area-${currentMapRowIndex}`);
    }
  }

  location.value = `${userLat.toFixed(6)}, ${userLon.toFixed(6)}`;
  clearError(`error-location-${currentMapRowIndex}`);

  closeMapPicker();
}

function showLoading(show) {
  if (!map || !window.L) return;
  if (show) {
    if (!loadingControl) {
      loadingControl = window.L.control({ position: "topright" });
      loadingControl.onAdd = () => {
        const div = window.L.DomUtil.create("div", "map-loading-indicator");
        div.textContent = "Schläge werden gesucht…";
        return div;
      };
    }
    loadingControl.addTo(map);
  } else if (loadingControl) {
    map.removeControl(loadingControl);
  }
}

function showMapModalError(message) {
  const el = document.getElementById("map-modal-error");
  if (!el) return;
  el.textContent = message;
  el.removeAttribute("hidden");
}

function clearMapModalError() {
  const el = document.getElementById("map-modal-error");
  if (!el) return;
  el.textContent = "";
  el.setAttribute("hidden", "");
}
