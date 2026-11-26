// BARRICADES CHECK (phase 8, slices 8b + 8d) in a real browser (Chromium via Playwright):
// segments of both formats (same as the page geometry, 298 / 195 px, long ones at the edges),
// entry points (add, remove, invalid or duplicate key refused, 'barricade' signal), placement of
// the images (segment centre, row boundary 187.5 px from the top of the image, long / short
// model), isometric order among the overlays (also after a cell painted with a real click, and
// identical after a full redraw), Undo / Redo (one step each), "Clear board" (one step), save
// (real reload + Continue, older v2 save converted, damaged save ignored), project file (round
// trip in another browser, older v2 file converted, bad barricade refused), export (barricades
// present at full resolution, differences confined to the barricades).
// The tool for placing barricades with the mouse or a finger comes in slice 8c.
// Usage (repo served over HTTP): node tools/check-barricades.js [http://localhost:8765/]
// Exit code 1 on the slightest failure or on any JavaScript error from the page.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const base = process.argv[2] || 'http://localhost:8765/';
const url = new URL('index.html', base).href;
const results = []; const check = (name, ok) => results.push(`${ok ? 'ok' : 'FAIL'} : ${name}`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'barricades-'));

(async () => {
  const b = await chromium.launch();
  const open = async () => {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 1200 }, acceptDownloads: true, locale: 'en-GB' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', d => d.accept()); // "Clear board" confirmation
    await p.goto(url); return { ctx, p, errs };
  };
  const ready = p => p.waitForFunction(() => Object.keys(TEXTURES).length === Object.keys(TEXTURE_PATHS).length, null, { timeout: 60000 });
  const paint = async (p, type, idx) => {
    await p.click('#tb-' + type);
    const c = p.locator(`#bsvg [data-idx="${idx}"]`).first(); await c.scrollIntoViewIfNeeded();
    const bb = await c.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  };
  const bars = p => p.evaluate(() => barricades.slice());
  const state = p => p.evaluate(() => JSON.stringify(getBoardState()));
  const exportPng = async (p, file) => {
    await p.click('#export-open-btn');
    await p.waitForFunction(() => !document.getElementById('export-btn').disabled, null, { timeout: 120000 });
    const [d] = await Promise.all([p.waitForEvent('download'), p.click('#export-btn')]); await d.saveAs(file);
    await p.keyboard.press('Escape');
  };
  // Geometry of every barricade image against its segment, and their order in the overlay layer.
  const layout = p => p.evaluate(() => {
    const g = document.getElementById('layer-overlays'), kids = [...g.children];
    return barricades.map(key => {
      const el = g.querySelector(`[data-barricade="${key}"]`), s = barricadeSegment(key);
      if (!el) return { key, missing: true };
      const x = +el.getAttribute('x'), y = +el.getAttribute('y'), w = +el.getAttribute('width'), h = +el.getAttribute('height');
      const pos = kids.indexOf(el), r = s.row;
      // overlays of the row above must come before, those of the row below after
      const cellRow = c => Math.floor(+c.dataset.cell / COLS);
      const before = kids.slice(0, pos).filter(c => c.dataset.cell !== undefined).map(cellRow);
      const after = kids.slice(pos + 1).filter(c => c.dataset.cell !== undefined).map(cellRow);
      return { key, kind: s.kind, href: el.getAttribute('href'),
        centreOk: Math.abs(x + w / 2 - (s.x0 + s.x1) / 2) < 0.01, lineOk: Math.abs(y + 187.5 - s.y) < 0.01, sizeOk: w === 425 && h === 288,
        orderOk: before.every(rr => rr <= r) && after.every(rr => rr > r) };
    });
  });

  // ---------- Segments of both formats ----------
  const A = await open();
  for (const type of ['ignition', 'vendetta']) {
    if (type === 'vendetta') { await A.p.click('#home-btn'); }
    await A.p.click('#board-type-' + type); await ready(A.p);
    const seg = await A.p.evaluate(() => {
      const keys = barricadePairs(COLS).map(([a, b]) => barricadeKey(a, b)).sort();
      const geo = [];
      for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS; c++)
        for (const s of crossRowSegments(c, r, r + 1)) geo.push(barricadeKey(r * COLS + c, (r + 1) * COLS + s.nc));
      const segs = keys.map(barricadeSegment);
      const edgeX = [Math.min(...segs.map(s => s.x0)), Math.max(...segs.map(s => s.x1))];
      return { n: keys.length, cols: COLS, same: JSON.stringify(keys) === JSON.stringify(geo.sort()),
        widths: [...new Set(segs.map(s => Math.round(s.x1 - s.x0)))].sort(),
        kindsOk: segs.every(s => s.kind === (Math.round(s.x1 - s.x0) === 298 ? 'long' : 'short')),
        edgesLong: segs.filter(s => s.x0 === edgeX[0] || s.x1 === edgeX[1]).every(s => s.kind === 'long') };
    });
    check(`${type}: ${seg.n} segments (5 boundaries x ${2 * seg.cols - 1}), same as the page geometry`, seg.n === 5 * (2 * seg.cols - 1) && seg.same);
    check(`${type}: segment lengths ${seg.widths.join(' / ')} px, long / short model by length, long at the board edges`,
          seg.widths.join() === '195,298' && seg.kindsOk && seg.edgesLong);
  }

  // ---------- Entry points ----------
  const { p } = A;
  await paint(p, 'road', 17); await paint(p, 'rock', 10); await paint(p, 'rock', 26);
  const sig = await p.evaluate(() => {
    const seen = []; const f = e => { if (e.detail.reason === 'barricade') seen.push(e.detail.action); };
    boardEvents.addEventListener('change', f);
    // Vendetta, 8 columns. Odd rows (1: cells 8-15, 3: 24-31): long with the cell below (+8), short with
    // the one below right (+9). Even rows: long +8, short below left (+7). Row 5 has no row below.
    ['10-18', '9-18', '26-34', '25-34', '10-18', '10-20', '3-12', 'x', '46-54'].forEach(addBarricade);
    removeBarricade('9-18'); removeBarricade('9-18');
    boardEvents.removeEventListener('change', f);
    return { seen, list: barricades.slice() };
  });
  check(`add / remove: list ${sig.list.join(', ')} (duplicates, invalid pairs and unknown keys refused)`,
        sig.list.join() === '10-18,25-34,26-34');
  check(`'barricade' signal: ${sig.seen.join(', ')} (one per real change)`, sig.seen.join() === 'add,add,add,add,remove');

  // ---------- Placement and order ----------
  let lay = await layout(p);
  check('images: centred on their segment, row boundary 187.5 px from their top, 425 x 288 px',
        lay.length === 3 && lay.every(l => !l.missing && l.centreOk && l.lineOk && l.sizeOk));
  check('images: long and short models according to the segment',
        lay.every(l => l.href.includes('barricade-' + l.kind)) && lay.some(l => l.kind === 'long') && lay.some(l => l.kind === 'short'));
  check('isometric order: after the overlays of the row above, before those of the row below', lay.every(l => l.orderOk));
  // Cell painted with a real click after the barricades (incremental insertion): last cell of row 1 on the left,
  // and a cell of row 2 under the barricade
  await paint(p, 'rock', 8); await paint(p, 'rock', 18);
  lay = await layout(p);
  check('isometric order kept after painting cells above and below (incremental update)', lay.every(l => l.orderOk));
  const order = () => p.evaluate(() => [...document.getElementById('layer-overlays').children].map(c => c.dataset.barricade || 'c' + c.dataset.cell).join());
  const inc = await order();
  await p.evaluate(() => buildBoard());
  check('full redraw: same layer order as the incremental updates', await order() === inc);

  // ---------- Undo / Redo, Clear board ----------
  const before = await bars(p);
  await p.evaluate(() => addBarricade('36-44'));
  await p.keyboard.press('Control+z');
  check('Ctrl+Z: barricade added then removed in one step', JSON.stringify(await bars(p)) === JSON.stringify(before));
  await p.keyboard.press('Control+y');
  check('Ctrl+Y: barricade back', (await bars(p)).includes('36-44'));
  await p.evaluate(() => removeBarricade('36-44'));
  check('removal: one step (Ctrl+Z brings it back)', await (async () => { await p.keyboard.press('Control+z'); return (await bars(p)).includes('36-44'); })());
  await p.click('#clear-btn');
  check('Clear board: all barricades removed', (await bars(p)).length === 0 && await p.evaluate(() => !document.querySelector('[data-barricade]')));
  await p.keyboard.press('Control+z');
  check('Clear board then Ctrl+Z: cells and barricades back in one step', (await bars(p)).length === 4 && await p.evaluate(() => board[10] === 'rock'));

  // ---------- Save (real reload) ----------
  const saved = await state(p);
  await p.reload();
  await p.click('#board-type-continue'); await ready(p);
  check('reload + Continue: board and barricades identical', await state(p) === saved && (await layout(p)).every(l => !l.missing));
  // older save (version 2, before the barricades): converted, opens without barricades
  const v2 = await p.evaluate(() => { const s = getBoardState(); delete s.barricades; s.version = 2; return s; });
  await p.evaluate(v2 => { localStorage.removeItem('trv_road_tile_board_v3'); localStorage.setItem('trv_road_tile_board_v2', JSON.stringify(v2)); }, v2);
  await p.reload();
  const v2visible = await p.evaluate(() => !document.getElementById('board-type-continue').hidden);
  await p.click('#board-type-continue'); await ready(p);
  check('older version 2 save: Continue offered, board read back without barricades',
        v2visible && await p.evaluate(b => JSON.stringify(board) === JSON.stringify(b) && barricades.length === 0 && getBoardState().version === 3, v2.board));
  // damaged save (impossible barricade): ignored, no crash
  await p.evaluate(() => { const s = getBoardState(); s.barricades = ['0-15']; localStorage.setItem('trv_road_tile_board_v3', JSON.stringify(s)); localStorage.removeItem('trv_road_tile_board_v2'); });
  await p.reload();
  check('damaged save (impossible barricade): ignored, no Continue', await p.evaluate(() => document.getElementById('board-type-continue').hidden));
  check('save: no JavaScript error', A.errs.length === 0);

  // ---------- Project file ----------
  await p.click('#board-type-vendetta'); await ready(p);
  await p.evaluate(() => ['10-18', '26-34', '25-34', '1-9'].forEach(addBarricade));
  const projState = await state(p);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save-project-btn')]);
  const file = path.join(tmp, 'p.trvtile'); await dl.saveAs(file);
  const proj = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('project: format 3, barricades in the board snapshot', proj.formatVersion === 3 && proj.board.version === 3 && proj.board.barricades.join() === '1-9,10-18,25-34,26-34');
  const B = await open();
  await B.p.setInputFiles('#open-project-input', file); await ready(B.p);
  check('project opened in another browser: identical, barricades drawn', await state(B.p) === projState && (await layout(B.p)).length === 4);
  // older project file (format 2, snapshot version 2)
  const old = JSON.parse(JSON.stringify(proj)); old.formatVersion = 2; old.board.version = 2; delete old.board.barricades;
  const oldFile = path.join(tmp, 'old.trvtile'); fs.writeFileSync(oldFile, JSON.stringify(old));
  await B.p.click('#home-btn'); await B.p.setInputFiles('#open-project-input', oldFile); await ready(B.p);
  check('older format 2 project: opens, without barricades', await B.p.evaluate(b => barricades.length === 0 && JSON.stringify(board) === JSON.stringify(b), old.board.board));
  // bad barricade: refused without changing anything
  const bad = JSON.parse(JSON.stringify(proj)); bad.board.barricades = ['10-18', '10-18'];
  const badFile = path.join(tmp, 'bad.trvtile'); fs.writeFileSync(badFile, JSON.stringify(bad));
  const msgs = []; B.p.removeAllListeners('dialog'); B.p.on('dialog', d => { msgs.push(d.message()); d.accept(); });
  const keep = await state(B.p);
  await B.p.click('#home-btn'); await B.p.setInputFiles('#open-project-input', badFile); await B.p.waitForTimeout(500);
  check('project with a duplicated barricade: refused, board unchanged', msgs.some(m => m.includes('damaged')) && await state(B.p) === keep);
  check('project: no JavaScript error', B.errs.length === 0);
  await B.ctx.close();

  // ---------- Export ----------
  const withFile = path.join(tmp, 'with.png'), withoutFile = path.join(tmp, 'without.png');
  await exportPng(p, withFile);
  const boxes = await p.evaluate(() => barricades.map(k => { const s = barricadeSegment(k); const cx = (s.x0 + s.x1) / 2;
    return [cx - 212.5, s.y - 187.5, cx + 212.5, s.y + 100.5]; }));
  await p.evaluate(() => { beginAction('test'); ['10-18', '26-34', '25-34', '1-9'].forEach(removeBarricade); endAction(); });
  await exportPng(p, withoutFile);
  const cmp = await p.evaluate(async ([a, b, boxes]) => {
    const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const px = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
    const da = px(ia), db = px(ib); let diff = 0, outside = 0; const inBox = boxes.map(() => 0);
    for (let k = 0; k < da.length; k += 4) {
      if (da[k] === db[k] && da[k + 1] === db[k + 1] && da[k + 2] === db[k + 2]) continue;
      diff++;
      const x = (k / 4) % ia.width, y = Math.floor(k / 4 / ia.width);
      const i = boxes.findIndex(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
      if (i < 0) outside++; else inBox[i]++;
    }
    return { w: ia.width, diff, outside, inBox };
  }, ['data:image/png;base64,' + fs.readFileSync(withFile).toString('base64'), 'data:image/png;base64,' + fs.readFileSync(withoutFile).toString('base64'), boxes]);
  check(`export: each barricade drawn (${cmp.inBox.join(' / ')} different pixels), nothing changed elsewhere (${cmp.outside})`,
        cmp.w === 4961 && cmp.inBox.every(n => n > 5000) && cmp.outside === 0);
  check('export: no JavaScript error', A.errs.length === 0);
  await A.ctx.close();
  await b.close();
  console.log(results.join('\n'));
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
})();
