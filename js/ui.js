/* ==========================================================================
   Error UI Helpers & Global Error
   ========================================================================== */

export function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.classList.add("visible");
  const input = document.querySelector(`[aria-describedby="${elementId}"]`)
    || document.getElementById(elementId.replace("error-", ""));
  if (input) input.classList.add("error");
}

export function clearError(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = "";
  el.classList.remove("visible");
  const input = document.querySelector(`[aria-describedby="${elementId}"]`)
    || document.getElementById(elementId.replace("error-", ""));
  if (input) input.classList.remove("error");
}

export function clearAllErrors() {
  document.querySelectorAll(".error-message").forEach((el) => {
    el.textContent = "";
    el.classList.remove("visible");
  });
  document.querySelectorAll("input, select").forEach((el) => {
    el.classList.remove("error");
  });
}

export function showGlobalError(message) {
  const el = document.getElementById("error-global");
  if (el) {
    el.textContent = message;
    el.classList.add("visible");
  }
}

export function clearGlobalError() {
  const el = document.getElementById("error-global");
  if (el) {
    el.textContent = "";
    el.classList.remove("visible");
  }
}
