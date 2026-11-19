// VÉRIFICATION DE LA FENÊTRE D'EXPORT (consigne d'impression) dans un vrai navigateur
// (Chromium via Playwright), sur connexion lente simulée (5 Mbit/s) : « Export the .png »
// s'ouvre tout de suite, « Download PNG » attend la fin du chargement des originaux (avec
// sa progression), papier indiqué selon le format, Annuler / Échap / clic à côté ferment
// sans exporter, raccourcis clavier bloqués tant qu'elle est ouverte, fermée une fois le
// téléchargement lancé.
// Usage (dépôt servi en HTTP) : node tools/check-export-dialog.js [http://localhost:8765/]
// Code de sortie 1 au moindre échec ou à la moindre erreur JavaScript de la page.
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8765/';
const results = []; const check = (name, ok) => results.push(`${ok ? 'ok' : 'ÉCHEC'} : ${name}`);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true, locale: 'en-GB' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const cdp = await ctx.newCDPSession(p); await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 5e6 / 8, uploadThroughput: 1e6 / 8 });
  await p.goto(new URL('index.html', base).href);
  await p.click('#board-type-ignition');
  await p.waitForFunction(() => Object.keys(TEXTURES).length === Object.keys(TEXTURE_PATHS).length, null, { timeout: 120000 });
  const isOpen = () => p.evaluate(() => !document.getElementById('export-dialog').hidden);

  // Une case peinte d'abord, pour que Ctrl+Z ait réellement quelque chose à annuler.
  await p.click('#tb-road'); const cb = await p.locator('#bsvg [data-idx="5"]').first().boundingBox();
  await p.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2);
  check('bouton Export cliquable pendant le chargement', await p.evaluate(() => !document.getElementById('export-open-btn').disabled));
  await p.click('#export-open-btn');
  check('la fenêtre s\'ouvre tout de suite', await isOpen());
  const lbl = await p.textContent('#export-label');
  check(`pendant le chargement : « ${lbl} », bouton grisé`, /Preparing high-res… \d+%/.test(lbl) && await p.evaluate(() => document.getElementById('export-btn').disabled));
  check('papier indiqué pour Ignition : A4, portrait', (await p.textContent('#export-paper')) === 'A4, portrait');
  const before = await p.evaluate(() => JSON.stringify(board));
  await p.keyboard.press('m'); // Muddy sur la case Road qui vient d'être peinte : changerait forcément
  check('fenêtre ouverte : une lettre ne peint rien', await p.evaluate(() => JSON.stringify(board)) === before);
  await p.keyboard.press('Control+z');
  check('fenêtre ouverte : Ctrl+Z n\'annule rien', await p.evaluate(() => JSON.stringify(board)) === before);
  await p.keyboard.press('Escape');
  check('Échap ferme la fenêtre', !(await isOpen()));
  await p.click('#export-open-btn'); await p.click('#export-cancel-btn');
  check('Cancel ferme la fenêtre', !(await isOpen()));
  await p.click('#export-open-btn'); await p.mouse.click(10, 500);
  check('clic à côté ferme la fenêtre', !(await isOpen()));
  // Fin du chargement : le bouton se débloque, le téléchargement ferme la fenêtre
  await p.click('#export-open-btn');
  await p.waitForFunction(() => !document.getElementById('export-btn').disabled, null, { timeout: 180000 });
  check('chargement fini : « Download PNG » cliquable', (await p.textContent('#export-label')) === 'Download PNG');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#export-btn')]);
  check(`téléchargement lancé (${dl.suggestedFilename()}), fenêtre fermée`, /\.png$/.test(dl.suggestedFilename()) && !(await isOpen()));
  // Papier US (tranche 5b) : Letter pour Ignition, nom de fichier et taille de page
  await p.click('#export-open-btn'); await p.click('#paper-region button[data-region="us"]');
  check('US choisi : papier Letter (8.5×11″), portrait', (await p.textContent('#export-paper')) === 'Letter (8.5×11″), portrait');
  const [dlUs] = await Promise.all([p.waitForEvent('download'), p.click('#export-btn')]);
  check(`export US : ${dlUs.suggestedFilename()}`, /-Letter\.png$/.test(dlUs.suggestedFilename()));
  // Vendetta : le choix US est retenu -> Tabloid ; retour International -> A3
  await p.click('#home-btn'); await p.click('#board-type-vendetta');
  await p.click('#export-open-btn');
  check('Vendetta, choix US retenu : Tabloid (11×17″), landscape', (await p.textContent('#export-paper')) === 'Tabloid (11×17″), landscape');
  await p.click('#paper-region button[data-region="intl"]');
  check('Vendetta, International : A3, landscape', (await p.textContent('#export-paper')) === 'A3, landscape');
  // Navigateur réglé en anglais des États-Unis, sans choix retenu : US proposé d'office
  const ctxUs = await b.newContext({ viewport: { width: 1300, height: 1000 }, locale: 'en-US' });
  const q = await ctxUs.newPage(); await q.goto(new URL('index.html', base).href); await q.click('#board-type-ignition');
  await q.click('#export-open-btn');
  check('navigateur en-US : papier US proposé par défaut', (await q.textContent('#export-paper')) === 'Letter (8.5×11″), portrait');
  check('aucune erreur JavaScript', errs.length === 0);
  await b.close();
  console.log(results.join('\n')); if (errs.length) console.log(errs);
  process.exit(results.some(r => r.startsWith('ÉCHEC')) ? 1 : 0);
})();
