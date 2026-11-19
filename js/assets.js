// ===== js/assets.js — Chemins des images et polices ; aperçus à l'écran (copie adaptée à la
// taille affichée) ; originaux en base64 pour l'export ; déblocage du bouton Export.
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés dans l'ordre fixe des <script> de index.html (seule référence).
// Le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré dans
// ce fichier ou dans les précédents ; les fonctions, appelées plus tard, voient tout.

// ---- Overlay sprite sources ----
let HAZARD_1, HAZARD_2, HAZARD_3;
let OIL_1, OIL_2;
let RAMP, MULTI_RAMP;
let MINEFIELD;
let FIRE_1, FIRE_2, FIRE_3, FIRE_4, FIRE_5, FIRE_6;
let IMP_1, IMP_2, IMP_3, IMP_4, IMP_5, IMP_6, IMP_7, IMP_8;
// Décorations de groupe (bidon, cactus, roue, pare-choc...) — 12 png dans le dossier Items/.
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
  // Les aperçus des textures doivent aussi être affichés : sans eux, le plateau ne
  // contient pas encore ses calques de texture et l'export en serait privé. Alfa Slab
  // One et Oswald bloquent l'export (utilisées dans le titre du plateau exporté).
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

// Image de titre par défaut, affichée tant que l'utilisateur n'en a pas chargé
// une via "Load title image" — rend le plateau plus accueillant dès l'ouverture
// qu'un simple fond marron uni. Chargée en tout dernier (moins prioritaire que
// textures/sprites/décorations/police), voir allSources plus bas.
const DEFAULT_TITLE_IMAGE_PATH = 'textures/TitleImage.webp';
// Blason affiché dans la bande de titre des plateaux Ignition.
const BLASON_PATH = 'sprites/BlasonIgnition.webp';

// ---- Aperçus à l'écran (tranche 1c) ----
// Méthode des fichiers « proxy » des logiciels de montage (et des dossiers par densité
// d'Android, déjà utilisée par TRV-Pocket) : l'écran affiche une copie réduite de
// chaque image, l'export utilise toujours l'original. Trois copies, mêmes noms :
// <dossier>/quarter/ (25 %), <dossier>/half/ (50 %), <dossier>/ (original), faites
// par tools/make-webp.py. On prend la plus petite qui reste nette pour la taille
// réellement affichée du format choisi (jamais une valeur fixe pensée pour le
// téléphone : un écran Retina reçoit une copie plus fine).
let DISPLAY_DIR = null;            // 'quarter/', 'half/' ou '' (original) ; null avant le choix du format
const FULL_OF_DISPLAY = {};        // adresse d'aperçu -> chemin de l'original (pour l'export)
let displayTexturesPending = 0;    // textures d'aperçu du format en cours encore en chargement

// Adresse à afficher pour une image (chemin de l'original en entrée).
function displayHref(path) {
  if (!DISPLAY_DIR) return path;
  const href = path.replace(/^([^/]+)\//, `$1/${DISPLAY_DIR}`);
  FULL_OF_DISPLAY[href] = path;
  return href;
}

// Copie d'aperçu adaptée : pixels d'écran réels du plateau / pixels de l'original.
// Forçable pour les vérifications : ?display=quarter|half|full dans l'adresse.
function pickDisplayDir() {
  const forced = new URLSearchParams(location.search).get('display');
  if (forced === 'quarter' || forced === 'half') return forced + '/';
  if (forced === 'full') return '';
  const cssWidth = Math.min(document.documentElement.clientWidth || window.innerWidth, 1200);
  const need = cssWidth * (window.devicePixelRatio || 1) / VW;
  return need <= 0.25 ? 'quarter/' : need <= 0.5 ? 'half/' : '';
}

// Appelé par applyBoardType (ui.js) à chaque choix de format : (re)charge les
// textures d'aperçu si la copie adaptée change, dans l'ordre voulu par Mayrik
// (Road, Off-Road, Muddy, puis le reste), puis lance les originaux en arrière-plan.
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
      if (DISPLAY_DIR !== dir) return; // format changé entre-temps : un autre chargement a pris le relais
      displayTexturesPending--;
    }
    updateExportButton();
    startFullResLoading();
  })();
}

// ---- Originaux (export) et polices ----
// Polices dès l'ouverture de la page (titre de l'appli, puis du plateau). Originaux
// des images en arrière-plan, une fois les aperçus du premier plateau affichés, pour
// ne pas leur disputer la connexion. Chacun est converti en base64 (fetch puis
// FileReader : pas de canevas, aucun risque CORS) pour être intégré au SVG exporté ;
// les originaux ne sont jamais décodés en image (mémoire), seul l'export les utilise.
// Le bouton Export se débloque quand tout est prêt (updateExportButton).
const LOAD = { done: 0, failed: 0, total: 0, fullStarted: false };

function updateExportButton() {
  const btn = document.getElementById('export-btn');
  const label = document.getElementById('export-label');
  const progress = document.getElementById('export-progress');
  const fontsReady = ALFASLABONE_READY && OSWALD_READY && COOPERHEWITT_READY;
  const allLoaded = LOAD.fullStarted && LOAD.done === LOAD.total && displayTexturesPending === 0
    && defaultTitleImageDecoded && fontsReady;
  if (!allLoaded) {
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
  if (allImagesReady()) {
    label.textContent = 'Download PNG';
  } else {
    label.textContent = '⚠ Reload page';
    progress.style.background = 'rgba(200,0,0,0.25)';
  }
}

// Télécharge un fichier et le garde en base64 ; pour les polices, l'enregistre aussi
// auprès du navigateur (FontFace) — nécessaire pour l'interface, pour canvas
// measureText() (calage du titre) et pour ne jamais exporter avant qu'elles soient prêtes.
function loadOne({key, src, type}) {
  return fetch(src)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); })
    .then(blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }))
    .then(dataUrl => {
      IMAGES_B64[src] = dataUrl;
      if (type === 'font') return registerFont(key, dataUrl);
      // Image de titre par défaut : ne remplace jamais une image déjà chargée par
      // l'utilisateur ; décodée dans tous les cas (voir allImagesReady).
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
  // Police variable : plage de graisse déclarée (200-700), utilisée à 700.
  oswald:       { family: 'OswaldBold',       weight: '200 700', set: d => { FONT_B64_OSWALD = d; },       ready: () => { OSWALD_READY = true; } },
  cooperhewitt: { family: 'CooperHewittBold', weight: '700',     set: d => { FONT_B64_COOPERHEWITT = d; }, ready: () => { COOPERHEWITT_READY = true; } },
};
function registerFont(key, dataUrl) {
  const f = FONT_FACES[key];
  f.set(dataUrl); // intégrée au SVG (affichage et export), voir buildBoard
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

// Originaux des images, dans l'ordre voulu par Mayrik : Road, Off-Road, Muddy, les
// Impassable un par un, puis tout le reste en parallèle (image de titre par défaut
// en dernier, la moins prioritaire).
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
    parallel.forEach(item => loadOne(item));
  })();
}

window.addEventListener('load', function () {
  // Polices d'abord : Alfa Slab One et Oswald (titre de l'appli et du plateau), puis
  // Cooper Hewitt (numéro Ignition).
  const fonts = [
    { key: 'alfaslabone', src: ALFA_SLAB_ONE_FONT_URL, type: 'font' },
    { key: 'oswald', src: OSWALD_BOLD_FONT_URL, type: 'font' },
    { key: 'cooperhewitt', src: COOPER_HEWITT_BOLD_URL, type: 'font' },
  ];
  const items = fullResItems();
  LOAD.total = fonts.length + items.sequential.length + items.parallel.length;
  (async () => { for (const f of fonts) await loadOne(f); })();
});
