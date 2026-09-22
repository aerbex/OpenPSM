/* ==========================================================================
   PDF Generator & Excel Generator
   ========================================================================== */

import { STRINGS } from "./constants.js";
import { formatDateDe, sanitizeInput, generateFilename } from "./utils.js";
import { showGlobalError } from "./ui.js";
import { parseCoordinatesFromInput } from "./invekos.js";
import { renderPlotMapImage } from "./map-image.js";

export async function generatePDF(data) {
  const { jsPDF } = window.jspdf || {};
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

  const PAGE_HEIGHT = 297;
  const PAGE_WIDTH = 210;
  const LINE_HEIGHT = 5;
  const PLOT_IMAGE_SIZE = LINE_HEIGHT * 4; // 4 lines of text
  const PLOT_IMAGE_GUTTER = 5;

  function ensureSpace(height) {
    if (y + height > PAGE_HEIGHT - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function addBlock(title, rows, imageDataUrl = null) {
    const titleHeight = 6;
    const textX = imageDataUrl ? margin + PLOT_IMAGE_SIZE + PLOT_IMAGE_GUTTER : margin;
    doc.setFontSize(10);
    const wrappedRows = rows.filter(([, value]) => value).map(([label, value]) => {
      doc.setFont("helvetica", "bold");
      const valueX = textX + doc.getTextWidth(`${label}:`) + 2;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(String(value), PAGE_WIDTH - margin - valueX);
      return { label, valueX, lines };
    });
    const textHeight = wrappedRows.reduce((height, row) => height + row.lines.length * LINE_HEIGHT, 0);
    const blockHeight = Math.max(imageDataUrl ? PLOT_IMAGE_SIZE : 0, textHeight);
    // Keep ordinary blocks together; unusually long values may span pages.
    ensureSpace(titleHeight + Math.min(blockHeight, PAGE_HEIGHT - 2 * margin - titleHeight));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, margin, y);
    y += titleHeight;

    const blockStartY = y;
    const blockPage = doc.getNumberOfPages();

    // jsPDF text() draws at the baseline, so the visual top of a text line
    // sits ~ascender height above the baseline. Shift the image up by the
    // ascender so its top aligns with the top of the first text line.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const ascender = (doc.getFontSize() * 25.4) / 72 * 0.72;
    const imageY = blockStartY - ascender;

    if (imageDataUrl) {
      try {
        doc.addImage(imageDataUrl, "PNG", margin, imageY, PLOT_IMAGE_SIZE, PLOT_IMAGE_SIZE);
      } catch (err) {
        console.warn("addImage failed:", err);
      }
    }

    wrappedRows.forEach(({ label, valueX, lines }) => {
      lines.forEach((line, index) => {
        ensureSpace(LINE_HEIGHT);
        if (index === 0) {
          doc.setFont("helvetica", "bold");
          doc.text(`${label}:`, textX, y);
        }
        doc.setFont("helvetica", "normal");
        doc.text(line, valueX, y);
        y += LINE_HEIGHT;
      });
    });

    if (imageDataUrl && doc.getNumberOfPages() === blockPage) {
      y = Math.max(y, imageY + PLOT_IMAGE_SIZE);
    }
    y += 4;
  }

  const includeMapImages = document.getElementById("include-map-image")?.checked ?? true;
  const plotImageResults = includeMapImages
    ? await Promise.all(
        data.plots.map(async (plot) => {
          const coords = parseCoordinatesFromInput(plot.location);
          if (!coords) return { dataUrl: null, hadCoords: false };
          const labelSource = plot.mapFieldName || (plot.mapPolygon ? plot.plotName : "");
          const dataUrl = await renderPlotMapImage({
            lat: coords.lat,
            lon: coords.lon,
            zoom: plot.mapZoom,
            polygon: plot.mapPolygon,
            fieldName: sanitizeInput(labelSource) || null,
          });
          return { dataUrl, hadCoords: true };
        })
      )
    : data.plots.map(() => ({ dataUrl: null, hadCoords: false }));
  const plotImages = plotImageResults.map((r) => r.dataUrl);
  const failedImageCount = plotImageResults.filter(
    (r) => r.hadCoords && r.dataUrl === null
  ).length;

  addBlock("Anwender", [
    ["Anwender", sanitizeInput(document.getElementById("applicant").value)],
    ["Auftraggeber/Landwirt", sanitizeInput(document.getElementById("client").value) || null],
    ["Betriebsnummer", sanitizeInput(document.getElementById("betriebsnummer")?.value) || null],
    ["Art der Verwendung", document.getElementById("usage-type").value],
    ["Datum", formatDateDe(document.getElementById("application-date").value)],
    ["Uhrzeit", document.getElementById("time-required").checked ? document.getElementById("application-time").value : null],
  ]);

  data.plots.forEach((plot, i) => {
    addBlock(
      i === 0 ? "Fläche" : `Fläche ${i + 1}`,
      [
        ["Flächenbezeichnung", sanitizeInput(plot.plotName)],
        ["Schlag Nr.", sanitizeInput(plot.plotNumber) || null],
        ["Schlaggröße lt. INVEKOS GIS", sanitizeInput(plot.plotSizeInvekos) ? `${plot.plotSizeInvekos.replace(".", ",")} ha` : null],
        ["Lage (FLIK/GPS)", sanitizeInput(plot.location)],
        ["Behandelte Fläche", `${plot.treatedArea.replace(".", ",")} ha`],
      ],
      plotImages[i]
    );
  });

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
  ensureSpace(25);
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
    margin: { top: margin, bottom: margin, left: margin, right: margin },
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
  ensureSpace(footerLines.length * 4);
  doc.text(footerLines, margin, y);
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.text(`Seite ${page} von ${totalPages}`, margin, PAGE_HEIGHT - 10);
  }

  const plotName = data.plots[0]?.plotName || "";
  const dateStr = document.getElementById("application-date").value;
  const applicant = document.getElementById("applicant").value;
  const client = document.getElementById("client").value;
  const filename = generateFilename(plotName, dateStr, applicant, client) + ".pdf";

  if (failedImageCount > 0) {
    showGlobalError(
      `Hinweis: ${failedImageCount} Kartenbild${failedImageCount === 1 ? "" : "er"} konnte${failedImageCount === 1 ? "" : "n"} nicht geladen werden (z. B. wegen fehlender Internetverbindung). Die betroffenen Flächen erscheinen ohne Karte im PDF.`
    );
  }
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
    { width: 26 },
    { width: 20 },
    { width: 14 },
    { width: 10 },
  ];
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  };

  const DARK_GREEN = "2D5A27";
  const LIGHT_GRAY = "F5F5F5";
  const BORDER_GRAY = "DDDDDD";

  function addSectionHeader(ws, title) {
    const row = ws.addRow([title]);
    row.font = { bold: true, size: 12, color: { argb: "FFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_GREEN } };
    ws.mergeCells(`A${row.number}:D${row.number}`);
    return row;
  }

  function addLabelValue(ws, label, value) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true, size: 11 };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GRAY } };
    row.getCell(2).font = { size: 11 };
    ws.mergeCells(`B${row.number}:D${row.number}`);
    return row;
  }

  // Title
  const titleRow = ws.addRow(["Pflanzenschutzmittel-Anwendungsnachweis"]);
  titleRow.font = { bold: true, size: 16, color: { argb: DARK_GREEN } };
  ws.mergeCells("A1:D1");
  ws.addRow([]);

  // Anwender & Datum
  addSectionHeader(ws, "Anwender & Datum");
  addLabelValue(ws, "Anwender", sanitizeInput(document.getElementById("applicant").value));
  const clientVal = sanitizeInput(document.getElementById("client").value);
  if (clientVal) addLabelValue(ws, "Auftraggeber/Landwirt", clientVal);
  const betriebsnummerVal = sanitizeInput(document.getElementById("betriebsnummer")?.value);
  if (betriebsnummerVal) addLabelValue(ws, "Betriebsnummer", betriebsnummerVal);
  addLabelValue(ws, "Art der Verwendung", document.getElementById("usage-type").value);
  addLabelValue(ws, "Datum", formatDateDe(document.getElementById("application-date").value));
  if (document.getElementById("time-required").checked) {
    addLabelValue(ws, "Uhrzeit", document.getElementById("application-time").value);
  }
  ws.addRow([]);

  // Fläche & Lage
  addSectionHeader(ws, "Fläche & Lage");
  data.plots.forEach((plot) => {
    addLabelValue(ws, "Flächenbezeichnung", sanitizeInput(plot.plotName));
    const plotNumberVal = sanitizeInput(plot.plotNumber);
    if (plotNumberVal) addLabelValue(ws, "Schlag Nr.", plotNumberVal);
    const plotSizeInvekosVal = plot.plotSizeInvekos;
    if (plotSizeInvekosVal) addLabelValue(ws, "Schlaggröße lt. INVEKOS GIS", plotSizeInvekosVal.replace(".", ",") + " ha");
    addLabelValue(ws, "Lage (FLIK/GPS)", sanitizeInput(plot.location));
    addLabelValue(ws, "Behandelte Fläche", plot.treatedArea.replace(".", ",") + " ha");
  });
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

  const tableHeader = ws.addRow(["Produktname", "Zulassungsnummer", "Menge pro ha", "Einheit"]);
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
    const row = ws.addRow([sanitizeInput(p.name), sanitizeInput(p.regNumber), p.amount.replace(".", ","), p.unit]);
    row.eachCell((cell) => {
      cell.font = { size: 11 };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER_GRAY } },
        bottom: { style: "thin", color: { argb: BORDER_GRAY } },
        left: { style: "thin", color: { argb: BORDER_GRAY } },
        right: { style: "thin", color: { argb: BORDER_GRAY } },
      };
    });
    row.getCell(1).alignment = { horizontal: "left" };
  });
  ws.addRow([]);

  // Disclaimer
  const disclaimerRow = ws.addRow([STRINGS.pdfDisclaimer]);
  disclaimerRow.font = { italic: true, size: 9, color: { argb: "888888" } };
  disclaimerRow.alignment = { wrapText: true };
  ws.mergeCells(`A${disclaimerRow.number}:D${disclaimerRow.number}`);

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const filename = generateFilename(
    data.plots[0]?.plotName || "",
    document.getElementById("application-date").value,
    document.getElementById("applicant").value,
    document.getElementById("client").value
  ) + ".xlsx";
  return { blob, filename };
}

export function checkJsPdf() {
  if (!window.jspdf?.jsPDF?.API?.autoTable) {
    showGlobalError(STRINGS.errorJsPdfLoad);
    return false;
  }
  return true;
}

export function checkExcelJs() {
  if (!window.ExcelJS) {
    showGlobalError("Excel-Bibliothek konnte nicht geladen werden. Bitte prüfen Sie Ihre Internetverbindung und laden Sie die Seite neu.");
    return false;
  }
  return true;
}
