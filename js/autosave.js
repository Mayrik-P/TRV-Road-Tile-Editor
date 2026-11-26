// ===== js/autosave.js — Automatic saving in the browser and the "Continue" button of
// the home screen (tranches 4a + 4b).
//
// Classic script (not a module): all js/ files share the same global scope and are loaded
// in the fixed order of the <script> tags in index.html (the only reference). Code run
// when a file loads can only use what is declared in that file or the previous ones;
// functions, called later, see everything.
//
// After ChessMess's PR #1 (persist-road-tile-state), re-evaluated (docs/roadmap.md § 2):
//   - the board (getBoardState snapshot, ~1 KB, version field) goes into localStorage, on every
//     modification: subscribing to the single signal of state.js is enough, no hook elsewhere;
//   - the custom title image goes into IndexedDB (idb-keyval library by Jake
//     Archibald, js/vendor/): localStorage is limited to ~5 MB and a large image would not
//     have been saved there, without warning (limit pointed out by the PR author);
//   - on opening, the page no longer skips the home screen: it offers "Continue" there
//     (modelled on the games and home screen of TRV-Pocket);
//   - choosing a new board when there was one: Ctrl+Z brings the old one back
//     (setHistoryBaseline) — only the custom title image is not restored;
//   - every storage access is guarded (private browsing, storage forbidden: the app
//     works, without saving); a damaged save or one of an unknown version is ignored.

const AUTOSAVE_KEY = 'trv_road_tile_board_v3';        // version 3 snapshot (phase 8: barricades)
const AUTOSAVE_KEY_V2 = 'trv_road_tile_board_v2';     // older saves, re-read and converted if v3 does not
const AUTOSAVE_KEY_V1 = 'trv_road_tile_board_v1';     // exist yet (never deleted: an older page still reads them)
const TITLE_IMAGE_KEY = 'trv_road_tile_title_image_v1';
const autosave = { restoringTitle: false };

function readSavedBoard() {
  try {
    const s = upgradeBoardState(JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || localStorage.getItem(AUTOSAVE_KEY_V2)
      || localStorage.getItem(AUTOSAVE_KEY_V1)));
    return validateBoardState(s) === null ? s : null;
  } catch (e) { return null; }
}

function writeSavedBoard() {
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(getBoardState())); } catch (e) {}
}

// IndexedDB unavailable (old browser, storage forbidden): we carry on without it.
function titleStore(fn) {
  try { return (typeof idbKeyval !== 'undefined' ? fn(idbKeyval) : Promise.resolve()).catch(() => {}); }
  catch (e) { return Promise.resolve(); }
}

boardEvents.addEventListener('change', e => {
  const reason = e.detail.reason;
  if (reason === 'title-image') {
    if (autosave.restoringTitle) return; // image we are in the middle of re-reading
    const custom = TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE;
    titleStore(db => custom ? db.set(TITLE_IMAGE_KEY, TITLE_IMAGE.src) : db.del(TITLE_IMAGE_KEY));
    return;
  }
  writeSavedBoard();
});

// ---- Home screen: "Continue" button ----
function refreshContinueButton() {
  const btn = document.getElementById('board-type-continue');
  const saved = readSavedBoard();
  btn.hidden = !saved;
  document.getElementById('picker-heading').textContent = saved ? 'Continue your road or start a new one' : 'Choose your board format';
  if (!saved) return;
  const type = BOARD_TYPES[saved.boardType].label;
  const name = saved.boardType === 'ignition'
    ? 'No. ' + (saved.boardNumber || '').padStart(3, '0')
    : (saved.titleName || '').trim().toUpperCase() || 'Untitled road';
  document.getElementById('board-type-continue-desc').textContent = `${type} — ${name}`;
}

function continueSavedBoard() {
  const saved = readSavedBoard();
  if (!saved) { refreshContinueButton(); return; }
  // Return from "Home": the board is already in memory (identical to the save) —
  // we simply reopen the editor, its undo history stays intact.
  if (undoHistory.current && JSON.stringify(getBoardState()) === JSON.stringify(saved)) { showEditor(); return; }
  setBoardState(saved); // shows the editor; 'restore' becomes the starting point of the history
  titleStore(db => db.get(TITLE_IMAGE_KEY).then(dataUrl => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return;
    const img = new Image();
    img.onload = () => {
      autosave.restoringTitle = true;
      try { applyTitleImage(img); } finally { autosave.restoringTitle = false; }
    };
    img.src = dataUrl;
  }));
}

// New board from the home screen. If there was a board in progress (saved) and the
// history of this page is empty (page just opened), that board becomes the starting point
// of the history: Ctrl+Z after "new board" brings it back.
function startNewBoard(type) {
  const saved = readSavedBoard();
  if (saved && !undoHistory.current) setHistoryBaseline(saved);
  // New board = default title image (its ideal size depends on the format; same
  // rule as the former "Reset road tile"). Not restored by Ctrl+Z (outside the snapshot).
  if (TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE) resetTitleImage();
  chooseBoardType(type);
}

refreshContinueButton();
