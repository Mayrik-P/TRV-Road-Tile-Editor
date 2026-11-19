// ===== js/ui.js — Interface : ajustement du titre de l'appli à la largeur de l'écran, choix du
// format de plateau (écran d'accueil).
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés dans l'ordre fixe des <script> de index.html (seule référence).
// Le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré dans
// ce fichier ou dans les précédents ; les fonctions, appelées plus tard, voient tout.

// Le bloc titre+sous-titre (.app-title-stack) a une taille de police fixe en px
// (calibrée pour le contour/l'ombrage, voir CSS) — sur un écran étroit ça peut
// déborder. On mesure sa largeur réelle après rendu et on le réduit avec un
// simple scale() global si besoin (préserve exactement les proportions
// contour/ombrage/skew déjà calibrées, contrairement à changer le font-size).
// --fit-scale est une variable CSS lue par le transform de chaque contexte
// (#title-band / #picker-title-band), donc l'échelle ne casse ni le translateX
// de recentrage ni le skewX propre à chaque texte (transforms indépendants,
// appliqués à des éléments différents).
// transform:scale() ne change QUE le rendu visuel, jamais la taille de mise en
// page — sans compensation, la bande grise autour (#title-band, qui se
// dimensionne sur la mise en page) resterait à sa hauteur d'origine même avec
// un titre visuellement réduit, laissant un vide disproportionné sur petit
// écran. On compense avec une marge basse négative calculée (transform-origin
// de .app-title-stack est "center top", donc le rétrécissement libère de
// l'espace en BAS de la boîte — margin-bottom négatif = solution 100% standard,
// sans dépendre d'une propriété CSS non-standard comme zoom.
function fitTitleStack(stack, getAvailableWidth) {
  if (!stack) return;
  stack.style.setProperty('--fit-scale', '1');
  stack.style.marginBottom = '0px';
  const availableWidth = getAvailableWidth();
  const rect = stack.getBoundingClientRect();
  const naturalWidth = rect.width;
  const naturalHeight = rect.height;
  const scale = (availableWidth > 0 && naturalWidth > availableWidth)
    ? Math.max(0.3, availableWidth / naturalWidth)
    : 1;
  stack.style.setProperty('--fit-scale', scale.toFixed(4));
  const heightLost = naturalHeight * (1 - scale);
  stack.style.marginBottom = (-heightLost).toFixed(2) + 'px';
}

function fitAllTitleStacks() {
  const SAFETY_MARGIN = 16; // évite que le texte touche pile le bord du conteneur

  const picker = document.getElementById('board-type-picker');
  if (picker && picker.style.display !== 'none') {
    fitTitleStack(picker.querySelector('#picker-title-band .app-title-stack'), () => {
      const cs = getComputedStyle(picker);
      return picker.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - SAFETY_MARGIN;
    });
  }

  const band = document.getElementById('title-band');
  if (band && band.offsetParent !== null) {
    fitTitleStack(band.querySelector('.app-title-stack'), () => {
      const cs = getComputedStyle(band);
      return band.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - SAFETY_MARGIN;
    });
  }
}
window.addEventListener('resize', fitAllTitleStacks);

// Le plateau/la palette ne se construisent qu'une fois le format choisi (voir
// l'écran de sélection Vendetta/Ignition) — pas d'appel direct ici.
// Nouveau plateau vierge (tout en DEFAULT_TILE, Off-Road) du format choisi.
function chooseBoardType(type) {
  applyBoardType(type);
  board = Array(COLS * ROWS).fill(DEFAULT_TILE);
  cellVariant = Array(COLS * ROWS).fill(null);
  overlayCycleIndex = { rock: 0, fire: 0, oil: 0 };
  showEditor();
  notifyBoardChange('new-board');
}

// Géométrie et champs propres à un format (Vendetta / Ignition), sans toucher au
// contenu des cases — partagé par chooseBoardType et setBoardState (state.js).
function applyBoardType(type) {
  BOARD_TYPE = type;
  COLS = BOARD_TYPES[type].cols;
  VW   = BOARD_TYPES[type].vw;
  BANDS = computeBands();
  const rect = computeGameRect();
  GAME_X = rect.x; GAME_Y = rect.y; GAME_W = rect.w; GAME_H = rect.h;
  document.getElementById('bwrap').classList.toggle('board-ignition', type === 'ignition'); // affichage (paper-ui.css)
  setDisplayVariant(); // aperçus adaptés à la taille affichée de ce format (assets.js)
  document.getElementById('name-field-group').style.display = (type === 'vendetta') ? '' : 'none';
  document.getElementById('number-field-group').style.display = (type === 'ignition') ? '' : 'none';
  // Résolution conseillée pour l'image de titre : dépend de la largeur réelle
  // de la bande, qui change selon le format de plateau (GAME_W, déjà recalculé
  // ci-dessus) — la hauteur (456px) ne change jamais (ne dépend que de ROWS).
  const idealW = Math.round(GAME_W), idealH = BANDS[0].bot - BANDS[0].top;
  const idealText = `Ideal size: ${idealW} × ${idealH} px`;
  document.getElementById('title-img-btn').setAttribute('aria-label', idealText);
  document.getElementById('title-img-tooltip').textContent = idealText;
}

// Masque l'écran d'accueil, affiche l'éditeur et (re)dessine palette et plateau.
function showEditor() {
  document.getElementById('board-type-picker').style.display = 'none';
  document.getElementById('app').style.display = '';
  buildPalette();
  buildBoard();
  fitAllTitleStacks();
}
