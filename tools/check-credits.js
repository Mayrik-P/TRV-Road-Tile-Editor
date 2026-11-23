// CREDITS CHECK (phase 6 bis) in a real browser (Chromium via Playwright):
// "Credits" button on the home screen, dialog that opens with all the sections, each unfolded
// license shows the real text of its file, closing by Return, Escape and click outside,
// no horizontal scroll on phone. "Single credits list" safeguard: each
// font (fonts/*/OFL.txt) and each library (js/vendor/*.js) of the repo appears in it.
// Usage (repo served over HTTP): node tools/check-credits.js [http://localhost:8765/]
// Exit code 1 on the slightest failure or on any JavaScript error from the page.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const base = process.argv[2] || 'http://localhost:8765/';
const root = path.join(__dirname, '..');
const results = []; const check = (name, ok) => results.push(`${ok ? 'ok' : 'FAIL'} : ${name}`);

(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const [label, opts] of [['desktop', { viewport: { width: 1300, height: 900 } }],
                               ['phone', { viewport: { width: 411, height: 823 }, isMobile: true, hasTouch: true }]]) {
    const p = await b.newPage(opts); p.on('pageerror', e => errs.push(e.message));
    await p.goto(new URL('index.html', base).href);
    const isOpen = () => p.evaluate(() => document.getElementById('credits').open);
    check(`${label}: short notice on the home screen`, (await p.textContent('#home-notice')).includes('Restoration Games'));
    await p.click('#credits-btn');
    check(`${label}: "Credits" opens the dialog`, await isOpen());
    const info = await p.evaluate(() => ({
      sections: [...document.querySelectorAll('#credits section h3')].map(h => h.textContent),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      box: (r => [Math.round(r.left), Math.round(r.right)])(document.getElementById('credits').getBoundingClientRect()),
    }));
    check(`${label}: ${info.sections.length} sections (${info.sections.join(', ')})`,
          info.sections.length === CREDITS_SECTIONS() + 1 && info.sections.at(-1) === 'Licenses');
    check(`${label}: dialog centred on screen (${info.box.join('–')} px), no horizontal scroll`,
          !info.overflow && info.box[0] > 0 && Math.abs(info.box[0] - (opts.viewport.width - info.box[1])) <= 2);
    if (label === 'desktop') {
      // Each unfolded license: the exact text of its file
      const lic = await p.evaluate(() => CREDITS.licenses.map(l => l.file));
      for (let i = 0; i < lic.length; i++) {
        const d = p.locator('#credits details').nth(i);
        await d.locator('summary').click();
        await p.waitForFunction(i => { const t = document.querySelectorAll('#credits details pre')[i].textContent; return t !== 'Loading…'; }, i, { timeout: 10000 });
        const shown = await d.locator('pre').textContent();
        const want = fs.readFileSync(path.join(root, lic[i]), 'utf8').trim();
        check(`licence ${lic[i]}: exact text of the file (${want.length} characters)`, shown === want);
      }
      await p.keyboard.press('Escape');
      check('Escape closes the dialog', !(await isOpen()));
      await p.click('#credits-btn'); await p.mouse.click(5, 5);
      check('click outside closes the dialog', !(await isOpen()));
      await p.click('#credits-btn'); await p.screenshot({ path: path.join(require('os').tmpdir(), 'credits-desktop.png') });
    } else {
      await p.screenshot({ path: path.join(require('os').tmpdir(), 'credits-phone.png') });
    }
    await p.click('#credits-close');
    check(`${label}: "Return" closes the dialog`, !(await isOpen()));
    await p.close();
  }
  // Safeguard: each font and each library of the repo is cited with its license
  const credits = fs.readFileSync(path.join(root, 'js/credits.js'), 'utf8');
  const fonts = fs.readdirSync(path.join(root, 'fonts')).filter(d => fs.existsSync(path.join(root, 'fonts', d, 'OFL.txt')));
  const missingFonts = fonts.filter(d => !credits.includes(`fonts/${d}/OFL.txt`));
  check(`the ${fonts.length} fonts of the repository have their licence in the credits${missingFonts.length ? ' (missing: ' + missingFonts.join(', ') + ')' : ''}`, !missingFonts.length);
  const libs = fs.readdirSync(path.join(root, 'js/vendor')).filter(f => f.endsWith('.js')).map(f => f.replace(/-\d.*$/, ''));
  const missingLibs = libs.filter(n => !credits.includes(`js/vendor/${n}-`));
  check(`the ${libs.length} libraries of js/vendor have their licence in the credits${missingLibs.length ? ' (missing: ' + missingLibs.join(', ') + ')' : ''}`, !missingLibs.length);
  check('no JavaScript error', errs.length === 0);
  await b.close();
  console.log(results.join('\n')); if (errs.length) console.log(errs);
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { // test interrupted: we still show what was verified
  console.log(results.join('\n')); console.log('FAIL : test interrupted: ' + e.message.split('\n')[0]); process.exit(1);
});

// Number of sections declared in js/credits.js (read under Node, without running the page)
function CREDITS_SECTIONS() {
  const src = fs.readFileSync(path.join(root, 'js/credits.js'), 'utf8');
  return new Function(src + '; return CREDITS;')().sections.length;
}
