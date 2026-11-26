// ===== js/decor.js — Free decorations (phase 7, docs/roadmap.md; Mayrik's decisions of 22/11).
//
// Replaces the automatic placement (one random decoration per uniform area, removed with
// Mayrik's agreement). Works like map software (Dungeondraft, Inkarnate, Wonderdraft) and
// sticker editors (Canva): you pick an image from the library ("Decorations" row of the
// palette), a click on the board places it, you drag it to move it, you select it then ✕
// (or Delete) to remove it. Mouse and finger (Pointer Events).
//
// Two modes, like the active layers of drawing software: "paint" (a tile type is chosen:
// the brush paints, through the decorations) and "decor" (a decoration is chosen: clicks on
// the board target the decorations; the brush is set aside).
//
// Data: `decorations` (js/config.js), in the board snapshot (getBoardState): undoable, saved,
// in the project file and the export. Every change goes through addDecoration /
// moveDecoration / removeDecoration, which emit the 'decor' signal (one undo step each).
// Layer `layer-decor` UNDER the white masks (js/build-board.js): whatever overflows into the
// margins is hidden, the title band stays uncovered (Mayrik's choice). Selection and ✕ in
// `layer-decor-ui`, removed from the exported copy.

const DECOR_SIZE = 378;   // items/ images: 378 × 378 px at 300 dpi (actual size, never reduced)
// Circle of each drawing in its 378 px frame: [radius, x offset, y offset] of the centre,
// measured on items/source/*.png (non-transparent area, + 25 px); used for grabbing and selection.
const DECOR_SHAPES = [[108, -8, 22], [196, 0, 4], [106, -5, -10], [207, -20, -83], [103, 0, 0], [198, 1, 26],
  [94, 1, -24], [198, -51, -37], [148, -42, -17], [92, 0, 0], [130, 22, -40], [64, 0, 0]];
const DECOR_MIN_HIT_CSS = 22; // grab area never smaller than 22 screen px (finger)
function decorShape(d) { const [r, ox, oy] = DECOR_SHAPES[d.item - 1]; return { r, cx: d.x + ox, cy: d.y + oy }; }
const DECOR_REMOVE_CSS = 13; // radius of the ✕ button in screen pixels (same size for a finger on a phone)
const decor = { mode: 'paint', item: 1, selected: -1, drag: null };

// Area where the centre of a decoration may lie: cells and title band.
function decorBounds() {
  return { minX: GAME_X, maxX: GAME_X + GAME_W, minY: BANDS[0].top, maxY: GAME_Y + GAME_H };
}
function clampToDecorBounds(x, y) {
  const b = decorBounds();
  return { x: Math.min(b.maxX, Math.max(b.minX, x)), y: Math.min(b.maxY, Math.max(b.minY, y)) };
}

// ---- Changes (single entry points, 'decor' signal) ----
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

// Removes all decorations ("Clear board", js/editing.js, within its undo step).
function clearDecorations() {
  if (!decorations.length) return;
  decorations = [];
  decor.selected = -1;
  redrawDecorations();
  notifyBoardChange('decor', { action: 'clear' });
}

// ---- Dessin ----
// Depth order of the board view: lower = in front (like the overlays).
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
// Selection: dashed circle and ✕ button (never exported).
function renderDecorUI(g) {
  const d = decor.mode === 'decor' && decorations[decor.selected];
  if (!d) return;
  const sel = decorSelectionGeometry(d);
  if (!sel) return;
  const { grab, R, rx, ry } = sel;
  // Circle = real grab area (never under 22 screen px). Strokes of fixed on-screen width.
  g.appendChild(mkEl('circle', { cx: grab.cx, cy: grab.cy, r: grab.r, fill: 'none', stroke: '#f0952c', 'stroke-width': 2.5,
    'stroke-dasharray': '7 4', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }));
  const btn = mkEl('g', { id: 'decor-remove', style: 'cursor:pointer' });
  btn.appendChild(mkEl('circle', { cx: rx, cy: ry, r: R, fill: '#e0392b', stroke: '#1d1426', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
  const k = R * 0.42;
  btn.appendChild(mkEl('path', { d: `M${rx - k},${ry - k}L${rx + k},${ry + k}M${rx + k},${ry - k}L${rx - k},${ry + k}`,
    stroke: '#f3e6c8', 'stroke-width': 2.5, 'stroke-linecap': 'round', fill: 'none', 'vector-effect': 'non-scaling-stroke' }));
  g.appendChild(btn);
}
// Grab area and place of the ✕ (board pixels). The ✕ is placed OUTSIDE the grab area, with a gap
// in screen pixels: it never overlaps it, even on a phone (bug seen by Mayrik on 22/11:
// impossible to move a small decoration without deleting it). Top-right corner, otherwise
// another corner if it would leave the board (like the handles of sticker editors).
function decorScale() {
  const ctm = document.getElementById('bsvg').getScreenCTM();
  return ctm && ctm.a ? ctm.a : 0.25; // screen pixels per board pixel
}
function decorGrab(d, scale) {
  const sh = decorShape(d);
  return { cx: sh.cx, cy: sh.cy, r: Math.max(sh.r, DECOR_MIN_HIT_CSS / scale) };
}
function decorSelectionGeometry(d) {
  const scale = decorScale(), grab = decorGrab(d, scale), R = DECOR_REMOVE_CSS / scale;
  const dist = grab.r + R + 4 / scale; // edge to edge: 4 screen px gap
  const k = dist / Math.SQRT2;
  const corners = [[1, -1], [-1, -1], [1, 1], [-1, 1]]; // top right, top left, bottom right, bottom left
  for (const [sx, sy] of corners) {
    const rx = grab.cx + sx * k, ry = grab.cy + sy * k;
    if (rx - R >= 0 && rx + R <= VW && ry - R >= 0 && ry + R <= VH) return { grab, R, rx, ry };
  }
  return { grab, R, rx: grab.cx + k, ry: grab.cy - k };
}
function redrawDecorations() {
  const g = document.getElementById('layer-decor'), ui = document.getElementById('layer-decor-ui');
  if (g) { g.textContent = ''; renderAllDecorations(g); }
  if (ui) { ui.textContent = ''; renderDecorUI(ui); }
}

// ---- Palette: "Decorations" row (called by buildPalette, js/editing.js) ----
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
    img.src = path.replace('items/', 'items/thumb/'); // thumbnail cropped to the drawing (tools/make-decor-thumbs.py)
    img.alt = '';
    btn.appendChild(img);
    btn.onclick = () => selectDecorationItem(i + 1);
    row.appendChild(btn);
  });
  const help = document.createElement('span');
  help.className = 'palette-help decor-help';
  help.textContent = 'Click the board to place it · drag to move · select, then ✕ or Delete to remove';
  row.appendChild(help);
  pal.appendChild(row);
  refreshDecorPalette();
}
function refreshDecorPalette() {
  document.getElementById('palette')?.classList.toggle('decor-on', decor.mode === 'decor'); // which help text to show
  document.querySelectorAll('.decor-btn').forEach(b => b.classList.toggle('sel', decor.mode === 'decor' && b.id === 'decor-' + decor.item));
  document.getElementById('decor-palette')?.classList.toggle('active', decor.mode === 'decor');
  document.getElementById('bsvg')?.classList.toggle('decor-mode', decor.mode === 'decor');
}
function selectDecorationItem(n) {
  leaveBarricadeTool(); // js/barricades.js
  decor.mode = 'decor';
  decor.item = n;
  decor.selected = -1;
  document.querySelectorAll('.tb').forEach(b => b.classList.remove('sel'));
  refreshDecorPalette();
  redrawDecorations();
}
// Back to the brush (called by selectTileType, js/editing.js).
function leaveDecorMode() {
  if (decor.mode !== 'decor') return;
  cancelDecorDrag();
  decor.mode = 'paint';
  decor.selected = -1;
  refreshDecorPalette();
  redrawDecorations();
}

// ---- Gestures (Pointer Events, in capture: run before the brush in "decor" mode) ----
function toBoardPoint(svg, clientX, clientY) {
  const p = new DOMPoint(clientX, clientY).matrixTransform(svg.getScreenCTM().inverse());
  return { x: p.x, y: p.y };
}
function decorAt(p, svg) { // frontmost first
  const scale = svg.getScreenCTM().a; // screen pixels per board pixel
  const order = decorDrawOrder();
  for (let k = order.length - 1; k >= 0; k--) {
    const grab = decorGrab(decorations[order[k]], scale);
    if (Math.hypot(p.x - grab.cx, p.y - grab.cy) <= grab.r) return order[k];
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
  redrawDecorations(); // puts the decoration back where it was before the gesture
}

(function installDecorGestures() {
  const svg = document.getElementById('bsvg');

  svg.addEventListener('pointerdown', e => {
    if (decor.mode !== 'decor') return;
    e.stopImmediatePropagation(); // the brush sees nothing in "decor" mode
    if (decor.drag) { // 2nd finger during a move: pinch, the move is cancelled
      if (e.pointerType === 'touch' && e.pointerId !== decor.drag.pointerId) cancelDecorDrag();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (e.target.closest && e.target.closest('#decor-remove')) { // ✕: acts on release, like a button
      decor.drag = { pointerId: e.pointerId, removeArmed: true };
      try { svg.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    const p = toBoardPoint(svg, e.clientX, e.clientY);
    let i = decorAt(p, svg);
    if (i < 0) {
      if (!insideDecorBounds(p)) { decor.selected = -1; redrawDecorations(); return; }
      // New decoration: shown immediately, added to the data on release, at its final place
      // (placed then dragged in the same gesture = a single undo step).
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
    if (!dr || e.pointerId !== dr.pointerId || dr.removeArmed) return;
    if (!dr.moved && Math.hypot(e.clientX - dr.startX, e.clientY - dr.startY) < 4) return; // simple click
    dr.moved = true;
    const p = toBoardPoint(svg, e.clientX, e.clientY);
    const q = clampToDecorBounds(p.x - dr.dx, p.y - dr.dy);
    // Preview of the move without touching the data (a single undo step, on release)
    const img = dr.adding ? document.getElementById('decor-ghost') : document.querySelector(`#layer-decor [data-decor="${dr.i}"]`);
    if (img) { img.setAttribute('x', q.x - DECOR_SIZE / 2); img.setAttribute('y', q.y - DECOR_SIZE / 2); }
    dr.x = q.x; dr.y = q.y;
    if (!dr.adding) document.getElementById('layer-decor-ui').textContent = ''; // circle and ✕ hidden during the gesture
  }, true);

  const finish = e => {
    const dr = decor.drag;
    if (!dr || e.pointerId !== dr.pointerId) return;
    decor.drag = null;
    try { if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId); } catch (err) {}
    if (e.type === 'pointercancel') { redrawDecorations(); return; }
    if (dr.removeArmed) { // removed only if the finger (or mouse) is released on the ✕
      const d = decorations[decor.selected], sel = d && decorSelectionGeometry(d), p = toBoardPoint(svg, e.clientX, e.clientY);
      if (sel && Math.hypot(p.x - sel.rx, p.y - sel.ry) <= sel.R * 1.3) removeDecoration(decor.selected);
      return;
    }
    if (dr.adding) addDecoration(decor.item, dr.x, dr.y);
    else if (dr.moved && dr.x !== undefined) moveDecoration(dr.i, dr.x, dr.y);
    else redrawDecorations();
  };
  svg.addEventListener('pointerup', finish, true);
  svg.addEventListener('pointercancel', finish, true);

  // Keyboard: Delete / Backspace removes the selected decoration, Escape deselects it.
  // In capture on window: runs before the board keyboard (js/keyboard.js), which would empty the cell.
  window.addEventListener('keydown', e => {
    if (decor.mode !== 'decor' || decor.selected < 0) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (!document.getElementById('export-dialog').hidden || !document.getElementById('shortcut-help').hidden || messageOpen()) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); removeDecoration(decor.selected); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); decor.selected = -1; redrawDecorations(); }
  }, true);
})();
