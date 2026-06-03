/* ==========================================================================
   Geolocation Helper
   ========================================================================== */

import { STRINGS } from "./constants.js";
import { clearError } from "./ui.js";

let currentGpsRowIndex = 0;

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
  btn.addEventListener("click", () => {
    currentGpsRowIndex = index;
    requestLocation();
  });
}

export function requestLocation() {
  const status = document.getElementById(`gps-status-${currentGpsRowIndex}`);
  setGpsButtonState(currentGpsRowIndex, "loading");
  if (status) {
    status.textContent = STRINGS.gpsLoading;
    status.className = "gps-status";
  }
  navigator.geolocation.getCurrentPosition(
    handleLocationSuccess,
    handleLocationError,
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

export function handleLocationSuccess(position) {
  const lat = position.coords.latitude.toFixed(6);
  const lon = position.coords.longitude.toFixed(6);
  const input = document.getElementById(`location-${currentGpsRowIndex}`);
  if (input) input.value = `${lat}, ${lon}`;
  // Clear stale map-picker polygon (GPS coords aren't a field selection)
  const polygonInput = document.getElementById(`plot-map-polygon-${currentGpsRowIndex}`);
  const zoomInput = document.getElementById(`plot-map-zoom-${currentGpsRowIndex}`);
  const fieldNameInput = document.getElementById(`plot-map-field-name-${currentGpsRowIndex}`);
  if (polygonInput) polygonInput.value = "";
  if (zoomInput) zoomInput.value = "";
  if (fieldNameInput) fieldNameInput.value = "";
  setGpsButtonState(currentGpsRowIndex, "success");
  const status = document.getElementById(`gps-status-${currentGpsRowIndex}`);
  if (status) {
    status.textContent = STRINGS.gpsSuccess;
    status.className = "gps-status success";
  }
  clearError(`error-location-${currentGpsRowIndex}`);
}

export function handleLocationError(error) {
  let message = STRINGS.gpsUnavailable;
  if (error.code === 1) message = STRINGS.gpsPermissionDenied;
  else if (error.code === 3) message = STRINGS.gpsTimeout;
  setGpsButtonState(currentGpsRowIndex, "error");
  const status = document.getElementById(`gps-status-${currentGpsRowIndex}`);
  if (status) {
    status.textContent = message;
    status.className = "gps-status error";
  }
}

export function setGpsButtonState(index, state) {
  const btn = document.getElementById(`btn-gps-${index}`);
  if (!btn) return;
  btn.classList.remove("loading", "success", "error");
  if (state === "loading") btn.classList.add("loading");
  else if (state === "success") btn.classList.add("success");
  else if (state === "error") btn.classList.add("error");
}
