// UNDO / REDO CHECK (slice 2a) in a real browser (Chromium via
// Playwright), with real clicks and real keys: Undo / Redo buttons, Ctrl+Z,
// Ctrl+Y, Ctrl+Shift+Z, Cmd+Z, re-click on a variant cell, name typing merged into
// one step (and Ctrl+Z in the field left to the field), Reset + format change
// undone, shortcuts inactive on the home screen.
// Usage (repo served over HTTP): node tools/check-undo.js [http://localhost:8765/]
// Exit code 1 on the slightest failure or on any JavaScript error from the page.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 1300 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const results = []; const check = (name, ok) => results.push(`${ok ? 'ok' : 'ÉCHEC'} : ${name}`);
  await p.goto(new URL('index.html', process.argv[2] || 'http://localhost:8765/').href); await p.click('#board-type-vendetta');
  await p.waitForFunction(() => Object.keys(TEXTURES).length === Object.keys(TEXTURE_PATHS).length, null, { timeout: 60000 });
  const state = () => p.evaluate(() => JSON.stringify(getBoardState()));
  const btn = id => p.evaluate(i => document.getElementById(i).disabled, id);
  const paint = async (type, idx) => { await p.click('#tb-' + type); const c = p.locator(`#bsvg [data-idx="${idx}"]`).first(); await c.scrollIntoViewIfNeeded(); const bb = await c.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); };
  const s0 = await state();
  check('boutons grisés au départ', await btn('undo-btn') && await btn('redo-btn'));
  await paint('mud', 3); const s1 = await state();
  await paint('rock', 4); const s2 = await state();
  await paint('rock', 4); const s3 = await state(); // re-click: next visual
  check('reclic Impassable = nouvelle étape (visuel différent)', s3 !== s2);
  await p.click('#undo-btn'); check('Undo (bouton) : visuel Impassable précédent', await state() === s2);
  await p.keyboard.press('Control+z'); check('Ctrl+Z : avant la pose Impassable', await state() === s1);
  await p.keyboard.press('Control+z'); check('Ctrl+Z : plateau de départ', await state() === s0);
  check('Undo grisé, Redo actif', await btn('undo-btn') && !(await btn('redo-btn')));
  await p.keyboard.press('Control+y'); check('Ctrl+Y : rétabli', await state() === s1);
  await p.keyboard.press('Control+Shift+z'); check('Ctrl+Maj+Z : rétabli', await state() === s2);
  await p.keyboard.press('Meta+z'); check('Cmd+Z (Mac) : annulé', await state() === s1);
  await paint('mud', 10); check('nouvelle action après Undo : Redo vidé', await btn('redo-btn'));
  // Board name: typing = a single step; Ctrl+Z in the field = field undo, not board undo
  const sBeforeName = await state();
  await p.click('#title-input'); await p.keyboard.type('Dust Bowl');
  await p.keyboard.press('Control+z'); // in the field: native undo, the board must not move
  await p.click('#bwrap', { position: { x: 5, y: 5 } }); // leave the field
  const sAfterName = await state();
  await p.keyboard.press('Control+z');
  check('saisie du nom annulée en une seule étape', await state() === sBeforeName && sAfterName !== sBeforeName);
  // Clear board: whole board cleared in one step, name kept, Ctrl+Z brings everything back
  const sBeforeClear = await state();
  await p.fill('#title-input', 'Mesa'); await p.dispatchEvent('#title-input', 'input'); await p.evaluate(() => document.activeElement.blur());
  const sNamed = await state();
  p.once('dialog', d => d.accept()); await p.click('#clear-btn');
  check('Clear board : toutes les cases au type d\'un plateau neuf, nom gardé',
        await p.evaluate(() => board.every(t => t === DEFAULT_TILE) && document.getElementById('title-input').value === 'Mesa'));
  await p.keyboard.press('Control+z');
  check('Clear board puis Ctrl+Z : plateau revenu en une étape', await state() === sNamed);
  await p.keyboard.press('Control+z'); // also undoes the name, for the rest of the test
  p.once('dialog', d => d.dismiss()); await p.click('#clear-btn');
  check('Clear board refusé : rien ne change', await state() === sBeforeClear);
  // Home then Continue: editor reopened, history intact
  await p.click('#home-btn'); await p.click('#board-type-continue');
  await p.keyboard.press('Control+y'); await p.keyboard.press('Control+z');
  check('Home puis Continue : historique intact (Ctrl+Y / Ctrl+Z fonctionnent)', await state() === sBeforeClear && !(await btn('undo-btn')));
  // Home + new format, then undo
  const sBeforeReset = await state();
  await p.click('#home-btn'); await p.click('#board-type-ignition');
  await p.waitForFunction(() => BOARD_TYPE === 'ignition');
  await p.keyboard.press('Control+z');
  check('Home + Ignition annulé : retour au plateau Vendetta peint', await state() === sBeforeReset && await p.evaluate(() => BOARD_TYPE) === 'vendetta');
  // Shortcuts inactive on the home screen
  await p.click('#home-btn');
  const sPicker = await state(); await p.keyboard.press('Control+z');
  check("raccourcis inactifs sur l'écran d'accueil", await state() === sPicker);
  console.log(results.join('\n')); console.log('erreurs :', errs.length ? errs : 'aucune');
  await b.close(); process.exit(results.some(r => r.startsWith('ÉCHEC')) || errs.length ? 1 : 0);
})();
