// VÉRIFICATION DU CLAVIER (tranche 2d) dans un vrai navigateur (Chromium via Playwright),
// avec de vraies touches : curseur caché puis montré par une flèche, déplacements bloqués
// aux bords, lettres (choix + pose, défilement des types de même lettre sur la même case,
// reprise du choix sur une autre case), Entrée / Espace, Suppr, raccourcis inactifs dans
// un champ de texte, panneau d'aide (« ? », Échap), curseur caché au survol de la souris
// et jamais présent dans l'export.
// Usage (dépôt servi en HTTP) : node tools/check-keyboard.js [http://localhost:8765/]
// Code de sortie 1 au moindre échec ou à la moindre erreur JavaScript de la page.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const base = process.argv[2] || 'http://localhost:8765/';
const results = []; const check = (name, ok) => results.push(`${ok ? 'ok' : 'ÉCHEC'} : ${name}`);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 1300 }, acceptDownloads: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(new URL('index.html', base).href);
  await p.keyboard.press('ArrowRight');
  check("accueil : aucune réaction aux flèches", await p.evaluate(() => typeof kb !== 'undefined' && !kb.visible));
  await p.click('#board-type-vendetta');
  await p.waitForFunction(() => Object.keys(TEXTURES).length === Object.keys(TEXTURE_PATHS).length, null, { timeout: 60000 });
  const cur = () => p.evaluate(() => ({ idx: kb.cursorIdx, visible: kb.visible, drawn: document.querySelectorAll('#layer-cursor polygon').length }));
  const cell = i => p.evaluate(j => board[j], i);
  await p.mouse.move(2, 2);

  let c = await cur();
  check('curseur caché au départ', !c.visible && c.drawn === 0);
  const start = c.idx;
  await p.keyboard.press('ArrowRight');
  c = await cur();
  check('1er appui sur une flèche : curseur montré sans bouger', c.visible && c.drawn === 1 && c.idx === start);
  await p.keyboard.press('ArrowRight'); c = await cur();
  check('flèche droite : case suivante', c.idx === start + 1);
  for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowUp');
  c = await cur();
  check('flèche haut répétée : bloqué à la 1re rangée', c.idx === (start + 1) % 8);
  for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowLeft');
  c = await cur();
  check('flèche gauche répétée : bloqué au bord gauche', c.idx === 0);

  // Lettres : R, R, R sur la même case -> les types en R à la suite, en partant du type
  // déjà sélectionné s'il commence par R (règle de la PR #2), sinon du premier.
  await p.keyboard.press('ArrowDown'); // case 8
  const { rIds, startAt } = await p.evaluate(() => {
    const ids = TILES.filter(t => t.label[0].toLowerCase() === 'r').map(t => t.id);
    return { rIds: ids, startAt: Math.max(0, ids.indexOf(sel)) };
  });
  const want = [0, 1, 2].map(k => rIds[(startAt + k) % rIds.length]);
  await p.keyboard.press('r'); const r1 = await cell(8);
  await p.keyboard.press('r'); const r2 = await cell(8);
  await p.keyboard.press('r'); const r3 = await cell(8);
  check(`R R R sur la même case : ${r1}, ${r2}, ${r3} (attendu ${want.join(', ')})`, r1 === want[0] && r2 === want[1] && r3 === want[2]);
  check('la palette suit la lettre', await p.evaluate(() => document.querySelector('.tb.sel').id) === 'tb-' + want[2]);
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('r');
  check(`R sur une autre case : repose le choix en cours (${want[2]})`, await cell(9) === want[2]);
  // Entrée / Espace : pose du type choisi ; sur Impassable, visuel suivant
  await p.keyboard.press('i'); // case 9 -> Impassable
  const v1 = await p.evaluate(() => cellVariant[9]);
  await p.keyboard.press('Enter'); const v2 = await p.evaluate(() => cellVariant[9]);
  await p.keyboard.press(' '); const v3 = await p.evaluate(() => cellVariant[9]);
  check('Entrée puis Espace sur Impassable : visuel suivant à chaque fois', v1 !== v2 && v2 !== v3);
  // Suppr : case remise au type d'un plateau neuf ; une étape d'annulation par touche
  const def = await p.evaluate(() => DEFAULT_TILE);
  await p.keyboard.press('Delete');
  check('Suppr : case remise en ' + def, await cell(9) === def);
  await p.keyboard.press('Control+z');
  check('Ctrl+Z après Suppr : la case revient', await cell(9) === 'rock');
  // Lettre sans type : rien
  const before = await p.evaluate(() => JSON.stringify(getBoardState()));
  await p.keyboard.press('q');
  check('lettre sans type (Q) : rien ne change', await p.evaluate(() => JSON.stringify(getBoardState())) === before);
  // Dans un champ de texte : les lettres s'écrivent, le plateau ne bouge pas
  await p.click('#title-input'); await p.keyboard.type('Road');
  check('dans le champ de texte : lettres saisies, plateau inchangé',
        await p.evaluate(() => document.getElementById('title-input').value) === 'Road'
        && await p.evaluate(() => JSON.stringify(getBoardState().board)) === JSON.stringify(JSON.parse(before).board));
  await p.evaluate(() => document.activeElement.blur());
  // Aide
  await p.keyboard.press('?');
  check('« ? » ouvre l\'aide', await p.evaluate(() => !document.getElementById('shortcut-help').hidden));
  await p.keyboard.press('r');
  check('aide ouverte : les lettres ne peignent pas', await p.evaluate(() => JSON.stringify(getBoardState().board)) === JSON.stringify(JSON.parse(before).board));
  await p.keyboard.press('Escape');
  check('Échap ferme l\'aide', await p.evaluate(() => document.getElementById('shortcut-help').hidden));
  await p.keyboard.press('?'); await p.mouse.click(5, 5);
  check('clic en dehors ferme l\'aide', await p.evaluate(() => document.getElementById('shortcut-help').hidden));
  // Souris sur le plateau : le curseur se cache et suit la case survolée
  await p.keyboard.press('ArrowRight');
  const bb = await p.locator('#bsvg [data-idx="20"]').first().boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 5 });
  c = await cur();
  check('souris sur le plateau : curseur caché, placé sur la case survolée', !c.visible && c.idx === 20);
  // Export : le curseur n'y figure jamais (export curseur visible = export curseur caché)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-'));
  const exportTo = async f => { await p.mouse.move(2, 2); await p.click('#export-open-btn');
    await p.waitForFunction(() => !document.getElementById('export-btn').disabled, null, { timeout: 120000 });
    const [d] = await Promise.all([p.waitForEvent('download'), p.click('#export-btn')]); await d.saveAs(f); };
  await exportTo(path.join(tmp, 'hidden.png'));
  await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.press('ArrowRight');
  check('curseur visible avant l\'export', (await cur()).drawn === 1);
  await exportTo(path.join(tmp, 'visible.png'));
  check('export identique avec ou sans curseur affiché',
        Buffer.compare(fs.readFileSync(path.join(tmp, 'hidden.png')), fs.readFileSync(path.join(tmp, 'visible.png'))) === 0);
  check('aucune erreur JavaScript', errs.length === 0);
  await b.close();
  console.log(results.join('\n')); if (errs.length) console.log(errs);
  process.exit(results.some(r => r.startsWith('ÉCHEC')) ? 1 : 0);
})();
