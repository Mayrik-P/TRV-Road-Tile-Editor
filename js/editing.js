// ===== js/editing.js — Board editing: incremental update of a cell (updateCell),
// palette of tile types, reset.
//
// Classic script (not a module): all js/ files share the same global scope and are loaded
// in the fixed order of the <script> tags in index.html (the only reference). Code run
// when a file loads can only use what is declared in that file or the previous ones;
// functions, called later, see everything.

// ---- Incremental update: only touches the modified cell and its neighbours ----
// directly concerned by a transition, instead of rebuilding everything (buildBoard()).
// This fixes the slowness that grew with the number of transitions on the board.
// Empties a layer entirely (by id) then rebuilds it through the supplied
// render function — factors out a pattern used for the layers that are simpler
// to always recompute in full (decorations, road edges) rather than patch
// case by case, given their negligible cost (48 cells).
function rebuildLayer(layerId, renderFn) {
  const g = document.getElementById(layerId);
  while (g.firstChild) g.removeChild(g.firstChild);
  renderFn(g);
}

function updateCell(idx, newType) {
  const oldType = board[idx];
  const fam = overlayFamily(newType);
  // A click on a cell that already has the same type normally does nothing — except for
  // types with variants (Impassable/Oil/Fire), where that is precisely the gesture that lets
  // the user cycle the visual to the next one.
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

  // --- Membership in the texture layers (union clip per type) ---
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

  // --- Transitions: remove those that touched this cell, then only
  // recompute its direct neighbours (instead of the whole board) ---
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

  // --- Flat fill / border for this cell only ---
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

  // --- Overlay (hazard/oil/ramp/multiramp/rock/fire) for this cell only ---
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

  // --- Road <-> Other overflow: depends on the direct neighbours, but we
  // recompute the whole board for simplicity (negligible cost, 48 cells).
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
  pal.appendChild(buildBarricadeButton()); // "Barricade" tool, chosen like a tile type (js/barricades.js)
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
    // Label in a <span>: its first letter is underlined (keyboard shortcut, js/keyboard.js).
    const lbl = document.createElement('span');
    lbl.className = 'tb-label';
    lbl.textContent = t.label;
    btn.appendChild(lbl);
    btn.title = 'Shortcut: ' + t.label[0].toUpperCase();
    btn.onclick = () => selectTileType(t.id);
    btn.dataset.sound = 'palette'; // sound of the palette choice (js/sounds.js)
    pal.appendChild(btn);
  });
  // Help text for the tile types, under their row, visible in brush mode only (like the one
  // for decorations; Mayrik's idea, 22/11: replaces the help line above the palette).
  const help = document.createElement('p');
  help.className = 'palette-help tile-help';
  help.innerHTML = 'Click or tap a space to place the selected type · drag to paint several spaces · click again on '
    + 'Impassable, Oil or Fire to change its look<span class="help-keys"> · press <kbd>?</kbd> for keyboard shortcuts</span>';
  pal.appendChild(help);
  pal.appendChild(buildBarricadeHelp()); // shown instead of the line above while the barricade tool is active
  buildDecorPalette(); // "Decorations" row (js/decor.js)
  refreshBarricadePalette();
}

// Single entry point for choosing the tile type (palette, and later keyboard) —
// idea taken from ChessMess's PR #2.
function selectTileType(id) {
  leaveDecorMode(); // back to the brush (js/decor.js)
  leaveBarricadeTool(); // (js/barricades.js)
  sel = id;
  document.querySelectorAll('.tb').forEach(b => b.classList.remove('sel'));
  document.getElementById('tb-' + id)?.classList.add('sel');
}

// "Clear board" (tranche 4c, replaces "Reset road tile"): all cells put back to
// DEFAULT_TILE without leaving the editor; name, number and title image kept. A single
// undo step (beginAction / endAction): Ctrl+Z brings the whole board back.
function clearBoard() {
  const label = TILES.find(t => t.id === DEFAULT_TILE).label;
  const ok = confirm(
    'Clear all board spaces back to ' + label + ' and remove all decorations and barricades?\n\n' +
    'The road name, number and title image are kept. You can undo this with Undo (Ctrl+Z / ⌘Z).'
  );
  if (!ok) return;
  beginAction('clear');
  try {
    for (let i = 0; i < board.length; i++) updateCell(i, DEFAULT_TILE);
    clearDecorations(); // decorations removed too, in the same step (Mayrik's choice, 22/11)
    clearBarricades();  // and barricades, likewise
  } finally { endAction(); }
}

// "Home" (tranche 4c): back to the home screen without losing anything — the board stays in
// memory and saved; "Continue" returns to it with its history, "Vendetta" /
// "Ignition" start a new board (Ctrl+Z brings the old one back).
function goHome() {
  document.getElementById('board-type-picker').style.display = 'flex';
  refreshContinueButton();
  fitAllTitleStacks();
}

