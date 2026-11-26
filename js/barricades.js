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
// Drawing (slice 8d): in the overlay layer, in its isometric order (rows from top to bottom,
// columns from right to left): a barricade is in front of the cells of the row above it and
// behind those of the row below (whose sprites cover its shadow, which falls on their ground).
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
// and from right to left along the boundary.
function barricadeRank(seg) {
  return seg.row * COLS + COLS - 0.5 + 0.25 * (1 - (seg.x0 + seg.x1) / 2 / VW);
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
