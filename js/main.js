/* ==========================================================================
   OpenPSM — Pflanzenschutzmittel-Anwendungsnachweis
   Client-only, no storage, no cookies, no login.
   Code language: English. UI language: German (de-AT).
   ========================================================================== */

import { setTodayDefaults, downloadFile } from "./utils.js";
import { saveFormCache, loadFormCache, clearFormCache } from "./cache.js";
import { initConditionalFields } from "./conditional.js";
import { initTankMix } from "./products.js";
import { initPlotRows } from "./plots.js";
import { initEppoSearch, loadEppoData } from "./eppo.js";
import { initBbchSearch, loadBbchData } from "./bbch.js";
import { initGeolocation } from "./geolocation.js";
import { initInvekosSearch, initInvekosModal } from "./invekos.js";
import { initMapPicker } from "./map-picker.js";
import { initProductSearchForRow, loadPsmRegisterData } from "./psm-register.js";
import { initCombipacks, loadCombipacksData } from "./combipacks.js";
import { generatePDF, generateExcel, checkJsPdf, checkExcelJs } from "./generators.js";
import { validateForm } from "./validation.js";
import { clearForm } from "./form.js";
import { showGlobalError, clearGlobalError } from "./ui.js";

async function init() {
  setTodayDefaults();
  initConditionalFields();
  initTankMix();
  initPlotRows();
  initEppoSearch();
  initBbchSearch();
  loadFormCache();
  initGeolocation();
  initInvekosSearch();
  initInvekosModal();
  initMapPicker();
  initProductSearchForRow(0);
  initCombipacks();

  await Promise.all([loadEppoData(), loadBbchData(), loadPsmRegisterData(), loadCombipacksData()]);

  // jsPDF may still be loading from CDN
  setTimeout(checkJsPdf, 500);

  const form = document.getElementById("psm-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearGlobalError();

    const generatePdfCheckbox = document.getElementById("generate-pdf");
    const generateExcelCheckbox = document.getElementById("generate-excel");
    const wantPdf = generatePdfCheckbox && generatePdfCheckbox.checked;
    const wantExcel = generateExcelCheckbox && generateExcelCheckbox.checked;

    if (!wantPdf && !wantExcel) {
      showGlobalError("Bitte wählen Sie mindestens ein Ausgabeformat (PDF oder Excel) aus.");
      return;
    }

    if (wantPdf && !checkJsPdf()) return;

    const data = validateForm();
    if (!data) return;

    const files = [];

    if (wantPdf) {
      try {
        const pdfResult = await generatePDF(data);
        if (pdfResult) {
          files.push(new File([pdfResult.blob], pdfResult.filename, { type: pdfResult.blob.type }));
        }
      } catch (err) {
        console.error("PDF generation failed:", err);
        showGlobalError("PDF-Erstellung fehlgeschlagen.");
      }
    }

    if (wantExcel) {
      if (checkExcelJs()) {
        try {
          const excelResult = await generateExcel(data);
          if (excelResult) {
            files.push(new File([excelResult.blob], excelResult.filename, { type: excelResult.blob.type }));
          }
        } catch (err) {
          console.error("Excel generation failed:", err);
          showGlobalError("Excel-Erstellung fehlgeschlagen: " + (err.message || "Unbekannter Fehler"));
        }
      }
    }

    if (files.length > 0) {
      if (navigator.canShare && navigator.canShare({ files })) {
        try {
          await navigator.share({ files });
        } catch (err) {
          if (err.name !== "AbortError") {
            console.warn("Share failed:", err);
            files.forEach((file) => downloadFile(file, file.name));
          }
        }
      } else {
        files.forEach((file) => downloadFile(file, file.name));
      }
    }

    saveFormCache();
  });

  const clearCacheBtn = document.getElementById("btn-clear-cache");
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener("click", () => {
      clearFormCache();
      window.location.reload();
    });
  }

  const clearFormBtn = document.getElementById("btn-clear-form");
  if (clearFormBtn) {
    clearFormBtn.addEventListener("click", clearForm);
  }

  window.addEventListener("beforeunload", () => {
    saveFormCache();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
