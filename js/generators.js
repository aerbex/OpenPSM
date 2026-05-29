/* ==========================================================================
   PDF Generator & Excel Generator
   ========================================================================== */

import { STRINGS } from "./constants.js";
import { formatDateDe, sanitizeInput, generateFilename } from "./utils.js";
import { showGlobalError } from "./ui.js";

export function generatePDF(data) {
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

  const notesVal = sanitizeInput(document.getElementById("notes").value);
  if (notesVal) {
    addBlock("Notizen", [
      ["Bemerkungen", notesVal],
    ]);
  }

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
    head: [["#", "Produkt", "Zulassungsnummer", "Menge pro ha"]],
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
  return { blob: doc.output("blob"), filename };
}

export async function generateExcel(data) {
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
  const notesValExcel = sanitizeInput(document.getElementById("notes").value);
  if (notesValExcel) addLabelValue(ws, "Bemerkungen", notesValExcel);
  ws.addRow([]);

  // Kultur
  addSectionHeader(ws, "Kultur");
  addLabelValue(ws, "Kultur", sanitizeInput(document.getElementById("crop-name").value));
  addLabelValue(ws, "EPPO-Code", data.eppoCode || "-");
  addLabelValue(ws, "BBCH-Stadium", data.bbchCode || "-");
  ws.addRow([]);

  // Produkte
  addSectionHeader(ws, "Angewendete Produkte");

  const tableHeader = ws.addRow(["#", "Produktname", "Zulassungsnummer", "Menge pro ha", "Einheit"]);
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
  const filename = generateFilename(
    document.getElementById("plot-name").value,
    document.getElementById("application-date").value,
    document.getElementById("applicant").value,
    document.getElementById("client").value
  ) + ".xlsx";
  return { blob, filename };
}

export function checkJsPdf() {
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

export function checkExcelJs() {
  if (!window.ExcelJS) {
    showGlobalError("Excel-Bibliothek konnte nicht geladen werden. Bitte prüfen Sie Ihre Internetverbindung und laden Sie die Seite neu.");
    return false;
  }
  return true;
}
