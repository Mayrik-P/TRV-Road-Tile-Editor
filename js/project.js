// ===== js/project.js — .trvtile project file (tranche 4d): "Save project" in the editor,
// "Open project" on the home screen.
//
// Classic script (not a module): all js/ files share the same global scope and are loaded
// in the fixed order of the <script> tags in index.html (the only reference). Code run
// when a file loads can only use what is declared in that file or the previous ones;
// functions, called later, see everything.
//
// Model: the project files of editors (Tiled: .tmx / .tmj in JSON) — a readable file,
// signed (format field) and versioned (formatVersion) so that later versions know how to
// re-read old ones, and self-contained (custom title image embedded). Contents:
//   { format: 'trv-road-tile', formatVersion: 1, app, savedAt,
//     board: getBoardState() (carries its own version), titleImage: data: URL or null }
// Opening a project replaces the current board; if there was one in the page, Ctrl+Z
// brings it back (one step). File rejected without changing anything: not a project, damaged, or
// from a newer version of the editor. Basis of the export to TRV-Pocket (phase 9).

const PROJECT_FORMAT = 'trv-road-tile';
const PROJECT_FORMAT_VERSION = 2; // 2 (phase 7): board snapshot in version 2 (free decorations); 1 converted
const PROJECT_EXT = '.trvtile';

// File name shared by the exported PNG and the project (road name, or Ignition number).
function boardFileBaseName() {
  return BOARD_TYPE === 'ignition'
    ? 'Ignition-' + (document.getElementById('board-number-input').value || '').padStart(3, '0')
    : (document.getElementById('title-input').value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-') || 'RoadTile');
}

function saveProject() {
  const custom = TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE;
  const project = {
    format: PROJECT_FORMAT,
    formatVersion: PROJECT_FORMAT_VERSION,
    app: 'TRV Road Tile Editor',
    savedAt: new Date().toISOString(),
    board: getBoardState(),
    titleImage: custom ? TITLE_IMAGE.src : null,
  };
  const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = boardFileBaseName() + PROJECT_EXT;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// Checks a project read from a file: error message for the user, or null.
function checkProject(p) {
  if (!p || typeof p !== 'object' || p.format !== PROJECT_FORMAT) return 'This file is not a TRV Road Tile Editor project.';
  if (typeof p.formatVersion !== 'number' || p.formatVersion > PROJECT_FORMAT_VERSION)
    return 'This project was saved with a newer version of the editor. Please reload the page to get the latest version.';
  p.board = upgradeBoardState(p.board); // version 1 file: converted (without decorations)
  if (validateBoardState(p.board) !== null) return 'This project file is damaged and cannot be opened.';
  if (p.titleImage != null && !(typeof p.titleImage === 'string' && p.titleImage.startsWith('data:image/')))
    return 'This project file is damaged and cannot be opened.';
  return null;
}

function openProjectFile(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let project = null;
    try { project = JSON.parse(reader.result); } catch (e) {}
    const err = checkProject(project);
    if (err) { warnUser('⚠ ' + err); return; }
    applyProject(project);
  };
  reader.onerror = () => warnUser('⚠ The file could not be read.');
  reader.readAsText(file);
}

function applyProject(project) {
  const previous = undoHistory.current; // board in progress in this page, if there is one
  setBoardState(project.board);         // 'restore': new starting point of the history
  if (previous) { undoHistory.past = [previous]; updateHistoryButtons(); } // Ctrl+Z brings the old one back
  if (project.titleImage) {
    const img = new Image();
    img.onload = () => applyTitleImage(img);
    img.onerror = () => warnUser('⚠ The title image in this project could not be read.');
    img.src = project.titleImage;
  } else if (TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE) {
    resetTitleImage();
  }
}
