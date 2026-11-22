// ===== js/state.js — État du plateau : photo complète (getBoardState), restauration
// (setBoardState) et signal unique « le plateau a changé » (boardEvents).
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés dans l'ordre fixe des <script> de index.html (seule référence).
// Le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré dans
// ce fichier ou dans les précédents ; les fonctions, appelées plus tard, voient tout.
//
// Tranche 0c (docs/roadmap.md). Toute modification du plateau passe par un point
// d'entrée unique (updateCell pour une case, chooseBoardType pour un nouveau plateau,
// setBoardState pour une restauration, les champs et l'image de titre) qui émet ensuite
// UN signal « change » sur boardEvents. Méthode éprouvée : patron « observateur », avec
// l'EventTarget natif du navigateur (pas de bibliothèque). Annuler/Rétablir, sauvegarde
// automatique et sons n'auront qu'à s'abonner :
//   boardEvents.addEventListener('change', e => { … e.detail.reason … });
// Raisons émises : 'cell' (detail : idx, oldType, newType), 'new-board', 'restore',
// 'title', 'number', 'title-image'.

const boardEvents = new EventTarget();

function notifyBoardChange(reason, extra) {
  boardEvents.dispatchEvent(new CustomEvent('change', { detail: Object.assign({ reason }, extra) }));
}

// Version du format de la photo : à augmenter (avec une conversion des anciennes) le
// jour où son contenu change — décorations libres, barricades… (leçon de TRV-Pocket :
// une sauvegarde doit toujours pouvoir être relue par les versions suivantes).
const BOARD_STATE_VERSION = 2; // 2 (phase 7) : décorations libres

// Conversion des photos d'une version précédente (sauvegarde du navigateur, fichier de projet),
// à appeler avant validateBoardState. Version 1 : décorations posées automatiquement, retirées en
// phase 7 ; Mayrik n'a pas besoin de les retrouver (22/11) : le plateau s'ouvre sans décoration.
function upgradeBoardState(s) {
  if (s && typeof s === 'object' && s.version === 1) return Object.assign({}, s, { version: 2, decorations: [] });
  return s;
}

// Photo complète et indépendante (copie profonde, convertible en JSON) de tout ce
// que l'utilisateur a choisi. L'image de titre personnalisée n'en fait pas partie :
// trop lourde pour une photo prise à chaque clic, elle sera gérée à part (IndexedDB,
// Phase 4 du plan).
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
  };
}

// Vérifie qu'une photo (venue d'une sauvegarde, d'un fichier…) est utilisable :
// renvoie un message d'erreur, ou null si elle est valable.
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
  return null;
}

// Remet le plateau exactement dans l'état d'une photo, puis émet 'restore'.
// Lève une erreur si la photo n'est pas valable (rien n'est alors modifié).
function setBoardState(s) {
  const err = validateBoardState(s);
  if (err) throw new Error('Invalid board state: ' + err);
  applyBoardType(s.boardType);
  board = s.board.slice();
  cellVariant = s.cellVariant.slice();
  decorations = s.decorations.map(d => ({ item: d.item, x: d.x, y: d.y }));
  decor.selected = -1; // js/decor.js
  overlayCycleIndex = Object.assign({ rock: 0, fire: 0, oil: 0 }, s.overlayCycleIndex);
  document.getElementById('title-input').value = s.titleName || '';
  document.getElementById('board-number-input').value = s.boardNumber || '';
  refreshTitleCounter();
  showEditor();
  notifyBoardChange('restore');
}
