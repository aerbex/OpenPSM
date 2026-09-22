/* ==========================================================================
   Geolocation Helper
   ========================================================================== */

import { STRINGS } from "./constants.js";
import { clearError } from "./ui.js";

export function initGeolocation() {
  initGeolocationForRow(0);
}

export function initGeolocationForRow(index) {
  const btn = document.getElementById(`btn-gps-${index}`);
  if (!btn) return;
  if (!navigator.geolocation) {
    btn.style.display = "none";
    return;
  }
  btn.addEventListener("click", () => requestLocation(index));
}

export function requestLocation(index = 0) {
  const row = document.getElementById(`location-${index}`)?.closest(".plot-row");
  if (!row) return;
  const status = document.getElementById(`gps-status-${index}`);
  setGpsButtonState(index, "loading");
  if (status) {
    status.textContent = STRINGS.gpsLoading;
    status.className = "gps-status";
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (row.isConnected) handleLocationSuccess(position, row.dataset.index);
    },
    (error) => {
      if (row.isConnected) handleLocationError(error, row.dataset.index);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

export function handleLocationSuccess(position, index) {
  const lat = position.coords.latitude.toFixed(6);
  const lon = position.coords.longitude.toFixed(6);
  const input = document.getElementById(`location-${index}`);
  if (input) input.value = `${lat}, ${lon}`;
  // Clear stale map-picker polygon (GPS coords aren't a field selection)
  const polygonInput = document.getElementById(`plot-map-polygon-${index}`);
  const zoomInput = document.getElementById(`plot-map-zoom-${index}`);
  const fieldNameInput = document.getElementById(`plot-map-field-name-${index}`);
  if (polygonInput) polygonInput.value = "";
  if (zoomInput) zoomInput.value = "";
  if (fieldNameInput) fieldNameInput.value = "";
  setGpsButtonState(index, "success");
  const status = document.getElementById(`gps-status-${index}`);
  if (status) {
    status.textContent = STRINGS.gpsSuccess;
    status.className = "gps-status success";
  }
  clearError(`error-location-${index}`);
}

export function handleLocationError(error, index) {
  let message = STRINGS.gpsUnavailable;
  if (error.code === 1) message = STRINGS.gpsPermissionDenied;
  else if (error.code === 3) message = STRINGS.gpsTimeout;
  setGpsButtonState(index, "error");
  const status = document.getElementById(`gps-status-${index}`);
  if (status) {
    status.textContent = message;
    status.className = "gps-status error";
  }
}

export function setGpsButtonState(index, state) {
  const btn = document.getElementById(`btn-gps-${index}`);
  if (!btn) return;
  btn.disabled = state === "loading";
  btn.classList.remove("loading", "success", "error");
  if (state === "loading") btn.classList.add("loading");
  else if (state === "success") btn.classList.add("success");
  else if (state === "error") btn.classList.add("error");
}
