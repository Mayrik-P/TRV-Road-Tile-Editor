// SOUND CHECK (phase 6) in a real browser (Chromium via Playwright), with
// real clicks, keys and drags. Playbacks are collected by spying on howler.js (file,
// volume, pitch of each sound played): the 7 sounds load; palette, cell placement, brush
// stroke (1st cell normal, following ones quieter at varied pitch, never two within 70 ms),
// Undo / Redo (keyboard and button, no double sound), "Clear board" (a single stamp,
// nothing if refused), keyboard (placement without palette sound), export (flag, no button sound),
// rejected file, speaker (mutes everything, choice remembered after reload, turns back on).
// Usage (repo served over HTTP): node tools/check-sounds.js [http://localhost:8765/]
// Exit code 1 on the slightest failure or on any JavaScript error from the page.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const base = process.argv[2] || 'http://localhost:8765/';
const results = []; const check = (name, ok) => results.push(`${ok ? 'ok' : 'FAIL'} : ${name}`);

// Spy installed before any page script: wraps Howl as soon as howler.js declares it.
const SPY = () => {
  window.__played = [];
  let H;
  Object.defineProperty(window, 'Howl', { configurable: true, get: () => H, set: v => {
    H = v;
    const play = v.prototype.play, vol = v.prototype.volume, rate = v.prototype.rate;
    v.prototype.play = function (...a) {
      const id = play.apply(this, a);
      window.__played.push({ id, file: this._src.split('/').pop().replace('.mp3', ''), volume: 1, rate: 1, t: performance.now() });
      return id;
    };
    const setter = (fn, key) => function (...a) {
      if (a.length === 2) { const r = window.__played.find(x => x.id === a[1] && x.file === this._src.split('/').pop().replace('.mp3', '')); if (r) r[key] = a[0]; }
      return fn.apply(this, a);
    };
    v.prototype.volume = setter(vol, 'volume'); v.prototype.rate = setter(rate, 'rate');
  } });
};

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1300 }, acceptDownloads: true, locale: 'en-GB' });
  await ctx.addInitScript(SPY);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const nativeDialogs = []; p.on('dialog', d => { nativeDialogs.push(d.type()); d.dismiss(); }); // never alert() / confirm() (26/11)
  const played = () => p.evaluate(() => window.__played.map(x => x.file));
  const take = async () => { const r = await p.evaluate(() => window.__played.splice(0)); return r; };
  const files = async () => (await take()).map(x => x.file).join(',');
  const center = async idx => { const bb = await p.locator(`#bsvg [data-idx="${idx}"]`).first().boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; };

  await p.goto(new URL('index.html', base).href);
  await p.waitForFunction(() => Object.keys(sounds.howls).length === 7 && Object.values(sounds.howls).every(h => h.state() !== 'loading'), null, { timeout: 30000 });
  const states = await p.evaluate(() => Object.entries(sounds.howls).map(([k, h]) => k + ':' + h.state()));
  check(`the 7 sounds load (${states.join(' ')})`, states.every(s => s.endsWith(':loaded')));

  await take(); await p.click('#board-type-vendetta');
  check('home button: "button" sound', (await files()) === 'tap-menu-button');
  await p.waitForFunction(() => Object.keys(TEXTURES).length === Object.keys(TEXTURE_PATHS).length, null, { timeout: 60000 });
  await p.mouse.move(2, 2);

  await p.click('#tb-mud');
  { const f = await files(); check('palette: palette sound alone (' + f + ')', f === 'dash-zoom'); }

  const c8 = await center(8); await p.mouse.click(c8.x, c8.y);
  let r = await take();
  check('click on a cell: one placement sound, normal volume', r.length === 1 && r[0].file === 'card-flip' && r[0].volume === 1 && r[0].rate === 1);

  // Slow brush stroke on the 3rd row (8 cells)
  const a = await center(16), z = await center(23);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(z.x, z.y, { steps: 40 }); await p.mouse.up();
  r = await take();
  const first = r[0], rest = r.slice(1);
  check(`brush: ${r.length} placement sounds for 8 cells (at most 8)`, r.length >= 2 && r.length <= 8 && r.every(x => x.file === 'card-flip'));
  check('brush: 1st cell at normal volume', first.volume === 1 && first.rate === 1);
  check('brush: following cells at 70 % volume, pitch between 0.92 and 1.08',
        rest.every(x => x.volume === 0.7 && x.rate >= 0.92 && x.rate <= 1.08) && rest.some(x => x.rate !== 1));
  const gaps = r.slice(1).map((x, i) => x.t - r[i].t);
  check(`brush: never two sounds within 70 ms (smallest gap ${Math.round(Math.min(...gaps))} ms)`, gaps.every(g => g >= 69));
  // Very fast drag: 8 cells in a single movement -> a single sound (same instant)
  await p.click('#tb-goo'); await take();
  const c = await center(24), d = await center(31);
  await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(d.x, d.y, { steps: 1 }); await p.mouse.up();
  r = await take();
  check(`very fast drag: ${r.length} sound(s), no burst`, r.length >= 1 && r.length <= 2);

  await p.keyboard.press('Control+z');
  check('Ctrl+Z: back sound', (await files()) === 'tap-back');
  await p.waitForTimeout(150); // a human does not click in under 70 ms (anti-burst rule)
  await p.click('#redo-btn');
  { const f = await files(); check('Redo button: back sound alone, no extra button sound (' + f + ')', f === 'tap-back'); }

  await p.click('#clear-btn'); await p.click('#message-cancel');
  { const f = await files(); check('Clear board refused: only the sound of the Cancel button (' + f + ')', f === 'tap-menu-button'); }
  await p.click('#clear-btn'); await p.click('#message-ok');
  check('Clear board accepted: a single stamp, no placement sound', (await files()) === 'stamp');
  // Cells all already empty but a decoration placed: the stamp still plays (once)
  await p.evaluate(() => addDecoration(3, 2000, 2000)); await p.waitForTimeout(150); await take();
  await p.click('#clear-btn'); await p.click('#message-ok');
  check('Clear board, empty cells + decoration: a single stamp', (await files()) === 'stamp');

  await p.keyboard.press('ArrowRight'); await p.keyboard.press('r');
  check('keyboard, letter: placement sound alone (no palette sound)', (await files()) === 'card-flip');

  await p.click('#export-open-btn');
  check('Export image: "button" sound', (await files()) === 'tap-menu-button');
  await p.waitForFunction(() => !document.getElementById('export-btn').disabled, null, { timeout: 120000 });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#export-btn')]);
  await dl.path();
  { const r = await take(); check(`export finished: finish flag alone, at 50 % volume (${r.map(x => x.file + ' ' + x.volume).join(', ')})`, r.length === 1 && r[0].file === 'finish-flag' && r[0].volume === 0.5); }

  // Rejected file (from the home screen)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snd-')); const bad = path.join(tmp, 'bad.trvtile');
  fs.writeFileSync(bad, 'not a project');
  await p.click('#home-btn'); await take();
  await p.setInputFiles('#open-project-input', bad);
  await p.waitForFunction(() => window.__played.length > 0, null, { timeout: 5000 }).catch(() => {});
  check('file rejected: refusal sound', (await files()) === 'tap-refuse');
  const msg = await p.evaluate(() => messageOpen() && document.getElementById('message-text').textContent);
  if (msg) await p.click('#message-ok');
  check(`file rejected: message in the page ("${String(msg).slice(0, 40)}…"), closed by OK without sound`,
        typeof msg === 'string' && msg.includes('not a TRV') && !(await p.evaluate(() => messageOpen())) && (await files()) === '');

  // Speaker
  await p.click('#board-type-continue'); await take();
  await p.click('#sound-btn');
  check('speaker muted: no sound, button crossed out', (await files()) === '' && await p.evaluate(() => document.getElementById('sound-btn').getAttribute('aria-pressed') === 'false'));
  await p.click('#tb-road'); const c9 = await center(9); await p.mouse.click(c9.x, c9.y);
  check('sound muted: palette and placement silent', (await files()) === '');
  await p.reload();
  await p.waitForFunction(() => typeof sounds !== 'undefined' && Object.keys(sounds.howls).length === 7);
  await p.click('#board-type-continue');
  check('after reload: sound still muted', (await files()) === '' && await p.evaluate(() => sounds.muted));
  await p.click('#sound-btn');
  check('speaker back on: a "button" sound right away', (await files()) === 'tap-menu-button' && !(await p.evaluate(() => sounds.muted)));

  // Safety net (js/sounds.js): sound paused behind howler's back, as a browser may do (howler alone never
  // resumes it: measured 26/11). Safari's "interrupted" state cannot be produced in Chromium.
  await p.evaluate(() => Howler.ctx.suspend());
  const paused = await p.evaluate(() => Howler.ctx.state);
  await p.click('#tb-mud'); await p.waitForTimeout(300);
  await take(); const c10 = await center(10); await p.mouse.click(c10.x, c10.y);
  const resumed = await p.waitForFunction(() => Howler.ctx.state === 'running', null, { timeout: 3000 }).then(() => 'running', () => p.evaluate(() => Howler.ctx.state));
  check(`safety net: sound paused by the browser (${paused}), running again after the next gesture (${resumed}), sounds play`,
        paused === 'suspended' && resumed === 'running' && (await files()) === 'card-flip');
  check(`no browser alert() / confirm() window (${nativeDialogs.join(', ') || 'none'}): they cut the sound in Safari`, nativeDialogs.length === 0);
  check('no JavaScript error', errs.length === 0);
  await b.close();
  console.log(results.join('\n')); if (errs.length) console.log(errs);
  process.exit(results.some(x => x.startsWith('FAIL')) ? 1 : 0);
})();
