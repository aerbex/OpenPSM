/* ==========================================================================
   BBCH Culture Mapping & Search Module
   ========================================================================== */

import { STRINGS, MAX_SUGGESTIONS, DEBOUNCE_MS, CULTURE_TO_BBCH_GROUP } from "./constants.js";
import { bbchData, bbchFlatIndex } from "./state.js";
import { clearError, showGlobalError } from "./ui.js";
import { debounce, escapeHtml } from "./utils.js";

export function resolveBbchCropGroup() {
  const cropName = document.getElementById("crop-name")?.value?.trim().toLowerCase() || "";
  if (!cropName) return null;

  // Direct alias match
  for (const [key, group] of Object.entries(CULTURE_TO_BBCH_GROUP)) {
    if (cropName.includes(key)) {
      return group;
    }
  }

  // Substring match against cropGroup names themselves
  for (const group of bbchData) {
    if (cropName.includes(group.cropGroup.toLowerCase())) {
      return group.cropGroup;
    }
  }

  return null;
}

export function updateBbchScaleNote() {
  const note = document.getElementById("bbch-scale-note");
  if (!note) return;
  const group = resolveBbchCropGroup();
  if (group) {
    note.textContent = `BBCH-Skala gefiltert: ${group}`;
    note.style.color = "#2d5a27";
    note.style.display = "block";
  } else {
    note.textContent = "Keine passende BBCH-Skala für die eingetragene Kultur gefunden.";
    note.style.color = "#888";
    note.style.display = "block";
  }
}

export async function loadBbchData() {
  try {
    const response = await fetch("bbch-codes.json");
    if (!response.ok) throw new Error("Failed to load");
    const data = await response.json();
    bbchData.length = 0;
    bbchData.push(...(data.cropGroups || []));
    flattenBbchIndex();
  } catch (e) {
    console.warn("BBCH data load failed:", e);
    showGlobalError(STRINGS.errorBbchLoad);
    enableBbchManualMode(true);
  }
}

export function flattenBbchIndex() {
  bbchFlatIndex.length = 0;
  for (const group of bbchData) {
    for (const phase of group.phases) {
      for (const stage of phase.stages) {
        bbchFlatIndex.push({
          cropGroup: group.cropGroup,
          phaseCode: phase.code,
          phaseName: phase.name,
          stage: stage.stage,
          description: stage.description,
          remarks: stage.remarks,
        });
      }
    }
  }
}

export function filterBbchCodes(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const activeGroup = resolveBbchCropGroup();
  const matches = [];
  for (const entry of bbchFlatIndex) {
    // If a culture-specific group is resolved, only search within that group
    if (activeGroup && entry.cropGroup !== activeGroup) {
      continue;
    }
    if (
      (entry.description && entry.description.toLowerCase().includes(q)) ||
      (entry.stage && entry.stage.toLowerCase().includes(q)) ||
      (entry.phaseName && entry.phaseName.toLowerCase().includes(q)) ||
      (entry.cropGroup && entry.cropGroup.toLowerCase().includes(q))
    ) {
      matches.push(entry);
      if (matches.length >= MAX_SUGGESTIONS) break;
    }
  }
  return matches;
}

export function renderBbchDropdown(matches) {
  const dropdown = document.getElementById("bbch-dropdown");
  if (!dropdown) return;
  dropdown.innerHTML = "";
  if (matches.length === 0) {
    dropdown.innerHTML = `<div class="no-results">${STRINGS.errorNoResults}</div>`;
    dropdown.classList.add("open");
    return;
  }
  matches.forEach((match, index) => {
    const div = document.createElement("div");
    div.className = "bbch-option";
    div.dataset.index = index;
    div.innerHTML = `<span class="code">${escapeHtml(match.stage)}</span> — <span class="name">${escapeHtml(match.description)}</span> <span class="meta">(${escapeHtml(match.phaseName)}, ${escapeHtml(match.cropGroup)})</span>`;
    div.addEventListener("click", () => selectBbchOption(match));
    dropdown.appendChild(div);
  });
  dropdown.classList.add("open");
}

export function selectBbchOption(entry) {
  document.getElementById("bbch-code").value = entry.stage || "";
  const searchInput = document.getElementById("bbch-search");
  if (searchInput) {
    searchInput.value = `${entry.stage} — ${entry.description} (${entry.phaseName}, ${entry.cropGroup})`;
  }
  const selected = document.getElementById("bbch-selected");
  if (selected) {
    selected.textContent = `${entry.stage} — ${entry.description} (${entry.phaseName}, ${entry.cropGroup})`;
  }
  closeBbchDropdown();
  clearError("error-bbch-code");
}

export function closeBbchDropdown() {
  const dropdown = document.getElementById("bbch-dropdown");
  if (dropdown) dropdown.classList.remove("open");
}

export function highlightBbchOption(direction) {
  const dropdown = document.getElementById("bbch-dropdown");
  if (!dropdown || !dropdown.classList.contains("open")) return;
  const options = dropdown.querySelectorAll(".bbch-option");
  if (options.length === 0) return;
  let current = dropdown.querySelector(".bbch-option.highlighted");
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

export function selectHighlightedBbchOption() {
  const dropdown = document.getElementById("bbch-dropdown");
  if (!dropdown) return;
  const highlighted = dropdown.querySelector(".bbch-option.highlighted");
  if (highlighted) highlighted.click();
}

export function enableBbchManualMode(force) {
  const checkbox = document.getElementById("bbch-manual");
  const manualInput = document.getElementById("bbch-code-manual");
  if (!checkbox || !manualInput) return;
  if (force) {
    checkbox.checked = true;
    manualInput.classList.add("visible");
    const searchWrapper = document.getElementById("bbch-search-wrapper");
    const selected = document.getElementById("bbch-selected");
    if (searchWrapper) searchWrapper.style.display = "none";
    if (selected) selected.style.display = "none";
  }
}

export function initBbchSearch() {
  const searchInput = document.getElementById("bbch-search");
  const manualCheckbox = document.getElementById("bbch-manual");
  const manualInput = document.getElementById("bbch-code-manual");

  if (!searchInput) return;

  const debouncedFilter = debounce((q) => {
    renderBbchDropdown(filterBbchCodes(q));
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
      highlightBbchOption(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightBbchOption(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectHighlightedBbchOption();
    } else if (e.key === "Escape") {
      closeBbchDropdown();
    }
  });

  searchInput.addEventListener("blur", () => {
    setTimeout(closeBbchDropdown, 200);
  });

  if (manualCheckbox && manualInput) {
    manualCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        manualInput.classList.add("visible");
        document.getElementById("bbch-search-wrapper").style.display = "none";
        document.getElementById("bbch-selected").style.display = "none";
      } else {
        manualInput.classList.remove("visible");
        document.getElementById("bbch-search-wrapper").style.display = "block";
        document.getElementById("bbch-selected").style.display = "block";
      }
    });
  }

  // Watch Kultur field to update BBCH scale note
  const cropInput = document.getElementById("crop-name");
  const bbchCheckbox = document.getElementById("bbch-required");
  if (cropInput && bbchCheckbox) {
    cropInput.addEventListener("input", () => {
      if (bbchCheckbox.checked) {
        updateBbchScaleNote();
      }
    });
    bbchCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        updateBbchScaleNote();
      }
    });
  }
}

export function validateBbchCode(code) {
  if (!code) return false;
  if (bbchFlatIndex.length === 0) return true; // data unavailable, allow manual
  return bbchFlatIndex.some((e) => e.stage === code);
}
