// VÉRIFICATION DE L'APPLI DANS UN VRAI NAVIGATEUR (Chromium via Playwright).
//
// Pour chaque format (Vendetta, Ignition) : ouvre l'appli, peint un plateau qui
// utilise tous les types de cases (vrais clics de souris sur la palette puis sur
// les cases, comme un utilisateur), reclique une case Fire! pour faire défiler son
// visuel, exporte le PNG et le range dans <dossier-sortie>. Relève aussi toute
// erreur JavaScript de la page.
//
// Avec un dossier de référence, compare chaque export à celui de la référence,
// pixel par pixel : c'est ce qui prouve qu'un changement « sans effet visible »
// (découpage des fichiers, nettoyage…) ne change vraiment rien au résultat.
//
// Usage (le dépôt doit être servi en HTTP, par exemple `python3 -m http.server 8765`) :
//   node tools/check-app.js http://localhost:8765/ <dossier-sortie> [<dossier-référence>]
// Méthode habituelle : lancer d'abord sur l'ancienne version (dossier de référence),
// puis sur la nouvelle avec ce dossier en 3e argument. Code de sortie 1 au moindre écart.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const [baseUrl, outDir, refDir] = process.argv.slice(2);
if (!baseUrl || !outDir) {
  console.error('Usage : node tools/check-app.js <url> <dossier-sortie> [<dossier-référence>]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

// Plateau de test : les 3 premières rangées font défiler tous les types de cases
// (tous les 17 en Vendetta), les 3 dernières font de grandes zones Off-Road / Road
// (bords de route, décorations de groupe).
function scenario(cols, tileIds) {
  const cells = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const type = row < 3 ? tileIds[idx % tileIds.length] : (col < cols / 2 ? 'sand' : 'road');
      cells.push({ idx, type });
    }
  return cells;
}

async function paintAndExport(browser, format) {
  const page = await browser.newPage({ viewport: { width: 1300, height: 1300 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(new URL('index.html', baseUrl).href);
  await page.click('#board-type-' + format);
  await page.waitForFunction(() => /Export/.test(document.getElementById('export-label').textContent), null, { timeout: 180000 });

  const { cols, tileIds } = await page.evaluate(() => ({ cols: COLS, tileIds: TILES.map(t => t.id) }));
  const cells = scenario(cols, tileIds);
  const clickCell = async idx => {
    const box = await page.locator(`#bsvg [data-idx="${idx}"]`).first().boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  let current = null;
  for (const { idx, type } of cells) {
    if (type !== current) { await page.click('#tb-' + type); current = type; }
    await clickCell(idx);
  }
  // Reclic sur la 1re case Fire! : son visuel doit passer au suivant.
  const fireIdx = cells.find(c => c.type === 'fire').idx;
  await page.click('#tb-fire');
  await clickCell(fireIdx);
  await page.mouse.move(2, 2); // pas de survol au moment de l'export

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  const file = path.join(outDir, format + '.png');
  await download.saveAs(file);
  await page.close();
  return { file, errors };
}

// Compare deux PNG dans le navigateur (canvas) : nombre de pixels différents.
async function comparePng(browser, a, b) {
  if (Buffer.compare(fs.readFileSync(a), fs.readFileSync(b)) === 0) return { identical: true, diff: 0 };
  const page = await browser.newPage();
  const toUrl = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const res = await page.evaluate(async ([ua, ub]) => {
    const load = u => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = u; });
    const [ia, ib] = await Promise.all([load(ua), load(ub)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { sizeMismatch: [ia.width, ia.height, ib.width, ib.height] };
    const px = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const da = px(ia), db = px(ib);
    let diff = 0;
    for (let i = 0; i < da.length; i += 4)
      if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2] || da[i + 3] !== db[i + 3]) diff++;
    return { diff, total: da.length / 4 };
  }, [toUrl(a), toUrl(b)]);
  await page.close();
  return res;
}

(async () => {
  const browser = await chromium.launch();
  let failed = false;
  for (const format of ['vendetta', 'ignition']) {
    const t0 = Date.now();
    const { file, errors } = await paintAndExport(browser, format);
    console.log(`${format} : export ${path.basename(file)} en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (errors.length) { failed = true; console.log('  ERREURS de la page :', errors); }
    if (refDir) {
      const res = await comparePng(browser, file, path.join(refDir, format + '.png'));
      if (res.identical) console.log('  identique à la référence (même fichier, octet par octet)');
      else if (res.sizeMismatch) { failed = true; console.log('  TAILLE DIFFÉRENTE :', res.sizeMismatch); }
      else if (res.diff === 0) console.log('  mêmes pixels que la référence (fichiers encodés différemment)');
      else { failed = true; console.log(`  ÉCART : ${res.diff} pixels différents sur ${res.total}`); }
    }
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
