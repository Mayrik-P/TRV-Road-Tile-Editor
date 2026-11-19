// ===== js/render-layers.js — Rendu des couches du plateau, de bas en haut : textures, transitions, bords de
// route, bordures, bande de titre, overlays, titre, masques, zones de clic, décorations.
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés dans l'ordre fixe des <script> de index.html (seule référence).
// Le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré dans
// ce fichier ou dans les précédents ; les fonctions, appelées plus tard, voient tout.

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
    // Aperçu à l'écran (displayHref) ; l'export le remplace par l'original.
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

// ---- 3+4. Remplissage plat (cases sans texture) + bordure (cases texturées) ----
// Les deux parcourent exactement les mêmes 48 cases dans le même ordre — une
// case tombe toujours dans l'un ou l'autre cas, jamais les deux — donc une seule
// passe suffit ; chacune va simplement dans sa propre couche (gFlatFill / gBorders).
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
// Décalage horizontal (depuis le bord gauche de la bande) où démarre le texte
// du titre sur un plateau Vendetta — réutilisé tel quel pour aligner le blason
// Ignition à la même distance du bord gauche (tbH est identique dans les deux
// cas, seul ROWS influe sur la hauteur de bande, jamais COLS).
function titleTextLeftOffset(tbH) { return Math.round(tbH * 0.08) + 331; }

// Géométrie du blason Ignition, partagée entre renderTitleBand (l'image) et
// renderTitleTextIgnition (le numéro) pour qu'ils restent toujours synchronisés
// — un seul endroit à modifier si la taille/position du blason change.
// blasonFullSize sert de référence pour la taille du numéro (qui ne doit PAS
// rétrécir avec le blason, demande de Mayrik) ; blasonSize (réduit de 10%) est
// la taille réellement affichée de l'image. Décalé de 242px vers la gauche par
// rapport à sa position d'origine, à la demande de Mayrik.
function ignitionBlasonGeometry(tb, tbH) {
  const blasonFullSize = Math.round(tbH * 0.85);
  const blasonSize = Math.round(blasonFullSize * 0.9);
  const blasonLeft = tb.left + titleTextLeftOffset(tbH) - 242;
  const blasonCx = blasonLeft + blasonSize / 2;
  return { blasonFullSize, blasonSize, blasonLeft, blasonCx };
}

// Cadre où l'image de titre est posée (bande de titre et ses deux pointes), en pixels à 300 dpi.
// SEULE source de la taille conseillée de l'image (bulle de « Load title image », js/ui.js) : une
// image de cette taille exacte est posée sans être rognée ni agrandie. Corrigé le 19/11 : la bulle
// annonçait la largeur de toute la zone de jeu (GAME_W, ~195 px de plus), d'où une image rognée.
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
  // Image de fond décorative de la bande de titre — chargée par l'utilisateur
  // (Load title image), affichée dans les deux formats de plateau. Seule la
  // résolution conseillée (infobulle) diffère selon le format, voir
  // titleImageBox().
  // Image par défaut (aucune image de l'utilisateur) : son aperçu, affiché dès qu'il
  // est téléchargé ; une image de l'utilisateur est affichée telle quelle.
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
    // Blason Ignition : aligné à gauche à la même distance du bord que le texte
    // de titre Vendetta, centré verticalement dans la bande.
    const { blasonSize, blasonLeft, blasonCx } = ignitionBlasonGeometry(tb, tbH);
    {
      g.appendChild(mkEl('image', {
        href: displayHref(BLASON_PATH),
        x: blasonLeft, y: tbMid - blasonSize / 2,
        width: blasonSize, height: blasonSize,
        // Incliné 10° vers la gauche (sens anti-horaire), demandé par Mayrik —
        // même pivot (centre du blason) que le numéro dans renderTitleTextIgnition,
        // pour qu'ils tournent ensemble et restent alignés visuellement.
        transform: `rotate(-10, ${blasonCx}, ${tbMid})`
      }));
    }
  }
}

// ---- 6+7. Overlays (hazard/oil/ramp/multiramp/rock/fire), one <g data-cell> per cell ----
// Rang isométrique d'une case : croissant de la case la plus en haut à droite
// (dessinée en premier, donc en dessous) vers la plus en bas à gauche (dessinée
// en dernier, donc au-dessus). Sert à insérer un élément au bon endroit lors
// d'une mise à jour incrémentale (updateCell), sans devoir tout reconstruire —
// un simple appendChild placerait toujours l'élément modifié au-dessus de tout,
// ce qui casserait l'ordre dès qu'une case "derrière" elle existe déjà.
function overlayRank(idx) {
  const row = Math.floor(idx / COLS), col = idx % COLS;
  return row * COLS + (COLS - 1 - col);
}

function insertInIsometricOrder(g, el, idx) {
  const rank = overlayRank(idx);
  const next = [...g.children].find(child => {
    const cellAttr = child.dataset.cell;
    return cellAttr !== undefined && overlayRank(parseInt(cellAttr)) > rank;
  });
  if (next) g.insertBefore(el, next);
  else g.appendChild(el);
}

function renderAllOverlays(g) {
  // Ordre isométrique unique pour TOUS les types d'overlay (Hazard/Oil/Ramp/
  // MultiRamp/Impassable/Fire) : lignes de haut en bas, colonnes de droite à
  // gauche — la case la plus en bas à gauche est dessinée en dernier et
  // recouvre visuellement les cases derrière elle (haut/droite), comme une
  // vraie vue isométrique. Une seule boucle pour que l'ordre soit respecté
  // aussi ENTRE catégories différentes (pas seulement au sein d'une même
  // catégorie) : deux boucles séparées empêchaient par exemple une case Rock
  // de bien s'intercaler avec une case Hazard voisine selon leur position réelle.
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

// Mesure la largeur réelle d'un texte avec la police/graisse donnée, via un canvas
// caché — nécessaire pour aligner precisement le "Name of the road" par rapport à
// "THE" (les métriques exactes des lettres ne sont connues qu'une fois la police
// vraiment chargée dans le navigateur, impossible à deviner à l'avance).
function measureTextWidth(txt, sizePx, fontFamily = 'AlfaSlabOne', weight = 400) {
  const canvas = measureTextWidth._canvas || (measureTextWidth._canvas = document.createElement('canvas'));
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return sizePx * txt.length * 0.6; // repli grossier, ne devrait pas arriver dans un vrai navigateur
  ctx.font = `${weight} ${sizePx}px '${fontFamily}', serif`;
  return ctx.measureText(txt).width;
}

// ---- 8. Title text — above the board content ----
function renderTitleText(svg, defs) {
  const tb = BANDS[0], tbH = tb.bot - tb.top;
  const titleVal = document.getElementById('title-input').value.toUpperCase() || 'NAME OF YOUR ROAD';
  // Tailles recalibrées à partir de mesures directes de Mayrik (règle Photoshop,
  // hauteur de capitale sur un vrai plateau superposé à notre export) : pour
  // chaque texte, nouveau coefficient = ancien coefficient × (mesure plateau
  // réel / mesure export d'alors). Les 3 textes n'ont plus la même proportion
  // entre eux (mainSize n'est plus dérivé de tbH par la même formule que
  // theSize=mainSize×0.42 — cette relation ne tenait pas sur le vrai plateau).
  const mainSize = Math.round(tbH * 0.5726), capH = mainSize * 0.72;
  const textLeft = tb.left + Math.round(tbH * 0.08) + 331;

  // "THE" ne bouge jamais : sa position (theX, theY) est calculée en premier et de
  // façon totalement indépendante du reste — rien d'autre ne doit influencer sa valeur.
  const theSize = Math.round(tbH * 0.2425), theX = textLeft - 236 - 4;
  const theCapH = theSize * 0.72;
  const theY = Math.round(tb.top + tbH / 2 + theCapH / 2) + 9 - 10; // bloc des 3 écritures remonté de 10px

  // Centre vertical du "Name of the road" calé sur le centre vertical de "THE"
  // (chacun mesuré comme baseline − demi hauteur de capitale), d'où le titre en
  // découle plutôt que l'inverse.
  const theCenterY = theY - theCapH / 2;
  const titleY = Math.round(theCenterY + capH / 2);

  const chapSize = Math.round(tbH * 0.1747 - 4 / 0.72), chapY = Math.round(titleY - capH - tbH * 0.04);
  // Resserrement horizontal demandé par Mayrik : 0.85 sur les 3 textes du titre
  // (nom de route, FAN-MADE CHAPTER, THE), pivoté au même point que le skewX.
  const TITLE_X_SCALE = 0.85;
  // "THE" doit perdre 3px de largeur SANS changer de hauteur : comme scaleX
  // n'affecte que l'axe horizontal (contrairement à changer la taille de police),
  // on lui donne un xScale légèrement plus serré que les 2 autres textes, calculé
  // pour que sa largeur rendue diminue de pile 3px par rapport à TITLE_X_SCALE.
  const theNaturalWidth = measureTextWidth('THE', theSize, 'OswaldBold', 700);
  const THE_X_SCALE = OSWALD_READY
    ? (TITLE_X_SCALE * theNaturalWidth - 3) / theNaturalWidth
    : TITLE_X_SCALE;
  // Contour noir constant (liseré graphique, mesuré identique sur les 3 textes
  // du vrai plateau — ne grossit pas avec la taille de police). Doublé à la
  // demande de Mayrik (5 → 10px) après comparaison visuelle.
  const TITLE_STROKE_WIDTH = 10;
  // Ombrage recalibré par texte : chaque texte avait la même "vitesse" d'ombre
  // (mêmes 1.667px/étape) alors que sur le vrai plateau l'ombre du nom de route
  // est nettement plus étirée que celle de FAN-MADE CHAPTER/THE — désormais un
  // écart d'ombre par étape propre à chaque texte plutôt qu'une constante globale.
  // Nombre de copies optimisé : le contour de chaque copie (10px) recouvre très
  // largement l'écart entre deux copies consécutives, donc empiler autant de
  // copies que de pixels de portée est inutile — on garde la même portée totale
  // (nombre de copies × écart), mais avec un écart plus grand et donc bien moins
  // de copies (~4x moins, calculé pour que le contour continue à combler les
  // écarts sans laisser de trou, vérifié visuellement).
  const CHAP_SHADOW_STEPS = 4, CHAP_SHADOW_STEP = 10.6 / CHAP_SHADOW_STEPS;
  const THE_SHADOW_STEPS = 5, THE_SHADOW_STEP = 17.4 / THE_SHADOW_STEPS;
  const ROAD_SHADOW_STEPS = 12, ROAD_SHADOW_STEP = 51.2 / ROAD_SHADOW_STEPS;

  // FAN-MADE CHAPTER décalé de 107px vers la gauche par rapport à sa position
  // précédente (textLeft + 35), puis re-décalé de 10px vers la droite.
  const cg = makeTitleText(textLeft + 35 - 107 + 10, chapY, chapSize, 'FAN-MADE CHAPTER', '#BBB3A2', 'chapter', CHAP_SHADOW_STEPS,
    {fontFamily: 'OswaldBold', weight: 700, xScale: TITLE_X_SCALE,
     shadowStepDist: CHAP_SHADOW_STEP, strokeWidth: TITLE_STROKE_WIDTH});
  svg.appendChild(cg);

  // "THE" descendu de 3px par rapport à la ligne titre du plateau (theY reste la
  // référence utilisée par le calage des 2 autres écritures ci-dessus/dessous ;
  // seul le point de rendu réel de ce texte est décalé, pour ne pas faire bouger
  // FAN-MADE CHAPTER ni le nom de route par ricochet).
  const theYRender = theY + 3;
  const tg = makeTitleText(theX, theYRender, theSize, 'THE', '#BBB3A2', 'the', THE_SHADOW_STEPS,
    {fontFamily: 'OswaldBold', weight: 700, xScale: THE_X_SCALE,
     shadowStepDist: THE_SHADOW_STEP, strokeWidth: TITLE_STROKE_WIDTH});
  svg.appendChild(tg);

  // Le bord gauche du "Name of the road" est calé exactement sur le bord droit de
  // "THE" (avec son propre resserrement THE_X_SCALE, plus TITLE_X_SCALE, sinon le
  // calage serait faux) — tant que la police n'est pas encore chargée, on retombe
  // sur l'ancienne position approximative, corrigée dès que la police devient
  // disponible
  // (buildBoard() est rappelé à ce moment-là).
  const roadNameX = OSWALD_READY
    ? Math.round(theX + THE_X_SCALE * theNaturalWidth)
    : textLeft;
  // Descendu de 19px par rapport au reste, puis remonté de 8px par rapport à la
  // ligne titre du plateau à la demande de Mayrik (uniquement ce texte,
  // chapY/theY inchangés).
  const roadNameY = titleY + 19 - 8;

  const mg = makeTitleText(roadNameX, roadNameY, mainSize, titleVal, '#F8F0D0', 'title', ROAD_SHADOW_STEPS,
    {fontFamily: 'AlfaSlabOne', weight: 400, xScale: TITLE_X_SCALE,
     shadowStepDist: ROAD_SHADOW_STEP, strokeWidth: TITLE_STROKE_WIDTH});
  svg.appendChild(mg);
}

// ---- 8bis. Titre Ignition — numéro à 3 chiffres affiché sur le blason ----
// Position/taille provisoires (centré dans la bande), en attendant de voir le
// rendu avec le vrai blason pour ajuster précisément — même logique que pour
// tout nouvel asset dont on ne connaît pas encore les proportions exactes.
// Numéro centré sur le blason (pas sur la bande entière) — reprend exactement
// la même géométrie de blason que renderTitleBand pour rester synchronisé.
// Le numéro Ignition a délibérément un rendu différent du titre Vendetta :
// police Cooper Hewitt Bold (pas Bevan), pas d'italique, pas de relief 3D empilé
// — juste un remplissage foncé + un léger contour de la même couleur pour
// épaissir le tracé (approche le rendu "Forte"/Strong de Photoshop, qui n'a pas
// d'équivalent direct en SVG).
function renderTitleTextIgnition(svg, defs) {
  const tb = BANDS[0], tbMid = (tb.top + tb.bot) / 2, tbH = tb.bot - tb.top;
  const { blasonFullSize, blasonCx } = ignitionBlasonGeometry(tb, tbH);
  const numVal = (document.getElementById('board-number-input').value || '').padStart(3, '0');
  const numSize = Math.round(blasonFullSize * 0.3);
  // 1mm à 300dpi = 1/25.4*300 ≈ 11.8px — remonté de 1mm par rapport au 2mm
  // précédent, à la demande de Mayrik. Seul l'axe Y change ici : x reste
  // blasonCx avec text-anchor:middle inchangés, donc le centrage gauche/droite
  // (dans le repère tourné, partagé avec le blason) n'est pas affecté.
  const numY = Math.round(tbMid + numSize * 0.36 + (1 / 25.4) * 300);

  svg.appendChild(mkEl('text', {
    id: 'boardnum-display', x: blasonCx, y: numY,
    'font-family': "'CooperHewittBold', Arial, sans-serif", 'font-weight': '700',
    'font-size': numSize, fill: '#000000', stroke: '#1a1414', 'stroke-width': Math.max(1, Math.round(numSize * 0.02)),
    'text-anchor': 'middle',
    // Même pivot et même angle que le blason (renderTitleBand) pour que le
    // numéro tourne avec lui et reste visuellement "à l'intérieur".
    transform: `rotate(-10, ${blasonCx}, ${tbMid})`
  })).textContent = numVal;
}

// ---- 9 bis. Échelle de contrôle d'impression (19/11, idée de Mayrik) ----
// Imprimé à 100 %, ce rectangle mesure exactement 3 cm (bord gauche, un trait par cm) et 1 in
// (bord droit, un trait par demi-pouce) : on vérifie l'échelle à la règle, sans tuile du jeu.
// Échelle double comme sur les cartes (km / miles) : chacun mesure dans son unité. Placée dans
// le blanc à gauche de la 6e rangée (décalage du quinconce : 16,5 mm × 38 mm), DANS la zone
// imprimée quel que soit le papier (pas dans les marges, que les imprimantes n'impriment pas,
// surtout en papier US). Un mode « ajusté » par erreur (≈ 97 %) y donne ~1 mm d'écart, visible.
const PX_PER_MM = 300 / 25.4;
function renderScaleBar(g) {
  const lastRow = BANDS[ROWS], prevRow = BANDS[ROWS - 1];
  const freeLeft = Math.min(lastRow.left, prevRow.left), freeRight = Math.max(lastRow.left, prevRow.left);
  const w = 10 * PX_PER_MM, cm = 10 * PX_PER_MM, inch = 300; // 1 in = 300 px exactement à 300 dpi
  const h = 3 * cm, tick = 3 * PX_PER_MM, stroke = 3;
  const x = (freeLeft + freeRight) / 2 - w / 2;
  const y = lastRow.top + (lastRow.bot - lastRow.top - h) / 2 + 12;
  const ink = '#1d1426';
  g.appendChild(mkEl('rect', {x, y, width: w, height: h, fill: '#ffffff', stroke: ink, 'stroke-width': stroke}));
  for (let k = 1; k < 3; k++)
    g.appendChild(mkEl('line', {x1: x, y1: y + k * cm, x2: x + tick, y2: y + k * cm, stroke: ink, 'stroke-width': stroke}));
  [[inch / 2, tick * 0.6], [inch, tick]].forEach(([dy, len]) =>
    g.appendChild(mkEl('line', {x1: x + w - len, y1: y + dy, x2: x + w, y2: y + dy, stroke: ink, 'stroke-width': stroke})));
  // repère de fin du pouce prolongé sur toute la largeur, pour le distinguer du bas des 3 cm
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
      // Peinture : gérée par le pinceau (js/brush.js, pointerdown sur tout le plateau).
      svg.appendChild(hit);
    }
}

// ---- 11. Décorations de groupe — un seul petit élément par zone homogène de plus
// de 3 cases, posé à une intersection de cases, par-dessus tout le reste (y compris
// le quadrillage orange) pour casser la monotonie des grandes zones uniformes.
// Cherche toutes les paires de cases adjacentes, de même nature (dans le même
// groupe) et sans overlay des deux côtés — les seules frontières valables pour
// poser une décoration "entre deux cases".
function findEligiblePairsInGroup(grp) {
  const groupSet = new Set(grp.cells);
  const seen = new Set();
  const pairs = [];
  grp.cells.forEach(idx => {
    if (OVERLAY_TYPES.includes(board[idx])) return;
    const row = Math.floor(idx / COLS), col = idx % COLS;
    neighborsOf(col, row).forEach(([nc, nr]) => {
      const nidx = nr * COLS + nc;
      if (!groupSet.has(nidx) || OVERLAY_TYPES.includes(board[nidx])) return;
      const key = idx < nidx ? `${idx}-${nidx}` : `${nidx}-${idx}`;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push([[col, row], [nc, nr]]);
    });
  });
  return pairs;
}

// Point d'ancrage sur la frontière entre deux cases : sur la ligne d'interligne
// pour deux cases de lignes différentes, ou juste au-dessus de la pointe du
// chevron (jamais dessus) pour deux cases de la même ligne.
function pairDecorAnchor(colA, rowA, colB, rowB) {
  const pts = boundaryLine(colA, rowA, colB, rowB);
  if (rowA === rowB) {
    // pts = [coin haut, pointe, coin bas] — on prend un point sur le segment
    // supérieur, proche de la pointe mais nettement au-dessus.
    const [top, tip] = pts;
    const t = 0.7;
    return {x: top[0] + (tip[0] - top[0]) * t, y: top[1] + (tip[1] - top[1]) * t};
  }
  // pts = [gauche, droite] sur la ligne d'interligne — le milieu convient très bien.
  return {x: (pts[0][0] + pts[1][0]) / 2, y: (pts[0][1] + pts[1][1]) / 2};
}

// ---- Débordement Route <-> Autre texture ----
// 7 png (dossier "edges", canevas fixe 657x622, toujours centrés sur la case Route) :
// LeftEdge / RightEdge pour les frontières intra-ligne (jamais de scission, les
// colonnes d'une même ligne sont alignées), + 5 variantes pour les frontières
// inter-lignes (TopEdgeFull / TopEdgeLeftLong / TopEdgeLeftShort / TopEdgeRightLong /
// TopEdgeRightShort), réutilisées pour le bas via une simple symétrie verticale
// (translate+scale autour de cy) — aucun calcul de position différent, juste un
// centrage identique à chaque fois.
//
// Le décalage de 195px entre lignes en quinconce scinde la frontière haute/basse
// d'une case (largeur CELL_SLOT=493) en exactement deux segments sans chevauchement
// ni trou : 195px ("Short") + 298px ("Long"). Le côté qui reçoit Short vs Long dépend
// du sens du décalage entre la ligne courante et la ligne voisine (calculé, pas
// codé en dur). Sur les colonnes de bord de plateau, un seul des deux segments existe
// — toujours le "Long". "Full" s'utilise uniquement quand les deux segments touchent
// une texture Autre, pour éviter une couture visible entre deux png accolés.
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
// Au-delà de cette largeur de segment (px), on considère le côté "Long" plutôt que
// "Short" — les deux seules valeurs possibles sont 195 et 298, 250 est donc une
// marge confortable entre les deux.
const EDGE_SEG_LONG_THRESHOLD = 250;

// Les png edges ont un léger décalage de cadrage (le contenu opaque n'est pas
// parfaitement centré dans le canevas 657x622, ~13-14px vers la gauche) — cette
// constante recentre tous les overlays (Left/Right + Top/Bottom, flip compris,
// le flip vertical n'affecte pas l'axe X). Ajuster cette seule valeur si besoin.
const EDGE_X_NUDGE = 10;

// Les png Edge sont définitivement calibrés 1% trop petits par rapport à la
// grille jaune (constaté après recoupage des fichiers, ce n'est plus une valeur
// d'attente à retirer) — on les agrandit autour de leur propre centre, la
// position du centre ne change pas.
const EDGE_SCALE = 1.01;

function placeRoadEdge(g, edgeName, cx, cy, flipV = false) {
  const src = EDGE_PATHS[edgeName];
  const ew = EDGE_W * EDGE_SCALE, eh = EDGE_H * EDGE_SCALE;
  const attrs = {
    href: displayHref(src),
    x: cx - ew / 2 + EDGE_X_NUDGE, y: cy - eh / 2, width: ew, height: eh,
    'pointer-events': 'none'
  };
  // Symétrie verticale autour du centre de la case : un TopEdge* flippé donne
  // exactement le motif attendu en bas, sans recalcul de position (la géométrie
  // du quinconce est symétrique entre la ligne au-dessus et celle en-dessous).
  if (flipV) attrs.transform = `translate(0, ${2 * cy}) scale(1, -1)`;
  g.appendChild(mkEl('image', attrs));
}

// Détermine les cases de la ligne "targetRow" dont la frontière plate (largeur
// CELL_SLOT, sans les pointes de chevron) chevauche celle de (col,row) — et de
// quel côté (gauche/droite) ainsi que la largeur exacte du chevauchement.
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
    // Bord de plateau : un seul segment existe, toujours le "Long".
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
  // Une case Impassable ne compte ni comme Route ni comme "Autre" pour ce système —
  // jamais de débordement de part et d'autre d'une case impassable.
  const isOther = idx => { const b = baseId(board[idx]); return b !== 'road' && b !== 'rock'; };

  for (let row = 0; row < ROWS; row++)
    for (let col = COLS - 1; col >= 0; col--) {
      if (baseId(board[row * COLS + col]) !== 'road') continue;
      const {cx, cy} = cellCenter(col, row);

      // Ordre voulu au sein d'une même case, pour un empilement cohérent avec la
      // vue isométrique quand plusieurs edges se chevauchent : Top (Left/Right ou
      // Full) -> Left -> Right -> Bottom (Left/Right ou Full).
      placeCrossRowEdge(g, col, row, row - 1, cx, cy, false, isOther);

      if (col > 0 && isOther(row * COLS + col - 1)) placeRoadEdge(g, 'LeftEdge', cx, cy);
      if (col < COLS - 1 && isOther(row * COLS + col + 1)) placeRoadEdge(g, 'RightEdge', cx, cy);

      placeCrossRowEdge(g, col, row, row + 1, cx, cy, true, isOther);
    }
}

function renderAllDecorations(g) {
  const groups = findSameTypeGroups();
  groups.forEach(grp => {
    if (grp.cells.length <= 3) return;
    const pairs = findEligiblePairsInGroup(grp);
    if (!pairs.length) return;
    // Préférence pour l'interligne quand le groupe s'étend sur plusieurs lignes.
    const crossRowPairs = pairs.filter(([[, rowA], [, rowB]]) => rowA !== rowB);
    const pool = crossRowPairs.length ? crossRowPairs : pairs;
    // Choix déterministe (mais varié d'un groupe à l'autre) parmi les paires possibles.
    const seed = seededRandom(grp.cells[0] * 97 + grp.cells.length * 13);
    const [[colA, rowA], [colB, rowB]] = pool[Math.floor(seed * pool.length)];
    const {x, y} = pairDecorAnchor(colA, rowA, colB, rowB);
    // Les png Items- sont dessinés sur un canevas fixe de 378x378 px, à la même
    // échelle 300ppp que le reste du plateau (A3 @ 300dpi) — donc leur taille native
    // est déjà la bonne, pas besoin de la réduire par rapport à la case.
    const size = 378;
    // Choix aléatoire (mais reproductible) parmi les 12 png de décoration.
    const itemSeed = seededRandom(grp.cells[0] * 53 + grp.cells.length * 29 + 7);
    const itemSrc = ITEM_PATHS[Math.floor(itemSeed * ITEM_PATHS.length)];
    g.appendChild(mkEl('image', {
      href: displayHref(itemSrc),
      x: x - size / 2, y: y - size / 2, width: size, height: size,
      'pointer-events': 'none', 'data-decor-cell': rowA * COLS + colA
    }));
  });
}

