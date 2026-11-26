# TRV ROAD TILE EDITOR — contexte pour Claude Code

Éditeur web de tuiles de route pour **Thunder Road: Vendetta** et **Ignition** (éditeur Restoration
Games) : on peint les cases d'un plateau puis on exporte un PNG à 300 dpi, à imprimer (A3 / A4 ;
Tabloid / Letter, PDF). **Version 1.2 publiée le 22/11** (site officiel = branche `main`). Projet personnel de Mayrik, lié de loin à **TRV-Pocket**
(`Mayrik-P/TRV-Pocket`, privé), dont on réutilise le savoir-faire (polices, sons, copies réduites
des images, format des tuiles). Dépôt public `Mayrik-P/TRV-Road-Tile-Editor`, servi tel quel
(GitHub Pages, aucune étape de construction).

Les illustrations appartiennent à l'éditeur du jeu : les exports sont réservés à un usage personnel.

**Plan de développement de référence : `docs/roadmap.md`** (phases, tranches, décisions de Mayrik).
Le lire avant tout travail.

---

## 1. Avec qui tu travailles

- Mayrik n'est **pas programmeur** : expliquer simplement chaque étape et chaque commande. Il
  travaille sur Mac ; dossier local du projet :
  `/Users/mayrik/HDD Mayrik/Perso/JeuxSociete/Thunder Road/TRV_Road_Tile_Editor`
  (fichier de création = ses ressources de travail ; sauvegarde de la v1.00 dans
  « Sauvegarde version actuelle (v1.00 - 2026-11-19) »).
- **Langue** : échanges en **français** ; textes affichés, noms de fichiers, code et **commentaires du code
  en anglais** (décision de Mayrik du 23/11, projet ouvert à la communauté) ; messages de commit en
  **français**. Nom de l'auteur : **Mayrik PADEY** (à la française).
- Mayrik n'est **pas graphiste** : il assemble des images sous Photoshop à partir de ressources
  gratuites. Ne pas lui demander de dessiner : donner des gabarits, des tailles exactes, des essais.

### Ses préférences de travail (à respecter toujours)
- **Chercher ce qui s'est fait ailleurs** pour le même type de problème, puis proposer des solutions
  **éprouvées**, fiables, très compatibles, simples à maintenir et à faire évoluer. Comparer à des cas
  similaires plutôt qu'inventer. Les PR externes sont une source d'idées, toujours réévaluées.
- **Demander confirmation avant toute suppression** (fichier, dossier, fonction, image, son).
- **Petites tranches** : chaque tranche laisse l'appli complète et utilisable.
- **Vérifier dans un vrai navigateur** (Chromium via Playwright), ordinateur ET téléphone, avec
  captures — pas seulement par des tests.
- À chaque étape livrée : dire clairement **quels fichiers ont changé** et **lesquels n'ont pas changé**.
- Ne jamais deviner une valeur ou un comportement : mesurer, vérifier. Signaler toute erreur trouvée,
  y compris les siennes.
- **Sous-conversations et choix du modèle (Mayrik, 19/11)** : utiliser librement l'outil Agent, en
  choisissant le modèle et l'effort selon chaque sous-tâche — modèle léger / effort bas pour les tâches
  longues et mécaniques (conversions d'images, inventaires, séries de vérifications, recherches
  documentaires), modèle puissant / effort élevé pour la conception délicate. Leur résultat est
  **toujours vérifié** avant d'être annoncé. Les décisions de Mayrik et les choix techniques ne se
  délèguent pas.

---

## 2. Organisation du dépôt (depuis la tranche 0a)

- `index.html` : structure de la page seulement.
- `css/app.css` : styles d'origine, **surchargés** par `css/paper-ui.css` (chargée après) : style de
  TRV-Pocket (phase 3, validé le 19/11) — papier grainé, Anton (titres, boutons) et D-DIN Condensed
  (textes) dans `fonts/anton/` et `fonts/d-din/`, boutons en chevron (Undo vers la gauche), palette à
  sélection orange. Toute nouvelle règle d'interface va dans `paper-ui.css`.
- `js/*.js` : **scripts classiques** (pas de modules) qui partagent la même portée globale, chargés
  dans l'**ordre fixe des `<script>` de `index.html`** (seule référence). Le code exécuté au chargement
  d'un fichier ne peut utiliser que ce qui est déclaré dans ce fichier ou les précédents.
- Plateau neuf : toutes les cases en `DEFAULT_TILE` (Off-Road, `js/config.js`) ; Road sélectionné au
  départ dans la palette.
- **État et signal (tranche 0c, `js/state.js`)** : toute modification passe par un point d'entrée
  unique (`updateCell`, `selectTileType`, `chooseBoardType`, `setBoardState`, champs et image de titre)
  qui émet UN signal `change` sur `boardEvents` (raisons : `cell`, `new-board`, `restore`, `title`,
  `number`, `title-image`). Annuler/Rétablir, sauvegarde et sons s'y **abonnent** ; ne jamais ajouter
  de crochet ailleurs. `getBoardState()` / `setBoardState()` : photo complète (JSON, champ `version`)
  et restauration ; l'image de titre personnalisée n'en fait pas partie.
- **Annuler / Rétablir (tranche 2a, `js/history.js`)** : historique par photos (`getBoardState`),
  abonné au signal ; frappe du nom / numéro fusionnée en une étape ; un geste en plusieurs
  modifications (pinceau) s'entoure de `beginAction()` / `endAction()` pour ne faire qu'une étape.
  Ctrl+Z / Ctrl+Y / Ctrl+Maj+Z (Cmd sur Mac), inactifs dans les champs de texte et sur l'accueil.
- **Pinceau (tranche 2b, `js/brush.js`)** : Pointer Events sur tout le plateau (plus d'écouteur de clic
  par case) ; un coup de pinceau = une étape ; 1re case = un clic (visuel suivant d'une case à
  variantes), cases déjà du bon type ignorées en glissant ; doigt : `touch-action: pinch-zoom`, un 2e
  doigt annule le coup en cours (`cancelAction`).
- **Clavier (tranche 2d, `js/keyboard.js`, réécriture de la PR #2)** : flèches = curseur (calque
  `layer-cursor`, retiré de l'export), lettres = choisir et poser (défilement des types de même lettre
  sur la même case), Entrée / Espace = poser, Suppr / Retour arrière = remettre en `DEFAULT_TILE`,
  `?` = panneau des raccourcis (`#shortcut-help`). Le curseur suit le signal (`cell`).
- **Sauvegarde automatique (tranches 4a + 4b, `js/autosave.js`, d'après la PR #1)** : plateau dans
  `localStorage` (clé `trv_road_tile_board_v1`) à chaque modification, image de titre personnalisée
  dans IndexedDB (`idb-keyval` 6.2.1, `js/vendor/`, licence Apache 2.0) ; écran d'accueil avec
  « Continue » ; nouveau plateau depuis l'accueil = Ctrl+Z ramène l'ancien (`setHistoryBaseline`) ;
  stockage interdit ou sauvegarde abîmée : l'appli marche sans. « Clear board » (`clearBoard`, une
  étape d'annulation) et « Home » (`goHome`, rien de perdu) remplacent l'ancien « Reset road tile ».
- **Fichier de projet (tranche 4d, `js/project.js`)** : `.trvtile` = JSON `{format: 'trv-road-tile',
  formatVersion, board: getBoardState(), titleImage}` ; « Save project » (éditeur), « Open project
  file » (accueil) ; `boardFileBaseName()` donne le nom commun au PNG et au projet. Toute évolution du
  contenu augmente `formatVersion` avec une conversion des anciens fichiers. Toute évolution de la photo du plateau
  change `BOARD_STATE_VERSION` (et la clé) avec une conversion des anciennes sauvegardes.
- **Sons (phase 6, `js/sounds.js`)** : howler.js 2.2.4 (`js/vendor/`, MIT), MP3 de TRV-Pocket dans
  `sounds/` (CC0, `sounds/CREDITS.md`) ; table des moments `SOUND_TABLE` (volume propre possible : export à 50 %), un seul point de passage
  `playSound(moment)` (70 ms au moins entre deux mêmes sons). Sources : le signal du plateau (pose,
  pinceau et Clear board lus dans `undoHistory.actionKind`, posé par `beginAction(kind)` ; Annuler /
  Rétablir), un seul écouteur de clic pour tous les boutons (`data-sound="palette"` / `"none"`), l'export
  terminé, et `warnUser(message)` (son de refus + `alert`, à utiliser pour tout message d'erreur).
  Bouton haut-parleur `#sound-btn` dans la bande du titre, choix retenu (`trv_road_tile_sound_v1`).
- **Décorations libres (phase 7, `js/decor.js`)** : `decorations` = `[{item, x, y}]` (centre, pixels à
  300 dpi) dans la photo du plateau (`BOARD_STATE_VERSION` 2, `upgradeBoardState` relit la v1 ; clé
  `trv_road_tile_board_v2` ; projet format 2). Points d'entrée `addDecoration` / `moveDecoration` /
  `removeDecoration` (signal `decor`). Mode `decor.mode` : « paint » (pinceau) ou « decor » (vignette
  choisie) ; gestes en capture sur `#bsvg`, avant le pinceau. Calque `layer-decor` SOUS les masques
  (coupé aux marges, déborde sur la bande de titre), sélection et ✕ dans `layer-decor-ui` (retiré de
  l'export). Cercles de prise mesurés par dessin (`DECOR_SHAPES`). Vignettes : `items/thumb/`
  (`python3 tools/make-decor-thumbs.py`, à relancer si une décoration change).
- **Crédits (phase 6 bis, `js/credits.js`)** : SEULE liste des crédits (comme TRV-Pocket) : toute ressource
  ajoutée (son, image, police, bibliothèque) s'y inscrit, avec son fichier de licence (texte affiché tel
  quel, replié). Bouton « Credits » de l'accueil, fenêtre `<dialog id="credits">` (`openCredits`,
  `js/ui.js`). `tools/check-credits.js` échoue si une police ou une bibliothèque du dépôt n'y est pas.
- `fonts/<police>/` : polices en woff2 avec leur licence `OFL.txt` (Alfa Slab One, Oswald, Cooper
  Hewitt pour le plateau ; Anton, D-DIN Condensed pour l'interface). Jamais de police chargée depuis
  Internet.
- `textures/`, `sprites/`, `items/`, `edges/` : images à 300 dpi chargées par la page, en **WebP qualité
  95** (tranche 1a). Originaux sans perte (PNG) dans `<dossier>/source/`, jamais chargés par la page ;
  **`python3 tools/make-webp.py [dossier]`** en tire les WebP (à relancer dès qu'un original change ou
  s'ajoute). Réglages validés par le test à l'aveugle de Mayrik du 19/11 (5/20 à taille réelle, 13/20
  en ×2 : aucune différence perçue). Le même script fait les **aperçus** `<dossier>/half/` (50 %) et
  `<dossier>/quarter/` (25 %), toujours tirés des PNG. **Exception** : les 6 textures de terrain
  sources (4243 × 2718 px = zone des cases Vendetta à 300 dpi) ne sont pas dans le dépôt (Mayrik les
  garde en local) ; les redéposer dans `textures/source/` pour régénérer leurs WebP. Elles sont posées
  à leur taille exacte, centrées sur la zone des cases, même échelle dans tous les formats
  (`textureRect()`, `js/config.js`).
- **Aperçus à l'écran, originaux à l'export (tranche 1c)** : toute image affichée passe par
  `displayHref(chemin de l'original)` (jamais de base64 dans la page). La copie est choisie par
  `setDisplayVariant()` à chaque choix de format : la plus petite qui reste nette pour la taille
  réellement affichée (largeur × densité de l'écran / largeur du plateau) ; forçable par
  `?display=quarter|half|full`. Les originaux sont téléchargés en arrière-plan après les aperçus,
  gardés en base64 (`IMAGES_B64`, jamais décodés), et `exportPNG` remplace chaque aperçu par son
  original dans la copie exportée (un original manquant arrête l'export).
  Téléchargements jamais suspendus (22/11, export bloqué à 98 % chez Mayrik) : `fetchWithRetry`
  abandonne une tentative sans aucune donnée depuis 20 s (`LOAD_STALL_MS`, `?stalltimeout=` pour les
  tests), 3 essais (1 s, 3 s), puis « ⚠ Reload page » ; au plus 4 téléchargements à la fois
  (`LOAD_PARALLEL`, sinon ceux en file d'attente seraient pris pour suspendus).
- **Fenêtre d'export (`#export-dialog`, `js/export.js`)** : « Export image » (`#export-open-btn`)
  l'ouvre ; elle donne la consigne d'impression (100 % / Actual size) et contient le vrai bouton
  d'export `#export-btn` (« Download PNG », débloqué quand les originaux sont chargés). Le PNG porte
  300 dpi (bloc `pHYs`, `withPngDpi`). Clavier et Ctrl+Z inactifs tant qu'elle est ouverte.
- **Papier (tranche 5b, `PAPERS` / `currentPaper()` / `pageOffset()`, `js/export.js`)** : International
  (A3 / A4 = le plateau lui-même) ou US (Tabloid / Letter : plateau centré, décalage entier), choisi
  dans la fenêtre d'export, retenu (`localStorage`), US par défaut selon la région du navigateur. Les
  tests d'export forcent `locale: 'en-GB'` (International) pour rester comparables.
- **Export PDF (tranche 5c)** : `exportPNG('pdf')`, bouton `#export-pdf-btn` ; jsPDF 4.2.1
  (`js/vendor/`, MIT) chargé à la demande (`loadJsPdf`) ; même image sans perte, page à la taille du
  papier.
- **Affichage d'Ignition** : classe `board-ignition` sur `#bwrap` (posée par `applyBoardType`) : même
  hauteur que Vendetta, centré, dès 700 px de large ; le cadre blanc (la « feuille ») suit le plateau, à
  ses vraies proportions (portrait), jamais la zone en paysage ; `boardDisplayFraction()` (`js/assets.js`)
  suit la même règle pour choisir les aperçus.
- **Échelle de contrôle (`renderScaleBar`, calque `layer-scale`)** : 3 cm / 1 in à gauche de la 6e
  rangée, dans la zone imprimée ; visible à l'écran et dans l'export.
- **Empreintes contre le cache (`tools/stamp-assets.py`)** : chaque CSS / JS de `index.html` est appelé
  avec `?v=<empreinte du contenu>` ; un fichier modifié change d'adresse et ne peut plus être servi en
  copie périmée (vu le 19/11 : ancien `paper-ui.css`, `editing.js` et `export.js` avec le nouveau
  `index.html`). **Lancer `python3 tools/stamp-assets.py` avant chaque commit** qui touche `css/` ou
  `js/` ; `--check` échoue si une empreinte est périmée. Tout nouveau fichier CSS / JS de la page est
  repris tout seul (chemins `css/…` et `js/…`).
- **Licences et contributions (23/11)** : code sous PolyForm Noncommercial 1.0.0, images originales et
  documentation sous CC BY-NC-SA 4.0, graphismes de Restoration Games exclus (`LICENSE`, textes dans
  `LICENSES/`, rangement REUSE). Mayrik seul décideur ; règles publiques en anglais : `README.md`,
  `CONTRIBUTING.md`, `ROADMAP.md` (à tenir à jour avec `docs/roadmap.md`), `CODE_OF_CONDUCT.md`,
  modèles dans `.github/`. Toute demande de fusion externe se juge selon `CONTRIBUTING.md`. But : un
  éditeur de plateau (nouvelles formes selon les extensions possibles), jamais une appli à tout faire
  (ni lanceur de dés, ni plateau virtuel) ; code écrit par IA accepté s'il est testé (téléphone et
  ordinateur), fonctionnel et techniquement optimisé ; pas d'e-mail personnel dans les fichiers.
- `tools/` : outils de développement (hors de la page).
- `docs/` : plan et documents de conception.

**Ignition déjà repris** (rappel de Mayrik, 25/11) : le format étroit de 4 cases de large, l'**Omni-ramp**
et la **mine** (« Off-Road + Minefield ») viennent d'Ignition ; reste à faire : les **barricades** (phase 8) ;
idées en attente : le terrain **Rubble** (gravats) et les **routes courbes** (`docs/roadmap.md` § 3 bis).
Avant de proposer un élément d'Ignition, vérifier d'abord la palette (`TILES`, `js/config.js`).

Géométrie : plateau à 300 dpi, Vendetta 4961 × 3508 px (A3 paysage, 8 colonnes), Ignition
2481 × 3508 px (A4 portrait, 4 colonnes), 6 rangées en quinconce. Zone réellement imprimée mesurée :
354,7 × 268,7 mm (Vendetta), 187,7 × 268,7 mm (Ignition).

---

## 3. Vérifier

- Servir le dépôt : `python3 -m http.server 8765` (à la racine), ouvrir `/index.html`.
- **`node tools/check-app.js <url> <dossier-sortie> [<dossier-référence>]`** : peint un plateau de
  test avec de vrais clics (tous les types de cases), exporte Vendetta et Ignition, compare pixel par
  pixel à une référence ; code de sortie 1 au moindre écart. Méthode : générer la référence sur
  l'ancienne version (par exemple un `git worktree` du commit précédent servi sur un autre port), puis
  comparer la nouvelle. Pour une tranche « sans changement visible », exiger des exports identiques.
- **`node tools/check-undo.js [url]`** : Annuler / Rétablir avec de vrais clics et de vraies touches.
- **`node tools/check-brush.js [url]`** : pinceau avec de vrais gestes (souris lente / rapide, doigt,
  pincement à deux doigts).
- **`node tools/check-keyboard.js [url]`** : clavier avec de vraies touches (curseur, lettres, aide,
  export sans curseur).
- **`node tools/check-autosave.js [url]`** : sauvegarde et « Continue » avec de vrais rechargements
  (grande image de titre, sauvegarde abîmée, stockage interdit).
- **`node tools/check-project.js [url]`** : fichier de projet (enregistrer, rouvrir dans un autre
  navigateur, fichiers refusés).
- **`node tools/check-export-dialog.js [url]`** : fenêtre d'export sur connexion lente.
- **`node tools/check-sounds.js [url]`** : sons (espion de howler.js : fichier, volume, hauteur de chaque son).
- **`node tools/check-decor.js [url]`** : décorations (pose, glisser, retrait, Annuler, export coupé aux marges, sauvegarde, projet, doigt).
- **`node tools/check-credits.js [url]`** : crédits (fenêtre, textes exacts des licences, polices et bibliothèques toutes citées).
- Les tests qui exportent ouvrent d'abord la fenêtre (`#export-open-btn`) puis cliquent `#export-btn`.
- Les outils affichent leurs résultats **en anglais** (`ok : …` / `FAIL : …`, 23/11) ; code de sortie 1 au
  moindre `FAIL`. Je les résume à Mayrik en français.
- **Un test vert ne prouve rien s'il ne peut pas échouer** : saboter, vérifier qu'il tombe, restaurer.
- Captures d'écran : la barre de progression du bouton Export s'anime encore juste après le
  chargement (écart de quelques pixels d'une capture à l'autre, même version) : attendre ou l'ignorer.

---

## 4. Git
- Développer sur la branche de travail indiquée par la session (jamais directement sur `main`).
- Un commit par tranche, message clair en français, crédit `Co-authored-by` quand une idée vient d'une
  PR externe.
- Ne jamais réécrire l'historique ni supprimer de branche sans demander.
