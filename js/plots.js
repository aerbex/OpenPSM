/* ==========================================================================
   Plot Rows Manager
   ========================================================================== */

import { STRINGS, MAX_PLOT_ROWS } from "./constants.js";
import { counters } from "./state.js";
import { initGeolocationForRow } from "./geolocation.js";
import { initInvekosSearchForRow } from "./invekos.js";

export function initPlotRows() {
  const addBtn = document.getElementById("btn-add-plot");
  if (addBtn) {
    addBtn.addEventListener("click", addPlotRow);
  }
}

export function addPlotRow() {
  if (counters.plotRowCount >= MAX_PLOT_ROWS) return;
  const container = document.getElementById("plot-rows");
  const index = counters.plotRowCount;
  counters.plotRowCount++;

  const row = document.createElement("div");
  row.className = "plot-row";
  row.dataset.index = index;
  row.innerHTML = `
    <h3>Fläche ${index + 1}</h3>
    <div class="form-row">
      <label for="plot-name-${index}">Flächenbezeichnung <span class="required">*</span></label>
      <input type="text" id="plot-name-${index}" name="plotName" maxlength="100" required>
      <span class="error-message" id="error-plot-name-${index}"></span>
    </div>
    <div class="form-row">
      <label for="location-${index}">Lage (FLIK oder GPS) <span class="required">*</span></label>
      <div class="location-wrapper">
        <input type="text" id="location-${index}" name="location" maxlength="100" required>
        <button type="button" id="btn-gps-${index}" class="btn-gps" title="Standort ermitteln">📍</button>
        <button type="button" id="btn-invekos-${index}" class="btn-invekos" title="Schlag aus INVEKOS suchen">🌾</button>
      </div>
      <span class="gps-status" id="gps-status-${index}"></span>
      <span class="error-message" id="error-location-${index}"></span>
    </div>
    <div class="form-row">
      <label for="treated-area-${index}">Behandelte Fläche (ha) <span class="required">*</span></label>
      <input type="number" id="treated-area-${index}" name="treatedArea" min="0.001" step="0.001" required>
      <span class="error-message" id="error-treated-area-${index}"></span>
    </div>
    <div class="form-row">
      <label for="plot-number-${index}">Schlag Nr.</label>
      <input type="text" id="plot-number-${index}" name="plotNumber" maxlength="50">
    </div>
    <div class="form-row">
      <label for="plot-size-invekos-${index}">Schlaggröße lt. INVEKOS GIS (ha)</label>
      <input type="number" id="plot-size-invekos-${index}" name="plotSizeInvekos" min="0.001" step="0.001">
    </div>
    <button type="button" class="btn-remove-plot" data-index="${index}">${STRINGS.plotRemove}</button>
  `;

  container.appendChild(row);

  initGeolocationForRow(index);
  initInvekosSearchForRow(index);

  const removeBtn = row.querySelector(".btn-remove-plot");
  removeBtn.addEventListener("click", () => removePlotRow(index));
}

export function removePlotRow(index) {
  if (counters.plotRowCount <= 1) return;
  const container = document.getElementById("plot-rows");
  const row = container.querySelector(`.plot-row[data-index="${index}"]`);
  if (row) {
    row.remove();
    counters.plotRowCount--;
    reindexPlotRows();
  }
}

export function reindexPlotRows() {
  const rows = document.querySelectorAll(".plot-row");
  rows.forEach((row, newIndex) => {
    row.dataset.index = newIndex;
    const h3 = row.querySelector("h3");
    if (h3) h3.textContent = `Fläche ${newIndex + 1}`;

    row.querySelectorAll("[id^='plot-name-']").forEach((el) => {
      el.id = `plot-name-${newIndex}`;
      const label = row.querySelector(`label[for^='plot-name-']`);
      if (label) label.setAttribute("for", `plot-name-${newIndex}`);
    });
    row.querySelectorAll("[id^='error-plot-name-']").forEach((el) => {
      el.id = `error-plot-name-${newIndex}`;
    });

    row.querySelectorAll("[id^='location-']").forEach((el) => {
      el.id = `location-${newIndex}`;
      const label = row.querySelector(`label[for^='location-']`);
      if (label) label.setAttribute("for", `location-${newIndex}`);
    });
    row.querySelectorAll("[id^='gps-status-']").forEach((el) => {
      el.id = `gps-status-${newIndex}`;
    });
    row.querySelectorAll("[id^='error-location-']").forEach((el) => {
      el.id = `error-location-${newIndex}`;
    });

    row.querySelectorAll("[id^='btn-gps-']").forEach((el) => {
      el.id = `btn-gps-${newIndex}`;
    });
    row.querySelectorAll("[id^='btn-invekos-']").forEach((el) => {
      el.id = `btn-invekos-${newIndex}`;
    });

    row.querySelectorAll("[id^='treated-area-']").forEach((el) => {
      el.id = `treated-area-${newIndex}`;
      const label = row.querySelector(`label[for^='treated-area-']`);
      if (label) label.setAttribute("for", `treated-area-${newIndex}`);
    });
    row.querySelectorAll("[id^='error-treated-area-']").forEach((el) => {
      el.id = `error-treated-area-${newIndex}`;
    });

    row.querySelectorAll("[id^='plot-number-']").forEach((el) => {
      el.id = `plot-number-${newIndex}`;
      const label = row.querySelector(`label[for^='plot-number-']`);
      if (label) label.setAttribute("for", `plot-number-${newIndex}`);
    });

    row.querySelectorAll("[id^='plot-size-invekos-']").forEach((el) => {
      el.id = `plot-size-invekos-${newIndex}`;
      const label = row.querySelector(`label[for^='plot-size-invekos-']`);
      if (label) label.setAttribute("for", `plot-size-invekos-${newIndex}`);
    });

    const removeBtn = row.querySelector(".btn-remove-plot");
    if (removeBtn) {
      removeBtn.dataset.index = newIndex;
      removeBtn.replaceWith(removeBtn.cloneNode(true));
      row.querySelector(".btn-remove-plot").addEventListener("click", () => removePlotRow(newIndex));
    }

    initGeolocationForRow(newIndex);
    initInvekosSearchForRow(newIndex);
  });
}

export function getPlotRowsData() {
  const rows = document.querySelectorAll(".plot-row");
  const plots = [];
  rows.forEach((row) => {
    const index = row.dataset.index;
    plots.push({
      plotName: row.querySelector(`#plot-name-${index}`)?.value?.trim() || "",
      location: row.querySelector(`#location-${index}`)?.value?.trim() || "",
      treatedArea: row.querySelector(`#treated-area-${index}`)?.value?.trim() || "",
      plotNumber: row.querySelector(`#plot-number-${index}`)?.value?.trim() || "",
      plotSizeInvekos: row.querySelector(`#plot-size-invekos-${index}`)?.value?.trim() || "",
    });
  });
  return plots;
}
