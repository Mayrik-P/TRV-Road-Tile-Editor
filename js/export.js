// ===== js/export.js — 300 dpi PNG export, custom title image, name / number fields.
//
// Classic script (not a module): all js/ files share the same global scope and are loaded
// in the fixed order of the <script> tags in index.html (the only reference).
// Code run when a file loads can only use what is declared in that file or the previous
// ones; functions, called later, see everything.

// ---- Print resolution written into the PNG (slice 5a) ----
// A PNG produced by canvas.toBlob does not say at what density to print it: with "Actual
// size / 100%", a program may assume 72 or 96 dpi and print at the wrong size.
// Standard fix, described by the W3C PNG specification (§ 11.3.5.3, pHYs chunk) and used by
// libraries such as changeDPI: insert a pHYs chunk right after the IHDR header, without
// re-encoding the image (pixels strictly identical). Unit: pixels per metre
// (300 dpi = 11 811 px/m).
const PNG_CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function pngCrc(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = PNG_CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function withPngDpi(blob, dpi) {
  return blob.arrayBuffer().then(buf => {
    const src = new Uint8Array(buf);
    // PNG signature (8 bytes) then IHDR: 4 (length) + 4 (type) + 13 (data) + 4 (CRC).
    const afterIhdr = 8 + 4 + 4 + 13 + 4;
    // Remove any pHYs chunk already present, then insert ours after IHDR.
    const parts = [src.subarray(0, afterIhdr)];
    let pos = afterIhdr;
    while (pos < src.length) {
      const len = new DataView(buf, pos, 4).getUint32(0);
      const type = String.fromCharCode(...src.subarray(pos + 4, pos + 8));
      if (type !== 'pHYs') parts.push(src.subarray(pos, pos + 12 + len));
      pos += 12 + len;
    }
    const ppm = Math.round(dpi / 0.0254);
    const chunk = new Uint8Array(4 + 4 + 9 + 4);
    const dv = new DataView(chunk.buffer);
    dv.setUint32(0, 9);
    chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
    dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1; // unit: metre
    dv.setUint32(17, pngCrc(chunk.subarray(4, 17)));
    parts.splice(1, 0, chunk);
    return new Blob(parts, { type: 'image/png' });
  }).catch(() => blob); // if anything unexpected happens, export the PNG as is rather than nothing
}

// ---- Print paper: International / US (slice 5b, chosen in the export dialog) ----
// Same board rendering, placed at the centre of a page of the paper size, with a WHOLE number
// of pixels as offset (no resizing: actual size kept). Printed area: 268.7 mm high — margins
// of 14 mm on A3 / A4, 5.3 mm on Tabloid / Letter (calculation from the plan,
// docs/roadmap.md § Phase 5). In International, the page is the board itself (export unchanged).
const PAPERS = {
  vendetta: { intl: { name: 'A3', w: 4961, h: 3508, desc: 'A3, landscape' },
              us:   { name: 'Tabloid', w: 5100, h: 3300, desc: 'Tabloid (11×17″), landscape' } },
  ignition: { intl: { name: 'A4', w: 2481, h: 3508, desc: 'A4, portrait' },
              us:   { name: 'Letter', w: 2550, h: 3300, desc: 'Letter (8.5×11″), portrait' } },
};
const PAPER_REGION_KEY = 'trv_road_tile_paper_region_v1';
// Countries using Letter (and Tabloid) paper: default to US, based on the browser region.
const LETTER_REGIONS = ['US', 'CA', 'MX', 'PH'];
function defaultPaperRegion() {
  try { const r = localStorage.getItem(PAPER_REGION_KEY); if (r === 'intl' || r === 'us') return r; } catch (e) {}
  const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
  const region = (langs[0] || '').split('-')[1];
  return region && LETTER_REGIONS.includes(region.toUpperCase()) ? 'us' : 'intl';
}
let paperRegion = defaultPaperRegion();
function currentPaper() { return PAPERS[BOARD_TYPE][paperRegion]; }
function setPaperRegion(r) {
  paperRegion = r;
  try { localStorage.setItem(PAPER_REGION_KEY, r); } catch (e) {}
  refreshExportDialog();
}
// Area actually occupied by the board (title + 6 rows), in pixels at 300 dpi.
function boardContentBox() {
  const lefts = BANDS.slice(1).map(b => b.left);
  return { left: Math.min(...lefts), right: Math.max(...lefts) + COLS * CELL_SLOT + NOTCH,
           top: BANDS[0].top, bottom: BANDS[ROWS].bot };
}
// Whole-number offset that centres the board on the chosen paper page (0, 0 in International).
function pageOffset(paper) {
  if (paper.w === VW && paper.h === VH) return { x: 0, y: 0 };
  const c = boardContentBox();
  return { x: Math.round((paper.w - (c.right - c.left)) / 2 - c.left),
           y: Math.round((paper.h - (c.bottom - c.top)) / 2 - c.top) };
}
function refreshExportDialog() {
  document.getElementById('export-paper').textContent = currentPaper().desc;
  // Margins: 14 mm on A3 / A4, only 5.3 mm top and bottom on Tabloid / Letter (most printers
  // print from 3 to 5 mm from the edge; some cut more).
  document.getElementById('export-note').textContent = paperRegion === 'us'
    ? 'US paper leaves narrow margins (5 mm top and bottom): most printers print everything; a few may trim a thin edge.'
    : 'The board keeps white margins, so nothing gets cut at 100%.';
  document.querySelectorAll('#paper-region button').forEach(b => b.setAttribute('aria-pressed', b.dataset.region === paperRegion));
  const names = PAPERS[BOARD_TYPE];
  document.getElementById('paper-intl-name').textContent = names.intl.name;
  document.getElementById('paper-us-name').textContent = names.us.name;
}

// ---- Export dialog (printing instruction, Mayrik's request of 19/11) ----
// Printing programs never offer 100% by themselves (Preview: "Print entire image" ≈ 97-98%;
// Acrobat Reader: "Fit"); print & play practice is an instruction "100% / Actual size". It is
// shown on clicking "Export image", and the dialog fills the time needed to download the
// originals: its "Download PNG" button (#export-btn, export logic unchanged) is unlocked
// when everything is ready.
function openExportDialog() {
  refreshExportDialog();
  document.getElementById('export-dialog').hidden = false;
  const dl = document.getElementById('export-btn');
  (dl.disabled ? document.getElementById('export-cancel-btn') : dl).focus();
}
function closeExportDialog() { document.getElementById('export-dialog').hidden = true; }
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !document.getElementById('export-dialog').hidden) { e.preventDefault(); closeExportDialog(); }
});

// Loading of jsPDF (js/vendor/jspdf-4.2.1.umd.min.js, MIT licence) on first request.
let jsPdfLoading = null;
function loadJsPdf() {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve();
  if (!jsPdfLoading) jsPdfLoading = new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/jspdf-4.2.1.umd.min.js';
    s.onload = ok; s.onerror = () => { jsPdfLoading = null; ko(); };
    document.head.appendChild(s);
  });
  return jsPdfLoading;
}

// ---- Export PNG ----
// On screen, the board shows previews (displayHref, slice 1c); in the exported copy, each
// image is replaced by its full-resolution original, already converted to base64
// (IMAGES_B64): same position, same size, export unchanged.
// The export button is locked during export to prevent double-clicks.
// format: 'png' ("Download PNG" button) or 'pdf' ("Download PDF", slice 5c). Same rendering;
// for PDF, the same (lossless) image is placed on a page of the exact paper size.
function exportPNG(format = 'png') {
  const btn = document.getElementById('export-btn');
  const label = document.getElementById('export-label');
  const pdfBtn = document.getElementById('export-pdf-btn');

  // Check all images are truly ready before exporting
  if (!allImagesReady()) {
    warnUser('⚠ Some images are not fully loaded yet.\nPlease reload the page and try again.');
    return;
  }

  // Lock buttons during export
  btn.disabled = true; pdfBtn.disabled = true;
  const unlock = () => { btn.disabled = false; pdfBtn.disabled = false; label.textContent = 'Download PNG'; pdfBtn.textContent = 'Download PDF'; };
  if (format === 'pdf') pdfBtn.textContent = 'Preparing…'; else label.textContent = 'Preparing…';

  const svg = document.getElementById('bsvg');
  const clone = svg.cloneNode(true);
  clone.querySelectorAll('[data-idx]').forEach(e => e.remove());
  clone.querySelector('#layer-cursor')?.remove(); // keyboard cursor: never exported
  clone.querySelector('#layer-decor-ui')?.remove(); // selection of a decoration: never exported
  clone.querySelector('#layer-barricade-ui')?.remove(); // highlighted segment of the barricade tool: never exported
  clone.setAttribute('width', String(VW));
  clone.setAttribute('height', String(VH));

  // Previews -> originals (base64). A missing original stops the export rather than
  // producing an incomplete or low-resolution board.
  const missing = [];
  clone.querySelectorAll('image').forEach(im => {
    const href = im.getAttribute('href');
    if (!href || href.startsWith('data:')) return;
    const full = FULL_OF_DISPLAY[href] || href;
    if (IMAGES_B64[full]) im.setAttribute('href', IMAGES_B64[full]);
    else missing.push(full);
  });
  if (missing.length) {
    console.warn('Export: originals missing', missing);
    unlock();
    warnUser('⚠ Some high-resolution images are missing.\nPlease reload the page and try again.');
    return;
  }

  // SVG already contains base64 hrefs (set during buildBoard) — no replacement needed.
  // Render SVG to canvas and download as PNG
  const svgStr = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgStr], {type: 'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  // Page of the chosen paper (International: the board itself; US: Tabloid / Letter page).
  const paper = currentPaper(), off = pageOffset(paper);
  const canvas = document.createElement('canvas');
  canvas.width = paper.w;
  canvas.height = paper.h;
  const img = new Image();

  function paintAndDownload() {
    if (format === 'pdf') pdfBtn.textContent = 'Exporting PDF…'; else label.textContent = 'Exporting…';
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, paper.w, paper.h);
    ctx.drawImage(img, off.x, off.y, VW, VH); // whole-number offset, same size: no resizing
    URL.revokeObjectURL(url);
    const download = (b, ext) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = boardFileBaseName() + '-' + paper.name + ext; // rule shared with the project file (js/project.js)
      a.click();
      closeExportDialog(); // download started: the instruction has been read
      playSound('export');
      unlock();
    };
    if (format === 'pdf') {
      // jsPDF is loaded only now (420 KB, not needed when the page opens). Lossless image
      // (PNG inside the PDF, same pixels as the PNG export), page at the exact paper size.
      loadJsPdf().then(() => setTimeout(() => {
        try {
          const wmm = paper.w / 300 * 25.4, hmm = paper.h / 300 * 25.4;
          const doc = new window.jspdf.jsPDF({ unit: 'mm', format: [wmm, hmm], orientation: wmm > hmm ? 'landscape' : 'portrait' });
          doc.setProperties({ title: boardFileBaseName(), creator: 'TRV Road Tile Editor' });
          doc.addImage(canvas, 'PNG', 0, 0, wmm, hmm, undefined, 'FAST');
          download(doc.output('blob'), '.pdf');
        } catch (e) { console.warn('PDF export failed', e); unlock(); warnUser('⚠ The PDF export failed. Please try again.'); }
      }, 30)).catch(() => { unlock(); warnUser('⚠ The PDF export could not start. Please reload the page and try again.'); });
      return;
    }
    canvas.toBlob(raw => withPngDpi(raw, 300).then(b => download(b, '.png')), 'image/png');
  }

  img.onload = () => {
    // img.onload alone isn't a strong enough guarantee on Safari: for an SVG
    // containing embedded base64 images, WebKit can fire onload before those
    // inner images are fully decoded, producing an export with blank/missing
    // textures on the very first attempt (works afterwards once the browser's
    // image cache already holds fully-decoded copies of those same data URIs).
    // img.decode() explicitly waits for full decode before we paint to canvas.
    //
    // The board title (FAN-MADE CHAPTER / THE / road name) uses the Alfa Slab One / Oswald
    // fonts embedded as base64 in the SVG's <style> — the same kind of problem applies to
    // the TEXT: decoding the image does not guarantee that Safari has finished applying that
    // custom font to the glyphs before rasterizing, hence a title sometimes missing on the
    // very first export after opening. We also explicitly wait for document.fonts.ready
    // before painting.
    //
    // Reinforced margin (setTimeout + 3 rAF instead of 2): since the title shading also
    // repeats the black outline on every stacked copy (40+20+20 elements with fill AND
    // stroke, instead of the text alone), the first rendering of these custom fonts is
    // much heavier to compute for Safari — the previous delay (2 rAF) was no longer always
    // enough in real use (feedback from Mayrik). Cannot be verified directly in this test
    // environment (no real Safari/WebKit available here): to be reconfirmed in real use.
    const decodeStep = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    decodeStep
      .then(() => document.fonts.ready)
      .catch(() => {})
      .then(() => new Promise(resolve => setTimeout(resolve, 150)))
      .then(() => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(paintAndDownload))));
  };
  img.onerror = () => {
    unlock();
    warnUser('Export failed — please try again.');
  };
  img.src = url;
}

// "Image too small" warning (19/11): real resolution of the image once placed in its frame
// (titleImageBox, js/render-layers.js). It fills the whole frame (preserveAspectRatio
// "slice"): the tightest side sets the enlargement. Threshold 225 dpi = 75% of the
// recommended size (printers aim for 300 dpi, 150 dpi is a floor that is often visible).
// Recomputed on every format change (applyBoardType): the frame does not have the same width.
const TITLE_IMAGE_MIN_DPI = 225;
function titleImageDpi(img) {
  const box = titleImageBox();
  return 300 / Math.max(box.w / img.width, box.h / img.height);
}
function refreshTitleImageWarning() {
  const warn = document.getElementById('title-img-warn');
  const custom = TITLE_IMAGE && TITLE_IMAGE !== DEFAULT_TITLE_IMAGE;
  const dpi = custom ? titleImageDpi(TITLE_IMAGE) : 300;
  warn.textContent = `⚠ Image too small (about ${Math.round(dpi)} dpi when printed) — may appear blurry`;
  warn.style.display = dpi < TITLE_IMAGE_MIN_DPI ? 'inline' : 'none';
}

// Adopts an already decoded title image (as a data: URL, the only form usable in the
// exported SVG): after a file choice (loadTitleImage) or a restore (autosave.js).
// Idea taken from ChessMess's PR #1.
function applyTitleImage(img) {
  TITLE_IMAGE = img;
  refreshTitleImageWarning();
  document.getElementById('title-img-label').textContent = '✓ Title image loaded';
  document.getElementById('title-img-btn').style.color = '#4CAF50';
  buildBoard();
  notifyBoardChange('title-image');
}

function loadTitleImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () { applyTitleImage(img); };
    img.onerror = function () {
      document.getElementById('title-img-label').textContent = '✗ Load failed';
      document.getElementById('title-img-btn').style.color = '#E8231A';
      playSound('refuse');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  input.value = '';
}

// Clears the title image loaded by the user and goes back to the one preloaded by default
// at opening (DEFAULT_TITLE_IMAGE, kept separately precisely to allow this return). If the
// default loading is not finished yet (or failed), simply falls back to the plain brown
// background — same behaviour as if no image had ever been loaded.
function resetTitleImage() {
  TITLE_IMAGE = DEFAULT_TITLE_IMAGE;
  document.getElementById('title-img-warn').style.display = 'none';
  document.getElementById('title-img-label').textContent = 'Load title image';
  document.getElementById('title-img-btn').style.color = '';
  buildBoard();
  notifyBoardChange('title-image');
}

// Character counter for the road name (also called by setBoardState).
function refreshTitleCounter() {
  const l = document.getElementById('title-input').value.length;
  const cc = document.getElementById('cc');
  cc.textContent = l + '/20';
  cc.style.color = l > 17 ? '#E8A84C' : '#777';
}

document.getElementById('title-input').addEventListener('input', function () {
  refreshTitleCounter();
  const newText = this.value.toUpperCase() || 'NAME OF YOUR ROAD';
  const td = document.getElementById('title-display');
  if (td) td.textContent = newText;
  const tsg = document.getElementById('title-shadow-group');
  if (tsg) tsg.querySelectorAll('text').forEach(t => { t.textContent = newText; });
  notifyBoardChange('title');
});

// Board number field (Ignition only): digits only, 3 max.
document.getElementById('board-number-input').addEventListener('input', function () {
  this.value = this.value.replace(/[^0-9]/g, '').slice(0, 3);
  buildBoard();
  notifyBoardChange('number');
});

