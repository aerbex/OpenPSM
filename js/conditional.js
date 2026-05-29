/* ==========================================================================
   Conditional Fields
   ========================================================================== */

export function initConditionalFields() {
  const timeCheckbox = document.getElementById("time-required");
  const timeWrapper = document.getElementById("time-field-wrapper");
  if (timeCheckbox && timeWrapper) {
    timeCheckbox.addEventListener("change", (e) => {
      timeWrapper.classList.toggle("visible", e.target.checked);
      if (e.target.checked) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const timeInput = document.getElementById("application-time");
        if (timeInput && !timeInput.value) timeInput.value = timeStr;
      }
    });
  }

  const bbchCheckbox = document.getElementById("bbch-required");
  const bbchWrapper = document.getElementById("bbch-field-wrapper");
  if (bbchCheckbox && bbchWrapper) {
    bbchCheckbox.addEventListener("change", (e) => {
      bbchWrapper.classList.toggle("visible", e.target.checked);
    });
  }
}
