// ===== js/undoHistory.js — Undo / Redo (slice 2a): history of board snapshots,
// Undo / Redo buttons, Ctrl+Z / Ctrl+Y shortcuts (Cmd on Mac).
//
// Classic script (not a module): all js/ files share the same global scope
// and are loaded in the fixed order of the <script> tags in index.html (the only reference).
// Code run when a file loads can only use what is declared in
// that file or the previous ones; functions, called later, see everything.
//
// Method: history by snapshots — after each change,
// a full snapshot of the board (getBoardState, ~1 KB); undo = put back the previous
// snapshot (setBoardState). The board only has 24 to 48 cells: this is the simplest
// and safest solution (same principle as Excalidraw), with no need to write
// the inverse of each action. The history subscribes to the single signal of state.js: nothing
// to add elsewhere when a new action appears.
//
// Groupings (a single undo step):
//   - typing in the board name or number: successive letters are merged;
//   - gesture made of several changes (future brush stroke): beginAction() /
//     endAction() around the gesture.
// Not undoable: the custom title image (outside the snapshot, too heavy).

const HISTORY_LIMIT = 200;
const undoHistory = { past: [], future: [], current: null, lastReason: null, applying: false, batch: 0, batchDirty: false,
                      actionKind: null, actionSeq: 0 };

function sameState(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// Records the current state as a new step (or merges it with the previous one).
function recordState(reason) {
  const snap = getBoardState();
  if (undoHistory.current && sameState(snap, undoHistory.current)) return;
  const merge = undoHistory.current && (reason === 'title' || reason === 'number') && reason === undoHistory.lastReason;
  if (undoHistory.current && !merge) {
    undoHistory.past.push(undoHistory.current);
    if (undoHistory.past.length > HISTORY_LIMIT) undoHistory.past.shift();
  }
  undoHistory.current = snap;
  undoHistory.future = [];
  undoHistory.lastReason = reason;
  updateHistoryButtons();
}

boardEvents.addEventListener('change', e => {
  const reason = e.detail.reason;
  // Restoration coming from elsewhere (save, file): new starting point.
  if (reason === 'restore' && !undoHistory.applying) { setHistoryBaseline(getBoardState()); return; }
  if (undoHistory.applying || reason === 'restore' || reason === 'title-image') return;
  if (undoHistory.batch > 0) { undoHistory.batchDirty = true; return; }
  recordState(reason);
});

// History emptied, with this state as the starting point (restoration, or the current board
// before "new board" from the home screen: autosave.js).
function setHistoryBaseline(state) {
  undoHistory.past = []; undoHistory.future = [];
  undoHistory.current = state; undoHistory.lastReason = null;
  updateHistoryButtons();
}

// Gesture made of several changes (brush stroke…): a single undo step.
// kind ('brush', 'clear'…) and actionSeq (gesture number) can be read during the gesture, for
// example by the sounds (js/sounds.js): 1st cell of a brush stroke, whole "Clear board".
function beginAction(kind) {
  if (undoHistory.batch === 0) { undoHistory.actionSeq++; undoHistory.actionKind = kind || null; }
  undoHistory.batch++;
}
function endAction() {
  if (undoHistory.batch === 0) return;
  undoHistory.batch--;
  if (undoHistory.batch === 0 && undoHistory.batchDirty) { undoHistory.batchDirty = false; recordState('action'); }
}

// Interrupted gesture (2nd finger of a pinch…): the board goes back to its state before the
// gesture, without leaving a step in the history.
function cancelAction() {
  if (undoHistory.batch === 0) return;
  const dirty = undoHistory.batchDirty;
  undoHistory.batch = 0;
  undoHistory.batchDirty = false;
  if (dirty) applyHistoryState(undoHistory.current);
}

function applyHistoryState(s) {
  undoHistory.applying = true;
  try { setBoardState(s); } finally { undoHistory.applying = false; }
  undoHistory.current = s;
  undoHistory.lastReason = null;
  updateHistoryButtons();
}

function undo() {
  if (!undoHistory.past.length || undoHistory.batch > 0) return;
  undoHistory.future.push(undoHistory.current);
  applyHistoryState(undoHistory.past.pop());
}

function redo() {
  if (!undoHistory.future.length || undoHistory.batch > 0) return;
  undoHistory.past.push(undoHistory.current);
  applyHistoryState(undoHistory.future.pop());
}

function updateHistoryButtons() {
  const u = document.getElementById('undo-btn'), r = document.getElementById('redo-btn');
  if (u) u.disabled = undoHistory.past.length === 0;
  if (r) r.disabled = undoHistory.future.length === 0;
}

// Standard shortcuts: Ctrl+Z / Cmd+Z undo; Ctrl+Y, Ctrl+Shift+Z, Cmd+Shift+Z redo.
// Ignored on the home screen and while typing in a text field (which keeps
// its own undo) — precautions taken from ChessMess's PR #2.
window.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  if (document.getElementById('board-type-picker').style.display !== 'none') return;
  if (!document.getElementById('export-dialog').hidden) return; // export dialog open
  const el = document.activeElement;
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
});
