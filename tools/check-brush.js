// VÉRIFICATION DU PINCEAU (tranche 2b) dans un vrai navigateur (Chromium via Playwright),
// avec de vrais gestes : glissé à la souris (lent et très rapide), une seule étape
// d'annulation par coup de pinceau, clic sur une case à variantes (le visuel change) mais
// glissé sans effet sur les cases déjà du bon type, clic droit sans effet, champ de texte
// quitté en cliquant sur le plateau, glissé au doigt (sans défilement de la page) et
// pincement à deux doigts qui annule le coup de pinceau en cours.
// Usage (dépôt servi en HTTP) : node tools/check-brush.js [http://localhost:8765/]
// Code de sortie 1 au moindre échec ou à la moindre erreur JavaScript de la page.
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://localhost:8765/';
const results = []; const check = (name, ok) => results.push(`${ok ? 'ok' : 'ÉCHEC'} : ${name}`);

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
  // ---------- Souris ----------
  {
    const { b, p, errs } = await open({ viewport: { width: 1300, height: 1300 } });
    const row = [8, 9, 10, 11, 12, 13, 14, 15]; // 2e rangée (Vendetta, 8 colonnes)
    await p.click('#tb-mud');
    const n0 = await undoCount(p);
    const a = await center(p, row[0]), z = await center(p, row[7]);
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(z.x, z.y, { steps: 25 }); await p.mouse.up();
    let t = await types(p);
    check('glissé lent : les 8 cases de la rangée peintes', row.every(i => t[i] === 'mud'));
    check('glissé lent : une seule étape d\'annulation', await undoCount(p) === n0 + 1);
    await p.keyboard.press('Control+z'); t = await types(p);
    check('Ctrl+Z annule tout le coup de pinceau', row.every(i => t[i] === 'road'));
    // glissé très rapide : un seul mouvement de bout en bout
    const r3 = [16, 17, 18, 19, 20, 21, 22, 23];
    await p.click('#tb-goo');
    const c = await center(p, r3[0]), d = await center(p, r3[7]);
    await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(d.x, d.y, { steps: 1 }); await p.mouse.up();
    t = await types(p);
    check('glissé très rapide (1 seul mouvement) : aucune case sautée', r3.every(i => t[i] === 'goo'));
    // cases à variantes : clic = visuel suivant ; glissé sur des cases déjà Impassable = rien
    await p.click('#tb-rock');
    const e1 = await center(p, 24), e2 = await center(p, 25);
    await p.mouse.click(e1.x, e1.y); await p.mouse.click(e2.x, e2.y);
    const v1 = await p.evaluate(() => cellVariant.slice());
    await p.mouse.move(e1.x, e1.y); await p.mouse.down(); await p.mouse.move(e2.x, e2.y, { steps: 10 }); await p.mouse.up();
    const v2 = await p.evaluate(() => cellVariant.slice());
    check('glissé : 1re case Impassable change de visuel (comme un clic)', v2[24] !== v1[24]);
    check('glissé : case déjà Impassable traversée sans changer de visuel', v2[25] === v1[25]);
    await p.mouse.click(e2.x, e2.y);
    const v3 = await p.evaluate(() => cellVariant.slice());
    check('clic sur une case Impassable : visuel suivant', v3[25] !== v2[25]);
    // clic droit : rien
    await p.click('#tb-salt'); const f = await center(p, 30);
    const before = (await types(p))[30];
    await p.mouse.click(f.x, f.y, { button: 'right' });
    check('clic droit : case non peinte', (await types(p))[30] === before);
    // champ de texte puis clic sur le plateau : Ctrl+Z vise le plateau
    await p.click('#title-input'); await p.keyboard.type('Dust');
    await p.mouse.click(f.x, f.y);
    check('clic sur le plateau : le champ de texte n\'a plus le focus', await p.evaluate(() => document.activeElement.id !== 'title-input'));
    await p.keyboard.press('Control+z');
    check('puis Ctrl+Z annule la case peinte', (await types(p))[30] === before);
    check('souris : aucune erreur JavaScript', errs.length === 0);
    await b.close();
  }
  // ---------- Doigt (écran tactile) ----------
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
    check('doigt : glissé peint les cases traversées', row.every(i => t[i] === 'glass'));
    check('doigt : la page ne défile pas pendant le glissé', await p.evaluate(() => scrollY) === scroll0);
    // pincement : 1er doigt peint 2 cases, puis un 2e doigt se pose -> coup de pinceau annulé
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
    check('pincement : les cases étaient bien peintes avant le 2e doigt', midway === 'mud');
    check('pincement : coup de pinceau annulé, plateau comme avant', await p.evaluate(() => JSON.stringify(getBoardState())) === stateBefore);
    check('pincement : aucune étape ajoutée à l\'historique', await undoCount(p) === n0);
    check('doigt : aucune erreur JavaScript', errs.length === 0);
    await b.close();
  }
  console.log(results.join('\n'));
  process.exit(results.some(r => r.startsWith('ÉCHEC')) ? 1 : 0);
})();
