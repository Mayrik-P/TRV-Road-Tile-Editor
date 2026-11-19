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
  dans un **ordre fixe** : `config`, `state`, `geometry`, `build-board`, `render-layers`, `editing`,
  `export`, `assets`, `ui`. Le code exécuté au chargement d'un fichier ne peut utiliser que ce qui est
  déclaré dans ce fichier ou les précédents.
- **État et signal (tranche 0c, `js/state.js`)** : toute modification passe par un point d'entrée
  unique (`updateCell`, `selectTileType`, `chooseBoardType`, `setBoardState`, champs et image de titre)
  qui émet UN signal `change` sur `boardEvents` (raisons : `cell`, `new-board`, `restore`, `title`,
  `number`, `title-image`). Annuler/Rétablir, sauvegarde et sons s'y **abonnent** ; ne jamais ajouter
  de crochet ailleurs. `getBoardState()` / `setBoardState()` : photo complète (JSON, champ `version`)
  et restauration ; l'image de titre personnalisée n'en fait pas partie.
- `fonts/<police>/` : polices en woff2 avec leur licence `OFL.txt` (Alfa Slab One, Oswald, Cooper
  Hewitt). Jamais de police chargée depuis Internet.
- `textures/`, `sprites/`, `items/`, `edges/` : images à 300 dpi (PNG pour l'instant ; WebP prévu en
  Phase 1).
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
- **Un test vert ne prouve rien s'il ne peut pas échouer** : saboter, vérifier qu'il tombe, restaurer.
- Captures d'écran : la barre de progression du bouton Export s'anime encore juste après le
  chargement (écart de quelques pixels d'une capture à l'autre, même version) : attendre ou l'ignorer.

---

## 4. Git
- Développer sur la branche de travail indiquée par la session (jamais directement sur `main`).
- Un commit par tranche, message clair en français, crédit `Co-authored-by` quand une idée vient d'une
  PR externe.
- Ne jamais réécrire l'historique ni supprimer de branche sans demander.
