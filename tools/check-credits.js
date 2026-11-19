// VÉRIFICATION DES CRÉDITS (phase 6 bis) dans un vrai navigateur (Chromium via Playwright) :
// bouton « Credits » de l'accueil, fenêtre qui s'ouvre avec toutes les sections, chaque licence
// dépliée affiche le vrai texte de son fichier, fermeture par Return, Échap et clic à côté,
// pas de défilement horizontal sur téléphone. Garde-fou « seule liste des crédits » : chaque
// police (fonts/*/OFL.txt) et chaque bibliothèque (js/vendor/*.js) du dépôt y figure.
// Usage (dépôt servi en HTTP) : node tools/check-credits.js [http://localhost:8765/]
// Code de sortie 1 au moindre échec ou à la moindre erreur JavaScript de la page.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const base = process.argv[2] || 'http://localhost:8765/';
const root = path.join(__dirname, '..');
const results = []; const check = (name, ok) => results.push(`${ok ? 'ok' : 'ÉCHEC'} : ${name}`);

(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const [label, opts] of [['ordinateur', { viewport: { width: 1300, height: 900 } }],
                               ['téléphone', { viewport: { width: 411, height: 823 }, isMobile: true, hasTouch: true }]]) {
    const p = await b.newPage(opts); p.on('pageerror', e => errs.push(e.message));
    await p.goto(new URL('index.html', base).href);
    const isOpen = () => p.evaluate(() => document.getElementById('credits').open);
    check(`${label} : mention courte de l'accueil`, (await p.textContent('#home-notice')).includes('Restoration Games'));
    await p.click('#credits-btn');
    check(`${label} : « Credits » ouvre la fenêtre`, await isOpen());
    const info = await p.evaluate(() => ({
      sections: [...document.querySelectorAll('#credits section h3')].map(h => h.textContent),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      box: (r => [Math.round(r.left), Math.round(r.right)])(document.getElementById('credits').getBoundingClientRect()),
    }));
    check(`${label} : ${info.sections.length} sections (${info.sections.join(', ')})`,
          info.sections.length === CREDITS_SECTIONS() + 1 && info.sections.at(-1) === 'Licenses');
    check(`${label} : fenêtre centrée dans l'écran (${info.box.join('–')} px), pas de défilement horizontal`,
          !info.overflow && info.box[0] > 0 && Math.abs(info.box[0] - (opts.viewport.width - info.box[1])) <= 2);
    if (label === 'ordinateur') {
      // Chaque licence dépliée : le texte exact de son fichier
      const lic = await p.evaluate(() => CREDITS.licenses.map(l => l.file));
      for (let i = 0; i < lic.length; i++) {
        const d = p.locator('#credits details').nth(i);
        await d.locator('summary').click();
        await p.waitForFunction(i => { const t = document.querySelectorAll('#credits details pre')[i].textContent; return t !== 'Loading…'; }, i, { timeout: 10000 });
        const shown = await d.locator('pre').textContent();
        const want = fs.readFileSync(path.join(root, lic[i]), 'utf8').trim();
        check(`licence ${lic[i]} : texte exact du fichier (${want.length} caractères)`, shown === want);
      }
      await p.keyboard.press('Escape');
      check('Échap ferme la fenêtre', !(await isOpen()));
      await p.click('#credits-btn'); await p.mouse.click(5, 5);
      check('clic à côté ferme la fenêtre', !(await isOpen()));
      await p.click('#credits-btn'); await p.screenshot({ path: path.join(require('os').tmpdir(), 'credits-desktop.png') });
    } else {
      await p.screenshot({ path: path.join(require('os').tmpdir(), 'credits-phone.png') });
    }
    await p.click('#credits-close');
    check(`${label} : « Return » ferme la fenêtre`, !(await isOpen()));
    await p.close();
  }
  // Garde-fou : chaque police et chaque bibliothèque du dépôt est citée avec sa licence
  const credits = fs.readFileSync(path.join(root, 'js/credits.js'), 'utf8');
  const fonts = fs.readdirSync(path.join(root, 'fonts')).filter(d => fs.existsSync(path.join(root, 'fonts', d, 'OFL.txt')));
  const missingFonts = fonts.filter(d => !credits.includes(`fonts/${d}/OFL.txt`));
  check(`les ${fonts.length} polices du dépôt ont leur licence dans les crédits${missingFonts.length ? ' (manque : ' + missingFonts.join(', ') + ')' : ''}`, !missingFonts.length);
  const libs = fs.readdirSync(path.join(root, 'js/vendor')).filter(f => f.endsWith('.js')).map(f => f.replace(/-\d.*$/, ''));
  const missingLibs = libs.filter(n => !credits.includes(`js/vendor/${n}-`));
  check(`les ${libs.length} bibliothèques de js/vendor ont leur licence dans les crédits${missingLibs.length ? ' (manque : ' + missingLibs.join(', ') + ')' : ''}`, !missingLibs.length);
  check('aucune erreur JavaScript', errs.length === 0);
  await b.close();
  console.log(results.join('\n')); if (errs.length) console.log(errs);
  process.exit(results.some(r => r.startsWith('ÉCHEC')) ? 1 : 0);
})().catch(e => { // test interrompu : on montre quand même ce qui a été vérifié
  console.log(results.join('\n')); console.log('ÉCHEC : test interrompu : ' + e.message.split('\n')[0]); process.exit(1);
});

// Nombre de sections déclarées dans js/credits.js (lu sous Node, sans exécuter la page)
function CREDITS_SECTIONS() {
  const src = fs.readFileSync(path.join(root, 'js/credits.js'), 'utf8');
  return new Function(src + '; return CREDITS;')().sections.length;
}
