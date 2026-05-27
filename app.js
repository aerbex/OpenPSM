/**
 * OpenPSM — Pflanzenschutzmittel-Anwendungsnachweis
 * Client-only, no storage, no cookies, no login.
 * Code language: English. UI language: German (de-AT).
 */

/* ==========================================================================
   Constants & Strings
   ========================================================================== */

const STRINGS = {
  errorRequired: "Dieses Feld ist erforderlich.",
  errorFutureDate: "Das Datum darf nicht in der Zukunft liegen.",
  errorPositiveNumber: "Bitte geben Sie einen Wert größer 0 ein.",
  errorEppoCode: "Bitte wählen Sie einen gültigen EPPO-Code aus der Liste aus.",
  errorBbchCode: "Bitte wählen Sie ein gültiges BBCH-Stadium aus der Liste aus.",
  errorLocationFormat: "Bitte geben Sie gültige Koordinaten (z. B. 48.2082, 16.3738) oder eine FLIK-Nummer ein.",
  errorNoResults: "Keine Ergebnisse. Bitte prüfen Sie die Schreibweise oder geben Sie den Code manuell ein.",
  errorEppoLoad: "EPPO-Code-Daten konnten nicht geladen werden. Die Suche ist nicht verfügbar.",
  errorBbchLoad: "BBCH-Daten konnten nicht geladen werden. Die Suche ist nicht verfügbar.",
  errorPsmLoad: "PSM-Register konnte nicht geladen werden. Produktnamen und Zulassungsnummern müssen manuell eingegeben werden.",
  errorJsPdfLoad: "PDF-Bibliothek konnte nicht geladen werden. Bitte stellen Sie eine Internetverbindung her und laden Sie die Seite neu.",
  gpsPermissionDenied: "Standortzugriff wurde verweigert. Bitte aktivieren Sie den Standortzugriff in Ihren Browsereinstellungen oder geben Sie die Koordinaten manuell ein.",
  gpsUnavailable: "Standort konnte nicht ermittelt werden. Bitte prüfen Sie Ihre GPS-Verbindung oder geben Sie die Koordinaten manuell ein.",
  gpsTimeout: "Standortermittlung hat zu lange gedauert. Bitte versuchen Sie es erneut oder geben Sie die Koordinaten manuell ein.",
  gpsLoading: "Standort wird ermittelt...",
  gpsSuccess: "Standort erfolgreich ermittelt.",
  pdfDisclaimer: "Dieser Nachweis wurde mit OpenPSM erstellt. Die inhaltliche Richtigkeit und Vollständigkeit obliegt dem Anwender.",
  productRemove: "Produkt entfernen",
};

const MAX_SUGGESTIONS = 10;
const DEBOUNCE_MS = 150;
const MAX_PRODUCT_ROWS = 10;
const FORM_CACHE_KEY = "openpsm-form-cache";

/* ==========================================================================
   State
   ========================================================================== */

let eppoData = [];
let bbchData = [];
let bbchFlatIndex = [];
let psmRegisterData = [];
let productRowCount = 1;

/* ==========================================================================
   Utility Functions
   ========================================================================== */

function formatDateDe(dateString) {
  if (!dateString) return "";
  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function sanitizeInput(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, "").trim();
}

function generateFilename(plotName, dateString, applicant, client) {
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

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function isCoordinateString(value) {
  return /^-?\d{1,2}\.\d+,\s*-?\d{1,3}\.\d+$/.test(value.trim());
}

function setTodayDefaults() {
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

/* ==========================================================================
   Session Cache (sessionStorage)
   ========================================================================== */

function saveFormCache() {
  try {
    const eppoManual = document.getElementById("eppo-manual");
    const cache = {
      applicant: document.getElementById("applicant")?.value || "",
      client: document.getElementById("client")?.value || "",
      usageType: document.getElementById("usage-type")?.value || "",
      plotName: document.getElementById("plot-name")?.value || "",
      plotNumber: document.getElementById("plot-number")?.value || "",
      plotSizeInvekos: document.getElementById("plot-size-invekos")?.value || "",
      location: document.getElementById("location")?.value || "",
      treatedArea: document.getElementById("treated-area")?.value || "",
      cropName: document.getElementById("crop-name")?.value || "",
      eppoCode: document.getElementById("eppo-code")?.value || "",
      eppoSelectedText: document.getElementById("eppo-selected")?.textContent || "",
      eppoManual: eppoManual?.checked || false,
      eppoCodeManual: document.getElementById("eppo-code-manual")?.value || "",
    };
    sessionStorage.setItem(FORM_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    // sessionStorage may be unavailable in private mode or disabled
    console.warn("Could not save form cache:", e);
  }
}

function loadFormCache() {
  try {
    const raw = sessionStorage.getItem(FORM_CACHE_KEY);
    if (!raw) return;
    const cache = JSON.parse(raw);

    if (cache.applicant) document.getElementById("applicant").value = cache.applicant;
    if (cache.client) document.getElementById("client").value = cache.client;
    if (cache.usageType) document.getElementById("usage-type").value = cache.usageType;
    if (cache.plotName) document.getElementById("plot-name").value = cache.plotName;
    if (cache.plotNumber) document.getElementById("plot-number").value = cache.plotNumber;
    if (cache.plotSizeInvekos) document.getElementById("plot-size-invekos").value = cache.plotSizeInvekos;
    if (cache.location) document.getElementById("location").value = cache.location;
    if (cache.treatedArea) document.getElementById("treated-area").value = cache.treatedArea;
    if (cache.cropName) document.getElementById("crop-name").value = cache.cropName;

    // EPPO code
    if (cache.eppoCode) {
      document.getElementById("eppo-code").value = cache.eppoCode;
      const selected = document.getElementById("eppo-selected");
      if (selected && cache.eppoSelectedText) {
        selected.textContent = cache.eppoSelectedText;
      }
    }
    if (cache.eppoManual) {
      const eppoManualCheckbox = document.getElementById("eppo-manual");
      const eppoManualInput = document.getElementById("eppo-code-manual");
      if (eppoManualCheckbox) {
        eppoManualCheckbox.checked = true;
        eppoManualCheckbox.dispatchEvent(new Event("change"));
      }
      if (eppoManualInput && cache.eppoCodeManual) {
        eppoManualInput.value = cache.eppoCodeManual;
      }
    }
  } catch (e) {
    console.warn("Could not load form cache:", e);
  }
}

function clearFormCache() {
  try {
    sessionStorage.removeItem(FORM_CACHE_KEY);
  } catch (e) {
    console.warn("Could not clear form cache:", e);
  }
}

/* ==========================================================================
   Error UI Helpers
   ========================================================================== */

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.classList.add("visible");
  const input = document.querySelector(`[aria-describedby="${elementId}"]`)
    || document.getElementById(elementId.replace("error-", ""));
  if (input) input.classList.add("error");
}

function clearError(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = "";
  el.classList.remove("visible");
  const input = document.querySelector(`[aria-describedby="${elementId}"]`)
    || document.getElementById(elementId.replace("error-", ""));
  if (input) input.classList.remove("error");
}

function clearAllErrors() {
  document.querySelectorAll(".error-message").forEach((el) => {
    el.textContent = "";
    el.classList.remove("visible");
  });
  document.querySelectorAll("input, select").forEach((el) => {
    el.classList.remove("error");
  });
}

/* ==========================================================================
   EPPO Search Module
   ========================================================================== */

async function loadEppoData() {
  try {
    const response = await fetch("eppo-codes.json");
    if (!response.ok) throw new Error("Failed to load");
    eppoData = await response.json();
  } catch (e) {
    console.warn("EPPO data load failed:", e);
    showGlobalError(STRINGS.errorEppoLoad);
    enableEppoManualMode(true);
  }
}

function filterEppoCodes(query) {
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

function renderEppoDropdown(matches) {
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

function selectEppoOption(entry) {
  document.getElementById("eppo-code").value = entry.eppoCode || "";
  document.getElementById("eppo-search").value = "";
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

function closeEppoDropdown() {
  const dropdown = document.getElementById("eppo-dropdown");
  if (dropdown) dropdown.classList.remove("open");
}

function highlightEppoOption(direction) {
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

function selectHighlightedEppoOption() {
  const dropdown = document.getElementById("eppo-dropdown");
  if (!dropdown) return;
  const highlighted = dropdown.querySelector(".eppo-option.highlighted");
  if (highlighted) highlighted.click();
}

function enableEppoManualMode(force) {
  const checkbox = document.getElementById("eppo-manual");
  const manualInput = document.getElementById("eppo-code-manual");
  if (!checkbox || !manualInput) return;
  if (force) {
    checkbox.checked = true;
    manualInput.classList.add("visible");
    document.getElementById("eppo-search-wrapper").style.display = "none";
    document.getElementById("eppo-selected").style.display = "none";
  }
}

function initEppoSearch() {
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

function validateEppoCode(code) {
  if (!code) return false;
  if (eppoData.length === 0) return true; // data unavailable, allow manual
  return eppoData.some((e) => e.eppoCode === code);
}

/* ==========================================================================
   BBCH Culture Mapping
   ========================================================================== */

const CULTURE_TO_BBCH_GROUP = {
  "getreide": "Getreide",
  "weizen": "Getreide",
  "gerste": "Getreide",
  "roggen": "Getreide",
  "hafer": "Getreide",
  "triticale": "Getreide",
  "dinkel": "Getreide",
  "spelz": "Getreide",
  "einkorn": "Getreide",
  "emmer": "Getreide",
  "reis": "Reis",
  "mais": "Mais",
  "raps": "Raps",
  "rübsen": "Raps",
  "senf": "Raps",
  "ölrübsen": "Raps",
  "faba-bohne": "Faba-Bohne",
  "ackerbohne": "Faba-Bohne",
  "puffbohne": "Faba-Bohne",
  "sonnenblume": "Sonnenblume",
  "zuckerrübe": "Beta-Rüben",
  "futterrübe": "Beta-Rüben",
  "rote rübe": "Beta-Rüben",
  "rote beete": "Beta-Rüben",
  "kartoffel": "Kartoffel",
  "apfel": "Kernobst",
  "birne": "Kernobst",
  "quitte": "Kernobst",
  "kirsche": "Steinobst",
  "süßkirsche": "Steinobst",
  "sauerkirsche": "Steinobst",
  "pflaume": "Steinobst",
  "zwetschge": "Steinobst",
  "pfirsich": "Steinobst",
  "nektarine": "Steinobst",
  "aprikose": "Steinobst",
  "mandel": "Steinobst",
  "johannisbeere": "Johannisbeere",
  "stachelbeere": "Johannisbeere",
  "beerenobst": "Johannisbeere",
  "erdbeere": "Erdbeere",
  "zitrone": "Citrus",
  "orange": "Citrus",
  "mandarine": "Citrus",
  "grapefruit": "Citrus",
  "olive": "Olive",
  "kaffee": "Kaffee",
  "banane": "Bananenpflanzen",
  "wein": "Weinrebe",
  "weinrebe": "Weinrebe",
  "soja": "Sojabohne",
  "sojabohne": "Sojabohne",
  "baumwolle": "Baumwolle",
  "erdnuss": "Erdnuss",
  "hopfen": "Hopfen",
  "zwiebel": "Zwiebelgemüse",
  "knoblauch": "Zwiebelgemüse",
  "lauch": "Zwiebelgemüse",
  "schnittlauch": "Zwiebelgemüse",
  "karotte": "Wurzel- und Knollengemüse",
  "möhre": "Wurzel- und Knollengemüse",
  "rettich": "Wurzel- und Knollengemüse",
  "sellerie": "Wurzel- und Knollengemüse",
  "pastinake": "Wurzel- und Knollengemüse",
  "kopfsalat": "Blattgemüse (kopfbildend)",
  "endivie": "Blattgemüse (kopfbildend)",
  "chicorée": "Blattgemüse (kopfbildend)",
  "radicchio": "Blattgemüse (kopfbildend)",
  "spinat": "Blattgemüse (nichtkopfbildend)",
  "mangold": "Blattgemüse (nichtkopfbildend)",
  "kohl": "Sonstige Kohlgemüsearten",
  "brokkoli": "Sonstige Kohlgemüsearten",
  "blumenkohl": "Sonstige Kohlgemüsearten",
  "chinakohl": "Sonstige Kohlgemüsearten",
  "rotkohl": "Sonstige Kohlgemüsearten",
  "weißkohl": "Sonstige Kohlgemüsearten",
  "gurke": "Gurkengewächse",
  "melone": "Gurkengewächse",
  "kürbis": "Gurkengewächse",
  "zucchini": "Gurkengewächse",
  "tomate": "Nachtschattengewächse",
  "aubergine": "Nachtschattengewächse",
  "paprika": "Nachtschattengewächse",
  "chili": "Nachtschattengewächse",
  "erbse": "Erbse",
  "bohne": "Bohne",
  "buschbohne": "Bohne",
  "stangenbohne": "Bohne",
  "feuerbohne": "Bohne",
  "prinzessbohne": "Bohne",
};

function resolveBbchCropGroup() {
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

function updateBbchScaleNote() {
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

/* ==========================================================================
   BBCH Search Module
   ========================================================================== */

async function loadBbchData() {
  try {
    const response = await fetch("bbch-codes.json");
    if (!response.ok) throw new Error("Failed to load");
    const data = await response.json();
    bbchData = data.cropGroups || [];
    flattenBbchIndex();
  } catch (e) {
    console.warn("BBCH data load failed:", e);
    showGlobalError(STRINGS.errorBbchLoad);
    enableBbchManualMode(true);
  }
}

function flattenBbchIndex() {
  bbchFlatIndex = [];
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

function filterBbchCodes(query) {
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

function renderBbchDropdown(matches) {
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

function selectBbchOption(entry) {
  document.getElementById("bbch-code").value = entry.stage || "";
  document.getElementById("bbch-search").value = "";
  const selected = document.getElementById("bbch-selected");
  if (selected) {
    selected.textContent = `${entry.stage} — ${entry.description} (${entry.phaseName}, ${entry.cropGroup})`;
  }
  closeBbchDropdown();
  clearError("error-bbch-code");
}

function closeBbchDropdown() {
  const dropdown = document.getElementById("bbch-dropdown");
  if (dropdown) dropdown.classList.remove("open");
}

function highlightBbchOption(direction) {
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

function selectHighlightedBbchOption() {
  const dropdown = document.getElementById("bbch-dropdown");
  if (!dropdown) return;
  const highlighted = dropdown.querySelector(".bbch-option.highlighted");
  if (highlighted) highlighted.click();
}

function enableBbchManualMode(force) {
  const checkbox = document.getElementById("bbch-manual");
  const manualInput = document.getElementById("bbch-code-manual");
  if (!checkbox || !manualInput) return;
  if (force) {
    checkbox.checked = true;
    manualInput.classList.add("visible");
    document.getElementById("bbch-search-wrapper").style.display = "none";
    document.getElementById("bbch-selected").style.display = "none";
  }
}

function initBbchSearch() {
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

function validateBbchCode(code) {
  if (!code) return false;
  if (bbchFlatIndex.length === 0) return true; // data unavailable, allow manual
  return bbchFlatIndex.some((e) => e.stage === code);
}

/* ==========================================================================
   PSM Register Search Module
   ========================================================================== */

async function loadPsmRegisterData() {
  try {
    const response = await fetch("data/psm-register.json");
    if (!response.ok) throw new Error("Failed to load");
    const data = await response.json();
    psmRegisterData = data.products || [];
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

function filterPsmProducts(query) {
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

function renderProductDropdown(index, matches) {
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

function selectProductOption(index, product) {
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

function closeProductDropdown(index) {
  const dropdown = document.getElementById(`product-dropdown-${index}`);
  if (dropdown) dropdown.classList.remove("open");
}

function highlightProductOption(index, direction) {
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

function selectHighlightedProductOption(index) {
  const dropdown = document.getElementById(`product-dropdown-${index}`);
  if (!dropdown) return;
  const highlighted = dropdown.querySelector(".product-option.highlighted");
  if (highlighted) highlighted.click();
}

function initProductSearchForRow(index) {
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

/* ==========================================================================
   Geolocation Helper
   ========================================================================== */

function initGeolocation() {
  const btn = document.getElementById("btn-gps");
  if (!btn) return;
  if (!navigator.geolocation) {
    btn.style.display = "none";
    return;
  }
  btn.addEventListener("click", requestLocation);
}

function requestLocation() {
  const btn = document.getElementById("btn-gps");
  const status = document.getElementById("gps-status");
  setGpsButtonState("loading");
  if (status) {
    status.textContent = STRINGS.gpsLoading;
    status.className = "gps-status";
  }
  navigator.geolocation.getCurrentPosition(
    handleLocationSuccess,
    handleLocationError,
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function handleLocationSuccess(position) {
  const lat = position.coords.latitude.toFixed(6);
  const lon = position.coords.longitude.toFixed(6);
  const input = document.getElementById("location");
  if (input) input.value = `${lat}, ${lon}`;
  setGpsButtonState("success");
  const status = document.getElementById("gps-status");
  if (status) {
    status.textContent = STRINGS.gpsSuccess;
    status.className = "gps-status success";
  }
  clearError("error-location");
}

function handleLocationError(error) {
  let message = STRINGS.gpsUnavailable;
  if (error.code === 1) message = STRINGS.gpsPermissionDenied;
  else if (error.code === 3) message = STRINGS.gpsTimeout;
  setGpsButtonState("error");
  const status = document.getElementById("gps-status");
  if (status) {
    status.textContent = message;
    status.className = "gps-status error";
  }
}

function setGpsButtonState(state) {
  const btn = document.getElementById("btn-gps");
  if (!btn) return;
  btn.classList.remove("loading", "success", "error");
  if (state === "loading") btn.classList.add("loading");
  else if (state === "success") btn.classList.add("success");
  else if (state === "error") btn.classList.add("error");
}

/* ==========================================================================
   Conditional Fields
   ========================================================================== */

function initConditionalFields() {
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

/* ==========================================================================
   Tank Mix Manager
   ========================================================================== */

function initTankMix() {
  const addBtn = document.getElementById("btn-add-product");
  if (addBtn) {
    addBtn.addEventListener("click", addProductRow);
  }
}

function addProductRow() {
  if (productRowCount >= MAX_PRODUCT_ROWS) return;
  const container = document.getElementById("product-rows");
  const index = productRowCount;
  productRowCount++;

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
        <label for="product-amount-${index}">Aufwandmenge <span class="required">*</span></label>
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

function removeProductRow(index) {
  if (productRowCount <= 1) return;
  const container = document.getElementById("product-rows");
  const row = container.querySelector(`.product-row[data-index="${index}"]`);
  if (row) {
    row.remove();
    productRowCount--;
    reindexProductRows();
  }
}

function reindexProductRows() {
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

function getProductRowsData() {
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

/* ==========================================================================
   Validation Engine
   ========================================================================== */

function validateForm() {
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
  if (bbchRequired && bbchRequired.checked) {
    const bbchManual = document.getElementById("bbch-manual");
    let bbchCode = "";
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

  return isValid ? { eppoCode, bbchCode: bbchRequired?.checked ? (document.getElementById("bbch-manual")?.checked ? document.getElementById("bbch-code-manual")?.value?.trim() : document.getElementById("bbch-code")?.value?.trim()) : "", products } : null;
}

/* ==========================================================================
   PDF Generator
   ========================================================================== */

function generatePDF(data) {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) {
    showGlobalError(STRINGS.errorJsPdfLoad);
    return;
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const margin = 20;
  let y = margin;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Pflanzenschutzmittel-Anwendungsnachweis", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  const now = new Date();
  const genDate = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()} um ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} Uhr`;
  doc.text(`Erstellt am ${genDate}`, margin, y);
  y += 10;
  doc.setTextColor(0);

  // Helper for blocks
  function addBlock(title, rows) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    rows.forEach(([label, value]) => {
      if (value) {
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, margin, y);
        const labelWidth = doc.getTextWidth(`${label}:`);
        doc.setFont("helvetica", "normal");
        doc.text(String(value), margin + labelWidth + 2, y);
        y += 5;
      }
    });
    y += 4;
  }

  addBlock("Anwender", [
    ["Anwender", sanitizeInput(document.getElementById("applicant").value)],
    ["Auftraggeber/Landwirt", sanitizeInput(document.getElementById("client").value) || null],
    ["Art der Verwendung", document.getElementById("usage-type").value],
    ["Datum", formatDateDe(document.getElementById("application-date").value)],
    ["Uhrzeit", document.getElementById("time-required").checked ? document.getElementById("application-time").value : null],
  ]);

  addBlock("Fläche", [
    ["Flächenbezeichnung", sanitizeInput(document.getElementById("plot-name").value)],
    ["Schlag Nr.", sanitizeInput(document.getElementById("plot-number").value) || null],
    ["Schlaggröße lt. INVEKOS GIS", sanitizeInput(document.getElementById("plot-size-invekos").value) ? `${document.getElementById("plot-size-invekos").value.replace(".", ",")} ha` : null],
    ["Lage (FLIK/GPS)", sanitizeInput(document.getElementById("location").value)],
    ["Behandelte Fläche", `${document.getElementById("treated-area").value.replace(".", ",")} ha`],
  ]);

  addBlock("Kultur", [
    ["Kultur", sanitizeInput(document.getElementById("crop-name").value)],
    ["EPPO-Code", data.eppoCode],
    ["BBCH-Stadium", data.bbchCode || null],
  ]);

  // Products table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Angewendete Produkte", margin, y);
  y += 6;

  const tableBody = data.products.map((p, i) => [
    i + 1,
    sanitizeInput(p.name),
    sanitizeInput(p.regNumber),
    `${p.amount.replace(".", ",")} ${p.unit}`,
  ]);

  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "Produkt", "Zulassungsnummer", "Menge"]],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: [45, 90, 39], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, font: "helvetica" },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: "auto" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 40 },
    },
  });

  y = doc.lastAutoTable.finalY + 10;

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(120);
  const footerLines = doc.splitTextToSize(STRINGS.pdfDisclaimer, 170);
  doc.text(footerLines, margin, y);
  y += footerLines.length * 4 + 4;
  doc.text("Seite 1 von 1", margin, y);

  const plotName = document.getElementById("plot-name").value;
  const dateStr = document.getElementById("application-date").value;
  const applicant = document.getElementById("applicant").value;
  const client = document.getElementById("client").value;
  const filename = generateFilename(plotName, dateStr, applicant, client) + ".pdf";
  doc.save(filename);
}

/* ==========================================================================
   Excel Generator
   ========================================================================== */

async function generateExcel(data) {
  const ExcelJS = window.ExcelJS;
  if (!ExcelJS) {
    showGlobalError("Excel-Bibliothek konnte nicht geladen werden. Bitte prüfen Sie Ihre Internetverbindung.");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OpenPSM";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Nachweis");
  ws.columns = [
    { width: 25 },
    { width: 40 },
    { width: 25 },
    { width: 15 },
    { width: 15 },
  ];

  const DARK_GREEN = "2D5A27";
  const LIGHT_GRAY = "F5F5F5";
  const BORDER_GRAY = "DDDDDD";

  function addSectionHeader(ws, title) {
    const row = ws.addRow([title]);
    row.font = { bold: true, size: 12, color: { argb: "FFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_GREEN } };
    ws.mergeCells(`A${row.number}:E${row.number}`);
    return row;
  }

  function addLabelValue(ws, label, value) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true, size: 11 };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GRAY } };
    row.getCell(2).font = { size: 11 };
    ws.mergeCells(`B${row.number}:E${row.number}`);
    return row;
  }

  // Title
  const titleRow = ws.addRow(["Pflanzenschutzmittel-Anwendungsnachweis"]);
  titleRow.font = { bold: true, size: 16, color: { argb: DARK_GREEN } };
  ws.mergeCells("A1:E1");
  ws.addRow([]);

  // Anwender & Datum
  addSectionHeader(ws, "Anwender & Datum");
  addLabelValue(ws, "Anwender", sanitizeInput(document.getElementById("applicant").value));
  const clientVal = sanitizeInput(document.getElementById("client").value);
  if (clientVal) addLabelValue(ws, "Auftraggeber/Landwirt", clientVal);
  addLabelValue(ws, "Art der Verwendung", document.getElementById("usage-type").value);
  addLabelValue(ws, "Datum", formatDateDe(document.getElementById("application-date").value));
  if (document.getElementById("time-required").checked) {
    addLabelValue(ws, "Uhrzeit", document.getElementById("application-time").value);
  }
  ws.addRow([]);

  // Fläche & Lage
  addSectionHeader(ws, "Fläche & Lage");
  addLabelValue(ws, "Flächenbezeichnung", sanitizeInput(document.getElementById("plot-name").value));
  const plotNumberVal = sanitizeInput(document.getElementById("plot-number").value);
  if (plotNumberVal) addLabelValue(ws, "Schlag Nr.", plotNumberVal);
  const plotSizeInvekosVal = document.getElementById("plot-size-invekos").value;
  if (plotSizeInvekosVal) addLabelValue(ws, "Schlaggröße lt. INVEKOS GIS", plotSizeInvekosVal.replace(".", ",") + " ha");
  addLabelValue(ws, "Lage (FLIK/GPS)", sanitizeInput(document.getElementById("location").value));
  addLabelValue(ws, "Behandelte Fläche", document.getElementById("treated-area").value.replace(".", ",") + " ha");
  ws.addRow([]);

  // Kultur
  addSectionHeader(ws, "Kultur");
  addLabelValue(ws, "Kultur", sanitizeInput(document.getElementById("crop-name").value));
  addLabelValue(ws, "EPPO-Code", data.eppoCode || "-");
  addLabelValue(ws, "BBCH-Stadium", data.bbchCode || "-");
  ws.addRow([]);

  // Produkte
  addSectionHeader(ws, "Angewendete Produkte");

  const tableHeader = ws.addRow(["#", "Produktname", "Zulassungsnummer", "Menge", "Einheit"]);
  tableHeader.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_GREEN } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: DARK_GREEN } },
      bottom: { style: "thin", color: { argb: DARK_GREEN } },
      left: { style: "thin", color: { argb: DARK_GREEN } },
      right: { style: "thin", color: { argb: DARK_GREEN } },
    };
  });

  data.products.forEach((p, i) => {
    const row = ws.addRow([i + 1, sanitizeInput(p.name), sanitizeInput(p.regNumber), p.amount.replace(".", ","), p.unit]);
    row.eachCell((cell) => {
      cell.font = { size: 11 };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER_GRAY } },
        bottom: { style: "thin", color: { argb: BORDER_GRAY } },
        left: { style: "thin", color: { argb: BORDER_GRAY } },
        right: { style: "thin", color: { argb: BORDER_GRAY } },
      };
    });
    row.getCell(1).alignment = { horizontal: "center" };
  });
  ws.addRow([]);

  // Disclaimer
  const disclaimerRow = ws.addRow([STRINGS.pdfDisclaimer]);
  disclaimerRow.font = { italic: true, size: 9, color: { argb: "888888" } };
  disclaimerRow.alignment = { wrapText: true };
  ws.mergeCells(`A${disclaimerRow.number}:E${disclaimerRow.number}`);

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = generateFilename(
    document.getElementById("plot-name").value,
    document.getElementById("application-date").value,
    document.getElementById("applicant").value,
    document.getElementById("client").value
  ) + ".xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ==========================================================================
   Global Error
   ========================================================================== */

function showGlobalError(message) {
  const el = document.getElementById("error-global");
  if (el) {
    el.textContent = message;
    el.classList.add("visible");
  }
}

function clearGlobalError() {
  const el = document.getElementById("error-global");
  if (el) {
    el.textContent = "";
    el.classList.remove("visible");
  }
}

/* ==========================================================================
   HTML Escape
   ========================================================================== */

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* ==========================================================================
   jsPDF Availability Check
   ========================================================================== */

function checkJsPdf() {
  const btn = document.getElementById("btn-generate");
  if (!window.jspdf || !window.jspdf.jsPDF) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "PDF nicht verfügbar";
    }
    showGlobalError(STRINGS.errorJsPdfLoad);
    return false;
  }
  if (btn) btn.disabled = false;
  return true;
}

function checkExcelJs() {
  if (!window.ExcelJS) {
    showGlobalError("Excel-Bibliothek konnte nicht geladen werden. Bitte prüfen Sie Ihre Internetverbindung und laden Sie die Seite neu.");
    return false;
  }
  return true;
}

/* ==========================================================================
   Initialization
   ========================================================================== */

async function init() {
  setTodayDefaults();
  loadFormCache();
  initConditionalFields();
  initTankMix();
  initEppoSearch();
  initBbchSearch();
  initGeolocation();
  initProductSearchForRow(0);

  await Promise.all([loadEppoData(), loadBbchData(), loadPsmRegisterData()]);

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

    if (wantPdf) {
      try {
        generatePDF(data);
      } catch (err) {
        console.error("PDF generation failed:", err);
        showGlobalError("PDF-Erstellung fehlgeschlagen.");
      }
    }

    if (wantExcel) {
      if (checkExcelJs()) {
        try {
          await generateExcel(data);
        } catch (err) {
          console.error("Excel generation failed:", err);
          showGlobalError("Excel-Erstellung fehlgeschlagen: " + (err.message || "Unbekannter Fehler"));
        }
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
