// KEYBOARD CHECK (slice 2d) in a real browser (Chromium via Playwright),
// with real keys: cursor hidden then shown by an arrow, movements blocked
// at the edges, letters (choice + placement, cycling through same-letter types on the same cell,
// resuming the choice on another cell), Enter / Space, Delete, shortcuts inactive in
// a text field, help panel ("?", Escape), cursor hidden when hovering with the mouse
// and never present in the export.
// Usage (repo served over HTTP): node tools/check-keyboard.js [http://localhost:8765/]
// Exit code 1 on the slightest failure or on any JavaScript error from the page.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const base = process.argv[2] || 'http://localhost:8765/';
const results = []; const check = (name, ok) => results.push(`${ok ? 'ok' : 'ÉCHEC'} : ${name}`);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 1300 }, acceptDownloads: true, locale: 'en-GB' });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(new URL('index.html', base).href);
  await p.keyboard.press('ArrowRight');
  check("accueil : aucune réaction aux flèches", await p.evaluate(() => typeof kb !== 'undefined' && !kb.visible));
  await p.click('#board-type-vendetta');
  await p.waitForFunction(() => Object.keys(TEXTURES).length === Object.keys(TEXTURE_PATHS).length, null, { timeout: 60000 });
  const cur = () => p.evaluate(() => ({ idx: kb.cursorIdx, visible: kb.visible, drawn: document.querySelectorAll('#layer-cursor polygon').length }));
  const cell = i => p.evaluate(j => board[j], i);
  await p.mouse.move(2, 2);

  let c = await cur();
  check('curseur caché au départ', !c.visible && c.drawn === 0);
  const start = c.idx;
  await p.keyboard.press('ArrowRight');
  c = await cur();
  check('1er appui sur une flèche : curseur montré sans bouger', c.visible && c.drawn === 1 && c.idx === start);
  await p.keyboard.press('ArrowRight'); c = await cur();
  check('flèche droite : case suivante', c.idx === start + 1);
  for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowUp');
  c = await cur();
  check('flèche haut répétée : bloqué à la 1re rangée', c.idx === (start + 1) % 8);
  for (let i = 0; i < 12; i++) await p.keyboard.press('ArrowLeft');
  c = await cur();
  check('flèche gauche répétée : bloqué au bord gauche', c.idx === 0);

  // Letters: R, R, R on the same cell -> the R types in a row, starting from the type
  // already selected if it starts with R (PR #2 rule), otherwise from the first.
  await p.keyboard.press('ArrowDown'); // cell 8
  const { rIds, startAt } = await p.evaluate(() => {
    const ids = TILES.filter(t => t.label[0].toLowerCase() === 'r').map(t => t.id);
    return { rIds: ids, startAt: Math.max(0, ids.indexOf(sel)) };
  });
  const want = [0, 1, 2].map(k => rIds[(startAt + k) % rIds.length]);
  await p.keyboard.press('r'); const r1 = await cell(8);
  await p.keyboard.press('r'); const r2 = await cell(8);
  await p.keyboard.press('r'); const r3 = await cell(8);
  check(`R R R sur la même case : ${r1}, ${r2}, ${r3} (attendu ${want.join(', ')})`, r1 === want[0] && r2 === want[1] && r3 === want[2]);
  check('la palette suit la lettre', await p.evaluate(() => document.querySelector('.tb.sel').id) === 'tb-' + want[2]);
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('r');
  check(`R sur une autre case : repose le choix en cours (${want[2]})`, await cell(9) === want[2]);
  // Enter / Space: places the chosen type; on Impassable, next visual
  await p.keyboard.press('i'); // cell 9 -> Impassable
  const v1 = await p.evaluate(() => cellVariant[9]);
  await p.keyboard.press('Enter'); const v2 = await p.evaluate(() => cellVariant[9]);
  await p.keyboard.press(' '); const v3 = await p.evaluate(() => cellVariant[9]);
  check('Entrée puis Espace sur Impassable : visuel suivant à chaque fois', v1 !== v2 && v2 !== v3);
  // Delete: cell reset to the type of a new board; one undo step per key
  const def = await p.evaluate(() => DEFAULT_TILE);
  await p.keyboard.press('Delete');
  check('Suppr : case remise en ' + def, await cell(9) === def);
  await p.keyboard.press('Control+z');
  check('Ctrl+Z après Suppr : la case revient', await cell(9) === 'rock');
  // Letter without a type: nothing
  const before = await p.evaluate(() => JSON.stringify(getBoardState()));
  await p.keyboard.press('q');
  check('lettre sans type (Q) : rien ne change', await p.evaluate(() => JSON.stringify(getBoardState())) === before);
  // In a text field: letters are typed, the board does not move
  await p.click('#title-input'); await p.keyboard.type('Road');
  check('dans le champ de texte : lettres saisies, plateau inchangé',
        await p.evaluate(() => document.getElementById('title-input').value) === 'Road'
        && await p.evaluate(() => JSON.stringify(getBoardState().board)) === JSON.stringify(JSON.parse(before).board));
  await p.evaluate(() => document.activeElement.blur());
  // Help
  await p.keyboard.press('?');
  check('« ? » ouvre l\'aide', await p.evaluate(() => !document.getElementById('shortcut-help').hidden));
  await p.keyboard.press('r');
  check('aide ouverte : les lettres ne peignent pas', await p.evaluate(() => JSON.stringify(getBoardState().board)) === JSON.stringify(JSON.parse(before).board));
  await p.keyboard.press('Escape');
  check('Échap ferme l\'aide', await p.evaluate(() => document.getElementById('shortcut-help').hidden));
  await p.keyboard.press('?'); await p.mouse.click(5, 5);
  check('clic en dehors ferme l\'aide', await p.evaluate(() => document.getElementById('shortcut-help').hidden));
  // Mouse on the board: the cursor hides and follows the hovered cell
  await p.keyboard.press('ArrowRight');
  const bb = await p.locator('#bsvg [data-idx="20"]').first().boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 5 });
  c = await cur();
  check('souris sur le plateau : curseur caché, placé sur la case survolée', !c.visible && c.idx === 20);
  // Export: the cursor never appears in it (export with cursor visible = export with cursor hidden)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-'));
  const exportTo = async f => { await p.mouse.move(2, 2); await p.click('#export-open-btn');
    await p.waitForFunction(() => !document.getElementById('export-btn').disabled, null, { timeout: 120000 });
    const [d] = await Promise.all([p.waitForEvent('download'), p.click('#export-btn')]); await d.saveAs(f); };
  await exportTo(path.join(tmp, 'hidden.png'));
  await p.evaluate(() => document.activeElement.blur());
  await p.keyboard.press('ArrowRight');
  check('curseur visible avant l\'export', (await cur()).drawn === 1);
  await exportTo(path.join(tmp, 'visible.png'));
  check('export identique avec ou sans curseur affiché',
        Buffer.compare(fs.readFileSync(path.join(tmp, 'hidden.png')), fs.readFileSync(path.join(tmp, 'visible.png'))) === 0);
  // "Ideal size" bubble of Load title image: placed outside the button (its chevron hid it, 19/11)
  const tipOpacity = () => p.evaluate(() => getComputedStyle(document.getElementById('title-img-tooltip')).opacity);
  await p.mouse.move(2, 2); await p.waitForTimeout(400);
  const tipRest = await tipOpacity();
  await p.hover('#title-img-btn'); await p.waitForTimeout(500);
  const tip = await p.evaluate(() => { const t = document.getElementById('title-img-tooltip').getBoundingClientRect(),
    btn = document.getElementById('title-img-btn'), clip = btn.getBoundingClientRect();
    return { text: document.getElementById('title-img-tooltip').textContent, outside: t.bottom <= clip.top + 1, inBtn: btn.contains(document.getElementById('title-img-tooltip')) }; });
  check(`Load title image : bulle cachée au repos, visible au survol (« ${tip.text} »)`,
        tipRest === '0' && (await tipOpacity()) === '1' && /^Ideal size: \d+ × \d+ px$/.test(tip.text));
  check('bulle hors du bouton découpé en chevron (sinon elle serait masquée)', tip.outside && !tip.inBtn);
  // Announced size = actual size of the title image frame in the board (Vendetta here)
  const drawn = await p.evaluate(() => { const im = [...document.querySelectorAll('#bsvg image')].find(i => /itle/.test(i.getAttribute('href') || ''));
    return `${Math.round(+im.getAttribute('width'))} × ${Math.round(+im.getAttribute('height'))}`; });
  check(`taille annoncée = cadre réel de l'image de titre (${drawn} px)`, tip.text === `Ideal size: ${drawn} px`);
  // "Image too small" warning: actual resolution in the frame (225 dpi threshold)
  const png = (w, h) => p.evaluate(([w, h]) => { const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').fillRect(0, 0, w, h); return c.toDataURL('image/png').split(',')[1]; }, [w, h]);
  const loadTitle = async (w, h) => {
    await p.setInputFiles('#title-img-input', { name: `t${w}x${h}.png`, mimeType: 'image/png', buffer: Buffer.from(await png(w, h), 'base64') });
    await p.waitForFunction(([w, h]) => TITLE_IMAGE && TITLE_IMAGE.width === w && TITLE_IMAGE.height === h, [w, h]);
    return p.evaluate(() => { const e = document.getElementById('title-img-warn'); return e.style.display === 'inline' ? e.textContent : ''; });
  };
  for (const [w, h, want] of [[4044, 456, false], [3100, 350, false], [2000, 456, true], [4044, 300, true]]) {
    const msg = await loadTitle(w, h);
    check(`image de titre ${w} × ${h} (Vendetta) : ${want ? 'avertissement' : 'pas d\'avertissement'}${msg ? ' (« ' + msg + ' »)' : ''}`, !!msg === want);
  }
  // Phone: the warning wraps instead of widening the page
  { const q = await b.newPage({ viewport: { width: 411, height: 900 }, isMobile: true, hasTouch: true }); q.on('pageerror', e => errs.push(e.message));
    await q.goto(new URL('index.html', base).href); await q.click('#board-type-vendetta');
    const buf = Buffer.from(await q.evaluate(() => { const c = document.createElement('canvas'); c.width = 2000; c.height = 456;
      c.getContext('2d').fillRect(0, 0, 2000, 456); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
    await q.setInputFiles('#title-img-input', { name: 't.png', mimeType: 'image/png', buffer: buf });
    await q.waitForFunction(() => document.getElementById('title-img-warn').style.display === 'inline');
    const m = await q.evaluate(() => ({ w: innerWidth, sw: document.documentElement.scrollWidth, right: document.getElementById('title-img-warn').getBoundingClientRect().right }));
    check(`téléphone : avertissement affiché sans élargir la page (page ${m.w} px, contenu ${m.sw} px)`, m.w === 411 && m.sw === 411 && m.right <= 411);
    await q.close(); }
  check('aucune erreur JavaScript', errs.length === 0);
  await b.close();
  console.log(results.join('\n')); if (errs.length) console.log(errs);
  process.exit(results.some(r => r.startsWith('ÉCHEC')) ? 1 : 0);
})();
