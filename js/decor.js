// ===== js/decor.js — Décorations libres (phase 7, docs/roadmap.md ; décisions de Mayrik du 22/11).
//
// Remplace la pose automatique (une décoration au hasard par zone homogène, retirée avec l'accord de
// Mayrik). Fonctionnement des logiciels de cartes (Dungeondraft, Inkarnate, Wonderdraft) et des
// éditeurs à autocollants (Canva) : on choisit une image dans la bibliothèque (rangée « Decorations »
// de la palette), un clic sur le plateau la pose, on la fait glisser pour la déplacer, on la
// sélectionne puis ✕ (ou Suppr) pour la retirer. Souris et doigt (Pointer Events).
//
// Deux modes, comme les calques actifs des logiciels de dessin : « paint » (choix d'un type de case :
// le pinceau peint, à travers les décorations) et « decor » (choix d'une décoration : les clics sur
// le plateau visent les décorations ; le pinceau est mis de côté).
//
// Données : `decorations` (js/config.js), dans la photo du plateau (getBoardState) : annulable,
// sauvegardée, dans le fichier de projet et l'export. Toute modification passe par addDecoration /
// moveDecoration / removeDecoration, qui émettent le signal 'decor' (une étape d'annulation chacune).
// Calque `layer-decor` SOUS les masques blancs (js/build-board.js) : ce qui déborde sur les marges
// est caché, la bande de titre reste découverte (choix de Mayrik). Sélection et ✕ dans
// `layer-decor-ui`, retiré de la copie exportée.

const DECOR_SIZE = 378;   // images items/ : 378 × 378 px à 300 dpi (taille réelle, jamais réduite)
// Cercle de chaque dessin dans son cadre de 378 px : [rayon, décalage x, décalage y] du centre,
// mesurés sur items/source/*.png (zone non transparente, + 25 px) ; sert à la prise et à la sélection.
const DECOR_SHAPES = [[108, -8, 22], [196, 0, 4], [106, -5, -10], [207, -20, -83], [103, 0, 0], [198, 1, 26],
  [94, 1, -24], [198, -51, -37], [148, -42, -17], [92, 0, 0], [130, 22, -40], [64, 0, 0]];
const DECOR_MIN_HIT_CSS = 22; // zone de prise jamais plus petite que 22 px d'écran (doigt)
function decorShape(d) { const [r, ox, oy] = DECOR_SHAPES[d.item - 1]; return { r, cx: d.x + ox, cy: d.y + oy }; }
const DECOR_REMOVE_CSS = 13; // rayon du bouton ✕ en pixels d'écran (même taille au doigt sur téléphone)
const decor = { mode: 'paint', item: 1, selected: -1, drag: null };

// Zone où le centre d'une décoration peut se trouver : cases et bande de titre.
function decorBounds() {
  return { minX: GAME_X, maxX: GAME_X + GAME_W, minY: BANDS[0].top, maxY: GAME_Y + GAME_H };
}
function clampToDecorBounds(x, y) {
  const b = decorBounds();
  return { x: Math.min(b.maxX, Math.max(b.minX, x)), y: Math.min(b.maxY, Math.max(b.minY, y)) };
}

// ---- Modifications (points d'entrée uniques, signal 'decor') ----
function addDecoration(item, x, y) {
  const p = clampToDecorBounds(x, y);
  decorations.push({ item, x: Math.round(p.x), y: Math.round(p.y) });
  decor.selected = decorations.length - 1;
  redrawDecorations();
  notifyBoardChange('decor', { action: 'add' });
}
function moveDecoration(i, x, y) {
  const p = clampToDecorBounds(x, y);
  decorations[i] = Object.assign({}, decorations[i], { x: Math.round(p.x), y: Math.round(p.y) });
  redrawDecorations();
  notifyBoardChange('decor', { action: 'move' });
}
function removeDecoration(i) {
  if (i < 0 || i >= decorations.length) return;
  decorations.splice(i, 1);
  decor.selected = -1;
  redrawDecorations();
  notifyBoardChange('decor', { action: 'remove' });
}

// Toutes les décorations retirées (« Clear board », js/editing.js, dans son étape d'annulation).
function clearDecorations() {
  if (!decorations.length) return;
  decorations = [];
  decor.selected = -1;
  redrawDecorations();
  notifyBoardChange('decor', { action: 'clear' });
}

// ---- Dessin ----
// Ordre de profondeur de la vue du plateau : plus bas = devant (comme les overlays).
function decorDrawOrder() {
  return decorations.map((d, i) => i).sort((a, b) => decorations[a].y - decorations[b].y || a - b);
}
function renderAllDecorations(g) {
  for (const i of decorDrawOrder()) {
    const d = decorations[i];
    g.appendChild(mkEl('image', {
      href: displayHref(ITEM_PATHS[d.item - 1]),
      x: d.x - DECOR_SIZE / 2, y: d.y - DECOR_SIZE / 2, width: DECOR_SIZE, height: DECOR_SIZE,
      'pointer-events': 'none', 'data-decor': i,
    }));
  }
}
// Sélection : cercle en pointillés et bouton ✕ (jamais exportés).
function renderDecorUI(g) {
  const d = decor.mode === 'decor' && decorations[decor.selected];
  if (!d) return;
  const sh = decorShape(d);
  const ctm = document.getElementById('bsvg').getScreenCTM();
  const scale = ctm && ctm.a ? ctm.a : 0.25; // pixels d'écran par pixel du plateau
  // Traits d'épaisseur fixe à l'écran (vector-effect), quelle que soit la réduction du plateau
  g.appendChild(mkEl('circle', { cx: sh.cx, cy: sh.cy, r: sh.r, fill: 'none', stroke: '#f0952c', 'stroke-width': 2.5,
    'stroke-dasharray': '7 4', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }));
  const R = DECOR_REMOVE_CSS / scale, rx = sh.cx + sh.r * 0.72, ry = sh.cy - sh.r * 0.72;
  const btn = mkEl('g', { id: 'decor-remove', style: 'cursor:pointer' });
  btn.appendChild(mkEl('circle', { cx: rx, cy: ry, r: R, fill: '#e0392b', stroke: '#1d1426', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
  const k = R * 0.42;
  btn.appendChild(mkEl('path', { d: `M${rx - k},${ry - k}L${rx + k},${ry + k}M${rx + k},${ry - k}L${rx - k},${ry + k}`,
    stroke: '#f3e6c8', 'stroke-width': 2.5, 'stroke-linecap': 'round', fill: 'none', 'vector-effect': 'non-scaling-stroke' }));
  g.appendChild(btn);
}
function redrawDecorations() {
  const g = document.getElementById('layer-decor'), ui = document.getElementById('layer-decor-ui');
  if (g) { g.textContent = ''; renderAllDecorations(g); }
  if (ui) { ui.textContent = ''; renderDecorUI(ui); }
}

// ---- Palette : rangée « Decorations » (appelée par buildPalette, js/editing.js) ----
function buildDecorPalette() {
  const pal = document.getElementById('palette');
  const row = document.createElement('div');
  row.id = 'decor-palette';
  const label = document.createElement('span');
  label.className = 'decor-label';
  label.textContent = 'Decorations';
  row.appendChild(label);
  ITEM_PATHS.forEach((path, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'decor-btn';
    btn.id = 'decor-' + (i + 1);
    btn.dataset.sound = 'palette';
    btn.title = 'Decoration ' + (i + 1);
    btn.setAttribute('aria-label', 'Decoration ' + (i + 1));
    const img = document.createElement('img');
    img.src = path.replace('items/', 'items/thumb/'); // vignette recadrée sur le dessin (tools/make-decor-thumbs.py)
    img.alt = '';
    btn.appendChild(img);
    btn.onclick = () => selectDecorationItem(i + 1);
    row.appendChild(btn);
  });
  const help = document.createElement('span');
  help.className = 'decor-help';
  help.textContent = 'Click the board to place it · drag to move · select, then ✕ or Delete to remove';
  row.appendChild(help);
  pal.appendChild(row);
  refreshDecorPalette();
}
function refreshDecorPalette() {
  document.querySelectorAll('.decor-btn').forEach(b => b.classList.toggle('sel', decor.mode === 'decor' && b.id === 'decor-' + decor.item));
  document.getElementById('decor-palette')?.classList.toggle('active', decor.mode === 'decor');
  document.getElementById('bsvg')?.classList.toggle('decor-mode', decor.mode === 'decor');
}
function selectDecorationItem(n) {
  decor.mode = 'decor';
  decor.item = n;
  decor.selected = -1;
  document.querySelectorAll('.tb').forEach(b => b.classList.remove('sel'));
  refreshDecorPalette();
  redrawDecorations();
}
// Retour au pinceau (appelé par selectTileType, js/editing.js).
function leaveDecorMode() {
  if (decor.mode !== 'decor') return;
  cancelDecorDrag();
  decor.mode = 'paint';
  decor.selected = -1;
  refreshDecorPalette();
  redrawDecorations();
}

// ---- Gestes (Pointer Events, en capture : passent avant le pinceau en mode « decor ») ----
function toBoardPoint(svg, clientX, clientY) {
  const p = new DOMPoint(clientX, clientY).matrixTransform(svg.getScreenCTM().inverse());
  return { x: p.x, y: p.y };
}
function decorAt(p, svg) { // la plus en avant d'abord
  const scale = svg.getScreenCTM().a; // pixels d'écran par pixel du plateau
  const order = decorDrawOrder();
  for (let k = order.length - 1; k >= 0; k--) {
    const sh = decorShape(decorations[order[k]]);
    if (Math.hypot(p.x - sh.cx, p.y - sh.cy) <= Math.max(sh.r, DECOR_MIN_HIT_CSS / scale)) return order[k];
  }
  return -1;
}
function insideDecorBounds(p) {
  const b = decorBounds();
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;
}
function cancelDecorDrag() {
  if (!decor.drag) return;
  decor.drag = null;
  redrawDecorations(); // remet la décoration à sa place d'avant le geste
}

(function installDecorGestures() {
  const svg = document.getElementById('bsvg');

  svg.addEventListener('pointerdown', e => {
    if (decor.mode !== 'decor') return;
    e.stopImmediatePropagation(); // le pinceau ne voit rien en mode « decor »
    if (decor.drag) { // 2e doigt pendant un déplacement : pincement, le déplacement est annulé
      if (e.pointerType === 'touch' && e.pointerId !== decor.drag.pointerId) cancelDecorDrag();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (e.target.closest && e.target.closest('#decor-remove')) { removeDecoration(decor.selected); return; }
    const p = toBoardPoint(svg, e.clientX, e.clientY);
    let i = decorAt(p, svg);
    if (i < 0) {
      if (!insideDecorBounds(p)) { decor.selected = -1; redrawDecorations(); return; }
      // Nouvelle décoration : montrée tout de suite, ajoutée aux données au lâcher, à sa place finale
      // (posée puis glissée dans le même geste = une seule étape d'annulation).
      const q = clampToDecorBounds(p.x, p.y);
      decor.selected = -1;
      redrawDecorations();
      const ghost = mkEl('image', { href: displayHref(ITEM_PATHS[decor.item - 1]), id: 'decor-ghost', 'pointer-events': 'none',
        x: q.x - DECOR_SIZE / 2, y: q.y - DECOR_SIZE / 2, width: DECOR_SIZE, height: DECOR_SIZE });
      document.getElementById('layer-decor-ui').appendChild(ghost);
      decor.drag = { pointerId: e.pointerId, i: -1, dx: 0, dy: 0, x: q.x, y: q.y,
                     startX: e.clientX, startY: e.clientY, moved: false, adding: true };
    } else {
      decor.selected = i;
      redrawDecorations();
      decor.drag = { pointerId: e.pointerId, i, dx: p.x - decorations[i].x, dy: p.y - decorations[i].y,
                     startX: e.clientX, startY: e.clientY, moved: false };
    }
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
  }, true);

  svg.addEventListener('pointermove', e => {
    const dr = decor.drag;
    if (!dr || e.pointerId !== dr.pointerId) return;
    if (!dr.moved && Math.hypot(e.clientX - dr.startX, e.clientY - dr.startY) < 4) return; // simple clic
    dr.moved = true;
    const p = toBoardPoint(svg, e.clientX, e.clientY);
    const q = clampToDecorBounds(p.x - dr.dx, p.y - dr.dy);
    // Aperçu du déplacement sans toucher aux données (une seule étape d'annulation, au lâcher)
    const img = dr.adding ? document.getElementById('decor-ghost') : document.querySelector(`#layer-decor [data-decor="${dr.i}"]`);
    if (img) { img.setAttribute('x', q.x - DECOR_SIZE / 2); img.setAttribute('y', q.y - DECOR_SIZE / 2); }
    dr.x = q.x; dr.y = q.y;
    if (!dr.adding) document.getElementById('layer-decor-ui').textContent = ''; // cercle et ✕ cachés pendant le geste
  }, true);

  const finish = e => {
    const dr = decor.drag;
    if (!dr || e.pointerId !== dr.pointerId) return;
    decor.drag = null;
    try { if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId); } catch (err) {}
    if (e.type === 'pointercancel') { redrawDecorations(); return; }
    if (dr.adding) addDecoration(decor.item, dr.x, dr.y);
    else if (dr.moved && dr.x !== undefined) moveDecoration(dr.i, dr.x, dr.y);
    else redrawDecorations();
  };
  svg.addEventListener('pointerup', finish, true);
  svg.addEventListener('pointercancel', finish, true);

  // Clavier : Suppr / Retour arrière retire la décoration sélectionnée, Échap la désélectionne.
  // En capture sur window : passe avant le clavier du plateau (js/keyboard.js), qui viderait la case.
  window.addEventListener('keydown', e => {
    if (decor.mode !== 'decor' || decor.selected < 0) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (!document.getElementById('export-dialog').hidden || !document.getElementById('shortcut-help').hidden) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); removeDecoration(decor.selected); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); decor.selected = -1; redrawDecorations(); }
  }, true);
})();
