/* ==========================================================================
   Session Cache (sessionStorage)
   ========================================================================== */

import { FORM_CACHE_KEY } from "./constants.js";
import { addPlotRow } from "./plots.js";
import { addProductRow } from "./products.js";

export function saveFormCache() {
  try {
    const eppoManual = document.getElementById("eppo-manual");

    // Gather plot rows
    const plotRows = document.querySelectorAll(".plot-row");
    const plots = [];
    plotRows.forEach((row) => {
      const index = row.dataset.index;
      plots.push({
        plotName: row.querySelector(`#plot-name-${index}`)?.value || "",
        location: row.querySelector(`#location-${index}`)?.value || "",
        treatedArea: row.querySelector(`#treated-area-${index}`)?.value || "",
        plotNumber: row.querySelector(`#plot-number-${index}`)?.value || "",
        plotSizeInvekos: row.querySelector(`#plot-size-invekos-${index}`)?.value || "",
      });
    });

    // Gather product rows
    const productRows = document.querySelectorAll(".product-row");
    const products = [];
    productRows.forEach((row) => {
      const index = row.dataset.index;
      products.push({
        name: row.querySelector(`#product-name-${index}`)?.value || "",
        regNumber: row.querySelector(`#product-reg-${index}`)?.value || "",
        amount: row.querySelector(`#product-amount-${index}`)?.value || "",
        unit: row.querySelector(`#product-unit-${index}`)?.value || "l",
      });
    });

    const cache = {
      applicant: document.getElementById("applicant")?.value || "",
      client: document.getElementById("client")?.value || "",
      usageType: document.getElementById("usage-type")?.value || "",
      plots,
      products,
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
    if (cache.notes) document.getElementById("notes").value = cache.notes;
    if (cache.cropName) document.getElementById("crop-name").value = cache.cropName;

    // Plot rows
    if (cache.plots && cache.plots.length > 0) {
      cache.plots.forEach((plot, i) => {
        if (i === 0) {
          const row = document.querySelector('.plot-row[data-index="0"]');
          if (row) {
            const pn = row.querySelector("#plot-name-0");
            if (pn) pn.value = plot.plotName || "";
            const loc = row.querySelector("#location-0");
            if (loc) loc.value = plot.location || "";
            const ta = row.querySelector("#treated-area-0");
            if (ta) ta.value = plot.treatedArea || "";
            const pnum = row.querySelector("#plot-number-0");
            if (pnum) pnum.value = plot.plotNumber || "";
            const psi = row.querySelector("#plot-size-invekos-0");
            if (psi) psi.value = plot.plotSizeInvekos || "";
          }
        } else {
          addPlotRow();
          const row = document.querySelector(`.plot-row[data-index="${i}"]`);
          if (row) {
            const pn = row.querySelector(`#plot-name-${i}`);
            if (pn) pn.value = plot.plotName || "";
            const loc = row.querySelector(`#location-${i}`);
            if (loc) loc.value = plot.location || "";
            const ta = row.querySelector(`#treated-area-${i}`);
            if (ta) ta.value = plot.treatedArea || "";
            const pnum = row.querySelector(`#plot-number-${i}`);
            if (pnum) pnum.value = plot.plotNumber || "";
            const psi = row.querySelector(`#plot-size-invekos-${i}`);
            if (psi) psi.value = plot.plotSizeInvekos || "";
          }
        }
      });
    }

    // Product rows
    if (cache.products && cache.products.length > 0) {
      cache.products.forEach((product, i) => {
        if (i === 0) {
          const nameInput = document.getElementById("product-name-0");
          if (nameInput) nameInput.value = product.name || "";
          const regInput = document.getElementById("product-reg-0");
          if (regInput) regInput.value = product.regNumber || "";
          const amountInput = document.getElementById("product-amount-0");
          if (amountInput) amountInput.value = product.amount || "";
          const unitInput = document.getElementById("product-unit-0");
          if (unitInput) unitInput.value = product.unit || "l";
        } else {
          addProductRow();
          const nameInput = document.getElementById(`product-name-${i}`);
          if (nameInput) nameInput.value = product.name || "";
          const regInput = document.getElementById(`product-reg-${i}`);
          if (regInput) regInput.value = product.regNumber || "";
          const amountInput = document.getElementById(`product-amount-${i}`);
          if (amountInput) amountInput.value = product.amount || "";
          const unitInput = document.getElementById(`product-unit-${i}`);
          if (unitInput) unitInput.value = product.unit || "l";
        }
      });
    }

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
