// ===== js/credits.js — Credits (home screen, "Credits" button; phase 6 bis, Mayrik 19/11).
//
// The ONLY list of the project's credits, like tools/v2/credits.js of TRV-Pocket: every resource
// added (sound, image, font, code) is listed here, with its licence. Data file only (texts
// in English, project convention): it can be edited without touching the code. Display:
// openCredits() in js/ui.js.
//
// Form taken from games and from TRV-Pocket (credits grouped by role, readable in the app):
//   - notice: warning at the top;
//   - sections: a title, then lines; a [role, names] line is shown with the "ROLE" above;
//   - licenses: licence texts, collapsed (like Android's "Open source licenses" list),
//     read from the licence file shipped with each resource (exact text, never retyped).
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
      // (Mayrik, 19/11: the images that are not scans of the game are his creations)
      ['Original artwork', 'Mayrik PADEY (all images that are not scans of the game)'] ] },
    { title: 'Contributors', lines: [
      ['Autosave and keyboard navigation ideas', 'ChessMess (GitHub pull requests #1 and #2)'],
      'Many thanks to everyone who suggests ideas or reports problems on GitHub.' ] },
    // (credits of the rulebook, taken from TRV-Pocket as is; Ignition = lighter version of the game,
    // same publisher and same team — Mayrik, 19/11)
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
    // (licenses of the project itself, Mayrik's choice of 23/11: LICENSE and LICENSES/)
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
  // Short notice on the home screen, next to the "Credits" button (like TRV-Pocket)
  homeNotice: 'Unofficial fan project\nThunder Road: Vendetta © Restoration Games, LLC'
};
