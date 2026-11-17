// Scroll scene: black and white lacquer pieces appear in the air, tumble, and land on a marble board
// in the starting position; the last stretch of scroll plays the Queen's Gambit (1. d4 d5 2. c4).
{
  const { V, M, Q, clamp, sstep, easeInOut, backOut, createRenderer } = window.FG;
  const GEO = window.FG_PIECES;
  const section = document.getElementById('setup'), canvas = document.getElementById('boardgl');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let R = null;
  try { R = createRenderer(canvas, GEO, { seg: 40, maxDpr: 1.25, shadowSize: 1024, alpha: true }); } catch (e) { console.error(e); }
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

    // ---------- hands on the board: drag to move, knock pieces over ----------
    const LIVE = 0.995, BOUND = 3.9, FALL_MS = 520;
    let lastProg = 0;
    let live = false, lastCam = null, lastAsp = 1, lastOff = 0;
    const radius = p => p.r0 * S, length = p => GEO[p.type].h * S;
    // the tilt at which a piece lying on its side rests with its tip on the board
    const restAngle = p => { const rb = radius(p), L = length(p); let th = Math.PI / 2; for (let i = 0; i < 30; i++) { const f = rb * Math.sin(th) + L * Math.cos(th) - .03; if (f <= 0) break; th += .01; } return th; };

    function goLive() {
      live = true; canvas.style.pointerEvents = 'auto';
      for (const p of order) { const ps = pose(p, 1); p.ix = ps.pos[0]; p.iz = ps.pos[2]; p.th = 0; p.dir = [1, 0]; p.lift = 0; p.anims = []; p.knockAt = 0; }
    }
    function leaveLive() { live = false; canvas.style.pointerEvents = ''; for (const p of order) delete p.ix; drag = null; canvas.style.cursor = ''; }

    const SND = window.FG_SOUND, sfx = (n, o) => SND && SND.play(n, o);
    const panOf = x => Math.max(-.7, Math.min(.7, x / 5.5));
    const anim = (p, key, to, dur, ease) => { p.anims = p.anims.filter(a => a.key !== key); p.anims.push({ key, from: p[key], to, t0: performance.now(), dur, ease }); };
    const fallEase = u => u < .78 ? (u / .78) ** 2 : 1 - .07 * Math.sin((u - .78) / .22 * Math.PI);
    function knock(p, dx, dz, delay = 0) {
      if (p.th > .2 || p.knockAt || p === (drag && drag.p)) return;
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      p.knockAt = performance.now() + delay; p.knockDir = [dx, dz];
    }
    function startFall(p, now) {
      const [dx, dz] = p.knockDir; p.knockAt = 0;
      // pivot on the rim of the base that faces the push
      const rb = radius(p);
      p.ix += dx * rb; p.iz += dz * rb; p.dir = [dx, dz]; p.pivot = true;
      anim(p, 'th', restAngle(p), FALL_MS, fallEase);
      sfx('fall', { pan: panOf(p.ix), delay: FALL_MS * .78 / 1000 });
      // dominoes: whatever stands in the falling piece's path goes too
      const L = length(p);
      for (const q of order) {
        if (q === p || q.th > .2 || q.knockAt) continue;
        const rx = q.ix - p.ix, rz = q.iz - p.iz, along = rx * dx + rz * dz, side = Math.abs(rx * dz - rz * dx);
        if (along > 0 && along < L + radius(q) * .6 && side < radius(q) + .14) knock(q, dx + (Math.random() - .5) * .5, dz + (Math.random() - .5) * .5, FALL_MS * Math.pow(along / L, 1.4) * .85);
      }
    }
    // base centre and rotation of a piece in its interactive state
    function livePose(p) {
      const up = Q.mul(Q.I, p.face), rb = radius(p);
      if (!p.pivot || p.th < 1e-4) return { pos: [p.ix - (p.pivot ? p.dir[0] * rb : 0), TOP + p.lift, p.iz - (p.pivot ? p.dir[1] * rb : 0)], q: up };
      const [dx, dz] = p.dir, th = p.th, ax = [dz, 0, -dx];
      const c = Math.cos(th), si = Math.sin(th);
      // the base centre swings round the pivot on the rim
      return { pos: [p.ix - dx * rb * c, TOP + p.lift + rb * si, p.iz - dz * rb * c], q: Q.mul(Q.axis(ax, th), up) };
    }
    const baseOf = p => { if (!p.pivot) return [p.ix, p.iz]; return [p.ix - p.dir[0] * radius(p), p.iz - p.dir[1] * radius(p)]; };
    function unpivot(p) { const [x, z] = baseOf(p); p.ix = x; p.iz = z; p.pivot = false; }

    function step(now) {
      let busy = false;
      for (const p of order) {
        if (p.knockAt && now >= p.knockAt) startFall(p, now);
        if (p.knockAt) busy = true;
        p.anims = p.anims.filter(a => {
          const u = clamp((now - a.t0) / a.dur);
          p[a.key] = a.from + (a.to - a.from) * (a.ease ? a.ease(u) : easeInOut(u));
          if (u < 1) { busy = true; return true; }
          if (a.key === 'th' && p.th < 1e-3) { p.th = 0; unpivot(p); }
          return false;
        });
      }
      return busy;
    }

    function draw(prog) {
      const { asp } = R.size();
      if (prog >= LIVE && !live) goLive(); else if (prog < LIVE - .02 && live) leaveLive();
      const pieces = [], ao = [];
      for (const p of order) {
        let ps;
        if (live) { const lp = livePose(p); ps = { pos: lp.pos, q: lp.q, scale: S }; }
        else {
          ps = pose(p, prog);
          // a knock when a piece lands; forget it when scrolling back above, so it knocks again next time
          const landed = !!(ps && ps.landed);
          if (landed && !p.heard && prog > lastProg) sfx('land', { type: p.type, pan: panOf(p.end[0]) });
          p.heard = landed;
          if (!ps) continue;
        }
        pieces.push({ type: p.type, white: p.white, m: M.compose(ps.pos, ps.q, ps.scale) });
        const lying = live && p.th > .3;
        ao.push({ x: ps.pos[0], z: ps.pos[2], r: p.r0 * ps.scale * (lying ? .6 : 1), lift: Math.max(0, ps.pos[1] - TOP - (lying ? radius(p) : 0)), vis: clamp(ps.scale / S), spread: S });
      }
      if (!live) for (const mv of MOVES) { const done = prog >= mv[3]; if (done && !mv.heard && prog > lastProg) sfx('place', { pan: panOf(mv[0].end[0]) }); mv.heard = done; }
      lastProg = prog;
      const la = (-38 + 30 * prog) * Math.PI / 180, le = 46 * Math.PI / 180;
      const L = [Math.cos(le) * Math.sin(la), Math.sin(le), Math.cos(le) * Math.cos(la)];
      const bg = .93 * (.33 + L[1] * 2.9);
      lastCam = camera(prog, asp); lastAsp = asp;
      // the canvas covers the whole screen; the picture follows where the section's frame is, so pieces can fly above it
      const fr = section.getBoundingClientRect(); lastOff = -2 * Math.max(0, fr.top) / innerHeight;
      R.render({ offsetY: lastOff, t: prog * 10, cam: lastCam, L, Lc: 2.9, amb: .33, exp: 1.32, shadow: { c: [0, 0, 0], half: 10 }, shadowSoft: 1.6, taps: 6, cheap: true, flat: true,
        clip: false, ground: TOP, groundCol: [bg * .45, bg * .45, bg * .45], reflect: false, board: true, pieces, ao });
    }

    // ---------- pointer ----------
    function ray(e) {
      const r = canvas.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 2 - 1, y = 1 - ((e.clientY - r.top) / r.height) * 2 - lastOff;
      const c = lastCam, f = V.norm(V.sub(c.tgt, c.eye)), rt = V.norm(V.cross(f, [0, 1, 0])), up = V.cross(rt, f), tn = Math.tan(c.fov / 2);
      return { o: c.eye, d: V.norm(V.add(f, V.add(V.mul(rt, x * tn * lastAsp), V.mul(up, y * tn)))) };
    }
    const onPlane = (rr, y) => { const t = (y - rr.o[1]) / rr.d[1]; return t > 0 ? V.add(rr.o, V.mul(rr.d, t)) : null; };
    function pick(rr) {
      let best = null, bt = 1e9;
      for (const p of order) {
        const lp = livePose(p), axis = [0, 1, 0], R3 = M.compose([0, 0, 0], lp.q, 1), a = [R3[4], R3[5], R3[6]];
        const L = length(p), rad = radius(p) * 1.15;
        for (let k = 0; k <= 8; k++) {
          const pt = V.add(lp.pos, V.mul(a, L * k / 8)), w = V.sub(pt, rr.o), t = V.dot(w, rr.d);
          if (t < 0) continue;
          const d = Math.hypot(...V.sub(w, V.mul(rr.d, t)));
          if (d < rad && t < bt) { bt = t; best = p; }
        }
      }
      return best;
    }

    let drag = null, iraf = 0;
    const loop = () => {
      iraf = 0;
      const busy = step(performance.now());
      draw(cur);
      if (busy || drag) iraf = requestAnimationFrame(loop);
    };
    const wake = () => { if (!iraf) iraf = requestAnimationFrame(loop); };

    canvas.addEventListener('pointerdown', e => {
      if (!live || !lastCam || e.button > 0) return;
      const rr = ray(e), p = pick(rr); if (!p) return;
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      p.knockAt = 0;
      if (p.th > 0) { unpivotKeep(p); anim(p, 'th', 0, 260); }
      const hit = onPlane(rr, TOP + .4) || [p.ix, 0, p.iz];
      drag = { p, id: e.pointerId, ox: p.ix - hit[0], oz: p.iz - hit[2], last: [p.ix, p.iz], t: performance.now(), v: 0 };
      anim(p, 'lift', .4, 160);
      sfx('lift', { pan: panOf(p.ix) });
      canvas.style.cursor = 'grabbing'; wake();
    });
    // stand a fallen piece back up about its own base
    function unpivotKeep(p) { const lp = livePose(p); p.ix = lp.pos[0]; p.iz = lp.pos[2]; p.lift = Math.max(p.lift, lp.pos[1] - TOP); p.pivot = false; anim(p, 'lift', .4, 260); }

    canvas.addEventListener('pointermove', e => {
      if (!live || !lastCam) return;
      const rr = ray(e);
      if (!drag) { canvas.style.cursor = pick(rr) ? 'grab' : ''; return; }
      const hit = onPlane(rr, TOP + .4); if (!hit) return;
      const p = drag.p, now = performance.now();
      p.ix = clamp(hit[0] + drag.ox, -BOUND - .3, BOUND + .3); p.iz = clamp(hit[2] + drag.oz, -BOUND - .3, BOUND + .3);
      const dt = Math.max(1, now - drag.t) / 1000, vx = (p.ix - drag.last[0]) / dt, vz = (p.iz - drag.last[1]) / dt;
      drag.v = drag.v * .5 + Math.hypot(vx, vz) * .5; drag.last = [p.ix, p.iz]; drag.t = now;
      // bump into the others: a quick swipe knocks them over, a slow one pushes them aside
      for (const q of order) {
        if (q === p || q.knockAt) continue;
        const [bx, bz] = baseOf(q), dx = bx - p.ix, dz = bz - p.iz, d = Math.hypot(dx, dz), min = radius(p) + radius(q) * .95;
        if (d >= min || d < 1e-4) continue;
        if (q.th < .2 && drag.v > 2.4) knock(q, dx / d + vx / (drag.v + 1e-3) * .6, dz / d + vz / (drag.v + 1e-3) * .6);
        else if (!q.anims.some(a => a.key === 'th')) { const k = (min - d) / d; if (q.pivot) { q.ix += dx * k; q.iz += dz * k; } else { q.ix = clamp(q.ix + dx * k, -BOUND - .3, BOUND + .3); q.iz = clamp(q.iz + dz * k, -BOUND - .3, BOUND + .3); } }
      }
      wake();
    });
    const drop = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = drag.p; drag = null;
      // settle on the nearest square
      const fx = clamp(Math.round(p.ix + 3.5), 0, 7) - 3.5, fz = clamp(Math.round(p.iz + 3.5), 0, 7) - 3.5;
      anim(p, 'ix', fx, 220); anim(p, 'iz', fz, 220); anim(p, 'lift', 0, 260, u => u * u);
      sfx('place', { pan: panOf(fx), delay: .24 });
      // whoever was standing there is knocked off it
      for (const q of order) { if (q === p) continue; const [bx, bz] = baseOf(q); const dx = bx - fx, dz = bz - fz; if (Math.hypot(dx, dz) < .42 && q.th < .2) knock(q, dx || .3, dz || .3, 160); }
      canvas.style.cursor = 'grab'; wake();
    };
    canvas.addEventListener('pointerup', drop);
    canvas.addEventListener('pointercancel', drop);
    // a double click puts every piece back where it stood
    canvas.addEventListener('dblclick', () => { if (!live) return; goLive(); sfx('reset'); wake(); });

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
      if (cur !== target) raf = requestAnimationFrame(tick); else if (live) wake();
    };
    const kick = () => { target = measure(); if (!raf && visible) raf = requestAnimationFrame(tick); };
    new IntersectionObserver(es => {
      visible = es[0].isIntersecting; canvas.style.display = visible ? 'block' : 'none';
      if (visible) { cur = target = measure(); kick(); draw(cur); }
    }, { rootMargin: '0px 0px 0px 0px' }).observe(section);
    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', () => { if (visible) draw(cur); });
    if (reduced) section.classList.add('still');
    window.__board3d = { draw, order, pick: e => pick(ray(e)) };
    // what the tutor can see: where every piece should be after 1. d4 d5 2. c4, and where it is now
    const NAME = (f, r) => 'abcdefgh'[f] + r;
    const homeOf = p => { const mv = MOVES.find(m => m[0] === p); return NAME(p.f, mv ? mv[1] : p.r); };
    window.FG_BOARD = {
      isLive: () => live,
      pieces: () => live ? order.map(p => {
        const [x, z] = baseOf(p), f = clamp(Math.round(x + 3.5), 0, 7), r = clamp(Math.round(4.5 - z), 1, 8);
        return { type: p.type, white: p.white, home: homeOf(p), square: NAME(f, r), fallen: p.th > .3 };
      }) : null
    };
  }
}
