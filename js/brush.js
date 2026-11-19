// ===== js/brush.js — Pinceau (tranche 2b) : appuyer puis glisser pour peindre plusieurs
// cases, à la souris, au stylet ou au doigt.
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés dans l'ordre fixe des <script> de index.html (seule référence).
// Le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré dans
// ce fichier ou dans les précédents ; les fonctions, appelées plus tard, voient tout.
//
// Méthode recommandée par MDN / W3C pour les outils de dessin : Pointer Events (un seul
// code pour souris, stylet et doigt), capture du pointeur sur le plateau
// (setPointerCapture) à l'appui, puis à chaque mouvement la case sous le pointeur
// (elementFromPoint : forme exacte des cases en chevron), en ne peignant que lorsqu'elle
// change. Les points intermédiaires d'un geste rapide sont repris (événements
// « coalescés » + points intercalés) pour ne sauter aucune case.
//
// Règles :
//   - un coup de pinceau = une seule étape d'annulation (beginAction / endAction) ;
//   - la première case se comporte comme un clic : recliquer une case Impassable / Fire /
//     Oil fait défiler son visuel ; en glissant, une case déjà du bon type n'est pas
//     touchée (pas de défilement des visuels sans le vouloir) ;
//   - souris : bouton principal seulement ;
//   - doigt (décision de Mayrik du 19/11) : un doigt peint ; le pincement à deux doigts
//     reste possible (CSS touch-action: pinch-zoom sur #bsvg) — si un 2e doigt se pose
//     pendant un coup de pinceau, celui-ci est annulé (cancelAction) pour ne pas laisser
//     de case peinte au début d'un zoom. Principe documenté par Google pour Android
//     (« Stylus palm rejection » : un toucher non voulu reçoit une annulation, l'appli
//     de dessin annule le dernier trait grâce à son historique).
// Sources : MDN Pointer events et getCoalescedEvents ; démo de dessin du W3C (TPAC 2023) ;
// tracé entre deux positions successives = méthode des éditeurs de pixels (Bresenham).

const brush = { active: false, pointerId: null, pointerType: null, lastIdx: -1, lastX: 0, lastY: 0, hovered: null };
const BRUSH_STEP_PX = 6; // écart maximal entre deux points testés pendant un geste rapide

function hitAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return (el && el.dataset && el.dataset.idx !== undefined && el.parentNode && el.parentNode.id === 'layer-hits') ? el : null;
}

// Surbrillance de la case survolée pendant un geste (la capture du pointeur empêche
// les cases de recevoir leurs propres événements mouseenter / mouseleave).
function setBrushHover(el) {
  if (brush.hovered === el) return;
  if (brush.hovered) brush.hovered.setAttribute('fill', 'transparent');
  brush.hovered = el;
  if (el) el.setAttribute('fill', 'rgba(255,255,255,0.22)');
}

function paintAt(x, y) {
  const hit = hitAt(x, y);
  if (brush.pointerType === 'mouse') setBrushHover(hit);
  if (!hit) return;
  const idx = parseInt(hit.dataset.idx);
  if (idx === brush.lastIdx) return;
  brush.lastIdx = idx;
  if (board[idx] !== sel) updateCell(idx, sel);
}

function endStroke(cancel) {
  if (!brush.active) return;
  const svg = document.getElementById('bsvg');
  try { if (svg.hasPointerCapture(brush.pointerId)) svg.releasePointerCapture(brush.pointerId); } catch (e) {}
  brush.active = false;
  if (brush.pointerType === 'mouse') setBrushHover(hitAt(brush.lastX, brush.lastY));
  else setBrushHover(null);
  if (cancel) cancelAction(); else endAction();
}

(function installBrush() {
  const svg = document.getElementById('bsvg');

  svg.addEventListener('pointerdown', e => {
    // 2e doigt pendant un coup de pinceau : c'est un pincement, on annule le geste.
    if (brush.active) {
      if (e.pointerType === 'touch' && e.pointerId !== brush.pointerId) endStroke(true);
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const hit = hitAt(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault(); // pas de sélection de texte ni de glisser d'image
    // preventDefault empêche aussi le plateau de prendre le focus : on quitte donc
    // nous-mêmes un champ de texte en cours de saisie (pour que Ctrl+Z vise le plateau).
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    Object.assign(brush, { active: true, pointerId: e.pointerId, pointerType: e.pointerType,
                           lastX: e.clientX, lastY: e.clientY });
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
    beginAction();
    const idx = parseInt(hit.dataset.idx);
    brush.lastIdx = idx;
    if (brush.pointerType === 'mouse') setBrushHover(hit);
    updateCell(idx, sel); // 1re case = un clic (fait défiler le visuel d'une case à variantes)
  });

  svg.addEventListener('pointermove', e => {
    if (!brush.active || e.pointerId !== brush.pointerId) return;
    const points = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const pt of (points.length ? points : [e])) {
      const dx = pt.clientX - brush.lastX, dy = pt.clientY - brush.lastY;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / BRUSH_STEP_PX));
      for (let i = 1; i <= steps; i++) paintAt(brush.lastX + dx * i / steps, brush.lastY + dy * i / steps);
      brush.lastX = pt.clientX; brush.lastY = pt.clientY;
    }
  });

  const finish = e => { if (brush.active && e.pointerId === brush.pointerId) endStroke(e.type === 'pointercancel'); };
  svg.addEventListener('pointerup', finish);
  svg.addEventListener('pointercancel', finish);
  svg.addEventListener('lostpointercapture', finish);
})();
