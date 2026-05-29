/* ==========================================================================
   Geolocation Helper
   ========================================================================== */

import { STRINGS } from "./constants.js";
import { clearError } from "./ui.js";

export function initGeolocation() {
  const btn = document.getElementById("btn-gps");
  if (!btn) return;
  if (!navigator.geolocation) {
    btn.style.display = "none";
    return;
  }
  btn.addEventListener("click", requestLocation);
}

export function requestLocation() {
  const btn = document.getElementById("btn-gps");
  const status = document.getElementById("gps-status");
  setGpsButtonState("loading");
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
  const input = document.getElementById("location");
  if (input) input.value = `${lat}, ${lon}`;
  setGpsButtonState("success");
  const status = document.getElementById("gps-status");
  if (status) {
    status.textContent = STRINGS.gpsSuccess;
    status.className = "gps-status success";
  }
  clearError("error-location");
}

export function handleLocationError(error) {
  let message = STRINGS.gpsUnavailable;
  if (error.code === 1) message = STRINGS.gpsPermissionDenied;
  else if (error.code === 3) message = STRINGS.gpsTimeout;
  setGpsButtonState("error");
  const status = document.getElementById("gps-status");
  if (status) {
    status.textContent = message;
    status.className = "gps-status error";
  }
}

export function setGpsButtonState(state) {
  const btn = document.getElementById("btn-gps");
  if (!btn) return;
  btn.classList.remove("loading", "success", "error");
  if (state === "loading") btn.classList.add("loading");
  else if (state === "success") btn.classList.add("success");
  else if (state === "error") btn.classList.add("error");
}
