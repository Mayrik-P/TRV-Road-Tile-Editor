# TRV ROAD TILE EDITOR — contexte pour Claude Code

Éditeur web de tuiles de route pour **Thunder Road: Vendetta** et **Ignition** (éditeur Restoration
Games) : on peint les cases d'un plateau puis on exporte un PNG à 300 dpi, à imprimer (A3 / A4 ;
Tabloid / Letter prévus). Projet personnel de Mayrik, lié de loin à **TRV-Pocket**
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
- **Langue** : échanges en **français** ; textes affichés, noms de fichiers et code en **anglais** ;
  commentaires du code et messages de commit en **français**.
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
- `css/app.css` : styles.
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
- `fonts/<police>/` : polices en woff2 avec leur licence `OFL.txt` (Alfa Slab One, Oswald, Cooper
  Hewitt). Jamais de police chargée depuis Internet.
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
- `tools/` : outils de développement (hors de la page).
- `docs/` : plan et documents de conception.

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
- **Un test vert ne prouve rien s'il ne peut pas échouer** : saboter, vérifier qu'il tombe, restaurer.
- Captures d'écran : la barre de progression du bouton Export s'anime encore juste après le
  chargement (écart de quelques pixels d'une capture à l'autre, même version) : attendre ou l'ignorer.

---

## 4. Git
- Développer sur la branche de travail indiquée par la session (jamais directement sur `main`).
- Un commit par tranche, message clair en français, crédit `Co-authored-by` quand une idée vient d'une
  PR externe.
- Ne jamais réécrire l'historique ni supprimer de branche sans demander.
