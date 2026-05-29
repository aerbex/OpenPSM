/* ==========================================================================
   PSM Register Search Module
   ========================================================================== */

import { STRINGS, MAX_SUGGESTIONS, DEBOUNCE_MS } from "./constants.js";
import { psmRegisterData } from "./state.js";
import { debounce, escapeHtml } from "./utils.js";
import { clearError } from "./ui.js";

export async function loadPsmRegisterData() {
  try {
    const response = await fetch("data/psm-register.json");
    if (!response.ok) throw new Error("Failed to load");
    const data = await response.json();
    psmRegisterData.length = 0;
    psmRegisterData.push(...(data.products || []));
    document.querySelectorAll(".product-search-note").forEach((el) => {
      el.textContent = `Register geladen: ${psmRegisterData.length} Produkte verfügbar.`;
      el.style.color = "#2d5a27";
    });
  } catch (e) {
    console.warn("PSM register load failed:", e);
    document.querySelectorAll(".product-search-note").forEach((el) => {
      el.textContent = STRINGS.errorPsmLoad;
      el.style.color = "#b71c1c";
    });
    document.querySelectorAll(".product-search input").forEach((el) => {
      el.disabled = true;
      el.placeholder = "Nicht verfügbar";
    });
  }
}

export function filterPsmProducts(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = [];
  for (const product of psmRegisterData) {
    if (
      (product.tradeName && product.tradeName.toLowerCase().includes(q)) ||
      (product.registrationNumber && product.registrationNumber.toLowerCase().includes(q))
    ) {
      matches.push(product);
      if (matches.length >= MAX_SUGGESTIONS) break;
    }
  }
  return matches;
}

export function renderProductDropdown(index, matches) {
  const dropdown = document.getElementById(`product-dropdown-${index}`);
  if (!dropdown) return;
  dropdown.innerHTML = "";
  if (matches.length === 0) {
    dropdown.innerHTML = `<div class="no-results">${STRINGS.errorNoResults}</div>`;
    dropdown.classList.add("open");
    return;
  }
  matches.forEach((match, i) => {
    const div = document.createElement("div");
    div.className = "product-option";
    div.dataset.index = i;
    div.innerHTML = `<span class="name">${escapeHtml(match.tradeName)}</span> <span class="reg-nr">(${escapeHtml(match.registrationNumber)})</span>`;
    div.addEventListener("click", () => selectProductOption(index, match));
    dropdown.appendChild(div);
  });
  dropdown.classList.add("open");
}

export function selectProductOption(index, product) {
  const nameInput = document.getElementById(`product-name-${index}`);
  const regInput = document.getElementById(`product-reg-${index}`);
  const searchInput = document.getElementById(`product-search-${index}`);
  if (nameInput) nameInput.value = product.tradeName || "";
  if (regInput) regInput.value = product.registrationNumber || "";
  if (searchInput) searchInput.value = "";
  closeProductDropdown(index);
  clearError(`error-product-name-${index}`);
  clearError(`error-product-reg-${index}`);
}

export function closeProductDropdown(index) {
  const dropdown = document.getElementById(`product-dropdown-${index}`);
  if (dropdown) dropdown.classList.remove("open");
}

export function highlightProductOption(index, direction) {
  const dropdown = document.getElementById(`product-dropdown-${index}`);
  if (!dropdown || !dropdown.classList.contains("open")) return;
  const options = dropdown.querySelectorAll(".product-option");
  if (options.length === 0) return;
  let current = dropdown.querySelector(".product-option.highlighted");
  let nextIndex = 0;
  if (current) {
    const currentIndex = Array.from(options).indexOf(current);
    nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = options.length - 1;
    if (nextIndex >= options.length) nextIndex = 0;
    current.classList.remove("highlighted");
  }
  options[nextIndex].classList.add("highlighted");
  options[nextIndex].scrollIntoView({ block: "nearest" });
}

export function selectHighlightedProductOption(index) {
  const dropdown = document.getElementById(`product-dropdown-${index}`);
  if (!dropdown) return;
  const highlighted = dropdown.querySelector(".product-option.highlighted");
  if (highlighted) highlighted.click();
}

export function initProductSearchForRow(index) {
  const searchInput = document.getElementById(`product-search-${index}`);
  if (!searchInput) return;

  const debouncedFilter = debounce((q) => {
    renderProductDropdown(index, filterPsmProducts(q));
  }, DEBOUNCE_MS);

  searchInput.addEventListener("input", (e) => {
    debouncedFilter(e.target.value);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightProductOption(index, 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightProductOption(index, -1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectHighlightedProductOption(index);
    } else if (e.key === "Escape") {
      closeProductDropdown(index);
    }
  });

  searchInput.addEventListener("blur", () => {
    setTimeout(() => closeProductDropdown(index), 200);
  });
}
