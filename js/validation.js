/* ==========================================================================
   Validation Engine
   ========================================================================== */

import { STRINGS } from "./constants.js";
import { isCoordinateString } from "./utils.js";
import { showError, clearAllErrors } from "./ui.js";
import { validateEppoCode } from "./eppo.js";
import { validateBbchCode } from "./bbch.js";
import { getProductRowsData } from "./products.js";

export function validateForm() {
  clearAllErrors();
  let isValid = true;
  let firstErrorElement = null;

  const applicant = document.getElementById("applicant");
  if (!applicant.value.trim()) {
    showError("error-applicant", STRINGS.errorRequired);
    if (!firstErrorElement) firstErrorElement = applicant;
    isValid = false;
  }

  const usageType = document.getElementById("usage-type");
  if (!usageType.value) {
    showError("error-usage-type", STRINGS.errorRequired);
    if (!firstErrorElement) firstErrorElement = usageType;
    isValid = false;
  }

  const appDate = document.getElementById("application-date");
  if (!appDate.value) {
    showError("error-application-date", STRINGS.errorRequired);
    if (!firstErrorElement) firstErrorElement = appDate;
    isValid = false;
  } else {
    const selected = new Date(appDate.value);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (selected > today) {
      showError("error-application-date", STRINGS.errorFutureDate);
      if (!firstErrorElement) firstErrorElement = appDate;
      isValid = false;
    }
  }

  const timeRequired = document.getElementById("time-required");
  if (timeRequired.checked) {
    const appTime = document.getElementById("application-time");
    if (!appTime.value) {
      showError("error-application-time", STRINGS.errorRequired);
      if (!firstErrorElement) firstErrorElement = appTime;
      isValid = false;
    }
  }

  const plotName = document.getElementById("plot-name");
  if (!plotName.value.trim()) {
    showError("error-plot-name", STRINGS.errorRequired);
    if (!firstErrorElement) firstErrorElement = plotName;
    isValid = false;
  }

  const location = document.getElementById("location");
  if (!location.value.trim()) {
    showError("error-location", STRINGS.errorRequired);
    if (!firstErrorElement) firstErrorElement = location;
    isValid = false;
  } else {
    const val = location.value.trim();
    if (isCoordinateString(val)) {
      // valid coordinates
    } else if (/^-?\d/.test(val) && val.includes(".")) {
      // looks like it tried to be coordinates but failed
      showError("error-location", STRINGS.errorLocationFormat);
      if (!firstErrorElement) firstErrorElement = location;
      isValid = false;
    }
    // FLIK is free text, so anything else is fine
  }

  const treatedArea = document.getElementById("treated-area");
  const areaVal = parseFloat(treatedArea.value.replace(",", "."));
  if (!treatedArea.value || isNaN(areaVal) || areaVal <= 0) {
    showError("error-treated-area", STRINGS.errorPositiveNumber);
    if (!firstErrorElement) firstErrorElement = treatedArea;
    isValid = false;
  }

  const cropName = document.getElementById("crop-name");
  if (!cropName.value.trim()) {
    showError("error-crop-name", STRINGS.errorRequired);
    if (!firstErrorElement) firstErrorElement = cropName;
    isValid = false;
  }

  const eppoManual = document.getElementById("eppo-manual");
  let eppoCode = "";
  if (eppoManual && eppoManual.checked) {
    eppoCode = document.getElementById("eppo-code-manual")?.value?.trim() || "";
  } else {
    eppoCode = document.getElementById("eppo-code")?.value?.trim() || "";
  }
  if (!eppoCode) {
    showError("error-eppo-code", STRINGS.errorRequired);
    const el = document.getElementById("eppo-search") || document.getElementById("eppo-code-manual");
    if (!firstErrorElement) firstErrorElement = el;
    isValid = false;
  } else if (!validateEppoCode(eppoCode)) {
    showError("error-eppo-code", STRINGS.errorEppoCode);
    const el = document.getElementById("eppo-search") || document.getElementById("eppo-code-manual");
    if (!firstErrorElement) firstErrorElement = el;
    isValid = false;
  }

  const bbchRequired = document.getElementById("bbch-required");
  let bbchCode = "";
  if (bbchRequired && bbchRequired.checked) {
    const bbchManual = document.getElementById("bbch-manual");
    if (bbchManual && bbchManual.checked) {
      bbchCode = document.getElementById("bbch-code-manual")?.value?.trim() || "";
    } else {
      bbchCode = document.getElementById("bbch-code")?.value?.trim() || "";
    }
    if (!bbchCode) {
      showError("error-bbch-code", STRINGS.errorRequired);
      const el = document.getElementById("bbch-search") || document.getElementById("bbch-code-manual");
      if (!firstErrorElement) firstErrorElement = el;
      isValid = false;
    } else if (!validateBbchCode(bbchCode)) {
      showError("error-bbch-code", STRINGS.errorBbchCode);
      const el = document.getElementById("bbch-search") || document.getElementById("bbch-code-manual");
      if (!firstErrorElement) firstErrorElement = el;
      isValid = false;
    }
  }

  const products = getProductRowsData();
  if (products.length === 0) {
    showError("error-global", "Bitte geben Sie mindestens ein Produkt ein.");
    isValid = false;
  }
  products.forEach((product, index) => {
    if (!product.name) {
      showError(`error-product-name-${index}`, STRINGS.errorRequired);
      const el = document.getElementById(`product-name-${index}`);
      if (!firstErrorElement) firstErrorElement = el;
      isValid = false;
    }
    if (!product.regNumber) {
      showError(`error-product-reg-${index}`, STRINGS.errorRequired);
      const el = document.getElementById(`product-reg-${index}`);
      if (!firstErrorElement) firstErrorElement = el;
      isValid = false;
    }
    const amt = parseFloat(product.amount.replace(",", "."));
    if (!product.amount || isNaN(amt) || amt <= 0) {
      showError(`error-product-amount-${index}`, STRINGS.errorPositiveNumber);
      const el = document.getElementById(`product-amount-${index}`);
      if (!firstErrorElement) firstErrorElement = el;
      isValid = false;
    }
  });

  if (firstErrorElement) {
    firstErrorElement.scrollIntoView({ behavior: "smooth", block: "center" });
    firstErrorElement.focus();
  }

  return isValid ? { eppoCode, bbchCode, products } : null;
}
