/* ==========================================================================
   Form Clear
   ========================================================================== */

import { counters } from "./state.js";
import { clearAllErrors, clearGlobalError } from "./ui.js";
import { clearFormCache } from "./cache.js";
import { setGpsButtonState } from "./geolocation.js";
import { setInvekosButtonState } from "./invekos.js";

export function clearForm() {
  if (!confirm("Möchten Sie wirklich alle Felder außer Anwender und Datum leeren?")) return;

  // Text inputs (except applicant and application-date)
  const textInputs = document.querySelectorAll('#psm-form input[type="text"]');
  textInputs.forEach((input) => {
    if (input.id !== "applicant" && input.id !== "application-date") {
      input.value = "";
    }
  });

  // Number inputs
  document.querySelectorAll('#psm-form input[type="number"]').forEach((input) => {
    input.value = "";
  });

  // Hidden inputs
  const eppoCode = document.getElementById("eppo-code");
  if (eppoCode) eppoCode.value = "";
  const bbchCode = document.getElementById("bbch-code");
  if (bbchCode) bbchCode.value = "";

  // Selected display divs
  const eppoSelected = document.getElementById("eppo-selected");
  if (eppoSelected) eppoSelected.textContent = "";
  const bbchSelected = document.getElementById("bbch-selected");
  if (bbchSelected) bbchSelected.textContent = "";

  // Selects
  const usageType = document.getElementById("usage-type");
  if (usageType) usageType.value = "";

  // Product unit defaults
  document.querySelectorAll('select[name="productUnit"]').forEach((sel) => {
    sel.value = "l";
  });

  // Checkboxes
  const timeRequired = document.getElementById("time-required");
  if (timeRequired) {
    timeRequired.checked = false;
    timeRequired.dispatchEvent(new Event("change"));
  }
  const bbchRequired = document.getElementById("bbch-required");
  if (bbchRequired) {
    bbchRequired.checked = false;
    bbchRequired.dispatchEvent(new Event("change"));
  }
  const eppoManual = document.getElementById("eppo-manual");
  if (eppoManual) {
    eppoManual.checked = false;
    eppoManual.dispatchEvent(new Event("change"));
  }
  const bbchManual = document.getElementById("bbch-manual");
  if (bbchManual) {
    bbchManual.checked = false;
    bbchManual.dispatchEvent(new Event("change"));
  }

  // Textarea
  const notes = document.getElementById("notes");
  if (notes) notes.value = "";

  // Plot rows: remove all except first
  const plotRows = document.querySelectorAll(".plot-row");
  plotRows.forEach((row, index) => {
    if (index === 0) {
      row.querySelectorAll('input[type="text"], input[type="number"], input[type="hidden"]').forEach((input) => {
        input.value = "";
      });
      const gpsStatus = row.querySelector('.gps-status');
      if (gpsStatus) {
        gpsStatus.textContent = "";
        gpsStatus.className = "gps-status";
      }
    } else {
      row.remove();
    }
  });
  counters.plotRowCount = 1;

  // Product rows: remove all except first
  const productRows = document.querySelectorAll(".product-row");
  productRows.forEach((row, index) => {
    if (index === 0) {
      // Clear first row inputs
      row.querySelectorAll('input[type="text"], input[type="number"]').forEach((input) => {
        input.value = "";
      });
      row.querySelectorAll(".product-search-note").forEach((el) => {
        el.textContent = "";
      });
    } else {
      row.remove();
    }
  });
  counters.productRowCount = 1;

  // GPS status for first row
  const gpsStatus = document.getElementById("gps-status-0");
  if (gpsStatus) {
    gpsStatus.textContent = "";
    gpsStatus.className = "gps-status";
  }
  setGpsButtonState(0, "default");
  setInvekosButtonState(0, "default");

  // Clear all errors
  clearAllErrors();
  clearGlobalError();

  // Clear cache
  clearFormCache();
}
