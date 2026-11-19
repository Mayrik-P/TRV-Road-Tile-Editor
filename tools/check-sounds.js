// VÉRIFICATION DES SONS (phase 6) dans un vrai navigateur (Chromium via Playwright), avec de
// vrais clics, touches et glissés. Les lectures sont relevées en espionnant howler.js (fichier,
// volume, hauteur de chaque son lancé) : les 7 sons se chargent ; palette, pose d'une case, coup
// de pinceau (1re case normale, suivantes plus discrètes à hauteur variée, jamais deux en 70 ms),
// Annuler / Rétablir (au clavier et au bouton, sans double son), « Clear board » (un seul tampon,
// rien si on refuse), clavier (pose sans son de palette), export (drapeau, pas de son de bouton),
// fichier refusé, haut-parleur (coupe tout, choix retenu après rechargement, rallume).
// Usage (dépôt servi en HTTP) : node tools/check-sounds.js [http://localhost:8765/]
// Code de sortie 1 au moindre échec ou à la moindre erreur JavaScript de la page.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const base = process.argv[2] || 'http://localhost:8765/';
const results = []; const check = (name, ok) => results.push(`${ok ? 'ok' : 'ÉCHEC'} : ${name}`);

// Espion posé avant tout script de la page : enveloppe Howl dès que howler.js le déclare.
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
  const played = () => p.evaluate(() => window.__played.map(x => x.file));
  const take = async () => { const r = await p.evaluate(() => window.__played.splice(0)); return r; };
  const files = async () => (await take()).map(x => x.file).join(',');
  const center = async idx => { const bb = await p.locator(`#bsvg [data-idx="${idx}"]`).first().boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; };

  await p.goto(new URL('index.html', base).href);
  await p.waitForFunction(() => Object.keys(sounds.howls).length === 7 && Object.values(sounds.howls).every(h => h.state() !== 'loading'), null, { timeout: 30000 });
  const states = await p.evaluate(() => Object.entries(sounds.howls).map(([k, h]) => k + ':' + h.state()));
  check(`les 7 sons se chargent (${states.join(' ')})`, states.every(s => s.endsWith(':loaded')));

  await take(); await p.click('#board-type-vendetta');
  check('bouton de l\'accueil : son « bouton »', (await files()) === 'tap-menu-button');
  await p.waitForFunction(() => Object.keys(TEXTURES).length === Object.keys(TEXTURE_PATHS).length, null, { timeout: 60000 });
  await p.mouse.move(2, 2);

  await p.click('#tb-mud');
  { const f = await files(); check('palette : son de la palette seul (' + f + ')', f === 'dash-zoom'); }

  const c8 = await center(8); await p.mouse.click(c8.x, c8.y);
  let r = await take();
  check('clic sur une case : un son de pose, volume normal', r.length === 1 && r[0].file === 'card-flip' && r[0].volume === 1 && r[0].rate === 1);

  // Coup de pinceau lent sur la 3e rangée (8 cases)
  const a = await center(16), z = await center(23);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(z.x, z.y, { steps: 40 }); await p.mouse.up();
  r = await take();
  const first = r[0], rest = r.slice(1);
  check(`pinceau : ${r.length} sons de pose pour 8 cases (au plus 8)`, r.length >= 2 && r.length <= 8 && r.every(x => x.file === 'card-flip'));
  check('pinceau : 1re case à volume normal', first.volume === 1 && first.rate === 1);
  check('pinceau : cases suivantes à 70 % du volume, hauteur entre 0,92 et 1,08',
        rest.every(x => x.volume === 0.7 && x.rate >= 0.92 && x.rate <= 1.08) && rest.some(x => x.rate !== 1));
  const gaps = r.slice(1).map((x, i) => x.t - r[i].t);
  check(`pinceau : jamais deux sons en moins de 70 ms (plus petit écart ${Math.round(Math.min(...gaps))} ms)`, gaps.every(g => g >= 69));
  // Glissé très rapide : 8 cases en un seul mouvement -> un seul son (même instant)
  await p.click('#tb-goo'); await take();
  const c = await center(24), d = await center(31);
  await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(d.x, d.y, { steps: 1 }); await p.mouse.up();
  r = await take();
  check(`glissé très rapide : ${r.length} son(s), pas de rafale`, r.length >= 1 && r.length <= 2);

  await p.keyboard.press('Control+z');
  check('Ctrl+Z : son de retour', (await files()) === 'tap-back');
  await p.waitForTimeout(150); // un humain ne clique pas en moins de 70 ms (règle anti-rafale)
  await p.click('#redo-btn');
  { const f = await files(); check('bouton Redo : son de retour seul, pas de son de bouton en plus (' + f + ')', f === 'tap-back'); }

  p.once('dialog', dl => dl.dismiss()); await p.click('#clear-btn');
  check('Clear board refusé : aucun son', (await files()) === '');
  p.once('dialog', dl => dl.accept()); await p.click('#clear-btn');
  check('Clear board accepté : un seul tampon, aucun son de pose', (await files()) === 'stamp');

  await p.keyboard.press('ArrowRight'); await p.keyboard.press('r');
  check('clavier, lettre : son de pose seul (pas de son de palette)', (await files()) === 'card-flip');

  await p.click('#export-open-btn');
  check('Export the .png : son « bouton »', (await files()) === 'tap-menu-button');
  await p.waitForFunction(() => !document.getElementById('export-btn').disabled, null, { timeout: 120000 });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#export-btn')]);
  await dl.path();
  check('export terminé : drapeau d\'arrivée seul', (await files()) === 'finish-flag');

  // Fichier refusé (depuis l'accueil)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snd-')); const bad = path.join(tmp, 'bad.trvtile');
  fs.writeFileSync(bad, 'not a project');
  await p.click('#home-btn'); await take();
  p.once('dialog', dlg => dlg.dismiss());
  await p.setInputFiles('#open-project-input', bad);
  await p.waitForFunction(() => window.__played.length > 0, null, { timeout: 5000 }).catch(() => {});
  check('fichier refusé : son de refus', (await files()) === 'tap-refuse');

  // Haut-parleur
  await p.click('#board-type-continue'); await take();
  await p.click('#sound-btn');
  check('haut-parleur coupé : aucun son, bouton barré', (await files()) === '' && await p.evaluate(() => document.getElementById('sound-btn').getAttribute('aria-pressed') === 'false'));
  await p.click('#tb-road'); const c9 = await center(9); await p.mouse.click(c9.x, c9.y);
  check('son coupé : palette et pose silencieuses', (await files()) === '');
  await p.reload();
  await p.waitForFunction(() => typeof sounds !== 'undefined' && Object.keys(sounds.howls).length === 7);
  await p.click('#board-type-continue');
  check('après rechargement : son toujours coupé', (await files()) === '' && await p.evaluate(() => sounds.muted));
  await p.click('#sound-btn');
  check('haut-parleur rallumé : un son « bouton » aussitôt', (await files()) === 'tap-menu-button' && !(await p.evaluate(() => sounds.muted)));

  check('aucune erreur JavaScript', errs.length === 0);
  await b.close();
  console.log(results.join('\n')); if (errs.length) console.log(errs);
  process.exit(results.some(x => x.startsWith('ÉCHEC')) ? 1 : 0);
})();
