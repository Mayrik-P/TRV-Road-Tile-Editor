# TRV Road Tile Editor — plan de développement (v1.00 → v2)

Document de référence du chantier, rédigé le 19/11/2026 à partir :
- du code actuel (`index.html` v1.00, commit `3b0219b`) ;
- des 2 pull requests ouvertes par ChessMess
  ([#1 sauvegarde locale](https://github.com/Mayrik-P/TRV-Road-Tile-Editor/pull/1),
  [#2 navigation clavier](https://github.com/Mayrik-P/TRV-Road-Tile-Editor/pull/2)) ;
- de ce qui marche déjà dans **TRV-Pocket** (polices, sons, copies réduites des images, format des tuiles) ;
- de recherches sur des projets du même type (sources en fin de document).

Les demandes des utilisateurs, les envies et les choix techniques sont regroupés en **phases**.
Chaque phase est découpée en **tranches** courtes. Après chaque tranche, l'appli reste complète et
utilisable, et Mayrik l'essaie avant de passer à la suivante (même méthode que TRV-Pocket).

---

## 1. Constats sur l'état actuel

| Constat | Mesure | Conséquence |
|---|---|---|
| **Poids des images** | 66 Mo de PNG chargés à l'ouverture (6 textures de 3000×1922 = 54 Mo) | Page très lente, voire inutilisable, sur une petite connexion (environ 4 min à 2 Mbit/s) |
| Toutes les images sont mises en base64 **dans le SVG affiché** | ~90 Mo de texte dans la page | Mémoire et lenteur, surtout sur téléphone |
| Police Cooper Hewitt chargée depuis **un dépôt GitHub tiers** (`raw.githubusercontent.com/rse/…`) | 1 dépendance externe | Si ce dépôt bouge, le numéro Ignition disparaît sans que notre code ait changé |
| Polices en `.ttf` | 270 Ko | Le format `.woff2` (celui de TRV-Pocket) pèse environ 2 à 3 fois moins |
| **Le PNG exporté ne contient aucune information de résolution** (vérifié : pas de champ `dpi`) | — | Avec « Taille réelle », un logiciel d'impression peut supposer 72 ou 96 dpi et imprimer à la mauvaise taille. À corriger avant le format US |
| Titre de l'appli : ombre faite de **20 copies décalées de 0,16 px** | Capture zoomée | Bords flous ou crénelés : c'est le problème de netteté remarqué. TRV-Pocket utilise des décalages d'un pixel entier (`1px 1px, 2px 2px…`), qui restent nets |
| Historique Git | 50 commits « Add files via upload » / « Delete index.html » | Impossible de voir ce qui a changé d'une version à l'autre. À partir de maintenant, un commit par tranche avec un message clair |
| Tout est dans un seul `index.html` de 110 Ko (CSS + JS + HTML) | — | Fonctionne, mais chaque nouveauté rend le fichier plus difficile à suivre |

**Zone réellement imprimée** (mesurée sur un vrai export à 300 dpi, pas seulement calculée) :

| Plateau | Zone imprimée | Papier actuel | Marges actuelles |
|---|---|---|---|
| Vendetta | **354,7 × 268,7 mm** | A3 paysage 420 × 297 | 31–35 mm à gauche et à droite, 14 mm en haut et en bas |
| Ignition | **187,7 × 268,7 mm** | A4 portrait 210 × 297 | 9–13 mm à gauche et à droite, 14 mm en haut et en bas |

---

## 2. Les pull requests existantes : ce qu'on garde, ce qu'on change

Il n'y a **que 2 PR** dans le dépôt. Aucune ne porte sur le pinceau (toutes les références distantes ont
été vérifiées). Les deux partent de la version actuelle de `main`.

### PR #1 — Sauvegarde dans le navigateur (`storage.js`)
**À reprendre :**
- un fichier séparé chargé par un simple `<script src>` (pas de module, pas de construction) : simple,
  compatible partout, déjà la méthode de TRV-Pocket ;
- sauvegarde à chaque modification et restauration au chargement ;
- vérification de la sauvegarde relue (type de plateau connu, bon nombre de cases).

**À revoir :**
- l'image de titre personnalisée est mise en base64 dans `localStorage`, qui est limité à environ 5 Mo.
  L'auteur le signale lui-même : une grande image ne sera pas sauvegardée, sans que l'utilisateur soit
  prévenu. → Il faut **IndexedDB** pour l'image, via la petite bibliothèque éprouvée `idb-keyval`
  (environ 600 octets, écrite par Jake Archibald, de Google Chrome) ;
- la sauvegarde n'a pas de **numéro de version**. Le jour où le format change (décorations libres,
  barricades), il faudra savoir lire les anciennes sauvegardes. TRV-Pocket a déjà vécu ce cas avec ses
  clés renommées → ajouter `version: 1` dès le départ ;
- au rechargement, l'écran d'accueil disparaît sans rien proposer. → On propose plutôt
  « Continue / New board » (voir Phase 4).

### PR #2 — Navigation clavier (`keyboard.js`)
**À reprendre :**
- le principe : flèches = curseur, lettre = choisir et poser un type de case ;
- les précautions : pas de raccourci pendant la saisie d'un texte, ni avec Ctrl, Cmd ou Alt enfoncé,
  ni sur l'écran d'accueil ;
- le curseur jamais présent dans l'export ;
- `selectTileType()`, le chemin unique de sélection partagé entre la souris et le clavier.

**À revoir :**
- *Échap = annuler la dernière modification de cette case seulement* : c'est un mini-annuler propre à la
  PR. L'usage partout (Tiled, Photoshop, navigateurs) est **Ctrl+Z / Ctrl+Y** pour un vrai historique.
  → Annuler/Rétablir devient une brique commune (Phase 2), dont le pinceau a besoin aussi ;
- 17 types de cases sur 4 lettres en cycle (R = Ramp → Road → Road + Hazard → Road + Oil), ce n'est pas
  évident à deviner. → On garde l'idée, avec un **panneau d'aide affiché par `?`** (usage de Gmail,
  GitHub, Figma) et la lettre soulignée sur chaque bouton de la palette.

**Ce qu'on fait des PR :** ni l'une ni l'autre ne sera fusionnée telle quelle. Elles seraient en
conflit avec le nouveau découpage des fichiers et le futur historique Annuler/Rétablir. On les
**réécrit en s'en inspirant**, avec un crédit à ChessMess dans les commits (`Co-authored-by`). La
fermeture des PR sur GitHub, avec un petit mot d'explication, se fera seulement avec l'accord de
Mayrik.

---

## 3. Les phases, par ordre de priorité

Ordre retenu : **d'abord ce qui fait souffrir le plus d'utilisateurs** (le chargement), puis les briques
dont dépendent plusieurs demandes (fichiers séparés, état unique, Annuler/Rétablir), puis les nouveautés.
Les deux chantiers qui demandent des graphismes neufs (décorations libres, barricades) viennent en dernier :
cela laisse à Mayrik le temps de préparer les images.

### Phase 0 — Fondations (aucun changement visible) — TERMINÉE le 19/11
0a, 0b, 0c et 0d faites (exports identiques octet par octet à la v1.00 à chaque tranche). Écart
constaté dès la v1.00 : la mise à jour case par case et le redessin complet du plateau diffèrent de
1/255 au plus sur quelques dizaines de pixels (arrondis de lissage, invisible), toléré par
`tools/check-app.js`.

| Tranche | Contenu | Pourquoi |
|---|---|---|
| 0a | Sortir le CSS et le JS de `index.html` vers `css/app.css` et quelques `js/*.js` par rôle (plateau, rendu, export, chargement), en scripts classiques. **Aucune ligne de logique modifiée** | Même méthode que les 2 PR et que TRV-Pocket (« un petit fichier par rôle »). Toujours sans étape de construction : GitHub Pages sert les fichiers tels quels |
| 0b | Rapatrier Cooper Hewitt dans `fonts/` et passer les 4 polices en `.woff2` (fichiers OFL gardés à côté) | Supprime la dépendance externe et allège le chargement |
| 0c | Un seul point d'entrée pour modifier le plateau (`setCell` / `applyChange`) et un objet d'état unique (`board`, variantes, titre, plus tard décorations et barricades) | Le pinceau, le clavier, la sauvegarde et l'historique passeront tous par ce chemin, au lieu de 4 crochets dispersés |
| 0d | Un script de vérification dans Chromium (Playwright) : ouvre l'appli, pose des cases, exporte, compare | Vérifier chaque tranche dans un vrai navigateur, comme pour TRV-Pocket |

### Phase 1 — Performances (demande n°1 des petites connexions)
**Avancement (19/11)** : 1a et 1b faites. Test à l'aveugle à l'écran, à taille d'impression réelle
(calibrage par carte bancaire, page d'essai publiée comme artefact privé), PNG contre WebP 95 : **5/20
en ×1, 13/20 en ×2** (18/40 au total, hasard) → **WebP 95 retenu** (choix de Mayrik : qualité maximale
pour l'impression agrandie). Poids : 66,2 → 8,9 Mo (WebP sans perte mesuré : 40,7 Mo). Connexion
simulée à 5 Mbit/s : plateau texturé visible 16,1 → 2,5 s, export prêt 108,8 → 15,6 s. Qualités 80 et
88 écartées par Mayrik sans test (pas de compression plus forte).
**1c faite (19/11)**, avec l'essentiel de 1d et 1e : aperçus quart / moitié (0,72 / 2,29 Mo pour toutes
les images), copie choisie selon la taille affichée (Vendetta : quart sur écran standard et téléphone,
moitié sur Retina ; Ignition : moitié sur écran standard et téléphone, original sur Retina) ; plus de
base64 dans la page (9,1 millions de caractères -> 300) ; originaux en arrière-plan après les aperçus,
jamais décodés ; export inchangé (identique octet par octet). À 5 Mbit/s, après le choix du format :
toutes les textures affichées en 1,2 s au lieu de 15,3 s ; export prêt en 16 s (téléchargement des
originaux pendant qu'on peint). Reste de 1e à juger à l'usage : libellé « Preparing high-res… » si l'on
clique sur Export avant la fin (aujourd'hui : bouton grisé avec « Loading… % »).
**Constaté en chemin (v1.00)** : chaque texture est ajustée à toute la zone des cases sans garder ses
proportions (`preserveAspectRatio="none"`). Vendetta : agrandie ×1,41 dans les deux sens (environ
212 dpi réels à l'impression). **Ignition : déformée**, ×0,76 en largeur et ×1,41 en hauteur (motifs
étirés en hauteur d'un facteur 1,9). **Corrigé le 19/11** (`textureRect()`, `js/config.js`) : la
texture garde partout la taille de la zone Vendetta, centrée ; Vendetta inchangé (exports identiques
octet par octet), Ignition à la même échelle que Vendetta. **Suite** : Mayrik a ses textures sources en
4243 × 2718 px (= zone Vendetta à 300 dpi) ; les mettre dans `textures/source/` et les poser à leur
taille exacte (1 pixel de texture = 1 pixel imprimé) pour de vraies textures à 300 dpi. **Fait le
19/11** : textures 4243 × 2718 posées sans redimensionnement (alignement identique à avant, grain plus
fin) ; sources retirées du dépôt à la demande de Mayrik (gardées sur son ordinateur). Originaux de
toutes les images : 13,4 Mo ; à 5 Mbit/s, textures affichées en 1,9 s, export prêt en 24 s.

Méthode éprouvée des **logiciels de montage vidéo** (fichiers « proxy » de Premiere, DaVinci, Nuke) :
on travaille sur des copies légères et on n'utilise les originaux qu'au moment de l'export. TRV-Pocket
applique déjà la même idée avec ses dossiers `half/` et `quarter/` (méthode des dossiers par densité
d'Android).

| Tranche | Contenu | Gain mesuré |
|---|---|---|
| 1a | Convertir toutes les images en **WebP** (prise en charge par environ 97 % des navigateurs). Script repris de `tools/image-variants/make-variants.js` de TRV-Pocket (encodage par Chromium, aucune nouvelle dépendance). Originaux PNG gardés dans `source/` (dans Git, non chargés par la page) | **66 Mo → 5,1 Mo** (WebP qualité 88, mesuré sur nos fichiers) |
| 1b | **Test à l'aveugle** de Mayrik sur un export imprimé (PNG d'origine contre WebP), comme pour les cartes de TRV-Pocket (6/20 = différence invisible), pour régler la qualité | Qualité d'impression garantie |
| 1c | Copies d'**aperçu** au quart (`preview/`) pour l'écran. Les originaux WebP ne sont téléchargés qu'à l'export, ou en tâche de fond une fois la page utilisable | Ouverture de la page : **environ 0,4 Mo d'images** au lieu de 66 Mo |
| 1d | Ne plus mettre de base64 dans le SVG affiché : on l'utilise seulement dans la copie construite pour l'export | Mémoire divisée, plateau plus fluide |
| 1e | L'export garde son contrôle « tout est chargé ». Le bouton affiche « Preparing high-res… » pendant le téléchargement des originaux | Pas d'export en basse définition par erreur, le piège signalé chez Shotcut |

*Option pour plus tard :* un *service worker* (appli installable, hors ligne) pour ne rien
retélécharger aux visites suivantes. Méthode éprouvée (PWA), mais à garder pour la fin : elle complique
la mise à jour des fichiers.

### Phase 2 — Édition : Annuler/Rétablir, pinceau, clavier
**2a faite (19/11)** : `js/history.js`, boutons Undo / Redo, raccourcis standard ; Reset + changement de
format annulables ; image de titre personnalisée non annulable (hors de la photo). Test
`tools/check-undo.js` (13 contrôles, vérifié par sabotage).
**2b faite (19/11)** : pinceau (`js/brush.js`), méthodes documentées (MDN / W3C Pointer Events,
getCoalescedEvents, tracé entre positions successives des éditeurs de pixels, annulation du trait au
toucher non voulu documentée par Android). Test `tools/check-brush.js` (17 contrôles, vérifié par
sabotage). 2c (tactile) incluse : un doigt peint, pincement à deux doigts conservé.
**2d faite (19/11)** : clavier (`js/keyboard.js`), réécriture de la PR #2 (flèches, lettres, Entrée),
plus Espace, Suppr, panneau `?` et lettres soulignées dans la palette ; Échap ne remplace plus
Ctrl+Z. Test `tools/check-keyboard.js` (22 contrôles, vérifié par sabotage). Reste 2e (remplissage),
facultative.

| Tranche | Contenu | Référence |
|---|---|---|
| 2a | **Annuler / Rétablir** (Ctrl+Z, Ctrl+Y ou Ctrl+Maj+Z, plus 2 boutons). Historique par **instantanés** de l'état : le plateau ne fait que 24 à 48 cases, donc copier tout l'état à chaque action est la solution la plus simple et la plus sûre. Un coup de pinceau = 1 seule étape d'annulation | Méthode courante quand l'état est petit |
| 2b | **Pinceau** : on appuie et on glisse pour peindre. *Pointer Events* (souris, stylet et doigt avec le même code) : `setPointerCapture` sur le plateau, puis à chaque mouvement on cherche la case sous le pointeur et on ne peint que si la case change. Un **simple clic** sur une case déjà de ce type garde son rôle actuel (changer le visuel Impassable/Fire/Oil) ; un glissé ne fait pas défiler les visuels | Recommandations MDN et W3C pour les outils de dessin |
| 2c | Pinceau sur **téléphone et tablette** : `touch-action: none` sur le plateau pour qu'un doigt peigne au lieu de faire défiler. *Décision à prendre* (voir § 4) | Même choix que les applis de dessin |
| 2d | **Clavier**, d'après la PR #2 : flèches = curseur ; Entrée ou Espace = poser ; lettres = types de case ; Ctrl+Z / Ctrl+Y ; `?` = panneau des raccourcis. Lettres d'outils sur le modèle de **Tiled** (B = pinceau, E = gomme vers Road, plus tard D = décoration, K = barricade) seulement si elles n'entrent pas en conflit avec les lettres des cases | Tiled (éditeur de cartes de référence), PR #2 |
| 2e | *(facultatif)* **Remplissage** d'une zone de même type (F dans Tiled). Peu de code une fois l'état unique en place | Tiled |

**Demande des utilisateurs ajoutée le 19/11 (faite)** : plateau neuf en **Off-Road** au lieu de Road
(`DEFAULT_TILE`, `js/config.js`) ; Road sélectionné au départ dans la palette ; texte du Reset à jour.

### Phase 3 — Style inspiré de TRV-Pocket et netteté des textes
À faire **avant** les phases qui ajoutent des boutons (accueil, son, décorations), pour ne pas devoir les
redessiner ensuite.

| Tranche | Contenu |
|---|---|
| 3a | Polices de l'interface : **Anton** (titres) et **D-DIN Condensed** (textes, boutons), reprises de `fonts/` de TRV-Pocket (licence OFL) |
| 3b | Ombres « extrudées » **en pixels entiers** (`--extrude-text: 1px 1px 0 …, 2px 2px 0 …`) avec `-webkit-text-stroke` et `skew(-6deg)`, comme les titres de TRV-Pocket, au lieu des 20 décalages de 0,16 px qui rendent les bords flous |
| 3c | Couleurs de TRV-Pocket (`--ink #1d1426`, `--paper #f3e6c8`, `--frame #3a3240`…) et fond de sable `background.webp` répété |
| 3d | **Titre imprimé sur le plateau** (Alfa Slab One, « FAN-MADE CHAPTER », « THE ») : il imite les vrais plateaux, donc on ne change **pas** son dessin. On vérifie seulement sa netteté à l'écran et à l'export *(décision à confirmer, voir § 4)* |

### Phase 4 — Sauvegarde automatique, accueil et Reset
| Tranche | Contenu |
|---|---|
| 4a | Sauvegarde automatique, d'après la PR #1 : état du plateau dans `localStorage` (petit, lecture immédiate), **image de titre dans IndexedDB** (`idb-keyval`), sauvegarde avec `version: 1` |
| 4b | **Écran d'accueil revu**, sur le modèle des jeux (et de l'accueil de TRV-Pocket) : « **Continue** » (aperçu du dernier plateau), « New Vendetta board », « New Ignition board ». Le choix de format n'efface plus rien sans demander |
| 4c | **Reset** → « Clear board » (remet tout en Off-Road, le type d'un plateau neuf, avec confirmation **et** possibilité d'annuler par Ctrl+Z). Un bouton « Home » qui ne perd rien (le plateau reste sauvegardé) |
|  | *Remarque de Mayrik (19/11)* : aujourd'hui, Reset renvoie à l'écran d'accueil, où Annuler ne marche pas (il faut choisir un format puis Ctrl+Z) — fonctionne, mais peu naturel. Clear board doit rester dans l'éditeur ; le texte d'avertissement sera réécrit avec ce nouveau fonctionnement |
| 4d | **Fichier de projet** : « Save project » / « Open project » (`.trvtile`, du JSON). Permet de garder une sauvegarde, de changer d'appareil, de partager un plateau. Prépare aussi l'export vers TRV-Pocket (Phase 9). Usage standard de tous les éditeurs (Tiled : `.tmx` / `.tmj`) |

### Phase 5 — Formats de papier américains
**Calcul fait sur l'export réel** (zone imprimée : 268,7 mm de haut pour les deux plateaux) :

| Plateau | Papier US | Taille | Marges obtenues | Verdict |
|---|---|---|---|---|
| Vendetta | **Tabloid / Ledger 11×17″** paysage | 431,8 × 279,4 mm | **5,3 mm** en haut et en bas, ~38 mm sur les côtés | Tient à l'échelle 1:1 |
| Ignition | **US Letter 8,5×11″** portrait | 215,9 × 279,4 mm | **5,3 mm** en haut et en bas, ~14 mm sur les côtés | Tient à l'échelle 1:1 |
| Ignition | US Legal 8,5×14″ | 215,9 × 355,6 mm | 43 mm en haut et en bas | Tient largement (papier moins courant) |

**Point d'attention : 5,3 mm**, c'est plus que la marge minimale des imprimantes Epson (3 mm, fiches
techniques du fabricant) mais moins que la valeur « prudente » souvent citée de 1/4″ (6,35 mm). Sur
certaines imprimantes, un liseré de moins d'un millimètre pourrait être coupé en haut ou en bas du
plateau. La taille réelle, elle, est toujours conservée.

| Tranche | Contenu |
|---|---|
| 5a | **Corriger l'information de résolution du PNG** (écrire 300 dpi dans le fichier, bloc `pHYs`). Utile aussi pour l'A3 et l'A4 actuels |
| 5b | Choix du papier **au moment de l'export** : A3 / Tabloid pour Vendetta, A4 / Letter (/ Legal) pour Ignition. Même rendu du plateau, centré sur une page de taille différente (Letter = 2550 × 3300 px, Tabloid = 5100 × 3300 px à 300 dpi). Le nom du fichier indique le papier |
| 5c | Export **PDF** en plus du PNG (bibliothèque **jsPDF**, très répandue) : le PDF contient la taille de page en mm, c'est le format habituel du *print & play* parce que « Taille réelle / 100 % » y est fiable |
| 5d | Sur l'écran d'accueil : « Prints on A3 or Tabloid (11×17″) » / « Prints on A4 or US Letter ». Une ligne de conseil à l'export : « Print at Actual size / 100 %, no Fit to page » |
| 5e | *(option)* Vendetta sur **2 feuilles Letter** à assembler, pratique courante du *print & play* parce que peu de gens ont une imprimante A3 / Tabloid |

### Phase 6 — Sons
| Tranche | Contenu |
|---|---|
| 6a | Reprendre le **moteur de son de TRV-Pocket** (`sound-engine.js`, basé sur **Howler.js**, la bibliothèque de référence du son des jeux web) : volume, muet mémorisé, fichier absent = silence sans erreur, **limite de 70 ms entre deux mêmes sons** (déjà prévue là-bas pour les dés, parfaite pour le pinceau) |
| 6b | Petite table des moments : clic de palette, pose d'une case, peinture au pinceau (un son par case peinte, limité), annuler, export terminé, erreur |
| 6c | Bouton haut-parleur (muet ou non), mémorisé. **Son coupé ou bas par défaut ?** *(décision, voir § 4)* |
| 6d | **Format** : TRV-Pocket est en OGG seul, mais l'éditeur est une page publique utilisée aussi sur iPhone et Mac. Safari ne lit l'OGG que depuis iOS 18.4 / macOS 15.4. → OGG **et** MP3 (Howler choisit seul), MP3 généré automatiquement par un script *(décision, voir § 4)* |

### Phase 7 — Décorations libres (remplace le placement automatique)
| Tranche | Contenu |
|---|---|
| 7a | **Données** : une liste `decorations: [{item, x, y, flip?}]` dans l'état (coordonnées du plateau en 300 dpi), sauvegardée, annulable, exportée |
| 7b | **Interface** : un onglet « Decorations » dans la palette avec les 12 images ; clic sur le plateau = poser ; glisser une décoration = la déplacer (Pointer Events) ; touche Suppr ou glisser hors du plateau = la retirer. Méthode standard des outils à « autocollants » |
| 7c | **Calque** : on garde l'emplacement actuel (au-dessus du quadrillage, sous les zones de clic). L'ordre entre décorations suit la vue isométrique (plus bas = devant), comme `insertInIsometricOrder` pour les overlays |
| 7d | *(option)* Aimantation sur les frontières entre cases : la fonction actuelle `pairDecorAnchor` peut servir de point d'accroche |
| 7e | **Retrait propre de l'ancien système**, *après accord de Mayrik* : `renderAllDecorations`, `findEligiblePairsInGroup`, `pairDecorAnchor` (sauf si gardée pour 7d), l'attribut `data-decor-cell` et la reconstruction de `layer-decor` dans `updateCell`. **À garder** : `findSameTypeGroups()`, qui n'est utilisée que par les décorations aujourd'hui mais servira au remplissage (2e). On vérifie avant de supprimer quoi que ce soit |

### Phase 8 — Barricades (Ignition, pour les deux formats)
Modèle de données éprouvé : **des « murs fins » posés sur les arêtes** entre deux cases, et non sur les
cases (Red Blob Games, *Grid edges*). L'appli a déjà presque tout le calcul nécessaire : `crossRowSegments()`
trouve, pour chaque case, les segments partagés avec la rangée voisine et leur largeur exacte.

- Avec le quinconce, une frontière horizontale entre deux cases fait **195 px (« Short ») ou 298 px
  (« Long »)**, à 300 dpi. Sur les colonnes du bord du plateau, il n'existe qu'un seul segment, toujours
  « Long ». Ce sont exactement les deux longueurs déjà gérées par les bords de route (`EDGE_SEG_LONG_THRESHOLD`).
- Une barricade = une paire de cases de **rangées différentes**, rangée sous une clé unique (`canonicalPair`
  existe déjà).

| Tranche | Contenu |
|---|---|
| 8a | **Graphismes à préparer par Mayrik** : barricade « Short » (segment de 195 px) et « Long » (298 px), avec dépassement et ombre, à 300 dpi, 2 ou 3 variantes chacune si possible. Je fournirai les tailles de canevas exactes et un gabarit PNG avec le segment repéré |
| 8b | Données `barricades: ["idxA-idxB", …]`, sauvegardées, annulables, exportées |
| 8c | Outil « Barricade » : quand il est actif, des zones de clic fines apparaissent le long de chaque frontière horizontale ; un clic pose ou retire. Le pinceau peut en enchaîner plusieurs |
| 8d | Rendu : calque au-dessus du quadrillage orange, au même niveau que les overlays, dans l'ordre isométrique |

### Phase 9 — *(facultatif, long terme)* Export vers TRV-Pocket
Ajouter, à l'export, un fichier de données au **format des tuiles de TRV-Pocket**
(`tiles/data/*.js` : `{id, name, format, extension, cols, rows, grid: [[{terrain, hazardSpace}]]}`).
La correspondance est presque directe : `road → ROAD`, `sand → OFF_ROAD`, `mud → MUD`,
`rock → IMPASSABLE`, `goo → TOXIC_GOO`, `glass → DESERT_GLASS`, `ramp → RAMP`, `fire → FIRE`,
`salt → SALT_FLATS`, `haz_* → hazardSpace: true`. Les barricades demanderaient un nouveau champ
dans TRV-Pocket. Le fichier de projet de la Phase 4d rend cet export très simple : on le prépare sans le
construire maintenant.

---

## 4. Décisions de Mayrik (19/11)

1. **Ordre des phases** : validé, 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 (→ 9).
2. **Pinceau sur écran tactile** : validé, un doigt sur le plateau peint (on défile en dehors du plateau).
3. **Style** : seulement l'**interface** au style de TRV-Pocket ; le titre imprimé du plateau garde son dessin.
4. **Sons** : sons de TRV-Pocket repris ; OGG + copie MP3 générée automatiquement (Safari) ; **son activé
   par défaut**. Un petit bouton haut-parleur (muet mémorisé) est gardé quand même : usage courant des
   outils web (bureau, transports), coût minime puisque le moteur de TRV-Pocket le gère déjà.
5. **Papier US** : Tabloid (Vendetta) et Letter (Ignition) seulement, pas d'assemblage sur 2 feuilles
   (option 5e abandonnée). Legal reste à confirmer au moment de la Phase 5.
6. **PR de ChessMess** : fermées une fois leur contenu réécrit, avec un commentaire de remerciement et le
   lien vers le commit ; crédit par une ligne `Co-authored-by` dans le commit (GitHub affiche alors
   l'auteur comme co-auteur). Texte du commentaire montré à Mayrik avant publication.

---

## 5. Sources consultées

- PR [#1](https://github.com/Mayrik-P/TRV-Road-Tile-Editor/pull/1) et [#2](https://github.com/Mayrik-P/TRV-Road-Tile-Editor/pull/2) (ChessMess)
- TRV-Pocket : `CLAUDE.md`, `sound-engine.js`, `docs/sound-guide.md`, `tools/image-variants/make-variants.js`, `tools/v2/index.html`, `tiles/data/`
- Tiled, raccourcis et outils : [Keyboard Shortcuts](https://docs.mapeditor.org/en/latest/manual/keyboard-shortcuts/), [Editing Tile Layers](https://doc.mapeditor.org/manual/editing-tile-layers/)
- Pointer Events : [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events), [javascript.info](https://javascript.info/pointer-events), [12 Days of Web](https://12daysofweb.dev/2022/pointer-events/), [liste W3C](https://lists.w3.org/Archives/Public/public-pointer-events/2021JanMar/0033.html)
- Arêtes et murs : [Red Blob Games — Grid edges](https://redblobgames.com/grids/edges), [Grid parts](https://www.redblobgames.com/grids/parts/)
- Stockage : [npm-compare idb-keyval / localforage / dexie](https://npm-compare.com/dexie,idb-keyval,localforage), [IndexedDB vs localStorage](https://mohammadalhabil.vercel.app/blog/indexeddb-vs-localstorage-guide)
- Formats d'image : [AVIF vs WebP 2026](https://modpagespeed.com/blog/avif-vs-webp-2026/), [WebP vs AVIF support](https://imageupload.app/blog/2026-03-13-webp-vs-avif-browser-support-and-encoding-trade-offs)
- Travail sur copies légères : [Descript — proxy files](https://help.descript.com/app-troubleshooting/proxy-files.md), [Foundry Nuke — proxies](https://learn.foundry.com/nuke/content/tutorials/written_tutorials/tutorial1/using_proxies_downres.html), [Shotcut forum](https://forum.shotcut.org/t/settings-proxy-editing/18517/2)
- Impression : [Epson — zone imprimable](https://files.support.epson.com/docid/cpd4/cpd41239/source/specifications/references/xp820/spex_printable_area_xp820.html), [OnlineLabels — marges](https://www.onlinelabels.com/support/faq/306), [pnp-howto](https://github.com/ernierasta/pnp-howto), [Paizo — A4 vs Letter](https://paizo.com/threads/rzs2qhxw)
- PNG et DPI : [MDN toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob), [changeDPI](https://unpkg.com/changedpi@1.0.4/README.md), [png-tools](https://classic.yarnpkg.com/en/package/png-tools)
- PDF à la taille réelle : [jsPDF](https://github.com/parallax/jsPDF/issues/3401), [Polotno — unités](https://docs.polotno.com/docs/units-and-measures)
