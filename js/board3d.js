// The 3D board for the Play page: the same lacquer pieces and marble board as the home page,
// seen from the player's side. Marks (last move, moves, check, arrows) are drawn on a flat SVG layer
// projected onto the board, so they stay crisp. Same interface as js/board2d.js.
window.FG_BOARD3D = function (host) {
  const { V, M, Q, createRenderer } = window.FG;
  const GEO = window.FG_PIECES, FILES = 'abcdefgh';
  const TYPE = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };
  const S = .66, TOP = .32, HALF = 4.45;
  const wrap = document.createElement('div'); wrap.className = 'b3'; host.appendChild(wrap);
  const canvas = document.createElement('canvas'); wrap.appendChild(canvas);
  const NS = 'http://www.w3.org/2000/svg';
  const ov = document.createElementNS(NS, 'svg'); ov.setAttribute('class', 'b3-ov'); wrap.appendChild(ov);
  let R;
  try { R = createRenderer(canvas, GEO, { seg: 40, maxDpr: 1.5, shadowSize: 1024, alpha: true }); } catch (e) { wrap.remove(); return null; }
  if (!R) { wrap.remove(); return null; }
  R.setBoard(HALF, TOP, .045);
  canvas.tabIndex = 0; canvas.setAttribute('role', 'application'); canvas.setAttribute('aria-label', 'Chessboard, 3D');

  const api = { onSquare: null, onDrop: null, canDrag: null };
  const world = n => [FILES.indexOf(n[0]) - 3.5, 3.5 - (+n[1] - 1)];
  const sqOf = (x, z) => { const f = Math.round(x + 3.5), r = Math.round(3.5 - z) + 1; return f >= 0 && f < 8 && r >= 1 && r <= 8 ? FILES[f] + r : null; };
  let side = 'w', pieces = new Map(), anims = [], hidden = false, raf = 0, cam = null, asp = 1, VP = null, W = 1, H = 1;
  let marks = {}, arrows = [], drag = null;

  // ---------- camera: fit the whole board, seen from the player's side ----------
  function camera() {
    const fov = 28 * Math.PI / 180, el = 52 * Math.PI / 180, az = side === 'w' ? 0 : Math.PI;
    const tgt = [0, 0, side === 'w' ? .35 : -.35];
    const pts = [[-HALF, TOP, -HALF], [HALF, TOP, -HALF], [-HALF, TOP, HALF], [HALF, TOP, HALF], [-3.5, 1.9, side === 'w' ? -3.5 : 3.5], [3.5, 1.9, side === 'w' ? -3.5 : 3.5]];
    const dir = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
    let lo = 8, hi = 60;
    for (let i = 0; i < 24; i++) {
      const d = (lo + hi) / 2, c = { eye: V.add(tgt, V.mul(dir, d)), tgt, fov }, vp = R.VP(c, asp);
      const ok = pts.every(p => { const s = proj(vp, p); return s && Math.abs(s[0]) < .94 && Math.abs(s[1]) < .9; });
      if (ok) hi = d; else lo = d;
    }
    return { eye: V.add(tgt, V.mul(dir, hi)), tgt, fov };
  }
  function proj(vp, p) {
    const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12], y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13], w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
    return w > 0 ? [x / w, y / w] : null;
  }
  const px = p => { const s = proj(VP, p); return [(s[0] + 1) / 2 * W, (1 - s[1]) / 2 * H]; };

  // ---------- pieces ----------
  // knights turned three-quarters toward the viewer, so their profile reads from the player's seat
  const face = code => code[1] === 'N' ? Q.axis([0, 1, 0], code[0] === 'w' ? .55 : Math.PI - .55) : Q.I;
  function add(n, code) { const [x, z] = world(n); pieces.set(n, { code, x, z, y: 0, s: 1 }); }
  api.set = pos => { pieces = new Map(); anims = []; for (const n in pos) add(n, pos[n]); draw(); };
  const ease = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  function tween(p, to, dur, hop) {
    const from = { x: p.x, z: p.z }, t0 = performance.now(), dist = Math.hypot(to[0] - from.x, to[1] - from.z);
    return new Promise(res => anims.push({ p, step(now) {
      const u = Math.min(1, (now - t0) / dur), e = ease(u);
      p.x = from.x + (to[0] - from.x) * e; p.z = from.z + (to[1] - from.z) * e; p.y = hop ? Math.sin(u * Math.PI) * Math.min(1.1, .25 + dist * .12) : 0;
      if (u >= 1) { p.y = 0; res(); return false; } return true;
    } }));
  }
  function shrink(p) { const t0 = performance.now(); return new Promise(res => anims.push({ p, step(now) { const u = Math.min(1, (now - t0) / 220); p.s = 1 - u; if (u >= 1) { res(); return false; } return true; } })); }
  api.move = async m => {
    const p = pieces.get(m.from); if (!p) return;
    const capSq = m.ep || m.to, cap = pieces.get(capSq);
    pieces.delete(m.from);
    const jobs = [tween(p, world(m.to), 380, true)];
    if (cap && cap !== p) { pieces.delete(capSq); const ghost = { ...cap }; pieces.set('x' + capSq + Math.random(), ghost); setTimeout(() => shrink(ghost).then(() => { for (const [k, v] of pieces) if (v === ghost) pieces.delete(k); }), 200); }
    pieces.set(m.to, p);
    if (m.rook) { const r = pieces.get(m.rook[0]); if (r) { pieces.delete(m.rook[0]); pieces.set(m.rook[1], r); jobs.push(tween(r, world(m.rook[1]), 380, true)); } }
    loop();
    await Promise.all(jobs);
    if (m.promo) p.code = m.piece[0] + (m.promoTo || 'Q');
    draw();
  };
  api.orient = c => { side = c; cam = null; draw(); };
  api.marks = (o = {}) => { marks = o; drawOverlay(); };
  api.arrows = (list = []) => { arrows = list; drawOverlay(); };
  api.hidePieces = on => { hidden = !!on; draw(); };
  api.resize = () => { cam = null; draw(); };
  api.screenOf = n => { const [x, z] = world(n), p = px([x, TOP, z]), r = canvas.getBoundingClientRect(); return [r.left + p[0], r.top + p[1]]; };
  api.destroy = () => { cancelAnimationFrame(raf); ro.disconnect(); wrap.remove(); const ext = R.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); };

  // ---------- drawing ----------
  const la = -8 * Math.PI / 180, le = 46 * Math.PI / 180;
  const L = [Math.cos(le) * Math.sin(la), Math.sin(le), Math.cos(le) * Math.cos(la)];
  const bg = .93 * (.33 + L[1] * 2.9);
  function draw() {
    const sz = R.size(); asp = sz.asp; W = canvas.clientWidth; H = canvas.clientHeight;
    if (!cam) cam = camera();
    VP = R.VP(cam, asp);
    const list = [], ao = [];
    if (!hidden) for (const p of pieces.values()) {
      if (p.s <= 0) continue;
      const type = TYPE[p.code[1]], sc = S * p.s, pos = [p.x, TOP + p.y, p.z];
      list.push({ type, white: p.code[0] === 'w', m: M.compose(pos, face(p.code), sc) });
      ao.push({ x: p.x, z: p.z, r: GEO[type].r0 * sc, lift: p.y, vis: p.s, spread: S });
    }
    R.render({ t: 0, cam, L, Lc: 2.9, amb: .33, exp: 1.32, shadow: { c: [0, 0, 0], half: 10 }, shadowSoft: 1.6, taps: 6, cheap: true, flat: true,
      clip: false, ground: TOP, groundCol: [bg * .45, bg * .45, bg * .45], reflect: false, board: true, pieces: list, ao });
    drawOverlay();
  }
  function loop() {
    if (raf) return;
    const tick = now => {
      raf = 0;
      anims = anims.filter(a => a.step(now));
      draw();
      if (anims.length || drag) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  // square outline in screen space, a little above the board
  const quad = (n, inset = 0) => { const [x, z] = world(n), h = .5 - inset; return [[x - h, z - h], [x + h, z - h], [x + h, z + h], [x - h, z + h]].map(([a, b]) => px([a, TOP + .002, b])); };
  const poly = (pts, cls) => { const e = document.createElementNS(NS, 'polygon'); e.setAttribute('points', pts.map(p => p.join(',')).join(' ')); e.setAttribute('class', cls); ov.appendChild(e); return e; };
  const ring = (n, r, cls) => { const [x, z] = world(n), pts = []; for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; pts.push(px([x + Math.cos(a) * r, TOP + .002, z + Math.sin(a) * r])); } return poly(pts, cls); };
  function drawOverlay() {
    if (!VP) return;
    ov.setAttribute('viewBox', `0 0 ${W} ${H}`); ov.textContent = '';
    (marks.last || []).forEach(n => poly(quad(n), 'b3-last'));
    if (marks.hint) poly(quad(marks.hint, .05), 'b3-hint');
    if (marks.check) ring(marks.check, .47, 'b3-check');
    if (marks.sel) poly(quad(marks.sel, .04), 'b3-sel');
    (marks.moves || []).forEach(m => m.capture ? poly(quad(m.to, .03), 'b3-cap') : ring(m.to, .14, 'b3-mv'));
    for (const a of arrows) {
      const [x1, z1] = world(a.from), [x2, z2] = world(a.to), d = Math.hypot(x2 - x1, z2 - z1);
      const p1 = px([x1, TOP + .05, z1]), p2 = px([x2 - (x2 - x1) / d * .3, TOP + .05, z2 - (z2 - z1) / d * .3]), ah = px([x2, TOP + .05, z2]);
      const l = document.createElementNS(NS, 'line');
      Object.entries({ x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], class: 'b3-arrow' + (a.kind ? ' ' + a.kind : '') }).forEach(([k, v]) => l.setAttribute(k, v));
      ov.appendChild(l);
      const ang = Math.atan2(ah[1] - p2[1], ah[0] - p2[0]), s = Math.max(8, Math.hypot(ah[0] - p2[0], ah[1] - p2[1]) * 1.1);
      poly([ah, [p2[0] + Math.cos(ang + 1.9) * s * .55, p2[1] + Math.sin(ang + 1.9) * s * .55], [p2[0] + Math.cos(ang - 1.9) * s * .55, p2[1] + Math.sin(ang - 1.9) * s * .55]], 'b3-head' + (a.kind ? ' ' + a.kind : ''));
    }
  }

  // ---------- pointer ----------
  function ray(e) {
    const r = canvas.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 2 - 1, y = 1 - ((e.clientY - r.top) / r.height) * 2;
    const c = cam, f = V.norm(V.sub(c.tgt, c.eye)), rt = V.norm(V.cross(f, [0, 1, 0])), up = V.cross(rt, f), tn = Math.tan(c.fov / 2);
    return { o: c.eye, d: V.norm(V.add(f, V.add(V.mul(rt, x * tn * asp), V.mul(up, y * tn)))) };
  }
  const hit = (e, y = TOP) => { const rr = ray(e), t = (y - rr.o[1]) / rr.d[1]; return t > 0 ? V.add(rr.o, V.mul(rr.d, t)) : null; };
  // a piece is picked by its square, or by its body if the click lands on the piece above another square
  // the square under the pointer on the board, and the piece whose body the pointer touches (it can stand in front)
  const planeSq = e => { const h = hit(e); return h ? sqOf(h[0], h[2]) : null; };
  function pickSq(e) {
    const pl = planeSq(e);
    if (pl && pieces.get(pl)) return pl;
    const body = bodySq(e);
    return body || pl;
  }
  function bodySq(e) {
    const rr = ray(e);
    let best = null, bt = 1e9;
    for (const [n, p] of pieces) {
      if (n.length !== 2) continue;
      const hgt = { king: 1.9, queen: 1.75, bishop: 1.5, knight: 1.35, rook: 1.25, pawn: 1.05 }[TYPE[p.code[1]]];
      for (let k = 0; k <= 6; k++) {
        const pt = [p.x, TOP + hgt * k / 6, p.z], w = V.sub(pt, rr.o), t = V.dot(w, rr.d);
        const d = Math.hypot(...V.sub(w, V.mul(rr.d, t)));
        if (d < .36 && t < bt) { bt = t; best = n; }
      }
    }
    return best;
  }
  canvas.addEventListener('pointerdown', e => {
    if (e.button > 0 || !cam) return;
    const n = pickSq(e); if (!n) return;
    const p = pieces.get(n);
    if (p && api.canDrag && api.canDrag(n) && !hidden) {
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      drag = { n, p, x0: e.clientX, y0: e.clientY, moved: false };
    } else if (api.onSquare) api.onSquare(n, false, planeSq(e));
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) { canvas.style.cursor = cam && pickSq(e) && pieces.get(pickSq(e)) && api.canDrag && api.canDrag(pickSq(e)) ? 'grab' : ''; return; }
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
    if (!drag.moved) { drag.moved = true; canvas.style.cursor = 'grabbing'; if (api.onSquare) api.onSquare(drag.n, true); }
    const h = hit(e, TOP + .5); if (h) { drag.p.x = h[0]; drag.p.z = h[2]; drag.p.y = .5; }
    loop();
  });
  const end = e => {
    if (!drag) return;
    const d = drag; drag = null; canvas.style.cursor = '';
    if (!d.moved) { if (api.onSquare) api.onSquare(d.n, false, planeSq(e)); return; }
    const h = hit(e), to = h ? sqOf(h[0], h[2]) : null;
    const [x, z] = world(d.n); d.p.x = x; d.p.z = z; d.p.y = 0; draw();
    if (to && to !== d.n && api.onDrop) api.onDrop(d.n, to);
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  const ro = new ResizeObserver(() => { cam = null; draw(); }); ro.observe(wrap);
  return api;
};
