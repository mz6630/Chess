// A flat board for the Play page, drawn with the set's own silhouettes (js/flat.js).
// Click a piece then a square, or drag it. The controller decides what is legal; this only draws.
// Shared interface with the 3D board: set(pos), move(m), orient(c), marks({...}), arrows(list),
// hidePieces(bool), onSquare(sq), onDrop(from, to), canDrag(sq), resize(), destroy().
window.FG_BOARD2D = function (host) {
  const NS = 'http://www.w3.org/2000/svg', FLAT = window.FG_FLAT, FILES = 'abcdefgh';
  const TYPE = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };
  const SIZE = { king: .9, queen: .87, bishop: .8, knight: .76, rook: .7, pawn: .62 };
  const el = (tag, a = {}, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  if (!document.getElementById('fp-king')) {
    const hidden = el('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' }); document.body.prepend(hidden);
    const defs = el('defs', {}, hidden);
    for (const t in FLAT) { const s = el('symbol', { id: 'fp-' + t, viewBox: `0 0 ${FLAT[t].w} ${FLAT[t].h}`, overflow: 'visible' }, defs); el('path', { d: FLAT[t].d, 'vector-effect': 'non-scaling-stroke' }, s); }
  }
  const svg = el('svg', { class: 'b2', viewBox: '-0.5 -0.1 8.6 8.6', role: 'application', tabindex: 0, 'aria-label': 'Chessboard' }, host);
  const defs = el('defs', {}, svg);
  const mkr = el('marker', { id: 'b2ah', viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 3, markerHeight: 3, orient: 'auto' }, defs);
  el('path', { d: 'M0 0L10 5L0 10Z', fill: '#0B0B0B' }, mkr);
  const labG = el('g', { class: 'b2-lab' }, svg), sqG = el('g', {}, svg);
  el('rect', { class: 'b2-frame', x: 0, y: 0, width: 8, height: 8 }, svg);
  const mkG = el('g', {}, svg), pcG = el('g', { class: 'b2-pcs' }, svg), arG = el('g', {}, svg);
  const cur = el('rect', { class: 'b2-cur', width: .9, height: .9 }, svg);
  let flip = false, pieces = new Map(), drag = null, kf = 4, kr = 1;
  const api = { onSquare: null, onDrop: null, canDrag: null };
  const xy = n => { const f = FILES.indexOf(n[0]), r = +n[1] - 1; return flip ? [7 - f, r] : [f, 7 - r]; };
  const nameAt = (x, y) => { const f = flip ? 7 - x : x, r = flip ? y : 7 - y; return f >= 0 && f < 8 && r >= 0 && r < 8 ? FILES[f] + (r + 1) : null; };

  function drawSquares() {
    sqG.textContent = ''; labG.textContent = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const n = nameAt(x, y), light = (FILES.indexOf(n[0]) + +n[1] - 1) % 2 === 1;
      el('rect', { class: 'b2-sq ' + (light ? 'l' : 'd'), x, y, width: 1, height: 1, 'data-sq': n }, sqG);
    }
    for (let i = 0; i < 8; i++) {
      const f = el('text', { x: i + .5, y: 8.32 }, labG); f.textContent = flip ? FILES[7 - i] : FILES[i];
      const r = el('text', { x: -.28, y: i + .5 }, labG); r.textContent = flip ? i + 1 : 8 - i;
    }
  }
  function pieceEl(code) {
    const t = TYPE[code[1]], H = SIZE[t], W = H * FLAT[t].w / FLAT[t].h;
    const g = el('g', { class: 'b2-pc' });
    el('use', { href: '#fp-' + t, x: (1 - W) / 2, y: .93 - H, width: W, height: H, class: code[0] === 'w' ? 'pw' : 'pb' }, g);
    return g;
  }
  const at = (g, n) => { const [x, y] = xy(n); g.style.transform = `translate(${x}px,${y}px)`; };

  api.set = pos => {
    pcG.textContent = ''; pieces = new Map();
    for (const n in pos) { const g = pieceEl(pos[n]); pcG.appendChild(g); g.style.transition = 'none'; at(g, n); pieces.set(n, { g, code: pos[n] }); }
    pcG.getBoundingClientRect();
    pieces.forEach(p => { p.g.style.transition = ''; });
  };
  // m: { from, to, piece, ep, rook:[a,b], promo, promoTo }
  api.move = m => new Promise(res => {
    const p = pieces.get(m.from); if (!p) return res();
    const cap = pieces.get(m.ep || m.to);
    if (cap && cap !== p) { cap.g.classList.add('gone'); setTimeout(() => cap.g.remove(), 260); pieces.delete(m.ep || m.to); }
    pieces.delete(m.from); pieces.set(m.to, p); at(p.g, m.to);
    if (m.rook) { const r = pieces.get(m.rook[0]); if (r) { pieces.delete(m.rook[0]); pieces.set(m.rook[1], r); at(r.g, m.rook[1]); } }
    setTimeout(() => {
      if (m.promo) { p.g.remove(); const g = pieceEl(m.piece[0] + (m.promoTo || 'Q')); pcG.appendChild(g); g.style.transition = 'none'; at(g, m.to); pieces.set(m.to, { g, code: m.piece[0] + (m.promoTo || 'Q') }); }
      res();
    }, 340);
  });
  api.orient = c => { flip = c === 'b'; drawSquares(); pieces.forEach((p, n) => { p.g.style.transition = 'none'; at(p.g, n); }); pcG.getBoundingClientRect(); pieces.forEach(p => { p.g.style.transition = ''; }); api.marks(last); api.arrows(lastArrows); };

  // marks: { last:[a,b], check:sq, sel:sq, moves:[{to, capture}], hint:sq, ok:[sq], bad:[sq] }
  let last = {}, lastArrows = [];
  api.marks = (o = {}) => {
    last = o; mkG.textContent = '';
    const r = (n, cls, inset = 0) => { const [x, y] = xy(n); return el('rect', { class: cls, x: x + inset, y: y + inset, width: 1 - 2 * inset, height: 1 - 2 * inset }, mkG); };
    (o.last || []).forEach(n => r(n, 'b2-last'));
    if (o.hint) r(o.hint, 'b2-hint', .05);
    if (o.check) { const [x, y] = xy(o.check); el('circle', { class: 'b2-check', cx: x + .5, cy: y + .5, r: .47 }, mkG); }
    if (o.sel) r(o.sel, 'b2-sel', .04);
    (o.moves || []).forEach(m => { const [x, y] = xy(m.to); if (m.capture) el('path', { class: 'b2-cap', d: 'M0 0h.3L0 .3ZM1 0v.3L.7 0ZM0 1v-.3L.3 1ZM1 1h-.3L1 .7Z', transform: `translate(${x} ${y})` }, mkG); else el('circle', { class: 'b2-mv', cx: x + .5, cy: y + .5, r: .14 }, mkG); });
  };
  api.arrows = (list = []) => {
    lastArrows = list; arG.textContent = '';
    for (const a of list) {
      const [x1, y1] = xy(a.from), [x2, y2] = xy(a.to), d = Math.hypot(x2 - x1, y2 - y1);
      el('line', { class: 'b2-arrow' + (a.kind ? ' ' + a.kind : ''), x1: x1 + .5, y1: y1 + .5, x2: x2 + .5 - (x2 - x1) / d * .3, y2: y2 + .5 - (y2 - y1) / d * .3, 'marker-end': 'url(#b2ah)' }, arG);
    }
  };
  api.hidePieces = on => svg.classList.toggle('ceiling', !!on);
  api.resize = () => {};
  api.destroy = () => svg.remove();

  // ---------- pointer: click or drag ----------
  const sqAt = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return nameAt(Math.floor(p.x), Math.floor(p.y)); };
  const svgPt = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  svg.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    svg.classList.remove('kbd');
    const n = sqAt(e); if (!n) return;
    const p = pieces.get(n);
    if (p && api.canDrag && api.canDrag(n)) {
      e.preventDefault(); svg.setPointerCapture(e.pointerId);
      drag = { n, p, x0: e.clientX, y0: e.clientY, moved: false };
    } else if (api.onSquare) api.onSquare(n);
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
    if (!drag.moved) { drag.moved = true; drag.p.g.classList.add('lifted'); if (api.onSquare) api.onSquare(drag.n, true); }
    const q = svgPt(e); drag.p.g.style.transition = 'none'; drag.p.g.style.transform = `translate(${q.x - .5}px,${q.y - .7}px)`;
  });
  const end = e => {
    if (!drag) return;
    const d = drag; drag = null; d.p.g.classList.remove('lifted');
    if (!d.moved) { if (api.onSquare) api.onSquare(d.n); return; }
    const to = sqAt(e);
    d.p.g.style.transition = '';
    at(d.p.g, d.n);
    if (to && to !== d.n && api.onDrop) api.onDrop(d.n, to);
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.addEventListener('keydown', e => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (dir) { e.preventDefault(); svg.classList.add('kbd'); kf = Math.max(0, Math.min(7, kf + dir[0])); kr = Math.max(0, Math.min(7, kr + dir[1])); cur.setAttribute('x', kf + .05); cur.setAttribute('y', kr + .05); svg.setAttribute('aria-label', 'Chessboard, ' + nameAt(kf, kr)); }
    else if ((e.key === 'Enter' || e.key === ' ') && svg.classList.contains('kbd')) { e.preventDefault(); e.stopPropagation(); if (api.onSquare) api.onSquare(nameAt(kf, kr)); }
  });
  cur.setAttribute('x', kf + .05); cur.setAttribute('y', kr + .05);
  drawSquares();
  return api;
};
