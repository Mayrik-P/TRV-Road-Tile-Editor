// AUTOSAVE AND "CONTINUE" BUTTON CHECK (slices 4a + 4b) in
// a real browser (Chromium via Playwright), with real page reloads:
// no "Continue" without a save; board, name and LARGE title image (over 5 MB,
// beyond the localStorage limit) found again after reload; the restoration is the
// starting point of the history; "new board" then Ctrl+Z brings back the old one; title
// image reset to default = no longer restored; damaged save ignored; storage forbidden
// by the browser = app usable without error.
// Usage (repo served over HTTP): node tools/check-autosave.js [http://localhost:8765/]
// Exit code 1 on the slightest failure or on any JavaScript error from the page.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib');
const base = process.argv[2] || 'http://localhost:8765/';
const url = new URL('index.html', base).href;
const results = []; const check = (name, ok) => results.push(`${ok ? 'ok' : 'ÉCHEC'} : ${name}`);

// Noise PNG (incompressible) with the dimensions of the title band: > 5 MB.
function noisePng(w, h) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let i = 0; i < raw.length; i++) raw[i] = i % (w * 3 + 1) === 0 ? 0 : (Math.random() * 256) | 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 1 })), chunk('IEND', Buffer.alloc(0))]);
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'autosave-'));
  const big = path.join(tmp, 'title.png'); fs.writeFileSync(big, noisePng(4243, 456));
  const bigMb = fs.statSync(big).size / 1e6;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1300 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ready = () => p.waitForFunction(() => Object.keys(TEXTURES).length === Object.keys(TEXTURE_PATHS).length, null, { timeout: 60000 });
  const paint = async (type, idx) => { await p.click('#tb-' + type); const c = p.locator(`#bsvg [data-idx="${idx}"]`).first(); await c.scrollIntoViewIfNeeded(); const bb = await c.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); };
  const state = () => p.evaluate(() => JSON.stringify(getBoardState()));
  const continueVisible = () => p.evaluate(() => !document.getElementById('board-type-continue').hidden && getComputedStyle(document.getElementById('board-type-continue')).display !== 'none');

  await p.goto(url);
  check('1re visite : pas de bouton Continue', !(await continueVisible()));
  await p.click('#board-type-vendetta'); await ready();
  await paint('road', 3); await paint('rock', 12); await paint('goo', 20);
  await p.click('#title-input'); await p.keyboard.type('Dust Bowl'); await p.evaluate(() => document.activeElement.blur());
  await p.setInputFiles('#title-img-input', big);
  await p.waitForFunction(() => TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE, null, { timeout: 30000 });
  const titleSrc = await p.evaluate(() => TITLE_IMAGE.src.length);
  const before = await state();
  await p.waitForTimeout(1500); // IndexedDB write (asynchronous)

  await p.reload();
  check('après rechargement : bouton Continue visible', await continueVisible());
  check('Continue indique le format et le nom', (await p.textContent('#board-type-continue-desc')) === 'Vendetta — DUST BOWL');
  await p.click('#board-type-continue'); await ready();
  check('Continue : plateau, variantes et nom retrouvés à l\'identique', await state() === before);
  await p.waitForFunction(() => TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE, null, { timeout: 30000 }).catch(() => {});
  check(`Continue : grande image de titre retrouvée (${bigMb.toFixed(1)} Mo)`, await p.evaluate(n => !!TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE && TITLE_IMAGE.src.length === n, titleSrc));
  check('Continue : Undo grisé (la restauration est le point de départ)', await p.evaluate(() => document.getElementById('undo-btn').disabled));
  await paint('salt', 30); await p.keyboard.press('Control+z');
  check('Continue puis une case, Ctrl+Z : retour à l\'état restauré', await state() === before);

  // New board while there was one: Ctrl+Z brings back the old one
  await p.reload();
  await p.click('#board-type-ignition'); await ready();
  check('nouveau plateau Ignition', await p.evaluate(() => BOARD_TYPE) === 'ignition');
  await p.keyboard.press('Control+z');
  check('nouveau plateau puis Ctrl+Z : l\'ancien plateau Vendetta revient', await state() === before);

  // Title image reset to default: no longer restored
  await p.click('#reset-title-btn'); await p.waitForTimeout(1000);
  await p.reload(); await p.click('#board-type-continue'); await ready(); await p.waitForTimeout(1500);
  check('image remise par défaut : plus restaurée ensuite', await p.evaluate(() => !TITLE_IMAGE || TITLE_IMAGE === DEFAULT_TITLE_IMAGE));

  // Damaged save: ignored
  await p.evaluate(() => localStorage.setItem(AUTOSAVE_KEY, '{"version":1,"boardType":"vendetta","board":[1,2'));
  await p.reload();
  check('sauvegarde abîmée : pas de bouton Continue', !(await continueVisible()));
  await p.evaluate(() => localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ version: 99, boardType: 'vendetta', board: [], cellVariant: [] })));
  await p.reload();
  check('sauvegarde d\'une version inconnue : ignorée', !(await continueVisible()));
  check('aucune erreur JavaScript', errs.length === 0);
  await ctx.close();

  // Storage forbidden by the browser (strict private browsing, settings): the app works
  const ctx2 = await b.newContext({ viewport: { width: 1300, height: 1300 } });
  await ctx2.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } });
    Object.defineProperty(window, 'indexedDB', { get() { throw new Error('storage blocked'); } });
  });
  const q = await ctx2.newPage(); const errs2 = []; q.on('pageerror', e => errs2.push(e.message));
  await q.goto(url); await q.click('#board-type-vendetta');
  await q.waitForFunction(() => Object.keys(TEXTURES).length === Object.keys(TEXTURE_PATHS).length, null, { timeout: 60000 });
  await q.click('#tb-road'); const bb = await q.locator('#bsvg [data-idx="5"]').first().boundingBox(); await q.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  check('stockage interdit : la case se peint, aucune erreur', await q.evaluate(() => board[5]) === 'road' && errs2.length === 0);
  await b.close();
  console.log(results.join('\n')); if (errs.length || errs2.length) console.log(errs, errs2);
  process.exit(results.some(r => r.startsWith('ÉCHEC')) ? 1 : 0);
})();
