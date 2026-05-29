/* ==========================================================================
   EPPO Search Module
   ========================================================================== */

import { STRINGS, MAX_SUGGESTIONS, DEBOUNCE_MS } from "./constants.js";
import { eppoData } from "./state.js";
import { clearError, showGlobalError } from "./ui.js";
import { debounce, escapeHtml } from "./utils.js";

export async function loadEppoData() {
  try {
    const response = await fetch("eppo-codes.json");
    if (!response.ok) throw new Error("Failed to load");
    const data = await response.json();
    eppoData.length = 0;
    eppoData.push(...data);
  } catch (e) {
    console.warn("EPPO data load failed:", e);
    showGlobalError(STRINGS.errorEppoLoad);
    enableEppoManualMode(true);
  }
}

export function filterEppoCodes(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = [];
  for (const entry of eppoData) {
    if (
      (entry.germanName && entry.germanName.toLowerCase().includes(q)) ||
      (entry.eppoCode && entry.eppoCode.toLowerCase().includes(q))
    ) {
      matches.push(entry);
      if (matches.length >= MAX_SUGGESTIONS) break;
    }
  }
  return matches;
}

export function renderEppoDropdown(matches) {
  const dropdown = document.getElementById("eppo-dropdown");
  if (!dropdown) return;
  dropdown.innerHTML = "";
  if (matches.length === 0) {
    dropdown.innerHTML = `<div class="no-results">${STRINGS.errorNoResults}</div>`;
    dropdown.classList.add("open");
    return;
  }
  matches.forEach((match, index) => {
    const div = document.createElement("div");
    div.className = "eppo-option";
    div.dataset.index = index;
    div.innerHTML = `<span class="name">${escapeHtml(match.germanName)}</span> — <span class="code">${escapeHtml(match.eppoCode)}</span>`;
    div.addEventListener("click", () => selectEppoOption(match));
    dropdown.appendChild(div);
  });
  dropdown.classList.add("open");
}

export function selectEppoOption(entry) {
  document.getElementById("eppo-code").value = entry.eppoCode || "";
  const searchInput = document.getElementById("eppo-search");
  if (searchInput) {
    searchInput.value = `${entry.germanName} — ${entry.eppoCode}`;
  }
  const selected = document.getElementById("eppo-selected");
  if (selected) {
    selected.textContent = `${entry.germanName} — ${entry.eppoCode}`;
  }
  // Auto-fill Kultur from EPPO german name
  const cropInput = document.getElementById("crop-name");
  if (cropInput && entry.germanName) {
    cropInput.value = entry.germanName;
    clearError("error-crop-name");
    cropInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  closeEppoDropdown();
  clearError("error-eppo-code");
}

export function closeEppoDropdown() {
  const dropdown = document.getElementById("eppo-dropdown");
  if (dropdown) dropdown.classList.remove("open");
}

export function highlightEppoOption(direction) {
  const dropdown = document.getElementById("eppo-dropdown");
  if (!dropdown || !dropdown.classList.contains("open")) return;
  const options = dropdown.querySelectorAll(".eppo-option");
  if (options.length === 0) return;
  let current = dropdown.querySelector(".eppo-option.highlighted");
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

export function selectHighlightedEppoOption() {
  const dropdown = document.getElementById("eppo-dropdown");
  if (!dropdown) return;
  const highlighted = dropdown.querySelector(".eppo-option.highlighted");
  if (highlighted) highlighted.click();
}

export function enableEppoManualMode(force) {
  const checkbox = document.getElementById("eppo-manual");
  const manualInput = document.getElementById("eppo-code-manual");
  if (!checkbox || !manualInput) return;
  if (force) {
    checkbox.checked = true;
    manualInput.classList.add("visible");
    const searchWrapper = document.getElementById("eppo-search-wrapper");
    const selected = document.getElementById("eppo-selected");
    if (searchWrapper) searchWrapper.style.display = "none";
    if (selected) selected.style.display = "none";
  }
}

export function initEppoSearch() {
  const searchInput = document.getElementById("eppo-search");
  const manualCheckbox = document.getElementById("eppo-manual");
  const manualInput = document.getElementById("eppo-code-manual");

  if (!searchInput) return;

  const debouncedFilter = debounce((q) => {
    renderEppoDropdown(filterEppoCodes(q));
  }, DEBOUNCE_MS);

  searchInput.addEventListener("input", (e) => {
    debouncedFilter(e.target.value);
  });

  searchInput.addEventListener("focus", () => {
    searchInput.select();
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightEppoOption(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightEppoOption(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectHighlightedEppoOption();
    } else if (e.key === "Escape") {
      closeEppoDropdown();
    }
  });

  searchInput.addEventListener("blur", () => {
    setTimeout(closeEppoDropdown, 200);
  });

  if (manualCheckbox && manualInput) {
    manualCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        manualInput.classList.add("visible");
        document.getElementById("eppo-search-wrapper").style.display = "none";
        document.getElementById("eppo-selected").style.display = "none";
      } else {
        manualInput.classList.remove("visible");
        document.getElementById("eppo-search-wrapper").style.display = "block";
        document.getElementById("eppo-selected").style.display = "block";
      }
    });
  }
}

export function validateEppoCode(code) {
  if (!code) return false;
  if (eppoData.length === 0) return true; // data unavailable, allow manual
  return eppoData.some((e) => e.eppoCode === code);
}
