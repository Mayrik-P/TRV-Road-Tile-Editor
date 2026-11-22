// ===== js/project.js — Fichier de projet .trvtile (tranche 4d) : « Save project » dans l'éditeur,
// « Open project » sur l'écran d'accueil.
//
// Script classique (pas de module) : tous les fichiers js/ partagent la même portée
// globale et sont chargés dans l'ordre fixe des <script> de index.html (seule référence).
// Le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est déclaré dans
// ce fichier ou dans les précédents ; les fonctions, appelées plus tard, voient tout.
//
// Modèle : les fichiers de projet des éditeurs (Tiled : .tmx / .tmj en JSON) — un fichier
// lisible, signé (champ format) et versionné (formatVersion) pour que les versions suivantes
// sachent relire les anciens, qui se suffit à lui-même (image de titre personnalisée
// intégrée). Contenu :
//   { format: 'trv-road-tile', formatVersion: 1, app, savedAt,
//     board: getBoardState() (porte sa propre version), titleImage: data: URL ou null }
// Ouvrir un projet remplace le plateau en cours ; s'il y en avait un dans la page, Ctrl+Z
// le ramène (une étape). Fichier refusé sans rien modifier : pas un projet, abîmé, ou
// d'une version plus récente de l'éditeur. Base de l'export vers TRV-Pocket (phase 9).

const PROJECT_FORMAT = 'trv-road-tile';
const PROJECT_FORMAT_VERSION = 1;
const PROJECT_EXT = '.trvtile';

// Nom de fichier commun au PNG exporté et au projet (nom de la route, ou numéro Ignition).
function boardFileBaseName() {
  return BOARD_TYPE === 'ignition'
    ? 'Ignition-' + (document.getElementById('board-number-input').value || '').padStart(3, '0')
    : (document.getElementById('title-input').value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-') || 'RoadTile');
}

function saveProject() {
  const custom = TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE;
  const project = {
    format: PROJECT_FORMAT,
    formatVersion: PROJECT_FORMAT_VERSION,
    app: 'TRV Road Tile Editor',
    savedAt: new Date().toISOString(),
    board: getBoardState(),
    titleImage: custom ? TITLE_IMAGE.src : null,
  };
  const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = boardFileBaseName() + PROJECT_EXT;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// Vérifie un projet lu dans un fichier : message d'erreur pour l'utilisateur, ou null.
function checkProject(p) {
  if (!p || typeof p !== 'object' || p.format !== PROJECT_FORMAT) return 'This file is not a TRV Road Tile Editor project.';
  if (typeof p.formatVersion !== 'number' || p.formatVersion > PROJECT_FORMAT_VERSION)
    return 'This project was saved with a newer version of the editor. Please reload the page to get the latest version.';
  if (validateBoardState(p.board) !== null) return 'This project file is damaged and cannot be opened.';
  if (p.titleImage != null && !(typeof p.titleImage === 'string' && p.titleImage.startsWith('data:image/')))
    return 'This project file is damaged and cannot be opened.';
  return null;
}

function openProjectFile(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let project = null;
    try { project = JSON.parse(reader.result); } catch (e) {}
    const err = checkProject(project);
    if (err) { warnUser('⚠ ' + err); return; }
    applyProject(project);
  };
  reader.onerror = () => warnUser('⚠ The file could not be read.');
  reader.readAsText(file);
}

function applyProject(project) {
  const previous = undoHistory.current; // plateau en cours dans cette page, s'il y en a un
  setBoardState(project.board);         // 'restore' : nouveau point de départ de l'historique
  if (previous) { undoHistory.past = [previous]; updateHistoryButtons(); } // Ctrl+Z ramène l'ancien
  if (project.titleImage) {
    const img = new Image();
    img.onload = () => applyTitleImage(img);
    img.onerror = () => warnUser('⚠ The title image in this project could not be read.');
    img.src = project.titleImage;
  } else if (TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE) {
    resetTitleImage();
  }
}
