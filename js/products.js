/* ==========================================================================
   Tank Mix Manager
   ========================================================================== */

import { STRINGS, MAX_PRODUCT_ROWS } from "./constants.js";
import { counters } from "./state.js";
import { initProductSearchForRow } from "./psm-register.js";

export function initTankMix() {
  const addBtn = document.getElementById("btn-add-product");
  if (addBtn) {
    addBtn.addEventListener("click", addProductRow);
  }
}

export function addProductRow() {
  if (counters.productRowCount >= MAX_PRODUCT_ROWS) return;
  const container = document.getElementById("product-rows");
  const index = counters.productRowCount;
  counters.productRowCount++;

  const row = document.createElement("div");
  row.className = "product-row";
  row.dataset.index = index;
  row.innerHTML = `
    <h3>Produkt ${index + 1}</h3>
    <div class="form-row">
      <label>Produkt aus Register suchen</label>
      <div class="product-search" id="product-search-wrapper-${index}">
        <input type="text" id="product-search-${index}" autocomplete="off" placeholder="Produktname eingeben...">
        <div class="product-dropdown" id="product-dropdown-${index}"></div>
      </div>
      <span class="product-search-note" id="product-search-note-${index}"></span>
    </div>
    <div class="form-row">
      <label for="product-name-${index}">Produktname <span class="required">*</span></label>
      <input type="text" id="product-name-${index}" name="productName" required>
      <span class="error-message" id="error-product-name-${index}"></span>
    </div>
    <div class="form-row">
      <label for="product-reg-${index}">Zulassungsnummer <span class="required">*</span></label>
      <input type="text" id="product-reg-${index}" name="productReg" required>
      <span class="error-message" id="error-product-reg-${index}"></span>
    </div>
    <div class="form-row product-amount-row">
      <div class="amount-input">
        <label for="product-amount-${index}">Aufwandmenge pro ha <span class="required">*</span></label>
        <input type="number" id="product-amount-${index}" name="productAmount" min="0.01" step="0.01" required>
      </div>
      <div class="amount-unit">
        <label for="product-unit-${index}">Einheit</label>
        <select id="product-unit-${index}" name="productUnit">
          <option value="kg">kg</option>
          <option value="l" selected>l</option>
          <option value="g">g</option>
          <option value="ml">ml</option>
        </select>
      </div>
    </div>
    <span class="error-message" id="error-product-amount-${index}"></span>
    <button type="button" class="btn-remove-product" data-index="${index}">${STRINGS.productRemove}</button>
  `;

  container.appendChild(row);

  initProductSearchForRow(index);

  const removeBtn = row.querySelector(".btn-remove-product");
  removeBtn.addEventListener("click", () => removeProductRow(index));
}

export function removeProductRow(index) {
  if (counters.productRowCount <= 1) return;
  const container = document.getElementById("product-rows");
  const row = container.querySelector(`.product-row[data-index="${index}"]`);
  if (row) {
    row.remove();
    counters.productRowCount--;
    reindexProductRows();
  }
}

export function reindexProductRows() {
  const rows = document.querySelectorAll(".product-row");
  rows.forEach((row, newIndex) => {
    row.dataset.index = newIndex;
    const h3 = row.querySelector("h3");
    if (h3) h3.textContent = `Produkt ${newIndex + 1}`;
    row.querySelectorAll("[id^='product-search-wrapper-']").forEach((el) => {
      el.id = `product-search-wrapper-${newIndex}`;
    });
    const searchInput = row.querySelector('.product-search input[type="text"]');
    if (searchInput) {
      const oldValue = searchInput.value;
      const clone = searchInput.cloneNode(true);
      clone.id = `product-search-${newIndex}`;
      clone.value = oldValue;
      searchInput.replaceWith(clone);
    }
    row.querySelectorAll("[id^='product-dropdown-']").forEach((el) => {
      el.id = `product-dropdown-${newIndex}`;
    });
    row.querySelectorAll("[id^='product-search-note-']").forEach((el) => {
      el.id = `product-search-note-${newIndex}`;
    });
    row.querySelectorAll("[id^='product-name-']").forEach((el) => {
      el.id = `product-name-${newIndex}`;
      const label = row.querySelector(`label[for^='product-name-']`);
      if (label) label.setAttribute("for", `product-name-${newIndex}`);
    });
    row.querySelectorAll("[id^='product-reg-']").forEach((el) => {
      el.id = `product-reg-${newIndex}`;
      const label = row.querySelector(`label[for^='product-reg-']`);
      if (label) label.setAttribute("for", `product-reg-${newIndex}`);
    });
    row.querySelectorAll("[id^='product-amount-']").forEach((el) => {
      el.id = `product-amount-${newIndex}`;
      const label = row.querySelector(`label[for^='product-amount-']`);
      if (label) label.setAttribute("for", `product-amount-${newIndex}`);
    });
    row.querySelectorAll("[id^='product-unit-']").forEach((el) => {
      el.id = `product-unit-${newIndex}`;
      const label = row.querySelector(`label[for^='product-unit-']`);
      if (label) label.setAttribute("for", `product-unit-${newIndex}`);
    });
    row.querySelectorAll("[id^='error-product-name-']").forEach((el) => {
      el.id = `error-product-name-${newIndex}`;
    });
    row.querySelectorAll("[id^='error-product-reg-']").forEach((el) => {
      el.id = `error-product-reg-${newIndex}`;
    });
    row.querySelectorAll("[id^='error-product-amount-']").forEach((el) => {
      el.id = `error-product-amount-${newIndex}`;
    });
    const removeBtn = row.querySelector(".btn-remove-product");
    if (removeBtn) {
      removeBtn.dataset.index = newIndex;
      removeBtn.replaceWith(removeBtn.cloneNode(true));
      row.querySelector(".btn-remove-product").addEventListener("click", () => removeProductRow(newIndex));
    }
    initProductSearchForRow(newIndex);
  });
}

export function getProductRowsData() {
  const rows = document.querySelectorAll(".product-row");
  const products = [];
  rows.forEach((row) => {
    const index = row.dataset.index;
    products.push({
      name: row.querySelector(`#product-name-${index}`)?.value?.trim() || "",
      regNumber: row.querySelector(`#product-reg-${index}`)?.value?.trim() || "",
      amount: row.querySelector(`#product-amount-${index}`)?.value?.trim() || "",
      unit: row.querySelector(`#product-unit-${index}`)?.value || "l",
    });
  });
  return products;
}
