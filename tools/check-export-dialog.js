// EXPORT DIALOG CHECK (print instructions) in a real browser
// (Chromium via Playwright), on a simulated slow connection (5 Mbit/s): "Export image"
// opens right away, "Download PNG" waits for the originals to finish loading (with
// its progress), paper shown according to the format, Cancel / Escape / click outside close it
// without exporting, keyboard shortcuts blocked while it is open, closed once the
// download has started.
// Usage (repo served over HTTP): node tools/check-export-dialog.js [http://localhost:8765/]
// Exit code 1 on the slightest failure or on any JavaScript error from the page.
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

  // A cell painted first, so that Ctrl+Z really has something to undo.
  await p.click('#tb-road'); const cb = await p.locator('#bsvg [data-idx="5"]').first().boundingBox();
  await p.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2);
  check('bouton Export cliquable pendant le chargement', await p.evaluate(() => !document.getElementById('export-open-btn').disabled));
  await p.click('#export-open-btn');
  check('la fenêtre s\'ouvre tout de suite', await isOpen());
  const lbl = await p.textContent('#export-label');
  check(`pendant le chargement : « ${lbl} », bouton grisé`, /Preparing high-res… \d+%/.test(lbl) && await p.evaluate(() => document.getElementById('export-btn').disabled));
  check('papier indiqué pour Ignition : A4, portrait', (await p.textContent('#export-paper')) === 'A4, portrait');
  const before = await p.evaluate(() => JSON.stringify(board));
  await p.keyboard.press('m'); // Muddy on the Road cell just painted: would necessarily change
  check('fenêtre ouverte : une lettre ne peint rien', await p.evaluate(() => JSON.stringify(board)) === before);
  await p.keyboard.press('Control+z');
  check('fenêtre ouverte : Ctrl+Z n\'annule rien', await p.evaluate(() => JSON.stringify(board)) === before);
  await p.keyboard.press('Escape');
  check('Échap ferme la fenêtre', !(await isOpen()));
  await p.click('#export-open-btn'); await p.click('#export-cancel-btn');
  check('Cancel ferme la fenêtre', !(await isOpen()));
  await p.click('#export-open-btn'); await p.mouse.click(10, 500);
  check('clic à côté ferme la fenêtre', !(await isOpen()));
  // End of loading: the button unlocks, the download closes the dialog
  await p.click('#export-open-btn');
  await p.waitForFunction(() => !document.getElementById('export-btn').disabled, null, { timeout: 180000 });
  check('chargement fini : « Download PNG » cliquable', (await p.textContent('#export-label')) === 'Download PNG');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#export-btn')]);
  check(`téléchargement lancé (${dl.suggestedFilename()}), fenêtre fermée`, /\.png$/.test(dl.suggestedFilename()) && !(await isOpen()));
  // US paper (slice 5b): Letter for Ignition, file name and page size
  await p.click('#export-open-btn'); await p.click('#paper-region button[data-region="us"]');
  check('US choisi : papier Letter (8.5×11″), portrait', (await p.textContent('#export-paper')) === 'Letter (8.5×11″), portrait');
  const [dlUs] = await Promise.all([p.waitForEvent('download'), p.click('#export-btn')]);
  check(`export US : ${dlUs.suggestedFilename()}`, /-Letter\.png$/.test(dlUs.suggestedFilename()));
  // PDF (slice 5c): same paper, page at the exact size (Letter = 612 x 792 points)
  await p.click('#export-open-btn');
  await p.waitForFunction(() => !document.getElementById('export-pdf-btn').disabled, null, { timeout: 60000 });
  const [dlPdf] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click('#export-pdf-btn')]);
  const pdfPath = await dlPdf.path();
  const pdfText = require('fs').readFileSync(pdfPath, 'latin1');
  const box = (pdfText.match(/\/MediaBox \[([^\]]+)\]/) || [])[1] || '';
  const [, , mw, mh] = box.trim().split(/\s+/).map(Number);
  check(`export PDF : ${dlPdf.suggestedFilename()}, page ${mw} x ${mh} points`, /-Letter\.pdf$/.test(dlPdf.suggestedFilename()) && Math.abs(mw - 612) < 0.5 && Math.abs(mh - 792) < 0.5 && pdfText.startsWith('%PDF-'));
  check('après le PDF : fenêtre fermée, boutons rendus', !(await isOpen()) && await p.evaluate(() => !document.getElementById('export-btn').disabled && document.getElementById('export-pdf-btn').textContent === 'Download PDF'));
  // Vendetta: the US choice is remembered -> Tabloid; back to International -> A3
  await p.click('#home-btn'); await p.click('#board-type-vendetta');
  await p.click('#export-open-btn');
  check('Vendetta, choix US retenu : Tabloid (11×17″), landscape', (await p.textContent('#export-paper')) === 'Tabloid (11×17″), landscape');
  await p.click('#paper-region button[data-region="intl"]');
  check('Vendetta, International : A3, landscape', (await p.textContent('#export-paper')) === 'A3, landscape');
  // Browser set to US English, no remembered choice: US offered by default
  const ctxUs = await b.newContext({ viewport: { width: 1300, height: 1000 }, locale: 'en-US' });
  const q = await ctxUs.newPage(); await q.goto(new URL('index.html', base).href); await q.click('#board-type-ignition');
  await q.click('#export-open-btn');
  check('navigateur en-US : papier US proposé par défaut', (await q.textContent('#export-paper')) === 'Letter (8.5×11″), portrait');
  // File that does not respond (22/11 bug: export stuck at 98%): attempt abandoned after
  // ?stalltimeout without any data, then a new attempt; never cut off if it arrives slowly.
  const stallRun = async (name, { stallFirstOnly, slow }) => {
    const c = await b.newContext({ viewport: { width: 1300, height: 900 }, locale: 'en-GB' });
    const q = await c.newPage(); q.on('pageerror', e => errs.push(e.message));
    if (slow) { const cd = await c.newCDPSession(q); await cd.send('Network.enable');
      await cd.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 5e6 / 8, uploadThroughput: 1e6 / 8 }); }
    let asked = 0;
    if (stallFirstOnly !== undefined) await q.route('**/textures/Texture-Toxic-Goo.webp', route => {
      asked++; if (stallFirstOnly && asked > 1) route.continue(); /* otherwise: never responds */ });
    const retries = []; q.on('console', m => { if (m.text().startsWith('Retrying')) retries.push(m.text()); });
    await q.goto(new URL('index.html?stalltimeout=3000', base).href); await q.click('#board-type-vendetta');
    await q.waitForFunction(() => /Download PNG|Reload/.test(document.getElementById('export-label').textContent), null, { timeout: 180000 });
    const label = await q.textContent('#export-label');
    await c.close();
    return { label, asked, retries };
  };
  let r = await stallRun('1er essai suspendu', { stallFirstOnly: true });
  check(`fichier suspendu au 1er essai : relancé (${r.asked} demandes), export débloqué (« ${r.label} »)`, r.label === 'Download PNG' && r.asked === 2 && r.retries.length === 1);
  r = await stallRun('toujours suspendu', { stallFirstOnly: false });
  check(`fichier qui ne répond jamais : 3 essais puis « ${r.label} » (plus d'attente sans fin)`, r.label === '⚠ Reload page' && r.asked === 3);
  r = await stallRun('connexion lente', { slow: true });
  check(`connexion lente et régulière, délai de 3 s : aucun téléchargement coupé (${r.retries.length} relance), « ${r.label} »`, r.label === 'Download PNG' && r.retries.length === 0);
  check('aucune erreur JavaScript', errs.length === 0);
  await b.close();
  console.log(results.join('\n')); if (errs.length) console.log(errs);
  process.exit(results.some(r => r.startsWith('ÉCHEC')) ? 1 : 0);
})();
