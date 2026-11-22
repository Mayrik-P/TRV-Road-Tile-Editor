// VÉRIFICATION DU FICHIER DE PROJET .trvtile (tranche 4d) dans un vrai navigateur (Chromium via
// Playwright) : « Save project » télécharge un fichier signé et versionné au nom du plateau,
// avec l'image de titre personnalisée ; « Open project file » (accueil) le rouvre à
// l'identique dans un AUTRE navigateur (contexte vierge) ; ouvert par-dessus un plateau en
// cours, Ctrl+Z ramène l'ancien ; fichiers refusés sans rien modifier (pas un projet, abîmé,
// version plus récente) ; le nom du PNG exporté suit toujours la même règle.
// Usage (dépôt servi en HTTP) : node tools/check-project.js [http://localhost:8765/]
// Code de sortie 1 au moindre échec ou à la moindre erreur JavaScript de la page.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const base = process.argv[2] || 'http://localhost:8765/';
const url = new URL('index.html', base).href;
const results = []; const check = (name, ok) => results.push(`${ok ? 'ok' : 'ÉCHEC'} : ${name}`);
// Petit PNG valide (1 x 1 pixel rouge) comme image de titre personnalisée.
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'project-'));
  const img = path.join(tmp, 'title.png'); fs.writeFileSync(img, PNG_1PX);
  const b = await chromium.launch();
  const open = async () => {
    const ctx = await b.newContext({ viewport: { width: 1300, height: 1300 }, acceptDownloads: true, locale: 'en-GB' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); return { ctx, p, errs };
  };
  const ready = p => p.waitForFunction(() => Object.keys(TEXTURES).length === Object.keys(TEXTURE_PATHS).length, null, { timeout: 60000 });
  const paint = async (p, type, idx) => { await p.click('#tb-' + type); const c = p.locator(`#bsvg [data-idx="${idx}"]`).first(); await c.scrollIntoViewIfNeeded(); const bb = await c.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); };
  const state = p => p.evaluate(() => JSON.stringify(getBoardState()));

  // ---- Enregistrer ----
  const A = await open();
  await A.p.click('#board-type-vendetta'); await ready(A.p);
  await paint(A.p, 'road', 3); await paint(A.p, 'rock', 12); await paint(A.p, 'rock', 12); await paint(A.p, 'mud', 21);
  await A.p.fill('#title-input', 'Dust Bowl'); await A.p.dispatchEvent('#title-input', 'input');
  await A.p.setInputFiles('#title-img-input', img);
  await A.p.waitForFunction(() => TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE);
  const saved = await state(A.p);
  const [dl] = await Promise.all([A.p.waitForEvent('download'), A.p.click('#save-project-btn')]);
  const file = path.join(tmp, dl.suggestedFilename()); await dl.saveAs(file);
  check(`nom du fichier : ${dl.suggestedFilename()}`, dl.suggestedFilename() === 'DUST-BOWL.trvtile');
  const proj = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('fichier signé et versionné (format, formatVersion)', proj.format === 'trv-road-tile' && proj.formatVersion === 2); // 2 depuis la phase 7 (décorations libres)
  check('fichier : plateau complet et image de titre intégrée', JSON.stringify(proj.board) === saved && typeof proj.titleImage === 'string' && proj.titleImage.startsWith('data:image/png'));
  await A.p.click('#export-open-btn');
  await A.p.waitForFunction(() => !document.getElementById('export-btn').disabled, null, { timeout: 120000 });
  const [dl2] = await Promise.all([A.p.waitForEvent('download'), A.p.click('#export-btn')]);
  check(`nom du PNG inchangé : ${dl2.suggestedFilename()}`, dl2.suggestedFilename() === 'DUST-BOWL-A3.png');
  check('enregistrement : aucune erreur JavaScript', A.errs.length === 0);
  await A.ctx.close();

  // ---- Ouvrir dans un autre navigateur (contexte vierge) ----
  const B = await open();
  check('accueil : bouton Open project file visible', await B.p.isVisible('#open-project-btn'));
  await B.p.setInputFiles('#open-project-input', file); await ready(B.p);
  check('ouverture : plateau, variantes et nom identiques', await state(B.p) === saved);
  await B.p.waitForFunction(() => TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE, null, { timeout: 10000 }).catch(() => {});
  check('ouverture : image de titre retrouvée', await B.p.evaluate(src => TITLE_IMAGE && TITLE_IMAGE.src === src, proj.titleImage));
  check('ouverture dans une page neuve : Undo grisé', await B.p.evaluate(() => document.getElementById('undo-btn').disabled));
  // Par-dessus un plateau en cours : Ctrl+Z ramène l'ancien
  await B.p.click('#home-btn'); await B.p.click('#board-type-ignition'); await ready(B.p);
  await paint(B.p, 'glass', 5);
  const ign = await state(B.p);
  await B.p.click('#home-btn'); await B.p.setInputFiles('#open-project-input', file);
  await B.p.waitForFunction(() => BOARD_TYPE === 'vendetta');
  check('ouvert par-dessus un plateau Ignition : projet chargé', await state(B.p) === saved);
  await B.p.keyboard.press('Control+z');
  check('puis Ctrl+Z : le plateau Ignition revient', await state(B.p) === ign);
  // Fichiers refusés sans rien modifier (un seul écouteur d'alerte, permanent : un fichier
  // accepté à tort n'ouvre pas d'alerte et ne doit pas fausser le contrôle suivant)
  let lastDialog = '';
  B.p.on('dialog', d => { lastDialog = d.message(); d.accept(); });
  const bad = async (name, content, expectWord) => {
    const f = path.join(tmp, name); fs.writeFileSync(f, content);
    const before = await state(B.p); lastDialog = '';
    await B.p.click('#home-btn'); await B.p.setInputFiles('#open-project-input', f); await B.p.waitForTimeout(500);
    await B.p.evaluate(() => { if (document.getElementById('board-type-picker').style.display !== 'none') continueSavedBoard(); });
    const msg = lastDialog;
    check(`fichier refusé (${name}) : message « ${msg.slice(0, 60)}… », plateau inchangé`, msg.includes(expectWord) && await state(B.p) === before);
  };
  await bad('photo.trvtile', 'not json at all', 'not a TRV');
  await bad('autre.trvtile', JSON.stringify({ hello: 1 }), 'not a TRV');
  await bad('futur.trvtile', JSON.stringify({ ...proj, formatVersion: 99 }), 'newer version');
  const broken = JSON.parse(JSON.stringify(proj)); broken.board.board.pop();
  await bad('abime.trvtile', JSON.stringify(broken), 'damaged');
  check('ouverture : aucune erreur JavaScript', B.errs.length === 0);
  await b.close();
  console.log(results.join('\n')); if (A.errs.length || B.errs.length) console.log(A.errs, B.errs);
  process.exit(results.some(r => r.startsWith('ÉCHEC')) ? 1 : 0);
})();
