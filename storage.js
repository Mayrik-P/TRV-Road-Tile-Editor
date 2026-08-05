// ---- Persistance locale : le plateau (cases, variantes, cycles d'overlay), le
// nom/numéro de route et l'image de titre personnalisée survivent à un
// rafraîchissement de page, via localStorage.
//
// Chargé via <script src="storage.js"> AVANT le <script> inline de index.html,
// donc le code de premier niveau de ce fichier ne peut PAS dépendre de l'état de
// ce script (BOARD_TYPES, board, TITLE_IMAGE, chooseBoardType…) : seules les
// fonctions ci-dessous le peuvent, puisqu'elles ne s'exécutent qu'ensuite. Les
// deux fichiers sont des scripts classiques (surtout pas type="module") et
// partagent donc la même portée globale — c'est ce qui rend ces références
// possibles.
//
// index.html appelle ici en trois points : saveBoardState() après chaque
// modification (updateCell, applyTitleImage, resetTitleImage, champs nom/numéro,
// chooseBoardType), restoreBoardState() une seule fois tout à la fin du script
// inline, et clearBoardState() depuis resetBoard().

const STORAGE_KEY = 'trv-road-tile-state';

function saveBoardState() {
  try {
    const customTitleImage = TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      boardType: BOARD_TYPE, board, cellVariant, overlayCycleIndex,
      titleName: document.getElementById('title-input').value,
      boardNumber: document.getElementById('board-number-input').value,
      // ponytail: localStorage has a ~5-10MB quota; a large custom title image
      // can silently fail to persist (caught below) — move to IndexedDB if that
      // turns out to matter in practice.
      titleImageSrc: customTitleImage ? TITLE_IMAGE.src : null,
    }));
  } catch (e) {}
}

function loadBoardState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const type = BOARD_TYPES[saved.boardType];
    if (!type || !Array.isArray(saved.board) || saved.board.length !== type.cols * ROWS) return null;
    return saved;
  } catch (e) {
    return null;
  }
}

// Appelé par resetBoard() : sans ça, un rechargement effectué pendant que
// l'écran de choix du format est réaffiché ferait revenir l'ancien plateau.
function clearBoardState() {
  localStorage.removeItem(STORAGE_KEY);
}

// Restaure automatiquement le plateau sauvegardé (s'il existe) au chargement de
// la page, en contournant l'écran de choix Vendetta/Ignition — c'est ce qui fait
// survivre les modifications de cases (et le nom/numéro/image de titre) à un
// rafraîchissement de page. Appelé en toute dernière ligne du script inline de
// index.html : dépend de tout ce qui y est défini au-dessus.
function restoreBoardState() {
  const saved = loadBoardState();
  if (!saved) return;
  // Nom/numéro restaurés AVANT chooseBoardType() : celui-ci sauvegarde l'état
  // en sortie, il faut donc que les champs DOM soient déjà à jour à ce moment
  // pour ne pas réécrire le stockage avec un nom/numéro vide.
  if (saved.titleName) {
    const ti = document.getElementById('title-input');
    ti.value = saved.titleName;
    ti.dispatchEvent(new Event('input'));
  }
  if (saved.boardNumber) {
    const ni = document.getElementById('board-number-input');
    ni.value = saved.boardNumber;
    ni.dispatchEvent(new Event('input'));
  }
  chooseBoardType(saved.boardType, saved);
  if (saved.titleImageSrc) {
    const img = new Image();
    img.onload = function () { applyTitleImage(img); };
    img.src = saved.titleImageSrc;
  }
}
