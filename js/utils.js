/* ==========================================================================
   Utility Functions
   ========================================================================== */

export function formatDateDe(dateString) {
  if (!dateString) return "";
  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function sanitizeInput(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, "").trim();
}

export function generateFilename(plotName, dateString, applicant, client) {
  const safePlot = sanitizeInput(plotName || "Unbekannt")
    .replace(/[^a-zA-Z0-9\u00C0-\u017F_ -]/g, "")
    .substring(0, 40);
  const safeDate = dateString
    ? `${dateString.substring(8, 10)} ${dateString.substring(5, 7)} ${dateString.substring(0, 4)}`
    : "";
  const safeApplicant = sanitizeInput(applicant || "")
    .replace(/[^a-zA-Z0-9\u00C0-\u017F_ -]/g, "")
    .substring(0, 30);
  const safeClient = sanitizeInput(client || "")
    .replace(/[^a-zA-Z0-9\u00C0-\u017F_ -]/g, "")
    .substring(0, 30);
  let name = "PSM Anwendung";
  if (safePlot) name += " " + safePlot;
  if (safeDate) name += " " + safeDate;
  if (safeApplicant) name += " " + safeApplicant;
  if (safeClient) name += " " + safeClient;
  return name;
}

export function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function isCoordinateString(value) {
  return /^-?\d{1,2}\.\d+,\s*-?\d{1,3}\.\d+$/.test(value.trim());
}

export function setTodayDefaults() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const today = `${yyyy}-${mm}-${dd}`;
  const dateInput = document.getElementById("application-date");
  if (dateInput && !dateInput.value) {
    dateInput.value = today;
  }
}

export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
