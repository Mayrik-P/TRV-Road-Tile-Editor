// ===== js/editing.js — Modification du plateau : mise à jour incrémentale d'une case (updateCell),
// palette des types de cases, remise à zéro.
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés dans l'ordre fixe des <script> de index.html (seule référence).
// Le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré dans
// ce fichier ou dans les précédents ; les fonctions, appelées plus tard, voient tout.

// ---- Mise à jour incrémentale : ne retouche que la case modifiée et ses voisines ----
// directement concernées par une transition, au lieu de tout reconstruire (buildBoard()).
// C'est ce qui règle la lenteur qui grandissait avec le nombre de transitions sur le plateau.
// Vide entièrement une couche (par id) puis la reconstruit via la fonction de
// rendu fournie — factorise un motif utilisé pour les couches qu'il est plus
// simple de toujours recalculer en entier (décorations, edges route) plutôt
// que de patcher au cas par cas, vu leur coût négligeable (48 cases).
function rebuildLayer(layerId, renderFn) {
  const g = document.getElementById(layerId);
  while (g.firstChild) g.removeChild(g.firstChild);
  renderFn(g);
}

function updateCell(idx, newType) {
  const oldType = board[idx];
  const fam = overlayFamily(newType);
  // Un clic sur une case déjà du même type ne fait normalement rien — sauf pour les
  // types à variantes (Impassable/Oil/Fire), où c'est justement le geste qui permet
  // à l'utilisateur de faire défiler le visuel jusqu'au suivant.
  if (oldType === newType && !fam) return;
  const row = Math.floor(idx / COLS), col = idx % COLS;
  board[idx] = newType;
  if (fam) assignOverlayVariant(idx, newType);

  const svg = document.getElementById('bsvg');
  const defs = svg.querySelector('defs');
  const gTextures    = document.getElementById('layer-textures');
  const gTransitions = document.getElementById('layer-transitions');
  const gFlatFill    = document.getElementById('layer-flatfill');
  const gBorders     = document.getElementById('layer-borders');
  const gOverlays    = document.getElementById('layer-overlays');

  const oldBase = baseId(oldType), newBase = baseId(newType);

  // --- Appartenance aux calques de texture (clip union par type) ---
  if (oldBase !== newBase) {
    if (TEXTURES[oldBase]) {
      const oldClip = defs.querySelector(`#tex-clip-${oldBase}`);
      if (oldClip) {
        const poly = oldClip.querySelector(`[data-cell="${idx}"]`);
        if (poly) oldClip.removeChild(poly);
      }
    }
    if (TEXTURES[newBase]) {
      let newClip = defs.querySelector(`#tex-clip-${newBase}`);
      if (!newClip) {
        newClip = mkEl('clipPath', {id: 'tex-clip-' + newBase});
        defs.appendChild(newClip);
        gTextures.appendChild(mkEl('image', {
          id: 'tex-image-' + newBase,
          href: displayHref(TEXTURE_PATHS[newBase]),
          x: textureRect().x, y: textureRect().y, width: textureRect().w, height: textureRect().h,
          'clip-path': `url(#tex-clip-${newBase})`,
          preserveAspectRatio: 'none'
        }));
      }
      newClip.appendChild(mkEl('polygon', {points: pts2s(cellPoly(col, row)), 'data-cell': idx}));
    }
  }

  // --- Transitions : on retire celles qui touchaient cette case, puis on ne
  // recalcule que ses voisines directes (au lieu de tout le plateau) ---
  [...gTransitions.querySelectorAll('[data-pair]')].forEach(el => {
    const [ca, ra, cb, rb] = el.dataset.pair.split(',').map(Number);
    if ((ca === col && ra === row) || (cb === col && rb === row)) {
      const uid = el.dataset.uid;
      ['tcellA-' + uid, 'tcellB-' + uid, 'sliver-' + uid + '-a', 'sliver-' + uid + '-b'].forEach(id => {
        const d = defs.querySelector('#' + id);
        if (d) d.remove();
      });
      el.remove();
    }
  });
  pairsForCell(col, row).forEach(([A, B]) => drawTransition(gTransitions, defs, A, B));

  // --- Remplissage plat / bordure pour cette case uniquement ---
  [gFlatFill, gBorders].forEach(g => {
    const el = g.querySelector(`[data-cell="${idx}"]`);
    if (el) el.remove();
  });
  if (!TEXTURES[newBase]) {
    gFlatFill.appendChild(mkEl('polygon', {
      points: pts2s(cellPoly(col, row)), fill: tcolor(newType),
      stroke: '#C07820', 'stroke-width': '2.5', 'stroke-linejoin': 'round', 'data-cell': idx
    }));
  } else {
    gBorders.appendChild(mkEl('polygon', {
      points: pts2s(cellPoly(col, row)), fill: 'none',
      stroke: '#C07820', 'stroke-width': '2.5', 'stroke-linejoin': 'round', 'data-cell': idx
    }));
  }

  // --- Overlay (hazard/oil/ramp/multiramp/rock/fire) pour cette case uniquement ---
  const oldOverlay = gOverlays.querySelector(`[data-cell="${idx}"]`);
  if (oldOverlay) oldOverlay.remove();
  const wrap = mkEl('g', {'data-cell': idx});
  if (['haz_mud', 'haz_sand', 'haz_road', 'haz_salt'].includes(newType)) drawHazard(wrap, col, row);
  if (newType === 'oil' || newType === 'off_oil') drawOil(wrap, col, row);
  if (newType === 'ramp')       drawRamp(wrap, col, row);
  if (newType === 'multi_ramp') drawMultiRamp(wrap, col, row);
  if (newType === 'rock')       drawImpassable(wrap, col, row);
  if (newType === 'fire')       drawFire(wrap, col, row);
  if (newType === 'off_mine')   drawMinefield(wrap, col, row);
  if (wrap.childNodes.length) insertInIsometricOrder(gOverlays, wrap, idx);

  // --- Débordement Route <-> Autre : dépend des voisins directs, mais on
  // recalcule tout le plateau par simplicité (coût négligeable, 48 cases).
  rebuildLayer('layer-roadedges', renderAllRoadEdges);

  notifyBoardChange('cell', { idx, oldType, newType });
}

// Extra swatch styling per tile id
const SWATCH_STYLE = {
  haz_mud:    {border: '1px solid #a72b28'},
  haz_sand:   {border: '1px solid #a72b28'},
  haz_road:   {border: '1px solid #a72b28'},
  haz_salt:   {border: '1px solid #a72b28'},
  ramp:       {border: '1px solid #e4c070'},
  multi_ramp: {border: '1px solid #e4c070'},
  off_oil:    {dot: '#222a1f'},
  oil:        {dot: '#222a1f'},
  off_mine:   {border: '1px solid #888888'},
};

function buildPalette() {
  const pal = document.getElementById('palette');
  pal.innerHTML = '';
  TILES.forEach(t => {
    const btn = document.createElement('div');
    btn.className = 'tb' + (t.id === sel ? ' sel' : '');
    btn.id = 'tb-' + t.id;
    const sw = document.createElement('div');
    sw.className = 'sw';
    sw.style.background = t.color;
    sw.style.position = 'relative';
    sw.style.flexShrink = '0';
    const extra = SWATCH_STYLE[t.id] || {};
    if (extra.border) sw.style.border = extra.border;
    if (extra.dot) {
      const dot = document.createElement('div');
      dot.style.cssText = `position:absolute;width:2px;height:2px;background:${extra.dot};top:50%;left:50%;transform:translate(-50%,-50%);`;
      sw.appendChild(dot);
    }
    btn.appendChild(sw);
    // Libellé dans un <span> : sa 1re lettre est soulignée (raccourci clavier, js/keyboard.js).
    const lbl = document.createElement('span');
    lbl.className = 'tb-label';
    lbl.textContent = t.label;
    btn.appendChild(lbl);
    btn.title = 'Shortcut: ' + t.label[0].toUpperCase();
    btn.onclick = () => selectTileType(t.id);
    btn.dataset.sound = 'palette'; // son du choix dans la palette (js/sounds.js)
    pal.appendChild(btn);
  });
  buildDecorPalette(); // rangée « Decorations » (js/decor.js)
}

// Point d'entrée unique du choix du type de case (palette, et plus tard clavier) —
// idée reprise de la PR #2 de ChessMess.
function selectTileType(id) {
  leaveDecorMode(); // retour au pinceau (js/decor.js)
  sel = id;
  document.querySelectorAll('.tb').forEach(b => b.classList.remove('sel'));
  document.getElementById('tb-' + id)?.classList.add('sel');
}

// « Clear board » (tranche 4c, remplace « Reset road tile ») : toutes les cases remises en
// DEFAULT_TILE sans quitter l'éditeur ; nom, numéro et image de titre gardés. Une seule
// étape d'annulation (beginAction / endAction) : Ctrl+Z ramène tout le plateau.
function clearBoard() {
  const label = TILES.find(t => t.id === DEFAULT_TILE).label;
  const ok = confirm(
    'Clear all board spaces back to ' + label + '?\n\n' +
    'The road name, number and title image are kept. You can undo this with Undo (Ctrl+Z / ⌘Z).'
  );
  if (!ok) return;
  beginAction('clear');
  try { for (let i = 0; i < board.length; i++) updateCell(i, DEFAULT_TILE); }
  finally { endAction(); }
}

// « Home » (tranche 4c) : retour à l'écran d'accueil sans rien perdre — le plateau reste en
// mémoire et sauvegardé ; « Continue » y revient avec son historique, « Vendetta » /
// « Ignition » démarrent un nouveau plateau (Ctrl+Z ramène l'ancien).
function goHome() {
  document.getElementById('board-type-picker').style.display = 'flex';
  refreshContinueButton();
  fitAllTitleStacks();
}

