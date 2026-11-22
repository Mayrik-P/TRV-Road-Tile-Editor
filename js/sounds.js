// ===== js/sounds.js — Sons de l'éditeur (phase 6 du plan, docs/roadmap.md).
//
// Sons courts de TRV-Pocket (freesound.org, CC0 ; sounds/CREDITS.md), choisis par Mayrik le 19/11
// sur une page d'écoute. Lecture par howler.js 2.2.4 (js/vendor/, MIT), comme TRV-Pocket :
// Web Audio (latence faible, plusieurs sons à la fois, hauteur variable), déblocage du son au
// premier geste sur téléphone, repli HTML5 Audio ; un fichier manquant donne simplement le silence.
//
// Un seul point de passage : playSound(moment). Trois sources, et aucune autre :
//   1. le signal du plateau (boardEvents, js/state.js) : pose d'une case, coup de pinceau,
//      « Clear board » (le geste entier, lu dans undoHistory.actionKind), Annuler / Rétablir ;
//   2. un seul écouteur de clic pour tous les boutons de la page : son « button », sauf attribut
//      data-sound (« palette », ou « none » quand le bouton a son propre son par le signal) ;
//   3. deux moments sans bouton ni signal : export terminé (js/export.js) et refus (warnUser).
// Coupure du son : bouton haut-parleur de la barre d'outils, choix retenu sur l'appareil.

const SOUND_TABLE = {
  palette: 'sounds/dash-zoom.mp3',       // choix d'un type de case dans la palette
  place:   'sounds/card-flip.mp3',       // pose d'une case (clic, pinceau, clavier)
  undo:    'sounds/tap-back.mp3',        // Annuler / Rétablir
  clear:   'sounds/stamp.mp3',           // « Clear board » confirmé
  export:  { src: 'sounds/finish-flag.mp3', volume: 0.5 }, // export terminé (PNG ou PDF) ; à 50 % (≈ −6 dB) :
                                         // le plus fort et le plus long, il surprenait (Mayrik, 19/11)
  refuse:  'sounds/tap-refuse.mp3',      // fichier ou image refusé, erreur d'export
  button:  'sounds/tap-menu-button.mp3', // autres boutons
};
const SOUND_KEY = 'trv_road_tile_sound_v1'; // 'off' = son coupé ; absent = son allumé
const SOUND_MIN_GAP_MS = 70;  // même son pas plus d'une fois toutes les 70 ms (règle de TRV-Pocket)
const BRUSH_VOLUME = 0.7;     // cases suivantes d'un coup de pinceau : plus discrètes…
const BRUSH_PITCH = 0.08;     // …et hauteur variée de ±8 % (sinon effet « mitraillette »)

const sounds = { howls: {}, lastAt: {}, muted: false, strokeSeq: -1, clearSeq: -1 };
try { sounds.muted = localStorage.getItem(SOUND_KEY) === 'off'; } catch (e) { /* stockage interdit : son allumé */ }

// Sons chargés après la page (ils ne retardent pas les aperçus du plateau) : quelques Ko.
function loadSounds() {
  if (typeof Howl === 'undefined') return; // bibliothèque absente : l'éditeur marche sans son
  Howler.mute(sounds.muted);
  for (const [moment, entry] of Object.entries(SOUND_TABLE)) {
    const { src, volume = 1 } = typeof entry === 'string' ? { src: entry } : entry; // volume propre au son (TRV-Pocket)
    sounds.howls[moment] = new Howl({ src: [src], preload: true });
    sounds.howls[moment].baseVolume = volume;
  }
}

function playSound(moment, opts = {}) {
  const h = sounds.howls[moment];
  if (!h || sounds.muted) return;
  const now = performance.now();
  if (now - (sounds.lastAt[moment] || -Infinity) < SOUND_MIN_GAP_MS) return;
  sounds.lastAt[moment] = now;
  const id = h.play();
  h.volume(h.baseVolume * (opts.volume ?? 1), id);
  h.rate(opts.rate ?? 1, id);
}

// Message d'erreur avec son de refus (remplace alert() pour les refus et les erreurs d'export).
function warnUser(message) {
  playSound('refuse');
  alert(message);
}

// 1. Signal du plateau
boardEvents.addEventListener('change', e => {
  const { reason } = e.detail;
  if (reason === 'restore' && undoHistory.applying) { playSound('undo'); return; }
  if (reason === 'decor') { // décorations (js/decor.js) ; « Clear board » : couvert par son tampon
    if (e.detail.action === 'clear') { // un seul tampon par « Clear board », même si aucune case ne change
      if (sounds.clearSeq !== undoHistory.actionSeq) { sounds.clearSeq = undoHistory.actionSeq; playSound('clear'); }
    } else playSound(e.detail.action === 'remove' ? 'undo' : 'place');
    return;
  }
  if (reason !== 'cell') return;
  const inAction = undoHistory.batch > 0, seq = undoHistory.actionSeq;
  if (inAction && undoHistory.actionKind === 'clear') {
    if (sounds.clearSeq !== seq) { sounds.clearSeq = seq; playSound('clear'); } // un seul tampon
    return;
  }
  if (inAction && undoHistory.actionKind === 'brush') {
    if (sounds.strokeSeq !== seq) { sounds.strokeSeq = seq; sounds.lastAt.place = -Infinity; playSound('place'); return; }
    playSound('place', { volume: BRUSH_VOLUME, rate: 1 - BRUSH_PITCH + Math.random() * 2 * BRUSH_PITCH });
    return;
  }
  playSound('place'); // clavier
});

// 2. Boutons : un seul écouteur pour toute la page (boutons ajoutés plus tard compris)
document.addEventListener('click', e => {
  const btn = e.target.closest('button, [data-sound]'); // boutons de la palette = <div data-sound>
  if (!btn || btn.disabled) return;
  const moment = btn.dataset.sound || 'button';
  if (moment !== 'none') playSound(moment);
});

// Bouton haut-parleur
function refreshSoundButton() {
  const btn = document.getElementById('sound-btn');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(!sounds.muted));
  btn.classList.toggle('muted', sounds.muted);
  btn.title = sounds.muted ? 'Sound off — click to turn it on' : 'Sound on — click to turn it off';
}

function toggleSound() {
  sounds.muted = !sounds.muted;
  try { localStorage.setItem(SOUND_KEY, sounds.muted ? 'off' : 'on'); } catch (e) { /* choix non retenu */ }
  if (typeof Howler !== 'undefined') Howler.mute(sounds.muted);
  refreshSoundButton();
  playSound('button'); // son rallumé : on l'entend aussitôt
}

refreshSoundButton();
if (document.readyState === 'complete') loadSounds(); else window.addEventListener('load', loadSounds);
