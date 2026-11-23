// ===== js/build-board.js — Drawing of the overlays (Hazard, Oil, Ramp, Fire, Impassable…), the title's
// extruded-shadow text, and buildBoard() which rebuilds the whole board SVG.
//
// Classic script (not a module): all js/ files share the same global scope
// and are loaded in the fixed order of the <script> tags in index.html (the only reference).
// Code run when a file loads can only use what is declared in
// that file or the previous ones; functions, called later, see everything.

function drawHazard(svg, col, rowIdx) {
  const {cx, cy} = cellCenter(col, rowIdx);
  const symW = Math.round(CELL_SLOT * 0.40 * 1.17);
  const symH = Math.round(symW * (264 / 233));
  placeOverlay(svg, [HAZARD_1, HAZARD_2, HAZARD_3][(col * 7 + rowIdx * 13) % 3], cx, cy, symW, symH, 17, 0);
}

// Minefield: a single visual (no variants for now, cf. Hazard/Oil which
// have several), simply centered on the cell over the Off-Road texture.
// Provisional size (square, 60% of the cell) while waiting for the real file — to
// be adjusted once sprites/Minefield.png is provided, to respect its real
// proportions (as for all the other overlays).
// Minefield: real file confirmed at 704×815px (same native size as the
// Impassable sprites) — same scale as them (0.95) rather than an
// arbitrary fraction of the cell, to respect the size wanted by Mayrik.
function drawMinefield(svg, col, rowIdx) {
  const {cx, cy} = cellCenter(col, rowIdx);
  const scale = 0.95;
  const symW = Math.round(704 * scale), symH = Math.round(815 * scale);
  placeOverlay(svg, MINEFIELD, cx, cy, symW, symH);
}

function drawOil(svg, col, rowIdx) {
  const {cx, cy} = cellCenter(col, rowIdx);
  const symW = Math.round(CELL_SLOT * 0.55 * 1.17);
  const symH = Math.round(symW * 0.9133);
  const idx = rowIdx * COLS + col;
  const variant = getOverlayVariant(idx, 'oil');
  const img = placeOverlay(svg, variant % 2 === 0 ? OIL_1 : OIL_2, cx + 17, cy, symW, symH);
  const rot = [0, 90, 180, 270][Math.floor(variant / 2)];
  if (rot !== 0) img.setAttribute('transform', `rotate(${rot}, ${Math.round(cx + 17)}, ${cy})`);
}

function drawRamp(svg, col, rowIdx) {
  const {cx, cy} = cellCenter(col, rowIdx);
  const symW = Math.round(CELL_SLOT * 1.1 * 1.17 * 1.25 * 0.8);
  placeOverlay(svg, RAMP, cx, cy, symW, Math.round(symW * 1.0229), 12, -12);
}

function drawMultiRamp(svg, col, rowIdx) {
  const {cx, cy} = cellCenter(col, rowIdx);
  const symW = Math.round(CELL_SLOT * 1.2 * 1.1);
  placeOverlay(svg, MULTI_RAMP, cx, cy, symW, Math.round(symW * 0.8865), 0, -24);
}

function drawFire(svg, col, rowIdx) {
  const {cx, cy} = cellCenter(col, rowIdx, 39);
  const idx = rowIdx * COLS + col;
  const variant = getOverlayVariant(idx, 'fire');
  const srcs = [FIRE_1, FIRE_2, FIRE_3, FIRE_4, FIRE_5, FIRE_6];
  const ws   = [646, 611, 688, 664, 661, 641];
  const hs   = [671, 678, 665, 680, 665, 718];
  placeOverlay(svg, srcs[variant], cx, cy, ws[variant], hs[variant], 0, -70);
}

function drawImpassable(svg, col, rowIdx) {
  const {cx, cy} = cellCenter(col, rowIdx, 13);
  const idx = rowIdx * COLS + col;
  const variant = getOverlayVariant(idx, 'rock');
  const srcs = [IMP_1, IMP_2, IMP_3, IMP_4, IMP_5, IMP_6, IMP_7, IMP_8];
  // All impassable sprites share the same base size (704×815), scaled uniformly
  const scale = 0.95;
  placeOverlay(svg, srcs[variant], cx, cy, Math.round(704 * scale) + 3, Math.round(815 * scale) + 3);
}

// Shadow offset reproducing the supplied Photoshop setting: Angle 130°, Distance 10px
// (Photoshop angle → x/y offset conversion: the checked box does not use the global
// lighting, so the shadow is computed only from this angle and distance).
const SHADOW_ANGLE_DEG = 130, SHADOW_DISTANCE = 10;
const SHADOW_DX = -Math.cos(SHADOW_ANGLE_DEG * Math.PI / 180) * SHADOW_DISTANCE;
const SHADOW_DY = Math.sin(SHADOW_ANGLE_DEG * Math.PI / 180) * SHADOW_DISTANCE;
// Fixed step between two copies (set from the original density of 24 copies per 10px):
// this way, increasing the number of copies really lengthens the extrusion instead of
// just spreading the same copies over the same total distance.
const SHADOW_STEP_DIST = (SHADOW_DISTANCE / 24) * 4; // shadow area x4, same angle 130°
const SHADOW_UNIT_X = SHADOW_DX / SHADOW_DISTANCE, SHADOW_UNIT_Y = SHADOW_DY / SHADOW_DISTANCE;
// Number of stacked copies — gives the extrusion depth (50 ≈ 20px long).
const SHADOW_STEPS = 50;

function makeTitleText(x, y, size, txt, fillColor, groupId, steps, opts = {}) {
  const {
    xScale = 1,
    fontFamily = 'AlfaSlabOne',
    weight = 400,
    skewDeg = TITLE_SKEW_DEG,
    shadowStepDist = SHADOW_STEP_DIST,
    strokeWidth = 0,
  } = opts;
  const fontFamilyCss = `'${fontFamily}', serif`;
  // Common pivot (x,y) for the horizontal squeeze (scale) AND the simulated
  // slant (skewX): the text's baseline/anchor stays exactly at (x,y),
  // only its shape is distorted around this point — see roadNameX/theX measurements.
  const grp = mkEl('g', {transform: `translate(${x},${y}) scale(${xScale},1) skewX(${skewDeg}) translate(${-x},${-y})`});
  const shadowGroup = mkEl('g', {id: groupId + '-shadow-group'});
  // The black outline is now part of the silhouette the shadow is cast from:
  // each shadow copy reuses the same outline as the final text (instead of
  // stacking only the bare glyph), so that the shadow is computed from the
  // really visible shape (glyph + outline), not just the glyph alone.
  const shadowAttrsExtra = {};
  if (strokeWidth > 0) {
    shadowAttrsExtra['stroke'] = '#000000';
    shadowAttrsExtra['stroke-width'] = strokeWidth;
  }
  for (let i = 1; i <= steps; i++) {
    const d = shadowStepDist * i;
    const sh = mkEl('text', {
      x: x + SHADOW_UNIT_X * d, y: y + SHADOW_UNIT_Y * d, fill: '#000000',
      'font-size': size, 'font-family': fontFamilyCss, 'font-weight': weight,
      ...shadowAttrsExtra
    });
    sh.textContent = txt;
    shadowGroup.appendChild(sh);
  }
  grp.appendChild(shadowGroup);
  // Black outline matched to the real boards (measured by Mayrik in Photoshop,
  // applied BEFORE the shadow in the visual mindset, hence under the fill in the
  // paint order — paint-order:stroke ensures the stroke does not encroach on the
  // fill). Constant value in px (not proportional to each text size), like a
  // fixed graphic hairline rather than an effect that would grow with the
  // font.
  const fillAttrs = {
    x: x, y: y, fill: fillColor, 'font-size': size,
    'font-family': fontFamilyCss, 'font-weight': weight, id: groupId + '-display'
  };
  if (strokeWidth > 0) {
    fillAttrs['stroke'] = '#000000';
    fillAttrs['stroke-width'] = strokeWidth;
    fillAttrs['paint-order'] = 'stroke';
  }
  const fill = mkEl('text', fillAttrs);
  fill.textContent = txt;
  grp.appendChild(fill);
  return grp;
}

function buildBoard() {
  const svg = document.getElementById('bsvg');
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
  const defs = mkEl('defs', {});
  svg.appendChild(defs);
  // Cache of the texture images shared by the transitions (a single <image> per
  // terrain, reused via <use> — avoids duplicating the base64 data for each pair).
  transTexCache = {};

  // Title font embedded directly in the SVG (as base64, like the textures) —
  // stays valid even once the SVG is exported/serialized on its own, unlike an
  // external <link> which would not be carried into the exported image. Alfa Slab One and
  // Oswald are used for the Vendetta title (+ app chrome, via global CSS once
  // registered); Cooper Hewitt Bold is used only for the Ignition number (rendered
  // deliberately differently, not the same style as the Vendetta title).
  if (FONT_B64_COOPERHEWITT || FONT_B64_ALFASLABONE || FONT_B64_OSWALD) {
    const style = mkEl('style', {});
    let css = '';
    if (FONT_B64_COOPERHEWITT) css += `@font-face{font-family:'CooperHewittBold';src:url(${FONT_B64_COOPERHEWITT}) format('woff2');font-style:normal;font-weight:700;}`;
    if (FONT_B64_ALFASLABONE) css += `@font-face{font-family:'AlfaSlabOne';src:url(${FONT_B64_ALFASLABONE}) format('woff2');font-style:normal;font-weight:400;}`;
    if (FONT_B64_OSWALD) css += `@font-face{font-family:'OswaldBold';src:url(${FONT_B64_OSWALD}) format('woff2');font-style:normal;font-weight:200 700;}`;
    style.textContent = css;
    defs.appendChild(style);
  }

  // 1. White page background
  svg.appendChild(mkEl('rect', {x:0, y:0, width:VW, height:VH, fill:'#FFFFFF'}));

  // Persistent layers, in display order — makes it possible to update
  // just one specific cell (see updateCell) without rebuilding everything at each click.
  const gTitleBand   = mkEl('g', {id: 'layer-titleband'});   svg.appendChild(gTitleBand);
  const gTextures    = mkEl('g', {id: 'layer-textures'});    svg.appendChild(gTextures);
  const gTransitions = mkEl('g', {id: 'layer-transitions'}); svg.appendChild(gTransitions);
  const gRoadEdges   = mkEl('g', {id: 'layer-roadedges'});   svg.appendChild(gRoadEdges);
  const gFlatFill    = mkEl('g', {id: 'layer-flatfill'});    svg.appendChild(gFlatFill);
  const gBorders     = mkEl('g', {id: 'layer-borders'});     svg.appendChild(gBorders);
  const gOverlays    = mkEl('g', {id: 'layer-overlays'});    svg.appendChild(gOverlays);
  const gTitleText   = mkEl('g', {id: 'layer-titletext'});   svg.appendChild(gTitleText);
  // Free decorations (js/decor.js): UNDER the white masks, which hide what overflows onto the
  // margins; the title band stays uncovered (Mayrik's choice, 22/11).
  const gDecor       = mkEl('g', {id: 'layer-decor'});       svg.appendChild(gDecor);
  const gMasks       = mkEl('g', {id: 'layer-masks'});       svg.appendChild(gMasks);
  // Print check scale (cm / in), above the white edge masks.
  const gScale       = mkEl('g', {id: 'layer-scale'});       svg.appendChild(gScale);
  const gHits        = mkEl('g', {id: 'layer-hits'});        svg.appendChild(gHits);
  // Decoration selection (circle, ✕ button): above everything, removed from the exported copy.
  const gDecorUI     = mkEl('g', {id: 'layer-decor-ui'});    svg.appendChild(gDecorUI);
  // Keyboard cursor (js/keyboard.js): at the very top, removed from the exported copy.
  const gCursor      = mkEl('g', {id: 'layer-cursor'});      svg.appendChild(gCursor);

  renderAllTextures(gTextures, defs);
  renderAllTransitions(gTransitions, defs);
  renderAllRoadEdges(gRoadEdges);
  renderFlatFillAndBorders(gFlatFill, gBorders);
  renderTitleBand(gTitleBand);
  renderAllOverlays(gOverlays);
  if (BOARD_TYPE === 'ignition') renderTitleTextIgnition(gTitleText, defs);
  else renderTitleText(gTitleText, defs);
  renderMasks(gMasks);
  renderScaleBar(gScale);
  renderHits(gHits);
  renderAllDecorations(gDecor);
  renderDecorUI(gDecorUI);
  renderCursor();
}

