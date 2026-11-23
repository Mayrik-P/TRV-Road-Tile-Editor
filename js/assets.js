// ===== js/assets.js — Image and font paths; on-screen previews (copy matched to the
// displayed size); originals in base64 for export; unlocking of the Export button.
//
// Classic script (not a module): all js/ files share the same global scope and are loaded
// in the fixed order of the <script> tags in index.html (the only reference).
// Code run when a file loads can only use what is declared in that file or the previous
// ones; functions, called later, see everything.

// ---- Overlay sprite sources ----
let HAZARD_1, HAZARD_2, HAZARD_3;
let OIL_1, OIL_2;
let RAMP, MULTI_RAMP;
let MINEFIELD;
let FIRE_1, FIRE_2, FIRE_3, FIRE_4, FIRE_5, FIRE_6;
let IMP_1, IMP_2, IMP_3, IMP_4, IMP_5, IMP_6, IMP_7, IMP_8;
// Group decorations (jerrycan, cactus, wheel, bumper...) — 12 png in the Items/ folder.
const ITEM_PATHS = Array.from({length: 12}, (_, i) => `items/Item-${i + 1}.webp`);

function initOverlaySources() {
  HAZARD_1 = 'sprites/Hazard-1.webp';  HAZARD_2 = 'sprites/Hazard-2.webp';  HAZARD_3 = 'sprites/Hazard-3.webp';
  OIL_1    = 'sprites/Oil-1.webp';     OIL_2    = 'sprites/Oil-2.webp';
  RAMP     = 'sprites/Ramp.webp';      MULTI_RAMP = 'sprites/Multi-Ramp.webp';
  MINEFIELD = 'sprites/Minefield.webp';
  FIRE_1   = 'sprites/Fire!-1.webp';   FIRE_2   = 'sprites/Fire!-2.webp';   FIRE_3 = 'sprites/Fire!-3.webp';
  FIRE_4   = 'sprites/Fire!-4.webp';   FIRE_5   = 'sprites/Fire!-5.webp';   FIRE_6 = 'sprites/Fire!-6.webp';
  IMP_1    = 'sprites/Impassable-1.webp'; IMP_2 = 'sprites/Impassable-2.webp'; IMP_3 = 'sprites/Impassable-3.webp';
  IMP_4    = 'sprites/Impassable-4.webp'; IMP_5 = 'sprites/Impassable-5.webp'; IMP_6 = 'sprites/Impassable-6.webp';
  IMP_7    = 'sprites/Impassable-7.webp';
  IMP_8    = 'sprites/Impassable-8.webp';
}
initOverlaySources();

// Complete list of all image paths expected in IMAGES_B64
function allImagesReady() {
  const required = [
    ...Object.values(TEXTURE_PATHS),
    HAZARD_1, HAZARD_2, HAZARD_3,
    OIL_1, OIL_2, RAMP, MULTI_RAMP, MINEFIELD,
    FIRE_1, FIRE_2, FIRE_3, FIRE_4, FIRE_5, FIRE_6,
    IMP_1, IMP_2, IMP_3, IMP_4, IMP_5, IMP_6, IMP_7, IMP_8,
    ...ITEM_PATHS,
    ...Object.values(EDGE_PATHS),
    DEFAULT_TITLE_IMAGE_PATH,
    BLASON_PATH,
    COOPER_HEWITT_BOLD_URL,
    ALFA_SLAB_ONE_FONT_URL,
    OSWALD_BOLD_FONT_URL,
  ];
  const fetchesOk = required.every(src => !!IMAGES_B64[src]);
  // The texture previews must also be displayed: without them, the board does not yet
  // contain its texture layers and the export would lack them. Alfa Slab One and Oswald
  // block the export (used in the title of the exported board).
  const texturesOk = Object.keys(TEXTURE_PATHS).every(key => !!TEXTURES[key]);
  return fetchesOk && texturesOk && defaultTitleImageDecoded && ALFASLABONE_READY && OSWALD_READY;
}

// Texture paths — used as href in SVG and as keys in IMAGES_B64 (must match exactly)
const TEXTURE_PATHS = {
  road:  'textures/Texture-Road.webp',
  goo:   'textures/Texture-Toxic-Goo.webp',
  mud:   'textures/Texture-Muddy.webp',
  sand:  'textures/Texture-Off-Road.webp',
  salt:  'textures/Texture-Salt-Flats.webp',
  glass: 'textures/Texture-Desert-Glass.webp',
};

// Default title image, shown until the user has loaded one via "Load title image" —
// makes the board more welcoming from the start than a plain brown background. Loaded
// dead last (lower priority than textures/sprites/decorations/fonts), see allSources below.
const DEFAULT_TITLE_IMAGE_PATH = 'textures/TitleImage.webp';
// Crest shown in the title band of Ignition boards.
const BLASON_PATH = 'sprites/BlasonIgnition.webp';

// ---- On-screen previews (slice 1c) ----
// Method of the "proxy" files of editing software (and of Android's per-density folders,
// already used by TRV-Pocket): the screen shows a reduced copy of each image, the export
// always uses the original. Three copies, same names: <folder>/quarter/ (25%),
// <folder>/half/ (50%), <folder>/ (original), made by tools/make-webp.py. We take the
// smallest one that stays sharp for the actually displayed size of the chosen format
// (never a fixed value designed for the phone: a Retina screen gets a finer copy).
let DISPLAY_DIR = null;            // 'quarter/', 'half/' or '' (original); null before the format is chosen
const FULL_OF_DISPLAY = {};        // preview address -> path of the original (for export)
let displayTexturesPending = 0;    // preview textures of the current format still loading

// Address to display for an image (path of the original as input).
function displayHref(path) {
  if (!DISPLAY_DIR) return path;
  const href = path.replace(/^([^/]+)\//, `$1/${DISPLAY_DIR}`);
  FULL_OF_DISPLAY[href] = path;
  return href;
}

// Suitable preview copy: real screen pixels of the board / pixels of the original.
// Can be forced for checks: ?display=quarter|half|full in the address.
// Share of the width of the area the board occupies on screen: Ignition is displayed at the
// height of Vendetta on screens at least 700 px wide (same rule as css/paper-ui.css,
// #bwrap.board-ignition).
function boardDisplayFraction() {
  return BOARD_TYPE === 'ignition' && window.matchMedia('(min-width: 700px)').matches ? 2481 / 4961 : 1;
}

function pickDisplayDir() {
  const forced = new URLSearchParams(location.search).get('display');
  if (forced === 'quarter' || forced === 'half') return forced + '/';
  if (forced === 'full') return '';
  const cssWidth = Math.min(document.documentElement.clientWidth || window.innerWidth, 1200) * boardDisplayFraction();
  const need = cssWidth * (window.devicePixelRatio || 1) / VW;
  return need <= 0.25 ? 'quarter/' : need <= 0.5 ? 'half/' : '';
}

// Called by applyBoardType (ui.js) on every format choice: (re)loads the preview
// textures if the suitable copy changes, in the order wanted by Mayrik (Road, Off-Road,
// Muddy, then the rest), then starts the originals in the background.
function setDisplayVariant() {
  const dir = pickDisplayDir();
  if (dir === DISPLAY_DIR) return;
  DISPLAY_DIR = dir;
  Object.keys(TEXTURES).forEach(k => delete TEXTURES[k]);
  const order = ['road', 'sand', 'mud', ...Object.keys(TEXTURE_PATHS).filter(k => !['road', 'sand', 'mud'].includes(k))];
  displayTexturesPending = order.length;
  updateExportButton();
  (async () => {
    for (const key of order) {
      await new Promise(resolve => {
        const img = new Image();
        img.onload = () => { if (DISPLAY_DIR === dir) { TEXTURES[key] = img; buildBoard(); } resolve(); };
        img.onerror = () => { console.warn('Preview failed:', displayHref(TEXTURE_PATHS[key])); resolve(); };
        img.src = displayHref(TEXTURE_PATHS[key]);
      });
      if (DISPLAY_DIR !== dir) return; // format changed in the meantime: another load took over
      displayTexturesPending--;
    }
    updateExportButton();
    startFullResLoading();
  })();
}

// ---- Originals (export) and fonts ----
// Fonts from the page opening (app title, then board). Originals of the images in the
// background, once the previews of the first board are shown, so as not to compete with
// them for the connection. Each is converted to base64 (fetch then FileReader: no canvas,
// no CORS risk) to be embedded in the exported SVG; the originals are never decoded into
// an image (memory), only the export uses them.
// The Export button is unlocked when everything is ready (updateExportButton).
const LOAD = { done: 0, failed: 0, total: 0, fullStarted: false };

function updateExportButton() {
  const btn = document.getElementById('export-btn');
  const label = document.getElementById('export-label');
  const progress = document.getElementById('export-progress');
  const fontsReady = ALFASLABONE_READY && OSWALD_READY && COOPERHEWITT_READY;
  const allLoaded = LOAD.fullStarted && LOAD.done === LOAD.total && displayTexturesPending === 0
    && defaultTitleImageDecoded && fontsReady;
  const pdfBtn = document.getElementById('export-pdf-btn');
  if (!allLoaded) {
    if (pdfBtn) pdfBtn.disabled = true;
    btn.disabled = true;
    btn.style.opacity = '0.5';
    const pct = LOAD.total ? Math.round(LOAD.done / LOAD.total * 100) : 0;
    progress.style.width = pct + '%';
    label.textContent = `Preparing high-res… ${pct}%`;
    return;
  }
  btn.disabled = false;
  btn.style.opacity = '1';
  progress.style.width = '0%';
  if (pdfBtn) pdfBtn.disabled = !allImagesReady();
  if (allImagesReady()) {
    label.textContent = 'Download PNG';
  } else {
    label.textContent = '⚠ Reload page';
    progress.style.background = 'rgba(200,0,0,0.25)';
  }
}

// Download that cannot stay suspended (bug seen by Mayrik on 22/11: export stuck at 98%,
// a single file never arrived; the browser imposes no timeout on fetch). Method of download
// libraries (ky, axios-retry): an attempt that has received NO data for LOAD_STALL_MS is
// abandoned then retried, 3 attempts at most, increasing wait (1 s, 3 s).
// Only the absence of data counts: a large file arriving slowly is never cut.
// Adjustable for tests: ?stalltimeout=<ms>.
const LOAD_STALL_MS = +new URLSearchParams(location.search).get('stalltimeout') || 20000;
const LOAD_RETRY_DELAYS = [1000, 3000];
const LOAD_PARALLEL = 4;
function fetchOnce(src) {
  const ctrl = new AbortController();
  let timer;
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => ctrl.abort(), LOAD_STALL_MS); };
  arm();
  return fetch(src, { signal: ctrl.signal })
    .then(async r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (!r.body || !r.body.getReader) return r.blob(); // old browser: no data monitoring
      const reader = r.body.getReader(), chunks = [];
      for (;;) {
        arm();
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      return new Blob(chunks, { type: r.headers.get('content-type') || '' });
    })
    .finally(() => clearTimeout(timer));
}
async function fetchWithRetry(src) {
  for (let attempt = 0; ; attempt++) {
    try { return await fetchOnce(src); }
    catch (e) {
      if (attempt >= LOAD_RETRY_DELAYS.length) throw e;
      console.warn(`Retrying ${src} (${e.name === 'AbortError' ? 'no data for ' + LOAD_STALL_MS / 1000 + ' s' : e.message})`);
      await new Promise(res => setTimeout(res, LOAD_RETRY_DELAYS[attempt]));
    }
  }
}

// Downloads a file and keeps it as base64; for fonts, also registers it with the browser
// (FontFace) — needed for the interface, for canvas measureText() (title fitting) and to
// never export before they are ready.
function loadOne({key, src, type}) {
  return fetchWithRetry(src)
    .then(blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }))
    .then(dataUrl => {
      IMAGES_B64[src] = dataUrl;
      if (type === 'font') return registerFont(key, dataUrl);
      // Default title image: never replaces an image already loaded by the
      // user; decoded in all cases (see allImagesReady).
      if (type === 'defaultTitle') return new Promise(resolve => {
        const img = new Image();
        img.onload = () => { DEFAULT_TITLE_IMAGE = img; if (!TITLE_IMAGE) TITLE_IMAGE = img; defaultTitleImageDecoded = true; resolve(); };
        img.onerror = () => { defaultTitleImageDecoded = true; resolve(); };
        img.src = dataUrl;
      });
    })
    .then(() => { LOAD.done++; updateExportButton(); })
    .catch(e => {
      console.warn('Load failed:', src, e);
      if (type === 'defaultTitle') defaultTitleImageDecoded = true;
      LOAD.done++; LOAD.failed++; updateExportButton();
    });
}

const FONT_FACES = {
  alfaslabone:  { family: 'AlfaSlabOne',      weight: '400',     set: d => { FONT_B64_ALFASLABONE = d; },  ready: () => { ALFASLABONE_READY = true; } },
  // Variable font: declared weight range (200-700), used at 700.
  oswald:       { family: 'OswaldBold',       weight: '200 700', set: d => { FONT_B64_OSWALD = d; },       ready: () => { OSWALD_READY = true; } },
  cooperhewitt: { family: 'CooperHewittBold', weight: '700',     set: d => { FONT_B64_COOPERHEWITT = d; }, ready: () => { COOPERHEWITT_READY = true; } },
};
function registerFont(key, dataUrl) {
  const f = FONT_FACES[key];
  f.set(dataUrl); // embedded in the SVG (display and export), see buildBoard
  if (document.getElementById('bsvg').firstChild) buildBoard();
  let face;
  try { face = new FontFace(f.family, `url(${dataUrl})`, { style: 'normal', weight: f.weight }); }
  catch (e) { return; }
  return face.load().then(loaded => {
    document.fonts.add(loaded);
    f.ready();
    if (document.getElementById('bsvg').firstChild) buildBoard();
    fitAllTitleStacks();
  }).catch(() => {});
}

// Originals of the images, in the order wanted by Mayrik: Road, Off-Road, Muddy, the
// Impassable ones one by one, then everything else in parallel (default title image
// last, the lowest priority).
function fullResItems() {
  const overlaySources = [
    HAZARD_1, HAZARD_2, HAZARD_3, OIL_1, OIL_2, RAMP, MULTI_RAMP, MINEFIELD,
    FIRE_1, FIRE_2, FIRE_3, FIRE_4, FIRE_5, FIRE_6,
    IMP_1, IMP_2, IMP_3, IMP_4, IMP_5, IMP_6, IMP_7, IMP_8,
    ...ITEM_PATHS, ...Object.values(EDGE_PATHS), BLASON_PATH,
  ];
  const textures = ['road', 'sand', 'mud', ...Object.keys(TEXTURE_PATHS).filter(k => !['road', 'sand', 'mud'].includes(k))]
    .map(k => ({ src: TEXTURE_PATHS[k], type: 'image' }));
  const imps = overlaySources.filter(s => s.includes('Impassable')).map(src => ({ src, type: 'image' }));
  const others = overlaySources.filter(s => !s.includes('Impassable')).map(src => ({ src, type: 'image' }));
  const sequential = [...textures.slice(0, 3), ...imps];
  const parallel = [...textures.slice(3), ...others, { src: DEFAULT_TITLE_IMAGE_PATH, type: 'defaultTitle' }];
  return { sequential, parallel };
}
function startFullResLoading() {
  if (LOAD.fullStarted) return;
  LOAD.fullStarted = true;
  const { sequential, parallel } = fullResItems();
  updateExportButton();
  (async () => {
    for (const item of sequential) await loadOne(item);
    // At most LOAD_PARALLEL downloads at a time (like p-limit): each receives its data
    // from the start, without waiting in the browser's queue, where the data monitoring
    // (fetchOnce) would wrongly take it for suspended (otherwise 22 retries on a slow connection).
    const queue = parallel.slice();
    const worker = async () => { while (queue.length) await loadOne(queue.shift()); };
    for (let i = 0; i < LOAD_PARALLEL; i++) worker();
  })();
}

window.addEventListener('load', function () {
  // Fonts first: Alfa Slab One and Oswald (app and board title), then
  // Cooper Hewitt (Ignition number).
  const fonts = [
    { key: 'alfaslabone', src: ALFA_SLAB_ONE_FONT_URL, type: 'font' },
    { key: 'oswald', src: OSWALD_BOLD_FONT_URL, type: 'font' },
    { key: 'cooperhewitt', src: COOPER_HEWITT_BOLD_URL, type: 'font' },
  ];
  const items = fullResItems();
  LOAD.total = fonts.length + items.sequential.length + items.parallel.length;
  (async () => { for (const f of fonts) await loadOne(f); })();
});
