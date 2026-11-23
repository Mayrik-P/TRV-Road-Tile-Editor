// APP CHECK IN A REAL BROWSER (Chromium via Playwright).
//
// For each format (Vendetta, Ignition): opens the app, paints a board that uses
// every tile type (real mouse clicks on the palette then on the cells, like a
// user), clicks a Fire! cell again to cycle its visual, exports the PNG and stores
// it in <output-folder>. Also reports any JavaScript error from the page.
//
// With a reference folder, compares each export to the reference one, pixel by
// pixel: this is what proves that a "no visible change" modification (file
// splitting, cleanup...) really changes nothing in the result.
//
// Usage (the repo must be served over HTTP, e.g. `python3 -m http.server 8765`):
//   node tools/check-app.js http://localhost:8765/ <output-folder> [<reference-folder>]
// Usual method: run first on the old version (reference folder), then on the new
// one with that folder as 3rd argument. Exit code 1 on the slightest difference.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const [baseUrl, outDir, refDir] = process.argv.slice(2);
if (!baseUrl || !outDir) {
  console.error('Usage: node tools/check-app.js <url> <output-folder> [<reference-folder>]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

// Test board: the first 3 rows cycle through all tile types (all 17 in Vendetta),
// the last 3 make large Off-Road / Road areas (road edges, group decorations).
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
  await page.mouse.move(2, 2); // no hover at export time
  await page.click('#export-open-btn'); // export dialog (print instructions)
  await page.waitForFunction(() => !document.getElementById('export-btn').disabled, null, { timeout: 180000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  await download.saveAs(file);
}

async function paintAndExport(browser, format) {
  // en-GB locale: International paper (A3 / A4) by default, exports comparable from one version to the next
  const page = await browser.newPage({ viewport: { width: 1300, height: 1300 }, acceptDownloads: true, locale: 'en-GB' });
  const errors = [], checks = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(new URL('index.html', baseUrl).href);
  // "board changed" signal (slice 0c): emissions are counted by reason.
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
  // Click the 1st Fire! cell again: its visual must move to the next one.
  const fireIdx = cells.find(c => c.type === 'fire').idx;
  await page.click('#tb-fire');
  await clickCell(fireIdx);
  // Click again on a cell already of its type (type of a new board, never repainted): changes
  // nothing, must emit nothing.
  const roadIdx = cells.find(c => c.type === initial).idx;
  await page.click('#tb-' + initial);
  await clickCell(roadIdx);

  const file = path.join(outDir, format + '.png');
  await exportTo(page, file);

  // Full redraw of the same state (buildBoard), reference for the restoration below.
  // The cell-by-cell update (updateCell) does not order the SVG elements quite the
  // same way: smoothing rounding differences of at most 1/255 are tolerated
  // (seen from the original version, before any change).
  const rebuilt = path.join(outDir, format + '-rebuilt.png');
  await page.evaluate(() => buildBoard());
  await exportTo(page, rebuilt);
  const inc = await comparePng(browser, rebuilt, file);
  checks.push({ name: `full redraw versus cell-by-cell update: max difference ${inc.maxDelta || 0}/255 over ${inc.diff || 0} pixels (tolerated: 1/255)`,
                ok: inc.identical || (inc.maxDelta || 0) <= 1 });

  if (hasState) {
    // 1. One 'cell' emission per real modification (cells repainted with a type other than
    //    that of a new board + the Fire! re-click), none for the no-effect re-click;
    //    a single 'new-board'.
    const expected = cells.filter(c => c.type !== initial).length + 1;
    const got = await page.evaluate(() => window.__changes);
    checks.push({ name: `'cell' signal emitted ${got.cell} times (expected ${expected}), 'new-board' ${got['new-board']} (expected 1)`,
                  ok: got.cell === expected && got['new-board'] === 1 });
    // 2. Snapshot -> JSON -> new empty board -> restoration: same state, same export.
    const rt = await page.evaluate(f => {
      const snap = JSON.parse(JSON.stringify(getBoardState()));
      chooseBoardType(f);
      const emptied = board.every(t => t === DEFAULT_TILE);
      setBoardState(snap);
      return { emptied, same: JSON.stringify(getBoardState()) === JSON.stringify(snap) };
    }, format);
    checks.push({ name: 'restore: board emptied then state read back identically', ok: rt.emptied && rt.same });
    const file2 = path.join(outDir, format + '-restored.png');
    await exportTo(page, file2);
    const cmp = await comparePng(browser, file2, rebuilt);
    checks.push({ name: 'restauration : export identique au redessin complet', ok: cmp.identical || cmp.diff === 0 });
    // 3. Damaged snapshot (one cell missing): rejected, board untouched.
    const bad = await page.evaluate(() => {
      const before = JSON.stringify(getBoardState());
      const s = getBoardState(); s.board.pop();
      let refused = false;
      try { setBoardState(s); } catch (e) { refused = true; }
      return refused && JSON.stringify(getBoardState()) === before;
    });
    checks.push({ name: 'damaged snapshot refused without changing anything', ok: bad });
  }
  await page.close();
  return { file, errors, checks };
}

// Compares two PNGs in the browser (canvas): number of differing pixels.
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
    for (const c of checks) { if (!c.ok) failed = true; console.log(`  ${c.ok ? 'ok' : 'FAIL'} : ${c.name}`); }
    if (refDir) {
      const res = await comparePng(browser, file, path.join(refDir, format + '.png'));
      if (res.identical) console.log('  identical to the reference (same file, byte for byte)');
      else if (res.sizeMismatch) { failed = true; console.log('  DIFFERENT SIZE:', res.sizeMismatch); }
      else if (res.diff === 0) console.log('  same pixels as the reference (files encoded differently)');
      else { failed = true; console.log(`  DIFFERENCE: ${res.diff} pixels differ out of ${res.total} (max difference ${res.maxDelta}/255)`); }
    }
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
