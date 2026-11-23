// ===== js/credits.js — Crédits (accueil, bouton « Credits » ; phase 6 bis, Mayrik 19/11).
//
// SEULE liste des crédits du projet, comme tools/v2/credits.js de TRV-Pocket : toute ressource
// ajoutée (son, image, police, code) s'y inscrit, avec sa licence. Fichier de données seul (textes
// en anglais, convention du projet) : on peut le retoucher sans toucher au code. Affichage :
// openCredits() dans js/ui.js.
//
// Forme reprise des jeux et de TRV-Pocket (crédits groupés par rôle, lisibles dans l'appli) :
//   - notice : avertissement en tête ;
//   - sections : un titre, puis des lignes ; une ligne [rôle, noms] s'affiche « RÔLE » au-dessus ;
//   - licenses : textes de licence, repliés (comme la liste « Open source licenses » d'Android),
//     lus dans le fichier de licence livré avec chaque ressource (texte exact, jamais recopié).
const CREDITS = {
  title: 'Credits',
  app: 'TRV Road Tile Editor',
  tagline: 'Design and print your own road tiles for Thunder Road: Vendetta or Ignition',
  notice: [
    'Unofficial fan project. Its free distribution is authorized by the game’s publisher, Restoration Games, LLC.',
    'This app uses excerpts from the original graphics, which are the property of their respective creators; therefore, the exported files are intended for personal use only.'
  ],
  sections: [
    { title: 'TRV Road Tile Editor', lines: [
      ['Created by', 'Mayrik PADEY'],
      ['Programming', 'Written with Claude Code (Anthropic) under Mayrik’s direction, every step specified and validated by him'],
      // (Mayrik, 19/11 : les images non scannées du jeu sont ses créations)
      ['Original artwork', 'Mayrik PADEY (all images that are not scans of the game)'] ] },
    { title: 'Contributors', lines: [
      ['Autosave and keyboard navigation ideas', 'ChessMess (GitHub pull requests #1 and #2)'],
      'Many thanks to everyone who suggests ideas or reports problems on GitHub.' ] },
    // (crédits du livret de règles, repris de TRV-Pocket tels quels ; Ignition = version allégée du jeu,
    // même éditeur et même équipe — Mayrik, 19/11)
    { title: 'Thunder Road: Vendetta and Ignition', lines: [
      'The board games by Restoration Games; Ignition is a lighter version of Thunder Road: Vendetta, made by the same team. Images from Thunder Road: Vendetta are © Restoration Games, LLC and are used with permission.',
      ['Game design', 'Brett Myers, Dave Chalker'],
      ['Additional design and development', 'Justin D. Jacobson, Rob Daviau, Brian Neff, Noah Cohen'],
      ['Original design', 'Jim Keifer'],
      ['Illustration', 'Marie Bergeron'],
      ['Additional illustration', 'Garrett W. Kaida'],
      ['3D modeling', 'Hakan Diniz, Chad Hoverter'],
      ['Art director, graphic design', 'Jason Taylor'],
      ['Graphic design, production lead', 'Lindsay Daviau'],
      ['Additional graphic design', 'Ian Reed, Peter Gifford, Jason D. Kingsley'],
      ['Concept art', 'Brian Patterson'],
      ['Rules editing', 'J Elizabeth Mills'] ] },
    { title: 'Sound effects', lines: [
      'All sound effects come from freesound.org, released under the Creative Commons 0 license (public domain). Many thanks to their authors.',
      ['Special thanks', 'freesound.org, the collaborative sound library that helps so many creators bring their projects to life'] ] },
    { title: 'Fonts', lines: [
      ['Board titles', 'Alfa Slab One — The Alfa Slab One Project Authors · Oswald — The Oswald Project Authors · Cooper Hewitt — Cooper Hewitt, Smithsonian Design Museum'],
      ['Interface', 'Anton — The Anton Project Authors · D-DIN Condensed — Datto Inc.'],
      'SIL Open Font License 1.1 (below)' ] },
    { title: 'Software', lines: [
      ['howler.js', '© 2013-2020 James Simpson and GoldFire Studios, Inc. (MIT License, below)'],
      ['jsPDF', '© 2010-2025 James Hall, © 2015-2025 yWorks GmbH (MIT License, below)'],
      ['idb-keyval', '© 2016 Jake Archibald (Apache License 2.0, below)'] ] },
    { title: 'Legal', lines: [
      'Thunder Road: Vendetta, Ignition and all associated trade dress are trademarks of Restoration Games, LLC.',
      'Program code © 2026 Mayrik PADEY, under the PolyForm Noncommercial License 1.0.0. Original artwork and documentation © 2026 Mayrik PADEY, under CC BY-NC-SA 4.0. Free to use, modify and share for non-commercial purposes, crediting the original author (licenses below).',
      'Source code and contributions: github.com/Mayrik-P/TRV-Road-Tile-Editor' ] }
  ],
  licenses: [
    // (licences du projet lui-même, choix de Mayrik du 23/11 : LICENSE et LICENSES/)
    { title: 'TRV Road Tile Editor code — PolyForm Noncommercial 1.0.0', file: 'LICENSES/PolyForm-Noncommercial-1.0.0.md' },
    { title: 'TRV Road Tile Editor artwork and documentation — CC BY-NC-SA 4.0', file: 'LICENSES/CC-BY-NC-SA-4.0.txt' },
    { title: 'howler.js — MIT License', file: 'js/vendor/howler-LICENSE.txt' },
    { title: 'jsPDF — MIT License', file: 'js/vendor/jspdf-LICENSE.txt' },
    { title: 'idb-keyval — Apache License 2.0', file: 'js/vendor/idb-keyval-LICENCE.txt' },
    { title: 'Apache License 2.0 — full text', file: 'js/vendor/apache-2.0.txt' },
    { title: 'Alfa Slab One — SIL Open Font License 1.1', file: 'fonts/alfa-slab-one/OFL.txt' },
    { title: 'Oswald — SIL Open Font License 1.1', file: 'fonts/oswald/OFL.txt' },
    { title: 'Cooper Hewitt — SIL Open Font License 1.1', file: 'fonts/cooper-hewitt/OFL.txt' },
    { title: 'Anton — SIL Open Font License 1.1', file: 'fonts/anton/OFL.txt' },
    { title: 'D-DIN Condensed — SIL Open Font License 1.1', file: 'fonts/d-din/OFL.txt' }
  ],
  close: 'Return',
  // Mention courte de l'accueil, à côté du bouton « Credits » (comme TRV-Pocket)
  homeNotice: 'Unofficial fan project\nThunder Road: Vendetta © Restoration Games, LLC'
};
