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
    const mkG = el('g', {}, rot), pcG = el('g', {}, rot);
    const cur = el('rect', { class: 'cur', x: .05, y: 7.05, width: .9, height: .9 }, rot);
    const cornerG = el('g', { style: 'display:none' }, svg);
    el('rect', { class: 'corner', x: 7.1, y: 7.1, width: .8, height: .8 }, cornerG);
    const pieces = new Map();
    let cf = 4, cr = 1;

    const api = {
      svg, pieces, onSquare: null,
      reset(o = {}) {
        mkG.textContent = ''; pcG.textContent = ''; pieces.clear();
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
        await ctx.wait(14 * 38 + 500);
      },
      rotate(deg, anim = true) {
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
          else m = el('rect', { class: 'mk ' + kind, x, y, width: 1, height: 1 }, mkG);
          m.dataset.kind = kind;
          if (kind === 'ok' || kind === 'no') setTimeout(() => m.remove(), 950);
          out.push(m);
        }
        return out;
      },
      clearMarks(kind) { [...mkG.children].forEach(m => { if (!kind || m.dataset.kind === kind) m.remove(); }); },
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
              if (o.counts !== false) { const ct = el('text', { class: 'ct', x: x + w / 2, y: base + 52 }, g); ct.textContent = '× ' + INFO[t].c; }
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
    const fire = e => { const g = e.target.closest('.li'); if (g && onPick) onPick(g.dataset.t, g); };
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
    const select = b => { [...box.children].forEach(x => x.classList.toggle('sel', x === b)); sel = b; };
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

  // ---------- the course ----------
  const CHAPTERS = [
    { n: 1, t: P('The board', '체스판'), d: P('How the board is built, how to turn it, and the name of every square.', '체스판의 생김새, 놓는 방향, 칸마다 붙은 이름을 배워요.'), lessons: [1, 2, 3] },
    { n: 2, t: P('The pieces', '기물'), d: P('Meet the six pieces, set them up, and learn who moves when.', '여섯 가지 기물을 만나고, 시작 자리에 놓고, 차례를 배워요.'), lessons: [4, 5, 6] },
    { n: 3, t: P('How pieces move', '기물의 움직임'), d: P('One piece at a time, with a small game for each.', '기물 하나씩, 작은 게임과 함께 움직임을 익혀요.'), soon: [P('The rook', '룩'), P('The bishop', '비숍'), P('The queen', '퀸'), P('The king', '킹'), P('The knight', '나이트'), P('The pawn', '폰')] },
    { n: 4, t: P('The goal of the game', '게임의 목표'), d: P('What pieces are worth, check, checkmate and draws.', '기물의 가치, 체크, 체크메이트, 무승부를 배워요.'), soon: [P('Piece values', '기물의 가치'), P('Check', '체크'), P('Checkmate', '체크메이트'), P('Stalemate and draws', '스테일메이트와 무승부')] },
    { n: 5, t: P('Special moves', '특별한 규칙'), d: P('Three rules that surprise every beginner.', '처음 배우는 사람이 꼭 놀라는 세 가지 규칙이에요.'), soon: [P('Castling', '캐슬링'), P('Promotion', '프로모션'), P('En passant', '앙파상')] },
    { n: 6, t: P('Your first game', '첫 게임'), d: P('Opening rules, simple checkmates, notation and the Queen’s Gambit.', '오프닝 원칙, 기본 체크메이트, 기보 읽기, 퀸스 갬빗까지.'), soon: [P('Three opening rules', '오프닝 3원칙'), P('Basic checkmates', '기본 체크메이트'), P('Reading notation', '기보 읽기'), P('The Queen’s Gambit', '퀸스 갬빗')] }
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

  // ---------- page state ----------
  const S = { id: null, step: 0, token: 0, done: false, text: null, task: null, feed: null, kind: '', choices: [], choiceFn: null, keep: false, hintFn: null, ended: false };
  const STOP = { stop: true };
  addEventListener('unhandledrejection', e => { if (e.reason === STOP) e.preventDefault(); });
  const progress = () => store.get('fgLearn', { done: [] });
  const isDone = id => progress().done.includes(id);
  const available = id => !!LESSONS[id];
  const nextUp = () => { for (let id = 1; id <= 6; id++) if (!isDone(id)) return id; return 6; };

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
    go.textContent = all === 0 ? L(UI.start) : all >= 6 ? L(UI.review) : L(UI.cont(n));
    if (all >= 6) go.href = '#/1';
    let id = 0;
    $('chapters').innerHTML = CHAPTERS.map(ch => {
      const rows = ch.lessons
        ? ch.lessons.map(l => {
            const st = isDone(l) ? 'done' : l === n && all < 6 ? 'next' : '';
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
    good(o) { feed(my, o, 'good'); }, bad(o) { feed(my, o, 'bad'); }, say(o) { feed(my, o, ''); },
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
      $('lEndText').innerHTML = L(P('That is the end of Chapter 2. Chapter 3, <b>How pieces move</b>, is coming soon. Meanwhile, ask Pawn anything in the corner.',
        '2장이 끝났어요. 3장 <b>기물의 움직임</b>은 곧 열려요. 그동안 궁금한 건 구석의 Pawn에게 물어보세요.'));
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
    $('lStep').hidden = true; $('lEnd').hidden = false; S.choices = []; renderChoices();
    renderEnd(); renderNav();
    $('lNextLesson').focus();
  }
  function openLesson(id) {
    S.id = id;
    $('lesson').hidden = false; document.body.classList.add('lesson-open');
    $('lPips').innerHTML = LESSONS[id].steps.map(() => '<li></li>').join('');
    renderHead(); runStep(0);
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
    const m = location.hash.match(/^#\/(\d+)$/);
    const id = m ? +m[1] : null;
    if (id && available(id)) { if (S.id !== id) openLesson(id); }
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
      if (!S.id) return l === 'ko' ? '이 코스는 6장, 23강이에요. 지금은 1장(체스판)과 2장(기물)을 배울 수 있어요.' : 'The course has 6 chapters and 23 lessons. Chapters 1 (the board) and 2 (the pieces) are open now.';
      const st = LESSONS[S.id].steps[S.step];
      const o = S.text || st.text, t = S.task;
      return ((o[l] || o.en) + (t ? '\n\n' + (t[l] || t.en) : '')).replace(/<[^>]+>/g, '');
    }
  };
})();
