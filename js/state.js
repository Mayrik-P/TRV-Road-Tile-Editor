// ===== js/state.js — Board state: full snapshot (getBoardState), restoration
// (setBoardState) and the single "the board changed" signal (boardEvents).
//
// Classic script (not a module): all js/ files share the same global scope
// and are loaded in the fixed order of the <script> tags in index.html (the only reference).
// Code run when a file loads can only use what is declared in
// that file or the previous ones; functions, called later, see everything.
//
// Slice 0c (docs/roadmap.md). Every board change goes through a single entry
// point (updateCell for a cell, chooseBoardType for a new board,
// setBoardState for a restoration, the fields and the title image) which then emits
// ONE "change" signal on boardEvents. Proven method: the "observer" pattern, using
// the browser's native EventTarget (no library). Undo/Redo, autosave
// and sounds only have to subscribe:
//   boardEvents.addEventListener('change', e => { … e.detail.reason … });
// Reasons emitted: 'cell' (detail: idx, oldType, newType), 'new-board', 'restore',
// 'title', 'number', 'title-image', 'decor' (js/decor.js), 'barricade' (js/barricades.js).

const boardEvents = new EventTarget();

function notifyBoardChange(reason, extra) {
  boardEvents.dispatchEvent(new CustomEvent('change', { detail: Object.assign({ reason }, extra) }));
}

// Snapshot format version: to be increased (with a conversion of the old ones) the
// day its content changes — free decorations, barricades… (lesson from TRV-Pocket:
// a save must always be readable by later versions).
const BOARD_STATE_VERSION = 3; // 2 (phase 7): free decorations; 3 (phase 8): barricades

// Conversion of snapshots from a previous version (browser save, project file),
// to be called before validateBoardState. Version 1: automatically placed decorations, removed in
// phase 7; Mayrik does not need to get them back (22/11): the board opens without decorations.
// Version 2: no barricades yet. Conversions are chained (1 -> 2 -> 3).
function upgradeBoardState(s) {
  if (s && typeof s === 'object' && s.version === 1) s = Object.assign({}, s, { version: 2, decorations: [] });
  if (s && typeof s === 'object' && s.version === 2) s = Object.assign({}, s, { version: 3, barricades: [] });
  return s;
}

// Full, independent snapshot (deep copy, convertible to JSON) of everything
// the user has chosen. The custom title image is not part of it:
// too heavy for a snapshot taken at every click, it is handled separately (IndexedDB,
// Phase 4 of the plan).
function getBoardState() {
  return {
    version: BOARD_STATE_VERSION,
    boardType: BOARD_TYPE,
    board: board.slice(),
    cellVariant: cellVariant.slice(),
    overlayCycleIndex: Object.assign({}, overlayCycleIndex),
    titleName: document.getElementById('title-input').value,
    boardNumber: document.getElementById('board-number-input').value,
    decorations: decorations.map(d => ({ item: d.item, x: d.x, y: d.y })),
    barricades: barricades.slice(),
  };
}

// Checks that a snapshot (coming from a save, a file…) is usable:
// returns an error message, or null if it is valid.
function validateBoardState(s) {
  if (!s || typeof s !== 'object') return 'not an object';
  if (s.version !== BOARD_STATE_VERSION) return 'unknown version ' + s.version;
  const type = BOARD_TYPES[s.boardType];
  if (!type) return 'unknown board type ' + s.boardType;
  const n = type.cols * ROWS;
  if (!Array.isArray(s.board) || s.board.length !== n) return 'wrong number of spaces';
  if (!s.board.every(id => TILES.some(t => t.id === id))) return 'unknown space type';
  if (!Array.isArray(s.cellVariant) || s.cellVariant.length !== n) return 'wrong variant list';
  if (!Array.isArray(s.decorations) || !s.decorations.every(d => d && Number.isInteger(d.item)
      && d.item >= 1 && d.item <= ITEM_PATHS.length && Number.isFinite(d.x) && Number.isFinite(d.y))) return 'bad decorations';
  const keys = validBarricadeKeys(type.cols);
  if (!Array.isArray(s.barricades) || !s.barricades.every(k => keys.has(k))
      || new Set(s.barricades).size !== s.barricades.length) return 'bad barricades';
  return null;
}

// Puts the board back exactly in the state of a snapshot, then emits 'restore'.
// Throws an error if the snapshot is not valid (nothing is modified then).
function setBoardState(s) {
  const err = validateBoardState(s);
  if (err) throw new Error('Invalid board state: ' + err);
  applyBoardType(s.boardType);
  board = s.board.slice();
  cellVariant = s.cellVariant.slice();
  decorations = s.decorations.map(d => ({ item: d.item, x: d.x, y: d.y }));
  barricades = s.barricades.slice().sort(compareBarricadeKeys);
  decor.selected = -1; // js/decor.js
  overlayCycleIndex = Object.assign({ rock: 0, fire: 0, oil: 0 }, s.overlayCycleIndex);
  document.getElementById('title-input').value = s.titleName || '';
  document.getElementById('board-number-input').value = s.boardNumber || '';
  refreshTitleCounter();
  showEditor();
  notifyBoardChange('restore');
}
