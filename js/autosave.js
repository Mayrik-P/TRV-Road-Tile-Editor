// ===== js/autosave.js — Sauvegarde automatique dans le navigateur et bouton « Continue » de
// l'écran d'accueil (tranches 4a + 4b).
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés dans l'ordre fixe des <script> de index.html (seule référence).
// Le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré dans
// ce fichier ou dans les précédents ; les fonctions, appelées plus tard, voient tout.
//
// D'après la PR #1 de ChessMess (persist-road-tile-state), réévaluée (docs/roadmap.md § 2) :
//   - le plateau (photo getBoardState, ~1 Ko, champ version) va dans localStorage, à chaque
//     modification : l'abonnement au signal unique de state.js suffit, aucun crochet ailleurs ;
//   - l'image de titre personnalisée va dans IndexedDB (bibliothèque idb-keyval de Jake
//     Archibald, js/vendor/) : localStorage est limité à ~5 Mo et une grande image n'y aurait
//     pas été sauvegardée, sans prévenir (limite signalée par l'auteur de la PR) ;
//   - à l'ouverture, la page ne saute plus l'écran d'accueil : elle y propose « Continue »
//     (modèle des jeux et de l'accueil de TRV-Pocket) ;
//   - choisir un nouveau plateau alors qu'il y en avait un : Ctrl+Z ramène l'ancien
//     (setHistoryBaseline) — seule l'image de titre personnalisée n'est pas rétablie ;
//   - tout accès au stockage est protégé (navigation privée, stockage interdit : l'appli
//     marche, sans sauvegarde) ; une sauvegarde abîmée ou d'une version inconnue est ignorée.

const AUTOSAVE_KEY = 'trv_road_tile_board_v1';
const TITLE_IMAGE_KEY = 'trv_road_tile_title_image_v1';
const autosave = { restoringTitle: false };

function readSavedBoard() {
  try {
    const s = JSON.parse(localStorage.getItem(AUTOSAVE_KEY));
    return validateBoardState(s) === null ? s : null;
  } catch (e) { return null; }
}

function writeSavedBoard() {
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(getBoardState())); } catch (e) {}
}

// IndexedDB indisponible (ancien navigateur, stockage interdit) : on continue sans.
function titleStore(fn) {
  try { return (typeof idbKeyval !== 'undefined' ? fn(idbKeyval) : Promise.resolve()).catch(() => {}); }
  catch (e) { return Promise.resolve(); }
}

boardEvents.addEventListener('change', e => {
  const reason = e.detail.reason;
  if (reason === 'title-image') {
    if (autosave.restoringTitle) return; // image qu'on est justement en train de relire
    const custom = TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE;
    titleStore(db => custom ? db.set(TITLE_IMAGE_KEY, TITLE_IMAGE.src) : db.del(TITLE_IMAGE_KEY));
    return;
  }
  writeSavedBoard();
});

// ---- Écran d'accueil : bouton « Continue » ----
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
  // Retour depuis « Home » : le plateau est déjà en mémoire (identique à la sauvegarde) —
  // on rouvre simplement l'éditeur, son historique d'annulation reste intact.
  if (undoHistory.current && JSON.stringify(getBoardState()) === JSON.stringify(saved)) { showEditor(); return; }
  setBoardState(saved); // affiche l'éditeur ; 'restore' devient le point de départ de l'historique
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

// Nouveau plateau depuis l'accueil. S'il y avait un plateau en cours (sauvegardé) et que
// l'historique de cette page est vide (page tout juste ouverte), ce plateau devient le point
// de départ de l'historique : Ctrl+Z après « nouveau plateau » le ramène.
function startNewBoard(type) {
  const saved = readSavedBoard();
  if (saved && !undoHistory.current) setHistoryBaseline(saved);
  // Nouveau plateau = image de titre par défaut (sa taille idéale dépend du format ; même
  // règle que l'ancien « Reset road tile »). Non rétablie par Ctrl+Z (hors de la photo).
  if (TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE) resetTitleImage();
  chooseBoardType(type);
}

refreshContinueButton();
