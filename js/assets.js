// ===== js/assets.js — Chemins des images et polices, chargement au démarrage (base64 pour l'export),
// déblocage du bouton Export quand tout est prêt.
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés par index.html dans un ordre fixe — config, geometry,
// build-board, render-layers, editing, export, assets, ui. Ne pas changer cet ordre :
// le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré
// dans ce fichier ou dans les précédents.

// ---- Overlay sprite sources ----
let HAZARD_1, HAZARD_2, HAZARD_3;
let OIL_1, OIL_2;
let RAMP, MULTI_RAMP;
let MINEFIELD;
let FIRE_1, FIRE_2, FIRE_3, FIRE_4, FIRE_5, FIRE_6;
let IMP_1, IMP_2, IMP_3, IMP_4, IMP_5, IMP_6, IMP_7, IMP_8;
// Décorations de groupe (bidon, cactus, roue, pare-choc...) — 12 png dans le dossier Items/.
const ITEM_PATHS = Array.from({length: 12}, (_, i) => `items/Item-${i + 1}.png`);

function initOverlaySources() {
  HAZARD_1 = 'sprites/Hazard-1.png';  HAZARD_2 = 'sprites/Hazard-2.png';  HAZARD_3 = 'sprites/Hazard-3.png';
  OIL_1    = 'sprites/Oil-1.png';     OIL_2    = 'sprites/Oil-2.png';
  RAMP     = 'sprites/Ramp.png';      MULTI_RAMP = 'sprites/Multi-Ramp.png';
  MINEFIELD = 'sprites/Minefield.png';
  FIRE_1   = 'sprites/Fire!-1.png';   FIRE_2   = 'sprites/Fire!-2.png';   FIRE_3 = 'sprites/Fire!-3.png';
  FIRE_4   = 'sprites/Fire!-4.png';   FIRE_5   = 'sprites/Fire!-5.png';   FIRE_6 = 'sprites/Fire!-6.png';
  IMP_1    = 'sprites/Impassable-1.png'; IMP_2 = 'sprites/Impassable-2.png'; IMP_3 = 'sprites/Impassable-3.png';
  IMP_4    = 'sprites/Impassable-4.png'; IMP_5 = 'sprites/Impassable-5.png'; IMP_6 = 'sprites/Impassable-6.png';
  IMP_7    = 'sprites/Impassable-7.png';
  IMP_8    = 'sprites/Impassable-8.png';
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
  // Le fetch/base64 ne suffit pas : il faut aussi que le décodage <Image> de
  // chaque texture soit terminé, sinon le SVG peut encore référencer un chemin
  // de fichier brut au moment de l'export (voir checkFullyReady). Alfa Slab One
  // et Oswald bloquent l'export (utilisées dans le titre du plateau exporté).
  const texturesOk = Object.keys(TEXTURE_PATHS).every(key => !!TEXTURES[key]);
  return fetchesOk && texturesOk && defaultTitleImageDecoded && ALFASLABONE_READY && OSWALD_READY;
}

// Texture paths — used as href in SVG and as keys in IMAGES_B64 (must match exactly)
const TEXTURE_PATHS = {
  road:  'textures/Texture-Road.png',
  goo:   'textures/Texture-Toxic-Goo.png',
  mud:   'textures/Texture-Muddy.png',
  sand:  'textures/Texture-Off-Road.png',
  salt:  'textures/Texture-Salt-Flats.png',
  glass: 'textures/Texture-Desert-Glass.png',
};

// Image de titre par défaut, affichée tant que l'utilisateur n'en a pas chargé
// une via "Load title image" — rend le plateau plus accueillant dès l'ouverture
// qu'un simple fond marron uni. Chargée en tout dernier (moins prioritaire que
// textures/sprites/décorations/police), voir allSources plus bas.
const DEFAULT_TITLE_IMAGE_PATH = 'textures/TitleImage.png';
// Blason affiché dans la bande de titre des plateaux Ignition.
const BLASON_PATH = 'sprites/BlasonIgnition.png';

// ---- Load all images at startup ----
// Strategy:
// 1. Road texture is loaded first so the board appears immediately on launch.
// 2. All other images load in parallel afterward.
// 3. Each image is converted to base64 (for CORS-safe export) immediately after loading.
// 4. The Export button unlocks only when every base64 conversion is confirmed complete.
window.addEventListener('load', function () {
  const btn = document.getElementById('export-btn');
  const label = document.getElementById('export-label');
  const progress = document.getElementById('export-progress');

  const overlaySources = [
    HAZARD_1, HAZARD_2, HAZARD_3,
    OIL_1, OIL_2,
    RAMP, MULTI_RAMP, MINEFIELD,
    FIRE_1, FIRE_2, FIRE_3, FIRE_4, FIRE_5, FIRE_6,
    IMP_1, IMP_2, IMP_3, IMP_4, IMP_5, IMP_6, IMP_7, IMP_8,
    ...ITEM_PATHS,
    ...Object.values(EDGE_PATHS),
    BLASON_PATH,
  ];

  // Road loads first, then all others in parallel
  const otherTextures = Object.entries(TEXTURE_PATHS).filter(([k]) => k !== 'road');
  const allSources = [
    {key:'road', src: TEXTURE_PATHS.road, type:'texture'},       // ← Road first
    ...otherTextures.map(([key, src]) => ({key, src, type:'texture'})),
    ...overlaySources.map(src => ({key: null, src, type:'overlay'})),
    {key: 'cooperhewitt', src: COOPER_HEWITT_BOLD_URL, type:'font'},
    {key: 'alfaslabone', src: ALFA_SLAB_ONE_FONT_URL, type:'font'},
    {key: 'oswald', src: OSWALD_BOLD_FONT_URL, type:'font'},
    {key: null, src: DEFAULT_TITLE_IMAGE_PATH, type:'defaultTitle'}, // ← chargée en dernier, moins prioritaire
  ];

  let converted = 0;
  let failed = 0;
  const total = allSources.length;

  // Le décodage des images <Image> (utilisées pour l'affichage ET l'export) est
  // asynchrone et séparé du téléchargement/conversion base64 — il faut attendre
  // les deux avant de débloquer l'export, sinon l'export peut partir avec une
  // texture encore non rafraîchie dans le SVG (bug observé sur Safari, plus lent
  // à décoder, où la fenêtre de course entre les deux devient visible).
  const textureKeys = Object.keys(TEXTURE_PATHS);
  let texturesDecoded = 0;

  function checkFullyReady() {
    if (converted !== total || texturesDecoded !== textureKeys.length || !defaultTitleImageDecoded || !ALFASLABONE_READY || !OSWALD_READY || !COOPERHEWITT_READY) return;
    if (allImagesReady()) {
      // Reconstruction finale pour garantir que le SVG (et donc l'export) ne
      // référence plus aucun chemin de fichier brut, seulement du base64.
      buildBoard();
      btn.disabled = false;
      btn.style.opacity = '1';
      label.textContent = 'Export the .png';
      progress.style.width = '0%';
    } else {
      btn.disabled = false;
      btn.style.opacity = '1';
      label.textContent = '⚠ Reload page';
      progress.style.background = 'rgba(200,0,0,0.25)';
    }
  }

  function onOneDone(success) {
    converted++;
    if (!success) failed++;
    const pct = Math.round(converted / total * 100);
    progress.style.width = pct + '%';
    label.textContent = `Loading… ${pct}%`;
    checkFullyReady();
  }

  // Load via fetch() → FileReader.readAsDataURL()
  // Most reliable method : bypasses canvas entirely, no CORS "tainted" risk.
  // For textures, an Image object is also created for SVG display.
  function loadOne({key, src, type}) {
    return new Promise(resolve => {
      fetch(src)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.blob();
        })
        .then(blob => {
          const reader = new FileReader();
          reader.onload = function (e) {
            // Store base64 directly from FileReader — no canvas involved
            IMAGES_B64[src] = e.target.result;

            // For textures, also create an Image for SVG display
            if (type === 'texture') {
              const img = new Image();
              img.onload = function () {
                TEXTURES[key] = img;
                texturesDecoded++;
                buildBoard();
                checkFullyReady();
              };
              img.onerror = function () {
                // Le décodage a échoué : on compte quand même l'étape comme "traitée"
                // pour ne pas bloquer indéfiniment, allImagesReady() détectera le manque.
                texturesDecoded++;
                checkFullyReady();
              };
              img.src = e.target.result;
            }

            // For the title font(s): embed in the SVG right away (for display/export),
            // AND register via the FontFace API so document.fonts truly has it loaded —
            // required both for canvas measureText() (pixel-precise title alignment)
            // and to guarantee export never fires before it's really ready.
            if (type === 'font' && key === 'cooperhewitt') {
              FONT_B64_COOPERHEWITT = e.target.result;
              buildBoard();
              try {
                const face = new FontFace('CooperHewittBold', `url(${e.target.result})`, {style: 'normal', weight: '700'});
                face.load().then(loaded => {
                  document.fonts.add(loaded);
                  COOPERHEWITT_READY = true;
                  buildBoard();
                  checkFullyReady();
                }).catch(() => { checkFullyReady(); });
              } catch (e) {
                checkFullyReady();
              }
            }
            if (type === 'font' && key === 'alfaslabone') {
              FONT_B64_ALFASLABONE = e.target.result;
              buildBoard();
              try {
                const face = new FontFace('AlfaSlabOne', `url(${e.target.result})`, {style: 'normal', weight: '400'});
                face.load().then(loaded => {
                  document.fonts.add(loaded);
                  ALFASLABONE_READY = true;
                  buildBoard();
                  checkFullyReady();
                  fitAllTitleStacks();
                }).catch(() => { checkFullyReady(); });
              } catch (e) {
                checkFullyReady();
              }
            }
            if (type === 'font' && key === 'oswald') {
              FONT_B64_OSWALD = e.target.result;
              buildBoard();
              try {
                // Police variable : plage de graisse déclarée (200-700), on charge
                // à 700 (gras) — c'est le seul poids utilisé pour ce titre.
                const face = new FontFace('OswaldBold', `url(${e.target.result})`, {style: 'normal', weight: '200 700'});
                face.load().then(loaded => {
                  document.fonts.add(loaded);
                  OSWALD_READY = true;
                  buildBoard();
                  checkFullyReady();
                  fitAllTitleStacks();
                }).catch(() => { checkFullyReady(); });
              } catch (e) {
                checkFullyReady();
              }
            }

            // Image de titre par défaut : ne remplace jamais une image déjà chargée
            // par l'utilisateur (loadTitleImage a pu s'exécuter entre-temps, même si
            // cette source est la dernière de la file) — on décode quand même dans
            // tous les cas, l'export en a besoin (voir allImagesReady).
            if (type === 'defaultTitle') {
              const img = new Image();
              img.onload = function () {
                DEFAULT_TITLE_IMAGE = img;
                if (!TITLE_IMAGE) { TITLE_IMAGE = img; buildBoard(); }
                defaultTitleImageDecoded = true;
                checkFullyReady();
              };
              img.onerror = function () {
                defaultTitleImageDecoded = true;
                checkFullyReady();
              };
              img.src = e.target.result;
            }

            onOneDone(true);
            resolve();
          };
          reader.onerror = function () {
            console.warn('FileReader failed:', src);
            if (type === 'defaultTitle') defaultTitleImageDecoded = true;
            onOneDone(false);
            resolve();
          };
          reader.readAsDataURL(blob);
        })
        .catch(e => {
          console.warn('Fetch failed:', src, e);
          if (type === 'defaultTitle') defaultTitleImageDecoded = true;
          onOneDone(false);
          resolve();
        });
    });
  }

  // Ordre de chargement strictement séquentiel demandé par Mayrik : polices du
  // titre/chrome (Alfa Slab One + Oswald) → Road → Off-Road → Muddy → tous les
  // PNG Impassable → le reste en parallèle. Chaque étape attend la précédente
  // (via await), donc c'est du temps total un peu plus long que du tout-parallèle,
  // mais ça garantit cet ordre exact plutôt qu'une simple priorité "en tête de peloton".
  const alfaItem  = allSources.find(s => s.key === 'alfaslabone');
  const oswaldItem = allSources.find(s => s.key === 'oswald');
  const roadItem  = allSources.find(s => s.key === 'road');
  const sandItem  = allSources.find(s => s.key === 'sand');
  const mudItem   = allSources.find(s => s.key === 'mud');
  const impItems  = allSources.filter(s => s.src.includes('Impassable'));
  const priorityItems = [alfaItem, oswaldItem, roadItem, sandItem, mudItem, ...impItems];
  const restItems = allSources.filter(s => !priorityItems.includes(s));

  (async () => {
    for (const item of priorityItems) await loadOne(item);
    restItems.forEach(item => loadOne(item));
  })();
});

