// ===== js/ui.js — Interface: fitting the app title to the screen width, choosing the
// board format (home screen).
//
// Classic script (not a module): all js/ files share the same global scope and are loaded
// in the fixed order of the <script> tags in index.html (the only reference). Code run
// when a file loads can only use what is declared in that file or the previous ones;
// functions, called later, see everything.

// The title + subtitle block (.app-title-stack) has a fixed font size in px
// (calibrated for the outline/shadow, see CSS) — on a narrow screen it can
// overflow. We measure its real width after rendering and shrink it with a
// single global scale() if needed (this keeps the already-calibrated
// outline/shadow/skew proportions exactly, unlike changing the font-size).
// --fit-scale is a CSS variable read by the transform of each context
// (#title-band / #picker-title-band), so the scale breaks neither the
// recentering translateX nor the skewX specific to each text (independent
// transforms, applied to different elements).
// transform:scale() changes ONLY the visual rendering, never the layout size —
// without compensation, the grey band around it (#title-band, which is sized
// by the layout) would keep its original height even with a visually reduced
// title, leaving a disproportionate gap on small screens. We compensate with a
// computed negative bottom margin (the transform-origin of .app-title-stack is
// "center top", so shrinking frees space at the BOTTOM of the box — a negative
// margin-bottom is a 100% standard solution, with no reliance on a non-standard
// CSS property such as zoom.
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
  const SAFETY_MARGIN = 16; // keeps the text from touching the container edge exactly

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

// The board/palette are only built once the format is chosen (see the
// Vendetta/Ignition selection screen) — no direct call here.
// New blank board (all DEFAULT_TILE, Off-Road) of the chosen format.
function chooseBoardType(type) {
  applyBoardType(type);
  board = Array(COLS * ROWS).fill(DEFAULT_TILE);
  decorations = [];
  decor.selected = -1;
  barricades = [];
  cellVariant = Array(COLS * ROWS).fill(null);
  overlayCycleIndex = { rock: 0, fire: 0, oil: 0 };
  showEditor();
  notifyBoardChange('new-board');
}

// Geometry and fields specific to a format (Vendetta / Ignition), without touching the
// cell contents — shared by chooseBoardType and setBoardState (state.js).
function applyBoardType(type) {
  BOARD_TYPE = type;
  COLS = BOARD_TYPES[type].cols;
  VW   = BOARD_TYPES[type].vw;
  BANDS = computeBands();
  const rect = computeGameRect();
  GAME_X = rect.x; GAME_Y = rect.y; GAME_W = rect.w; GAME_H = rect.h;
  document.getElementById('bwrap').classList.toggle('board-ignition', type === 'ignition'); // display (paper-ui.css)
  setDisplayVariant(); // previews matched to the displayed size of this format (assets.js)
  document.getElementById('name-field-group').style.display = (type === 'vendetta') ? '' : 'none';
  document.getElementById('number-field-group').style.display = (type === 'ignition') ? '' : 'none';
  // Recommended resolution for the title image: the exact size of the frame it is placed in
  // (titleImageBox, js/render-layers.js), which changes with the format (8 or 4 columns).
  const box = titleImageBox(), idealW = Math.round(box.w), idealH = Math.round(box.h);
  const idealText = `Ideal size: ${idealW} × ${idealH} px`;
  document.getElementById('title-img-tooltip').textContent = idealText;
  refreshTitleImageWarning(); // same image, other frame: other resolution (js/export.js)
}

// Hides the home screen, shows the editor and (re)draws the palette and board.
function showEditor() {
  document.getElementById('board-type-picker').style.display = 'none';
  document.getElementById('app').style.display = '';
  buildPalette();
  buildBoard();
  fitAllTitleStacks();
}

// ===== Credits (phase 6 bis, after TRV-Pocket): native scrolling <dialog> window, built
// from CREDITS (js/credits.js); closed by "Return", Escape (native) or a click outside.
// Licenses are collapsed (<details>), their text read from the file shipped with the resource on first opening.
function buildCredits() {
  const C = CREDITS, body = document.getElementById('credits-body');
  body.textContent = '';
  const add = (parent, tag, cls, text) => {
    const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text;
    parent.appendChild(e); return e;
  };
  add(body, 'h2', 'credits-title', C.title).id = 'credits-title';
  add(body, 'div', 'credits-app', C.app);
  add(body, 'p', 'credits-tagline', C.tagline);
  for (const n of C.notice) add(body, 'p', 'credits-notice', n);
  for (const sec of C.sections) {
    const box = add(body, 'section');
    add(box, 'h3', null, sec.title);
    for (const line of sec.lines) {
      if (Array.isArray(line)) { add(box, 'div', 'credits-role', line[0]); add(box, 'p', null, line[1]); }
      else add(box, 'p', null, line);
    }
  }
  const lic = add(body, 'section', 'credits-licenses');
  add(lic, 'h3', null, 'Licenses');
  for (const l of C.licenses) {
    const d = add(lic, 'details');
    add(d, 'summary', null, l.title);
    const pre = add(d, 'pre', 'credits-license', 'Loading…');
    d.addEventListener('toggle', () => {
      if (!d.open || d.dataset.loaded) return;
      d.dataset.loaded = '1';
      fetch(l.file).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(t => { pre.textContent = t.trim(); })
        .catch(() => { delete d.dataset.loaded; pre.textContent = 'This license could not be loaded. It is included with the app as ' + l.file + '.'; });
    });
  }
  document.getElementById('credits-close').textContent = C.close;
}

function openCredits() {
  const dlg = document.getElementById('credits');
  if (!document.getElementById('credits-body').childElementCount) buildCredits();
  document.getElementById('credits-body').scrollTop = 0;
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
}

// ---- Messages and confirmations in the page (26/11) ----
// Replace the browser's alert() / confirm(), which pause the page's sound in Safari, sometimes
// for good (WebKit bugs 249949, 255134): native <dialog> (focus kept inside, Escape = cancel),
// same paper style as the export window. The answer comes back in a promise (true = OK).
const messageBox = { resolve: null };
function openMessage(text, { okLabel = 'OK', cancelLabel = null, danger = false } = {}) {
  const dlg = document.getElementById('message-dialog');
  if (messageBox.resolve) closeMessage(false); // a new message replaces one still open
  document.getElementById('message-text').textContent = text;
  const ok = document.getElementById('message-ok'), cancel = document.getElementById('message-cancel');
  ok.textContent = okLabel;
  ok.classList.toggle('danger', danger);
  cancel.hidden = !cancelLabel;
  if (cancelLabel) cancel.textContent = cancelLabel;
  return new Promise(resolve => {
    messageBox.resolve = resolve;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    ok.focus(); // Enter = OK, as with the browser's own windows
  });
}
function closeMessage(answer) {
  const dlg = document.getElementById('message-dialog'), resolve = messageBox.resolve;
  messageBox.resolve = null;
  if (dlg.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
  if (resolve) resolve(answer);
}
function showMessage(text) { return openMessage(text); }
function askConfirm(text, okLabel, opts = {}) { return openMessage(text, Object.assign({ okLabel, cancelLabel: 'Cancel' }, opts)); }
// Open message: the board keys (cursor, letters, Ctrl+Z…) do nothing meanwhile.
function messageOpen() { return !!document.getElementById('message-dialog')?.open; }
(function installMessageDialog() {
  const dlg = document.getElementById('message-dialog');
  document.getElementById('message-ok').addEventListener('click', () => closeMessage(true));
  document.getElementById('message-cancel').addEventListener('click', () => closeMessage(false));
  dlg.addEventListener('cancel', e => { e.preventDefault(); closeMessage(false); }); // Escape
  dlg.addEventListener('click', e => { if (e.target === dlg) closeMessage(false); }); // dimmed backdrop
})();

function closeCredits() {
  const dlg = document.getElementById('credits');
  if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
}

// Click on the dimmed backdrop (outside the window): closes, like the export window
document.getElementById('credits').addEventListener('click', e => { if (e.target.id === 'credits') closeCredits(); });
document.getElementById('home-notice').textContent = CREDITS.homeNotice;
