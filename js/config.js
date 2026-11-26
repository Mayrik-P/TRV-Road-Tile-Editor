// ===== js/config.js — Constants and board state: tile types, 300 dpi geometry
// (Vendetta / Ignition formats), overlay variants, title fonts.
//
// Classic script (not a module): all js/ files share the same global scope
// and are loaded in the fixed order of the <script> tags in index.html (the only reference).
// Code run when a file loads can only use what is declared in that file or the previous
// ones; functions, called later, see everything.

const NS = 'http://www.w3.org/2000/svg';

const TILES = [
  {id:'glass',      label:'Desert Glass',        color:'#a4c0c8'},
  {id:'fire',       label:'Fire!',               color:'#ff3333'},
  {id:'rock',       label:'Impassable',          color:'#9b5043'},
  {id:'mud',        label:'Muddy',               color:'#53413d'},
  {id:'haz_mud',    label:'Muddy + Hazard',      color:'#53413d'},
  {id:'sand',       label:'Off-Road',            color:'#e9b964'},
  {id:'haz_sand',   label:'Off-Road + Hazard',   color:'#e9b964'},
  {id:'off_mine',   label:'Off-Road + Minefield',color:'#e9b964'},
  {id:'off_oil',    label:'Off-Road + Oil',      color:'#e9b964'},
  {id:'multi_ramp', label:'Omni-ramp',           color:'#897a5b'},
  {id:'ramp',       label:'Ramp',                color:'#897a5b'},
  {id:'road',       label:'Road',                color:'#64635e'},
  {id:'haz_road',   label:'Road + Hazard',       color:'#64635e'},
  {id:'oil',        label:'Road + Oil',          color:'#64635e'},
  {id:'salt',       label:'Salt Flats',          color:'#fff8e2'},
  {id:'haz_salt',   label:'Salt Flats + Hazard', color:'#fff8e2'},
  {id:'goo',        label:'Toxic Goo',           color:'#82a94d'},
];

// Texture inheritance: hazard/oil/fire/ramp variants reuse the base terrain texture
const TEXTURE_BASE = {
  haz_mud:'mud', haz_sand:'sand', haz_road:'road',
  off_oil:'sand', oil:'road', haz_salt:'salt',
  fire:'sand', ramp:'sand', multi_ramp:'sand', off_mine:'sand',
};

function baseId(id) { return TEXTURE_BASE[id] || id; }

// Board fill color override — used when a tile has no loaded texture
const BOARD_FILL_OVERRIDE = { rock: '#3d3334' };

function tcolor(id) { return BOARD_FILL_OVERRIDE[id] || TILES.find(t => t.id === id)?.color || '#888'; }

const TEXTURES = {};    // Image objects for SVG display
const IMAGES_B64 = {};  // base64 strings for PNG export
let TITLE_IMAGE = null;
// Reference kept separately from TITLE_IMAGE (which the user may replace)
// so we can go back to the default image via "Reset title image".
let DEFAULT_TITLE_IMAGE = null;
// True once the default title image is fetched AND decoded (whether or not
// the user has already replaced it with their own) — needed for the
// export even if it is no longer displayed, see allImagesReady().
let defaultTitleImageDecoded = false;
// ---- Board geometry (300dpi) ----
// Vendetta = A3 landscape (420×297mm @300dpi = 4961×3508px), Ignition = A4 portrait
// (210×297mm @300dpi = 2481×3508px) — same height in both cases (297mm),
// only the width changes. COLS/VW are therefore variables depending on the
// chosen board type, instead of constants fixed for 8 columns.
const VH = 3508, NOTCH = 50, CELL_SLOT = 493, ROWS = 6;
const BOARD_TYPES = {
  vendetta: { cols: 8, vw: 4961, label: 'Vendetta' },
  ignition: { cols: 4, vw: 2481, label: 'Ignition' },
};
let BOARD_TYPE = 'vendetta';
let COLS = BOARD_TYPES[BOARD_TYPE].cols;
let VW   = BOARD_TYPES[BOARD_TYPE].vw;

// Horizontal offset of the staggered layout: half the gap between the two
// alternating left positions of the rows. Intrinsic property of the cell shape
// (the chevron/notch), independent of the board width — hence a
// constant, whatever COLS/VW.
const QUINCONCE_HALF_SHIFT = 97.5;

// Row heights (top/bottom): depend only on ROWS, never on COLS —
// same values whatever the board type.
const ROW_TOPS_BOTS = [
  {top:164,  bot:620},  // title
  {top:620,  bot:1072}, // row1 (odd)
  {top:1072, bot:1526}, // row2 (even)
  {top:1526, bot:1978}, // row3 (odd)
  {top:1978, bot:2432}, // row4 (even)
  {top:2432, bot:2884}, // row5 (odd)
  {top:2884, bot:3338}, // row6 (even)
];

// Builds BANDS for the current board width: centres COLS*CELL_SLOT
// on VW, then alternates ±QUINCONCE_HALF_SHIFT around that centre depending on the
// row parity — generalises the old fixed values (606/411 for
// COLS=8) to any board width.
function computeBands() {
  const avgLeft = (VW - COLS * CELL_SLOT) / 2;
  return ROW_TOPS_BOTS.map((rb, i) => ({
    top: rb.top, bot: rb.bot,
    left: i % 2 === 0 ? avgLeft + QUINCONCE_HALF_SHIFT : avgLeft - QUINCONCE_HALF_SHIFT,
  }));
}
let BANDS = computeBands();

// Rectangle over which each full-board texture is stretched before being
// cut cell by cell (see getSharedTextureImage) — must always cover
// generously (all rows, whatever their parity), generalised in the
// same way as BANDS instead of 4 fixed values for COLS=8.
function computeGameRect() {
  const avgLeft = (VW - COLS * CELL_SLOT) / 2;
  return {
    x: avgLeft - QUINCONCE_HALF_SHIFT - NOTCH,
    y: ROW_TOPS_BOTS[1].top,
    w: COLS * CELL_SLOT + 2 * QUINCONCE_HALF_SHIFT + 2 * NOTCH,
    h: ROW_TOPS_BOTS[ROW_TOPS_BOTS.length - 1].bot - ROW_TOPS_BOTS[1].top,
  };
}
let { x: GAME_X, y: GAME_Y, w: GAME_W, h: GAME_H } = computeGameRect();

// Rectangle on which each terrain texture is laid, then cut cell by
// cell. Mayrik's source textures are 4243 × 2718 px: the Vendetta cell
// area at 300 dpi (4239 × 2718, plus a 2 px margin on each side). They are
// laid at this exact size, without resizing (1 texture pixel = 1 printed
// pixel), centred on the cell area of the current format; since cells have the
// same physical size in every format, Ignition shows the central part,
// at the same scale. History (19/11): v1.00 used reduced copies at
// 3000 × 1922, enlarged ×1.41 (about 212 real dpi), and fitted to the area of
// each format — in Ignition, squashed to 0.76 in width for 1.41 in height.
const TEXTURE_W = 4243, TEXTURE_H = 2718;
function textureRect() {
  return { x: GAME_X + (GAME_W - TEXTURE_W) / 2, y: GAME_Y + (GAME_H - TEXTURE_H) / 2, w: TEXTURE_W, h: TEXTURE_H };
}

// Type of the cells of a new board (users' request, Mayrik 19/11: Off-Road,
// instead of Road in v1.00) and type selected at start in the palette (Road: what
// you paint first on an Off-Road background).
const DEFAULT_TILE = 'sand';
let sel = 'road';
let board = Array(COLS * ROWS).fill(DEFAULT_TILE);

// ---- Overlay variants (Impassable/Oil/Fire): cycle + per-cell memory ----
// Before: the variant was a pure function of the position (col + row*2) % N,
// recomputed at each render — two distant cells could end up with the same
// visual by chance, and the user had no way to choose.
// Now: each family (rock/fire/oil) has its own counter that advances
// one step at each placement or re-click of that type — never because of another type,
// never during a mere render (buildBoard). The RESULTING variant is stored
// per cell in cellVariant (not recomputed), so that a full buildBoard()
// (reset, reload, title image change) never reshuffles the
// visuals already placed — buildBoard() only re-reads this state, never advances it.
const OVERLAY_VARIANT_COUNTS = { rock: 8, fire: 6, oil: 8 }; // oil shares its pool with off_oil
let overlayCycleIndex = { rock: 0, fire: 0, oil: 0 };
let cellVariant = Array(COLS * ROWS).fill(null);
// Free decorations (phase 7, js/decor.js): [{ item: 1..12, x, y }], image centre in
// board pixels at 300 dpi; placement order (display follows depth, see decor.js).
let decorations = [];
// Barricades (phase 8, js/barricades.js): sorted keys "upper-lower" of the pairs of cells they separate.
let barricades = [];

function overlayFamily(type) {
  if (type === 'rock') return 'rock';
  if (type === 'fire') return 'fire';
  if (type === 'oil' || type === 'off_oil') return 'oil';
  return null;
}

// Called only from updateCell (never from buildBoard): advances the
// counter of the family concerned and stores the variant obtained for this cell.
function assignOverlayVariant(idx, type) {
  const fam = overlayFamily(type);
  if (!fam) return;
  const count = OVERLAY_VARIANT_COUNTS[fam];
  cellVariant[idx] = overlayCycleIndex[fam] % count;
  overlayCycleIndex[fam] = (overlayCycleIndex[fam] + 1) % count;
}

// Read-only, used by drawImpassable/drawFire/drawOil. Safety net:
// if a cell has this type without a stored variant (should not happen via the normal
// UI), we fall back to the old positional formula rather than crash.
function getOverlayVariant(idx, fam) {
  const count = OVERLAY_VARIANT_COUNTS[fam];
  const v = cellVariant[idx];
  return (v != null) ? v : (idx * 7) % count;
}

let transTexCache = {};

// Cooper Hewitt Bold (free SIL OFL licence) — used only for the 3-digit number
// on the Ignition badge, deliberately different from Alfa Slab One
// so as not to reuse the same style as the Vendetta title.
// Self-hosted since tranche 0b (before: loaded from the third-party GitHub repo
// rse/typopro-dtp — if that repo moved, the Ignition number disappeared).
const COOPER_HEWITT_BOLD_URL = 'fonts/cooper-hewitt/CooperHewitt-Bold.woff2';
let FONT_B64_COOPERHEWITT = null;
let COOPERHEWITT_READY = false;

// Fonts for the whole app (UI chrome + board title), both free OFL.
// woff2 format (lossless compression of the same font file, about 3 times lighter
// than the .ttf), one subfolder per font with its OFL.txt licence next to it.
// Self-hosted in the repository (fonts/ folder) rather than loaded from the
// third-party Google Fonts GitHub repo: avoids any dependency on a repo outside our
// control that could one day rename/move these files and break the
// board title + all the app chrome without any code having changed
// here — same robustness as for the app's own textures/sprites.
// Alfa Slab One: road name + app title + Vendetta/Ignition names —
// letter shapes close to the original font of the real boards (Square
// Slabserif 711 Bold, commercial, not embeddable) — see in particular capital C and R.
const ALFA_SLAB_ONE_FONT_URL = 'fonts/alfa-slab-one/AlfaSlabOne-Regular.woff2';
let FONT_B64_ALFASLABONE = null;
let ALFASLABONE_READY = false;
// Oswald (variable font): "FAN-MADE CHAPTER"/"THE", app subtitle, and
// all buttons — completely replaces Bevan, which saves the weight of one
// font to load/store as base64. Variable file: @font-face
// declares a weight range (200-700), used at 700 (bold) everywhere.
const OSWALD_BOLD_FONT_URL = 'fonts/oswald/Oswald-Variable.woff2';
let FONT_B64_OSWALD = null;
let OSWALD_READY = false;
// Neither has a truly drawn italic style: the slant of the
// board title and of the Vendetta/Ignition names is simulated by an SVG/CSS skewX,
// calibrated by comparison with a capture of a real board (12°).
const TITLE_SKEW_DEG = -12;


