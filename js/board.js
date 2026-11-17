// Scroll scene: black and white lacquer pieces appear in the air, tumble, and land on a marble board
// in the starting position; the last stretch of scroll plays the Queen's Gambit (1. d4 d5 2. c4).
{
  const { V, M, Q, clamp, sstep, easeInOut, backOut, createRenderer } = window.FG;
  const GEO = window.FG_PIECES;
  const section = document.getElementById('setup'), canvas = document.getElementById('boardgl');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let R = null;
  try { R = createRenderer(canvas, GEO, { seg: 40, maxDpr: 1.25, shadowSize: 1024 }); } catch (e) { console.error(e); }
  if (!R) { section.hidden = true; }
  else {
    const S = 0.66, TOP = 0.32, HALF = 4.45;
    R.setBoard(HALF, TOP, 0.045);

    // ---------- the set ----------
    const BACK = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    const sq = (f, r) => [f - 3.5, 3.5 - (r - 1)];
    const set = [];
    for (let f = 0; f < 8; f++) {
      set.push({ type: BACK[f], white: true, f, r: 1 }, { type: 'pawn', white: true, f, r: 2 });
      set.push({ type: BACK[f], white: false, f, r: 8 }, { type: 'pawn', white: false, f, r: 7 });
    }
    const find = (w, f, r) => set.find(p => p.white === w && p.f === f && p.r === r);
    // landing order: the back ranks from the corners in, then the pawns from the edges in
    const order = [];
    for (const [f1, f2] of [[0, 7], [1, 6], [2, 5], [3, 4]]) order.push(find(true, f1, 1), find(false, f2, 8), find(true, f2, 1), find(false, f1, 8));
    for (const [f1, f2] of [[0, 7], [1, 6], [2, 5], [3, 4]]) order.push(find(true, f1, 2), find(false, f2, 7), find(true, f2, 2), find(false, f1, 7));

    // seeded randomness so every visit tumbles the same way
    let seed = 20261117;
    const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    order.forEach((p, i) => {
      const [x, z] = sq(p.f, p.r);
      p.end = [x, TOP, z];
      const th = Math.atan2(z, x) + (rnd() - .5) * 1.4, rad = 3.6 + rnd() * 2.6;
      p.start = [Math.cos(th) * rad, 4.2 + rnd() * 3.6, Math.sin(th) * rad];
      p.q0 = Q.axis([rnd() - .5, rnd() - .5, rnd() - .5], Math.PI * (1 + rnd()));
      p.spin = (rnd() < .5 ? -1 : 1) * Math.PI * 2 * (1 + Math.floor(rnd() * 2));
      // knights look across the board at each other
      p.face = p.type === 'knight' ? Q.axis([0, 1, 0], p.white ? Math.PI / 2 : -Math.PI / 2) : Q.I;
      p.s0 = 0.03 + i * (0.52 / 31);
      p.r0 = GEO[p.type].r0;
    });
    const DUR = 0.24;
    const MOVES = [[find(true, 3, 2), 4, .815, .875], [find(false, 3, 7), 5, .875, .935], [find(true, 2, 2), 4, .935, .995]];

    function pose(p, prog) {
      const u = (prog - p.s0) / DUR;
      if (u <= 0) return null;
      const scale = S * backOut(u / 0.22);
      const e = easeInOut((u - 0.04) / 0.96);
      const pos = V.lerp(p.start, p.end, e);
      pos[1] += Math.sin(Math.PI * clamp(e)) * 0.7;
      const er = easeInOut(u / 0.94);
      let q = Q.mul(Q.axis([0, 1, 0], (1 - er) * p.spin), Q.slerp(p.q0, Q.I, er));
      q = Q.mul(q, p.face);
      // the gambit: a pawn hops forward
      for (const [mp, toRank, a, b] of MOVES) if (mp === p && prog > a) {
        const k = easeInOut((prog - a) / (b - a)), to = sq(p.f, toRank);
        pos[0] = p.end[0] + (to[0] - p.end[0]) * k; pos[2] = p.end[2] + (to[1] - p.end[2]) * k;
        pos[1] = TOP + Math.sin(Math.PI * k) * 0.45;
      }
      return { pos, q, scale, landed: u >= 1 };
    }

    function camera(prog, asp) {
      const fov = 30 * Math.PI / 180, tn = Math.tan(fov / 2), k = sstep(.45, .85, prog);
      const az = (36 + 22 * prog) * Math.PI / 180, el = (40 - 6 * prog) * Math.PI / 180;
      const halfW = 7.3 - 0.3 * k, halfH = 5.6 - 1.5 * k;
      const dist = Math.max(halfW / (tn * Math.min(asp, 2.2)), halfH / tn) * 1.04 + 2;
      const tgt = [0, 1.55 - 1.45 * k, 0];
      return { eye: V.add(tgt, V.mul([Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)], dist)), tgt, fov };
    }

    function draw(prog) {
      const { asp } = R.size();
      const pieces = [], ao = [];
      for (const p of order) {
        const ps = pose(p, prog); if (!ps) continue;
        pieces.push({ type: p.type, white: p.white, m: M.compose(ps.pos, ps.q, ps.scale) });
        ao.push({ x: ps.pos[0], z: ps.pos[2], r: p.r0 * ps.scale, lift: Math.max(0, ps.pos[1] - TOP), vis: clamp(ps.scale / S), spread: S });
      }
      const la = (-38 + 30 * prog) * Math.PI / 180, le = 46 * Math.PI / 180;
      const L = [Math.cos(le) * Math.sin(la), Math.sin(le), Math.cos(le) * Math.cos(la)];
      const bg = .93 * (.33 + L[1] * 2.9);
      R.render({ t: prog * 10, cam: camera(prog, asp), L, Lc: 2.9, amb: .33, exp: 1.32, shadow: { c: [0, 0, 0], half: 10 }, shadowSoft: 1.6, taps: 6, cheap: true, flat: true,
        clip: false, ground: TOP, groundCol: [bg * .45, bg * .45, bg * .45], reflect: false, board: true, pieces, ao });
    }

    // ---------- scroll ----------
    let target = reduced ? 1 : 0, cur = target, raf = 0, visible = false;
    const measure = () => {
      if (reduced) return 1;
      // starts while the section is still coming up, so the first pieces appear in the upper half of the screen
      const r = section.getBoundingClientRect(), lead = innerHeight * 0.55, span = r.height - innerHeight + lead;
      return span > 0 ? clamp((lead - r.top) / span) : 0;
    };
    const tick = () => {
      raf = 0;
      cur += (target - cur) * 0.22;
      if (Math.abs(target - cur) < 1e-4) cur = target;
      try { draw(cur); } catch (e) { console.error(e); return; }
      if (cur !== target) raf = requestAnimationFrame(tick);
    };
    const kick = () => { target = measure(); if (!raf && visible) raf = requestAnimationFrame(tick); };
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) { cur = target = measure(); kick(); draw(cur); } }, { rootMargin: '200px 0px' }).observe(section);
    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', () => { if (visible) draw(cur); });
    if (reduced) section.classList.add('still');
    window.__board3d = { draw };
  }
}
