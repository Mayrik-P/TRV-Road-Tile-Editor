// ===== js/geometry.js — Géométrie des cases (polygones, centres, voisins, frontières) et transitions
// organiques entre terrains, regroupement des zones de même type.
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés par index.html dans un ordre fixe — config, state, geometry,
// build-board, render-layers, editing, export, assets, ui. Ne pas changer cet ordre :
// le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré
// dans ce fichier ou dans les précédents.

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
// Uses base64 from IMAGES_B64 if available — ensures export works without CORS issues
function placeOverlay(svg, href, cx, cy, w, h, dx = 0, dy = 0) {
  const img = mkEl('image', {
    href: IMAGES_B64[href] || href,
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

// Trace exact de la frontière réelle entre deux cases :
// - même ligne : le "V" formé par la pointe du chevron (3 points)
// - inter-lignes : la ligne droite de bande partagée, sur toute la largeur de recouvrement
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

// Avance de la distance d (longueur d'arc) le long de la polyligne pts,
// renvoie la position et la normale perpendiculaire à cet endroit.
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

// Bruit lisse mais irrégulier : fréquences ET poids relatifs tirés au hasard par frontière
// (pas de rythme fixe qui se répète), plus une grosse bosse aléatoire ponctuelle pour casser
// la régularité — comme les gros renflements inégaux qu'on voit sur le plateau original.
function smoothNoise(t, seed) {
  const p1 = seededRandom(seed) * Math.PI * 2;
  const p2 = seededRandom(seed + 1) * Math.PI * 2;
  const f1 = 0.8 + seededRandom(seed + 2) * 0.8;   // 0.8..1.6
  const f2 = 1.6 + seededRandom(seed + 3) * 1.4;   // 1.6..3.0
  const w1 = 0.5 + seededRandom(seed + 4) * 0.4;   // 0.5..0.9
  const w2 = 1 - w1;
  let n = Math.sin(t * Math.PI * 2 * f1 + p1) * w1
        + Math.sin(t * Math.PI * 2 * f2 + p2) * w2;

  // Une grosse bosse isolée, à une position aléatoire le long de la frontière
  const bumpCenter = 0.2 + seededRandom(seed + 5) * 0.6; // évite les extrémités
  const bumpWidth = 0.12 + seededRandom(seed + 6) * 0.12;
  const bumpSign = seededRandom(seed + 7) < 0.5 ? -1 : 1;
  const bumpStrength = 0.4 + seededRandom(seed + 8) * 0.5;
  const d = (t - bumpCenter) / bumpWidth;
  n += bumpSign * bumpStrength * Math.exp(-d * d);

  // Grain fin par-dessus la grande vague : plus haute fréquence, amplitude bien plus petite —
  // rend le tracé moins "propre/vectoriel" sans casser la forme générale.
  const f3 = 6 + seededRandom(seed + 10) * 5;   // 6..11
  const p3 = seededRandom(seed + 11) * Math.PI * 2;
  const f4 = 12 + seededRandom(seed + 12) * 6;  // 12..18
  const p4 = seededRandom(seed + 13) * Math.PI * 2;
  n += Math.sin(t * Math.PI * 2 * f3 + p3) * 0.10
     + Math.sin(t * Math.PI * 2 * f4 + p4) * 0.06;

  return n;
}

// UNE seule courbe déchirée qui remplace la frontière droite d'origine.
// Utilisée à la fois pour A et pour B : là où elle penche vers A, B peint jusqu'à
// cette courbe (et vice versa) — comme c'est la même courbe des deux côtés, aucune
// couture n'est possible entre les deux textures.
function jaggedCurve(pts, amplitude, seed, samples = 50) {
  const L = polylineLength(pts);
  const curve = [];
  // Intensité globale variable par frontière : certaines calmes, d'autres marquées.
  const intensity = 0.4 + seededRandom(seed + 9) * 0.8; // 0.4..1.2
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const { x, y, nx, ny } = pointAlong(pts, t * L);
    // fenêtre sin(t·π) : force l'amplitude à 0 exactement aux deux extrémités,
    // pour que la courbe rejoigne parfaitement les vrais coins de la case (pas de trou).
    const off = amplitude * intensity * smoothNoise(t, seed) * Math.sin(t * Math.PI);
    curve.push([x + nx * off, y + ny * off]);
  }
  return curve;
}

// Construit directement le contour fermé complet (ligne droite aller + courbe lissée retour)
// en un seul passage, sans concaténation fragile de deux chemins distincts.
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

// Une seule <image> par terrain est créée (dans <defs>, jamais affichée directement),
// puis réutilisée via <use> pour chaque transition — évite de dupliquer les données
// base64 de la texture à chaque paire de cases (gain important en taille/performance).
function getSharedTextureImage(defs, base) {
  if (transTexCache[base]) return transTexCache[base];
  const id = `trans-tex-${base}`;
  const img = mkEl('image', {
    id, href: IMAGES_B64[TEXTURE_PATHS[base]] || TEXTURE_PATHS[base],
    x: GAME_X, y: GAME_Y, width: GAME_W, height: GAME_H, preserveAspectRatio: 'none'
  });
  defs.appendChild(img);
  transTexCache[base] = id;
  return id;
}

// Remet toujours une paire de cases dans le même ordre canonique, quel que soit
// celui qui a déclenché le calcul — garantit un tracé identique (même graine
// aléatoire) que la transition vienne d'une reconstruction complète ou d'une
// mise à jour incrémentale déclenchée par l'une ou l'autre des deux cases.
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

    // "Sliver" = zone entre la ligne d'origine et la courbe déchirée —
    // une seule et même forme utilisée pour les deux textures, juste clippée différemment.
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
    // Une transition ratée ne doit jamais casser le reste du plateau ni l'export.
    console.warn('Transition non affichée pour la paire', colA, rowA, colB, rowB, e);
  }
}

// Voisins directs d'une case (même ligne + inter-lignes), pour ne recalculer
// que les frontières concernées lors d'une modification incrémentale.
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

// Types de case qui portent déjà un overlay (hazard/oil/ramp/etc.) — jamais de
// décoration de groupe sur ces cases-là.
const OVERLAY_TYPES = ['haz_mud', 'haz_sand', 'haz_road', 'haz_salt', 'oil', 'off_oil', 'ramp', 'multi_ramp', 'rock', 'fire', 'off_mine'];

// Regroupe les cases connectées de même type (même logique de voisinage que les
// transitions), pour détecter les zones homogènes de plus de 3 cases.
function findSameTypeGroups() {
  const visited = new Array(COLS * ROWS).fill(false);
  const groups = [];
  for (let start = 0; start < COLS * ROWS; start++) {
    if (visited[start]) continue;
    // Les cases à overlay ne rejoignent jamais un groupe et coupent la connexion —
    // ça fragmente volontairement les zones autour d'elles, pour des décorations
    // plus rares.
    if (OVERLAY_TYPES.includes(board[start])) { visited[start] = true; continue; }
    const type = board[start];
    visited[start] = true;
    const group = [start];
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop();
      const row = Math.floor(cur / COLS), col = cur % COLS;
      neighborsOf(col, row).forEach(([nc, nr]) => {
        const nidx = nr * COLS + nc;
        if (!visited[nidx] && !OVERLAY_TYPES.includes(board[nidx]) && board[nidx] === type) {
          visited[nidx] = true;
          group.push(nidx);
          stack.push(nidx);
        }
      });
    }
    groups.push({type, cells: group});
  }
  return groups;
}

