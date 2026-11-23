// ===== js/brush.js — Brush (tranche 2b): press then drag to paint several
// cells, with a mouse, stylus or finger.
//
// Classic script (not a module): all js/ files share the same global scope and are loaded
// in the fixed order of the <script> tags in index.html (the only reference). Code run
// when a file loads can only use what is declared in that file or the previous ones;
// functions, called later, see everything.
//
// Method recommended by MDN / W3C for drawing tools: Pointer Events (a single
// code path for mouse, stylus and finger), pointer capture on the board
// (setPointerCapture) on press, then on every move the cell under the pointer
// (elementFromPoint: exact shape of the chevron cells), painting only when it
// changes. The intermediate points of a fast gesture are picked up ("coalesced"
// events + interpolated points) so that no cell is skipped.
//
// Rules:
//   - one brush stroke = a single undo step (beginAction / endAction);
//   - the first cell behaves like a click: clicking an Impassable / Fire / Oil cell
//     again cycles its visual; while dragging, a cell that already has the right type is
//     not touched (no unwanted cycling of visuals);
//   - mouse: primary button only;
//   - finger (Mayrik's decision of 19/11): one finger paints; the two-finger pinch
//     remains possible (CSS touch-action: pinch-zoom on #bsvg) — if a 2nd finger lands
//     during a brush stroke, the stroke is cancelled (cancelAction) so as not to leave a
//     painted cell at the start of a zoom. Principle documented by Google for Android
//     ("Stylus palm rejection": an unwanted touch receives a cancel, the drawing app
//     undoes the last stroke thanks to its history).
// Sources: MDN Pointer events and getCoalescedEvents; W3C drawing demo (TPAC 2023);
// drawing between two successive positions = method of pixel editors (Bresenham).

const brush = { active: false, pointerId: null, pointerType: null, lastIdx: -1, lastX: 0, lastY: 0, hovered: null };
const BRUSH_STEP_PX = 6; // maximum gap between two points tested during a fast gesture

function hitAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return (el && el.dataset && el.dataset.idx !== undefined && el.parentNode && el.parentNode.id === 'layer-hits') ? el : null;
}

// Highlight of the hovered cell during a gesture (pointer capture prevents
// the cells from receiving their own mouseenter / mouseleave events).
function setBrushHover(el) {
  if (brush.hovered === el) return;
  if (brush.hovered) brush.hovered.setAttribute('fill', 'transparent');
  brush.hovered = el;
  if (el) el.setAttribute('fill', 'rgba(255,255,255,0.22)');
}

function paintAt(x, y) {
  const hit = hitAt(x, y);
  if (brush.pointerType === 'mouse') setBrushHover(hit);
  if (!hit) return;
  const idx = parseInt(hit.dataset.idx);
  if (idx === brush.lastIdx) return;
  brush.lastIdx = idx;
  if (board[idx] !== sel) updateCell(idx, sel);
}

function endStroke(cancel) {
  if (!brush.active) return;
  const svg = document.getElementById('bsvg');
  try { if (svg.hasPointerCapture(brush.pointerId)) svg.releasePointerCapture(brush.pointerId); } catch (e) {}
  brush.active = false;
  if (brush.pointerType === 'mouse') setBrushHover(hitAt(brush.lastX, brush.lastY));
  else setBrushHover(null);
  if (cancel) cancelAction(); else endAction();
}

(function installBrush() {
  const svg = document.getElementById('bsvg');

  svg.addEventListener('pointerdown', e => {
    // 2nd finger during a brush stroke: it is a pinch, so the gesture is cancelled.
    if (brush.active) {
      if (e.pointerType === 'touch' && e.pointerId !== brush.pointerId) endStroke(true);
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const hit = hitAt(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault(); // no text selection or image dragging
    // preventDefault also stops the board from taking focus: so we leave a text field
    // being typed in ourselves (so that Ctrl+Z targets the board).
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    Object.assign(brush, { active: true, pointerId: e.pointerId, pointerType: e.pointerType,
                           lastX: e.clientX, lastY: e.clientY });
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
    beginAction('brush');
    const idx = parseInt(hit.dataset.idx);
    brush.lastIdx = idx;
    if (brush.pointerType === 'mouse') setBrushHover(hit);
    updateCell(idx, sel); // 1st cell = a click (cycles the visual of a cell with variants)
  });

  svg.addEventListener('pointermove', e => {
    if (!brush.active || e.pointerId !== brush.pointerId) return;
    const points = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const pt of (points.length ? points : [e])) {
      const dx = pt.clientX - brush.lastX, dy = pt.clientY - brush.lastY;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / BRUSH_STEP_PX));
      for (let i = 1; i <= steps; i++) paintAt(brush.lastX + dx * i / steps, brush.lastY + dy * i / steps);
      brush.lastX = pt.clientX; brush.lastY = pt.clientY;
    }
  });

  const finish = e => { if (brush.active && e.pointerId === brush.pointerId) endStroke(e.type === 'pointercancel'); };
  svg.addEventListener('pointerup', finish);
  svg.addEventListener('pointercancel', finish);
  svg.addEventListener('lostpointercapture', finish);
})();
