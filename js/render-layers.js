// ===== js/render-layers.js — Rendering of the board layers, from bottom to top: textures, transitions, road
// edges, borders, title band, overlays, title, masks, click areas, decorations.
//
// Classic script (not a module): all js/ files share the same global scope
// and are loaded in the fixed order of the <script> tags in index.html (the only reference).
// Code run when a file loads can only use what is declared in
// that file or the previous ones; functions, called later, see everything.

// ---- 2. Texture layers — one clipPath+image per base terrain type ----
function renderAllTextures(g, defs) {
  const baseTypes = [...new Set(TILES.map(t => baseId(t.id)))];
  baseTypes.forEach(base => {
    if (!TEXTURES[base]) return;
    const clipId = 'tex-clip-' + base;
    const cp = mkEl('clipPath', {id: clipId});
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++) {
        if (baseId(board[row * COLS + col]) !== base) continue;
        cp.appendChild(mkEl('polygon', {points: pts2s(cellPoly(col, row)), 'data-cell': row * COLS + col}));
      }
    defs.appendChild(cp);
    // Preview on screen (displayHref); the export replaces it with the original.
    g.appendChild(mkEl('image', {
      id: 'tex-image-' + base,
      href: displayHref(TEXTURE_PATHS[base]),
      x: textureRect().x, y: textureRect().y, width: textureRect().w, height: textureRect().h,
      'clip-path': `url(#${clipId})`,
      preserveAspectRatio: 'none'
    }));
  });
}

// ---- 2b. Organic procedural transitions between adjacent non-Road terrains ----
function renderAllTransitions(g, defs) {
  getNeighborPairs().forEach(([A, B]) => drawTransition(g, defs, A, B));
}

// ---- 3+4. Flat fill (cells without texture) + border (textured cells) ----
// Both go through exactly the same 48 cells in the same order — a
// cell always falls into one case or the other, never both — so a single
// pass is enough; each one simply goes into its own layer (gFlatFill / gBorders).
function renderFlatFillAndBorders(gFlatFill, gBorders) {
  for (let row = 0; row < ROWS; row++)
    for (let col = COLS - 1; col >= 0; col--) {
      const idx = row * COLS + col, type = board[idx];
      const hasTexture = !!TEXTURES[baseId(type)];
      const g = hasTexture ? gBorders : gFlatFill;
      g.appendChild(mkEl('polygon', {
        points: pts2s(cellPoly(col, row)),
        fill: hasTexture ? 'none' : tcolor(type),
        stroke: '#C07820', 'stroke-width': '2.5', 'stroke-linejoin': 'round',
        'data-cell': idx
      }));
    }
}

// ---- 5. Title band background (brown) + optional user image ----
// Horizontal offset (from the left edge of the band) where the title text
// starts on a Vendetta board — reused as is to align the Ignition crest
// at the same distance from the left edge (tbH is identical in both
// cases, only ROWS affects the band height, never COLS).
function titleTextLeftOffset(tbH) { return Math.round(tbH * 0.08) + 331; }

// Geometry of the Ignition crest, shared between renderTitleBand (the image) and
// renderTitleTextIgnition (the number) so that they always stay in sync
// — a single place to change if the crest's size/position changes.
// blasonFullSize is the reference for the number's size (which must NOT
// shrink with the crest, Mayrik's request); blasonSize (reduced by 10%) is
// the size actually displayed for the image. Shifted 242px to the left
// from its original position, at Mayrik's request.
function ignitionBlasonGeometry(tb, tbH) {
  const blasonFullSize = Math.round(tbH * 0.85);
  const blasonSize = Math.round(blasonFullSize * 0.9);
  const blasonLeft = tb.left + titleTextLeftOffset(tbH) - 242;
  const blasonCx = blasonLeft + blasonSize / 2;
  return { blasonFullSize, blasonSize, blasonLeft, blasonCx };
}

// Frame where the title image is placed (title band and its two tips), in pixels at 300 dpi.
// ONLY source of the recommended image size (tooltip of "Load title image", js/ui.js): an
// image of exactly this size is placed without being cropped or enlarged. Fixed on 19/11: the tooltip
// announced the width of the whole play area (GAME_W, ~195 px more), hence a cropped image.
function titleImageBox() {
  const tb = BANDS[0];
  return { x: tb.left - NOTCH, y: tb.top, w: COLS * CELL_SLOT + 2 * NOTCH, h: tb.bot - tb.top };
}

function renderTitleBand(g) {
  const tb = BANDS[0], tbMid = (tb.top + tb.bot) / 2, tbR = tb.left + COLS * CELL_SLOT, tbH = tb.bot - tb.top;
  g.appendChild(mkEl('polygon', {
    points: `${tb.left},${tb.top} ${tbR},${tb.top} ${tbR+NOTCH},${tbMid} ${tbR},${tb.bot} ${tb.left},${tb.bot} ${tb.left-NOTCH},${tbMid}`,
    fill: '#6B3A2A'
  }));
  // Decorative background image of the title band — loaded by the user
  // (Load title image), displayed in both board formats. Only the recommended
  // resolution (tooltip) differs depending on the format, see
  // titleImageBox().
  // Default image (no user image): its preview, displayed as soon as it
  // is downloaded; a user image is displayed as is.
  const userTitleImage = TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE;
  {
    const box = titleImageBox();
    g.appendChild(mkEl('image', {
      href: userTitleImage ? TITLE_IMAGE.src : displayHref(DEFAULT_TITLE_IMAGE_PATH),
      x: box.x, y: box.y,
      width: box.w, height: box.h,
      preserveAspectRatio: 'xMidYMid slice'
    }));
  }
  if (BOARD_TYPE === 'ignition') {
    // Ignition crest: aligned left at the same distance from the edge as the
    // Vendetta title text, vertically centered in the band.
    const { blasonSize, blasonLeft, blasonCx } = ignitionBlasonGeometry(tb, tbH);
    {
      g.appendChild(mkEl('image', {
        href: displayHref(BLASON_PATH),
        x: blasonLeft, y: tbMid - blasonSize / 2,
        width: blasonSize, height: blasonSize,
        // Tilted 10° to the left (counter-clockwise), requested by Mayrik —
        // same pivot (crest center) as the number in renderTitleTextIgnition,
        // so that they rotate together and stay visually aligned.
        transform: `rotate(-10, ${blasonCx}, ${tbMid})`
      }));
    }
  }
}

// ---- 6+7. Overlays (hazard/oil/ramp/multiramp/rock/fire), one <g data-cell> per cell ----
// Isometric rank of a cell: increasing from the top-right-most cell
// (drawn first, hence underneath) to the bottom-left-most one (drawn
// last, hence on top). Used to insert an element at the right place during
// an incremental update (updateCell), without having to rebuild everything —
// a simple appendChild would always put the modified element above everything,
// which would break the order as soon as a cell "behind" it already exists.
function overlayRank(idx) {
  const row = Math.floor(idx / COLS), col = idx % COLS;
  return row * COLS + (COLS - 1 - col);
}

// Rank of an element of the layer: a cell's overlay (data-cell), or an element placed between
// two cells, such as a barricade (data-rank, js/barricades.js).
function isometricRank(el) {
  if (el.dataset.rank !== undefined) return parseFloat(el.dataset.rank);
  if (el.dataset.cell !== undefined) return overlayRank(parseInt(el.dataset.cell));
  return undefined;
}
function insertInIsometricOrder(g, el, idx) {
  const rank = idx === undefined ? isometricRank(el) : overlayRank(idx);
  const next = [...g.children].find(child => {
    const r = isometricRank(child);
    return r !== undefined && r > rank;
  });
  if (next) g.insertBefore(el, next);
  else g.appendChild(el);
}

function renderAllOverlays(g) {
  // Single isometric order for ALL overlay types (Hazard/Oil/Ramp/
  // MultiRamp/Impassable/Fire): rows from top to bottom, columns from right to
  // left — the bottom-left-most cell is drawn last and visually
  // covers the cells behind it (top/right), like a real isometric view.
  // A single loop so that the order is respected also BETWEEN different
  // categories (not only within the same category): two separate loops prevented,
  // for example, a Rock cell from interleaving properly with a neighboring Hazard cell
  // depending on their real position.
  for (let row = 0; row < ROWS; row++)
    for (let col = COLS - 1; col >= 0; col--) {
      const t = board[row * COLS + col];
      const wrap = mkEl('g', {'data-cell': row * COLS + col});
      if (['haz_mud', 'haz_sand', 'haz_road', 'haz_salt'].includes(t)) drawHazard(wrap, col, row);
      if (t === 'oil' || t === 'off_oil') drawOil(wrap, col, row);
      if (t === 'ramp')       drawRamp(wrap, col, row);
      if (t === 'multi_ramp') drawMultiRamp(wrap, col, row);
      if (t === 'rock')       drawImpassable(wrap, col, row);
      if (t === 'fire')       drawFire(wrap, col, row);
      if (t === 'off_mine')   drawMinefield(wrap, col, row);
      if (wrap.childNodes.length) g.appendChild(wrap);
    }
}

// Measures the real width of a text with the given font/weight, via a hidden
// canvas — needed to precisely align the "Name of the road" relative to
// "THE" (the exact letter metrics are only known once the font is
// really loaded in the browser, impossible to guess in advance).
function measureTextWidth(txt, sizePx, fontFamily = 'AlfaSlabOne', weight = 400) {
  const canvas = measureTextWidth._canvas || (measureTextWidth._canvas = document.createElement('canvas'));
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return sizePx * txt.length * 0.6; // rough fallback, should not happen in a real browser
  ctx.font = `${weight} ${sizePx}px '${fontFamily}', serif`;
  return ctx.measureText(txt).width;
}

// ---- 8. Title text — above the board content ----
function renderTitleText(svg, defs) {
  const tb = BANDS[0], tbH = tb.bot - tb.top;
  const titleVal = document.getElementById('title-input').value.toUpperCase() || 'NAME OF YOUR ROAD';
  // Sizes recalibrated from direct measurements by Mayrik (Photoshop ruler,
  // capital height on a real board overlaid on our export): for
  // each text, new coefficient = old coefficient × (real board measurement
  // / export measurement at the time). The 3 texts no longer have the same proportion
  // between them (mainSize is no longer derived from tbH by the same formula as
  // theSize=mainSize×0.42 — that relation did not hold on the real board).
  const mainSize = Math.round(tbH * 0.5726), capH = mainSize * 0.72;
  const textLeft = tb.left + Math.round(tbH * 0.08) + 331;

  // "THE" never moves: its position (theX, theY) is computed first and
  // totally independently of the rest — nothing else must influence its value.
  const theSize = Math.round(tbH * 0.2425), theX = textLeft - 236 - 4;
  const theCapH = theSize * 0.72;
  const theY = Math.round(tb.top + tbH / 2 + theCapH / 2) + 9 - 10; // block of the 3 texts raised by 10px

  // Vertical center of the "Name of the road" set on the vertical center of "THE"
  // (each measured as baseline − half capital height), so the title is
  // derived from it rather than the reverse.
  const theCenterY = theY - theCapH / 2;
  const titleY = Math.round(theCenterY + capH / 2);

  const chapSize = Math.round(tbH * 0.1747 - 4 / 0.72), chapY = Math.round(titleY - capH - tbH * 0.04);
  // Horizontal squeeze requested by Mayrik: 0.85 on the 3 title texts
  // (road name, FAN-MADE CHAPTER, THE), pivoted at the same point as the skewX.
  const TITLE_X_SCALE = 0.85;
  // "THE" must lose 3px of width WITHOUT changing height: since scaleX
  // only affects the horizontal axis (unlike changing the font size),
  // we give it a slightly tighter xScale than the other 2 texts, computed
  // so that its rendered width decreases by exactly 3px compared to TITLE_X_SCALE.
  const theNaturalWidth = measureTextWidth('THE', theSize, 'OswaldBold', 700);
  const THE_X_SCALE = OSWALD_READY
    ? (TITLE_X_SCALE * theNaturalWidth - 3) / theNaturalWidth
    : TITLE_X_SCALE;
  // Constant black outline (graphic hairline, measured identical on the 3 texts
  // of the real board — does not grow with the font size). Doubled at
  // Mayrik's request (5 → 10px) after a visual comparison.
  const TITLE_STROKE_WIDTH = 10;
  // Shadow recalibrated per text: each text had the same shadow "speed"
  // (same 1.667px/step) whereas on the real board the road name's shadow
  // is clearly more stretched than that of FAN-MADE CHAPTER/THE — now a
  // shadow gap per step specific to each text rather than a global constant.
  // Number of copies optimized: the outline of each copy (10px) largely covers
  // the gap between two consecutive copies, so stacking as many
  // copies as pixels of reach is pointless — we keep the same total reach
  // (number of copies × gap), but with a larger gap and therefore far fewer
  // copies (~4x fewer, computed so that the outline keeps filling the
  // gaps without leaving a hole, checked visually).
  const CHAP_SHADOW_STEPS = 4, CHAP_SHADOW_STEP = 10.6 / CHAP_SHADOW_STEPS;
  const THE_SHADOW_STEPS = 5, THE_SHADOW_STEP = 17.4 / THE_SHADOW_STEPS;
  const ROAD_SHADOW_STEPS = 12, ROAD_SHADOW_STEP = 51.2 / ROAD_SHADOW_STEPS;

  // FAN-MADE CHAPTER shifted 107px to the left from its previous position
  // (textLeft + 35), then shifted 10px to the right again.
  const cg = makeTitleText(textLeft + 35 - 107 + 10, chapY, chapSize, 'FAN-MADE CHAPTER', '#BBB3A2', 'chapter', CHAP_SHADOW_STEPS,
    {fontFamily: 'OswaldBold', weight: 700, xScale: TITLE_X_SCALE,
     shadowStepDist: CHAP_SHADOW_STEP, strokeWidth: TITLE_STROKE_WIDTH});
  svg.appendChild(cg);

  // "THE" lowered by 3px relative to the board's title line (theY remains the
  // reference used for setting the other 2 texts above/below;
  // only the actual rendering point of this text is shifted, so as not to move
  // FAN-MADE CHAPTER or the road name as a knock-on effect).
  const theYRender = theY + 3;
  const tg = makeTitleText(theX, theYRender, theSize, 'THE', '#BBB3A2', 'the', THE_SHADOW_STEPS,
    {fontFamily: 'OswaldBold', weight: 700, xScale: THE_X_SCALE,
     shadowStepDist: THE_SHADOW_STEP, strokeWidth: TITLE_STROKE_WIDTH});
  svg.appendChild(tg);

  // The left edge of the "Name of the road" is set exactly on the right edge of
  // "THE" (with its own squeeze THE_X_SCALE, not TITLE_X_SCALE, otherwise the
  // alignment would be wrong) — as long as the font is not yet loaded, we fall back
  // on the old approximate position, corrected as soon as the font becomes
  // available
  // (buildBoard() is called again at that point).
  const roadNameX = OSWALD_READY
    ? Math.round(theX + THE_X_SCALE * theNaturalWidth)
    : textLeft;
  // Lowered by 19px relative to the rest, then raised by 8px relative to the
  // board's title line at Mayrik's request (only this text,
  // chapY/theY unchanged).
  const roadNameY = titleY + 19 - 8;

  const mg = makeTitleText(roadNameX, roadNameY, mainSize, titleVal, '#F8F0D0', 'title', ROAD_SHADOW_STEPS,
    {fontFamily: 'AlfaSlabOne', weight: 400, xScale: TITLE_X_SCALE,
     shadowStepDist: ROAD_SHADOW_STEP, strokeWidth: TITLE_STROKE_WIDTH});
  svg.appendChild(mg);
}

// ---- 8bis. Ignition title — 3-digit number displayed on the crest ----
// Provisional position/size (centered in the band), until we see the
// rendering with the real crest to adjust precisely — same logic as for
// any new asset whose exact proportions are not yet known.
// Number centered on the crest (not on the whole band) — reuses exactly
// the same crest geometry as renderTitleBand to stay in sync.
// The Ignition number deliberately has a different rendering from the Vendetta title:
// Cooper Hewitt Bold font (not Bevan), no italics, no stacked 3D relief
// — just a dark fill + a slight outline of the same color to
// thicken the stroke (approximates Photoshop's "Forte"/Strong rendering, which has
// no direct SVG equivalent).
function renderTitleTextIgnition(svg, defs) {
  const tb = BANDS[0], tbMid = (tb.top + tb.bot) / 2, tbH = tb.bot - tb.top;
  const { blasonFullSize, blasonCx } = ignitionBlasonGeometry(tb, tbH);
  const numVal = (document.getElementById('board-number-input').value || '').padStart(3, '0');
  const numSize = Math.round(blasonFullSize * 0.3);
  // 1mm at 300dpi = 1/25.4*300 ≈ 11.8px — raised by 1mm compared to the previous
  // 2mm, at Mayrik's request. Only the Y axis changes here: x stays
  // blasonCx with text-anchor:middle unchanged, so the left/right centering
  // (in the rotated frame, shared with the crest) is not affected.
  const numY = Math.round(tbMid + numSize * 0.36 + (1 / 25.4) * 300);

  svg.appendChild(mkEl('text', {
    id: 'boardnum-display', x: blasonCx, y: numY,
    'font-family': "'CooperHewittBold', Arial, sans-serif", 'font-weight': '700',
    'font-size': numSize, fill: '#000000', stroke: '#1a1414', 'stroke-width': Math.max(1, Math.round(numSize * 0.02)),
    'text-anchor': 'middle',
    // Same pivot and same angle as the crest (renderTitleBand) so that the
    // number rotates with it and stays visually "inside".
    transform: `rotate(-10, ${blasonCx}, ${tbMid})`
  })).textContent = numVal;
}

// ---- 9 bis. Print check scale (19/11, Mayrik's idea) ----
// Printed at 100%, this rectangle measures exactly 3 cm (left edge, one tick per cm) and 1 in
// (right edge, one tick per half-inch): the scale is checked with a ruler, no game tile needed.
// Double scale as on maps (km / miles): everyone measures in their own unit. Placed in
// the white space to the left of the 6th row (stagger offset: 16.5 mm × 38 mm), INSIDE the
// printed area whatever the paper (not in the margins, which printers do not print,
// especially on US paper). A "fit to page" mode chosen by mistake (≈ 97%) gives ~1 mm of error there, visible.
const PX_PER_MM = 300 / 25.4;
function renderScaleBar(g) {
  const lastRow = BANDS[ROWS], prevRow = BANDS[ROWS - 1];
  const freeLeft = Math.min(lastRow.left, prevRow.left), freeRight = Math.max(lastRow.left, prevRow.left);
  const w = 10 * PX_PER_MM, cm = 10 * PX_PER_MM, inch = 300; // 1 in = exactly 300 px at 300 dpi
  const h = 3 * cm, tick = 3 * PX_PER_MM, stroke = 3;
  const x = (freeLeft + freeRight) / 2 - w / 2;
  const y = lastRow.top + (lastRow.bot - lastRow.top - h) / 2 + 12;
  const ink = '#1d1426';
  g.appendChild(mkEl('rect', {x, y, width: w, height: h, fill: '#ffffff', stroke: ink, 'stroke-width': stroke}));
  for (let k = 1; k < 3; k++)
    g.appendChild(mkEl('line', {x1: x, y1: y + k * cm, x2: x + tick, y2: y + k * cm, stroke: ink, 'stroke-width': stroke}));
  [[inch / 2, tick * 0.6], [inch, tick]].forEach(([dy, len]) =>
    g.appendChild(mkEl('line', {x1: x + w - len, y1: y + dy, x2: x + w, y2: y + dy, stroke: ink, 'stroke-width': stroke})));
  // end mark of the inch extended across the full width, to distinguish it from the bottom of the 3 cm
  g.appendChild(mkEl('line', {x1: x + w * 0.5, y1: y + inch, x2: x + w, y2: y + inch, stroke: ink, 'stroke-width': stroke}));
  const label = (txt, lx, anchor) => {
    const t = mkEl('text', {x: lx, y: y - 10, 'font-family': "'OswaldBold', Arial, sans-serif", 'font-weight': 700,
      'font-size': 34, fill: ink, 'text-anchor': anchor});
    t.textContent = txt; g.appendChild(t);
  };
  label('3 cm', x - 6, 'start');
  label('1 in', x + w + 6, 'end');
}

// ---- 9. White chevron masks — clip cell tips into margins ----
function renderMasks(svg) {
  svg.appendChild(mkEl('rect', {x:0, y:0, width:VW, height:BANDS[0].top, fill:'#FFFFFF'}));
  svg.appendChild(mkEl('rect', {x:0, y:BANDS[6].bot, width:VW, height:VH-BANDS[6].bot, fill:'#FFFFFF'}));
  for (let i = 0; i < 7; i++) {
    svg.appendChild(mkEl('polygon', {points: leftMaskPoly(i), fill: '#FFFFFF'}));
    svg.appendChild(mkEl('polygon', {points: rightMaskPoly(i), fill: '#FFFFFF'}));
  }
}

// ---- 10. Clickable hit areas (transparent, on top) ----
function renderHits(svg) {
  for (let row = 0; row < ROWS; row++)
    for (let col = COLS - 1; col >= 0; col--) {
      const hit = mkEl('polygon', {points: pts2s(cellPoly(col, row)), fill: 'transparent', stroke: 'none'});
      hit.dataset.idx = row * COLS + col;
      hit.style.cursor = 'pointer';
      hit.addEventListener('mouseenter', function () { this.setAttribute('fill', 'rgba(255,255,255,0.22)'); });
      hit.addEventListener('mouseleave', function () { this.setAttribute('fill', 'transparent'); });
      // Painting: handled by the brush (js/brush.js, pointerdown on the whole board).
      svg.appendChild(hit);
    }
}

// ---- Road <-> Other texture overflow ----
// 7 pngs (folder "edges", fixed canvas 657x622, always centered on the Road cell):
// LeftEdge / RightEdge for intra-row boundaries (never split, the
// columns of a same row are aligned), + 5 variants for the boundaries
// between rows (TopEdgeFull / TopEdgeLeftLong / TopEdgeLeftShort / TopEdgeRightLong /
// TopEdgeRightShort), reused for the bottom via a simple vertical symmetry
// (translate+scale around cy) — no different position computation, just an
// identical centering each time.
//
// The 195px offset between staggered rows splits a cell's top/bottom boundary
// (width CELL_SLOT=493) into exactly two segments with no overlap
// or gap: 195px ("Short") + 298px ("Long"). The side that receives Short vs Long depends
// on the direction of the offset between the current row and the neighboring row (computed, not
// hard-coded). On the board's edge columns, only one of the two segments exists
// — always the "Long" one. "Full" is used only when both segments touch
// an Other texture, to avoid a visible seam between two abutting pngs.
const EDGE_PATHS = {
  LeftEdge: 'edges/LeftEdge.webp',
  RightEdge: 'edges/RightEdge.webp',
  TopEdgeFull: 'edges/TopEdgeFull.webp',
  TopEdgeLeftLong: 'edges/TopEdgeLeftLong.webp',
  TopEdgeLeftShort: 'edges/TopEdgeLeftShort.webp',
  TopEdgeRightLong: 'edges/TopEdgeRightLong.webp',
  TopEdgeRightShort: 'edges/TopEdgeRightShort.webp',
};
const EDGE_W = 657, EDGE_H = 622;
// Beyond this segment width (px), we consider the "Long" side rather than
// "Short" — the only two possible values are 195 and 298, so 250 is a
// comfortable margin between the two.
const EDGE_SEG_LONG_THRESHOLD = 250;

// The edge pngs have a slight framing offset (the opaque content is not
// perfectly centered in the 657x622 canvas, ~13-14px to the left) — this
// constant recenters all the overlays (Left/Right + Top/Bottom, flip included,
// the vertical flip does not affect the X axis). Adjust this single value if needed.
const EDGE_X_NUDGE = 10;

// The Edge pngs are definitively calibrated 1% too small compared to the
// yellow grid (observed after re-cropping the files, it is no longer a
// placeholder value to remove) — we enlarge them around their own center, the
// center's position does not change.
const EDGE_SCALE = 1.01;

function placeRoadEdge(g, edgeName, cx, cy, flipV = false) {
  const src = EDGE_PATHS[edgeName];
  const ew = EDGE_W * EDGE_SCALE, eh = EDGE_H * EDGE_SCALE;
  const attrs = {
    href: displayHref(src),
    x: cx - ew / 2 + EDGE_X_NUDGE, y: cy - eh / 2, width: ew, height: eh,
    'pointer-events': 'none'
  };
  // Vertical symmetry around the cell's center: a flipped TopEdge* gives
  // exactly the expected pattern at the bottom, without recomputing the position (the
  // stagger geometry is symmetric between the row above and the one below).
  if (flipV) attrs.transform = `translate(0, ${2 * cy}) scale(1, -1)`;
  g.appendChild(mkEl('image', attrs));
}

// Determines the cells of row "targetRow" whose flat boundary (width
// CELL_SLOT, without the chevron tips) overlaps that of (col,row) — and on which
// side (left/right) as well as the exact width of the overlap.
function crossRowSegments(col, row, targetRow) {
  if (targetRow < 0 || targetRow >= ROWS) return [];
  const curBand = BANDS[row + 1], tgtBand = BANDS[targetRow + 1];
  const x0cur = curBand.left + col * CELL_SLOT;
  const segs = [];
  for (let nc = 0; nc < COLS; nc++) {
    const x0nb = tgtBand.left + nc * CELL_SLOT;
    const overlap = Math.min(x0cur + CELL_SLOT, x0nb + CELL_SLOT) - Math.max(x0cur, x0nb);
    if (overlap > 1) segs.push({ nc, side: x0nb < x0cur ? 'left' : 'right', width: overlap });
  }
  segs.sort((a, b) => (a.side === 'left' ? 0 : 1) - (b.side === 'left' ? 0 : 1));
  return segs;
}

function placeCrossRowEdge(g, col, row, targetRow, cx, cy, flipV, isOther) {
  const segs = crossRowSegments(col, row, targetRow);
  if (segs.length === 0) return;

  const sideLabel = s => (s.side === 'left' ? 'Left' : 'Right') + (s.width > EDGE_SEG_LONG_THRESHOLD ? 'Long' : 'Short');

  if (segs.length === 1) {
    // Board edge: only one segment exists, always the "Long" one.
    const s = segs[0];
    if (isOther(targetRow * COLS + s.nc)) placeRoadEdge(g, 'TopEdge' + sideLabel(s), cx, cy, flipV);
    return;
  }

  const left = segs.find(s => s.side === 'left');
  const right = segs.find(s => s.side === 'right');
  const leftOther = left && isOther(targetRow * COLS + left.nc);
  const rightOther = right && isOther(targetRow * COLS + right.nc);

  if (leftOther && rightOther) placeRoadEdge(g, 'TopEdgeFull', cx, cy, flipV);
  else if (leftOther) placeRoadEdge(g, 'TopEdge' + sideLabel(left), cx, cy, flipV);
  else if (rightOther) placeRoadEdge(g, 'TopEdge' + sideLabel(right), cx, cy, flipV);
}

function renderAllRoadEdges(g) {
  // An Impassable cell counts neither as Road nor as "Other" for this system —
  // never any overflow on either side of an impassable cell.
  const isOther = idx => { const b = baseId(board[idx]); return b !== 'road' && b !== 'rock'; };

  for (let row = 0; row < ROWS; row++)
    for (let col = COLS - 1; col >= 0; col--) {
      if (baseId(board[row * COLS + col]) !== 'road') continue;
      const {cx, cy} = cellCenter(col, row);

      // Intended order within a same cell, for a stacking consistent with the
      // isometric view when several edges overlap: Top (Left/Right or
      // Full) -> Left -> Right -> Bottom (Left/Right or Full).
      placeCrossRowEdge(g, col, row, row - 1, cx, cy, false, isOther);

      if (col > 0 && isOther(row * COLS + col - 1)) placeRoadEdge(g, 'LeftEdge', cx, cy);
      if (col < COLS - 1 && isOther(row * COLS + col + 1)) placeRoadEdge(g, 'RightEdge', cx, cy);

      placeCrossRowEdge(g, col, row, row + 1, cx, cy, true, isOther);
    }
}


