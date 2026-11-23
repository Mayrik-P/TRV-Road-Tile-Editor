// FREE DECORATIONS CHECK (phase 7) in a real browser (Chromium via Playwright),
// with real clicks, drags, keys and fingers: palette choice, placement, placement + drag in one
// gesture, move, selection, removal (✕, Delete), Escape, Undo / Redo (one step per gesture),
// brush mode that paints through a decoration, white margin rejected, center kept in the board,
// save (reload + Continue), project file (round trip, old v1 file), export
// (decoration present, clipped at the white margins but visible on the title band, never the
// selection nor the ✕), and with a finger on phone (placement, drag, pinch that cancels).
// Usage (repo served over HTTP): node tools/check-decor.js [http://localhost:8765/]
// Exit code 1 on the slightest failure or on any JavaScript error from the page.
const { chromium, devices } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const base = process.argv[2] || 'http://localhost:8765/';
const results = []; const check = (name, ok) => results.push(`${ok ? 'ok' : 'FAIL'} : ${name}`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'decor-'));

async function open(b, opts) {
  const ctx = await b.newContext(Object.assign({ acceptDownloads: true, locale: 'en-GB' }, opts));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(new URL('index.html', base).href);
  return { ctx, p, errs };
}
const ready = p => p.waitForFunction(() => Object.keys(TEXTURES).length === Object.keys(TEXTURE_PATHS).length, null, { timeout: 60000 });
// Board point (pixels at 300 dpi) -> screen point
const scr = (p, x, y) => p.evaluate(([x, y]) => { const m = document.getElementById('bsvg').getScreenCTM(); return { x: m.a * x + m.e, y: m.d * y + m.f }; }, [x, y]);
const decos = p => p.evaluate(() => JSON.parse(JSON.stringify(decorations)));
const steps = p => p.evaluate(() => undoHistory.past.length);
const exportPng = async (p, file) => {
  await p.click('#export-open-btn');
  await p.waitForFunction(() => !document.getElementById('export-btn').disabled, null, { timeout: 120000 });
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('#export-btn')]); await d.saveAs(file);
};
// Pixels of two exports: differences and white pixels of the reference (margins)
const comparePng = (p, a, b) => p.evaluate(async ([a, b]) => {
  const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const px = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
  const da = px(ia), db = px(ib); let diff = 0, onWhite = 0, inTitle = 0;
  const titleBot = BANDS[0].bot, titleTop = BANDS[0].top;
  for (let k = 0; k < da.length; k += 4) {
    if (da[k] !== db[k] || da[k + 1] !== db[k + 1] || da[k + 2] !== db[k + 2]) {
      diff++;
      if (da[k] === 255 && da[k + 1] === 255 && da[k + 2] === 255) onWhite++;
      const y = Math.floor(k / 4 / ia.width); if (y >= titleTop && y < titleBot) inTitle++;
    }
  }
  return { diff, onWhite, inTitle };
}, ['data:image/png;base64,' + fs.readFileSync(a).toString('base64'), 'data:image/png;base64,' + fs.readFileSync(b).toString('base64')]);

(async () => {
  const b = await chromium.launch();
  // ---------- Mouse and keyboard ----------
  const { ctx, p, errs } = await open(b, { viewport: { width: 1400, height: 1200 } });
  await p.click('#board-type-vendetta'); await ready(p);
  check('at start: brush mode, no decoration, help hidden',
        await p.evaluate(() => decor.mode === 'paint' && decorations.length === 0 && getComputedStyle(document.querySelector('.decor-help')).display === 'none'));
  const helps = () => p.evaluate(() => ({ tile: getComputedStyle(document.querySelector('.tile-help')).display !== 'none',
    decor: getComputedStyle(document.querySelector('.decor-help')).display !== 'none' }));
  let hv = await helps();
  check('on opening: Road chosen, cell-type help text visible, decorations help hidden',
        await p.evaluate(() => document.querySelector('.tb.sel')?.id === 'tb-road') && hv.tile && !hv.decor);
  await p.click('#decor-6'); hv = await helps();
  check('thumbnail chosen: only the decorations help text is visible', !hv.tile && hv.decor);
  check('thumbnail chosen: "decor" mode, thumbnail in orange, cell palette deselected, help visible',
        await p.evaluate(() => decor.mode === 'decor' && decor.item === 6 && document.getElementById('decor-6').classList.contains('sel')
          && !document.querySelector('.tb.sel') && getComputedStyle(document.querySelector('.decor-help')).display !== 'none'));
  let n0 = await steps(p);
  let a = await scr(p, 1500, 1600); await p.mouse.click(a.x, a.y);
  let d = await decos(p);
  check(`click on the board: decoration placed where clicked (${d[0] && d[0].x}, ${d[0] && d[0].y}), one step`,
        d.length === 1 && d[0].item === 6 && Math.abs(d[0].x - 1500) < 8 && Math.abs(d[0].y - 1600) < 8 && await steps(p) === n0 + 1);
  check('decoration placed: selected (circle and ✕)', await p.evaluate(() => decor.selected === 0 && !!document.getElementById('decor-remove')));
  // Placement + drag in the same gesture: a single step, at the final position
  await p.click('#decor-2'); n0 = await steps(p);
  a = await scr(p, 3000, 1300); let z = await scr(p, 3400, 2100);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(z.x, z.y, { steps: 12 }); await p.mouse.up();
  d = await decos(p);
  check(`place then drag in one gesture: placed at the end of the gesture (${d[1].x}, ${d[1].y}), a single step`,
        d.length === 2 && Math.abs(d[1].x - 3400) < 8 && Math.abs(d[1].y - 2100) < 8 && await steps(p) === n0 + 1);
  // Move an existing decoration
  n0 = await steps(p);
  a = await scr(p, 1500, 1600 + 26); z = await scr(p, 2300, 1100);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(z.x, z.y, { steps: 12 }); await p.mouse.up();
  d = await decos(p);
  check(`drag a decoration: moved (${d[0].x}, ${d[0].y}), one step, no new decoration`,
        d.length === 2 && Math.abs(d[0].x - 2300) < 8 && Math.abs(d[0].y - 1074) < 10 && await steps(p) === n0 + 1);
  await p.keyboard.press('Control+z'); d = await decos(p);
  check('Ctrl+Z: the decoration goes back to its place', d.length === 2 && Math.abs(d[0].x - 1500) < 8);
  await p.keyboard.press('Control+y'); d = await decos(p);
  check('Ctrl+Y: moved again', Math.abs(d[0].x - 2300) < 8);
  // Drag far off the board: the center stays in the cells / the title band
  a = await scr(p, 3400, 2104); z = await scr(p, 6000, 4000);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(z.x, z.y, { steps: 8 }); await p.mouse.up();
  d = await decos(p); const bnd = await p.evaluate(() => decorBounds());
  check(`dragged off the board: centre kept inside the board (${d[1].x}, ${d[1].y})`, d[1].x <= bnd.maxX && d[1].y <= bnd.maxY);
  // Click on the white margin: nothing is placed, the selection is removed
  const cnt = d.length; a = await scr(p, 80, 1700); await p.mouse.click(a.x, a.y);
  check('click on the white margin: nothing placed, no more selection', (await decos(p)).length === cnt && await p.evaluate(() => decor.selected === -1));
  // Removal: selection + ✕, then selection + Delete (the cell underneath stays intact)
  a = await scr(p, 2300, 1100); await p.mouse.click(a.x, a.y);
  const xb = await p.locator('#decor-remove').boundingBox(); await p.mouse.click(xb.x + xb.width / 2, xb.y + xb.height / 2);
  check('select then ✕: decoration removed', (await decos(p)).length === cnt - 1);
  d = await decos(p); const cellBefore = await p.evaluate(() => JSON.stringify(board));
  a = await scr(p, d[0].x, d[0].y + 4); await p.mouse.click(a.x, a.y); await p.keyboard.press('Delete');
  check('select then Delete: decoration removed, cells intact', (await decos(p)).length === cnt - 2 && await p.evaluate(() => JSON.stringify(board)) === cellBefore);
  await p.keyboard.press('Control+z');
  a = await scr(p, d[0].x, d[0].y + 4); await p.mouse.click(a.x, a.y); await p.keyboard.press('Escape');
  check('Escape: deselects without removing', (await decos(p)).length === cnt - 1 && await p.evaluate(() => decor.selected === -1));
  // Brush mode: a click on a decoration paints the cell underneath
  await p.evaluate(() => { addDecoration(5, 2000, 1900); decor.selected = -1; redrawDecorations(); }); // in the middle of the cells
  await p.click('#tb-road'); d = (await decos(p)).slice(-1);
  check('choosing a cell type: back to brush mode, thumbnail deselected',
        await p.evaluate(() => decor.mode === 'paint' && !document.querySelector('.decor-btn.sel')));
  a = await scr(p, d[0].x, d[0].y); await p.mouse.click(a.x, a.y);
  const idxUnder = await p.evaluate(([x, y]) => { const m = document.getElementById('bsvg').getScreenCTM();
    const el = document.elementFromPoint(m.a * x + m.e, m.d * y + m.f); return el && el.dataset.idx ? +el.dataset.idx : -1; }, [d[0].x, d[0].y]);
  check(`brush mode: click on a decoration = cell ${idxUnder} painted, decoration intact`,
        idxUnder >= 0 && await p.evaluate(i => board[i], idxUnder) === 'road' && JSON.stringify((await decos(p)).slice(-1)) === JSON.stringify(d));
  // Export: the decoration is in the image; neither the circle nor the ✕
  await p.evaluate(() => { decorations = []; decor.selected = -1; redrawDecorations(); });
  await exportPng(p, path.join(tmp, 'none.png'));
  await p.evaluate(() => addDecoration(4, GAME_X, 1700));            // straddling the left edge (white margin)
  await p.evaluate(() => addDecoration(8, 2400, BANDS[0].top + 120)); // on the title band
  await p.evaluate(() => { decor.selected = -1; redrawDecorations(); });
  await exportPng(p, path.join(tmp, 'with.png'));
  const cmp = await comparePng(p, path.join(tmp, 'none.png'), path.join(tmp, 'with.png'));
  check(`export: decorations present (${cmp.diff} pixels changed)`, cmp.diff > 2000);
  check(`export: nothing on the white margin (${cmp.onWhite} white pixel touched)`, cmp.onWhite === 0);
  check(`export: decoration visible on the title band (${cmp.inTitle} pixels)`, cmp.inTitle > 500);
  await p.click('#decor-8'); const t = await p.evaluate(() => decorations[1]); a = await scr(p, t.x, t.y);
  await p.mouse.click(a.x, a.y);
  check('decoration selected before the export', await p.evaluate(() => decor.selected === 1 && !!document.getElementById('decor-remove')));
  await exportPng(p, path.join(tmp, 'selected.png'));
  check('export with a selected decoration = export without selection (circle and ✕ never exported)',
        Buffer.compare(fs.readFileSync(path.join(tmp, 'with.png')), fs.readFileSync(path.join(tmp, 'selected.png'))) === 0);
  // "Clear board": cells AND decorations, in a single step; Ctrl+Z brings everything back
  { const before = JSON.stringify(await p.evaluate(() => ({ b: board, d: decorations }))); const s0 = await steps(p);
    p.once('dialog', dlg => dlg.accept()); await p.click('#clear-btn');
    check('Clear board: decorations removed too, a single step', (await decos(p)).length === 0 && await steps(p) === s0 + 1);
    await p.keyboard.press('Control+z');
    check('Ctrl+Z after Clear board: cells and decorations come back', JSON.stringify(await p.evaluate(() => ({ b: board, d: decorations }))) === before); }
  // Save: reload + Continue
  const saved = JSON.stringify(await decos(p));
  await p.reload(); await p.click('#board-type-continue'); await ready(p);
  check('reload + Continue: decorations restored', JSON.stringify(await decos(p)) === saved);
  // Project file: round trip, then old file (v1) that opens without decoration
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save-project-btn')]);
  const proj = path.join(tmp, 'p.trvtile'); await dl.saveAs(proj);
  const pj = JSON.parse(fs.readFileSync(proj, 'utf8'));
  check(`project file: format ${pj.formatVersion}, snapshot v${pj.board.version}, ${pj.board.decorations.length} decorations`,
        pj.formatVersion === 2 && pj.board.version === 2 && JSON.stringify(pj.board.decorations) === saved);
  await p.evaluate(() => { decorations = []; redrawDecorations(); });
  await p.click('#home-btn'); await p.setInputFiles('#open-project-input', proj); await p.waitForTimeout(500);
  check('project file reopened: decorations restored', JSON.stringify(await decos(p)) === saved);
  const v1 = JSON.parse(JSON.stringify(pj)); v1.formatVersion = 1; v1.board.version = 1; delete v1.board.decorations;
  const f1 = path.join(tmp, 'v1.trvtile'); fs.writeFileSync(f1, JSON.stringify(v1));
  await p.click('#home-btn'); await p.setInputFiles('#open-project-input', f1); await p.waitForTimeout(500);
  check('old project file (v1): opened, no decoration', await p.evaluate(() => decorations.length === 0 && document.getElementById('app').style.display !== 'none'));
  // Old browser save (v1 key): read back and converted
  await p.evaluate(s => { localStorage.removeItem('trv_road_tile_board_v2'); localStorage.setItem('trv_road_tile_board_v1', s); }, JSON.stringify(v1.board));
  await p.reload();
  check('old browser save (v1): "Continue" offered', await p.evaluate(() => !document.getElementById('board-type-continue').hidden));
  await ctx.close();

  // ---------- Finger (phone) ----------
  const T = await open(b, devices['Pixel 7']);
  const q = T.p; const cdp = await T.ctx.newCDPSession(q);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  await q.click('#board-type-vendetta'); await ready(q);
  await q.click('#decor-6'); await q.locator('#bsvg').scrollIntoViewIfNeeded();
  let s0 = await scr(q, 2000, 1800);
  await touch('touchStart', [[s0.x, s0.y]]); await touch('touchEnd', []);
  let dd = await decos(q);
  check(`finger: touching the board places the decoration (${dd[0] && dd[0].x}, ${dd[0] && dd[0].y})`, dd.length === 1 && Math.abs(dd[0].x - 2000) < 30);
  const s1 = await scr(q, 2000, 1826), s2 = await scr(q, 3000, 2400);
  await touch('touchStart', [[s1.x, s1.y]]);
  for (let k = 1; k <= 10; k++) await touch('touchMove', [[s1.x + (s2.x - s1.x) * k / 10, s1.y + (s2.y - s1.y) * k / 10]]);
  await touch('touchEnd', []);
  dd = await decos(q);
  check(`finger: dragging the decoration moves it (${dd[0].x}, ${dd[0].y})`, dd.length === 1 && Math.abs(dd[0].x - 3000) < 30);
  const before = JSON.stringify(dd), s3 = await scr(q, 3000, 2426);
  await touch('touchStart', [[s3.x, s3.y]]);
  for (let k = 1; k <= 5; k++) await touch('touchMove', [[s3.x - 6 * k, s3.y]]);
  await touch('touchStart', [[s3.x - 30, s3.y], [s3.x + 60, s3.y + 60]]);
  await touch('touchMove', [[s3.x - 50, s3.y], [s3.x + 90, s3.y + 90]]);
  await touch('touchEnd', []);
  check('finger: 2nd finger during a drag (pinch) = move cancelled', JSON.stringify(await decos(q)) === before);
  const xr = await q.locator('#decor-remove').boundingBox();
  check(`finger: ✕ button big enough for a finger (${Math.round(xr.width)} px)`, xr.width >= 24);
  await T.ctx.close();

  // ---------- Finger, fresh page (the pinch above really zooms the page) ----------
  const T2 = await open(b, devices['Pixel 7']);
  { const q = T2.p; const cdp = await T2.ctx.newCDPSession(q);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    let dd;
    await q.click('#board-type-vendetta'); await ready(q);
    await q.click('#decor-12'); await q.locator('#bsvg').scrollIntoViewIfNeeded();
    // 22/11 bug (Mayrik, phone): the ✕ covered the decoration. Smallest decoration (no. 12).
    await q.evaluate(() => { decorations = []; addDecoration(12, 2500, 1800); }); // placed and selected
    const geo = await q.evaluate(() => { const d = decorations[0], g = decorSelectionGeometry(d), m = document.getElementById('bsvg').getScreenCTM();
      return { sx: m.a * g.grab.cx + m.e, sy: m.d * g.grab.cy + m.f, gr: g.grab.r * m.a, xr: g.R * m.a, xx: m.a * g.rx + m.e, xy: m.d * g.ry + m.f }; });
    const gap = Math.hypot(geo.xx - geo.sx, geo.xy - geo.sy) - geo.gr - geo.xr;
    check(`finger, small decoration: the ✕ does not touch the grab area (gap ${gap.toFixed(1)} px, grab ${Math.round(geo.gr * 2)} px)`, gap >= 3 && geo.gr * 2 >= 43);
    await touch('touchStart', [[geo.sx, geo.sy]]);
    for (let k = 1; k <= 8; k++) await touch('touchMove', [[geo.sx + 5 * k, geo.sy + 3 * k]]);
    await touch('touchEnd', []);
    dd = await decos(q);
    check(`finger on the small selected decoration: moved, not deleted (${dd.length} decoration, x ${dd[0] && dd[0].x})`, dd.length === 1 && dd[0].x > 2500);
    await q.evaluate(() => { decor.selected = 0; redrawDecorations(); });
    let xq = await q.locator('#decor-remove').boundingBox();
    await touch('touchStart', [[xq.x + xq.width / 2, xq.y + xq.height / 2]]);
    for (let k = 1; k <= 6; k++) await touch('touchMove', [[xq.x + xq.width / 2 - 8 * k, xq.y + xq.height / 2 + 8 * k]]);
    await touch('touchEnd', []);
    check('finger put on the ✕ then dragged elsewhere: nothing is deleted', (await decos(q)).length === 1);
    await q.evaluate(() => { decor.selected = 0; redrawDecorations(); });
    xq = await q.locator('#decor-remove').boundingBox();
    await touch('touchStart', [[xq.x + xq.width / 2, xq.y + xq.height / 2]]); await touch('touchEnd', []);
    check('touching the ✕: decoration removed', (await decos(q)).length === 0);
  }
  await T2.ctx.close();
  check('no JavaScript error', errs.length === 0 && T.errs.length === 0 && T2.errs.length === 0);
  await b.close();
  console.log(results.join('\n')); if (errs.length || T.errs.length) console.log(errs, T.errs);
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log(results.join('\n')); console.log('FAIL : test interrupted: ' + e.message.split('\n')[0]); process.exit(1); });

