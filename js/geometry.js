// ===== js/geometry.js — Cell geometry (polygons, centers, neighbors, boundaries) and organic
// transitions between terrains, grouping of zones of the same type.
//
// Classic script (not a module): all js/ files share the same global scope
// and are loaded in the fixed order of the <script> tags in index.html (the only reference).
// Code run when a file loads can only use what is declared in
// that file or the previous ones; functions, called later, see everything.

function cellPoly(col, rowIdx) {
  const b = BANDS[rowIdx + 1];
  const y0 = b.top, yb = b.bot, rowH = yb - y0;
  const x0 = b.left + col * CELL_SLOT, mid = y0 + rowH / 2, rx = x0 + CELL_SLOT + NOTCH;
  if (col === 0) return [[x0,y0],[x0+CELL_SLOT,y0],[rx,mid],[x0+CELL_SLOT,yb],[x0,yb],[x0-NOTCH,mid]];
  return [[x0,y0],[x0+CELL_SLOT,y0],[rx,mid],[x0+CELL_SLOT,yb],[x0,yb],[x0+NOTCH,mid]];
}
function pts2s(p) { return p.map(v => Math.round(v[0]) + ',' + Math.round(v[1])).join(' '); }

function leftMaskPoly(i) {
  const b = BANDS[i], y0 = b.top, yb = b.bot, mid = (y0 + yb) / 2, l = b.left;
  return `0,${y0} ${l},${y0} ${l+NOTCH},${mid} ${l},${yb} 0,${yb}`;
}
function rightMaskPoly(i) {
  const b = BANDS[i], y0 = b.top, yb = b.bot, mid = (y0 + yb) / 2, re = b.left + COLS * CELL_SLOT;
  return `${re},${y0} ${VW},${y0} ${VW},${yb} ${re},${yb} ${re+NOTCH},${mid}`;
}
function mkEl(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

// Generic overlay placer: positions an <image> centered on (cx,cy) with given size/offset
// Shows the preview (displayHref); the export replaces it with the original (exportPNG).
function placeOverlay(svg, href, cx, cy, w, h, dx = 0, dy = 0) {
  const img = mkEl('image', {
    href: displayHref(href),
    x: Math.round(cx - w / 2 + dx),
    y: Math.round(cy - h / 2 + dy),
    width: w, height: h,
    preserveAspectRatio: 'xMidYMid meet'
  });
  svg.appendChild(img);
  return img;
}

function cellCenter(col, rowIdx, xOffset = 0) {
  const b = BANDS[rowIdx + 1], rowH = b.bot - b.top;
  return {
    cx: b.left + col * CELL_SLOT + CELL_SLOT * 0.5 + NOTCH * 0.3 + xOffset,
    cy: b.top + rowH * 0.5
  };
}

function seededRandom(seed) {
  let t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function cellBBox(col, row) {
  const xs = cellPoly(col, row).map(p => p[0]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs) };
}

function cellXRange(col, row) {
  const b = BANDS[row + 1];
  const x0 = b.left + col * CELL_SLOT;
  return [x0, x0 + CELL_SLOT];
}

function getNeighborPairs() {
  const pairs = [];
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) {
      if (col < COLS - 1) pairs.push([[col, row], [col + 1, row]]);
      if (row < ROWS - 1) {
        const bb = cellBBox(col, row);
        for (let nc = 0; nc < COLS; nc++) {
          const nbb = cellBBox(nc, row + 1);
          if (Math.min(bb.maxX, nbb.maxX) - Math.max(bb.minX, nbb.minX) > 0)
            pairs.push([[col, row], [nc, row + 1]]);
        }
      }
    }
  return pairs;
}

// Exact path of the real boundary between two cells:
// - same row: the "V" formed by the tip of the chevron (3 points)
// - between rows: the straight line of the shared band, over the whole overlap width
function boundaryLine(colA, rowA, colB, rowB) {
  if (rowA === rowB) {
    const b = BANDS[rowA + 1];
    const leftCol = Math.min(colA, colB);
    const x0 = b.left + leftCol * CELL_SLOT;
    const rx = x0 + CELL_SLOT + NOTCH;
    return [[x0 + CELL_SLOT, b.top], [rx, (b.top + b.bot) / 2], [x0 + CELL_SLOT, b.bot]];
  }
  const [aMin, aMax] = cellXRange(colA, rowA);
  const [bMin, bMax] = cellXRange(colB, rowB);
  const ox0 = Math.max(aMin, bMin), ox1 = Math.min(aMax, bMax);
  const y = rowA < rowB ? BANDS[rowA + 1].bot : BANDS[rowB + 1].bot;
  return [[ox0, y], [ox1, y]];
}

// Advances by distance d (arc length) along the polyline pts,
// returns the position and the perpendicular normal at that point.
function pointAlong(pts, d) {
  let remaining = d;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const segLen = Math.hypot(x2 - x1, y2 - y1);
    if (remaining <= segLen || i === pts.length - 2) {
      const t = segLen === 0 ? 0 : remaining / segLen;
      const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      const len = segLen || 1;
      return { x, y, nx: -(y2 - y1) / len, ny: (x2 - x1) / len };
    }
    remaining -= segLen;
  }
  const [x, y] = pts[pts.length - 1];
  return { x, y, nx: 0, ny: 1 };
}
function polylineLength(pts) {
  let L = 0;
  for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1]);
  return L;
}

// Smooth but irregular noise: frequencies AND relative weights drawn at random per boundary
// (no fixed rhythm that repeats), plus one big random bump to break
// the regularity — like the big uneven swellings seen on the original board.
function smoothNoise(t, seed) {
  const p1 = seededRandom(seed) * Math.PI * 2;
  const p2 = seededRandom(seed + 1) * Math.PI * 2;
  const f1 = 0.8 + seededRandom(seed + 2) * 0.8;   // 0.8..1.6
  const f2 = 1.6 + seededRandom(seed + 3) * 1.4;   // 1.6..3.0
  const w1 = 0.5 + seededRandom(seed + 4) * 0.4;   // 0.5..0.9
  const w2 = 1 - w1;
  let n = Math.sin(t * Math.PI * 2 * f1 + p1) * w1
        + Math.sin(t * Math.PI * 2 * f2 + p2) * w2;

  // One big isolated bump, at a random position along the boundary
  const bumpCenter = 0.2 + seededRandom(seed + 5) * 0.6; // avoids the ends
  const bumpWidth = 0.12 + seededRandom(seed + 6) * 0.12;
  const bumpSign = seededRandom(seed + 7) < 0.5 ? -1 : 1;
  const bumpStrength = 0.4 + seededRandom(seed + 8) * 0.5;
  const d = (t - bumpCenter) / bumpWidth;
  n += bumpSign * bumpStrength * Math.exp(-d * d);

  // Fine grain on top of the big wave: higher frequency, much smaller amplitude —
  // makes the outline look less "clean/vector" without breaking the general shape.
  const f3 = 6 + seededRandom(seed + 10) * 5;   // 6..11
  const p3 = seededRandom(seed + 11) * Math.PI * 2;
  const f4 = 12 + seededRandom(seed + 12) * 6;  // 12..18
  const p4 = seededRandom(seed + 13) * Math.PI * 2;
  n += Math.sin(t * Math.PI * 2 * f3 + p3) * 0.10
     + Math.sin(t * Math.PI * 2 * f4 + p4) * 0.06;

  return n;
}

// ONE single torn curve that replaces the original straight boundary.
// Used for both A and B: where it leans toward A, B paints up to
// this curve (and vice versa) — since it is the same curve on both sides, no
// seam is possible between the two textures.
function jaggedCurve(pts, amplitude, seed, samples = 50) {
  const L = polylineLength(pts);
  const curve = [];
  // Overall intensity varies per boundary: some calm, others pronounced.
  const intensity = 0.4 + seededRandom(seed + 9) * 0.8; // 0.4..1.2
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const { x, y, nx, ny } = pointAlong(pts, t * L);
    // sin(t·π) window: forces the amplitude to 0 exactly at both ends,
    // so the curve joins the real corners of the cell perfectly (no gap).
    const off = amplitude * intensity * smoothNoise(t, seed) * Math.sin(t * Math.PI);
    curve.push([x + nx * off, y + ny * off]);
  }
  return curve;
}

// Directly builds the complete closed outline (straight line out + smoothed curve back)
// in a single pass, without fragile concatenation of two distinct paths.
function sliverPath(pts, curveReversed) {
  let d = `M ${pts[0][0]},${pts[0][1]} `;
  for (let i = 1; i < pts.length; i++) d += `L ${pts[i][0]},${pts[i][1]} `;
  for (let i = 0; i < curveReversed.length - 1; i++) {
    const cur = curveReversed[i], next = curveReversed[i + 1];
    const mid = [(cur[0]+next[0])/2, (cur[1]+next[1])/2];
    d += i === 0 ? `L ${mid[0]},${mid[1]} ` : `Q ${cur[0]},${cur[1]}, ${mid[0]},${mid[1]} `;
  }
  const lastC = curveReversed[curveReversed.length - 1];
  d += `L ${lastC[0]},${lastC[1]} `;
  return d + 'Z';
}

// Only one <image> per terrain is created (in <defs>, never displayed directly),
// then reused via <use> for each transition — avoids duplicating the texture's
// base64 data for each pair of cells (big gain in size/performance).
function getSharedTextureImage(defs, base) {
  if (transTexCache[base]) return transTexCache[base];
  const id = `trans-tex-${base}`;
  const img = mkEl('image', {
    id, href: displayHref(TEXTURE_PATHS[base]),
    x: textureRect().x, y: textureRect().y, width: textureRect().w, height: textureRect().h, preserveAspectRatio: 'none'
  });
  defs.appendChild(img);
  transTexCache[base] = id;
  return id;
}

// Always puts a pair of cells back in the same canonical order, whichever
// one triggered the computation — guarantees an identical outline (same random
// seed) whether the transition comes from a full rebuild or from an
// incremental update triggered by either of the two cells.
function canonicalPair(colA, rowA, colB, rowB) {
  const sameRow = rowA === rowB;
  const aFirst = sameRow ? colA <= colB : rowA <= rowB;
  return aFirst ? [colA, rowA, colB, rowB] : [colB, rowB, colA, rowA];
}

function drawTransition(target, defs, pairA, pairB) {
  const [colA, rowA, colB, rowB] = canonicalPair(pairA[0], pairA[1], pairB[0], pairB[1]);
  try {
    const typeA = board[rowA * COLS + colA], typeB = board[rowB * COLS + colB];
    const baseA = baseId(typeA), baseB = baseId(typeB);
    if (baseA === baseB || baseA === 'road' || baseB === 'road') return;
    if (!TEXTURES[baseA] || !TEXTURES[baseB]) return;

    const uid = `${colA}-${rowA}-${colB}-${rowB}`;
    const pairTag = `${colA},${rowA},${colB},${rowB}`;
    const seed = colA * 31 + rowA * 97 + colB * 13 + rowB * 211;
    const sameRow = rowA === rowB;
    const bandH = BANDS[rowA + 1].bot - BANDS[rowA + 1].top;
    const amp = sameRow ? CELL_SLOT * 0.13 : bandH * 0.13;
    const pts = boundaryLine(colA, rowA, colB, rowB);
    const curve = jaggedCurve(pts, amp, seed);

    // "Sliver" = zone between the original line and the torn curve —
    // one and the same shape used for both textures, just clipped differently.
    const sliverD = sliverPath(pts, curve.slice().reverse());

    const clipAId = `tcellA-${uid}`, clipBId = `tcellB-${uid}`;
    const clipA = mkEl('clipPath', {id: clipAId});
    clipA.appendChild(mkEl('polygon', {points: pts2s(cellPoly(colA, rowA))}));
    defs.appendChild(clipA);
    const clipB = mkEl('clipPath', {id: clipBId});
    clipB.appendChild(mkEl('polygon', {points: pts2s(cellPoly(colB, rowB))}));
    defs.appendChild(clipB);

  const imgBId = getSharedTextureImage(defs, baseB);
  const gA = mkEl('g', {'clip-path': `url(#${clipAId})`, 'data-pair': pairTag, 'data-uid': uid});
  const sliverClipA = mkEl('clipPath', {id: `sliver-${uid}-a`});
  sliverClipA.appendChild(mkEl('path', {d: sliverD}));
  defs.appendChild(sliverClipA);
  const gA2 = mkEl('g', {'clip-path': `url(#sliver-${uid}-a)`});
  gA2.appendChild(mkEl('use', {href: `#${imgBId}`}));
  gA.appendChild(gA2);
  target.appendChild(gA);

  const imgAId = getSharedTextureImage(defs, baseA);
  const gB = mkEl('g', {'clip-path': `url(#${clipBId})`, 'data-pair': pairTag, 'data-uid': uid});
  const sliverClipB = mkEl('clipPath', {id: `sliver-${uid}-b`});
  sliverClipB.appendChild(mkEl('path', {d: sliverD}));
  defs.appendChild(sliverClipB);
  const gB2 = mkEl('g', {'clip-path': `url(#sliver-${uid}-b)`});
  gB2.appendChild(mkEl('use', {href: `#${imgAId}`}));
  gB.appendChild(gB2);
  target.appendChild(gB);
  } catch (e) {
    // A failed transition must never break the rest of the board or the export.
    console.warn('Transition non affichée pour la paire', colA, rowA, colB, rowB, e);
  }
}

// Direct neighbors of a cell (same row + between rows), to recompute
// only the affected boundaries during an incremental change.
function neighborsOf(col, row) {
  const result = [];
  if (col > 0) result.push([col - 1, row]);
  if (col < COLS - 1) result.push([col + 1, row]);
  [row - 1, row + 1].forEach(nr => {
    if (nr < 0 || nr >= ROWS) return;
    const bb = cellBBox(col, row);
    for (let nc = 0; nc < COLS; nc++) {
      const nbb = cellBBox(nc, nr);
      if (Math.min(bb.maxX, nbb.maxX) - Math.max(bb.minX, nbb.minX) > 0) result.push([nc, nr]);
    }
  });
  return result;
}
function pairsForCell(col, row) {
  return neighborsOf(col, row).map(n => [[col, row], n]);
}


