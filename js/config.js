// ===== js/config.js — Constantes et état du plateau : types de cases, géométrie à 300 dpi
// (formats Vendetta / Ignition), variantes d'overlay, polices du titre.
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés dans l'ordre fixe des <script> de index.html (seule référence).
// Le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré dans
// ce fichier ou dans les précédents ; les fonctions, appelées plus tard, voient tout.

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
// Référence conservée séparément de TITLE_IMAGE (qui peut être remplacée par
// l'utilisateur) pour pouvoir revenir à l'image par défaut via "Reset title image".
let DEFAULT_TITLE_IMAGE = null;
// Vrai une fois que l'image de titre par défaut est fetchée ET décodée (que
// l'utilisateur l'ait déjà remplacée par la sienne ou non) — nécessaire pour
// l'export même si elle n'est plus affichée, voir allImagesReady().
let defaultTitleImageDecoded = false;
// ---- Board geometry (300dpi) ----
// Vendetta = A3 paysage (420×297mm @300dpi = 4961×3508px), Ignition = A4 portrait
// (210×297mm @300dpi = 2481×3508px) — même hauteur dans les deux cas (297mm),
// seule la largeur change. COLS/VW deviennent donc des variables dépendant du
// type de plateau choisi, au lieu de constantes figées pour 8 colonnes.
const VH = 3508, NOTCH = 50, CELL_SLOT = 493, ROWS = 6;
const BOARD_TYPES = {
  vendetta: { cols: 8, vw: 4961, label: 'Vendetta' },
  ignition: { cols: 4, vw: 2481, label: 'Ignition' },
};
let BOARD_TYPE = 'vendetta';
let COLS = BOARD_TYPES[BOARD_TYPE].cols;
let VW   = BOARD_TYPES[BOARD_TYPE].vw;

// Décalage horizontal du quinconce : la moitié de l'écart entre les deux
// positions alternées de gauche des lignes. Propriété intrinsèque de la forme
// des cases (le chevron/notch), indépendante de la largeur du plateau — donc
// une constante, quel que soit COLS/VW.
const QUINCONCE_HALF_SHIFT = 97.5;

// Hauteurs de ligne (haut/bas) : ne dépendent que de ROWS, jamais de COLS —
// mêmes valeurs quel que soit le type de plateau.
const ROW_TOPS_BOTS = [
  {top:164,  bot:620},  // title
  {top:620,  bot:1072}, // row1 (odd)
  {top:1072, bot:1526}, // row2 (even)
  {top:1526, bot:1978}, // row3 (odd)
  {top:1978, bot:2432}, // row4 (even)
  {top:2432, bot:2884}, // row5 (odd)
  {top:2884, bot:3338}, // row6 (even)
];

// Construit BANDS pour la largeur de plateau courante : centre COLS*CELL_SLOT
// sur VW, puis alterne ±QUINCONCE_HALF_SHIFT autour de ce centre selon la
// parité de ligne — généralise les anciennes valeurs figées (606/411 pour
// COLS=8) à n'importe quelle largeur de plateau.
function computeBands() {
  const avgLeft = (VW - COLS * CELL_SLOT) / 2;
  return ROW_TOPS_BOTS.map((rb, i) => ({
    top: rb.top, bot: rb.bot,
    left: i % 2 === 0 ? avgLeft + QUINCONCE_HALF_SHIFT : avgLeft - QUINCONCE_HALF_SHIFT,
  }));
}
let BANDS = computeBands();

// Rectangle sur lequel chaque texture plein-plateau est étirée avant d'être
// découpée case par case (voir getSharedTextureImage) — doit toujours couvrir
// large (toutes les lignes, quelle que soit leur parité), généralisé de la
// même façon que BANDS au lieu de 4 valeurs figées pour COLS=8.
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

// Rectangle sur lequel chaque texture de terrain est posée, puis découpée case par
// case. Les textures sources de Mayrik font 4243 × 2718 px : la zone des cases
// Vendetta à 300 dpi (4239 × 2718, plus 2 px de marge de chaque côté). Elles sont
// posées à cette taille exacte, sans redimensionnement (1 pixel de texture = 1 pixel
// imprimé), centrées sur la zone des cases du format en cours ; les cases ayant la
// même taille physique dans tous les formats, Ignition en montre la partie centrale,
// à la même échelle. Historique (19/11) : la v1.00 utilisait des copies réduites à
// 3000 × 1922, agrandies ×1,41 (environ 212 dpi réels), et ajustées à la zone de
// chaque format — en Ignition, écrasées à 0,76 en largeur pour 1,41 en hauteur.
const TEXTURE_W = 4243, TEXTURE_H = 2718;
function textureRect() {
  return { x: GAME_X + (GAME_W - TEXTURE_W) / 2, y: GAME_Y + (GAME_H - TEXTURE_H) / 2, w: TEXTURE_W, h: TEXTURE_H };
}

// Type des cases d'un plateau neuf (demande des utilisateurs, Mayrik 19/11 : Off-Road,
// au lieu de Road en v1.00) et type sélectionné au départ dans la palette (Road : ce
// qu'on peint en premier sur un fond Off-Road).
const DEFAULT_TILE = 'sand';
let sel = 'road';
let board = Array(COLS * ROWS).fill(DEFAULT_TILE);

// ---- Variantes d'overlay (Impassable/Oil/Fire) : cycle + mémoire par case ----
// Avant : la variante était une pure fonction de la position (col + row*2) % N,
// recalculée à chaque rendu — deux cases éloignées pouvaient tomber sur le même
// visuel par hasard, et l'utilisateur n'avait aucun moyen de choisir.
// Maintenant : chaque famille (rock/fire/oil) a son propre compteur qui avance
// d'un cran à chaque pose ou reclic de ce type — jamais à cause d'un autre type,
// jamais lors d'un simple rendu (buildBoard). La variante RÉSULTANTE est mémorisée
// par case dans cellVariant (pas recalculée), afin qu'un buildBoard() complet
// (reset, reload, changement d'image de titre) ne rebatte jamais les cartes des
// visuels déjà posés — buildBoard() ne fait que relire cet état, jamais l'avancer.
const OVERLAY_VARIANT_COUNTS = { rock: 8, fire: 6, oil: 8 }; // oil partage son pool avec off_oil
let overlayCycleIndex = { rock: 0, fire: 0, oil: 0 };
let cellVariant = Array(COLS * ROWS).fill(null);
// Décorations libres (phase 7, js/decor.js) : [{ item: 1..12, x, y }], centre de l'image en
// pixels du plateau à 300 dpi ; ordre de pose (l'affichage suit la profondeur, voir decor.js).
let decorations = [];

function overlayFamily(type) {
  if (type === 'rock') return 'rock';
  if (type === 'fire') return 'fire';
  if (type === 'oil' || type === 'off_oil') return 'oil';
  return null;
}

// Appelé uniquement depuis updateCell (jamais depuis buildBoard) : avance le
// compteur de la famille concernée et mémorise la variante obtenue pour cette case.
function assignOverlayVariant(idx, type) {
  const fam = overlayFamily(type);
  if (!fam) return;
  const count = OVERLAY_VARIANT_COUNTS[fam];
  cellVariant[idx] = overlayCycleIndex[fam] % count;
  overlayCycleIndex[fam] = (overlayCycleIndex[fam] + 1) % count;
}

// Lecture seule, utilisée par drawImpassable/drawFire/drawOil. Filet de sécurité :
// si une case a ce type sans variante mémorisée (ne devrait pas arriver via l'UI
// normale), on retombe sur l'ancienne formule positionnelle plutôt que de planter.
function getOverlayVariant(idx, fam) {
  const count = OVERLAY_VARIANT_COUNTS[fam];
  const v = cellVariant[idx];
  return (v != null) ? v : (idx * 7) % count;
}

let transTexCache = {};

// Cooper Hewitt Bold (licence libre SIL OFL) — utilisée uniquement pour le numéro
// à 3 chiffres sur le blason Ignition, volontairement différente d'Alfa Slab One
// pour ne pas reprendre le même style que le titre Vendetta.
// Auto-hébergée depuis la tranche 0b (avant : chargée depuis le dépôt GitHub tiers
// rse/typopro-dtp — si ce dépôt bougeait, le numéro Ignition disparaissait).
const COOPER_HEWITT_BOLD_URL = 'fonts/cooper-hewitt/CooperHewitt-Bold.woff2';
let FONT_B64_COOPERHEWITT = null;
let COOPERHEWITT_READY = false;

// Polices de toute l'appli (chrome UI + titre de plateau), toutes deux libres OFL.
// Format woff2 (compression sans perte du même fichier de police, environ 3 fois plus
// léger que le .ttf), un sous-dossier par police avec sa licence OFL.txt à côté.
// Auto-hébergées dans le dépôt (dossier fonts/) plutôt que chargées depuis le
// dépôt GitHub tiers de Google Fonts : évite toute dépendance à un repo hors de
// contrôle qui pourrait un jour renommer/déplacer ces fichiers et casser le
// titre du plateau + tout le chrome de l'appli sans qu'aucun code n'ait changé
// ici — même robustesse que pour les propres textures/sprites de l'appli.
// Alfa Slab One : nom de la route + titre de l'appli + noms Vendetta/Ignition —
// formes de lettres proches de la police d'origine des vrais plateaux (Square
// Slabserif 711 Bold, commerciale, non intégrable) — voir notamment C et R majuscules.
const ALFA_SLAB_ONE_FONT_URL = 'fonts/alfa-slab-one/AlfaSlabOne-Regular.woff2';
let FONT_B64_ALFASLABONE = null;
let ALFASLABONE_READY = false;
// Oswald (police variable) : "FAN-MADE CHAPTER"/"THE", sous-titre de l'appli, et
// tous les boutons — remplace complètement Bevan, ce qui économise le poids d'une
// police en moins à charger/stocker en base64. Fichier variable : @font-face
// déclare une plage de graisse (200-700), utilisée à 700 (gras) partout.
const OSWALD_BOLD_FONT_URL = 'fonts/oswald/Oswald-Variable.woff2';
let FONT_B64_OSWALD = null;
let OSWALD_READY = false;
// Ni l'une ni l'autre n'a de véritable style italique dessiné : l'inclinaison du
// titre de plateau et des noms Vendetta/Ignition est simulée par un skewX SVG/CSS,
// calibré par comparaison avec une capture d'un vrai plateau (12°).
const TITLE_SKEW_DEG = -12;


