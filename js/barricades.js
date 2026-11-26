// ===== js/barricades.js — Barricades of Ignition (phase 8, docs/roadmap.md), on both formats.
//
// Classic script (not a module): all js/ files share the same global scope and are loaded
// in the fixed order of the <script> tags in index.html (the only reference). Code run
// when a file loads can only use what is declared in that file or the previous ones;
// functions, called later, see everything.
//
// Proven data model: thin walls laid on the EDGES between two cells, not on the cells
// (Red Blob Games, "Grid parts and relationships": edges). With the staggered rows, the
// boundary between two rows is cut into segments of 298 px ("long") and 195 px ("short")
// at 300 dpi; the segments at the board edges are always long. A barricade is designated by
// the pair of cells it separates, upper cell first: key "upper-lower" (cell indexes).
//
// Data: `barricades` (js/config.js), sorted list of keys, in the board snapshot
// (getBoardState): undoable, saved, in the project file and the export. Every change goes
// through addBarricade / removeBarricade / clearBarricades, which emit the 'barricade' signal.
//
// Drawing (slice 8d): in the overlay layer, in its isometric order (rows from top to bottom): a
// barricade is in front of the cells of the row above it and behind those of the row below (whose
// sprites cover its shadow, which falls on their ground); along a boundary, from left to right.
// Images: Mayrik's drawings (barricades/source/, 4 times the printed size, on the template),
// reduced to 300 dpi by tools/make-webp.py. In the 425 × 288 px image, the segment is
// centred horizontally and the row boundary is 187.5 px from the top: the drawing itself
// carries its placement (its base straddles the boundary, its shadow points to the bottom
// left, like the official boards), so the code never adjusts a model individually.

const BARRICADE_PATHS = {
  long: ['barricades/barricade-long.webp'],
  short: ['barricades/barricade-short.webp'],
};
const BARRICADE_W = 425, BARRICADE_H = 288; // 300 dpi image (1700 × 1152 template / 4)
const BARRICADE_LINE_Y = 187.5;             // row boundary in the image (template: 750 / 4)

// All the segments of a format, without the page geometry (also used to validate a
// snapshot of another format): for each pair of cells of two neighbouring rows that touch.
// Row r is shifted 195 px to the right of row r + 1 when r is odd, to the left when r is even
// (computeBands, js/config.js): the lower cell of the same column always gives the long
// segment; the short one is with the lower cell on the left (r even) or on the right (r odd).
function barricadePairs(cols) {
  const pairs = [];
  for (let r = 0; r < ROWS - 1; r++)
    for (let c = 0; c < cols; c++) {
      const upper = r * cols + c;
      pairs.push([upper, (r + 1) * cols + c]);
      const nc = r % 2 === 0 ? c - 1 : c + 1;
      if (nc >= 0 && nc < cols) pairs.push([upper, (r + 1) * cols + nc]);
    }
  return pairs;
}
function barricadeKey(upper, lower) { return upper + '-' + lower; }
function validBarricadeKeys(cols) { return new Set(barricadePairs(cols).map(([a, b]) => barricadeKey(a, b))); }

// Segment of a barricade in the current format (board pixels): x0..x1 on the row boundary y.
function barricadeSegment(key) {
  const [upper, lower] = key.split('-').map(Number);
  const r = Math.floor(upper / COLS);
  const [a0, a1] = cellXRange(upper % COLS, r), [b0, b1] = cellXRange(lower % COLS, r + 1);
  const x0 = Math.max(a0, b0), x1 = Math.min(a1, b1);
  return { key, row: r, x0, x1, y: BANDS[r + 1].bot, kind: x1 - x0 > EDGE_SEG_LONG_THRESHOLD ? 'long' : 'short' };
}

// Same model for the same key, whatever the order of the clicks (stable choice among the
// variants, when there are several).
function barricadeHref(key, kind) {
  const list = BARRICADE_PATHS[kind];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

// Rank in the isometric order of the overlay layer (insertInIsometricOrder, js/render-layers.js):
// after every cell of row r (ranks r*COLS .. r*COLS + COLS - 1), before those of row r + 1,
// and from LEFT to right along the boundary: the barricade on the right is always drawn over the one
// on its left, as Mayrik's drawings require (the sheets of the short one overhang to the left;
// layering fault seen by Mayrik on 26/11, version 1.3).
function barricadeRank(seg) {
  return seg.row * COLS + COLS - 0.75 + 0.25 * (seg.x0 + seg.x1) / 2 / VW;
}

function barricadeElement(key) {
  const seg = barricadeSegment(key);
  const el = mkEl('image', {
    href: displayHref(barricadeHref(key, seg.kind)),
    x: (seg.x0 + seg.x1) / 2 - BARRICADE_W / 2, y: seg.y - BARRICADE_LINE_Y,
    width: BARRICADE_W, height: BARRICADE_H, 'pointer-events': 'none',
  });
  el.dataset.barricade = key;
  el.dataset.rank = barricadeRank(seg);
  return el;
}
// Called by buildBoard (js/build-board.js), after renderAllOverlays.
function renderAllBarricades(g) {
  for (const key of barricades) insertInIsometricOrder(g, barricadeElement(key));
}
function redrawBarricades() {
  const g = document.getElementById('layer-overlays');
  if (!g) return;
  g.querySelectorAll('[data-barricade]').forEach(el => el.remove());
  renderAllBarricades(g);
}

// ---- Changes (single entry points, 'barricade' signal) ----
function addBarricade(key) {
  if (barricades.includes(key) || !validBarricadeKeys(COLS).has(key)) return;
  barricades = [...barricades, key].sort(compareBarricadeKeys);
  redrawBarricades();
  notifyBoardChange('barricade', { action: 'add', key });
}
function removeBarricade(key) {
  if (!barricades.includes(key)) return;
  barricades = barricades.filter(k => k !== key);
  redrawBarricades();
  notifyBoardChange('barricade', { action: 'remove', key });
}
// Removes all barricades ("Clear board", js/editing.js, within its undo step).
function clearBarricades() {
  if (!barricades.length) return;
  barricades = [];
  redrawBarricades();
  notifyBoardChange('barricade', { action: 'clear' });
}
// Sorted by upper cell, then lower cell: the same board always gives the same snapshot.
function compareBarricadeKeys(a, b) {
  const [a0, a1] = a.split('-').map(Number), [b0, b1] = b.split('-').map(Number);
  return a0 - b0 || a1 - b1;
}

// ---- Barricade tool (slice 8c; Mayrik's decisions of 26/11) ----
// Chosen in the palette like a tile type ("Barricade" button, letter B). While it is active,
// the hovered BORDER segment lights up instead of the cell: green if a click places a
// barricade, red if it removes the one there. A click places or removes; while dragging, the
// first segment decides for the whole gesture (places everywhere or removes everywhere: method
// of the availability grids such as Doodle, and of the checkbox lists of spreadsheet apps).
// Gestures: Pointer Events in capture on #bsvg, like the decorations, so the brush sees
// nothing; same rules as the brush (js/brush.js): one gesture = one undo step, primary mouse
// button only, a 2nd finger (pinch) cancels the gesture, intermediate points of a fast
// gesture picked up. Every point of the cell area designates the nearest segment (generous
// target for a finger: half a row above and below each border).
const barricadeTool = { active: false, stroke: null, hoverKey: null };
const BARRICADE_STEP_PX = 6;          // maximum gap between two points tested during a fast gesture
const BARRICADE_HIGHLIGHT_CSS = 9;    // thickness of the highlighted segment, in screen pixels
const BARRICADE_HIGHLIGHT_INSET = 14; // gap at each end (board px): two neighbouring segments stay distinct

// Segments of the current format, recomputed only when the format changes.
let barricadeSegmentCache = { type: null, segs: [] };
function currentBarricadeSegments() {
  if (barricadeSegmentCache.type !== BOARD_TYPE)
    barricadeSegmentCache = { type: BOARD_TYPE, segs: barricadePairs(COLS).map(([a, b]) => barricadeSegment(barricadeKey(a, b))) };
  return barricadeSegmentCache.segs;
}
// Segment designated by a board point: nearest row border, segment containing x (or the
// nearest one at the board edges); nothing outside the cell area (title band, margins).
function barricadeSegmentAt(p) {
  const segs = currentBarricadeSegments();
  const top = BANDS[1].top, bottom = BANDS[ROWS].bot;
  const minX = Math.min(...segs.map(s => s.x0)), maxX = Math.max(...segs.map(s => s.x1));
  if (p.y < top || p.y > bottom || p.x < minX - NOTCH || p.x > maxX + NOTCH) return null;
  let row = 0;
  for (let r = 1; r < ROWS - 1; r++) if (Math.abs(p.y - BANDS[r + 1].bot) < Math.abs(p.y - BANDS[row + 1].bot)) row = r;
  const onRow = segs.filter(s => s.row === row);
  const dist = s => p.x < s.x0 ? s.x0 - p.x : p.x > s.x1 ? p.x - s.x1 : 0;
  return onRow.reduce((best, s) => dist(s) < dist(best) ? s : best);
}

// Highlight (layer-barricade-ui, never exported): segment line, plus the barricade drawn
// lightly when the click would place one (what you see is what you get).
function renderBarricadeHighlight(seg, adding) {
  const g = document.getElementById('layer-barricade-ui');
  if (!g) return;
  g.textContent = '';
  barricadeTool.hoverKey = seg ? seg.key : null;
  if (!seg) return;
  if (adding) {
    const ghost = barricadeElement(seg.key);
    ghost.setAttribute('opacity', '0.55');
    delete ghost.dataset.barricade;
    g.appendChild(ghost);
  }
  g.appendChild(mkEl('line', {
    x1: seg.x0 + BARRICADE_HIGHLIGHT_INSET, y1: seg.y, x2: seg.x1 - BARRICADE_HIGHLIGHT_INSET, y2: seg.y,
    stroke: adding ? '#b0d458' : '#e0392b', 'stroke-width': BARRICADE_HIGHLIGHT_CSS, 'stroke-linecap': 'round',
    'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none', 'data-action': adding ? 'add' : 'remove',
  }));
}
function clearBarricadeHighlight() { renderBarricadeHighlight(null, false); }

// ---- Palette: "Barricade" button, in the row of the tile types (called by buildPalette) ----
function buildBarricadeButton() {
  const btn = document.createElement('div');
  btn.className = 'tb' + (barricadeTool.active ? ' sel' : '');
  btn.id = 'tool-barricade';
  btn.dataset.sound = 'palette';
  btn.title = 'Barricades on the borders between rows — Shortcut: B';
  const sw = document.createElement('div');
  sw.className = 'sw';
  sw.style.cssText = 'position:relative;flex-shrink:0;background:repeating-linear-gradient(135deg,#f2c72e 0 3px,#1d1426 3px 6px);';
  btn.appendChild(sw);
  const lbl = document.createElement('span');
  lbl.className = 'tb-label';
  lbl.textContent = 'Barricade';
  btn.appendChild(lbl);
  btn.onclick = selectBarricadeTool;
  return btn;
}
function buildBarricadeHelp() {
  const help = document.createElement('p');
  help.className = 'palette-help barricade-help';
  help.textContent = 'Click or tap a border between two rows to place a barricade · click a barricade to remove it · '
    + 'drag along the borders to place (or remove) several';
  return help;
}
function refreshBarricadePalette() {
  document.getElementById('palette')?.classList.toggle('barricade-on', barricadeTool.active);
  document.getElementById('tool-barricade')?.classList.toggle('sel', barricadeTool.active);
  document.getElementById('bsvg')?.classList.toggle('barricade-mode', barricadeTool.active);
}
function selectBarricadeTool() {
  leaveDecorMode(); // js/decor.js
  barricadeTool.active = true;
  document.querySelectorAll('.tb, .decor-btn').forEach(b => b.classList.remove('sel'));
  refreshBarricadePalette();
}
// Back to the brush or to the decorations (called by selectTileType and selectDecorationItem).
function leaveBarricadeTool() {
  if (!barricadeTool.active) return;
  if (barricadeTool.stroke) endBarricadeStroke(true);
  barricadeTool.active = false;
  clearBarricadeHighlight();
  refreshBarricadePalette();
}

// ---- Gestures ----
function applyBarricadeStroke(seg) {
  const st = barricadeTool.stroke;
  if (!seg || seg.key === st.lastKey) return;
  st.lastKey = seg.key;
  if (st.adding) addBarricade(seg.key); else removeBarricade(seg.key); // no change if already so
  renderBarricadeHighlight(seg, st.adding);
}
function endBarricadeStroke(cancel) {
  const st = barricadeTool.stroke;
  if (!st) return;
  barricadeTool.stroke = null;
  const svg = document.getElementById('bsvg');
  try { if (svg.hasPointerCapture(st.pointerId)) svg.releasePointerCapture(st.pointerId); } catch (e) {}
  if (cancel) cancelAction(); else endAction();
  if (st.pointerType === 'mouse' && st.lastPoint) {
    const seg = barricadeSegmentAt(st.lastPoint);
    renderBarricadeHighlight(seg, seg && !barricades.includes(seg.key));
  } else clearBarricadeHighlight();
}

(function installBarricadeTool() {
  const svg = document.getElementById('bsvg');
  const boardPoint = (x, y) => { const q = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse()); return { x: q.x, y: q.y }; };

  svg.addEventListener('pointerdown', e => {
    if (!barricadeTool.active) return;
    e.stopImmediatePropagation(); // the brush sees nothing with the barricade tool
    const st = barricadeTool.stroke;
    if (st) { // 2nd finger during a gesture: pinch, the gesture is cancelled
      if (e.pointerType === 'touch' && e.pointerId !== st.pointerId) endBarricadeStroke(true);
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = boardPoint(e.clientX, e.clientY), seg = barricadeSegmentAt(p);
    if (!seg) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    barricadeTool.stroke = { pointerId: e.pointerId, pointerType: e.pointerType, lastKey: null,
                             adding: !barricades.includes(seg.key), lastX: e.clientX, lastY: e.clientY, lastPoint: p };
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
    beginAction('barricade');
    applyBarricadeStroke(seg);
  }, true);

  svg.addEventListener('pointermove', e => {
    if (!barricadeTool.active) return;
    const st = barricadeTool.stroke;
    if (!st) { // mouse hover: shows what a click would do
      if (e.pointerType !== 'mouse') return;
      const seg = barricadeSegmentAt(boardPoint(e.clientX, e.clientY));
      if ((seg ? seg.key : null) !== barricadeTool.hoverKey) renderBarricadeHighlight(seg, seg && !barricades.includes(seg.key));
      return;
    }
    if (e.pointerId !== st.pointerId) return;
    const points = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const pt of (points.length ? points : [e])) {
      const dx = pt.clientX - st.lastX, dy = pt.clientY - st.lastY;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / BARRICADE_STEP_PX));
      for (let i = 1; i <= steps; i++) {
        st.lastPoint = boardPoint(st.lastX + dx * i / steps, st.lastY + dy * i / steps);
        applyBarricadeStroke(barricadeSegmentAt(st.lastPoint));
      }
      st.lastX = pt.clientX; st.lastY = pt.clientY;
    }
  }, true);

  const finish = e => {
    const st = barricadeTool.stroke;
    if (st && e.pointerId === st.pointerId) endBarricadeStroke(e.type === 'pointercancel');
  };
  svg.addEventListener('pointerup', finish, true);
  svg.addEventListener('pointercancel', finish, true);
  svg.addEventListener('lostpointercapture', finish, true);
  svg.addEventListener('pointerleave', e => { if (!barricadeTool.stroke && e.pointerType === 'mouse') clearBarricadeHighlight(); });
})();
