/* ==========================================================================
   Static map image renderer for PDF report
   ========================================================================== */

const TILE_SIZE = 256;
// Canvas size in source pixels. At a given tile zoom, smaller canvas = less
// ground area shown = visually more zoomed in.
const CANVAS_SIZE = 480;
const BASEMAP_URL = "https://mapsneu.wien.gv.at/basemap/geolandbasemap/normal/google3857";
const MAX_ZOOM = 19;

export async function renderPlotMapImage({ lat, lon, zoom, polygon, fieldName }) {
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (lat < -85 || lat > 85 || lon < -180 || lon > 180) return null;

  const z = clampZoom(zoom);
  const centerPx = lngLatToWorldPixel(lon, lat, z);
  const half = CANVAS_SIZE / 2;
  const tlX = centerPx.x - half;
  const tlY = centerPx.y - half;

  const tileXMin = Math.floor(tlX / TILE_SIZE);
  const tileYMin = Math.floor(tlY / TILE_SIZE);
  const tileXMax = Math.floor((tlX + CANVAS_SIZE - 1) / TILE_SIZE);
  const tileYMax = Math.floor((tlY + CANVAS_SIZE - 1) / TILE_SIZE);

  const tilePromises = [];
  for (let tx = tileXMin; tx <= tileXMax; tx++) {
    for (let ty = tileYMin; ty <= tileYMax; ty++) {
      tilePromises.push(loadTile(z, tx, ty));
    }
  }

  let tiles;
  try {
    tiles = await Promise.all(tilePromises);
  } catch (err) {
    console.warn("Map image tile fetch failed:", err);
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e8e8e8";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  tiles.forEach(({ img, tx, ty }) => {
    if (!img) return;
    ctx.drawImage(img, tx * TILE_SIZE - tlX, ty * TILE_SIZE - tlY);
  });

  const project = (lng, lt) => {
    const p = lngLatToWorldPixel(lng, lt, z);
    return { x: p.x - tlX, y: p.y - tlY };
  };

  if (polygon) {
    drawPolygon(ctx, polygon, project);
  }

  drawMarker(ctx, half, half);

  if (fieldName && polygon) {
    drawLabel(ctx, fieldName, polygon, project, { x: half, y: half });
  }

  try {
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("Canvas toDataURL failed (likely tainted):", err);
    return null;
  }
}

function clampZoom(zoom) {
  if (zoom == null || zoom === "") return 16;
  const z = Number(zoom);
  if (!Number.isFinite(z) || z < 1) return 16;
  return Math.max(1, Math.min(MAX_ZOOM, Math.floor(z)));
}

function lngLatToWorldPixel(lon, lat, zoom) {
  const scale = Math.pow(2, zoom) * TILE_SIZE;
  const x = ((lon + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale;
  return { x, y };
}

function loadTile(z, tx, ty) {
  const n = Math.pow(2, z);
  if (ty < 0 || ty >= n) {
    return Promise.resolve({ img: null, tx, ty });
  }
  const wrappedX = ((tx % n) + n) % n;
  const url = `${BASEMAP_URL}/${z}/${ty}/${wrappedX}.png`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ img, tx, ty });
    img.onerror = () => resolve({ img: null, tx, ty });
    img.src = url;
  });
}

function drawPolygon(ctx, geometry, project) {
  if (!geometry || !geometry.type) return;
  ctx.save();
  ctx.strokeStyle = "#b71c1c";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.fillStyle = "rgba(183, 28, 28, 0.18)";

  const drawRing = (ring) => {
    if (!Array.isArray(ring) || ring.length === 0) return;
    ctx.beginPath();
    ring.forEach((coord, i) => {
      if (!Array.isArray(coord) || coord.length < 2) return;
      const p = project(coord[0], coord[1]);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach(drawRing);
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((poly) => poly.forEach(drawRing));
  }
  ctx.restore();
}

function drawMarker(ctx, x, y) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, 2 * Math.PI);
  ctx.fillStyle = "#b71c1c";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.restore();
}

function drawLabel(ctx, text, geometry, project, markerCenter) {
  const bbox = geometryBBox(geometry);
  if (!bbox) return;
  const centerLon = (bbox.minLon + bbox.maxLon) / 2;
  const centerLat = (bbox.minLat + bbox.maxLat) / 2;
  const center = project(centerLon, centerLat);

  ctx.save();
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Truncate long names so the label box fits on the canvas
  const MAX_CHARS = 25;
  const labelText = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS - 1).trimEnd() + "…" : text;

  const padX = 8;
  const metrics = ctx.measureText(labelText);
  const boxW = metrics.width + padX * 2;
  const boxH = 30;

  // If the polygon centroid is too close to the marker, push the label below
  // it so the red pin stays visible. Marker radius is ~12px including stroke.
  const MARKER_CLEARANCE = 12 + boxH / 2 + 4;
  let labelCenterY = center.y;
  if (markerCenter && Math.abs(center.y - markerCenter.y) < MARKER_CLEARANCE
      && Math.abs(center.x - markerCenter.x) < boxW / 2 + 12) {
    labelCenterY = markerCenter.y + MARKER_CLEARANCE;
  }

  // Keep the label inside the canvas
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  let boxX = Math.round(center.x - boxW / 2);
  let boxY = Math.round(labelCenterY - boxH / 2);
  boxX = Math.max(2, Math.min(boxX, canvasW - boxW - 2));
  boxY = Math.max(2, Math.min(boxY, canvasH - boxH - 2));
  const drawCenterX = boxX + boxW / 2;
  const drawCenterY = boxY + boxH / 2;

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.strokeStyle = "#2d5a27";
  ctx.lineWidth = 2;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = "#1a1a1a";
  ctx.fillText(labelText, drawCenterX, drawCenterY + 1);
  ctx.restore();
}

function geometryBBox(geometry) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  const walk = (ring) => {
    if (!Array.isArray(ring)) return;
    ring.forEach((coord) => {
      if (!Array.isArray(coord) || coord.length < 2) return;
      const [lon, lat] = coord;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
  };
  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach(walk);
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((p) => p.forEach(walk));
  } else {
    return null;
  }
  if (!Number.isFinite(minLon)) return null;
  return { minLon, maxLon, minLat, maxLat };
}
