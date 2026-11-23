// SOUND: every effect is synthesised with Web Audio, no audio files.
// Wood knocks for pieces (filtered noise + a short resonant tone), a felt-piano voice for the intro
// (a few sine partials with a soft hammer), airy sweeps, and small chimes for right and wrong answers.
// Browsers only allow sound after the visitor has clicked or pressed a key, so the very first intro on
// a fresh visit plays silently; the logo replays it with sound. The speaker button mutes everything.
window.FG_SOUND = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  const store = {
    get() { try { return localStorage.getItem('fgSound'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem('fgSound', v); } catch (e) {} }
  };
  let on = store.get() !== 'off';
  let ctx = null, master, verb, noise, introBus;
  const last = {};

  // The context is created as soon as the page loads. If the browser allows sound without a click (you came
  // from another page of the site, or you have used the site before), it runs at once; otherwise it waits,
  // and the first click or key press anywhere starts it.
  function ensure() {
    if (!AC || !on) return null;
    if (!ctx) {
      ctx = new AC();
      ctx.addEventListener('statechange', () => dispatchEvent(new CustomEvent('fgsound', { detail: ctx.state })));
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = .85;
      master.connect(comp); comp.connect(ctx.destination);
      // a small room: exponentially decaying stereo noise as the impulse
      verb = ctx.createConvolver();
      const len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      verb.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = .55; verb.connect(wet); wet.connect(master);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const n = noise.getChannelData(0); for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
      newIntroBus();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function newIntroBus() { introBus = ctx.createGain(); introBus.connect(master); }
  // unlock on the first gesture
  const unlock = () => { ensure(); };
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => addEventListener(e, unlock, { capture: true, passive: true }));

  // ---------- voices ----------
  const out = (o = {}) => {
    const g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, o.pan || 0)); g.connect(p); p.connect(o.bus || master); }
    else g.connect(o.bus || master);
    if (o.verb) { const s = ctx.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(verb); }
    return g;
  };
  const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  // wood: a burst of band-passed noise plus a short body tone
  function knock(t, o) {
    const f = o.f || 1200, dur = o.dur || .08, gain = o.gain || .3;
    const g = out(o);
    const src = ctx.createBufferSource(); src.buffer = noise; src.playbackRate.value = .8 + Math.random() * .4;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = o.q || 1.6;
    const ng = ctx.createGain(); env(ng, t, gain, .001, dur * .6);
    src.connect(bp); bp.connect(ng); ng.connect(g);
    src.start(t, Math.random() * .5, dur + .05);
    const body = ctx.createOscillator(); body.type = 'sine'; body.frequency.setValueAtTime(f * .42, t); body.frequency.exponentialRampToValueAtTime(f * .3, t + dur);
    const bg = ctx.createGain(); env(bg, t, gain * .7, .002, dur);
    body.connect(bg); bg.connect(g); body.start(t); body.stop(t + dur + .05);
    if (o.thump) { const th = ctx.createOscillator(); th.frequency.setValueAtTime(o.thump, t); th.frequency.exponentialRampToValueAtTime(o.thump * .6, t + .12); const tg = ctx.createGain(); env(tg, t, gain * .8, .003, .14); th.connect(tg); tg.connect(g); th.start(t); th.stop(t + .2); }
  }
  // felt piano: a few partials, a soft hammer, a long gentle decay
  function note(t, freq, o = {}) {
    const dur = o.dur || 1.2, gain = o.gain || .12;
    const g = out(Object.assign({ verb: .35 }, o));
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.bright || 2600; lp.connect(g);
    [[1, 1], [2, .32], [3, .1], [4.02, .04]].forEach(([h, a], i) => {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq * h * (1 + (i ? (Math.random() - .5) * .002 : 0));
      const og = ctx.createGain(); env(og, t, gain * a, .006, dur / (1 + i * .6));
      osc.connect(og); og.connect(lp); osc.start(t); osc.stop(t + dur + .1);
    });
    if (o.hammer !== false) knock(t, { f: 2600, dur: .02, gain: gain * .25, pan: o.pan, bus: o.bus });
  }
  // air: band-passed noise sweeping between two frequencies
  function sweep(t, from, to, dur, gain, o = {}) {
    const g = out(o);
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + dur);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(gain, t + dur * .45); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(ng); ng.connect(g); src.start(t); src.stop(t + dur + .05);
  }
  function glide(t, f1, f2, dur, gain, o = {}) {
    const g = out(o), osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(f1, t); osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const og = ctx.createGain(); env(og, t, gain, .005, dur); osc.connect(og); og.connect(g); osc.start(t); osc.stop(t + dur + .05);
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);   // MIDI note to frequency
  const PIECE_F = { pawn: 1650, knight: 1350, bishop: 1450, rook: 1150, queen: 1050, king: 950 };

  // ---------- the sound list ----------
  const S = {
    tick: (t, o) => knock(t, { f: 3800, dur: .025, gain: .12, q: 3, pan: o.pan }),
    select: (t, o) => knock(t, { f: 1900, dur: .045, gain: .2, pan: o.pan }),
    place: (t, o) => knock(t, { f: o.f || 1150, dur: .09, gain: o.gain || .3, thump: 150, pan: o.pan }),
    move: (t, o) => { sweep(t, 500, 900, .11, .08, o); knock(t + .09, { f: 1150, dur: .09, gain: .32, thump: 150, pan: o.pan }); },
    capture: (t, o) => { knock(t + .07, { f: 950, dur: .1, gain: .42, thump: 120, pan: o.pan }); knock(t + .12, { f: 1700, dur: .05, gain: .16, pan: o.pan }); },
    check: (t, o) => { note(t, hz(81), { dur: .5, gain: .1, bright: 4200, pan: o.pan }); note(t + .07, hz(87), { dur: .45, gain: .08, bright: 4200, pan: o.pan }); },
    promote: t => [72, 76, 79, 84].forEach((m, i) => note(t + i * .07, hz(m), { dur: .9, gain: .09, bright: 4000 })),
    good: t => { note(t, hz(76), { dur: .6, gain: .1, bright: 3600 }); note(t + .09, hz(83), { dur: .8, gain: .09, bright: 3600 }); },
    bad: t => { note(t, hz(50), { dur: .35, gain: .16, bright: 700, hammer: false }); knock(t, { f: 420, dur: .09, gain: .2 }); },
    star: (t, o) => { note(t, hz(91), { dur: .5, gain: .07, bright: 6000, pan: o.pan }); note(t + .05, hz(96), { dur: .6, gain: .05, bright: 6000, pan: o.pan }); },
    complete: t => { [72, 76, 79, 84].forEach((m, i) => note(t + i * .1, hz(m), { dur: 1.6, gain: .09 })); [60, 67].forEach(m => note(t + .42, hz(m), { dur: 2.2, gain: .07 })); },
    whoosh: t => sweep(t, 300, 2200, .6, .22),
    sweep: t => [62, 65, 69, 72, 74, 77, 81].forEach((m, i) => note(t + i * .065, hz(m), { dur: .7, gain: .035, bright: 4200 })),
    open: t => { glide(t, 520, 780, .09, .09); note(t + .03, hz(79), { dur: .4, gain: .06 }); },
    close: t => glide(t, 700, 470, .09, .08),
    reply: t => { note(t, hz(84), { dur: .35, gain: .04 }); note(t + .07, hz(88), { dur: .4, gain: .035 }); },
    // the chess clock: a mechanical snap with a little ring; a soft tick when time runs low; the flag
    clock: (t, o) => { knock(t, { f: 2600, dur: .03, gain: .42, q: 2.5, pan: o.pan }); knock(t + .012, { f: 700, dur: .06, gain: .32, thump: 220, pan: o.pan }); note(t + .02, hz(96), { dur: .18, gain: .015, bright: 8000, hammer: false, verb: .1 }); },
    lowtime: t => knock(t, { f: 3200, dur: .015, gain: .09, q: 4 }),
    flag: t => { note(t, hz(84), { dur: .6, gain: .1, bright: 5000 }); note(t + .16, hz(80), { dur: .8, gain: .1, bright: 5000 }); },
    // pen on paper: three short scratches
    write: t => { for (let i = 0; i < 3; i++) sweep(t + i * .07, 2400 + i * 300, 3800, .06, .05); },
    // the scroll scene on the home page
    land: (t, o) => knock(t, { f: PIECE_F[o.type] || 1300, dur: .07, gain: .14, thump: 170, pan: o.pan }),
    lift: (t, o) => { knock(t, { f: 2100, dur: .03, gain: .09, pan: o.pan }); glide(t, 300, 420, .1, .02, o); },
    fall: (t, o) => { knock(t, { f: 720, dur: .12, gain: .38, thump: 110, pan: o.pan }); knock(t + .09, { f: 1300, dur: .05, gain: .09, pan: o.pan }); },
    reset: t => { sweep(t, 1800, 400, .5, .16); [62, 69, 74].forEach((m, i) => note(t + .25 + i * .06, hz(m), { dur: 1.2, gain: .05 })); },
    // the intro: a slow phrase in D minor, one note per piece
    introRise: (t, o) => note(t, hz([50, 57, 60, 62, 65, 69][o.i]), { dur: 3.4, gain: .13, verb: .6, bus: introBus, bright: 1800, pan: (o.i - 2.5) * .18 }),
    introWave: (t, o) => note(t, hz([81, 84, 86, 88, 91, 93][o.i]), { dur: 1.1, gain: .055, verb: .7, bus: introBus, bright: 5200, pan: (o.i - 2.5) * .2, hammer: false }),
    introSink: (t, o) => note(t, hz([45, 41, 38, 36, 33][o.i]), { dur: 2.4, gain: .07, verb: .6, bus: introBus, bright: 900, hammer: false }),
    introCurtain: t => sweep(t, 160, 2600, 1.25, .2, { bus: introBus, verb: .4 }),
    introLand: t => [50, 57, 62, 65, 69].forEach((m, i) => note(t + i * .09, hz(m), { dur: 3.2, gain: .05, verb: .7, bus: introBus, bright: 2200 }))
  };
  const GAP = { land: 28, place: 15, tick: 30, select: 30, star: 40, fall: 25, move: 40, capture: 40 };

  function play(name, o = {}) {
    if (!on || !S[name]) return;
    const c = ensure(); if (!c || c.state !== 'running') return;
    // throttle by the time the sound will actually start, so staggered groups still rattle
    const at = performance.now() + (o.delay || 0) * 1000;
    if (GAP[name] && last[name] !== undefined && Math.abs(at - last[name]) < GAP[name]) return;
    last[name] = at;
    try { S[name](c.currentTime + .005 + (o.delay || 0), o); } catch (e) { /* never let sound break the page */ }
  }
  // the intro was skipped: fade its notes out
  function stopIntro() {
    if (!ctx || !introBus) return;
    const g = introBus; g.gain.setTargetAtTime(0, ctx.currentTime, .06);
    setTimeout(() => g.disconnect(), 600);
    newIntroBus();
  }

  // ---------- the speaker button ----------
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'snd'; btn.dataset.quiet = '';
  const draw = () => {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Sound on. Click to mute.' : 'Sound off. Click to turn sound on.');
    btn.title = on ? 'Sound on' : 'Sound off';
    btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>${on
      ? '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
      : '<path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'}</svg>`;
  };
  btn.addEventListener('click', () => {
    on = !on; store.set(on ? 'on' : 'off'); draw();
    if (on) play('good'); else if (ctx) ctx.suspend();
    if (on && ctx && ctx.state === 'suspended') ctx.resume();
  });
  draw();
  const mount = () => document.body.appendChild(btn);
  if (document.body) mount(); else addEventListener('DOMContentLoaded', mount);

  // ---------- every button and link clicks ----------
  addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('a,button,[role="button"]');
    if (!el || el.closest('[data-quiet]') || el.disabled) return;
    play('tick');
  }, true);

  // ask for sound now; the answer is whether it is already allowed
  const prime = () => { const c = ensure(); return !!c && c.state === 'running'; };
  const enable = () => { const c = ensure(); return c ? c.resume().then(() => c.state === 'running') : Promise.resolve(false); };
  if (on) prime();
  return { play, stopIntro, prime, enable, get running() { return !!ctx && ctx.state === 'running'; }, get on() { return on; }, names: Object.keys(S), _tap: () => { if (!ensure()) return null; const an = ctx.createAnalyser(); an.fftSize = 2048; master.connect(an); const rec = ctx.createMediaStreamDestination(); master.connect(rec); return { ctx, an, rec }; } };
})();
