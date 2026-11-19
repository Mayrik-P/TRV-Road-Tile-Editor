// ===== js/build-board.js — Dessin des overlays (Hazard, Oil, Ramp, Fire, Impassable…), texte à ombre
// extrudée du titre, et buildBoard() qui reconstruit tout le SVG du plateau.
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés par index.html dans un ordre fixe — config, geometry,
// build-board, render-layers, editing, export, assets, ui. Ne pas changer cet ordre :
// le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré
// dans ce fichier ou dans les précédents.

function drawHazard(svg, col, rowIdx) {
  const {cx, cy} = cellCenter(col, rowIdx);
  const symW = Math.round(CELL_SLOT * 0.40 * 1.17);
  const symH = Math.round(symW * (264 / 233));
  placeOverlay(svg, [HAZARD_1, HAZARD_2, HAZARD_3][(col * 7 + rowIdx * 13) % 3], cx, cy, symW, symH, 17, 0);
}

// Minefield : un seul visuel (pas de variantes pour l'instant, cf. Hazard/Oil qui
// en ont plusieurs), simplement centré sur la case par-dessus la texture Off-Road.
// Taille provisoire (carré, 60% de la case) en attendant le fichier réel — à
// ajuster une fois sprites/Minefield.png fourni, pour respecter ses vraies
// proportions (comme pour tous les autres overlays).
// Minefield : fichier réel confirmé à 704×815px (même taille native que les
// sprites Impassable) — même échelle qu'eux (0.95) plutôt qu'une fraction
// arbitraire de la case, pour respecter la taille voulue par Mayrik.
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

// Décalage d'ombre reproduisant le réglage Photoshop fourni : Angle 130°, Distance 10px
// (conversion angle Photoshop → décalage x/y : la case cochée n'utilise pas l'éclairage
// global, donc l'ombre est calculée uniquement à partir de cet angle et cette distance).
const SHADOW_ANGLE_DEG = 130, SHADOW_DISTANCE = 10;
const SHADOW_DX = -Math.cos(SHADOW_ANGLE_DEG * Math.PI / 180) * SHADOW_DISTANCE;
const SHADOW_DY = Math.sin(SHADOW_ANGLE_DEG * Math.PI / 180) * SHADOW_DISTANCE;
// Pas fixe entre deux copies (calé sur la densité d'origine à 24 copies pour 10px) :
// ainsi, augmenter le nombre de copies allonge réellement l'extrusion au lieu de
// se contenter de répartir les mêmes copies sur la même distance totale.
const SHADOW_STEP_DIST = (SHADOW_DISTANCE / 24) * 4; // surface d'ombre x4, même angle 130°
const SHADOW_UNIT_X = SHADOW_DX / SHADOW_DISTANCE, SHADOW_UNIT_Y = SHADOW_DY / SHADOW_DISTANCE;
// Nombre de copies empilées — donne la profondeur de l'extrusion (50 ≈ 20px de long).
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
  // Pivot commun (x,y) pour le resserrement horizontal (scale) ET l'inclinaison
  // simulée (skewX) : la baseline/ancrage du texte reste exactement en (x,y),
  // seule sa forme est déformée autour de ce point — voir mesures roadNameX/theX.
  const grp = mkEl('g', {transform: `translate(${x},${y}) scale(${xScale},1) skewX(${skewDeg}) translate(${-x},${-y})`});
  const shadowGroup = mkEl('g', {id: groupId + '-shadow-group'});
  // Le contour noir fait désormais partie de la silhouette dont on tire l'ombre :
  // chaque copie d'ombrage reprend le même contour que le texte final (au lieu de
  // n'empiler que le glyphe nu), pour que l'ombre soit calculée à partir de la
  // forme réellement visible (glyphe + contour), pas juste du glyphe seul.
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
  // Contour noir calé sur les vrais plateaux (mesuré par Mayrik au Photoshop,
  // appliqué AVANT l'ombrage dans l'esprit visuel, donc sous le fill dans l'ordre
  // de peinture — paint-order:stroke garantit que le trait n'empiète pas sur le
  // remplissage). Valeur constante en px (pas proportionnelle à chaque taille de
  // texte), comme un liseré graphique fixe plutôt qu'un effet qui grossirait avec
  // la police.
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
  // Cache des images de texture partagées par les transitions (une seule <image> par
  // terrain, réutilisée via <use> — évite de dupliquer les données base64 à chaque paire).
  transTexCache = {};

  // Police du titre intégrée directement dans le SVG (en base64, comme les textures) —
  // reste valide même une fois le SVG exporté/sérialisé isolément, contrairement à un
  // <link> externe qui ne serait pas repris dans l'image exportée. Alfa Slab One et
  // Oswald servent au titre Vendetta (+ chrome de l'appli, via CSS globale une fois
  // enregistrées) ; Cooper Hewitt Bold sert uniquement au numéro Ignition (rendu
  // volontairement différent, pas le même style que le titre Vendetta).
  if (FONT_B64_COOPERHEWITT || FONT_B64_ALFASLABONE || FONT_B64_OSWALD) {
    const style = mkEl('style', {});
    let css = '';
    if (FONT_B64_COOPERHEWITT) css += `@font-face{font-family:'CooperHewittBold';src:url(${FONT_B64_COOPERHEWITT}) format('truetype');font-style:normal;font-weight:700;}`;
    if (FONT_B64_ALFASLABONE) css += `@font-face{font-family:'AlfaSlabOne';src:url(${FONT_B64_ALFASLABONE}) format('truetype');font-style:normal;font-weight:400;}`;
    if (FONT_B64_OSWALD) css += `@font-face{font-family:'OswaldBold';src:url(${FONT_B64_OSWALD}) format('truetype');font-style:normal;font-weight:200 700;}`;
    style.textContent = css;
    defs.appendChild(style);
  }

  // 1. White page background
  svg.appendChild(mkEl('rect', {x:0, y:0, width:VW, height:VH, fill:'#FFFFFF'}));

  // Couches persistantes, dans l'ordre d'affichage — permet de ne mettre à jour
  // qu'une case précise (voir updateCell) sans tout reconstruire à chaque clic.
  const gTitleBand   = mkEl('g', {id: 'layer-titleband'});   svg.appendChild(gTitleBand);
  const gTextures    = mkEl('g', {id: 'layer-textures'});    svg.appendChild(gTextures);
  const gTransitions = mkEl('g', {id: 'layer-transitions'}); svg.appendChild(gTransitions);
  const gRoadEdges   = mkEl('g', {id: 'layer-roadedges'});   svg.appendChild(gRoadEdges);
  const gFlatFill    = mkEl('g', {id: 'layer-flatfill'});    svg.appendChild(gFlatFill);
  const gBorders     = mkEl('g', {id: 'layer-borders'});     svg.appendChild(gBorders);
  const gOverlays    = mkEl('g', {id: 'layer-overlays'});    svg.appendChild(gOverlays);
  const gTitleText   = mkEl('g', {id: 'layer-titletext'});   svg.appendChild(gTitleText);
  const gMasks       = mkEl('g', {id: 'layer-masks'});       svg.appendChild(gMasks);
  const gHits        = mkEl('g', {id: 'layer-hits'});        svg.appendChild(gHits);
  const gDecor       = mkEl('g', {id: 'layer-decor'});       svg.appendChild(gDecor);

  renderAllTextures(gTextures, defs);
  renderAllTransitions(gTransitions, defs);
  renderAllRoadEdges(gRoadEdges);
  renderFlatFillAndBorders(gFlatFill, gBorders);
  renderTitleBand(gTitleBand);
  renderAllOverlays(gOverlays);
  if (BOARD_TYPE === 'ignition') renderTitleTextIgnition(gTitleText, defs);
  else renderTitleText(gTitleText, defs);
  renderMasks(gMasks);
  renderHits(gHits);
  renderAllDecorations(gDecor);
}

