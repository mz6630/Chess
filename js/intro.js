// First Gambit intro: six lacquer pieces rise in a white studio, the king alone is framed,
// night falls over it and the scene hands over to the landing page.
{
  const { V, M, clamp, sstep, easeInOut, createRenderer } = window.FG;
  const GEO = window.FG_PIECES;
  const ORDER = ['pawn', 'knight', 'queen', 'king', 'bishop', 'rook'];
  const $ = id => document.getElementById(id);
  const body = document.body, loader = $('loader'), canvas = $('gl');

  // ---------- landing details: slits in the flat king and its reflection ----------
  const KH = 2.54;
  const rect = (y, h) => `<rect x="-2" y="${y.toFixed(1)}" width="83" height="${h.toFixed(2)}"/>`;
  $('slitsDn').setAttribute('fill', '#FFFFFF');
  $('slitsDn').innerHTML = [.05, .1, .17, .27, .36, .47, .58, .69, .78, .86, .93].map(f => rect(254 * (1 - f), 0.35 + f ** 1.6 * 2.8)).join('');
  $('slitsUp').setAttribute('fill', '#0B0B0B');
  $('slitsUp').innerHTML = [0.07, 0.045, 0.022].map((f, i) => rect(254 * (1 - f), 0.45 + i * 0.4)).join('');

  // ---------- the row ----------
  const GAP = 0.62;
  const widths = ORDER.map(k => GEO[k].w), total = widths.reduce((a, b) => a + b, 0) + GAP * 5;
  let acc = -total / 2;
  const XS = widths.map(w => { const x = acc + w / 2; acc += w + GAP; return x; });
  const HS = ORDER.map(k => GEO[k].h);

  // ---------- the timeline (seconds) ----------
  const T = { rise0: .9, riseStep: .58, riseDur: 1.7, wave0: 5.6, waveDur: 1.15, waveStep: .14, sink0: 7.5, sinkDur: 1.35, cam0: 7.6, cam1: 10.2, curtain: 10.45, curtainDur: 1.25, end: 11.9 };
  const SINK = [2, 4, 1, 5, 0];

  function state(t) {
    const st = { y: [], lift: [], vis: [] };
    for (let i = 0; i < 6; i++) {
      const r = easeInOut((t - T.rise0 - i * T.riseStep) / T.riseDur);
      let y = -HS[i] * (1 - r);
      const sIdx = SINK.indexOf(i);
      if (sIdx >= 0) { const s = easeInOut((t - T.sink0 - sIdx * .11) / T.sinkDur); y -= HS[i] * 1.02 * s; }
      const wt = (t - T.wave0 - i * T.waveStep) / T.waveDur;
      const lift = wt > 0 && wt < 1 ? Math.sin(wt * Math.PI) ** 2 * 0.16 : 0;
      st.y.push(y + lift); st.lift.push(lift); st.vis.push(clamp((y + HS[i]) / HS[i]));
    }
    // a slow sundial: the key light swings from behind-left to front-left
    const lt = easeInOut(t / T.end);
    const az = (150 - 112 * lt) * Math.PI / 180, el = (21 + 15 * lt) * Math.PI / 180;
    st.L = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
    return st;
  }

  // camera that frames the row with its baseline at 66% of the screen
  function rowCam(t, asp, fov) {
    const k = easeInOut(t / T.cam0);
    const az = (-27 + 19 * k) * Math.PI / 180, el = (15 - 7 * k) * Math.PI / 180;
    const tn = Math.tan(fov / 2), dir = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
    const dist = Math.max(18.5, (total / 2) / (0.8 * tn * asp) + 2) * (1 - .1 * k);
    let ty = 1.2;
    for (let it = 0; it < 6; it++) {
      const tgt = [0, ty, 0], eye = V.add(tgt, V.mul(dir, dist));
      const ndc = M.apply(M.mul(M.persp(fov, asp, .1, 200), M.look(eye, tgt, [0, 1, 0])), [0, 0, 0])[1];
      ty += (ndc + 0.32) * dist * tn * .9;
    }
    const tgt = [0, ty, 0];
    return { eye: V.add(tgt, V.mul(dir, dist)), tgt, fov };
  }

  // frontal camera that puts the king exactly where the landing's flat king stands
  function kingCam(asp, W, H) {
    const r = $('kup').getBoundingClientRect(), fov = 20 * Math.PI / 180, tn = Math.tan(fov / 2);
    const nTop = 1 - 2 * r.top / H, nBot = 1 - 2 * r.bottom / H, nX = 2 * (r.left + r.width / 2) / W - 1;
    const D = KH / ((nTop - nBot) * tn), yc = -nBot * D * tn, xc = XS[3] - nX * D * tn * asp;
    return { eye: [xc, yc, D], tgt: [xc, yc, 0], fov };
  }

  let R = null;
  try { R = createRenderer(canvas, GEO, { seg: 72, maxDpr: 1.5 }); } catch (e) { console.error(e); R = null; }

  function draw(t) {
    const { W, H, asp } = R.size(), st = state(t);
    const a = rowCam(Math.min(t, T.cam0), asp, 26 * Math.PI / 180), b = kingCam(asp, W, H);
    const k = sstep(T.cam0, T.cam1, t);
    const cam = { fov: a.fov + (b.fov - a.fov) * k, eye: V.lerp(a.eye, b.eye, k), tgt: V.lerp(a.tgt, b.tgt, k) };
    const pieces = [], ao = [];
    for (let i = 0; i < 6; i++) {
      if (st.vis[i] > 0) pieces.push({ type: ORDER[i], m: M.tr(XS[i], st.y[i], 0), white: false });
      ao.push({ x: XS[i], z: 0, r: GEO[ORDER[i]].r0, lift: st.lift[i], vis: st.vis[i] > 0.02 ? Math.min(1, st.vis[i] * 1.4) : 0 });
    }
    R.render({ t, cam, L: st.L, Lc: 2.9, amb: .33, exp: 1.32, shadow: { c: [XS[3] * .3, 0, 0], half: 9 }, shadowSoft: 2.4,
      clip: true, ground: 0, reflect: true, pieces, ao });
  }

  // ---------- running the intro ----------
  let raf = 0, t0 = 0, gen = 0, anims = [], fontsReady = false, curtainOn = false, handed = false;
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fontsReady = true; });
  const A = (el, kf, o) => { const a = el.animate(kf, { fill: 'both', easing: 'cubic-bezier(.2,.7,.2,1)', ...o }); anims.push(a); return a; };

  const landingIn = () => {
    body.classList.remove('pre');
    A($('kdn'), [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1500, delay: 200 });
    [$('first'), $('gambit')].forEach(el => A(el, [{ opacity: 0, letterSpacing: '.48em' }, { opacity: 1, letterSpacing: '.16em' }], { duration: 1600, delay: 500 }));
    [...document.querySelectorAll('.fd')].forEach((el, i) => A(el, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 1200 + i * 100 }));
  };
  const hide = () => { cancelAnimationFrame(raf); loader.style.display = 'none'; body.classList.remove('intro-on'); };
  const finish = () => { if (cues.length && window.FG_SOUND) window.FG_SOUND.stopIntro(); cues = []; gen++; cancelAnimationFrame(raf); anims.forEach(a => a.finish()); hide(); body.classList.remove('pre'); };
  const handOff = my => {
    handed = true;
    const a = loader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 800, easing: 'ease-in-out', fill: 'forwards' });
    anims.push(a);
    a.onfinish = () => { if (my === gen) hide(); };
    landingIn();
  };

  // sound cues on the intro's clock: a note as each piece rises, a ripple for the wave, low notes as they sink
  const SND = window.FG_SOUND;
  let cues = [];
  const makeCues = () => {
    cues = [];
    for (let i = 0; i < 6; i++) cues.push([T.rise0 + i * T.riseStep + .25, 'introRise', { i }]);
    for (let i = 0; i < 6; i++) cues.push([T.wave0 + i * T.waveStep + .2, 'introWave', { i }]);
    SINK.forEach((pi, k) => cues.push([T.sink0 + k * .11 + .15, 'introSink', { i: k }]));
    cues.push([T.curtain, 'introCurtain', {}], [T.end - .3, 'introLand', {}]);
    cues.sort((a, b) => a[0] - b[0]);
  };
  const frame = my => now => {
    if (my !== gen) return;
    const t = (now - t0) / 1000;
    while (SND && cues.length && cues[0][0] <= t) { const [ct, n, o] = cues.shift(); if (t - ct < .4) SND.play(n, o); }
    try { draw(Math.min(t, T.end)); } catch (e) { console.error(e); finish(); return; }
    if (t >= T.curtain && !curtainOn) {
      curtainOn = true;
      A($('curtain'), [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: T.curtainDur * 1000, easing: 'cubic-bezier(.7,0,.25,1)' });
    }
    if (t >= T.end && fontsReady && !handed) handOff(my);
    if (!handed || t < T.end + 1) raf = requestAnimationFrame(frame(my));
  };

  const canPlay = () => R && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const play = () => {
    if (!R) return;
    const my = ++gen;
    anims.forEach(a => a.cancel()); anims = []; curtainOn = false; handed = false;
    body.classList.add('pre', 'intro-on'); loader.style.display = 'block'; loader.style.opacity = 1;
    window.scrollTo(0, 0);
    t0 = performance.now(); makeCues(); offerSound();
    raf = requestAnimationFrame(frame(my));
  };

  // Sound: plays at once when the browser allows it. If not (a first visit straight to the site), a small
  // "Sound on" button appears; it turns sound on from that moment without skipping the intro.
  const sndBtn = document.createElement('button');
  sndBtn.type = 'button'; sndBtn.className = 'snd-on'; sndBtn.hidden = true; sndBtn.dataset.quiet = '';
  sndBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span>Sound on</span>';
  sndBtn.setAttribute('aria-label', 'Turn sound on');
  loader.appendChild(sndBtn);
  ['pointerdown', 'click'].forEach(ev => sndBtn.addEventListener(ev, e => e.stopPropagation()));
  sndBtn.addEventListener('click', () => { if (window.FG_SOUND) window.FG_SOUND.enable(); sndBtn.hidden = true; });
  const offerSound = () => {
    const S = window.FG_SOUND;
    if (!S || !S.on) { sndBtn.hidden = true; return; }
    sndBtn.hidden = S.prime();
  };
  addEventListener('fgsound', e => { if (e.detail === 'running') sndBtn.hidden = true; });
  loader.addEventListener('click', finish);
  document.addEventListener('keydown', e => { if (loader.style.display === 'block' && !e.metaKey && !e.ctrlKey) finish(); });
  // the logo takes you back to the intro
  $('logo').addEventListener('click', e => { e.preventDefault(); if (canPlay()) play(); else window.scrollTo({ top: 0, behavior: 'smooth' }); });
  // "Main" scrolls back to the top
  $('toMain').addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  // index.html#main (the Main link on other pages) opens straight on the landing, without the intro
  if (canPlay() && location.hash !== '#main') play();
}
