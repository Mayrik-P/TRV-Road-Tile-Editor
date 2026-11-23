// BRUSH CHECK (slice 2b) in a real browser (Chromium via Playwright),
// with real gestures: mouse drag (slow and very fast), a single undo step
// per brush stroke, click on a variant cell (the visual changes) but
// drag without effect on cells already of the right type, right click without effect, text field
// left by clicking on the board, finger drag (no page scroll) and
// two-finger pinch that cancels the brush stroke in progress.
// Usage (repo served over HTTP): node tools/check-brush.js [http://localhost:8765/]
// Exit code 1 on the slightest failure or on any JavaScript error from the page.
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://localhost:8765/';
const results = []; const check = (name, ok) => results.push(`${ok ? 'ok' : 'FAIL'} : ${name}`);

async function open(ctxOpts) {
  const b = await chromium.launch(); const ctx = await b.newContext(ctxOpts); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(new URL('index.html', base).href); await p.click('#board-type-vendetta');
  await p.waitForFunction(() => Object.keys(TEXTURES).length === Object.keys(TEXTURE_PATHS).length, null, { timeout: 60000 });
  return { b, ctx, p, errs };
}
const center = async (p, idx) => { const bb = await p.locator(`#bsvg [data-idx="${idx}"]`).first().boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; };
const types = p => p.evaluate(() => board.slice());
const undoCount = p => p.evaluate(() => undoHistory.past.length);

(async () => {
  // ---------- Mouse ----------
  {
    const { b, p, errs } = await open({ viewport: { width: 1300, height: 1300 } });
    const row = [8, 9, 10, 11, 12, 13, 14, 15]; // 2nd row (Vendetta, 8 columns)
    await p.click('#tb-mud');
    const n0 = await undoCount(p);
    const a = await center(p, row[0]), z = await center(p, row[7]);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(z.x, z.y, { steps: 25 }); await p.mouse.up();
    let t = await types(p);
    check('slow drag: the 8 cells of the row painted', row.every(i => t[i] === 'mud'));
    check('slow drag: a single undo step', await undoCount(p) === n0 + 1);
    await p.keyboard.press('Control+z'); t = await types(p);
    const initial = await p.evaluate(() => DEFAULT_TILE);
    check('Ctrl+Z annule tout le coup de pinceau', row.every(i => t[i] === initial));
    // very fast drag: a single movement from end to end
    const r3 = [16, 17, 18, 19, 20, 21, 22, 23];
    await p.click('#tb-goo');
    const c = await center(p, r3[0]), d = await center(p, r3[7]);
    await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(d.x, d.y, { steps: 1 }); await p.mouse.up();
    t = await types(p);
    check('very fast drag (single move): no cell skipped', r3.every(i => t[i] === 'goo'));
    // variant cells: click = next visual; drag over cells already Impassable = nothing
    await p.click('#tb-rock');
    const e1 = await center(p, 24), e2 = await center(p, 25);
    await p.mouse.click(e1.x, e1.y); await p.mouse.click(e2.x, e2.y);
    const v1 = await p.evaluate(() => cellVariant.slice());
    await p.mouse.move(e1.x, e1.y); await p.mouse.down(); await p.mouse.move(e2.x, e2.y, { steps: 10 }); await p.mouse.up();
    const v2 = await p.evaluate(() => cellVariant.slice());
    check('drag: 1st Impassable cell changes visual (like a click)', v2[24] !== v1[24]);
    check('drag: cell already Impassable crossed without changing visual', v2[25] === v1[25]);
    await p.mouse.click(e2.x, e2.y);
    const v3 = await p.evaluate(() => cellVariant.slice());
    check('clic sur une case Impassable : visuel suivant', v3[25] !== v2[25]);
    // right click: nothing
    await p.click('#tb-salt'); const f = await center(p, 30);
    const before = (await types(p))[30];
    await p.mouse.click(f.x, f.y, { button: 'right' });
    check('clic droit : case non peinte', (await types(p))[30] === before);
    // text field then click on the board: Ctrl+Z targets the board
    await p.click('#title-input'); await p.keyboard.type('Dust');
    await p.mouse.click(f.x, f.y);
    check('clic sur le plateau : le champ de texte n\'a plus le focus', await p.evaluate(() => document.activeElement.id !== 'title-input'));
    await p.keyboard.press('Control+z');
    check('puis Ctrl+Z annule la case peinte', (await types(p))[30] === before);
    check('souris : aucune erreur JavaScript', errs.length === 0);
    await b.close();
  }
  // ---------- Finger (touch screen) ----------
  {
    const { b, ctx, p, errs } = await open(devices['Pixel 7']);
    const cdp = await ctx.newCDPSession(p);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    await p.click('#tb-glass');
    const row = [8, 9, 10, 11];
    for (const i of row) await p.locator(`#bsvg [data-idx="${i}"]`).first().scrollIntoViewIfNeeded();
    const pts = []; for (const i of row) pts.push(await center(p, i));
    const scroll0 = await p.evaluate(() => scrollY);
    await touch('touchStart', [[pts[0].x, pts[0].y]]);
    for (let k = 1; k <= 20; k++) { const x = pts[0].x + (pts[3].x - pts[0].x) * k / 20, y = pts[0].y + (pts[3].y - pts[0].y) * k / 20; await touch('touchMove', [[x, y]]); }
    await touch('touchEnd', []);
    let t = await types(p);
    check('finger: drag paints the crossed cells', row.every(i => t[i] === 'glass'));
    check('finger: the page does not scroll during the drag', await p.evaluate(() => scrollY) === scroll0);
    // pinch: 1st finger paints 2 cells, then a 2nd finger lands -> brush stroke cancelled
    await p.click('#tb-mud');
    const r2 = [16, 17]; for (const i of r2) await p.locator(`#bsvg [data-idx="${i}"]`).first().scrollIntoViewIfNeeded();
    const q0 = await center(p, 16), q1 = await center(p, 17);
    const stateBefore = await p.evaluate(() => JSON.stringify(getBoardState()));
    const n0 = await undoCount(p);
    await touch('touchStart', [[q0.x, q0.y]]);
    for (let k = 1; k <= 10; k++) await touch('touchMove', [[q0.x + (q1.x - q0.x) * k / 10, q0.y]]);
    const midway = (await types(p))[17];
    await touch('touchStart', [[q1.x, q1.y], [q1.x + 60, q1.y + 60]]);
    await touch('touchMove', [[q1.x - 20, q1.y], [q1.x + 90, q1.y + 90]]);
    await touch('touchEnd', []);
    check('pinch: the cells were painted before the 2nd finger', midway === 'mud');
    check('pinch: brush stroke cancelled, board as before', await p.evaluate(() => JSON.stringify(getBoardState())) === stateBefore);
    check('pinch: no step added to the history', await undoCount(p) === n0);
    check('doigt : aucune erreur JavaScript', errs.length === 0);
    await b.close();
  }
  console.log(results.join('\n'));
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
})();
