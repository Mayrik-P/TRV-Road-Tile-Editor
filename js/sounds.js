// ===== js/sounds.js — Editor sounds (phase 6 of the plan, docs/roadmap.md).
//
// Short sounds from TRV-Pocket (freesound.org, CC0; sounds/CREDITS.md), chosen by Mayrik on 19/11
// on a listening page. Played by howler.js 2.2.4 (js/vendor/, MIT), like TRV-Pocket:
// Web Audio (low latency, several sounds at once, variable pitch), sound unlocked on the
// first gesture on phones, HTML5 Audio fallback; a missing file simply gives silence.
//
// A single point of passage: playSound(moment). Three sources, and no other:
//   1. the board signal (boardEvents, js/state.js): placing a cell, brush stroke,
//      "Clear board" (the whole gesture, read in undoHistory.actionKind), Undo / Redo;
//   2. a single click listener for all the buttons on the page: "button" sound, unless a
//      data-sound attribute ("palette", or "none" when the button has its own sound via the signal);
//   3. two moments with neither button nor signal: export finished (js/export.js) and refusal (warnUser).
// Sound off: speaker button in the toolbar, choice remembered on the device.

const SOUND_TABLE = {
  palette: 'sounds/dash-zoom.mp3',       // choosing a tile type in the palette
  place:   'sounds/card-flip.mp3',       // placing a cell (click, brush, keyboard)
  undo:    'sounds/tap-back.mp3',        // Undo / Redo
  clear:   'sounds/stamp.mp3',           // "Clear board" confirmed
  export:  { src: 'sounds/finish-flag.mp3', volume: 0.5 }, // export finished (PNG or PDF); at 50% (≈ −6 dB):
                                         // the loudest and longest, it was startling (Mayrik, 19/11)
  refuse:  'sounds/tap-refuse.mp3',      // file or image refused, export error
  button:  'sounds/tap-menu-button.mp3', // other buttons
};
const SOUND_KEY = 'trv_road_tile_sound_v1'; // 'off' = sound off; absent = sound on
const SOUND_MIN_GAP_MS = 70;  // same sound at most once every 70 ms (TRV-Pocket rule)
const BRUSH_VOLUME = 0.7;     // following cells of a brush stroke: quieter…
const BRUSH_PITCH = 0.08;     // …and pitch varied by ±8% (otherwise a "machine gun" effect)

const sounds = { howls: {}, lastAt: {}, muted: false, strokeSeq: -1, clearSeq: -1 };
try { sounds.muted = localStorage.getItem(SOUND_KEY) === 'off'; } catch (e) { /* storage forbidden: sound on */ }

// Sounds loaded after the page (they do not delay the board previews): a few KB.
function loadSounds() {
  if (typeof Howl === 'undefined') return; // library missing: the editor works without sound
  Howler.mute(sounds.muted);
  for (const [moment, entry] of Object.entries(SOUND_TABLE)) {
    const { src, volume = 1 } = typeof entry === 'string' ? { src: entry } : entry; // volume specific to the sound (TRV-Pocket)
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

// Error message with refusal sound, for refusals and export errors: in the page (showMessage,
// js/ui.js), never the browser's alert(), which cut the sound in Safari (bug of 26/11).
function warnUser(text) {
  playSound('refuse');
  return showMessage(text);
}

// 1. Board signal
boardEvents.addEventListener('change', e => {
  const { reason } = e.detail;
  if (reason === 'restore' && undoHistory.applying) { playSound('undo'); return; }
  const inAction = undoHistory.batch > 0, seq = undoHistory.actionSeq;
  if (reason === 'decor' || reason === 'barricade') { // decorations, barricades; "Clear board": covered by its stamp
    if (e.detail.action === 'clear') { // a single stamp per "Clear board", even if no cell changes
      if (sounds.clearSeq !== undoHistory.actionSeq) { sounds.clearSeq = undoHistory.actionSeq; playSound('clear'); }
    } else if (inAction && undoHistory.actionKind === 'barricade') brushSound(seq); // gesture of the barricade tool
    else playSound(e.detail.action === 'remove' ? 'undo' : 'place');
    return;
  }
  if (reason !== 'cell') return;
  if (inAction && undoHistory.actionKind === 'clear') {
    if (sounds.clearSeq !== seq) { sounds.clearSeq = seq; playSound('clear'); } // a single stamp
    return;
  }
  if (inAction && undoHistory.actionKind === 'brush') { brushSound(seq); return; }
  playSound('place'); // clavier
});
// Brush stroke (cells or barricades): 1st change at full volume, the next ones softer and varied.
function brushSound(seq) {
  if (sounds.strokeSeq !== seq) { sounds.strokeSeq = seq; sounds.lastAt.place = -Infinity; playSound('place'); return; }
  playSound('place', { volume: BRUSH_VOLUME, rate: 1 - BRUSH_PITCH + Math.random() * 2 * BRUSH_PITCH });
}

// 2. Buttons: a single listener for the whole page (buttons added later included)
document.addEventListener('click', e => {
  const btn = e.target.closest('button, [data-sound]'); // palette buttons = <div data-sound>
  if (!btn || btn.disabled) return;
  const moment = btn.dataset.sound || 'button';
  if (moment !== 'none') playSound(moment);
});

// Speaker button
function refreshSoundButton() {
  const btn = document.getElementById('sound-btn');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(!sounds.muted));
  btn.classList.toggle('muted', sounds.muted);
  btn.title = sounds.muted ? 'Sound off — click to turn it on' : 'Sound on — click to turn it off';
}

function toggleSound() {
  sounds.muted = !sounds.muted;
  try { localStorage.setItem(SOUND_KEY, sounds.muted ? 'off' : 'on'); } catch (e) { /* choice not remembered */ }
  if (typeof Howler !== 'undefined') Howler.mute(sounds.muted);
  refreshSoundButton();
  playSound('button'); // sound turned back on: heard right away
}

// Safety net (26/11), method of the Phaser game engine (WebAudioSoundManager.onFocus, Phaser 3.60, fix
// #5353): if the audio context is 'suspended' or 'interrupted' (non-standard state of Safari, after a
// system window, a phone call, a change of audio device…), ask it to resume. Phaser checks it at every
// frame while the game has the focus; the editor has no frame loop, so: at every gesture on the page (a
// resume is always allowed during a user gesture) and when the window gets the focus back. Howler plays
// normally again as soon as the context is running (howler alone does not resume a context paused behind
// its back: measured in Chromium, 26/11).
function resumeAudioIfPaused() {
  const ctx = typeof Howler !== 'undefined' && Howler.ctx;
  if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted')) ctx.resume().catch(() => {});
}
['pointerdown', 'keydown'].forEach(type => document.addEventListener(type, resumeAudioIfPaused, true));
window.addEventListener('focus', resumeAudioIfPaused);

refreshSoundButton();
if (document.readyState === 'complete') loadSounds(); else window.addEventListener('load', loadSounds);
