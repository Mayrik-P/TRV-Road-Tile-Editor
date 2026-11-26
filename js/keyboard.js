// ===== js/keyboard.js — Keyboard (tranche 2d): arrow-key cursor, letters to choose and
// place a tile type, Enter / Space to place, Delete to erase, "?" for help.
//
// Classic script (not a module): all js/ files share the same global scope and are loaded
// in the fixed order of the <script> tags in index.html (the only reference). Code run
// when a file loads can only use what is declared in that file or the previous ones;
// functions, called later, see everything.
//
// Rewrite of ChessMess's PR #2 (keyboard-navigation), whose principle is kept:
//   - arrows: a cursor (cyan outline) moves from cell to cell, blocked at the edges;
//     hidden until the first key press, it hides as soon as the mouse passes over the board;
//   - the cursor is "the last cell touched", whatever the means (hover, click,
//     brush, keyboard): keys always act where one has just acted;
//   - letter = choose AND place the tile type whose name starts with it; repeated
//     on the same cell, it cycles through the types sharing that letter (R: Ramp ->
//     Road -> Road + Hazard -> Road + Oil); on another cell, it places the current
//     choice again (if it starts with that letter);
//   - Enter = place the chosen type (like a click: next visual of a cell with
//     variants);
//   - nothing while typing in a field, with Ctrl / Cmd / Alt, or on the home screen;
//     the cursor never appears in the export.
// Changes compared to the PR (docs/roadmap.md, § 2): Escape no longer undoes the cell
// (the real Ctrl+Z of js/history.js handles that) and closes the help; the cursor follows the
// single signal of state.js instead of hooks added in the code; common additions
// from editors: Space (like Enter), Delete / Backspace (cell put back to
// DEFAULT_TILE), "?" (shortcuts panel, as used by Gmail, GitHub, Figma).
// Phase 8c: B chooses the barricade tool (placed with the mouse or a finger only).

const kb = { cursorIdx: 0, visible: false, lastLetter: null, lastLetterIdx: -1, lastLetterCell: -1 };

function resetKeyboardNav() {
  kb.cursorIdx = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2);
  kb.visible = false;
  kb.lastLetter = null; kb.lastLetterIdx = -1; kb.lastLetterCell = -1;
}
resetKeyboardNav();

// Cursor layer, at the very top of the board (created by buildBoard, never exported).
function renderCursor() {
  const g = document.getElementById('layer-cursor');
  if (!g) return;
  while (g.firstChild) g.removeChild(g.firstChild);
  if (!kb.visible || kb.cursorIdx >= COLS * ROWS) return;
  const row = Math.floor(kb.cursorIdx / COLS), col = kb.cursorIdx % COLS;
  g.appendChild(mkEl('polygon', {
    points: pts2s(cellPoly(col, row)), fill: 'none', stroke: '#00e5ff', 'stroke-width': '12',
    'stroke-linejoin': 'round', 'pointer-events': 'none'
  }));
}

function showCursorAt(idx) { kb.cursorIdx = idx; kb.visible = true; renderCursor(); }

// The cursor follows any modification of a cell (click, brush, keyboard) and recentres
// on every new board / restoration (dimensions possibly changed).
boardEvents.addEventListener('change', e => {
  const r = e.detail.reason;
  if (r === 'cell') { kb.cursorIdx = e.detail.idx; renderCursor(); }
  else if (r === 'new-board' || r === 'restore') {
    if (kb.cursorIdx >= COLS * ROWS) resetKeyboardNav();
    if (r === 'new-board') resetKeyboardNav();
    renderCursor();
  }
});

// Mouse hover: the cursor follows the hovered cell and hides.
document.getElementById('bsvg').addEventListener('pointerover', e => {
  const t = e.target;
  if (!t.dataset || t.dataset.idx === undefined || !t.parentNode || t.parentNode.id !== 'layer-hits') return;
  kb.cursorIdx = parseInt(t.dataset.idx);
  if (kb.visible && e.pointerType === 'mouse') { kb.visible = false; renderCursor(); }
});

function handleLetter(letter) {
  const matches = TILES.filter(t => t.label[0].toLowerCase() === letter);
  if (!matches.length) return false;
  // Cycling through types with the same letter only while staying on the same cell; elsewhere,
  // we start again from the type already chosen (palette click included), otherwise from the first.
  const cycling = letter === kb.lastLetter && kb.cursorIdx === kb.lastLetterCell;
  kb.lastLetterIdx = cycling ? (kb.lastLetterIdx + 1) % matches.length
                             : Math.max(0, matches.findIndex(t => t.id === sel));
  kb.lastLetter = letter; kb.lastLetterCell = kb.cursorIdx;
  const tile = matches[kb.lastLetterIdx];
  selectTileType(tile.id);
  showCursorAt(kb.cursorIdx);
  updateCell(kb.cursorIdx, tile.id);
  return true;
}

// ---- Shortcuts panel ("?") ----
// The type of a new board is read there from DEFAULT_TILE, as in the Reset text.
document.getElementById('help-default-tile').textContent = TILES.find(t => t.id === DEFAULT_TILE).label;
function toggleShortcutHelp(show) {
  const dlg = document.getElementById('shortcut-help');
  const open = show === undefined ? dlg.hidden : show;
  dlg.hidden = !open;
  if (open) document.getElementById('shortcut-help-close').focus();
}

window.addEventListener('keydown', e => {
  const helpOpen = !document.getElementById('shortcut-help').hidden;
  if (helpOpen && (e.key === 'Escape' || e.key === '?')) { e.preventDefault(); toggleShortcutHelp(false); return; }
  if (document.getElementById('board-type-picker').style.display !== 'none') return;
  if (!document.getElementById('export-dialog').hidden) return; // export window open
  if (messageOpen()) return; // message or confirmation open (js/ui.js)
  const el = document.activeElement;
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (helpOpen) return;

  if (e.key === '?') { e.preventDefault(); toggleShortcutHelp(true); return; }
  const DELTA = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (e.key in DELTA) {
    e.preventDefault();
    if (!kb.visible) { showCursorAt(kb.cursorIdx); return; } // 1st key press: show the cursor where it is
    const [dr, dc] = DELTA[e.key];
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor(kb.cursorIdx / COLS) + dr));
    const col = Math.min(COLS - 1, Math.max(0, kb.cursorIdx % COLS + dc));
    showCursorAt(row * COLS + col);
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault(); // a button that has focus must not also trigger
    if (barricadeTool.active) return; // barricade tool: placed with the mouse or a finger only
    showCursorAt(kb.cursorIdx);
    updateCell(kb.cursorIdx, sel);
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    showCursorAt(kb.cursorIdx);
    updateCell(kb.cursorIdx, DEFAULT_TILE);
    return;
  }
  if (e.key === 'b' || e.key === 'B') { e.preventDefault(); selectBarricadeTool(); return; } // no space type starts with B
  if (e.key.length === 1 && /[a-z]/i.test(e.key) && handleLetter(e.key.toLowerCase())) e.preventDefault();
});
