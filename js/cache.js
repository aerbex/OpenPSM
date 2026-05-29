/* ==========================================================================
   Session Cache (sessionStorage)
   ========================================================================== */

import { FORM_CACHE_KEY } from "./constants.js";

export function saveFormCache() {
  try {
    const eppoManual = document.getElementById("eppo-manual");
    const cache = {
      applicant: document.getElementById("applicant")?.value || "",
      client: document.getElementById("client")?.value || "",
      usageType: document.getElementById("usage-type")?.value || "",
      plotName: document.getElementById("plot-name")?.value || "",
      plotNumber: document.getElementById("plot-number")?.value || "",
      plotSizeInvekos: document.getElementById("plot-size-invekos")?.value || "",
      location: document.getElementById("location")?.value || "",
      treatedArea: document.getElementById("treated-area")?.value || "",
      notes: document.getElementById("notes")?.value || "",
      cropName: document.getElementById("crop-name")?.value || "",
      eppoCode: document.getElementById("eppo-code")?.value || "",
      eppoSelectedText: document.getElementById("eppo-selected")?.textContent || "",
      eppoManual: eppoManual?.checked || false,
      eppoCodeManual: document.getElementById("eppo-code-manual")?.value || "",
    };
    sessionStorage.setItem(FORM_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    // sessionStorage may be unavailable in private mode or disabled
    console.warn("Could not save form cache:", e);
  }
}

export function loadFormCache() {
  try {
    const raw = sessionStorage.getItem(FORM_CACHE_KEY);
    if (!raw) return;
    const cache = JSON.parse(raw);

    if (cache.applicant) document.getElementById("applicant").value = cache.applicant;
    if (cache.client) document.getElementById("client").value = cache.client;
    if (cache.usageType) document.getElementById("usage-type").value = cache.usageType;
    if (cache.plotName) document.getElementById("plot-name").value = cache.plotName;
    if (cache.plotNumber) document.getElementById("plot-number").value = cache.plotNumber;
    if (cache.plotSizeInvekos) document.getElementById("plot-size-invekos").value = cache.plotSizeInvekos;
    if (cache.location) document.getElementById("location").value = cache.location;
    if (cache.treatedArea) document.getElementById("treated-area").value = cache.treatedArea;
    if (cache.notes) document.getElementById("notes").value = cache.notes;
    if (cache.cropName) document.getElementById("crop-name").value = cache.cropName;

    // EPPO code
    if (cache.eppoCode) {
      document.getElementById("eppo-code").value = cache.eppoCode;
      const selected = document.getElementById("eppo-selected");
      if (selected && cache.eppoSelectedText) {
        selected.textContent = cache.eppoSelectedText;
      }
    }
    if (cache.eppoManual) {
      const eppoManualCheckbox = document.getElementById("eppo-manual");
      const eppoManualInput = document.getElementById("eppo-code-manual");
      if (eppoManualCheckbox) {
        eppoManualCheckbox.checked = true;
        eppoManualCheckbox.dispatchEvent(new Event("change"));
      }
      if (eppoManualInput && cache.eppoCodeManual) {
        eppoManualInput.value = cache.eppoCodeManual;
      }
    }
  } catch (e) {
    console.warn("Could not load form cache:", e);
  }
}

export function clearFormCache() {
  try {
    sessionStorage.removeItem(FORM_CACHE_KEY);
  } catch (e) {
    console.warn("Could not clear form cache:", e);
  }
}
