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

async function exportTo(page, file) {
  await page.mouse.move(2, 2); // pas de survol au moment de l'export
  await page.click('#export-open-btn'); // fenêtre d'export (consigne d'impression)
  await page.waitForFunction(() => !document.getElementById('export-btn').disabled, null, { timeout: 180000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  await download.saveAs(file);
}

async function paintAndExport(browser, format) {
  const page = await browser.newPage({ viewport: { width: 1300, height: 1300 }, acceptDownloads: true });
  const errors = [], checks = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(new URL('index.html', baseUrl).href);
  // Signal « le plateau a changé » (tranche 0c) : on compte les émissions par raison.
  const hasState = await page.evaluate(() => typeof boardEvents !== 'undefined');
  if (hasState) await page.evaluate(() => {
    window.__changes = {};
    boardEvents.addEventListener('change', e => { const r = e.detail.reason; window.__changes[r] = (window.__changes[r] || 0) + 1; });
  });
  await page.click('#board-type-' + format);
  await page.waitForFunction(() => Object.keys(TEXTURES).length === Object.keys(TEXTURE_PATHS).length, null, { timeout: 180000 });

  const { cols, tileIds, initial } = await page.evaluate(() => ({ cols: COLS, tileIds: TILES.map(t => t.id),
    initial: typeof DEFAULT_TILE !== 'undefined' ? DEFAULT_TILE : 'road' }));
  const cells = scenario(cols, tileIds);
  const clickCell = async idx => {
    const cell = page.locator(`#bsvg [data-idx="${idx}"]`).first();
    await cell.scrollIntoViewIfNeeded();
    const box = await cell.boundingBox();
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
  // Reclic sur une case déjà de son type (type d'un plateau neuf, jamais repeinte) : ne
  // change rien, ne doit rien émettre.
  const roadIdx = cells.find(c => c.type === initial).idx;
  await page.click('#tb-' + initial);
  await clickCell(roadIdx);

  const file = path.join(outDir, format + '.png');
  await exportTo(page, file);

  // Redessin complet du même état (buildBoard), référence de la restauration ci-dessous.
  // La mise à jour case par case (updateCell) ne range pas les éléments du SVG tout à
  // fait dans le même ordre : des arrondis de lissage d'au plus 1/255 sont tolérés
  // (constaté dès la version d'origine, avant tout changement).
  const rebuilt = path.join(outDir, format + '-rebuilt.png');
  await page.evaluate(() => buildBoard());
  await exportTo(page, rebuilt);
  const inc = await comparePng(browser, rebuilt, file);
  checks.push({ name: `redessin complet contre mise à jour case par case : écart max ${inc.maxDelta || 0}/255 sur ${inc.diff || 0} pixels (toléré : 1/255)`,
                ok: inc.identical || (inc.maxDelta || 0) <= 1 });

  if (hasState) {
    // 1. Une émission 'cell' par vraie modification (cases repeintes d'un autre type que
    //    celui d'un plateau neuf + le reclic Fire!), aucune pour le reclic sans effet ;
    //    un seul 'new-board'.
    const expected = cells.filter(c => c.type !== initial).length + 1;
    const got = await page.evaluate(() => window.__changes);
    checks.push({ name: `signal 'cell' émis ${got.cell} fois (attendu ${expected}), 'new-board' ${got['new-board']} (attendu 1)`,
                  ok: got.cell === expected && got['new-board'] === 1 });
    // 2. Photo -> JSON -> nouveau plateau vide -> restauration : même état, même export.
    const rt = await page.evaluate(f => {
      const snap = JSON.parse(JSON.stringify(getBoardState()));
      chooseBoardType(f);
      const emptied = board.every(t => t === DEFAULT_TILE);
      setBoardState(snap);
      return { emptied, same: JSON.stringify(getBoardState()) === JSON.stringify(snap) };
    }, format);
    checks.push({ name: 'restauration : plateau vidé puis état relu à l\'identique', ok: rt.emptied && rt.same });
    const file2 = path.join(outDir, format + '-restored.png');
    await exportTo(page, file2);
    const cmp = await comparePng(browser, file2, rebuilt);
    checks.push({ name: 'restauration : export identique au redessin complet', ok: cmp.identical || cmp.diff === 0 });
    // 3. Photo abîmée (une case en moins) : refusée, plateau intact.
    const bad = await page.evaluate(() => {
      const before = JSON.stringify(getBoardState());
      const s = getBoardState(); s.board.pop();
      let refused = false;
      try { setBoardState(s); } catch (e) { refused = true; }
      return refused && JSON.stringify(getBoardState()) === before;
    });
    checks.push({ name: 'photo abîmée refusée sans rien modifier', ok: bad });
  }
  await page.close();
  return { file, errors, checks };
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
    let diff = 0, maxDelta = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]), Math.abs(da[i + 3] - db[i + 3]));
      if (d) { diff++; if (d > maxDelta) maxDelta = d; }
    }
    return { diff, maxDelta, total: da.length / 4 };
  }, [toUrl(a), toUrl(b)]);
  await page.close();
  return res;
}

(async () => {
  const browser = await chromium.launch();
  let failed = false;
  for (const format of ['vendetta', 'ignition']) {
    const t0 = Date.now();
    const { file, errors, checks } = await paintAndExport(browser, format);
    console.log(`${format} : export ${path.basename(file)} en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (errors.length) { failed = true; console.log('  ERREURS de la page :', errors); }
    for (const c of checks) { if (!c.ok) failed = true; console.log(`  ${c.ok ? 'ok' : 'ÉCHEC'} : ${c.name}`); }
    if (refDir) {
      const res = await comparePng(browser, file, path.join(refDir, format + '.png'));
      if (res.identical) console.log('  identique à la référence (même fichier, octet par octet)');
      else if (res.sizeMismatch) { failed = true; console.log('  TAILLE DIFFÉRENTE :', res.sizeMismatch); }
      else if (res.diff === 0) console.log('  mêmes pixels que la référence (fichiers encodés différemment)');
      else { failed = true; console.log(`  ÉCART : ${res.diff} pixels différents sur ${res.total} (écart max ${res.maxDelta}/255)`); }
    }
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
