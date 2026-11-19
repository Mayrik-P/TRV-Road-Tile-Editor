// ===== js/undoHistory.js — Annuler / Rétablir (tranche 2a) : historique par photos du plateau,
// boutons Undo / Redo, raccourcis Ctrl+Z / Ctrl+Y (Cmd sur Mac).
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés dans l'ordre fixe des <script> de index.html (seule référence).
// Le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré dans
// ce fichier ou dans les précédents ; les fonctions, appelées plus tard, voient tout.
//
// Méthode : historique par instantanés (« snapshots ») — après chaque modification,
// une photo complète du plateau (getBoardState, ~1 Ko) ; annuler = remettre la photo
// précédente (setBoardState). Le plateau ne fait que 24 à 48 cases : c'est la solution
// la plus simple et la plus sûre (même principe qu'Excalidraw), sans avoir à écrire
// l'inverse de chaque action. L'historique s'abonne au signal unique de state.js : rien
// à ajouter ailleurs quand une nouvelle action apparaîtra.
//
// Regroupements (une seule étape d'annulation) :
//   - frappe dans le nom ou le numéro du plateau : lettres successives fusionnées ;
//   - geste en plusieurs modifications (futur coup de pinceau) : beginAction() /
//     endAction() autour du geste.
// Non annulable : l'image de titre personnalisée (hors de la photo, trop lourde).

const HISTORY_LIMIT = 200;
const undoHistory = { past: [], future: [], current: null, lastReason: null, applying: false, batch: 0, batchDirty: false };

function sameState(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// Enregistre l'état actuel comme nouvelle étape (ou le fusionne avec la précédente).
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
  if (undoHistory.applying || reason === 'restore' || reason === 'title-image') return;
  if (undoHistory.batch > 0) { undoHistory.batchDirty = true; return; }
  recordState(reason);
});

// Geste en plusieurs modifications (coup de pinceau…) : une seule étape d'annulation.
function beginAction() { undoHistory.batch++; }
function endAction() {
  if (undoHistory.batch === 0) return;
  undoHistory.batch--;
  if (undoHistory.batch === 0 && undoHistory.batchDirty) { undoHistory.batchDirty = false; recordState('action'); }
}

// Geste interrompu (2e doigt d'un pincement…) : le plateau revient à l'état d'avant le
// geste, sans laisser d'étape dans l'historique.
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

// Raccourcis standard : Ctrl+Z / Cmd+Z annuler ; Ctrl+Y, Ctrl+Maj+Z, Cmd+Maj+Z rétablir.
// Ignorés sur l'écran d'accueil et pendant la saisie dans un champ de texte (qui garde
// sa propre annulation) — précautions reprises de la PR #2 de ChessMess.
window.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  if (document.getElementById('board-type-picker').style.display !== 'none') return;
  const el = document.activeElement;
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
});
