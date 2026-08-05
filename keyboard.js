// ---- Keyboard navigation: arrows move a highlighted cursor around the grid,
// letters select+paint a tile type (first letter of its label, repeat on the
// same cell to cycle ties, press again on a new cell to repeat the selection),
// Enter re-applies the active brush to the cursor cell (same as a click,
// cycles overlay variants), Escape reverts the cursor cell to its value from
// before its last change. Hidden until the first arrow key press; hides again
// once the mouse moves over a tile.
//
// cursorIdx is a single continuously-tracked "last cell touched by any input"
// position — mouse hover and mouse clicks move it just like arrow keys do, not
// just the keydown handler. That's what lets Escape/Enter/letter keys always
// act on whatever cell you most recently interacted with, whether by mouse or
// keyboard, instead of a stale keyboard-only position drifting out of sync
// with mouse-driven edits. It starts at the board's center (set by
// resetKeyboardNavState()) so the first-ever arrow press has somewhere sane to
// reveal from.
//
// Loaded via <script src="keyboard.js"> BEFORE index.html's inline <script>,
// so this file's own top-level code can't depend on that script's state
// (COLS/ROWS/board/sel/TILES) — only the callbacks below may, since those run
// later, well after both scripts have finished loading. index.html calls back
// into this file at three points: renderCursor() (from buildBoard()),
// recordPlacement() (from updateCell()), recordHover() (from the hit-polygon
// mouseenter handler), and resetKeyboardNavState() (from chooseBoardType()).

let cursorIdx = 0;                              // keyboard-cursor cell, row*COLS+col — kept in sync by hover/click/arrows alike
let cursorVisible = false;                      // hidden until an arrow key is pressed, hides again on mouse hover
let prevValue = [];                             // per-cell value-before-last-change (single-level undo), sized in resetKeyboardNavState()
let lastHotkeyLetter = null;                    // last letter key pressed, for cycling ties
let lastHotkeyIdx = -1;                         // index into that letter's TILES matches
let lastHotkeyCell = -1;                        // cell that press landed on — cycling only continues while you stay put

// Called from chooseBoardType() — board dimensions may have just changed, so
// prevValue is (re)sized here rather than at top level.
function resetKeyboardNavState() {
  cursorIdx = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2);
  cursorVisible = false;
  prevValue = Array(COLS * ROWS).fill(null);
  lastHotkeyLetter = null;
  lastHotkeyIdx = -1;
  lastHotkeyCell = -1;
}

// Called from updateCell() — every edit, mouse or keyboard, moves the cursor here.
function recordPlacement(idx, oldType) {
  prevValue[idx] = oldType;
  cursorIdx = idx;
}

// Called from the hit-polygon mouseenter handler.
function recordHover(idx) {
  cursorIdx = idx;
  if (cursorVisible) { cursorVisible = false; renderCursor(); }
}

// ---- Keyboard cursor highlight — topmost layer, never part of the exported PNG ----
function renderCursor() {
  const g = document.getElementById('layer-cursor');
  while (g.firstChild) g.removeChild(g.firstChild);
  if (!cursorVisible) return;
  const row = Math.floor(cursorIdx / COLS), col = cursorIdx % COLS;
  g.appendChild(mkEl('polygon', {
    points: pts2s(cellPoly(col, row)),
    fill: 'none', stroke: '#00e5ff', 'stroke-width': '10',
    'stroke-linejoin': 'round', 'pointer-events': 'none'
  }));
}

window.addEventListener('keydown', function (e) {
  // Board not chosen yet (first visit, #bsvg has no layers) or the Reset picker
  // is showing again over a live board underneath (its overlay blocks mouse
  // edits but not key events) — board-type-picker's inline style is the flag
  // chooseBoardType()/resetBoard() already toggle themselves. Check '!== none',
  // not '=== flex': on first load no inline style is set yet, so .style.display
  // reads '' even though the CSS default makes it visible.
  if (document.getElementById('board-type-picker').style.display !== 'none') return;

  const el = document.activeElement;
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const DELTA = {ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]};
  if (e.key in DELTA) {
    e.preventDefault();
    cursorVisible = true;
    const [dr, dc] = DELTA[e.key];
    const row = Math.floor(cursorIdx / COLS), col = cursorIdx % COLS;
    const newRow = Math.min(ROWS - 1, Math.max(0, row + dr));
    const newCol = Math.min(COLS - 1, Math.max(0, col + dc));
    cursorIdx = newRow * COLS + newCol;
    renderCursor();
    return;
  }
  if (e.key === 'Escape') {
    const prev = prevValue[cursorIdx];
    if (prev !== null) updateCell(cursorIdx, prev);
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault(); // stop a focused button (Export/Reset/Load image) from double-firing
    updateCell(cursorIdx, sel);
    return;
  }
  if (e.key.length === 1 && /[a-z]/i.test(e.key)) handleLetterKey(e.key.toLowerCase());
});

function handleLetterKey(letter) {
  const matches = TILES.filter(t => t.label[0].toLowerCase() === letter);
  if (!matches.length) return;
  // Cycling ties only continues while you stay on the same cell: R,R,R walks
  // Ramp -> Road -> Road + Hazard in place. Move the cursor and press R again
  // and you want that same Road + Hazard stamped down, not the next tie — so on
  // a new cell we resume from whatever is currently selected (matched by id, so
  // a palette click counts too), falling back to the first tie when the
  // selection isn't one of this letter's.
  const cycling = letter === lastHotkeyLetter && cursorIdx === lastHotkeyCell;
  lastHotkeyIdx = cycling
    ? (lastHotkeyIdx + 1) % matches.length
    : Math.max(0, matches.findIndex(t => t.id === sel));
  lastHotkeyLetter = letter;
  lastHotkeyCell = cursorIdx;
  const tile = matches[lastHotkeyIdx];
  selectTileType(tile.id);
  updateCell(cursorIdx, tile.id);
}
