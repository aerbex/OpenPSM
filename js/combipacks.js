/* ==========================================================================
   Kombipack Manager
   ========================================================================== */

import { MAX_PRODUCT_ROWS } from "./constants.js";
import { counters } from "./state.js";
import { addProductRow } from "./products.js";
import { escapeHtml } from "./utils.js";
import { clearError, showGlobalError } from "./ui.js";

let combipacksData = [];
let combipacksLoaded = false;
let selectedCombipackIndex = -1;
let triggerButton = null;

export async function loadCombipacksData() {
  try {
    const response = await fetch("data/combipacks.json");
    if (!response.ok) throw new Error("Failed to load combipacks.json");
    combipacksData = await response.json();
  } catch (err) {
    console.warn("Combipacks data could not be loaded:", err);
    combipacksData = [];
  } finally {
    combipacksLoaded = true;
  }
}

export function initCombipacks() {
  const addBtn = document.getElementById("btn-add-combipack");
  if (addBtn) {
    addBtn.addEventListener("click", openCombipackModal);
  }

  const modal = document.getElementById("combipack-modal");
  const overlay = modal?.querySelector(".modal-overlay");
  const closeBtn = modal?.querySelector(".modal-close");
  const cancelBtn = document.getElementById("btn-combipack-cancel");
  const confirmBtn = document.getElementById("btn-combipack-confirm");
  const searchInput = document.getElementById("combipack-search");

  if (closeBtn) closeBtn.addEventListener("click", closeCombipackModal);
  if (overlay) overlay.addEventListener("click", closeCombipackModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeCombipackModal);
  if (confirmBtn) confirmBtn.addEventListener("click", confirmCombipackSelection);
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      selectedCombipackIndex = -1;
      updateConfirmButton();
      renderCombipackList(e.target.value.trim().toLowerCase());
    });
  }

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.hidden) {
      closeCombipackModal();
    }
  });

  // Focus trap
  modal?.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

function openCombipackModal() {
  const modal = document.getElementById("combipack-modal");
  if (!modal) return;
  selectedCombipackIndex = -1;
  triggerButton = document.activeElement;
  const searchInput = document.getElementById("combipack-search");
  if (searchInput) searchInput.value = "";
  renderCombipackList();
  updateConfirmButton();
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  if (searchInput) searchInput.focus();
}

function closeCombipackModal() {
  const modal = document.getElementById("combipack-modal");
  if (modal) modal.hidden = true;
  selectedCombipackIndex = -1;
  document.body.style.overflow = "";
  if (triggerButton) {
    triggerButton.focus();
    triggerButton = null;
  }
}

function renderCombipackList(filter = "") {
  const listEl = document.getElementById("combipack-list");
  if (!listEl) return;

  listEl.innerHTML = "";

  if (!combipacksLoaded) {
    listEl.innerHTML = `<div class="combipack-no-results">Kombipacks werden geladen…</div>`;
    return;
  }

  const filtered = combipacksData
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const name = (item["Kombipack Name"] || "").toLowerCase();
      if (name.includes(filter)) return true;
      return (item.Einzelprodukte || []).some((p) => {
        const prodName = (p.Einzelprodukt || "").toLowerCase();
        const reg = (p["Einzelprodukt Registriernummer"] || "").toLowerCase();
        return prodName.includes(filter) || reg.includes(filter);
      });
    });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="combipack-no-results">Keine Kombipacks gefunden.</div>`;
    return;
  }

  filtered.forEach(({ item, index }) => {
    const el = document.createElement("div");
    el.className = "combipack-item";
    el.dataset.index = index;
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    if (index === selectedCombipackIndex) {
      el.classList.add("selected");
    }

    const productsHtml = item.Einzelprodukte
      .map(
        (p) =>
          `<span class="combipack-product">${escapeHtml(p.Einzelprodukt)}${p["Einzelprodukt Registriernummer"] ? ` <span class="combipack-reg">(${escapeHtml(p["Einzelprodukt Registriernummer"])})</span>` : ""}</span>`
      )
      .join("");

    el.innerHTML = `
      <div class="combipack-name">${escapeHtml(item["Kombipack Name"])}</div>
      <div class="combipack-products">${productsHtml}</div>
    `;

    const selectItem = () => {
      selectedCombipackIndex = index;
      document.querySelectorAll(".combipack-item").forEach((itemEl) => itemEl.classList.remove("selected"));
      el.classList.add("selected");
      updateConfirmButton();
    };

    el.addEventListener("click", selectItem);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectItem();
      }
    });

    listEl.appendChild(el);
  });
}

function updateConfirmButton() {
  const confirmBtn = document.getElementById("btn-combipack-confirm");
  if (confirmBtn) {
    confirmBtn.disabled = selectedCombipackIndex === -1;
  }
}

function confirmCombipackSelection() {
  if (selectedCombipackIndex === -1) return;
  const kombipack = combipacksData[selectedCombipackIndex];
  if (!kombipack) return;

  const products = kombipack.Einzelprodukte || [];
  if (products.length === 0) {
    closeCombipackModal();
    return;
  }

  // Find existing empty rows and new rows needed
  const rows = document.querySelectorAll(".product-row");
  const emptyRowIndices = [];
  rows.forEach((row) => {
    const idx = row.dataset.index;
    const nameVal = row.querySelector(`#product-name-${idx}`)?.value?.trim() || "";
    const regVal = row.querySelector(`#product-reg-${idx}`)?.value?.trim() || "";
    if (nameVal === "" && regVal === "") {
      emptyRowIndices.push(idx);
    }
  });

  let productsToAdd = [...products];
  let addedCount = 0;

  // Fill empty rows first
  for (const rowIdx of emptyRowIndices) {
    if (productsToAdd.length === 0) break;
    const product = productsToAdd.shift();
    fillProductRow(rowIdx, product);
    addedCount++;
  }

  // Add remaining products as new rows
  for (const product of productsToAdd) {
    if (counters.productRowCount >= MAX_PRODUCT_ROWS) break;
    const newIndex = addProductRow();
    if (newIndex != null) {
      fillProductRow(newIndex, product);
      addedCount++;
    }
  }

  const remaining = products.length - addedCount;
  closeCombipackModal();

  if (remaining > 0) {
    showGlobalError(
      `Nur ${addedCount} von ${products.length} Produkten konnten hinzugefügt werden (Maximale Produktanzahl: ${MAX_PRODUCT_ROWS}). Bitte fügen Sie die restlichen Produkte manuell hinzu.`
    );
  }
}

function fillProductRow(index, product) {
  const nameInput = document.getElementById(`product-name-${index}`);
  const regInput = document.getElementById(`product-reg-${index}`);
  const searchInput = document.getElementById(`product-search-${index}`);
  if (nameInput) {
    nameInput.value = product.Einzelprodukt || "";
  }
  if (regInput) {
    regInput.value = product["Einzelprodukt Registriernummer"] || "";
  }
  if (searchInput) {
    searchInput.value = "";
  }
  clearError(`error-product-name-${index}`);
  clearError(`error-product-reg-${index}`);
}
