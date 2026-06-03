/* ==========================================================================
   INVEKOS Schlag-Suche
   ========================================================================== */

import { INVEKOS_API_BASE, INVEKOS_BBOX_DELTA, INVEKOS_FETCH_TIMEOUT_MS, INVEKOS_RESULT_LIMIT } from "./constants.js";
import { escapeHtml } from "./utils.js";
import { clearError } from "./ui.js";

function getInvekosCollectionName() {
  const now = new Date();
  const year = now.getFullYear();
  return `i009501:invekos_schlaege_${year}_1_polygon`;
}

export function parseCoordinatesFromInput(value) {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lon = parseFloat(match[2]);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getBboxCenter(bbox) {
  if (!Array.isArray(bbox) || bbox.length < 4) return null;
  return {
    lon: (bbox[0] + bbox[2]) / 2,
    lat: (bbox[1] + bbox[3]) / 2,
  };
}

let currentInvekosRowIndex = 0;

export function initInvekosSearch() {
  initInvekosSearchForRow(0);
}

export function initInvekosSearchForRow(index) {
  const btn = document.getElementById(`btn-invekos-${index}`);
  if (!btn) return;
  btn.addEventListener("click", () => {
    currentInvekosRowIndex = index;
    openInvekosSearch();
  });
}

export function openInvekosSearch() {
  const locationInput = document.getElementById(`location-${currentInvekosRowIndex}`);
  let coords = null;
  if (locationInput && locationInput.value) {
    coords = parseCoordinatesFromInput(locationInput.value);
  }

  if (coords) {
    showInvekosModal();
    runInvekosQuery(coords.lon, coords.lat);
    return;
  }

  if (!navigator.geolocation) {
    showInvekosModalError("Geolocation wird von diesem Browser nicht unterstützt. Bitte geben Sie Koordinaten manuell ein.");
    return;
  }

  setInvekosButtonState(currentInvekosRowIndex, "loading");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      setInvekosButtonState(currentInvekosRowIndex, "default");
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      if (locationInput) {
        locationInput.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        clearError(`error-location-${currentInvekosRowIndex}`);
      }
      // GPS coords are not a map field selection, so clear any stale polygon
      const polygonInput = document.getElementById(`plot-map-polygon-${currentInvekosRowIndex}`);
      const zoomInput = document.getElementById(`plot-map-zoom-${currentInvekosRowIndex}`);
      const fieldNameInput = document.getElementById(`plot-map-field-name-${currentInvekosRowIndex}`);
      if (polygonInput) polygonInput.value = "";
      if (zoomInput) zoomInput.value = "";
      if (fieldNameInput) fieldNameInput.value = "";
      showInvekosModal();
      runInvekosQuery(lon, lat);
    },
    (error) => {
      setInvekosButtonState(currentInvekosRowIndex, "error");
      let message = "Standort konnte nicht ermittelt werden. Bitte geben Sie Koordinaten manuell ein.";
      if (error.code === 1) {
        message = "Standortzugriff wurde verweigert. Bitte aktivieren Sie den Standortzugriff in Ihren Browsereinstellungen oder geben Sie die Koordinaten manuell ein.";
      } else if (error.code === 3) {
        message = "Standortermittlung hat zu lange gedauert. Bitte versuchen Sie es erneut oder geben Sie die Koordinaten manuell ein.";
      }
      showInvekosModalError(message);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

export function setInvekosButtonState(index, state) {
  const btn = document.getElementById(`btn-invekos-${index}`);
  if (!btn) return;
  btn.classList.remove("loading", "error");
  if (state === "loading") btn.classList.add("loading");
  else if (state === "error") btn.classList.add("error");
}

export function showInvekosModal() {
  const modal = document.getElementById("invekos-modal");
  const body = document.getElementById("invekos-modal-body");
  if (!modal || !body) return;
  body.innerHTML = `<div class="invekos-loading">Schläge werden gesucht…</div>`;
  modal.removeAttribute("hidden");
  document.body.style.overflow = "hidden";
}

export function showInvekosModalError(message) {
  const modal = document.getElementById("invekos-modal");
  const body = document.getElementById("invekos-modal-body");
  if (!modal || !body) return;
  body.innerHTML = `<div class="invekos-error">${escapeHtml(message)}</div>`;
  modal.removeAttribute("hidden");
  document.body.style.overflow = "hidden";
}

export function closeInvekosModal() {
  const modal = document.getElementById("invekos-modal");
  if (!modal) return;
  modal.setAttribute("hidden", "");
  document.body.style.overflow = "";
}

export async function runInvekosQuery(lon, lat) {
  try {
    const features = await fetchInvekosFields(lon, lat);
    if (!features || features.length === 0) {
      const body = document.getElementById("invekos-modal-body");
      if (body) {
        body.innerHTML = `<div class="invekos-no-results">Keine Schläge in der Nähe gefunden. Prüfen Sie, ob Sie sich in Österreich befinden.</div>`;
      }
      return;
    }
    renderInvekosResults(features, lat, lon);
  } catch (err) {
    const body = document.getElementById("invekos-modal-body");
    if (body) {
      body.innerHTML = `<div class="invekos-error">INVEKOS-Daten konnten nicht geladen werden. Bitte prüfen Sie Ihre Verbindung.</div>`;
    }
    console.warn("INVEKOS fetch failed:", err);
  }
}

export async function fetchInvekosFields(lon, lat, externalSignal) {
  const collection = getInvekosCollectionName();
  const minLon = lon - INVEKOS_BBOX_DELTA;
  const minLat = lat - INVEKOS_BBOX_DELTA;
  const maxLon = lon + INVEKOS_BBOX_DELTA;
  const maxLat = lat + INVEKOS_BBOX_DELTA;
  const url = `${INVEKOS_API_BASE}/${collection}/items?bbox=${minLon},${minLat},${maxLon},${maxLat}&limit=${INVEKOS_RESULT_LIMIT}&f=json`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), INVEKOS_FETCH_TIMEOUT_MS);

  if (externalSignal) {
    externalSignal.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      controller.abort();
    });
  }

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.features || [];
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export function renderInvekosResults(features, userLat, userLon) {
  const body = document.getElementById("invekos-modal-body");
  if (!body) return;

  const enriched = features.map((f) => {
    const center = getBboxCenter(f.bbox);
    const distance = center
      ? calculateDistance(userLat, userLon, center.lat, center.lon)
      : Infinity;
    return { feature: f, distance };
  });

  enriched.sort((a, b) => a.distance - b.distance);

  const list = document.createElement("ul");
  list.className = "invekos-result-list";

  enriched.forEach(({ feature, distance }) => {
    const props = feature.properties || {};
    const name = props.snar_bezeichnung || "Unbekannter Schlag";
    const area = props.sl_flaeche_brutto_ha;
    const distText = distance === Infinity ? "" : `ca. ${Math.round(distance)} m`;
    const areaText = typeof area === "number" ? `${area.toFixed(3)} ha` : "";

    const li = document.createElement("li");
    li.className = "invekos-result-item";
    li.setAttribute("tabindex", "0");
    li.setAttribute("role", "button");

    let metaHtml = "";
    if (areaText) metaHtml += `<span>${escapeHtml(areaText)}</span>`;
    if (distText) metaHtml += `<span class="invekos-result-distance">${escapeHtml(distText)}</span>`;

    li.innerHTML = `
      <div class="invekos-result-name">${escapeHtml(name)}</div>
      <div class="invekos-result-meta">${metaHtml}</div>
    `;

    const select = () => selectInvekosField(props, userLat, userLon);
    li.addEventListener("click", select);
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select();
      }
    });

    list.appendChild(li);
  });

  body.innerHTML = "";
  body.appendChild(list);
}

export function selectInvekosField(properties, userLat, userLon) {
  const plotSizeInvekos = document.getElementById(`plot-size-invekos-${currentInvekosRowIndex}`);
  const treatedArea = document.getElementById(`treated-area-${currentInvekosRowIndex}`);
  const location = document.getElementById(`location-${currentInvekosRowIndex}`);

  if (plotSizeInvekos && properties.sl_flaeche_brutto_ha != null) {
    const num = Number(properties.sl_flaeche_brutto_ha);
    if (Number.isFinite(num)) {
      plotSizeInvekos.value = num.toFixed(3);
    }
  }

  if (treatedArea && !treatedArea.value && properties.sl_flaeche_brutto_ha != null) {
    const num = Number(properties.sl_flaeche_brutto_ha);
    if (Number.isFinite(num)) {
      treatedArea.value = num.toFixed(3);
      clearError(`error-treated-area-${currentInvekosRowIndex}`);
    }
  }

  if (location && !location.value) {
    location.value = `${userLat.toFixed(6)}, ${userLon.toFixed(6)}`;
    clearError(`error-location-${currentInvekosRowIndex}`);
  }

  closeInvekosModal();
}

export function initInvekosModal() {
  const modal = document.getElementById("invekos-modal");
  const closeBtn = modal?.querySelector(".modal-close");
  const overlay = modal?.querySelector(".modal-overlay");

  if (closeBtn) closeBtn.addEventListener("click", closeInvekosModal);
  if (overlay) overlay.addEventListener("click", closeInvekosModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.hasAttribute("hidden")) {
      closeInvekosModal();
    }
  });
}
