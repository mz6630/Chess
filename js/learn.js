// LEARN: the course map and the lessons of Chapters 1 and 2 (the board, the pieces, the starting position, turns).
// A lesson is a list of steps. Each step has text, an optional task and a run(ctx) function that sets up the stage
// (a flat board drawn with the set's own silhouettes, the six-piece lineup, or a tray of pieces to place).
// A step with a task unlocks Next when ctx.done() is called. Text is written in English and Korean.
(() => {
  const FLAT = window.FG_FLAT;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const FILES = 'abcdefgh';
  const fr = s => [FILES.indexOf(s[0]), +s[1] - 1];
  const nameOf = (f, r) => FILES[f] + (r + 1);
  const isLight = s => { const [f, r] = fr(s); return (f + r) % 2 === 1; };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sfx = (n, o) => window.FG_SOUND && window.FG_SOUND.play(n, o);
  const panSq = n => (FILES.indexOf(n[0]) - 3.5) / 6;
  const P = (en, ko) => ({ en, ko });
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  let lang = store.get('fgLang', 'en') === 'ko' ? 'ko' : 'en';
  const L = o => (o == null ? '' : typeof o === 'string' ? o : (o[lang] ?? o.en));
  const plain = o => L(o).replace(/<[^>]+>/g, '');
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  // Korean particles: 을/를, 은/는, 이에요/예요 depend on whether the last sound ends in a consonant
  const jo = (w, a, b) => {
    const ch = String(w).replace(/<[^>]+>/g, '').trim().slice(-1), code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 ? a : b;
    if (/[0-9]/.test(ch)) return '013678'.includes(ch) ? a : b;
    return b;
  };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- piece symbols, shared by the header, board, lineup and tray ----------
  const hidden = el('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' });
  document.body.prepend(hidden);
  const defs = el('defs', {}, hidden);
  for (const t in FLAT) {
    const s = el('symbol', { id: 'fp-' + t, viewBox: `0 0 ${FLAT[t].w} ${FLAT[t].h}`, overflow: 'visible' }, defs);
    el('path', { d: FLAT[t].d, 'vector-effect': 'non-scaling-stroke' }, s);
  }
  const TYPE = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };
  const INFO = {
    pawn: { n: P('Pawn', '폰'), c: 8,
      d: P('The <b>pawn</b>. You have 8. Small but many, they march forward in front of the others.', '<b>폰</b>이에요. 8개 있어요. 작지만 수가 많고, 다른 기물들 앞에 서서 앞으로 나아가요.'),
      s: P('The pawn is the smallest piece, with a round head.', '폰은 가장 작고 머리가 동그란 기물이에요.') },
    knight: { n: P('Knight', '나이트'), c: 2,
      d: P('The <b>knight</b>. You have 2. It is shaped like a horse’s head, and it is the only piece that can jump over others.', '<b>나이트</b>예요. 2개 있어요. 말 머리 모양이고, 다른 기물을 뛰어넘을 수 있는 유일한 기물이에요.'),
      s: P('The knight looks like a horse’s head.', '나이트는 말 머리처럼 생겼어요.') },
    bishop: { n: P('Bishop', '비숍'), c: 2,
      d: P('The <b>bishop</b>. You have 2. Its tall, pointed hat makes it easy to spot.', '<b>비숍</b>이에요. 2개 있어요. 끝이 뾰족한 높은 모자 모양이라 쉽게 알아볼 수 있어요.'),
      s: P('The bishop wears a tall, pointed hat.', '비숍은 끝이 뾰족한 높은 모자를 쓰고 있어요.') },
    rook: { n: P('Rook', '룩'), c: 2,
      d: P('The <b>rook</b>. You have 2. It looks like a castle tower.', '<b>룩</b>이에요. 2개 있어요. 성의 탑처럼 생겼어요.'),
      s: P('The rook looks like a castle tower with a notched top.', '룩은 꼭대기가 톱니 모양인 성탑처럼 생겼어요.') },
    queen: { n: P('Queen', '퀸'), c: 1,
      d: P('The <b>queen</b>. You have 1. She wears a crown of points and is the strongest piece on the board.', '<b>퀸</b>이에요. 1개 있어요. 뾰족뾰족한 왕관을 쓰고 있고, 체스판에서 가장 강한 기물이에요.'),
      s: P('The queen wears a crown with little points.', '퀸은 작은 뾰족한 장식이 달린 왕관을 쓰고 있어요.') },
    king: { n: P('King', '킹'), c: 1,
      d: P('The <b>king</b>. You have 1. The tallest piece, with a cross on top. He is the most important: if your king is trapped, you lose the game.', '<b>킹</b>이에요. 1개 있어요. 가장 키가 크고 머리에 십자가가 있어요. 가장 중요한 기물이라서, 킹이 꼼짝 못 하게 갇히면 게임에서 져요.'),
      s: P('The king is the tallest piece and has a cross on top.', '킹은 가장 키가 크고 꼭대기에 십자가가 있어요.') }
  };
  const ORDER = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
  const START = {};
  'RNBQKBNR'.split('').forEach((t, f) => { START[FILES[f] + 1] = 'w' + t; START[FILES[f] + 8] = 'b' + t; START[FILES[f] + 2] = 'wP'; START[FILES[f] + 7] = 'bP'; });
  const pick = (pos, test) => Object.fromEntries(Object.entries(pos).filter(([s, c]) => test(s, c)));

  // ---------- the board ----------
  const SIZE = { king: .9, queen: .87, bishop: .8, knight: .76, rook: .7, pawn: .62 };
  const board = (() => {
    const svg = $('board');
    svg.setAttribute('role', 'application');
    const labs = el('g', { class: 'labs' }, svg);
    const fileLab = [], rankLab = [];
    for (let i = 0; i < 8; i++) {
      fileLab[i] = el('text', { class: 'lab', x: i + .5, y: 8.3 }, labs); fileLab[i].textContent = FILES[i];
      rankLab[i] = el('text', { class: 'lab', x: -.32, y: 7 - i + .5 }, labs); rankLab[i].textContent = i + 1;
    }
    const rot = el('g', { class: 'rot' }, svg);
    const sqG = el('g', {}, rot);
    const sq = {};
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const n = nameOf(f, r);
      sq[n] = el('rect', { class: 'sq ' + ((f + r) % 2 ? 'l' : 'd'), x: f, y: 7 - r, width: 1, height: 1, 'data-sq': n }, sqG);
    }
    el('rect', { class: 'frame', x: 0, y: 0, width: 8, height: 8 }, rot);
    const mkG = el('g', {}, rot), pcG = el('g', {}, rot), arG = el('g', {}, rot);
    const bdefs = el('defs', {}, svg);
    const mkr = el('marker', { id: 'fgAh', viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 3.2, markerHeight: 3.2, orient: 'auto' }, bdefs);
    el('path', { d: 'M0 0L10 5L0 10Z', fill: '#0B0B0B' }, mkr);
    const cur = el('rect', { class: 'cur', x: .05, y: 7.05, width: .9, height: .9 }, rot);
    const cornerG = el('g', { style: 'display:none' }, svg);
    el('rect', { class: 'corner', x: 7.1, y: 7.1, width: .8, height: .8 }, cornerG);
    const pieces = new Map();
    let cf = 4, cr = 1;

    const api = {
      svg, pieces, onSquare: null,
      reset(o = {}) {
        mkG.textContent = ''; pcG.textContent = ''; arG.textContent = ''; pieces.clear();
        api.onSquare = null;
        api.rotate(o.rotate || 0, false);
        api.labels(o.labels !== false);
        api.emph();
        api.corner(false);
        for (const n in sq) { sq[n].classList.remove('in'); sq[n].style.animationDelay = ''; sq[n].classList.toggle('hidden', !!o.hidden); }
        api.describe();
      },
      async reveal(ctx) {
        for (const n in sq) {
          const [f, r] = fr(n);
          sq[n].style.animationDelay = (f + (7 - r)) * 38 + 'ms';
          sq[n].classList.remove('hidden'); sq[n].classList.add('in');
        }
        sfx('sweep');
        await ctx.wait(14 * 38 + 500);
      },
      rotate(deg, anim = true) {
        if (anim && deg) sfx('whoosh');
        rot.style.transition = anim && !reduce ? '' : 'none';
        rot.style.transform = deg ? `rotate(${deg}deg)` : '';
        if (!anim) { rot.getBoundingClientRect(); rot.style.transition = ''; }
      },
      labels(on) { labs.classList.toggle('off', !on); },
      emph(files = '', ranks = []) {
        fileLab.forEach((t, i) => t.classList.toggle('em', files.includes(FILES[i])));
        rankLab.forEach((t, i) => t.classList.toggle('em', ranks.includes(i + 1)));
      },
      corner(on) { cornerG.style.display = on ? '' : 'none'; },
      place(n, code, o = {}) {
        api.remove(n);
        const t = TYPE[code[1]], H = SIZE[t], W = H * FLAT[t].w / FLAT[t].h;
        const [f, r] = fr(n);
        const g = el('g', { class: 'pc' }, pcG);
        el('use', { href: '#fp-' + t, x: (1 - W) / 2, y: .93 - H, width: W, height: H, class: code[0] === 'w' ? 'pw' : 'pb' }, g);
        const at = `translate(${f}px,${7 - r}px)`;
        if (o.anim) sfx('place', { pan: panSq(n), gain: .2, delay: (o.delay || 0) / 1000 + .3 });
        if (o.anim && !reduce) {
          g.style.transition = 'none'; g.style.opacity = 0; g.style.transform = `translate(${f}px,${7 - r - .35}px)`;
          g.getBoundingClientRect();
          g.style.transition = `transform .55s cubic-bezier(.2,.7,.2,1) ${o.delay || 0}ms, opacity .4s ease ${o.delay || 0}ms`;
          g.style.opacity = 1; g.style.transform = at;
          setTimeout(() => { g.style.transition = ''; }, (o.delay || 0) + 600);
        } else g.style.transform = at;
        pieces.set(n, { el: g, code });
        api.describe();
      },
      remove(n) { const p = pieces.get(n); if (p) { p.el.remove(); pieces.delete(n); } },
      async setPos(pos, ctx, o = {}) {
        const keys = Object.keys(pos).sort((a, b) => fr(a)[1] - fr(b)[1] || fr(a)[0] - fr(b)[0]);
        const step = o.stagger ?? 35;
        keys.forEach((n, i) => api.place(n, pos[n], { anim: !!o.anim, delay: i * step }));
        if (o.anim && ctx) await ctx.wait(keys.length * step + 600);
      },
      async move(from, to, ctx) {
        const p = pieces.get(from); if (!p) return;
        sfx(pieces.has(to) ? 'capture' : 'move', { pan: panSq(to) });
        api.remove(to);
        const [f, r] = fr(to);
        p.el.style.transform = `translate(${f}px,${7 - r}px)`;
        pieces.delete(from); pieces.set(to, p);
        api.describe();
        if (ctx) await ctx.wait(650);
      },
      mark(list, kind, label) {
        const out = [];
        for (const n of [].concat(list)) {
          const [f, r] = fr(n), x = f, y = 7 - r;
          let m;
          if (kind === 'ring') m = el('rect', { class: 'mk ring', x: x + .06, y: y + .06, width: .88, height: .88 }, mkG);
          else if (kind === 'dot') m = el('circle', { class: 'mk dot', cx: x + .5, cy: y + .5, r: .12 }, mkG);
          else if (kind === 'name') { m = el('text', { class: 'mk name', x: x + .5, y: y + .5 }, mkG); m.textContent = label || n; }
          else if (kind === 'no') m = el('rect', { class: 'mk no', x: x + .07, y: y + .07, width: .86, height: .86 }, mkG);
          else if (kind === 'star') m = el('path', { class: 'mk star', d: [[.5, .2], [.575, .425], [.8, .5], [.575, .575], [.5, .8], [.425, .575], [.2, .5], [.425, .425]].map(([a, b], i) => (i ? 'L' : 'M') + (x + a) + ' ' + (y + b)).join('') + 'Z' }, mkG);
          else if (kind === 'sel') m = el('rect', { class: 'mk sel', x: x + .04, y: y + .04, width: .92, height: .92 }, mkG);
          else if (kind === 'cap') m = el('path', { class: 'mk cap', d: 'M0 0h.3L0 .3ZM1 0v.3L.7 0ZM0 1v-.3L.3 1ZM1 1h-.3L1 .7Z', transform: `translate(${x} ${y})` }, mkG);
          else if (kind === 'mv') m = el('circle', { class: 'mk mv', cx: x + .5, cy: y + .5, r: .14 }, mkG);
          else m = el('rect', { class: 'mk ' + kind, x, y, width: 1, height: 1 }, mkG);
          m.dataset.kind = kind; m.dataset.sq = n;
          if (kind === 'ok' || kind === 'no') setTimeout(() => m.remove(), 950);
          out.push(m);
        }
        return out;
      },
      clearMarks(kind) { [...mkG.children, ...arG.children].forEach(m => { if (!kind || m.dataset.kind === kind) m.remove(); }); },
      unmark(n, kind) { [...mkG.children].forEach(m => { if (m.dataset.sq === n && (!kind || m.dataset.kind === kind)) m.remove(); }); },
      arrow(from, to) {
        const [f1, r1] = fr(from), [f2, r2] = fr(to);
        const x1 = f1 + .5, y1 = 7 - r1 + .5, x2 = f2 + .5, y2 = 7 - r2 + .5, d = Math.hypot(x2 - x1, y2 - y1);
        const a = el('line', { class: 'mk arrow', x1, y1, x2: x2 - (x2 - x1) / d * .32, y2: y2 - (y2 - y1) / d * .32, 'marker-end': 'url(#fgAh)' }, arG);
        a.dataset.kind = 'arrow';
        return a;
      },
      clearPieces() { pcG.textContent = ''; pieces.clear(); api.describe(); },
      shake() { svg.classList.remove('shake'); svg.getBoundingClientRect(); svg.classList.add('shake'); },
      describe() {
        const w = [...pieces.values()].length;
        svg.setAttribute('aria-label', (lang === 'ko' ? '체스판' : 'Chessboard') + (w ? ` (${w} ${lang === 'ko' ? '개 기물' : 'pieces'})` : '') +
          (lang === 'ko' ? '. 방향키로 칸을 옮기고 Enter로 고르세요.' : '. Arrow keys move between squares, Enter chooses one.'));
      }
    };

    const say = n => {
      const p = pieces.get(n);
      $('boardSay').textContent = n + (p ? ', ' + (p.code[0] === 'w' ? (lang === 'ko' ? '백 ' : 'white ') : (lang === 'ko' ? '흑 ' : 'black ')) + L(INFO[TYPE[p.code[1]]].n) : '');
    };
    svg.addEventListener('click', e => {
      const r = e.target.closest('.sq'); if (!r) return;
      [cf, cr] = fr(r.dataset.sq); cur.setAttribute('x', cf + .05); cur.setAttribute('y', 7 - cr + .05);
      if (api.onSquare) api.onSquare(r.dataset.sq);
    });
    svg.addEventListener('pointerdown', () => svg.classList.remove('kbd'));
    svg.addEventListener('keydown', e => {
      svg.classList.add('kbd');
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (d) {
        e.preventDefault();
        cf = Math.max(0, Math.min(7, cf + d[0])); cr = Math.max(0, Math.min(7, cr + d[1]));
        cur.setAttribute('x', cf + .05); cur.setAttribute('y', 7 - cr + .05); say(nameOf(cf, cr));
      } else if ((e.key === 'Enter' || e.key === ' ') && api.onSquare) { e.preventDefault(); api.onSquare(nameOf(cf, cr)); }
    });
    return api;
  })();

  // ---------- the six-piece lineup ----------
  const lineup = (() => {
    const svg = $('lineup');
    const GAP = 44;
    let onPick = null;
    const api = {
      onPick: null,
      show(o = {}) {
        const rows = o.rows || ['b'];
        svg.textContent = ''; svg.removeAttribute('hidden');
        const W = ORDER.reduce((s, t) => s + FLAT[t].w, 0) + GAP * 5;
        const rowH = 254 + 80;
        svg.setAttribute('viewBox', `-24 -14 ${W + 48} ${rows.length * rowH + 4}`);
        rows.forEach((c, ri) => {
          const base = 14 + 254 + ri * rowH - 14;
          el('line', { class: 'base', x1: -24, x2: W + 24, y1: base, y2: base }, svg);
          let x = 0;
          ORDER.forEach(t => {
            const { w, h } = FLAT[t];
            const g = el('g', { class: 'li', 'data-t': t, tabindex: o.pickable ? 0 : -1, role: o.pickable ? 'button' : 'img' }, svg);
            el('rect', { class: 'hit', x: x - GAP / 2 + 4, y: base - 262, width: w + GAP - 8, height: 262 + 66 }, g);
            const sil = el('g', { class: 'sil' }, g);
            el('use', { href: '#fp-' + t, x, y: base - h, width: w, height: h, class: c === 'w' ? 'pw' : 'pb' }, sil);
            const shown = o.names === true || (o.names instanceof Set && o.names.has(t));
            if (shown) {
              const nm = el('text', { class: 'nm', x: x + w / 2, y: base + 30 }, g); nm.textContent = L(INFO[t].n);
              if (o.sub) { const ct = el('text', { class: 'ct', x: x + w / 2, y: base + 52 }, g); ct.textContent = o.sub(t); }
              else if (o.counts !== false) { const ct = el('text', { class: 'ct', x: x + w / 2, y: base + 52 }, g); ct.textContent = '× ' + INFO[t].c; }
            } else if (o.names === false || o.names instanceof Set) { const q = el('text', { class: 'q', x: x + w / 2, y: base + 38 }, g); q.textContent = '?'; }
            g.setAttribute('aria-label', shown || o.names === undefined ? L(INFO[t].n) : (lang === 'ko' ? '기물' : 'A piece'));
            if (o.done && o.done.has(t)) g.classList.add('ok');
            x += w + GAP;
          });
        });
        onPick = o.onPick || null;
      },
      hide() { svg.setAttribute('hidden', ''); onPick = null; }
    };
    const fire = e => { const g = e.target.closest('.li'); if (g && onPick) { sfx('select'); onPick(g.dataset.t, g); } };
    svg.addEventListener('click', fire);
    svg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(e); } });
    return api;
  })();

  // ---------- the tray of pieces to place ----------
  const tray = (() => {
    const box = $('tray');
    let sel = null, onPlace = null, ghost = null;
    const svgFor = code => {
      const t = TYPE[code[1]];
      return `<svg viewBox="0 0 ${FLAT[t].w} ${FLAT[t].h}" aria-hidden="true"><use href="#fp-${t}" class="${code[0] === 'w' ? 'pw' : 'pb'}"/></svg>`;
    };
    const select = b => { if (b && b !== sel) sfx('select'); [...box.children].forEach(x => x.classList.toggle('sel', x === b)); sel = b; };
    const tryPlace = (b, n) => {
      if (!b || !onPlace) return;
      if (onPlace(b.dataset.code, n)) { b.classList.add('used'); b.disabled = true; select(null); }
    };
    box.addEventListener('pointerdown', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      e.preventDefault(); select(b);
      const x0 = e.clientX, y0 = e.clientY;
      b.setPointerCapture(e.pointerId);
      const move = ev => {
        if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) {
          ghost = document.createElement('div'); ghost.className = 'ghost-pc'; ghost.innerHTML = svgFor(b.dataset.code); document.body.appendChild(ghost);
        }
        if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; }
      };
      const up = ev => {
        b.removeEventListener('pointermove', move); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up);
        if (ghost) {
          ghost.remove(); ghost = null;
          const t = document.elementFromPoint(ev.clientX, ev.clientY);
          const s = t && t.closest && t.closest('.sq');
          if (s) tryPlace(b, s.dataset.sq);
        }
      };
      b.addEventListener('pointermove', move); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    });
    box.addEventListener('keydown', e => { const b = e.target.closest('button'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(b); } });
    return {
      show(codes, fn) {
        onPlace = fn; sel = null; box.hidden = false;
        box.innerHTML = codes.map(c => `<button type="button" data-code="${c}" aria-label="${(lang === 'ko' ? '백 ' : 'White ') + L(INFO[TYPE[c[1]]].n)}">${svgFor(c)}</button>`).join('');
      },
      square(n) { if (sel) { tryPlace(sel, n); return true; } return false; },
      selected: () => sel && sel.dataset.code,
      hide() { box.hidden = true; box.textContent = ''; onPlace = null; sel = null; }
    };
  })();


  // ---------- playing moves on the lesson board ----------
  const R = window.FG_RULES;
  const PN = code => INFO[TYPE[code[1]]].n;              // {en, ko} name of a piece code
  const pn = code => L(PN(code)).toLowerCase();
  const PROMO = [{ t: P('Queen', '퀸'), v: 'Q' }, { t: P('Rook', '룩'), v: 'R' }, { t: P('Bishop', '비숍'), v: 'B' }, { t: P('Knight', '나이트'), v: 'N' }];
  // Click a piece to see its moves (dots, corner marks on captures), click a dot to move.
  // o: st, side, keepTurn, placed, movable(sq), notThis, onSelect(sq, moves), onMove(m, after, before) -> 'ok'|'undo'|'stop',
  //    reply(st) -> [from, to], promo: 'ask' | 'Q'
  function play(c, o) {
    let g = o.st, sel = null, moves = [], busy = false;
    const side = o.side || 'w';
    if (!o.placed) board.setPos(g.pos);
    const clearSel = () => { ['sel', 'mv', 'cap'].forEach(k => board.clearMarks(k)); sel = null; moves = []; };
    const select = n => {
      clearSel(); sel = n; moves = R.legal(g, n);
      sfx('select', { pan: panSq(n) });
      board.mark(n, 'sel');
      moves.forEach(m => board.mark(m.to, m.capture ? 'cap' : 'mv'));
      if (o.onSelect) o.onSelect(n, moves);
      else if (!moves.length) c.say(R.inCheck(g.pos, side)
        ? P(`Your king is in check, and this ${PN(g.pos[n]).en.toLowerCase()} can’t help. Try another piece.`, `킹이 체크를 당하고 있는데, 이 ${PN(g.pos[n]).ko}${jo(PN(g.pos[n]).ko, '은', '는')} 막을 수 없어요. 다른 기물을 골라 보세요.`)
        : P(`This ${PN(g.pos[n]).en.toLowerCase()} has no move right now.`, `이 ${PN(g.pos[n]).ko}${jo(PN(g.pos[n]).ko, '은', '는')} 지금 움직일 수 없어요.`));
    };
    const askPromo = () => new Promise(res => {
      c.setTask(P('Your pawn reached the end. What should it become?', '폰이 끝까지 왔어요. 무엇으로 바꿀까요?'));
      c.choices(PROMO, v => { c.clearChoices(); res(v); });
    });
    async function animate(m) {
      board.move(m.from, m.to);
      if (m.ep) { board.remove(m.ep); sfx('capture', { pan: panSq(m.to) }); }
      if (m.rook) { board.move(m.rook[0], m.rook[1]); sfx('place', { pan: panSq(m.rook[1]), delay: .2 }); }
      await c.wait(650);
      if (m.promo) { board.place(m.to, m.piece[0] + (m.promoTo || 'Q'), { anim: true }); sfx('promote'); await c.wait(500); }
    }
    async function go(m) {
      busy = true; clearSel();
      if (m.promo) m = Object.assign({}, m, { promoTo: o.promo === 'ask' ? await askPromo() : 'Q' });
      const before = g, after = R.apply(g, m, { keepTurn: o.keepTurn });
      await animate(m);
      if (!o.keepTurn && R.inCheck(after.pos, after.turn) && R.status(after) !== 'mate') sfx('check');
      const res = o.onMove ? await o.onMove(m, after, before) : 'ok';
      if (res === 'undo') { await c.wait(900); g = before; board.clearPieces(); board.clearMarks('arrow'); board.setPos(g.pos); busy = false; return; }
      g = after;
      if (res === 'stop') { board.onSquare = null; return; }
      if (o.reply && R.allLegal(g).length) {
        const r = o.reply(g);
        const rm = r && R.legal(g, r[0]).find(x => x.to === r[1]);
        if (rm) { await c.wait(500); await animate(rm); g = R.apply(g, rm); if (o.afterReply) o.afterReply(rm, g); }
      }
      busy = false;
    }
    board.onSquare = n => {
      if (busy) return;
      const p = g.pos[n];
      if (sel) { const m = moves.find(x => x.to === n); if (m) return go(m); }
      if (p && p[0] === side) {
        if (!o.keepTurn && g.turn !== side) return;
        if (o.movable && !o.movable(n)) { clearSel(); c.say(o.notThis || P('Use the other piece for this task.', '이번 과제에서는 다른 기물을 쓰세요.')); return; }
        return select(n);
      }
      if (sel) {
        const pm = R.pseudo(g, sel).find(x => x.to === n);
        const what = PN(g.pos[sel]);
        if (pm) c.bad(g.pos[sel][1] === 'K'
          ? P('The king can’t go there: that square is attacked.', '킹은 거기로 갈 수 없어요. 그 칸은 공격받고 있어요.')
          : P('That move would leave your king in check.', '그렇게 두면 내 킹이 체크 상태로 남아요.'));
        else c.bad(P(`The ${what.en.toLowerCase()} can’t move there.`, `${what.ko}${jo(what.ko, '은', '는')} 거기로 갈 수 없어요.`));
        clearSel(); return;
      }
      c.say(p ? P(side === 'w' ? 'That is a black piece. You play White.' : 'That is a white piece. You play Black.', side === 'w' ? '그건 흑 기물이에요. 나는 백이에요.' : '그건 백 기물이에요. 나는 흑이에요.')
              : P('Click one of your pieces first.', '먼저 내 기물을 클릭하세요.'));
    };
    return { get st() { return g; }, set(st) { g = st; clearSel(); board.clearPieces(); board.setPos(st.pos); } };
  }

  // fewest moves to land on every star (one piece, fixed blockers), by breadth-first search
  function parFor(piece, from, stars, extra) {
    const goal = (1 << stars.length) - 1, seen = new Set([from + ':0']);
    let frontier = [[from, 0]];
    for (let d = 1; d < 30 && frontier.length; d++) {
      const next = [];
      for (const [at, mask] of frontier) {
        const st = R.state(Object.assign({ [at]: piece }, extra));
        for (const m of R.legal(st, at)) {
          const i = stars.indexOf(m.to), nm = i < 0 ? mask : mask | (1 << i);
          if (nm === goal) return d;
          const k = m.to + ':' + nm;
          if (!seen.has(k) && !(m.promo)) { seen.add(k); next.push([m.to, nm]); }
        }
      }
      frontier = next;
    }
    return 99;
  }
  // a piece hunting stars: land on each one, in any order
  function starHunt(c, piece, from, stars, extra = {}) {
    const par = parFor(piece, from, stars, extra);
    const left = new Set(stars);
    let n = 0;
    board.setPos(Object.assign({ [from]: piece }, extra));
    stars.forEach(s => board.mark(s, 'star'));
    const upd = () => c.setTask(P(`Land on every star. <b>${left.size}</b> left · ${n} move${n === 1 ? '' : 's'} so far (best: ${par}).`,
      `별이 있는 칸에 모두 착지하세요. 남은 별 <b>${left.size}</b>개 · 지금까지 ${n}수 (최소 ${par}수).`));
    upd();
    play(c, { st: R.state(Object.assign({ [from]: piece }, extra)), keepTurn: true, placed: true, onMove: m => {
      n++;
      if (left.has(m.to)) { left.delete(m.to); board.unmark(m.to, 'star'); board.mark(m.to, 'ok'); sfx('star', { pan: panSq(m.to) }); }
      upd();
      if (!left.size) {
        c.good(n <= par ? P(`Every star in ${n} moves: the fewest possible.`, `${n}수 만에 별을 모두 잡았어요. 가장 짧은 방법이에요.`)
          : P(`Every star in ${n} moves. It can be done in ${par}: press Back, then Next, to try again.`, `${n}수 만에 별을 모두 잡았어요. ${par}수로도 가능해요. 이전, 다음을 누르면 다시 해 볼 수 있어요.`));
        c.done(); return 'stop';
      }
      return 'ok';
    } });
  }
  // a short demo: plays [from, to] moves with arrows
  async function demo(c, st, list, o = {}) {
    let g = st;
    for (const [f, t] of list) {
      const m = R.legal(g, f).find(x => x.to === t) || R.pseudo(g, f).find(x => x.to === t);
      if (!m) continue;
      board.clearMarks('arrow'); board.arrow(f, t);
      await c.wait(o.pause || 700);
      board.move(f, t); if (m.ep) board.remove(m.ep); if (m.rook) board.move(m.rook[0], m.rook[1]);
      await c.wait(650);
      if (m.promo) { board.place(t, m.piece[0] + 'Q', { anim: true }); await c.wait(450); }
      g = R.apply(g, m);
    }
    return g;
  }
  // multiple-choice rounds; each item: { setup(), q, opts, a, ok }
  function rounds(c, items, wrong) {
    let i = 0;
    const show = () => {
      const it = items[i];
      board.clearMarks(); if (it.setup) it.setup();
      c.setTask(P(`${it.q.en} (${i + 1} of ${items.length})`, `${it.q.ko} (${items.length}개 중 ${i + 1}번째)`));
      c.choices(it.opts, async (v, b) => {
        if (v !== it.a) { b.classList.add('wrong'); c.bad(it.no || wrong); return; }
        b.classList.add('right'); c.good(it.ok || P('Correct.', '정답이에요.')); c.clearChoices();
        i++;
        await c.wait(1300);
        if (i === items.length) { c.setTask(P(`${items.length} out of ${items.length}.`, `${items.length}문제 모두 맞혔어요.`)); c.done(); }
        else show();
      });
    };
    show();
  }
  // the player must play a fixed line [mine, reply, mine, reply, ...]; the other side answers by itself
  function line(c, st, moves, side = 'w', o = {}) {
    let k = 0;
    const finish = () => { c.setTask(o.end || P('Line complete.', '수순을 모두 뒀어요.')); c.good(o.done || P('Well played.', '잘 뒀어요.')); c.done(); };
    const ask = g => {
      const [f, t] = moves[k], m = R.legal(g, f).find(x => x.to === t), n = R.san(g, m);
      c.setTask(P(`Play <b>${n}</b>.`, `<b>${n}</b>${jo(n, '을', '를')} 두세요.`));
    };
    ask(st);
    return play(c, { st, side,
      onMove: (m, aft, before) => {
        const [f, t] = moves[k];
        if (m.from !== f || m.to !== t) {
          const a = R.san(before, m), b = R.san(before, R.legal(before, f).find(x => x.to === t));
          c.bad(P(`That is ${a}. The task asks for <b>${b}</b>.`, `그건 ${a}${jo(a, '이에요', '예요')}. 과제는 <b>${b}</b>${jo(b, '이에요', '예요')}.`));
          return 'undo';
        }
        if (k + 1 >= moves.length) { finish(); return 'stop'; }
        c.say(P(`${R.san(before, m)}. Now the other side answers.`, `${R.san(before, m)}. 이제 상대가 둬요.`));
        return 'ok';
      },
      reply: () => moves[k + 1],
      afterReply: (rm, g) => { k += 2; if (k >= moves.length) finish(); else ask(g); }
    });
  }
  // build a state from a move list starting at the initial position
  const after = (list, o = {}) => {
    let g = R.state(START, { castle: 'KQkq' });
    for (const [f, t] of list) { const m = R.legal(g, f).find(x => x.to === t); g = R.apply(g, m); }
    return Object.assign(g, o);
  };
  const pos = (s, o) => R.state(s, o);

  // ---------- the course ----------
  const CHAPTERS = [
    { n: 1, t: P('The board', '체스판'), d: P('How the board is built, how to turn it, and the name of every square.', '체스판의 생김새, 놓는 방향, 칸마다 붙은 이름을 배워요.'), lessons: [1, 2, 3] },
    { n: 2, t: P('The pieces', '기물'), d: P('Meet the six pieces, set them up, and learn who moves when.', '여섯 가지 기물을 만나고, 시작 자리에 놓고, 차례를 배워요.'), lessons: [4, 5, 6] },
    { n: 3, t: P('How pieces move', '기물의 움직임'), d: P('One piece at a time, with a small game for each.', '기물 하나씩, 작은 게임과 함께 움직임을 익혀요.'), lessons: [7, 8, 9, 10, 11, 12] },
    { n: 4, t: P('The goal of the game', '게임의 목표'), d: P('What pieces are worth, check, checkmate and draws.', '기물의 가치, 체크, 체크메이트, 무승부를 배워요.'), lessons: [13, 14, 15, 16] },
    { n: 5, t: P('Special moves', '특별한 규칙'), d: P('Three rules that surprise every beginner.', '처음 배우는 사람이 꼭 놀라는 세 가지 규칙이에요.'), lessons: [17, 18, 19] },
    { n: 6, t: P('Your first game', '첫 게임'), d: P('Opening rules, simple checkmates, notation and the Queen’s Gambit.', '오프닝 원칙, 기본 체크메이트, 기보 읽기, 퀸스 갬빗까지.'), lessons: [20, 21, 22, 23] }
  ];
  const TOTAL = 23;

  // ---------- the lessons ----------
  const LESSONS = {};
  const chapterOf = id => CHAPTERS.find(c => c.lessons && c.lessons.includes(id));

  // Lesson 1: meet the board
  LESSONS[1] = { t: P('Meet the board', '체스판 만나기'), steps: [
    { text: P('This is a chessboard. It is one big square made of <b>64 small squares</b>: 8 across and 8 up.',
        '이게 체스판이에요. 작은 칸 <b>64개</b>가 모여 만든 큰 정사각형이에요. 가로로 8칸, 세로로 8칸이에요.'),
      async run(c) { board.reset({ hidden: true, labels: false }); await board.reveal(c); } },
    { text: P('The squares are <b>light</b> and <b>dark</b>, and they take turns, like a checkerboard. Two squares of the same colour never sit side by side.',
        '칸은 <b>밝은 칸</b>과 <b>어두운 칸</b>이 번갈아 놓여 있어요. 같은 색 칸끼리는 절대 옆으로 나란히 붙지 않아요.'),
      task: P('Click any <b>dark</b> square.', '<b>어두운 칸</b>을 아무거나 클릭해 보세요.'),
      hint: P('The dark squares are the grey ones.', '회색으로 칠해진 칸이 어두운 칸이에요.'),
      run(c) {
        board.reset({ labels: false });
        board.onSquare = n => {
          if (!isLight(n)) { board.mark(n, 'ok'); c.good(P('Yes, that is a dark square.', '맞아요, 어두운 칸이에요.')); c.done(); }
          else { board.mark(n, 'no'); c.bad(P('That one is light. Try a grey square.', '그 칸은 밝은 칸이에요. 회색 칸을 골라 보세요.')); }
        };
      } },
    { text: P('Before a game, turn the board so that the <b>corner square on your right is light</b>. An easy way to remember it: <b>light on the right</b>.',
        '게임 전에는 <b>내 오른쪽 구석 칸이 밝은 칸</b>이 되도록 판을 놓아요. 이렇게 외우면 쉬워요. <b>오른쪽 구석은 밝은 칸.</b>'),
      task: P('This board is turned the wrong way. Press <b>Turn the board</b> until the marked corner on your right is light.',
        '이 체스판은 잘못 놓여 있어요. 표시된 오른쪽 구석 칸이 밝은 칸이 될 때까지 <b>판 돌리기</b>를 눌러 보세요.'),
      hint: P('Look at the dashed corner at the bottom right. It should end up white.', '오른쪽 아래 점선 칸을 보세요. 그 칸이 흰색이 되면 돼요.'),
      run(c) {
        board.reset({ labels: false, rotate: 90 }); board.corner(true); c.youSit(true);
        let deg = 90, busy = false;
        c.choices([{ t: P('Turn the board ↻', '판 돌리기 ↻'), v: 'turn' }], async () => {
          if (busy) return; busy = true;
          deg += 90; board.rotate(deg);
          await c.wait(760); busy = false;
          if (deg % 180 === 0) { c.good(P('Light on the right. The board is ready.', '오른쪽 구석이 밝은 칸이에요. 이제 판이 바르게 놓였어요.')); c.clearChoices(); c.done(); }
          else c.say(P('The corner is still dark. Turn it again.', '구석 칸이 아직 어두워요. 한 번 더 돌려 보세요.'));
        }, true);
      } },
    { text: P('A quick check before we go on.', '다음으로 넘어가기 전에 잠깐 확인해 볼게요.'),
      task: P('How many squares does a chessboard have?', '체스판에는 칸이 몇 개 있을까요?'),
      hint: P('8 across times 8 up.', '가로 8칸 곱하기 세로 8칸이에요.'),
      run(c) {
        board.reset({ labels: false });
        c.quiz([{ t: '32', v: 32 }, { t: '64', v: 64 }, { t: '100', v: 100 }], 64,
          P('Right: 8 × 8 = 64.', '맞아요. 8 × 8 = 64예요.'),
          P('Not quite. Count one row (8) and one column (8), then multiply.', '아쉬워요. 가로 한 줄(8칸)과 세로 한 줄(8칸)을 세어서 곱해 보세요.'));
      } },
    { text: P('Two players sit on opposite sides of the board. <b>White</b> starts at the bottom, near you, and <b>Black</b> at the top. Next, you will learn the name of every square.',
        '두 사람이 체스판을 사이에 두고 마주 앉아요. <b>백</b>은 내 쪽인 아래에서, <b>흑</b>은 위에서 시작해요. 다음 레슨에서는 칸마다 붙은 이름을 배워요.'),
      async run(c) { board.reset({ labels: false }); c.youSit(true); await board.setPos(START, c, { anim: true, stagger: 22 }); } }
  ] };

  // Lesson 2: names of the squares
  const fileTask = (target) => ({
    text: P('The lines of squares that run up the board are called <b>files</b>. Each file has a letter, <b>a to h</b>, from left to right.',
      '위아래로 이어진 세로줄을 <b>파일(file)</b>이라고 해요. 왼쪽부터 <b>a부터 h까지</b> 알파벳 이름이 붙어 있어요.'),
    task: P(`Click any square on the <b>${target}</b>-file.`, `<b>${target}</b> 파일에 있는 칸을 아무거나 클릭해 보세요.`),
    hint: P(`Find the letter ${target} under the board, then click any square straight above it.`, `체스판 아래에서 ${target} 글자를 찾고, 그 바로 위에 있는 칸을 아무거나 누르세요.`),
    run(c) {
      board.reset(); board.emph(FILES);
      board.onSquare = n => {
        board.clearMarks('hl');
        const col = [1, 2, 3, 4, 5, 6, 7, 8].map(r => n[0] + r);
        board.mark(col, 'hl');
        if (n[0] === target) { c.good(P(`Yes: <b>${n}</b> is on the ${target}-file. The whole column is the ${target}-file.`, `맞아요. <b>${n}</b>${jo(n, '은', '는')} ${target} 파일에 있어요. 이 세로줄 전체가 ${target} 파일이에요.`)); c.done(); }
        else c.bad(P(`That square is on the <b>${n[0]}</b>-file. Look for the letter ${target} under the board.`, `그 칸은 <b>${n[0]}</b> 파일이에요. 체스판 아래에서 ${target} 글자를 찾아보세요.`));
      };
    }
  });
  LESSONS[2] = { t: P('Names of the squares', '칸의 이름'), steps: [
    fileTask('e'),
    { text: P('The lines that run across are called <b>ranks</b>. They are numbered <b>1 to 8</b>, starting from White’s side at the bottom.',
        '가로로 이어진 줄은 <b>랭크(rank)</b>라고 해요. 아래쪽 백의 자리부터 <b>1부터 8까지</b> 번호가 붙어 있어요.'),
      task: P('Click any square on <b>rank 4</b>.', '<b>4 랭크</b>에 있는 칸을 아무거나 클릭해 보세요.'),
      hint: P('Find the number 4 on the left side of the board, then click any square in that row.', '체스판 왼쪽에서 숫자 4를 찾고, 그 가로줄에 있는 칸을 아무거나 누르세요.'),
      run(c) {
        board.reset(); board.emph('', [1, 2, 3, 4, 5, 6, 7, 8]);
        board.onSquare = n => {
          board.clearMarks('hl');
          board.mark([...FILES].map(f => f + n[1]), 'hl');
          if (n[1] === '4') { c.good(P(`Yes: <b>${n}</b> is on rank 4. The whole row is rank 4.`, `맞아요. <b>${n}</b>${jo(n, '은', '는')} 4 랭크에 있어요. 이 가로줄 전체가 4 랭크예요.`)); c.done(); }
          else c.bad(P(`That square is on rank <b>${n[1]}</b>. Look for the number 4 on the left.`, `그 칸은 <b>${n[1]}</b> 랭크예요. 왼쪽에서 숫자 4를 찾아보세요.`));
        };
      } },
    { text: P('Put the two together and every square gets its own name: <b>the file letter first, then the rank number</b>. Where the e-file meets rank 4 is the square <b>e4</b>.',
        '두 가지를 합치면 칸마다 이름이 생겨요. <b>파일 알파벳을 먼저, 랭크 숫자를 나중에</b> 읽어요. e 파일과 4 랭크가 만나는 칸이 바로 <b>e4</b>예요.'),
      async run(c) {
        board.reset(); board.emph('e', [4]);
        board.mark([1, 2, 3, 5, 6, 7, 8].map(r => 'e' + r), 'hl');
        board.mark(['a', 'b', 'c', 'd', 'f', 'g', 'h'].map(f => f + 4), 'hl');
        await c.wait(500);
        board.mark('e4', 'hl2'); board.mark('e4', 'name');
        for (const n of ['a1', 'h1', 'a8', 'h8']) { await c.wait(350); board.mark(n, 'name'); }
      } },
    { text: P('Now find the squares by their names.', '이제 이름만 듣고 칸을 찾아볼게요.'),
      task: P('Click the square Pawn asks for.', 'Pawn이 부르는 칸을 클릭하세요.'),
      hint: P('Letter first: go along the bottom to the letter. Then go up to the number.', '알파벳이 먼저예요. 아래쪽에서 알파벳을 찾고, 그 줄을 따라 숫자만큼 올라가세요.'),
      run(c) {
        board.reset();
        const all = []; for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) all.push(nameOf(f, r));
        const goals = shuffle(all.filter(n => !['e4'].includes(n))).slice(0, 5);
        let i = 0;
        const ask = () => c.setTask(P(`Find <b>${goals[i]}</b>. (${i + 1} of 5)`, `<b>${goals[i]}</b>${jo(goals[i], '을', '를')} 찾아보세요. (5개 중 ${i + 1}번째)`));
        ask();
        board.onSquare = n => {
          if (i >= goals.length) return;
          const g = goals[i];
          if (n === g) {
            board.mark(n, 'ok'); board.mark(n, 'name'); i++;
            if (i === goals.length) { c.setTask(P('All five found.', '다섯 칸을 모두 찾았어요.')); c.good(P('You can read the board now.', '이제 체스판을 읽을 수 있어요.')); c.done(); }
            else { c.good(P(`Yes, that is ${g}.`, `맞아요, ${g}${jo(g, '이에요', '예요')}.`)); ask(); }
          } else {
            board.mark(n, 'no');
            c.bad(P(`That is <b>${n}</b>. For <b>${g}</b>, find the letter ${g[0]} at the bottom, then go up to ${g[1]}.`, `거긴 <b>${n}</b>${jo(n, '이에요', '예요')}. <b>${g}</b>${jo(g, '은', '는')} 아래쪽 ${g[0]}에서 ${g[1]}까지 올라간 칸이에요.`));
          }
        };
      } },
    { text: P('Every square on the board has a name like these. Chess players use them to write down every move of a game.',
        '체스판의 모든 칸에는 이렇게 이름이 있어요. 체스를 두는 사람들은 이 이름으로 게임의 모든 수를 기록해요.'),
      async run(c) {
        board.reset();
        for (let s = 0; s < 15; s++) {
          for (let f = 0; f < 8; f++) { const r = s - f; if (r >= 0 && r < 8) board.mark(nameOf(f, r), 'name'); }
          await c.wait(55);
        }
      } }
  ] };

  // Lesson 3: ranks, files and diagonals
  const LINES = {
    rank6: { sq: [...FILES].map(f => f + 6), v: 'rank' },
    fileG: { sq: [1, 2, 3, 4, 5, 6, 7, 8].map(r => 'g' + r), v: 'file' },
    diagC1: { sq: ['c1', 'd2', 'e3', 'f4', 'g5', 'h6'], v: 'diag' },
    diagA5: { sq: ['a5', 'b6', 'c7', 'd8'], v: 'diag' },
    rank2: { sq: [...FILES].map(f => f + 2), v: 'rank' },
    fileB: { sq: [1, 2, 3, 4, 5, 6, 7, 8].map(r => 'b' + r), v: 'file' }
  };
  const sweep = async (c, list, kind = 'hl', ms = 60) => { for (const n of list) { board.mark(n, kind); await c.wait(ms); } };
  LESSONS[3] = { t: P('Ranks, files and diagonals', '가로줄, 세로줄, 대각선'), steps: [
    { text: P('A <b>rank</b> is a row of squares going across the board, from one side to the other.',
        '<b>랭크</b>는 체스판을 가로지르는 가로줄이에요. 한쪽 끝에서 반대쪽 끝까지 이어져요.'),
      async run(c) { board.reset(); board.emph('', [3]); await sweep(c, [...FILES].map(f => f + 3)); } },
    { text: P('A <b>file</b> is a column of squares going up the board, from White’s side to Black’s side.',
        '<b>파일</b>은 위아래로 이어진 세로줄이에요. 백 쪽에서 흑 쪽까지 이어져요.'),
      async run(c) { board.reset(); board.emph('c'); await sweep(c, [1, 2, 3, 4, 5, 6, 7, 8].map(r => 'c' + r)); } },
    { text: P('A <b>diagonal</b> is a slanting line of squares that touch only at their corners. Look closely: every square on a diagonal has the same colour.',
        '<b>대각선</b>은 모서리끼리만 닿으며 비스듬히 이어진 칸들이에요. 잘 보면 대각선 위의 칸은 모두 같은 색이에요.'),
      async run(c) { board.reset(); await sweep(c, ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8'], 'hl2', 90); await sweep(c, ['b8', 'c7', 'd6', 'e5', 'f4', 'g3', 'h2'].filter(n => n !== 'e5'), 'hl', 90); } },
    { text: P('Can you tell them apart?', '셋을 구별할 수 있나요?'),
      task: P('Is the marked line a rank, a file or a diagonal?', '표시된 줄은 랭크, 파일, 대각선 중 무엇일까요?'),
      hint: P('Across is a rank, up is a file, slanting is a diagonal.', '가로는 랭크, 세로는 파일, 비스듬하면 대각선이에요.'),
      run(c) {
        board.reset();
        const rounds = shuffle(['rank6', 'fileG', 'diagC1', 'diagA5']);
        let i = 0;
        const show = () => {
          board.clearMarks(); board.mark(LINES[rounds[i]].sq, 'hl2');
          c.setTask(P(`Is the marked line a rank, a file or a diagonal? (${i + 1} of 4)`, `표시된 줄은 랭크, 파일, 대각선 중 무엇일까요? (4개 중 ${i + 1}번째)`));
          c.choices([{ t: P('Rank', '랭크'), v: 'rank' }, { t: P('File', '파일'), v: 'file' }, { t: P('Diagonal', '대각선'), v: 'diag' }], async (v, b) => {
            if (v === LINES[rounds[i]].v) {
              b.classList.add('right'); c.good(P('Correct.', '정답이에요.'));
              i++;
              await c.wait(800);
              if (i === rounds.length) { c.clearChoices(); board.clearMarks(); c.setTask(P('Four out of four.', '네 문제 모두 맞혔어요.')); c.done(); }
              else show();
            } else { b.classList.add('wrong'); c.bad(P('Not that one. Across is a rank, up is a file, slanting is a diagonal.', '그건 아니에요. 가로는 랭크, 세로는 파일, 비스듬하면 대각선이에요.')); }
          });
        };
        show();
      } },
    { text: P('One more. The marked square is <b>c1</b>.', '하나 더 해 볼게요. 표시된 칸은 <b>c1</b>이에요.'),
      task: P('Click a square on the same <b>diagonal</b> as c1.', 'c1과 같은 <b>대각선</b> 위에 있는 칸을 클릭하세요.'),
      hint: P('From c1, step one square up and to the side, corner to corner: b2 or d2 is a good start.', 'c1에서 모서리를 따라 위쪽 옆 칸으로 한 칸씩 가 보세요. b2나 d2부터 시작하면 돼요.'),
      run(c) {
        board.reset(); board.mark('c1', 'ring'); board.mark('c1', 'name');
        const diag = ['b2', 'a3', 'd2', 'e3', 'f4', 'g5', 'h6'];
        board.onSquare = async n => {
          if (diag.includes(n)) {
            board.mark(n, 'ok'); c.good(P(`Yes, ${n} is on a diagonal with c1. c1 has two diagonals, shown here.`, `맞아요. ${n}${jo(n, '은', '는')} c1과 같은 대각선에 있어요. c1에는 대각선이 두 개 있어요.`));
            board.onSquare = null; c.done();
            await sweep(c, ['b2', 'a3'], 'hl', 80); await sweep(c, ['d2', 'e3', 'f4', 'g5', 'h6'], 'hl', 80);
          } else if (n !== 'c1') { board.mark(n, 'no'); c.bad(P('That square is not on a diagonal with c1. Go corner to corner, and stay on dark squares.', '그 칸은 c1과 같은 대각선이 아니에요. 모서리를 따라가고, 어두운 칸만 밟아 보세요.')); }
        };
      } },
    { text: P('These lines are the roads that pieces travel on. The rook uses ranks and files, the bishop uses diagonals, and the queen, shown here, uses all of them. You will see each piece move in Chapter 3.',
        '이 줄들은 기물이 다니는 길이에요. 룩은 랭크와 파일을, 비숍은 대각선을 다니고, 여기 보이는 퀸은 모든 길을 다녀요. 3장에서 기물 하나하나의 움직임을 배워요.'),
      async run(c) {
        board.reset(); board.place('d4', 'wQ', { anim: true });
        await c.wait(500);
        const out = [];
        for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]])
          for (let k = 1; k < 8; k++) { const f = 3 + df * k, r = 3 + dr * k; if (f < 0 || f > 7 || r < 0 || r > 7) break; out.push([k, nameOf(f, r)]); }
        for (let k = 1; k < 8; k++) { out.filter(o => o[0] === k).forEach(o => board.mark(o[1], 'dot')); await c.wait(90); }
      } }
  ] };

  // Lesson 4: the six pieces
  LESSONS[4] = { t: P('Six pieces', '여섯 가지 기물'), steps: [
    { text: P('Each player has <b>16 pieces</b> of six kinds. From the smallest to the tallest: pawn, knight, bishop, rook, queen and king.',
        '각자 <b>16개</b>의 기물을 가지고 시작해요. 종류는 여섯 가지예요. 작은 것부터 폰, 나이트, 비숍, 룩, 퀸, 킹이에요.'),
      run(c) { c.stage('lineup'); lineup.show({ names: true }); } },
    { text: P('Let’s meet them one by one.', '하나씩 만나 볼게요.'),
      task: P('Click each of the six pieces.', '기물 여섯 개를 하나씩 클릭해 보세요.'),
      hint: P('Click any piece you have not met yet.', '아직 만나지 않은 기물을 눌러 보세요.'),
      run(c) {
        c.stage('lineup');
        const met = new Set();
        const draw = () => lineup.show({ names: true, pickable: true, done: met, onPick: t => {
          met.add(t); draw();
          c.say(P(`${INFO[t].d.en} (${met.size} of 6)`, `${INFO[t].d.ko} (6개 중 ${met.size}개)`));
          if (met.size === 6) c.done();
        } });
        draw();
      } },
    { text: P('Now without the names.', '이번에는 이름 없이 찾아볼게요.'),
      task: P('Find the piece Pawn asks for.', 'Pawn이 부르는 기물을 찾아보세요.'),
      run(c) {
        c.stage('lineup');
        const goals = shuffle(ORDER); let i = 0;
        const found = new Set();
        const ask = () => c.setTask(P(`Find the <b>${INFO[goals[i]].n.en.toLowerCase()}</b>. (${i + 1} of 6)`, `<b>${INFO[goals[i]].n.ko}</b>${jo(INFO[goals[i]].n.ko, '을', '를')} 찾아보세요. (6개 중 ${i + 1}번째)`));
        const draw = () => lineup.show({ names: found, counts: false, pickable: true, done: found, onPick: t => {
          if (i >= goals.length) return;
          if (t === goals[i]) {
            found.add(t); i++; draw();
            if (i === goals.length) { c.setTask(P('All six found.', '여섯 개를 모두 찾았어요.')); c.good(P('You know every piece now.', '이제 모든 기물을 알아요.')); c.done(); }
            else { c.good(P(`Yes, that is the ${INFO[t].n.en.toLowerCase()}.`, `맞아요, ${INFO[t].n.ko}${jo(INFO[t].n.ko, '이에요', '예요')}.`)); ask(); }
          } else if (found.has(t)) c.say(P(`You already found the ${INFO[t].n.en.toLowerCase()}.`, `${INFO[t].n.ko}${jo(INFO[t].n.ko, '은', '는')} 이미 찾았어요.`));
          else c.bad(P(`That is the ${INFO[t].n.en.toLowerCase()}. ${INFO[goals[i]].s.en}`, `그건 ${INFO[t].n.ko}${jo(INFO[t].n.ko, '이에요', '예요')}. ${INFO[goals[i]].s.ko}`));
        } });
        c.hint(() => INFO[goals[Math.min(i, 5)]].s);
        ask(); draw();
      } },
    { text: P('Both players have the same set, one in <b>White</b> and one in <b>Black</b>. The pieces look alike and move alike. Only the colour tells you whose they are.',
        '두 사람은 똑같은 기물 세트를 하나씩 가져요. 한 사람은 <b>백(흰색)</b>, 다른 사람은 <b>흑(검은색)</b>이에요. 모양도 움직임도 같고, 색깔로만 누구 것인지 구별해요.'),
      run(c) { c.stage('lineup'); lineup.show({ rows: ['w', 'b'], names: true, counts: false }); } }
  ] };

  // Lesson 5: the starting position
  const backRank = (pos, types, ranks = [1, 8]) => {
    const out = {};
    for (const [n, code] of Object.entries(START)) if (ranks.includes(+n[1]) && types.includes(code[1])) out[n] = code;
    return Object.assign({}, pos, out);
  };
  const PAWNS = pick(START, (n, c) => c[1] === 'P');
  const PLACE_HINT = {
    R: P('Rooks go in the corners: a1 and h1.', '룩은 구석에 놓아요. a1과 h1이에요.'),
    N: P('Knights stand next to the rooks: b1 and g1.', '나이트는 룩 바로 옆, b1과 g1에 놓아요.'),
    B: P('Bishops stand next to the knights: c1 and f1.', '비숍은 나이트 옆, c1과 f1에 놓아요.'),
    Q: P('The queen goes on her own colour. The white queen stands on the light square <b>d1</b>.', '퀸은 자기 색 칸에 놓아요. 백 퀸은 밝은 칸 <b>d1</b>에 서요.'),
    K: P('The king takes the last square, <b>e1</b>, next to the queen.', '킹은 퀸 옆에 남은 마지막 칸, <b>e1</b>에 놓아요.')
  };
  LESSONS[5] = { t: P('The starting position', '시작 자리'), steps: [
    { text: P('Time to set up the board. First the <b>pawns</b>: all eight stand on the second rank. White’s go on rank 2, Black’s on rank 7.',
        '이제 기물을 놓아 볼게요. 먼저 <b>폰</b>이에요. 8개 모두 두 번째 줄에 서요. 백은 2 랭크, 흑은 7 랭크예요.'),
      async run(c) { board.reset(); board.emph('', [2, 7]); await board.setPos(PAWNS, c, { anim: true, stagger: 45 }); } },
    { text: P('Behind the pawns is the back rank. The <b>rooks</b> take the corners, the <b>knights</b> stand next to them, and the <b>bishops</b> next to the knights.',
        '폰 뒤의 맨 끝 줄을 채워요. <b>룩</b>은 구석에, <b>나이트</b>는 룩 옆에, <b>비숍</b>은 나이트 옆에 서요.'),
      async run(c) {
        board.reset(); board.emph('', [1, 8]); board.setPos(PAWNS);
        for (const t of ['R', 'N', 'B']) { await c.wait(250); await board.setPos(pick(START, (n, code) => code[1] === t), c, { anim: true, stagger: 60 }); }
      } },
    { text: P('Two squares are left in the middle. The <b>queen goes on her own colour</b>: the white queen on the light square d1, the black queen on the dark square d8. The <b>king</b> takes the last square, next to her.',
        '가운데에 두 칸이 남았어요. <b>퀸은 자기 색 칸</b>에 서요. 백 퀸은 밝은 칸 d1, 흑 퀸은 어두운 칸 d8이에요. <b>킹</b>은 퀸 옆에 남은 마지막 칸에 서요.'),
      async run(c) {
        board.reset(); board.setPos(backRank(PAWNS, 'RNB'));
        await c.wait(300);
        board.mark(['d1', 'd8'], 'ring');
        await board.setPos({ d1: 'wQ', d8: 'bQ' }, c, { anim: true, stagger: 120 });
        await c.wait(300);
        await board.setPos({ e1: 'wK', e8: 'bK' }, c, { anim: true, stagger: 120 });
      } },
    { text: P('Your turn to set it up. Black is ready, but White’s back rank is empty.', '이제 직접 놓아 볼 차례예요. 흑은 준비됐는데, 백의 맨 끝 줄이 비어 있어요.'),
      task: P('Put White’s eight pieces on rank 1. Pick a piece below, then click its square, or drag it there.', '백 기물 8개를 1 랭크에 놓으세요. 아래에서 기물을 고른 뒤 칸을 클릭하거나, 칸으로 끌어다 놓으면 돼요.'),
      hint: P('Corners first (rooks), then knights, bishops, and the queen on her own colour.', '구석의 룩부터 놓고, 나이트, 비숍, 그리고 자기 색 칸의 퀸 순서로 놓아 보세요.'),
      run(c) {
        c.stage('board', true);
        board.reset(); board.setPos(pick(START, n => n[1] !== '1')); board.mark([...FILES].map(f => f + 1), 'hl');
        let left = 8;
        tray.show(['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'], (code, n) => {
          if (board.pieces.has(n)) { c.bad(P('That square already has a piece.', '그 칸에는 이미 기물이 있어요.')); return false; }
          if (START[n] === code) {
            board.place(n, code, { anim: true }); board.clearMarks('hl'); board.mark([...FILES].map(f => f + 1).filter(s => !board.pieces.has(s)), 'hl');
            left--;
            if (left === 0) { c.good(P('Perfect. White is ready too.', '완벽해요. 백도 준비가 끝났어요.')); c.done(); }
            else c.good(P(`${L(INFO[TYPE[code[1]]].n)} on ${n}. ${left} to go.`, `${n}에 ${INFO[TYPE[code[1]]].n.ko}${jo(INFO[TYPE[code[1]]].n.ko, '을', '를')} 놓았어요. ${left}개 남았어요.`));
            return true;
          }
          board.mark(n, 'no'); board.shake();
          c.bad(+n[1] !== 1 ? P('White’s pieces go on rank 1, the bottom row.', '백 기물은 맨 아래 줄인 1 랭크에 놓아요.') : PLACE_HINT[code[1]]);
          return false;
        });
        board.onSquare = n => { if (!tray.square(n)) c.say(P('Pick a piece below first.', '먼저 아래에서 기물을 고르세요.')); };
      } },
    { text: P('This is the <b>starting position</b>. Every game of chess begins exactly like this. Check it: each piece faces the same kind of piece across the board, and the two queens face each other on the d-file.',
        '이게 <b>시작 자리</b>예요. 모든 체스 게임은 정확히 이 모습에서 시작해요. 확인해 보세요. 모든 기물은 맞은편의 같은 기물과 마주 보고, 두 퀸은 d 파일에서 서로 마주 봐요.'),
      run(c) { board.reset(); board.setPos(START); board.mark(['d1', 'd8'], 'ring'); board.emph('d'); } }
  ] };

  // Lesson 6: taking turns
  LESSONS[6] = { t: P('Taking turns', '차례 지키기'), steps: [
    { text: P('Players take turns. <b>White always moves first</b>, then Black, then White again, and so on. A move means moving <b>one</b> of your own pieces, once. You cannot skip a turn.',
        '체스는 한 번씩 번갈아 둬요. <b>항상 백이 먼저</b> 두고, 그다음 흑, 다시 백 순서예요. 한 번의 수는 내 기물 <b>하나</b>를 한 번 움직이는 거예요. 차례를 건너뛸 수는 없어요.'),
      run(c) { board.reset(); board.setPos(START); } },
    { text: P('Let’s play the first moves of a real game. Before each move, say whose turn it is.', '실제 게임의 첫 수들을 둬 볼게요. 수를 두기 전마다 누구 차례인지 맞혀 보세요.'),
      task: P('Who moves first?', '누가 먼저 둘까요?'),
      hint: P('White always starts, and then the turns alternate.', '항상 백이 먼저 시작하고, 그다음부터 번갈아 둬요.'),
      run(c) {
        board.reset(); board.setPos(START);
        const R = [
          { q: P('Who moves first?', '누가 먼저 둘까요?'), a: 'w', m: ['d2', 'd4'], said: P('White moves a pawn from d2 to d4.', '백이 폰을 d2에서 d4로 옮겼어요.') },
          { q: P('Whose turn is it now?', '이제 누구 차례일까요?'), a: 'b', m: ['d7', 'd5'], said: P('Black answers with a pawn from d7 to d5.', '흑은 폰을 d7에서 d5로 옮겨 맞섰어요.') },
          { q: P('And now?', '그다음은요?'), a: 'w', m: ['c2', 'c4'], said: P('White plays another pawn, c2 to c4.', '백이 또 다른 폰을 c2에서 c4로 옮겼어요.') }
        ];
        let i = 0;
        const ask = () => {
          c.setTask(R[i].q);
          c.choices([{ t: P('White', '백'), v: 'w' }, { t: P('Black', '흑'), v: 'b' }], async (v, b) => {
            if (v !== R[i].a) { b.classList.add('wrong'); c.bad(i === 0 ? P('White always moves first.', '항상 백이 먼저 둬요.') : P('The turns alternate: whoever did not just move goes next.', '차례는 번갈아 와요. 방금 두지 않은 쪽이 다음에 둬요.')); return; }
            b.classList.add('right'); c.clearChoices();
            const [f, t] = R[i].m;
            board.clearMarks(); board.mark(f, 'ring');
            await c.wait(300);
            await board.move(f, t, c);
            board.mark(t, 'ring');
            c.good(R[i].said);
            i++;
            await c.wait(900);
            if (i === R.length) { c.setTask(P('Three moves, three turns.', '세 번의 수, 세 번의 차례였어요.')); c.done(); }
            else ask();
          });
        };
        ask();
      } },
    { text: P('You just played the opening of the <b>Queen’s Gambit</b>: 1. d4 d5 2. c4. White offers the pawn on c4 to win the centre. You will learn how it works in Chapter 6.',
        '방금 둔 수가 바로 <b>퀸스 갬빗</b>의 시작이에요. 1. d4 d5 2. c4. 백은 중앙을 차지하려고 c4의 폰을 내줘요. 어떻게 통하는지는 6장에서 배워요.'),
      run(c) {
        board.reset();
        const pos = Object.assign({}, START); delete pos.d2; delete pos.d7; delete pos.c2;
        pos.d4 = 'wP'; pos.d5 = 'bP'; pos.c4 = 'wP';
        board.setPos(pos); board.mark('c4', 'ring'); board.mark(['d4', 'd5'], 'hl');
      } }
  ] };

  // ======================= CHAPTER 3: HOW PIECES MOVE =======================
  // show where a piece can go: dots appear outward from the piece
  async function showMoves(c, n, code, extra = {}, o = {}) {
    const all = Object.assign({ [n]: code }, extra);
    board.setPos(all, c, {});
    board.place(n, code, { anim: true });
    await c.wait(450);
    const ms = R.legal(R.state(all, { turn: code[0] }), n);
    const [f0, r0] = fr(n);
    const dist = m => { const [f, r] = fr(m.to); return Math.max(Math.abs(f - f0), Math.abs(r - r0)); };
    for (let d = 1; d < 8; d++) {
      const ring = ms.filter(m => dist(m) === d); if (!ring.length) continue;
      ring.forEach(m => board.mark(m.to, m.capture ? 'cap' : 'mv'));
      await c.wait(110);
    }
    if (o.after) o.after(ms);
  }
  // capture task: only taking `target` (a square) counts
  function captureTask(c, st, target, o = {}) {
    play(c, { st, onMove: m => {
      if (m.to === target) { c.good(o.ok); c.done(); return 'stop'; }
      c.bad(m.capture ? P(`That captures the ${pn(m.capture)}. The task asks for the ${pn(st.pos[target])}.`, `그건 ${PN(m.capture).ko}${jo(PN(m.capture).ko, '을', '를')} 잡은 거예요. 과제는 ${PN(st.pos[target]).ko}${jo(PN(st.pos[target]).ko, '을', '를')} 잡는 거예요.`)
        : (o.miss || P('That move captures nothing. Land on the piece’s square to take it.', '그 수로는 아무것도 잡지 못해요. 잡으려면 그 기물이 있는 칸으로 가야 해요.')));
      return 'undo';
    } });
  }

  LESSONS[7] = { t: P('The rook', '룩'), steps: [
    { text: P('The <b>rook</b> moves in straight lines along ranks and files: up, down, left or right, as many squares as it likes.',
        '<b>룩</b>은 랭크와 파일을 따라 똑바로 움직여요. 위, 아래, 왼쪽, 오른쪽으로 원하는 만큼 갈 수 있어요.'),
      async run(c) { await showMoves(c, 'd4', 'wR'); } },
    { text: P('Your turn to drive it. Click the rook to see its moves, then click a dot to go there.',
        '이제 직접 움직여 봐요. 룩을 클릭하면 갈 수 있는 칸에 점이 생기고, 점을 클릭하면 그 칸으로 가요.'),
      task: P('Land on every star.', '별이 있는 칸에 모두 착지하세요.'),
      hint: P('The rook turns corners only between moves: go straight, stop, then go straight again.', '룩은 한 번에 한 방향으로만 가요. 직진하고 멈췄다가, 다음 수에 다시 직진하세요.'),
      run(c) { starHunt(c, 'wR', 'a1', ['a6', 'f6', 'f2', 'h8']); } },
    { text: P('The rook <b>cannot jump</b>. Any piece in its way blocks the road. It can capture an enemy piece that blocks it, but it can’t go past it.',
        '룩은 <b>뛰어넘을 수 없어요</b>. 길에 기물이 있으면 막혀요. 막고 있는 기물이 상대 것이면 잡을 수는 있지만, 그 너머로는 못 가요.'),
      task: P('Click the rook to see where it can go.', '룩을 클릭해서 갈 수 있는 칸을 확인하세요.'),
      run(c) {
        const st = pos('wRd4 wPd6 wPb4 bNg4 bPd2');
        play(c, { st, onSelect: n => {
          if (n !== 'd4') return;
          c.good(P('It stops in front of your own pawns. It can capture the black knight and the black pawn (the corner marks), but not go past them.',
            '내 폰 앞에서 멈춰요. 흑 나이트와 흑 폰은 잡을 수 있지만(모서리 표시), 그 너머로는 갈 수 없어요.'));
          c.done();
        }, onMove: () => 'undo' });
      } },
    { text: P('To <b>capture</b>, move onto an enemy piece’s square. The enemy piece is taken off the board.',
        '<b>잡기</b>는 상대 기물이 있는 칸으로 들어가는 거예요. 잡힌 기물은 체스판에서 빠져요.'),
      task: P('Capture the black bishop.', '흑 비숍을 잡으세요.'),
      run(c) { captureTask(c, pos('wRc2 bBg2 bNc6'), 'g2', { ok: P('Captured. The bishop is off the board.', '잡았어요. 비숍이 판에서 빠졌어요.') }); } }
  ] };

  LESSONS[8] = { t: P('The bishop', '비숍'), steps: [
    { text: P('The <b>bishop</b> moves along diagonals, as many squares as it likes. Like the rook, it can’t jump.',
        '<b>비숍</b>은 대각선을 따라 원하는 만큼 움직여요. 룩처럼 다른 기물을 뛰어넘을 수는 없어요.'),
      async run(c) { await showMoves(c, 'd4', 'wB'); } },
    { text: P('Because it only moves diagonally, a bishop <b>stays on the colour it starts on</b> for the whole game.',
        '대각선으로만 움직이기 때문에, 비숍은 게임 내내 <b>처음 선 칸과 같은 색 칸</b>에만 있어요.'),
      task: P('Land on every star.', '별이 있는 칸에 모두 착지하세요.'),
      hint: P('All the stars are on dark squares, like the bishop. Zigzag between them.', '별은 모두 비숍처럼 어두운 칸에 있어요. 지그재그로 이동해 보세요.'),
      run(c) { starHunt(c, 'wB', 'c1', ['g5', 'e7', 'a3']); } },
    { text: P('A quick question.', '간단한 질문이에요.'),
      task: P('The bishop on c1 stands on a dark square. Can it ever reach a light square?', 'c1의 비숍은 어두운 칸에 있어요. 이 비숍이 밝은 칸에 갈 수 있을까요?'),
      run(c) {
        board.setPos({ c1: 'wB' }); board.mark('c1', 'sel');
        c.quiz([{ t: P('Yes', '네'), v: 'y' }, { t: P('No', '아니요'), v: 'n' }], 'n',
          P('Right, never. That is why each player has two bishops: one for the light squares and one for the dark.', '맞아요, 절대 못 가요. 그래서 각자 비숍이 두 개예요. 하나는 밝은 칸, 하나는 어두운 칸을 맡아요.'),
          P('Look again: every diagonal step keeps the same colour.', '다시 보세요. 대각선으로 한 칸 갈 때마다 색이 그대로예요.'));
      } },
    { text: P('Now use the bishop to capture.', '이번에는 비숍으로 잡아 볼게요.'),
      task: P('Capture the black rook.', '흑 룩을 잡으세요.'),
      run(c) { captureTask(c, pos('wBf1 bRb5 bPh3'), 'b5', { ok: P('Taken along the long diagonal.', '긴 대각선을 따라 잡았어요.') }); } }
  ] };

  LESSONS[9] = { t: P('The queen', '퀸'), steps: [
    { text: P('The <b>queen</b> moves like a rook and a bishop together: straight lines and diagonals, as far as she likes. That makes her the strongest piece.',
        '<b>퀸</b>은 룩과 비숍을 합친 것처럼 움직여요. 직선과 대각선 모두, 원하는 만큼 갈 수 있어서 가장 강한 기물이에요.'),
      async run(c) { await showMoves(c, 'd4', 'wQ'); } },
    { text: P('Try her speed.', '퀸의 속도를 느껴 보세요.'),
      task: P('Land on every star.', '별이 있는 칸에 모두 착지하세요.'),
      hint: P('Mix straight lines and diagonals.', '직선과 대각선을 섞어서 움직여 보세요.'),
      run(c) { starHunt(c, 'wQ', 'd1', ['h5', 'a5', 'e8', 'b2']); } },
    { text: P('One move can reach very far.', '한 번에 아주 멀리까지 갈 수 있어요.'),
      task: P('Capture the black rook in one move.', '한 번에 흑 룩을 잡으세요.'),
      run(c) { captureTask(c, pos('wQd1 bRh5 bNd8 bPa4'), 'h5', { ok: P('Straight down the diagonal. That is the queen’s reach.', '대각선으로 곧장 잡았어요. 이게 퀸의 힘이에요.') }); } }
  ] };

  LESSONS[10] = { t: P('The king', '킹'), steps: [
    { text: P('The <b>king</b> moves one square in any direction. Slow, but he is the piece you must protect.',
        '<b>킹</b>은 모든 방향으로 한 칸씩 움직여요. 느리지만, 꼭 지켜야 하는 기물이에요.'),
      async run(c) { await showMoves(c, 'e4', 'wK'); } },
    { text: P('Walk the king.', '킹을 걸어 보세요.'),
      task: P('Land on every star.', '별이 있는 칸에 모두 착지하세요.'),
      run(c) { starHunt(c, 'wK', 'e1', ['e3', 'g3', 'g1']); } },
    { text: P('The king may <b>never move into danger</b>: onto a square an enemy piece attacks. The black rook attacks the whole 5th rank.',
        '킹은 <b>위험한 칸으로 갈 수 없어요</b>. 상대 기물이 공격하는 칸이 위험한 칸이에요. 지금 흑 룩이 5 랭크 전체를 공격하고 있어요.'),
      task: P('Move the king to a safe square.', '킹을 안전한 칸으로 옮기세요.'),
      hint: P('The dots show only safe squares. Rank 5 is off limits.', '점은 안전한 칸에만 생겨요. 5 랭크로는 갈 수 없어요.'),
      run(c) {
        const st = pos('wKe4 bRa5');
        board.setPos(st.pos); board.mark(['b5', 'c5', 'd5', 'e5', 'f5', 'g5', 'h5'], 'hl');
        play(c, { st, placed: true, onMove: () => { c.good(P('Safe. The king never steps into an attack.', '안전해요. 킹은 절대 공격받는 칸으로 들어가지 않아요.')); c.done(); return 'stop'; } });
      } }
  ] };

  LESSONS[11] = { t: P('The knight', '나이트'), steps: [
    { text: P('The <b>knight</b> moves in an L: two squares in a straight line, then one square to the side. It always lands on a square of the other colour.',
        '<b>나이트</b>는 L자로 움직여요. 한 방향으로 두 칸 간 다음, 옆으로 한 칸 가요. 항상 원래와 다른 색 칸에 내려요.'),
      async run(c) { await showMoves(c, 'd4', 'wN', {}, { after: ms => { ms.slice(0, 2).forEach(m => board.arrow('d4', m.to)); } }); } },
    { text: P('The knight is the only piece that can <b>jump</b> over others. That is why it can leave the starting position before any pawn moves.',
        '나이트는 다른 기물을 <b>뛰어넘을 수 있는</b> 유일한 기물이에요. 그래서 폰이 움직이기 전에도 나갈 수 있어요.'),
      task: P('Jump a knight out from behind the pawns.', '폰 뒤에 있는 나이트를 뛰어넘어 꺼내 보세요.'),
      run(c) {
        play(c, { st: R.state(START), movable: n => n === 'b1' || n === 'g1', notThis: P('Only the knights can jump. Pick the knight on b1 or g1.', '뛰어넘을 수 있는 건 나이트뿐이에요. b1이나 g1의 나이트를 고르세요.'),
          onMove: m => { c.good(P(`Over the pawns to ${m.to}.`, `폰을 넘어 ${m.to}${jo(m.to, '으로', '로')} 나왔어요.`)); c.done(); return 'stop'; } });
      } },
    { text: P('Knight moves take practice. Count “two, then one”.', '나이트 움직임은 연습이 필요해요. “두 칸, 그리고 옆으로 한 칸”을 세어 보세요.'),
      task: P('Land on every star.', '별이 있는 칸에 모두 착지하세요.'),
      hint: P('From b1, the knight can reach c3. From c3, it can reach e4.', 'b1에서 나이트는 c3에 갈 수 있어요. c3에서는 e4에 갈 수 있어요.'),
      run(c) { starHunt(c, 'wN', 'b1', ['c3', 'e4', 'f6']); } }
  ] };

  LESSONS[12] = { t: P('The pawn', '폰'), steps: [
    { text: P('The <b>pawn</b> moves straight forward, one square at a time. On its very first move it may go two squares. It never moves backwards.',
        '<b>폰</b>은 앞으로 한 칸씩만 가요. 처음 움직일 때만 두 칸까지 갈 수 있고, 뒤로는 절대 못 가요.'),
      async run(c) {
        board.setPos({ e2: 'wP', c5: 'wP' }, c, { anim: true });
        await c.wait(600); board.mark(['e3', 'e4'], 'mv'); await c.wait(400); board.mark('c6', 'mv');
      } },
    { text: P('Pawns <b>capture diagonally</b>, one square forward. A piece straight ahead blocks them: pawns can’t capture forwards.',
        '폰은 <b>대각선 앞으로 한 칸</b> 가면서 잡아요. 바로 앞에 기물이 있으면 막혀요. 앞으로는 잡을 수 없어요.'),
      task: P('Capture a black piece with the pawn.', '폰으로 흑 기물을 잡으세요.'),
      hint: P('Look one square diagonally forward, left or right.', '대각선 앞 한 칸, 왼쪽이나 오른쪽을 보세요.'),
      run(c) { play(c, { st: pos('wPe4 bPd5 bNf5 bBe5'), onMove: m => { c.good(P(`Captured on ${m.to}. The bishop straight ahead stays: pawns can’t take forwards.`, `${m.to}에서 잡았어요. 바로 앞의 비숍은 잡을 수 없어요.`)); c.done(); return 'stop'; } }); } },
    { text: P('Pawns are slow, but a pawn that reaches the far side gets a big reward.', '폰은 느리지만, 반대편 끝까지 가면 큰 보상을 받아요.'),
      task: P('Walk the pawn all the way to the other side.', '폰을 반대편 끝까지 걸어가게 하세요.'),
      hint: P('Use the two-square first move to save time.', '첫 수에 두 칸 가면 시간을 아낄 수 있어요.'),
      run(c) {
        let n = 0;
        play(c, { st: pos('wPd2'), keepTurn: true, onMove: m => {
          n++;
          if (m.promo) { c.good(P(`It became a queen in ${n} moves! That is called promotion: you will meet it again in Chapter 5.`, `${n}수 만에 퀸이 되었어요! 이걸 프로모션이라고 해요. 5장에서 다시 배워요.`)); c.done(); return 'stop'; }
          c.say(P(`${n} move${n > 1 ? 's' : ''}. Keep going.`, `${n}수. 계속 가세요.`)); return 'ok';
        } });
      } }
  ] };

  // ======================= CHAPTER 4: THE GOAL OF THE GAME =======================
  const VAL = { pawn: '1', knight: '3', bishop: '3', rook: '5', queen: '9', king: '∞' };
  LESSONS[13] = { t: P('Piece values', '기물의 가치'), steps: [
    { text: P('Pieces are not equal. Players count them in points: pawn 1, knight 3, bishop 3, rook 5, queen 9. The king has no price: lose him and you lose the game.',
        '기물마다 가치가 달라요. 점수로 세면 폰 1, 나이트 3, 비숍 3, 룩 5, 퀸 9예요. 킹은 값을 매길 수 없어요. 킹을 잃으면 게임에서 지니까요.'),
      run(c) { c.stage('lineup'); lineup.show({ names: true, sub: t => VAL[t] + (t === 'king' ? '' : (lang === 'ko' ? '점' : t === 'pawn' ? ' point' : ' points')) }); } },
    { text: P('Use the points to compare trades.', '점수로 교환을 비교해 보세요.'),
      task: P('Which is worth more?', '어느 쪽이 더 가치 있을까요?'),
      run(c) {
        c.stage('lineup'); lineup.show({ names: true, sub: t => VAL[t] });
        const AB = (a, b) => [{ t: a, v: 'a' }, { t: b, v: 'b' }, { t: P('The same', '같아요'), v: '=' }];
        rounds(c, [
          { q: P('A rook, or a knight and a pawn?', '룩 하나, 아니면 나이트와 폰?'), opts: AB(P('Rook', '룩'), P('Knight + pawn', '나이트 + 폰')), a: 'a', ok: P('Rook: 5 against 3 + 1 = 4.', '룩이에요. 5 대 3 + 1 = 4.') },
          { q: P('A queen, or two rooks?', '퀸 하나, 아니면 룩 두 개?'), opts: AB(P('Queen', '퀸'), P('Two rooks', '룩 두 개')), a: 'b', ok: P('Two rooks: 5 + 5 = 10 against 9.', '룩 두 개예요. 5 + 5 = 10 대 9.') },
          { q: P('A bishop, or a knight?', '비숍, 아니면 나이트?'), opts: AB(P('Bishop', '비숍'), P('Knight', '나이트')), a: '=', ok: P('The same: both are worth 3.', '같아요. 둘 다 3점이에요.') }
        ], P('Add up the points on each side.', '양쪽 점수를 더해 보세요.'));
      } },
    { text: P('Points help you choose what to capture.', '점수를 알면 무엇을 잡을지 고를 수 있어요.'),
      task: P('Your knight can take two black pieces. Capture the more valuable one.', '내 나이트가 흑 기물 두 개를 잡을 수 있어요. 더 가치 있는 쪽을 잡으세요.'),
      hint: P('A rook is worth 5, a pawn 1.', '룩은 5점, 폰은 1점이에요.'),
      run(c) {
        play(c, { st: pos('wNe4 bRf6 bPd6'), onMove: m => {
          if (m.to === 'f6') { c.good(P('Five points instead of one. Good trade sense.', '1점 대신 5점을 얻었어요. 좋은 판단이에요.')); c.done(); return 'stop'; }
          c.bad(m.capture ? P('That pawn is worth only 1. Is there something bigger?', '그 폰은 1점밖에 안 돼요. 더 큰 게 있지 않나요?') : P('Capture one of the black pieces.', '흑 기물 중 하나를 잡으세요.'));
          return 'undo';
        } });
      } }
  ] };

  LESSONS[14] = { t: P('Check', '체크'), steps: [
    { text: P('When a piece attacks the king, the king is in <b>check</b>. Whoever is in check must get out of it straight away.',
        '기물이 킹을 공격하면 킹은 <b>체크</b> 상태가 돼요. 체크를 당한 쪽은 바로 벗어나야 해요.'),
      async run(c) {
        board.setPos(pos('bKe8 wRe1 wKg1').pos, c, { anim: true });
        await c.wait(600); board.arrow('e1', 'e8'); board.mark('e8', 'hl2');
      } },
    { text: P('There are three ways out of check: <b>move</b> the king, <b>block</b> the attack, or <b>capture</b> the attacker. First: move.',
        '체크에서 벗어나는 방법은 세 가지예요. 킹을 <b>옮기거나</b>, 공격을 <b>막거나</b>, 공격한 기물을 <b>잡는</b> 거예요. 먼저 옮기기부터 해 볼게요.'),
      task: P('You are in check. Get out by moving the king.', '체크를 당했어요. 킹을 옮겨서 벗어나세요.'),
      run(c) {
        const st = pos('wKe1 wPd2 wPf2 bRe8 bKa8');
        board.setPos(st.pos); board.arrow('e8', 'e1'); board.mark('e1', 'hl2');
        play(c, { st, placed: true, onMove: () => { c.good(P('Out of the rook’s line. Check is over.', '룩의 길에서 벗어났어요. 체크가 끝났어요.')); c.done(); return 'stop'; } });
      } },
    { text: P('Second: <b>block</b>. Put one of your pieces between the attacker and your king.', '두 번째는 <b>막기</b>예요. 공격하는 기물과 내 킹 사이에 내 기물을 놓아요.'),
      task: P('Block the bishop’s check with your rook.', '룩으로 비숍의 체크를 막으세요.'),
      hint: P('The bishop attacks along c5, d4, e3, f2. Which of those can your rook reach?', '비숍은 c5, d4, e3, f2를 따라 공격해요. 룩이 갈 수 있는 칸이 있나요?'),
      run(c) {
        const st = pos('wKg1 wPg2 wPh2 wRd1 bBc5 bKa8');
        board.setPos(st.pos); board.arrow('c5', 'g1'); board.mark('g1', 'hl2');
        play(c, { st, placed: true, onMove: m => {
          if (m.piece[1] === 'R') { c.good(P('Blocked. The rook stands in the way.', '막았어요. 룩이 길을 가로막고 있어요.')); c.done(); return 'stop'; }
          c.bad(P('Moving the king works too, but this time block with the rook.', '킹을 옮겨도 되지만, 이번에는 룩으로 막아 보세요.')); return 'undo';
        } });
      } },
    { text: P('Third: <b>capture</b> the piece that gives check.', '세 번째는 체크를 건 기물을 <b>잡는</b> 거예요.'),
      task: P('Capture the black queen.', '흑 퀸을 잡으세요.'),
      hint: P('Your king can’t take her: the bishop on h5 protects her. Your knight can.', '킹은 잡을 수 없어요. h5의 비숍이 퀸을 지키고 있거든요. 나이트는 잡을 수 있어요.'),
      run(c) {
        const st = pos('wKe1 wNc3 bQe2 bBh5 bKa8');
        board.setPos(st.pos); board.mark('e1', 'hl2');
        play(c, { st, placed: true, onMove: m => {
          if (m.to === 'e2') { c.good(P('The knight takes the queen. Check is over, and you won 9 points.', '나이트가 퀸을 잡았어요. 체크도 끝나고 9점도 얻었어요.')); c.done(); return 'stop'; }
          c.bad(P('Safe, but you can do better: capture the queen.', '안전하긴 하지만 더 좋은 수가 있어요. 퀸을 잡으세요.')); return 'undo';
        } });
      } }
  ] };

  LESSONS[15] = { t: P('Checkmate', '체크메이트'), steps: [
    { text: P('<b>Checkmate</b> means the king is in check and there is no way out: he can’t move, the attack can’t be blocked, and the attacker can’t be captured. Checkmate ends the game.',
        '<b>체크메이트</b>는 킹이 체크를 당했는데 벗어날 방법이 없는 상태예요. 킹이 피할 곳도 없고, 막을 수도, 잡을 수도 없어요. 체크메이트가 되면 게임이 끝나요.'),
      async run(c) {
        board.setPos(pos('bKg8 bPf7 bPg7 bPh7 wRe8 wKg1').pos, c, { anim: true, stagger: 40 });
        await c.wait(400); board.mark('g8', 'hl2'); board.mark(['f8', 'h8'], 'hl'); board.arrow('e8', 'h8');
      } },
    { text: P('Your turn. The black king is trapped behind his own pawns.', '이제 직접 해 봐요. 흑 킹이 자기 폰들에 갇혀 있어요.'),
      task: P('Find checkmate in one move.', '한 수 만에 체크메이트를 찾으세요.'),
      hint: P('Attack the king along the back rank, where his pawns can’t help.', '폰이 도와줄 수 없는 맨 뒷줄을 따라 킹을 공격해 보세요.'),
      run(c) { mateTask(c, pos('bKg8 bPf7 bPg7 bPh7 wRa1 wKg1')); } },
    { text: P('The queen and king make a strong team.', '퀸과 킹은 강한 팀이에요.'),
      task: P('Checkmate with the queen.', '퀸으로 체크메이트하세요.'),
      hint: P('Your king on b6 guards a7, b7 and c7. Let the queen do the rest.', 'b6의 킹이 a7, b7, c7을 지켜요. 나머지는 퀸에게 맡기세요.'),
      run(c) { mateTask(c, pos('bKa8 wKb6 wQd5')); } }
  ] };
  function mateTask(c, st, o = {}) {
    play(c, { st, onMove: (m, aft) => {
      const s = R.status(aft);
      if (s === 'mate') { c.good(o.ok || P(`${R.san(st, m)}: checkmate! The game is over.`, `${R.san(st, m)}, 체크메이트! 게임이 끝났어요.`)); if (o.onMate) o.onMate(); else c.done(); return 'stop'; }
      c.bad(s === 'stalemate' ? P('That is stalemate: Black is not in check but has no legal move, so the game is a draw. Try again.', '그건 스테일메이트예요. 흑은 체크가 아닌데 둘 수 있는 수가 없어서 무승부가 돼요. 다시 해 보세요.')
        : s === 'check' ? P('Check, but not mate: the king can still escape. Look for a move that leaves him nowhere to go.', '체크지만 메이트는 아니에요. 킹이 아직 피할 수 있어요. 피할 곳이 없게 만드는 수를 찾아보세요.')
        : P('That is not check. Attack the king.', '그 수는 체크가 아니에요. 킹을 공격하세요.'));
      return 'undo';
    } });
  }

  LESSONS[16] = { t: P('Stalemate and draws', '스테일메이트와 무승부'), steps: [
    { text: P('If the player to move is <b>not in check</b> but has <b>no legal move</b>, it is <b>stalemate</b>. The game is a draw: nobody wins. Here, Black is to move: every square around the king is attacked, but the king itself is not.',
        '둘 차례인 쪽이 <b>체크는 아닌데 둘 수 있는 수가 없으면</b> <b>스테일메이트</b>예요. 게임은 무승부, 아무도 이기지 못해요. 지금은 흑 차례예요. 킹 주변 칸은 모두 공격받지만, 킹 자체는 공격받지 않아요.'),
      async run(c) {
        board.setPos(pos('bKa8 wQb6 wKe1').pos, c, { anim: true });
        await c.wait(300); board.mark(['a7', 'b7', 'b8'], 'hl'); board.mark('a8', 'sel');
      } },
    { text: P('Tell them apart.', '구별해 보세요.'),
      task: P('Black to move. Checkmate, stalemate or neither?', '흑 차례예요. 체크메이트, 스테일메이트, 둘 다 아님 중 무엇일까요?'),
      run(c) {
        const opts = [{ t: P('Checkmate', '체크메이트'), v: 'mate' }, { t: P('Stalemate', '스테일메이트'), v: 'stalemate' }, { t: P('Neither', '둘 다 아님'), v: '' }];
        const item = s => { const st = pos(s, { turn: 'b' }); const a = R.status(st); return { setup: () => { board.clearPieces(); board.setPos(st.pos); }, q: P('Black to move. Checkmate, stalemate or neither?', '흑 차례예요. 체크메이트, 스테일메이트, 둘 다 아님?'), opts, a: a === 'check' ? '' : a }; };
        rounds(c, [item('bKh8 wQg7 wKf6'), item('bKh8 wQg6 wKf7'), item('bKe8 wRe1 wKg1 bPd7')],
          P('Ask two questions: is the king in check? Does Black have any legal move?', '두 가지를 물어보세요. 킹이 체크 상태인가? 흑이 둘 수 있는 수가 있나?'));
      } },
    { text: P('When you are winning, watch out for stalemate: it throws the win away.', '이기고 있을 때는 스테일메이트를 조심하세요. 다 이긴 게임이 무승부가 돼요.'),
      task: P('Checkmate, without stalemating.', '스테일메이트 없이 체크메이트하세요.'),
      hint: P('A move that takes every square but gives no check is stalemate. Give check too.', '모든 칸을 막아도 체크가 아니면 스테일메이트예요. 체크도 함께 걸어야 해요.'),
      run(c) { mateTask(c, pos('bKa8 wKc7 wQd5')); } },
    { text: P('A game is also a <b>draw</b> when neither side has enough pieces left to checkmate (like king against king), when the same position appears three times, or when both players agree.',
        '양쪽 모두 체크메이트할 기물이 부족할 때(킹 대 킹처럼), 같은 장면이 세 번 반복될 때, 두 사람이 합의할 때도 <b>무승부</b>예요.'),
      run(c) { board.setPos({ e4: 'wK', e6: 'bK' }); } }
  ] };

  // ======================= CHAPTER 5: SPECIAL MOVES =======================
  const CASTLE_POS = 'wKe1 wRa1 wRh1 wPa2 wPb2 wPc2 wPd2 wPe2 wPf2 wPg2 wPh2 bKe8 bPd7 bPe7 bPf7';
  LESSONS[17] = { t: P('Castling', '캐슬링'), steps: [
    { text: P('<b>Castling</b> is a special move that tucks the king into safety and brings a rook into play. The king moves <b>two squares</b> toward a rook, and the rook jumps to the square on the king’s other side.',
        '<b>캐슬링</b>은 킹을 안전한 곳으로 숨기고 룩을 꺼내는 특별한 수예요. 킹이 룩 쪽으로 <b>두 칸</b> 가고, 룩은 킹을 넘어 반대쪽 옆 칸으로 와요.'),
      async run(c) {
        const st = pos(CASTLE_POS, { castle: 'KQ' });
        board.setPos(st.pos); await c.wait(700);
        await demo(c, st, [['e1', 'g1']]);
      } },
    { text: P('Castling is the only move where two pieces move at once. You move the king; the rook follows by itself.', '캐슬링은 한 번에 두 기물이 움직이는 유일한 수예요. 킹을 옮기면 룩은 저절로 따라와요.'),
      task: P('Castle kingside: move the king two squares toward the h1 rook.', '킹사이드 캐슬링을 하세요. 킹을 h1 룩 쪽으로 두 칸 옮기면 돼요.'),
      run(c) {
        play(c, { st: pos(CASTLE_POS, { castle: 'KQ' }), onMove: m => {
          if (m.castle === 'K') { c.good(P('Castled kingside: O-O. The king is tucked in the corner.', '킹사이드 캐슬링(O-O) 완료. 킹이 구석에 안전하게 들어갔어요.')); c.done(); return 'stop'; }
          c.bad(m.castle ? P('That is queenside castling. This time go toward h1.', '그건 퀸사이드 캐슬링이에요. 이번에는 h1 쪽으로 가세요.') : P('Click the king and pick the dot two squares to the right.', '킹을 클릭하고, 오른쪽으로 두 칸 떨어진 점을 고르세요.'));
          return 'undo';
        } });
      } },
    { text: P('You can also castle on the queen’s side, toward the a1 rook.', '퀸 쪽, a1 룩 방향으로도 캐슬링할 수 있어요.'),
      task: P('Castle queenside: the king goes two squares toward a1.', '퀸사이드 캐슬링을 하세요. 킹이 a1 쪽으로 두 칸 가요.'),
      run(c) {
        play(c, { st: pos(CASTLE_POS, { castle: 'KQ' }), onMove: m => {
          if (m.castle === 'Q') { c.good(P('Castled queenside: O-O-O.', '퀸사이드 캐슬링(O-O-O) 완료.')); c.done(); return 'stop'; }
          c.bad(P('Go the other way: two squares toward the a1 rook.', '반대쪽이에요. a1 룩 쪽으로 두 칸 가세요.')); return 'undo';
        } });
      } },
    { text: P('You may castle only if the king and that rook <b>have not moved yet</b>, the squares between them are <b>empty</b>, and the king is <b>not in check</b> and does not pass through or land on an <b>attacked</b> square.',
        '캐슬링은 킹과 그 룩이 <b>한 번도 움직이지 않았고</b>, 둘 사이 칸이 <b>비어 있고</b>, 킹이 <b>체크 상태가 아니며</b> <b>공격받는 칸</b>을 지나가거나 그 칸에 도착하지 않을 때만 할 수 있어요.'),
      task: P('Can White castle kingside here?', '여기서 백이 킹사이드 캐슬링을 할 수 있을까요?'),
      run(c) {
        board.setPos(pos('wKe1 wRh1 wPf2 wPg2 wPh2 bBc4 bKe8').pos);
        board.arrow('c4', 'f1');
        c.quiz([{ t: P('Yes', '네'), v: 'y' }, { t: P('No', '아니요'), v: 'n' }], 'n',
          P('Right. The bishop attacks f1, and the king may not pass through an attacked square.', '맞아요. 비숍이 f1을 공격하고 있고, 킹은 공격받는 칸을 지나갈 수 없어요.'),
          P('Look at the bishop’s arrow. Which square does the king cross on its way to g1?', '비숍의 화살표를 보세요. 킹이 g1으로 가는 길에 어느 칸을 지나가나요?'));
      } }
  ] };

  LESSONS[18] = { t: P('Promotion', '프로모션'), steps: [
    { text: P('When a pawn reaches the far side of the board, it <b>promotes</b>: it turns into a queen, rook, bishop or knight. Almost everyone picks a queen.',
        '폰이 반대편 끝에 닿으면 <b>프로모션</b>해요. 퀸, 룩, 비숍, 나이트 중 하나로 바뀌어요. 대부분 퀸을 골라요.'),
      async run(c) { const st = pos('wPe7 wKa1 bKh6'); board.setPos(st.pos); await c.wait(600); await demo(c, st, [['e7', 'e8']]); } },
    { text: P('This time you choose.', '이번에는 직접 골라 보세요.'),
      task: P('Promote the pawn.', '폰을 프로모션하세요.'),
      run(c) {
        play(c, { st: pos('wPc7 wKa1 bKh6'), promo: 'ask', onMove: m => {
          if (m.promo) { c.setTask(P('Promoted.', '프로모션했어요.')); c.good(P(`Your pawn is now a ${L(PN('w' + m.promoTo)).toLowerCase()}. Two queens on the board are allowed, too.`, `폰이 ${L(PN('w' + m.promoTo))}${jo(L(PN('w' + m.promoTo)), '이', '가')} 되었어요. 퀸이 두 개가 되어도 괜찮아요.`)); c.done(); return 'stop'; }
          return 'undo';
        } });
      } },
    { text: P('A pawn can also promote by capturing, because pawns capture diagonally.', '폰은 대각선으로 잡기 때문에, 잡으면서 프로모션할 수도 있어요.'),
      task: P('The square ahead is blocked. Promote anyway.', '앞 칸이 막혀 있어요. 그래도 프로모션해 보세요.'),
      hint: P('Capture the rook on h8.', 'h8의 룩을 잡아 보세요.'),
      run(c) {
        play(c, { st: pos('wPg7 bRh8 bNg8 wKa1 bKa8'), onMove: m => {
          if (m.promo) { c.good(P('Capture and promotion in one move: a new queen on h8.', '잡기와 프로모션을 한 번에. h8에 새 퀸이 생겼어요.')); c.done(); return 'stop'; }
          c.bad(P('Use the pawn: it captures diagonally.', '폰을 쓰세요. 폰은 대각선으로 잡아요.')); return 'undo';
        } });
      } }
  ] };

  LESSONS[19] = { t: P('En passant', '앙파상'), steps: [
    { text: P('<b>En passant</b> (French for “in passing”): if an enemy pawn moves two squares and lands right beside your pawn, your pawn may capture it as if it had moved only one square. Only on the very next move.',
        '<b>앙파상</b>은 프랑스어로 “지나가는 길에”라는 뜻이에요. 상대 폰이 두 칸 전진해서 내 폰 바로 옆에 서면, 한 칸만 온 것처럼 대각선으로 잡을 수 있어요. 단, 바로 다음 수에만 가능해요.'),
      async run(c) {
        let st = pos('wPe5 bPd7 wKa1 bKh8', { turn: 'b' });
        board.setPos(st.pos); await c.wait(700);
        st = await demo(c, st, [['d7', 'd5']]);
        await c.wait(400); board.mark('d6', 'mv');
        await demo(c, st, [['e5', 'd6']]);
      } },
    { text: P('Black just pushed the f-pawn two squares, from f7 to f5.', '흑이 방금 f 폰을 f7에서 f5로 두 칸 옮겼어요.'),
      task: P('Capture it en passant.', '앙파상으로 잡으세요.'),
      hint: P('Your pawn on e5 captures diagonally to f6, and the pawn on f5 disappears.', 'e5의 폰이 대각선으로 f6에 가면 f5의 폰이 사라져요.'),
      run(c) {
        const st = pos('wPe5 bPf5 wKe1 bKe8', { ep: 'f6' });
        board.setPos(st.pos); board.arrow('f7', 'f5');
        play(c, { st, placed: true, onMove: m => {
          if (m.ep) { board.clearMarks('arrow'); c.good(P('En passant: exf6. The black pawn is gone.', '앙파상 성공: exf6. 흑 폰이 사라졌어요.')); c.done(); return 'stop'; }
          c.bad(P('Not that. Capture the f5 pawn by moving to f6.', '그게 아니에요. f6으로 가서 f5의 폰을 잡으세요.')); return 'undo';
        } });
      } },
    { text: P('One last check.', '마지막으로 확인해 볼게요.'),
      task: P('Black moved this pawn d7–d6, then d6–d5: one square at a time. Can White capture it en passant?', '흑이 이 폰을 d7–d6, d6–d5로 한 칸씩 옮겼어요. 백이 앙파상으로 잡을 수 있을까요?'),
      run(c) {
        board.setPos(pos('wPe5 bPd5 wKa1 bKh8').pos); board.arrow('d6', 'd5');
        c.quiz([{ t: P('Yes', '네'), v: 'y' }, { t: P('No', '아니요'), v: 'n' }], 'n',
          P('Right. En passant only works right after a two-square pawn move.', '맞아요. 앙파상은 폰이 두 칸 움직인 직후에만 할 수 있어요.'),
          P('Look at how the pawn arrived: one square at a time.', '폰이 어떻게 왔는지 보세요. 한 칸씩 왔어요.'));
      } }
  ] };

  // ======================= CHAPTER 6: YOUR FIRST GAME =======================
  LESSONS[20] = { t: P('Three opening rules', '오프닝 3원칙'), steps: [
    { text: P('Three simple rules for the start of a game: <b>1.</b> take the centre with pawns, <b>2.</b> bring out your knights and bishops, <b>3.</b> castle to keep your king safe.',
        '게임 초반의 세 가지 원칙이에요. <b>1.</b> 폰으로 중앙을 차지하기, <b>2.</b> 나이트와 비숍 꺼내기, <b>3.</b> 캐슬링으로 킹 지키기.'),
      run(c) { board.setPos(START); board.mark(['d4', 'e4', 'd5', 'e5'], 'hl2'); } },
    { text: P('Rule 1: the four squares in the middle are the most important on the board.', '1원칙: 가운데 네 칸이 체스판에서 가장 중요한 칸이에요.'),
      task: P('Play a first move that puts a pawn in the centre.', '폰을 중앙에 놓는 첫 수를 두세요.'),
      hint: P('Push the e-pawn or the d-pawn two squares.', 'e 폰이나 d 폰을 두 칸 전진시켜 보세요.'),
      run(c) {
        board.mark(['d4', 'e4', 'd5', 'e5'], 'hl');
        play(c, { st: after([]), onMove: (m, a, b) => {
          if (['e4', 'd4'].includes(m.to) && m.piece === 'wP') { c.good(P(`${R.san(b, m)}: a classic first move.`, `${R.san(b, m)}, 가장 많이 두는 첫 수예요.`)); c.done(); return 'stop'; }
          c.bad(P('That is legal, but it doesn’t put a pawn on a centre square. Try e4 or d4.', '둘 수는 있지만, 폰이 중앙에 서지 않아요. e4나 d4를 두어 보세요.')); return 'undo';
        } });
      } },
    { text: P('Rule 2: develop. Knights and bishops should leave the back rank early.', '2원칙: 기물을 꺼내세요. 나이트와 비숍은 일찍 맨 뒷줄을 떠나야 해요.'),
      task: P('Develop a knight toward the centre.', '나이트를 중앙 쪽으로 꺼내세요.'),
      hint: P('Nf3 or Nc3. A knight on the edge controls fewer squares.', 'Nf3나 Nc3예요. 가장자리의 나이트는 지배하는 칸이 적어요.'),
      run(c) {
        play(c, { st: after([['e2', 'e4'], ['e7', 'e5']]), onMove: (m, a, b) => {
          if (['f3', 'c3'].includes(m.to) && m.piece === 'wN') { c.good(P(`${R.san(b, m)}: the knight eyes the centre.`, `${R.san(b, m)}, 나이트가 중앙을 노려요.`)); c.done(); return 'stop'; }
          c.bad(m.piece === 'wN' ? P('A knight on the edge controls fewer squares. Aim it at the centre.', '가장자리 나이트는 힘이 약해요. 중앙 쪽으로 보내세요.') : P('Move a knight this time.', '이번에는 나이트를 움직이세요.'));
          return 'undo';
        } });
      } },
    { text: P('Rule 3: castle early. Both sides have developed a knight and a bishop.', '3원칙: 일찍 캐슬링하세요. 양쪽 모두 나이트와 비숍을 꺼냈어요.'),
      task: P('Castle now.', '지금 캐슬링하세요.'),
      run(c) {
        play(c, { st: after([['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['f1', 'c4'], ['f8', 'c5']]), onMove: m => {
          if (m.castle) { c.good(P('O-O. Centre, development, a safe king: all three rules in four moves.', 'O-O. 중앙, 전개, 안전한 킹. 네 수 만에 세 원칙을 모두 지켰어요.')); c.done(); return 'stop'; }
          c.bad(P('Click the king and move it two squares toward the h1 rook.', '킹을 클릭하고 h1 룩 쪽으로 두 칸 옮기세요.')); return 'undo';
        } });
      } }
  ] };

  LESSONS[21] = { t: P('Basic checkmates', '기본 체크메이트'), steps: [
    { text: P('Three patterns win most beginner games: the <b>back-rank mate</b>, the <b>queen and king</b> working together, and the <b>ladder</b> with two rooks.',
        '초보자 게임은 대부분 세 가지 패턴으로 끝나요. <b>백랭크 메이트</b>, <b>퀸과 킹</b>의 협력, 그리고 룩 두 개로 하는 <b>사다리 메이트</b>예요.'),
      task: P('Find checkmate in one.', '한 수 만에 체크메이트를 찾으세요.'),
      hint: P('Look for a check that leaves the king no square to run to.', '킹이 도망갈 칸이 하나도 없는 체크를 찾아보세요.'),
      run(c) {
        const puzzles = [
          { s: 'bKg8 bPf7 bPg7 bPh7 wRd1 wKg1', n: P('Back-rank mate', '백랭크 메이트') },
          { s: 'bKe8 wKe6 wQh1', n: P('Queen and king', '퀸과 킹') },
          { s: 'bKa8 wRg7 wRh1 wKg1', n: P('The ladder', '사다리 메이트') }
        ];
        let i = 0;
        const next = () => {
          const pz = puzzles[i];
          c.setTask(P(`${pz.n.en}: checkmate in one. (${i + 1} of 3)`, `${pz.n.ko}: 한 수 만에 체크메이트. (3개 중 ${i + 1}번째)`));
          board.clearPieces(); board.clearMarks();
          const st = pos(pz.s); board.setPos(st.pos);
          mateTask(c, st, { onMate: async () => { i++; await c.wait(1300); if (i === 3) { c.setTask(P('Three patterns, three mates.', '세 가지 패턴, 세 번의 메이트.')); c.done(); } else next(); } });
        };
        next();
      } }
  ] };

  LESSONS[22] = { t: P('Reading notation', '기보 읽기'), steps: [
    { text: P('Every move can be written down. Write the piece’s letter, then the square it moves to: <b>K</b> king, <b>Q</b> queen, <b>R</b> rook, <b>B</b> bishop, <b>N</b> knight. Pawns get no letter. So <b>Nf3</b> means “knight to f3”, and <b>e4</b> means “pawn to e4”.',
        '모든 수는 글로 적을 수 있어요. 기물의 알파벳을 쓰고, 도착한 칸을 써요. <b>K</b> 킹, <b>Q</b> 퀸, <b>R</b> 룩, <b>B</b> 비숍, <b>N</b> 나이트. 폰은 알파벳 없이 칸만 써요. <b>Nf3</b>는 “나이트가 f3으로”, <b>e4</b>는 “폰이 e4로”라는 뜻이에요.'),
      run(c) { board.setPos(START); board.arrow('g1', 'f3'); board.arrow('e2', 'e4'); } },
    { text: P('A few extra signs: <b>x</b> means a capture, <b>+</b> check, <b>#</b> checkmate, and <b>O-O</b> castling. A pawn capture starts with the file it came from, like <b>exd5</b>.',
        '기호 몇 개를 더 알아 두세요. <b>x</b>는 잡기, <b>+</b>는 체크, <b>#</b>는 체크메이트, <b>O-O</b>는 캐슬링이에요. 폰이 잡을 때는 출발한 파일을 앞에 써서 <b>exd5</b>처럼 적어요.'),
      task: P('How is the arrow’s move written?', '화살표의 수는 어떻게 적을까요?'),
      run(c) {
        const q = (list, f, t, wrong) => {
          const st = after(list), m = R.legal(st, f).find(x => x.to === t), right = R.san(st, m);
          const opts = shuffle([right, ...wrong]).map(v => ({ t: v, v }));
          return { setup: () => { board.clearPieces(); board.setPos(st.pos); board.arrow(f, t); }, q: P('How is the arrow’s move written?', '화살표의 수는 어떻게 적을까요?'), opts, a: right };
        };
        rounds(c, [
          q([], 'g1', 'f3', ['Ng3', 'f3']),
          q([['e2', 'e4'], ['d7', 'd5']], 'e4', 'd5', ['Pd5', 'ed5']),
          q([['e2', 'e4'], ['e7', 'e5'], ['d1', 'h5'], ['b8', 'c6'], ['f1', 'c4'], ['g8', 'f6']], 'h5', 'f7', ['Qf7', 'Qxf7+'])
        ], P('Piece letter, then x if it captures, then the square. End with + or # for check or mate.', '기물 알파벳, 잡으면 x, 그리고 칸. 체크면 +, 메이트면 #를 붙여요.'));
      } },
    { text: P('Now read and play. You are White; Black answers by itself.', '이제 읽고 둬 볼게요. 나는 백이고, 흑은 저절로 둬요.'),
      task: P('Play the moves.', '수를 두세요.'),
      run(c) {
        line(c, after([]), [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['f1', 'b5']], 'w',
          { done: P('1. e4 e5 2. Nf3 Nc6 3. Bb5: the Ruy Lopez, one of the oldest openings in chess.', '1. e4 e5 2. Nf3 Nc6 3. Bb5: 체스에서 가장 오래된 오프닝 중 하나인 루이 로페즈예요.') });
      } }
  ] };

  LESSONS[23] = { t: P('The Queen’s Gambit', '퀸스 갬빗'), steps: [
    { text: P('The opening this site is named after. White pushes the d-pawn, then offers the c-pawn: <b>1. d4 d5 2. c4</b>.',
        '이 사이트 이름의 주인공인 오프닝이에요. 백이 d 폰을 밀고, c 폰을 내줘요. <b>1. d4 d5 2. c4</b>.'),
      task: P('Play the moves.', '수를 두세요.'),
      run(c) { line(c, after([]), [['d2', 'd4'], ['d7', 'd5'], ['c2', 'c4']], 'w', { done: P('That is the Queen’s Gambit. A gambit is an opening that offers material.', '이게 퀸스 갬빗이에요. 갬빗은 기물을 내주는 오프닝을 말해요.') }); } },
    { text: P('Why give a pawn away? If Black takes it with <b>2...dxc4</b>, Black gives up the centre. White plays e3, and the bishop wins the pawn back.',
        '왜 폰을 내줄까요? 흑이 <b>2...dxc4</b>로 잡으면 흑은 중앙을 포기하게 돼요. 백은 e3를 두고, 비숍으로 폰을 되찾아요.'),
      async run(c) {
        const st = after([['d2', 'd4'], ['d7', 'd5'], ['c2', 'c4']]);
        board.setPos(st.pos); await c.wait(600);
        await demo(c, st, [['d5', 'c4'], ['e2', 'e3'], ['g8', 'f6'], ['f1', 'c4']], { pause: 600 });
        board.mark('d4', 'hl2');
      } },
    { text: P('Black can also <b>decline</b> the gambit with <b>2...e6</b>, keeping the pawn on d5 strong.', '흑은 <b>2...e6</b>로 갬빗을 <b>거절</b>할 수도 있어요. d5의 폰을 단단히 지키는 거예요.'),
      task: P('Black played 2...e6. Is the gambit accepted or declined?', '흑이 2...e6를 뒀어요. 갬빗을 받아들였을까요, 거절했을까요?'),
      run(c) {
        board.setPos(after([['d2', 'd4'], ['d7', 'd5'], ['c2', 'c4'], ['e7', 'e6']]).pos); board.arrow('e7', 'e6');
        c.quiz([{ t: P('Accepted', '받아들임'), v: 'a' }, { t: P('Declined', '거절'), v: 'd' }], 'd',
          P('Declined: the Queen’s Gambit Declined, one of the most solid answers.', '거절이에요. 퀸스 갬빗 거절(QGD)은 가장 단단한 대응 중 하나예요.'),
          P('Black didn’t take the c4 pawn. Look again.', '흑은 c4 폰을 잡지 않았어요. 다시 보세요.'));
      } },
    { text: P('Your turn to play Black.', '이번에는 흑으로 둬 보세요.'),
      task: P('Answer 2. c4: accept with dxc4, or decline with e6.', '2. c4에 답하세요. dxc4로 받아들이거나, e6로 거절하세요.'),
      run(c) {
        play(c, { st: after([['d2', 'd4'], ['d7', 'd5'], ['c2', 'c4']]), side: 'b', onMove: m => {
          if (m.from === 'd5' && m.to === 'c4') { c.good(P('2...dxc4: the Queen’s Gambit Accepted. Now hold on to the centre.', '2...dxc4: 퀸스 갬빗 수락이에요. 이제 중앙을 지키며 싸워요.')); c.done(); return 'stop'; }
          if (m.from === 'e7' && m.to === 'e6') { c.good(P('2...e6: the Queen’s Gambit Declined. Solid and classical.', '2...e6: 퀸스 갬빗 거절. 단단하고 고전적인 수예요.')); c.done(); return 'stop'; }
          c.bad(P('Try dxc4 (take the pawn) or e6 (defend d5).', 'dxc4(폰 잡기)나 e6(d5 지키기)를 두어 보세요.')); return 'undo';
        } });
      } },
    { text: P('You have finished the course. You know the board, every piece, every rule, and your first opening. Now go and play, and when you are stuck, ask Pawn.',
        '코스를 모두 마쳤어요. 체스판, 모든 기물, 모든 규칙, 그리고 첫 오프닝까지 배웠어요. 이제 직접 두어 보고, 막히면 Pawn에게 물어보세요.'),
      run(c) { board.setPos(START, c, { anim: true, stagger: 22 }); } }
  ] };

  // ---------- page state ----------
  const S = { id: null, step: 0, token: 0, done: false, text: null, task: null, feed: null, kind: '', choices: [], choiceFn: null, keep: false, hintFn: null, ended: false };
  const STOP = { stop: true };
  addEventListener('unhandledrejection', e => { if (e.reason === STOP) e.preventDefault(); });
  const progress = () => store.get('fgLearn', { done: [] });
  const isDone = id => progress().done.includes(id);
  const available = id => !!LESSONS[id];
  const nextUp = () => { for (let id = 1; id <= TOTAL; id++) if (!isDone(id)) return id; return TOTAL; };

  const UI = {
    lede: P('Chess from zero. Start with the board, meet the pieces, set them up, and finish with your first game.', '체스를 처음부터 배워요. 체스판을 보는 법부터 기물, 시작 자리, 그리고 첫 게임까지.'),
    all: P('All lessons', '전체 레슨'),
    yourTurn: P('Your turn', '직접 해보기'),
    complete: P('Lesson complete', '레슨 완료'),
    back: P('Back', '이전'),
    youSit: P('You sit here', '내 자리'),
    next: P('Next', '다음'), finish: P('Finish', '완료'),
    start: P('Start lesson 1', '1강 시작하기'),
    cont: id => P(`Continue: lesson ${id}`, `${id}강 이어서 하기`),
    review: P('Start again', '처음부터 다시'),
    done: P('Done', '완료'), go: P('Start', '시작'), soon: P('Soon', '준비 중'),
    ch: n => P(`Chapter ${n}`, `${n}장`),
    lesson: id => P(`Lesson ${id} of ${TOTAL}`, `${TOTAL}강 중 ${id}강`)
  };

  // ---------- header art: six white pieces on the horizon, black reflections below ----------
  (() => {
    const GAP = 40;
    const W = ORDER.reduce((s, t) => s + FLAT[t].w, 0) + GAP * 5;
    for (const [id, flip] of [['lhSet', false], ['lhRefl', true]]) {
      const svg = $(id);
      svg.setAttribute('viewBox', `0 0 ${W} 254`);
      svg.setAttribute('preserveAspectRatio', flip ? 'xMaxYMin meet' : 'xMaxYMax meet');
      const g = el('g', flip ? { transform: 'translate(0 254) scale(1 -1)' } : {}, svg);
      let x = 0;
      ORDER.forEach((t, i) => {
        const u = el('use', { href: '#fp-' + t, x, y: 254 - FLAT[t].h, width: FLAT[t].w, height: FLAT[t].h, class: 'lp' }, g);
        u.style.animationDelay = (200 + i * 140) + 'ms';
        x += FLAT[t].w + GAP;
      });
    }
  })();

  // ---------- course map ----------
  function renderMap() {
    document.querySelectorAll('[data-i18n]').forEach(e => { const v = UI[e.dataset.i18n]; if (v && typeof v === 'object') e.innerHTML = L(v); });
    const n = nextUp(), all = progress().done.length;
    const go = $('goBtn');
    go.href = '#/' + n;
    go.textContent = all === 0 ? L(UI.start) : all >= TOTAL ? L(UI.review) : L(UI.cont(n));
    if (all >= TOTAL) go.href = '#/1';
    let id = 0;
    $('chapters').innerHTML = CHAPTERS.map(ch => {
      const rows = ch.lessons
        ? ch.lessons.map(l => {
            const st = isDone(l) ? 'done' : l === n && all < TOTAL ? 'next' : '';
            const lab = isDone(l) ? UI.done : UI.go;
            return `<li class="${st}"><a href="#/${l}"><span class="no">${String(l).padStart(2, '0')}</span><span>${L(LESSONS[l].t)}</span><span class="st">${L(lab)}</span></a></li>`;
          }).join('')
        : ch.soon.map((t, k) => `<li><span class="row"><span class="no">${String(7 + CHAPTERS.slice(2, ch.n - 1).reduce((s, c) => s + c.soon.length, 0) + k).padStart(2, '0')}</span><span>${L(t)}</span><span class="st">${L(UI.soon)}</span></span></li>`).join('');
      id++;
      return `<li class="ch${ch.lessons ? '' : ' ch-soon'}"><p class="ch-n" aria-hidden="true">${String(ch.n).padStart(2, '0')}</p>
        <div class="ch-head"><p class="cap" style="margin:0 0 8px;color:var(--ml)">${L(UI.ch(ch.n))}</p><h2>${L(ch.t)}</h2><p>${L(ch.d)}</p></div>
        <ol class="ch-ls">${rows}</ol></li>`;
    }).join('');
  }

  // ---------- lesson view ----------
  const ctxFor = my => ({
    wait: ms => new Promise(res => setTimeout(res, reduce ? Math.min(ms, 80) : ms)).then(() => { if (my !== S.token) throw STOP; }),
    done() { if (my !== S.token) return; S.done = true; renderNav(); },
    good(o) { if (my === S.token) sfx('good'); feed(my, o, 'good'); }, bad(o) { if (my === S.token) sfx('bad'); feed(my, o, 'bad'); }, say(o) { feed(my, o, ''); },
    setTask(o) { if (my !== S.token) return; S.task = o; renderText(); },
    choices(list, fn, keep) { if (my !== S.token) return; S.choices = list; S.choiceFn = fn; S.keep = !!keep; renderChoices(); },
    clearChoices() { if (my !== S.token) return; S.choices = []; renderChoices(); },
    quiz(list, right, ok, no) {
      this.choices(list, (v, b) => {
        if (v === right) { b.classList.add('right'); this.good(ok); this.clearChoices(); this.done(); }
        else { b.classList.add('wrong'); this.bad(no); }
      });
    },
    youSit(on) { $('youSit').hidden = !on; },
    hint(fn) { S.hintFn = fn; },
    stage(mode, withTray) {
      $('boardWrap').hidden = mode !== 'board';
      if (mode === 'lineup') lineup.show(); else lineup.hide();
      if (!withTray) tray.hide();
    }
  });
  function feed(my, o, kind) {
    if (my !== S.token) return;
    S.feed = o; S.kind = kind; renderFeed();
  }
  const renderFeed = () => { const f = $('lFeed'); f.className = 'l-feed ' + S.kind; f.innerHTML = S.feed ? L(S.feed) : ''; };
  function renderText() {
    const st = LESSONS[S.id].steps[S.step];
    $('lText').innerHTML = L(S.text || st.text);
    $('lTask').hidden = !S.task;
    $('lTaskText').innerHTML = S.task ? L(S.task) : '';
  }
  function renderChoices() {
    const box = $('lChoices');
    box.innerHTML = '';
    S.choices.forEach(ch => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = L(ch.t);
      b.addEventListener('click', () => { if (S.choiceFn) S.choiceFn(ch.v, b); });
      box.appendChild(b);
    });
  }
  function renderNav() {
    const steps = LESSONS[S.id].steps;
    $('lPrev').disabled = S.step === 0 && !S.ended;
    $('lNext').disabled = !S.done;
    $('lNext').textContent = L(S.step === steps.length - 1 ? UI.finish : UI.next);
    $('lNav').hidden = S.ended;
    [...$('lPips').children].forEach((p, i) => p.classList.toggle('on', S.ended || i <= S.step));
  }
  function renderHead() {
    const ch = chapterOf(S.id), les = LESSONS[S.id];
    $('lMeta').textContent = `${L(UI.ch(ch.n))} · ${L(ch.t)}`;
    $('lNum').textContent = L(UI.lesson(S.id));
    $('lTitle').textContent = L(les.t);
    document.title = `${L(les.t)} · Learn · First Gambit`;
    document.querySelectorAll('[data-i18n]').forEach(e => { const v = UI[e.dataset.i18n]; if (v && typeof v === 'object') e.innerHTML = L(v); });
  }
  function renderEnd() {
    const nxt = S.id + 1, ch = chapterOf(S.id);
    const a = $('lNextLesson');
    if (LESSONS[nxt]) {
      const sameCh = chapterOf(nxt) === ch;
      $('lEndText').innerHTML = L(sameCh
        ? P(`Next up: lesson ${nxt}, <b>${LESSONS[nxt].t.en}</b>.`, `다음은 ${nxt}강, <b>${LESSONS[nxt].t.ko}</b>${jo(LESSONS[nxt].t.ko, '이에요', '예요')}.`)
        : P(`That is the end of Chapter ${ch.n}. Next, Chapter ${ch.n + 1}: <b>${CHAPTERS[ch.n].t.en}</b>.`, `${ch.n}장이 끝났어요. 다음은 ${ch.n + 1}장, <b>${CHAPTERS[ch.n].t.ko}</b>${jo(CHAPTERS[ch.n].t.ko, '이에요', '예요')}.`));
      a.href = '#/' + nxt; a.textContent = L(P('Next lesson →', '다음 레슨 →'));
    } else {
      $('lEndText').innerHTML = L(P('That is the whole course: 23 lessons, from the empty board to the Queen’s Gambit. Well done.',
        '23강 코스를 모두 마쳤어요. 빈 체스판에서 퀸스 갬빗까지 왔어요. 수고했어요.'));
      a.href = '#'; a.textContent = L(UI.all);
    }
  }

  async function runStep(i) {
    const my = ++S.token;
    const les = LESSONS[S.id], st = les.steps[i];
    Object.assign(S, { step: i, done: !st.task, text: null, task: st.task || null, feed: null, kind: '', choices: [], choiceFn: null, hintFn: null, ended: false });
    $('lStep').hidden = false; $('lEnd').hidden = true;
    renderText(); renderFeed(); renderChoices(); renderNav();
    const c = ctxFor(my);
    c.stage('board'); c.youSit(false);
    board.reset();
    try { await st.run(c); } catch (e) { if (e !== STOP) console.error(e); }
  }
  function endLesson() {
    S.token++; S.ended = true;
    const p = progress(); if (!p.done.includes(S.id)) p.done.push(S.id); store.set('fgLearn', p);
    $('lStep').hidden = true; $('lEnd').hidden = false; S.choices = []; renderChoices(); sfx('complete');
    renderEnd(); renderNav();
    $('lNextLesson').focus();
  }
  function openLesson(id, at = 0) {
    S.id = id;
    $('lesson').hidden = false; document.body.classList.add('lesson-open');
    $('lPips').innerHTML = LESSONS[id].steps.map(() => '<li></li>').join('');
    renderHead(); runStep(at);
    $('lTitle').focus({ preventScroll: true });
  }
  function closeLesson() {
    S.token++; S.id = null;
    $('lesson').hidden = true; document.body.classList.remove('lesson-open');
    tray.hide(); document.title = 'Learn · First Gambit';
    renderMap();
  }

  $('lNext').addEventListener('click', () => {
    if (!S.done) return;
    if (S.step === LESSONS[S.id].steps.length - 1) endLesson(); else runStep(S.step + 1);
  });
  $('lPrev').addEventListener('click', () => {
    if (S.ended) runStep(LESSONS[S.id].steps.length - 1);
    else if (S.step > 0) runStep(S.step - 1);
  });
  $('lExit').addEventListener('click', e => { e.preventDefault(); location.hash = ''; });
  $('lNextLesson').addEventListener('click', e => { if ($('lNextLesson').getAttribute('href') === '#') { e.preventDefault(); location.hash = ''; } });
  document.addEventListener('keydown', e => {
    if (!S.id || e.target.closest('input,textarea,.tutor')) return;
    if (e.key === 'Escape' && document.getElementById('tPanel')?.hidden !== false) location.hash = '';
  });

  // language
  function setLang(l) {
    lang = l; store.set('fgLang', l);
    document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    if (S.id) {
      renderHead(); renderFeed(); renderChoices(); renderNav();
      if (S.ended) renderEnd(); else renderText();
      board.describe();
      // the lineup draws names in the current language; redraw the step to refresh them
      if (!$('lineup').hasAttribute('hidden') && !S.ended) runStep(S.step);
    } else renderMap();
  }
  document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

  // routing: #/3 opens lesson 3, anything else shows the course
  function route() {
    const m = location.hash.match(/^#\/(\d+)(?:\/(\d+))?$/);
    const id = m ? +m[1] : null, at = m && m[2] ? Math.max(0, Math.min(+m[2] - 1, (LESSONS[id] || { steps: [] }).steps.length - 1)) : 0;
    if (id && available(id)) { if (S.id !== id) openLesson(id, at); else if (m[2]) runStep(at); }
    else if (S.id) closeLesson();
    else renderMap();
  }
  addEventListener('hashchange', route);
  setLang(lang);
  route();

  // ---------- what Pawn, the tutor, can read ----------
  window.FG_LEARN = {
    active: () => !!S.id,
    context() {
      if (!S.id) return { page: 'learn', view: 'course map', done: progress().done, chapters: CHAPTERS.map(c => c.t.en) };
      const st = LESSONS[S.id].steps[S.step];
      return {
        page: 'learn', lesson: `${S.id}. ${LESSONS[S.id].t.en}`, chapter: chapterOf(S.id).t.en,
        step: `${S.step + 1} of ${LESSONS[S.id].steps.length}`,
        explanation: (S.text || st.text).en.replace(/<[^>]+>/g, ''),
        task: S.task ? (S.task.en || '').replace(/<[^>]+>/g, '') : null,
        taskDone: S.done,
        board: [...board.pieces.entries()].map(([n, p]) => `${p.code[0] === 'w' ? 'white' : 'black'} ${TYPE[p.code[1]]} ${n}`),
        note: 'The visitor is a complete beginner doing this lesson. Give one short hint that helps them do the task themselves. Give the answer only if they ask for it.'
      };
    },
    hint(l) {
      if (!S.id) return l === 'ko' ? '처음이라면 1강 “체스판 만나기”부터 시작하세요. 위의 버튼을 누르면 돼요.' : 'New to chess? Start with lesson 1, “Meet the board”. Press the button above.';
      const st = LESSONS[S.id].steps[S.step];
      const h = (S.hintFn && S.hintFn()) || st.hint;
      if (h) return h[l] || h.en;
      if (S.done) return l === 'ko' ? '다 했어요! “다음” 버튼을 누르면 계속돼요.' : 'You have done this step. Press Next to go on.';
      return plain(st.text);
    },
    explain(l) {
      if (!S.id) return l === 'ko' ? '이 코스는 6장, 23강이에요. 체스판, 기물, 움직임, 게임의 목표, 특별한 규칙, 첫 게임 순서로 배워요.' : 'The course has 6 chapters and 23 lessons: the board, the pieces, how they move, the goal of the game, special moves, and your first game.';
      const st = LESSONS[S.id].steps[S.step];
      const o = S.text || st.text, t = S.task;
      return ((o[l] || o.en) + (t ? '\n\n' + (t[l] || t.en) : '')).replace(/<[^>]+>/g, '');
    }
  };
})();
