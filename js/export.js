// ===== js/export.js — Export PNG à 300 dpi, image de titre personnalisée, champs nom / numéro.
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés par index.html dans un ordre fixe — config, state, geometry,
// build-board, render-layers, editing, export, assets, ui. Ne pas changer cet ordre :
// le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré
// dans ce fichier ou dans les précédents.

// ---- Export PNG ----
// All images are pre-converted to base64 at load time (IMAGES_B64).
// The export button is locked during export to prevent double-clicks.
function exportPNG() {
  const btn = document.getElementById('export-btn');
  const label = document.getElementById('export-label');

  // Check all images are truly ready before exporting
  if (!allImagesReady()) {
    alert('⚠ Some images are not fully loaded yet.\nPlease reload the page and try again.');
    return;
  }

  // Lock button during export
  btn.disabled = true;
  label.textContent = 'Preparing…';

  const svg = document.getElementById('bsvg');
  const clone = svg.cloneNode(true);
  clone.querySelectorAll('[data-idx]').forEach(e => e.remove());
  clone.setAttribute('width', String(VW));
  clone.setAttribute('height', String(VH));

  // SVG already contains base64 hrefs (set during buildBoard) — no replacement needed.
  // Render SVG to canvas and download as PNG
  const svgStr = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgStr], {type: 'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const canvas = document.createElement('canvas');
  canvas.width = VW;
  canvas.height = VH;
  const img = new Image();

  function paintAndDownload() {
    label.textContent = 'Exporting…';
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, VW, VH);
    ctx.drawImage(img, 0, 0, VW, VH);
    URL.revokeObjectURL(url);
    canvas.toBlob(b => {
      const a = document.createElement('a');
      const paperSize = BOARD_TYPE === 'ignition' ? 'A4' : 'A3';
      const name = BOARD_TYPE === 'ignition'
        ? 'Ignition-' + (document.getElementById('board-number-input').value || '').padStart(3, '0')
        : (document.getElementById('title-input').value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-') || 'RoadTile');
      a.href = URL.createObjectURL(b);
      a.download = name + '-' + paperSize + '.png';
      a.click();
      // Unlock button after download triggered
      btn.disabled = false;
      label.textContent = 'Export the .png';
    }, 'image/png');
  }

  img.onload = () => {
    // img.onload alone isn't a strong enough guarantee on Safari: for an SVG
    // containing embedded base64 images, WebKit can fire onload before those
    // inner images are fully decoded, producing an export with blank/missing
    // textures on the very first attempt (works afterwards once the browser's
    // image cache already holds fully-decoded copies of those same data URIs).
    // img.decode() explicitly waits for full decode before we paint to canvas.
    //
    // Le titre du plateau (FAN-MADE CHAPTER / THE / nom de la route) utilise les
    // polices Alfa Slab One / Oswald intégrées en base64 dans le <style> du SVG —
    // le même genre de souci s'applique au TEXTE : décoder l'image ne garantit pas que Safari a
    // fini d'appliquer cette police custom aux glyphes avant de rastériser, d'où
    // un titre parfois manquant au tout premier export après ouverture. On
    // attend en plus explicitement document.fonts.ready avant de peindre.
    //
    // Marge renforcée (setTimeout + 3 rAF au lieu de 2) : depuis que l'ombrage du
    // titre reprend aussi le contour noir sur chaque copie empilée (40+20+20
    // éléments avec fill ET stroke, au lieu du texte seul), le premier rendu de
    // ces polices custom est nettement plus lourd à calculer pour Safari — le
    // délai précédent (2 rAF) ne suffisait plus toujours en usage réel (retour
    // de Mayrik). Non vérifiable directement dans cet environnement de test
    // (pas de vrai Safari/WebKit disponible ici) : à reconfirmer en usage réel.
    const decodeStep = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    decodeStep
      .then(() => document.fonts.ready)
      .catch(() => {})
      .then(() => new Promise(resolve => setTimeout(resolve, 150)))
      .then(() => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(paintAndDownload))));
  };
  img.onerror = () => {
    btn.disabled = false;
    label.textContent = 'Export the .png';
    alert('Export failed — please try again.');
  };
  img.src = url;
}

function loadTitleImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      TITLE_IMAGE = img;
      const warn = document.getElementById('title-img-warn');
      warn.style.display = (img.width < 2000 || img.height < 200) ? 'inline' : 'none';
      document.getElementById('title-img-label').textContent = '✓ Title image loaded';
      document.getElementById('title-img-btn').style.color = '#4CAF50';
      buildBoard();
      notifyBoardChange('title-image');
    };
    img.onerror = function () {
      document.getElementById('title-img-label').textContent = '✗ Load failed';
      document.getElementById('title-img-btn').style.color = '#E8231A';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  input.value = '';
}

// Efface l'image de titre chargée par l'utilisateur et revient à celle
// préchargée par défaut à l'ouverture (DEFAULT_TITLE_IMAGE, conservée à part
// justement pour permettre ce retour en arrière). Si le chargement par défaut
// n'est pas encore terminé (ou a échoué), retombe simplement sur le fond marron
// uni — même comportement que si aucune image n'avait jamais été chargée.
function resetTitleImage() {
  TITLE_IMAGE = DEFAULT_TITLE_IMAGE;
  document.getElementById('title-img-warn').style.display = 'none';
  document.getElementById('title-img-label').textContent = 'Load title image';
  document.getElementById('title-img-btn').style.color = '';
  buildBoard();
  notifyBoardChange('title-image');
}

// Compteur de caractères du nom de route (aussi appelé par setBoardState).
function refreshTitleCounter() {
  const l = document.getElementById('title-input').value.length;
  const cc = document.getElementById('cc');
  cc.textContent = l + '/20';
  cc.style.color = l > 17 ? '#E8A84C' : '#777';
}

document.getElementById('title-input').addEventListener('input', function () {
  refreshTitleCounter();
  const newText = this.value.toUpperCase() || 'NAME OF YOUR ROAD';
  const td = document.getElementById('title-display');
  if (td) td.textContent = newText;
  const tsg = document.getElementById('title-shadow-group');
  if (tsg) tsg.querySelectorAll('text').forEach(t => { t.textContent = newText; });
  notifyBoardChange('title');
});

// Champ numéro de plateau (Ignition uniquement) : chiffres uniquement, 3 max.
document.getElementById('board-number-input').addEventListener('input', function () {
  this.value = this.value.replace(/[^0-9]/g, '').slice(0, 3);
  buildBoard();
  notifyBoardChange('number');
});

