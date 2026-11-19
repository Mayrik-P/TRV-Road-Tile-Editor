// ===== js/keyboard.js — Clavier (tranche 2d) : curseur aux flèches, lettres pour choisir et
// poser un type de case, Entrée / Espace pour poser, Suppr pour effacer, « ? » pour l'aide.
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés dans l'ordre fixe des <script> de index.html (seule référence).
// Le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré dans
// ce fichier ou dans les précédents ; les fonctions, appelées plus tard, voient tout.
//
// Réécriture de la PR #2 de ChessMess (keyboard-navigation), dont on garde le principe :
//   - flèches : un curseur (contour cyan) se déplace de case en case, bloqué aux bords ;
//     caché jusqu'au premier appui, il se cache dès que la souris passe sur le plateau ;
//   - le curseur est « la dernière case touchée », quel que soit le moyen (survol, clic,
//     pinceau, clavier) : les touches agissent toujours là où l'on vient d'agir ;
//   - lettre = choisir ET poser le type de case dont le nom commence par elle ; répétée
//     sur la même case, elle fait défiler les types qui partagent cette lettre (R : Ramp ->
//     Road -> Road + Hazard -> Road + Oil) ; sur une autre case, elle repose le choix en
//     cours (s'il commence par cette lettre) ;
//   - Entrée = poser le type choisi (comme un clic : visuel suivant d'une case à
//     variantes) ;
//   - rien pendant la saisie dans un champ, avec Ctrl / Cmd / Alt, ni sur l'accueil ;
//     le curseur n'apparaît jamais dans l'export.
// Changements par rapport à la PR (docs/roadmap.md, § 2) : Échap n'annule plus la case
// (le vrai Ctrl+Z de js/history.js s'en charge) et ferme l'aide ; le curseur suit le
// signal unique de state.js au lieu de crochets ajoutés dans le code ; ajouts courants
// des éditeurs : Espace (comme Entrée), Suppr / Retour arrière (case remise en
// DEFAULT_TILE), « ? » (panneau des raccourcis, usage de Gmail, GitHub, Figma).

const kb = { cursorIdx: 0, visible: false, lastLetter: null, lastLetterIdx: -1, lastLetterCell: -1 };

function resetKeyboardNav() {
  kb.cursorIdx = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2);
  kb.visible = false;
  kb.lastLetter = null; kb.lastLetterIdx = -1; kb.lastLetterCell = -1;
}
resetKeyboardNav();

// Calque du curseur, tout en haut du plateau (créé par buildBoard, jamais exporté).
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

// Le curseur suit toute modification d'une case (clic, pinceau, clavier) et se recentre
// à chaque nouveau plateau / restauration (dimensions possiblement changées).
boardEvents.addEventListener('change', e => {
  const r = e.detail.reason;
  if (r === 'cell') { kb.cursorIdx = e.detail.idx; renderCursor(); }
  else if (r === 'new-board' || r === 'restore') {
    if (kb.cursorIdx >= COLS * ROWS) resetKeyboardNav();
    if (r === 'new-board') resetKeyboardNav();
    renderCursor();
  }
});

// Survol à la souris : le curseur suit la case survolée et se cache.
document.getElementById('bsvg').addEventListener('pointerover', e => {
  const t = e.target;
  if (!t.dataset || t.dataset.idx === undefined || !t.parentNode || t.parentNode.id !== 'layer-hits') return;
  kb.cursorIdx = parseInt(t.dataset.idx);
  if (kb.visible && e.pointerType === 'mouse') { kb.visible = false; renderCursor(); }
});

function handleLetter(letter) {
  const matches = TILES.filter(t => t.label[0].toLowerCase() === letter);
  if (!matches.length) return false;
  // Défilement des types de même lettre seulement en restant sur la même case ; ailleurs,
  // on repart du type déjà choisi (clic dans la palette compris), sinon du premier.
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

// ---- Panneau des raccourcis (« ? ») ----
// Le type d'un plateau neuf y est lu dans DEFAULT_TILE, comme dans le texte du Reset.
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
  const el = document.activeElement;
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (helpOpen) return;

  if (e.key === '?') { e.preventDefault(); toggleShortcutHelp(true); return; }
  const DELTA = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (e.key in DELTA) {
    e.preventDefault();
    if (!kb.visible) { showCursorAt(kb.cursorIdx); return; } // 1er appui : montrer le curseur là où il est
    const [dr, dc] = DELTA[e.key];
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor(kb.cursorIdx / COLS) + dr));
    const col = Math.min(COLS - 1, Math.max(0, kb.cursorIdx % COLS + dc));
    showCursorAt(row * COLS + col);
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault(); // un bouton qui a le focus ne doit pas se déclencher en plus
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
  if (e.key.length === 1 && /[a-z]/i.test(e.key) && handleLetter(e.key.toLowerCase())) e.preventDefault();
});
