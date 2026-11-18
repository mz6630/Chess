// PLAY: the setup screen and the game. Modes: against the computer (5 levels, a beginner mode that
// warns before blunders), two players on one device, and "play like the legends" (guess the winner's
// moves in a famous game). A chess clock you press after each move, a paper scoresheet you can fill in
// yourself, 3D or 2D boards (switchable mid-game), ceiling mode (pieces vanish), and a review afterwards.
(() => {
  const R = window.FG_RULES, AI = window.FG_AI, LEG = window.FG_LEGENDS;
  const $ = id => document.getElementById(id);
  const sfx = (n, o) => window.FG_SOUND && window.FG_SOUND.play(n, o);
  const P = (en, ko) => ({ en, ko });
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  let lang = store.get('fgLang', 'en') === 'ko' ? 'ko' : 'en';
  const L = o => (o == null ? '' : typeof o === 'string' ? o : (o[lang] ?? o.en));
  const other = c => (c === 'w' ? 'b' : 'w');
  const FILES = 'abcdefgh';
  const START = {};
  'RNBQKBNR'.split('').forEach((t, f) => { START[FILES[f] + 1] = 'w' + t; START[FILES[f] + 8] = 'b' + t; START[FILES[f] + 2] = 'wP'; START[FILES[f] + 7] = 'bP'; });
  const newState = () => R.state(START, { castle: 'KQkq' });
  const norm = s => String(s).replace(/[+#!?\s]/g, '').replace(/0/g, 'O').replace(/=/g, '');
  const expand = (st, m) => m.promo ? ['Q', 'R', 'B', 'N'].map(p => Object.assign({}, m, { promoTo: p })) : [m];
  const fromSan = (st, san) => R.allLegal(st).flatMap(m => expand(st, m)).find(m => norm(R.san(st, m)) === norm(san));
  const PIECE = { K: P('king', '킹'), Q: P('queen', '퀸'), R: P('rook', '룩'), B: P('bishop', '비숍'), N: P('knight', '나이트'), P: P('pawn', '폰') };
  const VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

  // ---------- settings ----------
  const DEF = { mode: 'ai', level: 2, tournament: false, beginner: true, color: 'w', start: 'std', time: 'none', press: true, write: false, view: '3d', ceiling: false, name: '', nameW: '', nameB: '', legend: 'opera' };
  const cfg = Object.assign({}, DEF, store.get('fgPlay', {}));
  const TIMES = { none: null, blitz: [5, 0], rapid: [15, 10], classical: [90, 30] };
  const LEVELS = [P('New', '입문'), P('Casual', '초급'), P('Club', '중급'), P('Strong', '상급'), P('Expert', '고수')];

  // ---------- game state ----------
  let G = null, view = null, gen = 0;
  const human = c => G.mode === 'two' || (G.mode === 'ai' && c === G.you) || (G.mode === 'legend' && c === G.you);

  // ===================== setup screen =====================
  function renderSetup() {
    document.querySelectorAll('[data-opt]').forEach(group => {
      const k = group.dataset.opt;
      group.querySelectorAll('button[data-v]').forEach(b => b.setAttribute('aria-pressed', String(String(cfg[k]) === b.dataset.v)));
    });
    document.querySelectorAll('[data-check]').forEach(i => { i.checked = !!cfg[i.dataset.check]; });
    $('optAI').hidden = cfg.mode !== 'ai'; $('optTwo').hidden = cfg.mode !== 'two'; $('optLegend').hidden = cfg.mode !== 'legend';
    $('optClock').hidden = cfg.mode === 'legend'; $('optSheet').hidden = cfg.mode === 'legend';
    $('pressBox').hidden = cfg.time === 'none';
    $('optTour').hidden = cfg.mode === 'legend';
    const T = cfg.tournament && cfg.mode !== 'legend';
    document.querySelectorAll('[data-check="press"],[data-check="write"],[data-check="beginner"]').forEach(i => { i.closest('.chk').classList.toggle('locked', T); i.disabled = T; });
    if (T) { document.querySelector('[data-check="press"]').checked = true; document.querySelector('[data-check="write"]').checked = true; document.querySelector('[data-check="beginner"]').checked = false; }
    $('nameIn').value = cfg.name; $('nameW').value = cfg.nameW; $('nameB').value = cfg.nameB;
    $('legendList').innerHTML = LEG.map(g => `<button type="button" class="leg${cfg.legend === g.id ? ' on' : ''}" data-leg="${g.id}" aria-pressed="${cfg.legend === g.id}">
      <span class="leg-y">${g.year}</span><span class="leg-t">${L(g.title)}</span><span class="leg-p">${g.white} – ${g.black}</span>
      <span class="leg-s">${L(g.story)}</span><span class="leg-you cap">${L(P('You play', '내가 맡을 쪽'))}: ${g.winner === 'w' ? g.white : g.black} (${L(g.winner === 'w' ? P('White', '백') : P('Black', '흑'))})</span></button>`).join('');
    document.querySelectorAll('[data-i18n]').forEach(e => { const v = UI[e.dataset.i18n]; if (v) e.textContent = L(v); });
    document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }
  const UI = {
    lede: P('Play the computer, a friend, or step into a famous game. Press the clock, write the moves, and review what happened.', '컴퓨터나 친구와 두거나, 유명한 명국 속으로 들어가 보세요. 시계를 누르고, 기보를 적고, 끝나면 복기해요.'),
    s1: P('Opponent', '상대'), s2: P('Clock', '시계'), s3: P('Scoresheet', '기보지'), s4: P('Board', '체스판'),
    mAI: P('Computer', '컴퓨터'), mTwo: P('Two players', '둘이서'), mLeg: P('Legends', '명국 따라두기'),
    level: P('Level', '레벨'), color: P('Your colour', '내 색'), white: P('White', '백'), black: P('Black', '흑'), random: P('Random', '무작위'),
    start: P('Start from', '시작 위치'), std: P('Standard', '기본'), qg: P('Queen’s Gambit', '퀸스 갬빗'),
    beginner: P('Beginner mode: warn me before a blunder, allow takebacks', '초보 모드: 큰 실수 전에 알려 주고, 무르기 허용'),
    none: P('No clock', '시계 없음'), blitz: P('Blitz 5 min', '블리츠 5분'), rapid: P('Rapid 15+10', '래피드 15+10'), classical: P('Classical 90+30', '클래식 90+30'),
    press: P('Press the clock myself after each move (Space works too)', '수를 둔 뒤 시계를 직접 누르기 (스페이스바도 돼요)'),
    write: P('Write the moves myself, like a real tournament', '실제 대회처럼 기보를 직접 적기'),
    yourName: P('Your name', '내 이름'), nameW: P('White’s name', '백 이름'), nameB: P('Black’s name', '흑 이름'),
    v3d: P('3D', '3D'), v2d: P('2D', '2D'), ceiling: P('Ceiling mode: the pieces vanish, like Beth seeing the board on the ceiling. Three peeks per game.', '천장 모드: 기물이 사라져요. 하먼이 천장에 체스판을 그리듯 머릿속으로 두세요. 한 게임에 세 번 엿볼 수 있어요.'),
    go: P('Start the game', '게임 시작'),
    s5: P('Tournament rules', '토너먼트 규칙'),
    tour: P('Play by tournament rules: no helpers at all', '토너먼트 규칙으로 두기: 보조 기능 없이'),
    tourNote: P('For strong players, and switched on automatically at levels 4 and 5. You press the clock yourself and nobody reminds you; you keep an eye on your own time; you write every move, yours and your opponent’s, on the scoresheet. No move dots, hints, takebacks or warnings. Prefer real paper? Print a blank scoresheet and write on it by hand.',
      '숙련자를 위한 규칙이에요. 레벨 4·5를 고르면 자동으로 켜져요. 시계는 직접 누르고 아무도 알려 주지 않아요. 남은 시간도 스스로 확인해요. 내 수와 상대 수를 모두 기보지에 직접 적어요. 이동 표시, 힌트, 무르기, 경고는 없어요. 진짜 종이가 좋다면 빈 기보지를 인쇄해서 손으로 적어 보세요.'),
    blank: P('Save a blank scoresheet to print', '인쇄용 빈 기보지 저장'),
    tourOn: P('Tournament rules', '토너먼트 규칙'),
    newGame: P('← New game', '← 새 게임'), hint: P('Hint', '힌트'), undo: P('Take back', '무르기'), draw: P('Offer draw', '무승부 제안'), resign: P('Resign', '기권'), save: P('Save scoresheet', '기보지 저장'),
    pQ: P('Queen', '퀸'), pR: P('Rook', '룩'), pB: P('Bishop', '비숍'), pN: P('Knight', '나이트'), pickLegend: P('Choose a game. You play the winner’s side and guess each move.', '게임을 고르세요. 이긴 쪽을 맡아 매 수를 맞혀 봐요.')
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-opt] button[data-v]');
    if (b) {
      const k = b.closest('[data-opt]').dataset.opt, v = b.dataset.v; cfg[k] = /^\d+$/.test(v) ? +v : v;
      if (k === 'level') { cfg.tournament = cfg.level >= 4; if (cfg.tournament && cfg.time === 'none') cfg.time = 'rapid'; }   // strong levels play by tournament rules, with a clock
      if (k === 'time' && v === 'none') cfg.tournament = false;      // tournament rules need a clock
      store.set('fgPlay', cfg); renderSetup(); return;
    }
    const lg = e.target.closest('[data-leg]');
    if (lg) { cfg.legend = lg.dataset.leg; store.set('fgPlay', cfg); renderSetup(); }
  });
  document.querySelectorAll('[data-check]').forEach(i => i.addEventListener('change', () => {
    cfg[i.dataset.check] = i.checked;
    if (i.dataset.check === 'tournament' && i.checked && cfg.time === 'none') cfg.time = 'rapid';   // a clock is part of the rules
    store.set('fgPlay', cfg); renderSetup();
  }));
  $('blankBtn').addEventListener('click', () => saveSheet(true));
  [['nameIn', 'name'], ['nameW', 'nameW'], ['nameB', 'nameB']].forEach(([id, k]) => $(id).addEventListener('input', () => { cfg[k] = $(id).value.slice(0, 24); store.set('fgPlay', cfg); }));
  document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => { lang = b.dataset.lang; store.set('fgLang', lang); renderSetup(); if (G) { renderSheet(); renderClock(); renderCoach(); } }));
  $('goBtn').addEventListener('click', () => { location.hash = 'game'; startGame(); });

  // ===================== the board view =====================
  function mountView(kind) {
    if (view) view.destroy();
    const host = $('boardHost'); host.textContent = '';
    view = kind === '3d' && window.FG_BOARD3D ? window.FG_BOARD3D(host) : null;
    if (!view) { view = window.FG_BOARD2D(host); if (kind === '3d') say(P('3D is not available on this device, so the board is flat.', '이 기기에서는 3D를 쓸 수 없어서 평면 체스판으로 보여요.')); kind = '2d'; }
    G.viewKind = kind; window.__view = view;   // handy for testing in the console
    document.querySelectorAll('#viewSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === kind)));
    view.orient(G.flip);
    view.set(G.st.pos);
    view.hidePieces(G.ceiling && !G.peeking);
    view.onSquare = onSquare; view.onDrop = onDrop;
    view.canDrag = n => canMove() && G.st.pos[n] && G.st.pos[n][0] === G.st.turn;
    refreshMarks();
  }
  $('viewSeg').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b || !G) return; cfg.view = b.dataset.v; store.set('fgPlay', cfg); mountView(b.dataset.v); });
  $('flipBtn').addEventListener('click', () => { if (!G) return; G.flip = other(G.flip); view.orient(G.flip); refreshMarks(); });

  // ===================== starting a game =====================
  function startGame() {
    gen++;
    const tour = cfg.tournament && cfg.mode !== 'legend';
    const t = TIMES[cfg.time] || (tour ? TIMES.rapid : null);
    const leg = cfg.mode === 'legend' ? LEG.find(g => g.id === cfg.legend) : null;
    const you = cfg.mode === 'ai' ? (cfg.color === 'random' ? (Math.random() < .5 ? 'w' : 'b') : cfg.color) : leg ? leg.winner : 'w';
    G = {
      mode: cfg.mode, level: cfg.level, tour, beginner: !tour && cfg.mode === 'ai' && cfg.beginner, you, flip: cfg.mode === 'two' ? 'w' : you,
      st: newState(), hist: [], over: null, sel: null, busy: false, ceiling: cfg.ceiling, peeks: 3, peeking: false,
      write: tour || (cfg.mode !== 'legend' && cfg.write), written: 0, leg, legPly: 0, legScore: 0, legTries: 0, legHint: null, coach: [], review: null, reps: {}, half: 0,
      names: leg ? { w: leg.white, b: leg.black }
        : cfg.mode === 'two' ? { w: cfg.nameW || L(P('White', '백')), b: cfg.nameB || L(P('Black', '흑')) }
        : you === 'w' ? { w: cfg.name || L(P('You', '나')), b: `${L(P('Computer', '컴퓨터'))} · ${L(UI.level)} ${cfg.level}` } : { w: `${L(P('Computer', '컴퓨터'))} · ${L(UI.level)} ${cfg.level}`, b: cfg.name || L(P('You', '나')) },
      date: new Date(),
      clock: t && cfg.mode !== 'legend' ? { t: { w: t[0] * 60000, b: t[0] * 60000 }, inc: t[1] * 1000, run: 'w', at: performance.now(), wait: null, manual: tour || cfg.press, label: TIMES[cfg.time] ? cfg.time : 'rapid' } : null
    };
    if (cfg.mode === 'ai' && cfg.start === 'qg') for (const [f, to] of [['d2', 'd4'], ['d7', 'd5'], ['c2', 'c4']]) record(R.legal(G.st, f).find(m => m.to === to), true);
    if (G.clock) { G.clock.run = G.st.turn; G.clock.at = performance.now(); }   // the clock starts with whoever is to move
    $('setup').hidden = true; $('game').hidden = false; $('game').classList.remove('reviewing'); document.body.classList.add('in-game');
    $('peekBtn').hidden = !G.ceiling; $('evalBar').hidden = true; $('reviewNav').hidden = true;
    $('gameTitle').textContent = leg ? `${L(leg.title)} · ${leg.year}` : G.mode === 'two' ? L(UI.mTwo) : `${L(UI.mAI)} · ${L(UI.level)} ${G.level} (${L(LEVELS[G.level - 1])})`;
    mountView(cfg.view);
    renderSheet(); renderClock(); renderControls();
    G.coach = [];
    if (leg) coach(P(`${leg.story.en}`, `${leg.story.ko}`), 'story');
    else if (G.mode === 'ai') coach(G.you === 'w' ? P('You have White. Your move.', '백이에요. 먼저 두세요.') : P('You have Black. The computer moves first.', '흑이에요. 컴퓨터가 먼저 둬요.'));
    else coach(P('White moves first. Pass the device after each move.', '백이 먼저 둬요. 한 수씩 두고 기기를 넘겨주세요.'));
    $('game').classList.toggle('tour', G.tour); $('clock').dataset.tour = L(UI.tourOn);
    if (G.tour) coach(P('Tournament rules: press your clock after every move, watch your own time, and write both players’ moves before your next move. No helpers. Good luck.', '토너먼트 규칙: 수를 둘 때마다 시계를 누르고, 시간은 스스로 확인하고, 다음 수 전에 양쪽 수를 모두 적으세요. 보조 기능은 없어요. 행운을 빌어요.'), 'story');
    else if (G.clock && G.clock.manual) coach(P('After each move, press your side of the clock (or Space). Until you do, your time keeps running.', '수를 둔 뒤에는 내 쪽 시계를 누르세요(스페이스바도 돼요). 누르기 전까지는 내 시간이 계속 흘러가요.'));
    if (G.write && !G.tour) coach(P('Write each move on the scoresheet before you make your next one.', '다음 수를 두기 전에 앞의 수를 기보지에 적어야 해요.'));
    if (G.ceiling) coach(P('Ceiling mode: the pieces are hidden. Use “Peek” to see them for two seconds (three times).', '천장 모드: 기물이 보이지 않아요. “엿보기”를 누르면 2초 동안 보여요(세 번).'));
    window.scrollTo(0, 0);
    next();
  }
  $('newBtn').addEventListener('click', () => { if (G && !G.over && G.hist.length && !confirm(L(P('Leave this game?', '이 게임을 그만둘까요?')))) return; location.hash = ''; showSetup(); });
  function showSetup() { gen++; G = null; $('game').classList.remove('reviewing'); if (view) { view.destroy(); view = null; } $('game').hidden = true; $('setup').hidden = false; document.body.classList.remove('in-game'); renderSetup(); }
  addEventListener('hashchange', () => { if (location.hash !== '#game' && G) showSetup(); });

  // ===================== turns =====================
  const pendingWrites = () => G.write ? G.hist.length - G.written : 0;
  function canMove() {
    if (!G || G.over || G.busy || G.review) return false;
    const c = G.st.turn;
    if (!human(c)) return false;
    if (G.clock && (G.clock.wait || G.clock.run !== c)) return false;
    if (pendingWrites() > 0) return false;
    return true;
  }
  function blockedReason() {
    if (!G || G.over || G.review) return null;
    if (G.clock && G.clock.wait && human(G.clock.wait)) return P('Press your clock first.', '먼저 시계를 누르세요.');
    if (pendingWrites() > 0) return P('Write the last move on the scoresheet first.', '먼저 기보지에 앞의 수를 적으세요.');
    if (!human(G.st.turn)) return P('Wait for your opponent.', '상대 차례예요.');
    return null;
  }
  async function next() {
    if (!G || G.over) return;
    refreshMarks(); renderControls();
    const c = G.st.turn;
    if (G.mode === 'legend') return legendNext();
    if (G.mode === 'ai' && c !== G.you) {
      if (G.clock && (G.clock.run !== c || G.clock.wait)) return;      // the computer waits for your clock press
      const my = gen; G.thinking = true; renderClock();
      const t0 = performance.now();
      const r = await AI.move(G.st, G.level);
      await new Promise(res => setTimeout(res, Math.max(0, (G && G.level <= 2 ? 650 : 400) - (performance.now() - t0))));
      if (my !== gen || !G || G.over) return;
      G.thinking = false; renderClock();
      const m = r && r.move && fromAI(r.move);
      if (!m) return;
      await play(m);
    }
  }
  const fromAI = mv => { const m = R.legal(G.st, mv.from).find(x => x.to === mv.to); return m && m.promo ? Object.assign({}, m, { promoTo: mv.promo || 'Q' }) : m; };

  // ===================== moving =====================
  function onSquare(n, dragging, plane) {
    if (!G || G.review) return;
    // 3D: a piece standing in front of the target square shouldn't steal the click
    if (plane && plane !== n && G.sel && canMove() && R.legal(G.st, G.sel).some(x => x.to === plane)) n = plane;
    if (!canMove()) { const r = blockedReason(); if (r && G.st.pos[n] && !G.tour) { say(r); sfx('bad'); } return; }
    const p = G.st.pos[n];
    if (G.sel && !dragging) {
      const m = R.legal(G.st, G.sel).find(x => x.to === n);
      if (m) return attempt(m);
    }
    if (p && p[0] === G.st.turn) { G.sel = n; sfx('select'); refreshMarks(); return; }
    if (G.sel && !G.tour) { const pm = R.pseudo(G.st, G.sel).find(x => x.to === n); if (pm) { say(P('That would leave your king in check.', '그렇게 두면 킹이 체크 상태로 남아요.')); sfx('bad'); } }
    G.sel = null; refreshMarks();
  }
  function onDrop(from, to) {
    if (!canMove()) return;
    const m = R.legal(G.st, from).find(x => x.to === to);
    if (m) attempt(m); else { sfx('bad'); G.sel = null; refreshMarks(); }
  }
  async function attempt(m) {
    G.sel = null; refreshMarks();
    if (m.promo) m = Object.assign({}, m, { promoTo: await choosePromo() });
    if (!G) return;
    if (G.mode === 'legend') return legendTry(m);
    if (G.beginner) {
      const my = gen; G.busy = true; say(P('Pawn is checking your move…', 'Pawn이 수를 확인하고 있어요…'));
      const r = await AI.check(G.st, { from: m.from, to: m.to, promo: m.promoTo }, 3, 650);
      if (my !== gen) return;
      G.busy = false; dropNote();
      if (r && r.loss >= 200 && Math.abs(r.bestScore) < 20000) {
        const ok = await warn(m, r);
        if (my !== gen) return;
        if (!ok) { refreshMarks(); return; }
      }
    }
    await play(m);
  }
  function choosePromo() {
    return new Promise(res => {
      const box = $('promo'); box.hidden = false;
      box.querySelectorAll('button').forEach(b => { b.onclick = () => { box.hidden = true; sfx('promote'); res(b.dataset.p); }; });
      box.querySelector('button').focus();
    });
  }
  // beginner mode: "are you sure?"
  function warn(m, r) {
    return new Promise(res => {
      const san = R.san(G.st, m), cap = r.reply && G.st.pos[r.reply.to];
      const after = R.apply(G.st, m);
      const victim = r.reply && after.pos[r.reply.to];
      const what = victim ? L(PIECE[victim[1]]) : null;
      view.arrows([{ from: m.from, to: m.to, kind: 'mine' }, ...(r.reply ? [{ from: r.reply.from, to: r.reply.to, kind: 'threat' }] : [])]);
      const replySan = r.reply ? R.san(after, R.legal(after, r.reply.from).find(x => x.to === r.reply.to) || {}) : '';
      const msg = Math.abs(r.score) > 20000
        ? P(`Careful: after ${san}, your opponent has a checkmate.`, `조심하세요: ${san}을(를) 두면 상대가 체크메이트할 수 있어요.`)
        : P(`Careful: after ${san}, your opponent can play ${replySan}${what ? ` and win your ${what}` : ''}. It costs about ${(r.loss / 100).toFixed(1)} points.`,
            `조심하세요: ${san}을(를) 두면 상대가 ${replySan}${what ? `(으)로 ${what}을(를) 잡을 수 있어요` : '을(를) 둘 수 있어요'}. 약 ${(r.loss / 100).toFixed(1)}점 손해예요.`);
      coach(msg, 'warn', [
        { t: P('Think again', '다시 생각하기'), fn: () => { view.arrows([]); res(false); } },
        { t: P('Play it anyway', '그래도 두기'), fn: () => { view.arrows([]); res(true); } }
      ]);
      sfx('check');
    });
  }

  // play a move on the board: animation, sounds, record, then hand over
  async function play(m) {
    const my = gen; G.busy = true; G.sel = null;
    const before = G.st;
    const san = record(m);
    const anim = view.move(m);
    sfx(m.castle ? 'move' : m.capture ? 'capture' : 'move');
    if (m.castle) sfx('place', { delay: .2 });
    if (m.promo) sfx('promote', { delay: .3 });
    await anim;
    if (my !== gen) return;
    if (R.inCheck(G.st.pos, G.st.turn)) sfx('check');
    G.busy = false;
    refreshMarks();
    if (ending()) return;
    const c = before.turn;
    if (G.clock) {
      if (human(c) && G.clock.manual) { G.clock.wait = c; renderClock(); coachPress(); return; }
      G.clock.wait = c; setTimeout(() => { if (my === gen && G && G.clock && G.clock.wait === c) press(c, true); }, human(c) ? 0 : 280);
      return;
    }
    next();
  }
  // add a move to the game record
  function record(m, silent) {
    const san = R.san(G.st, m);
    const pawnOrCap = m.piece[1] === 'P' || m.capture;
    const st = R.apply(G.st, m);
    G.hist.push({ st: G.st, m, san, by: G.st.turn, after: st });
    G.st = st;
    G.half = pawnOrCap ? 0 : G.half + 1;
    const key = Object.keys(st.pos).sort().map(k => k + st.pos[k]).join('') + st.turn + st.castle + (st.ep || '');
    G.reps[key] = (G.reps[key] || 0) + 1; G.lastKey = key;
    if (silent) { G.written = G.hist.length; view && view.set(G.st.pos); }
    renderSheet(true);
    return san;
  }

  // ===================== the end =====================
  function ending() {
    const s = R.status(G.st), loser = G.st.turn;
    if (s === 'mate') return finish(loser === 'w' ? '0-1' : '1-0', P('checkmate', '체크메이트'));
    if (s === 'stalemate') return finish('½-½', P('stalemate', '스테일메이트'));
    const left = Object.values(G.st.pos).filter(p => p[1] !== 'K');
    if (!left.length || (left.length === 1 && 'NB'.includes(left[0][1]))) return finish('½-½', P('not enough pieces to mate', '메이트할 기물 부족'));
    if (G.reps[G.lastKey] >= 3) return finish('½-½', P('the same position three times', '같은 장면 3회 반복'));
    if (G.half >= 100) return finish('½-½', P('fifty moves without a capture or pawn move', '50수 동안 잡기나 폰 이동 없음'));
    return false;
  }
  function finish(result, why) {
    G.over = { result, why };
    if (G.clock) { tickClock(); G.clock.run = null; G.clock.wait = null; }
    G.thinking = false;
    const win = result === '1-0' ? 'w' : result === '0-1' ? 'b' : null;
    const text = win ? P(`${G.names[win]} wins by ${why.en}.`, `${G.names[win]} 승리 (${why.ko}).`) : P(`Draw: ${why.en}.`, `무승부: ${why.ko}.`);
    const youWon = G.mode === 'ai' ? win === G.you : !!win;
    sfx(!win ? 'reset' : youWon || G.mode !== 'ai' ? 'complete' : 'bad');
    const acts = [{ t: P('Review the game', '복기하기'), fn: startReview }, { t: P('New game', '새 게임'), fn: () => { location.hash = ''; showSetup(); } }];
    if (G.mode === 'legend') acts.shift();
    coach(text, 'end', acts);
    renderSheet(); renderClock(); renderControls(); refreshMarks();
    return true;
  }
  function resign() {
    if (!G || G.over) return;
    if (!confirm(L(P('Resign this game?', '기권할까요?')))) return;
    const c = G.mode === 'two' ? G.st.turn : G.you;
    finish(c === 'w' ? '0-1' : '1-0', P('resignation', '기권'));
  }
  async function offerDraw() {
    if (!G || G.over) return;
    if (G.mode === 'two') { if (confirm(L(P('Both players agree to a draw?', '두 사람 모두 무승부에 동의하나요?')))) finish('½-½', P('agreement', '합의')); return; }
    const my = gen; say(P('The computer is considering your offer…', '컴퓨터가 제안을 생각하고 있어요…'));
    const r = await AI.analyse(G.st, 3, 500);
    if (my !== gen || !G || G.over) return;
    const aiScore = G.st.turn === G.you ? -r.score : r.score;
    if (aiScore <= -60 || (G.hist.length > 80 && Math.abs(aiScore) < 40)) finish('½-½', P('agreement', '합의'));
    else coach(P('The computer declines the draw. Play on!', '컴퓨터가 무승부를 거절했어요. 계속 두세요!'));
  }
  function takeback() {
    if (!G || G.over || G.busy || G.mode !== 'ai' || !(G.beginner || !G.clock)) return;
    let n = G.st.turn === G.you ? 2 : 1;
    if (G.hist.length < n) return;
    gen++; G.thinking = false;
    while (n--) { const h = G.hist.pop(); G.st = h.st; }
    G.written = Math.min(G.written, G.hist.length);
    G.reps = {}; G.half = 0;
    view.set(G.st.pos); G.sel = null;
    if (G.clock) { G.clock.wait = null; G.clock.run = G.st.turn; G.clock.at = performance.now(); }
    renderSheet(); renderClock(); refreshMarks(); say(P('Move taken back.', '수를 물렀어요.'));
    next();
  }
  $('resignBtn').addEventListener('click', resign);
  $('drawBtn').addEventListener('click', offerDraw);
  $('undoBtn').addEventListener('click', takeback);

  // ===================== the clock =====================
  function tickClock() {
    const C = G && G.clock; if (!C || !C.run || G.over) return;
    const now = performance.now(); C.t[C.run] -= now - C.at; C.at = now;
    if (C.t[C.run] <= 0) { C.t[C.run] = 0; const loser = C.run; sfx('flag'); const left = Object.values(G.st.pos).filter(p => p[0] !== loser && p[1] !== 'K'); finish(left.length ? (loser === 'w' ? '0-1' : '1-0') : '½-½', left.length ? P('time', '시간 초과') : P('time, but no pieces left to mate', '시간 초과, 그러나 메이트할 기물 없음')); }
  }
  let lastSec = -1;
  setInterval(() => {
    if (!G || !G.clock || G.over) return;
    tickClock(); renderClockTimes();
    const C = G.clock;
    if (C && C.run && human(C.run) && !G.tour) { const s = Math.ceil(C.t[C.run] / 1000); if (s <= 10 && s !== lastSec) { lastSec = s; sfx('lowtime'); } }
  }, 100);
  function press(c, auto) {
    const C = G && G.clock; if (!C || G.over || C.wait !== c) return;
    tickClock(); if (G.over) return;
    C.t[c] += C.inc; C.wait = null; C.run = other(c); C.at = performance.now();
    sfx('clock', { pan: c === 'w' ? -.4 : .4 });
    $('clock').classList.remove('nudge');
    renderClock();
    next();
  }
  const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); if (s >= 3600) return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function renderClock() {
    const box = $('clock');
    box.hidden = !G || !G.clock;
    $('thinking').hidden = !(G && G.thinking);
    $('thinking').textContent = L(P('The computer is thinking…', '컴퓨터가 생각하고 있어요…'));
    if (!G || !G.clock) return;
    const C = G.clock;
    ['w', 'b'].forEach(c => {
      const face = box.querySelector(`.ck[data-c="${c}"]`);
      face.classList.toggle('run', C.run === c && !G.over);
      face.classList.toggle('down', C.run !== c);
      face.classList.toggle('mine', human(c));
      face.querySelector('.ck-name').textContent = G.names[c];
      const btn = face.querySelector('.ck-btn');
      btn.disabled = C.wait !== c || !human(c);
      btn.setAttribute('aria-label', `${G.names[c]}: ${L(P('press the clock', '시계 누르기'))}`);
    });
    renderClockTimes();
  }
  function renderClockTimes() {
    if (!G || !G.clock) return;
    ['w', 'b'].forEach(c => { const el = $('clock').querySelector(`.ck[data-c="${c}"] .ck-t`); el.textContent = fmt(G.clock.t[c]); el.classList.toggle('low', G.clock.t[c] < 10000); });
  }
  $('clock').addEventListener('click', e => { const b = e.target.closest('.ck-btn'); if (b && !b.disabled) press(b.closest('.ck').dataset.c); });
  addEventListener('keydown', e => {
    if (e.code !== 'Space' || !G || !G.clock || !G.clock.wait || !human(G.clock.wait)) return;
    if (e.target.closest('input,textarea,button,[role="application"]') && !e.target.closest('.b2,.b3')) return;
    e.preventDefault(); press(G.clock.wait);
  });
  function coachPress() { if (!G.tour) $('clock').classList.add('nudge'); }

  // ===================== the scoresheet =====================
  const typed = s => s.replace(/[+#!?\s]/g, '').replace(/0/g, 'O').replace(/=/g, '');
  function accepts(input, san) {
    let a = typed(input), b = typed(san);
    if (a === b) return true;
    if (/^[nrqk]/.test(a) && a.toUpperCase()[0] === b[0] && a.slice(1) === b.slice(1)) return true;   // nf3 for Nf3
    if (/^b/.test(a) && b[0] === 'B' && a.slice(1) === b.slice(1)) return true;                        // bc4 for Bc4
    if (/^[a-h]x?[a-h][18][QRBN]$/i.test(a) && a.toUpperCase() === b.toUpperCase()) return true;      // e8q for e8=Q
    return false;
  }
  function renderSheet(fresh) {
    if (!G) return;
    const rows = Math.max(20, Math.ceil(G.hist.length / 2) + 2);
    const sheet = $('sheet');
    const rv = G.review;
    let html = `<div class="sh-head"><p class="cap">${L(P('Scoresheet', '기보지'))}</p>
      <dl><div><dt>${L(P('Event', '대회'))}</dt><dd class="hw">First Gambit</dd></div><div><dt>${L(P('Date', '날짜'))}</dt><dd class="hw">${G.date.toISOString().slice(0, 10)}</dd></div>
      <div><dt>${L(P('White', '백'))}</dt><dd class="hw">${esc(G.names.w)}</dd></div><div><dt>${L(P('Black', '흑'))}</dt><dd class="hw">${esc(G.names.b)}</dd></div>
      ${G.clock ? `<div><dt>${L(P('Time', '시간'))}</dt><dd class="hw">${L(UI[G.clock.label])}</dd></div>` : ''}<div><dt>${L(P('Result', '결과'))}</dt><dd class="hw">${G.over ? G.over.result : ''}</dd></div></dl></div>
      <table><thead><tr><th>#</th><th>${L(P('White', '백'))}</th><th>${L(P('Black', '흑'))}</th></tr></thead><tbody>`;
    for (let r = 0; r < rows; r++) {
      html += `<tr><td class="no">${r + 1}</td>`;
      for (let c = 0; c < 2; c++) {
        const i = r * 2 + c, h = G.hist[i];
        if (!h) { html += '<td></td>'; continue; }
        const pending = G.write && i >= G.written, isNext = pending && i === G.written;
        const mark = rv && rv.marks[i] ? `<sup class="mk-${rv.marks[i].cls}">${rv.marks[i].sym}</sup>` : '';
        const cur = rv && rv.at === i + 1 ? ' cur' : '';
        if (pending) html += `<td class="pend${isNext ? ' next' : ''}">${isNext ? `<input class="hw-in" id="writeIn" aria-label="${L(P('Write move', '수 적기'))} ${r + 1}${c ? '…' : '.'}" autocomplete="off" spellcheck="false" maxlength="9" placeholder="${G.wrongTries >= 2 && !G.tour ? esc(h.san) : ''}">` : ''}</td>`;
        else html += `<td class="mv${cur}" data-ply="${i + 1}"><span class="hw${fresh && i === G.hist.length - 1 && !G.write ? ' ink' : ''}">${esc(h.san)}</span>${mark}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    if (G.over) html += `<div class="sh-sign"><div><span class="hw">${esc(G.names.w)}</span><small>${L(P('White’s signature', '백 서명'))}</small></div><div><span class="hw">${esc(G.names.b)}</span><small>${L(P('Black’s signature', '흑 서명'))}</small></div></div>`;
    sheet.innerHTML = html;
    if (fresh && !G.write && G.hist.length) sfx('write', { delay: .35 });
    const inp = $('writeIn');
    if (inp) {
      inp.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const h = G.hist[G.written];
        if (accepts(inp.value, h.san)) { G.written++; G.wrongTries = 0; sfx('write'); renderSheet(); refreshMarks(); renderControls(); if (pendingWrites() === 0) next(); }
        else { G.wrongTries = (G.wrongTries || 0) + 1; inp.classList.remove('shake'); inp.getBoundingClientRect(); inp.classList.add('shake'); sfx('bad');
          if (G.tour) say(P('That doesn’t match the move on the board. Look again and write it in notation.', '판 위의 수와 맞지 않아요. 다시 보고 기보로 적어 보세요.'));
          else say(G.wrongTries >= 2 ? P(`Not quite. It was ${h.san}: write it in.`, `아쉬워요. ${h.san}였어요. 그대로 적어 보세요.`) : P('Not quite. Piece letter (none for a pawn), x for a capture, then the square.', '아쉬워요. 기물 알파벳(폰은 없음), 잡았으면 x, 그다음 칸을 적어요.'));
          if (G.wrongTries === 2 && !G.tour) { inp.placeholder = h.san; } }
      });
      if (!G.busy) setTimeout(() => { if (document.activeElement && document.activeElement.closest('.b2,.b3,.ck-btn')) return; inp.focus({ preventScroll: true }); }, 380);
    }
    const last = sheet.querySelector('td.cur') || sheet.querySelector('td.next') || [...sheet.querySelectorAll('td.mv')].pop();
    if (last) { const box = sheet.getBoundingClientRect(), r = last.getBoundingClientRect(); if (r.bottom > box.bottom || r.top < box.top) sheet.scrollTop += r.top - box.top - box.height / 2; }
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('sheet').addEventListener('click', e => { const td = e.target.closest('td.mv'); if (td && G && G.review) goReview(+td.dataset.ply); });

  // scoresheet as a picture, and the PGN
  async function saveSheet(blank) {
    blank = blank === true;
    if (!G && !blank) return;
    const S = blank ? { date: null, names: { w: '', b: '' }, over: null, clock: null, hist: [] } : G;   // blank: left to the pen
    try { await document.fonts.load('40px Caveat'); } catch (e) {}
    const W = 1240, H = 1754, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.fillStyle = '#FBFAF6'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#0B0B0B'; x.font = '500 30px Jost, Arial'; x.textBaseline = 'alphabetic';
    x.fillText('FIRST GAMBIT', 90, 120); x.font = '300 22px Jost, Arial'; x.fillText(L(P('OFFICIAL SCORESHEET', '공식 기보지')), 90, 156);
    const field = (lab, val, fx, fy, fw) => { x.font = '300 18px Jost, Arial'; x.fillStyle = '#5A5A56'; x.fillText(lab.toUpperCase(), fx, fy); x.strokeStyle = '#0B0B0B'; x.lineWidth = 1; x.beginPath(); x.moveTo(fx, fy + 44); x.lineTo(fx + fw, fy + 44); x.stroke(); x.fillStyle = '#1C2A4A'; x.font = '36px Caveat, cursive'; x.fillText(val, fx + 6, fy + 38); };
    field(L(P('Event', '대회')), 'First Gambit', 90, 220, 500); field(L(P('Date', '날짜')), (S.date ? S.date.toISOString().slice(0, 10) : ''), 650, 220, 500);
    field(L(P('White', '백')), S.names.w, 90, 300, 500); field(L(P('Black', '흑')), S.names.b, 650, 300, 500);
    field(L(P('Result', '결과')), S.over ? S.over.result : (blank ? '' : '*'), 90, 380, 500); field(L(P('Time control', '시간 규칙')), S.clock ? L(UI[S.clock.label]) : (blank ? '' : '—'), 650, 380, 500);
    const top = 480, rh = 38, rows = 30;
    for (let col = 0; col < 2; col++) {
      const cx = 90 + col * 560;
      x.strokeStyle = '#0B0B0B'; x.lineWidth = 1.5; x.strokeRect(cx, top, 500, rh * (rows + 1));
      x.font = '400 16px Jost, Arial'; x.fillStyle = '#0B0B0B'; x.fillText('#', cx + 16, top + 26); x.fillText(L(P('WHITE', '백')), cx + 90, top + 26); x.fillText(L(P('BLACK', '흑')), cx + 300, top + 26);
      for (let r = 0; r < rows; r++) {
        const y = top + rh * (r + 1), n = col * rows + r;
        x.strokeStyle = '#0B0B0B44'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx, y); x.lineTo(cx + 500, y); x.stroke();
        x.font = '300 16px Jost, Arial'; x.fillStyle = '#5A5A56'; x.fillText(String(n + 1), cx + 16, y + 26);
        x.fillStyle = '#1C2A4A'; x.font = '32px Caveat, cursive';
        const w = S.hist[n * 2], b = S.hist[n * 2 + 1];
        if (w) x.fillText(w.san, cx + 90, y + 29); if (b) x.fillText(b.san, cx + 300, y + 29);
      }
      x.strokeStyle = '#0B0B0B44'; x.beginPath(); x.moveTo(cx + 70, top); x.lineTo(cx + 70, top + rh * (rows + 1)); x.moveTo(cx + 280, top); x.lineTo(cx + 280, top + rh * (rows + 1)); x.stroke();
    }
    const sy = top + rh * (rows + 1) + 120;
    field(L(P('White’s signature', '백 서명')), S.names.w, 90, sy, 500); field(L(P('Black’s signature', '흑 서명')), S.names.b, 650, sy, 500);
    const a = document.createElement('a'); a.download = blank ? 'first-gambit-blank-scoresheet.png' : `first-gambit-scoresheet-${G.date.toISOString().slice(0, 10)}.png`; a.href = cv.toDataURL('image/png'); a.click();
  }
  function pgn() {
    if (!G) return '';
    const d = G.date.toISOString().slice(0, 10).replace(/-/g, '.');
    let s = `[Event "First Gambit"]\n[Site "${location.host || 'First Gambit'}"]\n[Date "${d}"]\n[White "${G.names.w}"]\n[Black "${G.names.b}"]\n[Result "${G.over ? G.over.result.replace('½-½', '1/2-1/2') : '*'}"]\n\n`;
    G.hist.forEach((h, i) => { s += (i % 2 === 0 ? `${i / 2 + 1}. ` : '') + h.san + ' '; });
    return s + (G.over ? G.over.result.replace('½-½', '1/2-1/2') : '*') + '\n';
  }
  $('saveBtn').addEventListener('click', saveSheet);
  $('pgnBtn').addEventListener('click', () => { const a = document.createElement('a'); a.download = 'first-gambit.pgn'; a.href = URL.createObjectURL(new Blob([pgn()], { type: 'application/x-chess-pgn' })); a.click(); });

  // ===================== the coach panel =====================
  function coach(text, kind = '', actions = []) {
    const last = G.coach[G.coach.length - 1];
    if (last && last.kind === 'note' && !last.actions.length) G.coach.pop();   // passing notes replace each other
    G.coach.push({ text, kind, actions });
    if (G.coach.length > 6) G.coach.shift();
    renderCoach();
  }
  const say = t => { if (G) coach(t, 'note'); };
  const dropNote = () => { const l = G.coach[G.coach.length - 1]; if (l && l.kind === 'note' && !l.actions.length) { G.coach.pop(); renderCoach(); } };
  function renderCoach() {
    if (!G) return;
    const box = $('coachLog');
    box.innerHTML = G.coach.map((c, i) => `<div class="co ${c.kind}"><p>${L(c.text)}</p>${c.actions.length && i === G.coach.length - 1 ? `<div class="co-acts">${c.actions.map((a, k) => `<button type="button" class="btn${k ? '' : ' ghost'}" data-act="${k}">${L(a.t)}</button>`).join('')}</div>` : ''}</div>`).join('');
    const last = G.coach[G.coach.length - 1];
    box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => { const a = last.actions[+b.dataset.act]; last.actions = []; renderCoach(); a.fn(); }));
    box.scrollTop = box.scrollHeight;
  }
  function renderControls() {
    if (!G) return;
    const live = !G.over && !G.review;
    $('resignBtn').hidden = !live || G.mode === 'legend';
    $('drawBtn').hidden = !live || G.mode === 'legend';
    $('undoBtn').hidden = !live || G.tour || G.mode !== 'ai' || !(G.beginner || !G.clock);
    $('undoBtn').disabled = G.hist.length < (G.st.turn === G.you ? 2 : 1);
    $('hintBtn').hidden = !live || G.mode === 'two' || G.tour;
    $('saveBtn').hidden = !G.hist.length; $('pgnBtn').hidden = !G.hist.length;
    $('peekBtn').hidden = !G.ceiling || !!G.review;
    $('peekBtn').textContent = `${L(P('Peek', '엿보기'))} (${G.peeks})`; $('peekBtn').disabled = G.peeks <= 0 || G.peeking;
  }

  // ===================== marks on the board =====================
  function refreshMarks() {
    if (!G || !view) return;
    const last = G.review ? (G.review.at > 0 ? G.hist[G.review.at - 1] : null) : G.hist[G.hist.length - 1];
    const st = G.review ? (G.review.at > 0 ? G.hist[G.review.at - 1].after : G.hist[0].st) : G.st;
    const k = R.inCheck(st.pos, st.turn) ? R.kingOf(st.pos, st.turn) : null;
    view.marks({
      last: last ? [last.m.from, last.m.to] : [], check: k, sel: G.sel, hint: G.legHint,
      moves: G.sel && !G.tour ? R.legal(G.st, G.sel).filter((m, i, a) => a.findIndex(x => x.to === m.to) === i).map(m => ({ to: m.to, capture: !!m.capture })) : []
    });
  }

  // ===================== hints =====================
  async function hint() {
    if (!G || G.over || G.mode === 'two') return;
    if (G.mode === 'legend') { legendHint(); return; }
    if (G.st.turn !== G.you) return;
    const my = gen; say(P('Pawn is looking…', 'Pawn이 살펴보고 있어요…'));
    const r = await AI.analyse(G.st, 4, 700);
    if (my !== gen || !G || !r.move) return;
    G.legHint = r.move.from; refreshMarks();
    coach(P(`Pawn suggests moving your ${L(PIECE[G.st.pos[r.move.from][1]])} on ${r.move.from}.`, `Pawn은 ${r.move.from}의 ${L(PIECE[G.st.pos[r.move.from][1]])}을(를) 움직여 보라고 해요.`));
    setTimeout(() => { if (G && my === gen) { G.legHint = null; refreshMarks(); } }, 4000);
  }
  $('hintBtn').addEventListener('click', hint);

  // ===================== ceiling mode =====================
  $('peekBtn').addEventListener('click', () => {
    if (!G || !G.ceiling || G.peeks <= 0 || G.peeking) return;
    G.peeks--; G.peeking = true; view.hidePieces(false); sfx('whoosh'); renderControls();
    setTimeout(() => { if (!G) return; G.peeking = false; if (!G.review && !G.over) view.hidePieces(true); renderControls(); }, 2000);
  });

  // ===================== legends =====================
  const legMoves = () => G.leg.moves.split(' ');
  async function legendNext() {
    const list = legMoves();
    if (G.legPly >= list.length) return legendEnd();
    const c = G.st.turn;
    if (c === G.you) { G.legTries = 0; refreshMarks(); return; }
    const my = gen;
    await new Promise(r => setTimeout(r, 750));
    if (my !== gen || !G) return;
    const m = fromSan(G.st, list[G.legPly]);
    await legendPlay(m);
  }
  async function legendPlay(m) {
    const ply = G.legPly; G.legPly++; G.legHint = null;
    G.busy = true;
    const by = G.st.turn;
    record(m);
    sfx(m.capture ? 'capture' : 'move'); if (m.castle) sfx('place', { delay: .2 });
    await view.move(m);
    G.busy = false;
    if (R.inCheck(G.st.pos, G.st.turn)) sfx('check');
    const note = G.leg.notes[ply];
    if (note) coach(P(`${Math.floor(ply / 2) + 1}${by === 'w' ? '.' : '...'} ${G.hist[G.hist.length - 1].san}: ${note.en}`, `${Math.floor(ply / 2) + 1}${by === 'w' ? '.' : '...'} ${G.hist[G.hist.length - 1].san}: ${note.ko}`), 'story');
    refreshMarks();
    legendNext();
  }
  async function legendTry(m) {
    const want = fromSan(G.st, legMoves()[G.legPly]);
    const hero = L(G.leg.hero);
    if (want && m.from === want.from && m.to === want.to && (m.promoTo || 'Q') === (want.promoTo || 'Q')) {
      if (G.legTries === 0) G.legScore++;
      G.legTries = 0; sfx('good');
      say(P(`Yes! ${hero} played that too.`, `맞아요! ${hero}도 그렇게 뒀어요.`));
      return legendPlay(want);
    }
    G.legTries++;
    sfx('bad');
    const san = R.san(G.st, m);
    if (G.legTries === 1) {
      G.legHint = want.from; refreshMarks();
      say(P(`${san} is not what ${hero} played. Hint: the piece on ${want.from}.`, `${san}은(는) ${hero}의 수가 아니에요. 힌트: ${want.from}의 기물이에요.`));
    } else {
      view.arrows([{ from: want.from, to: want.to }]);
      say(P(`${hero} played ${R.san(G.st, want)}.`, `${hero}는 ${R.san(G.st, want)}을(를) 뒀어요.`));
      const my = gen; await new Promise(r => setTimeout(r, 1200)); if (my !== gen) return;
      view.arrows([]); G.legTries = 0;
      return legendPlay(want);
    }
  }
  function legendHint() {
    const want = fromSan(G.st, legMoves()[G.legPly]); if (!want || G.st.turn !== G.you) return;
    G.legTries = Math.max(G.legTries, 1); G.legHint = want.from; refreshMarks();
    say(P(`Look at the piece on ${want.from}.`, `${want.from}의 기물을 보세요.`));
  }
  function legendEnd() {
    const mine = legMoves().filter((_, i) => (i % 2 === 0 ? 'w' : 'b') === G.you).length;
    const result = R.status(G.st) === 'mate' ? (G.st.turn === 'w' ? '0-1' : '1-0') : (G.leg.winner === 'w' ? '1-0' : '0-1');
    const why = R.status(G.st) === 'mate' ? P('checkmate', '체크메이트') : P('resignation', '기권');
    coach(P(`You found ${G.legScore} of ${mine} of ${L(G.leg.hero)}’s moves on the first try.`, `${L(G.leg.hero)}의 수 ${mine}개 중 ${G.legScore}개를 첫 시도에 맞혔어요.`), 'end');
    finish(result, why);
  }

  // ===================== review =====================
  async function startReview() {
    if (!G || !G.hist.length) return;
    const my = gen;
    G.review = { at: G.hist.length, data: [], marks: {}, done: false };
    $('game').classList.add('reviewing');
    $('evalBar').hidden = false; $('reviewNav').hidden = false;
    view.hidePieces(false);
    renderControls(); goReview(G.hist.length);
    coach(P('Pawn is analysing the game…', 'Pawn이 게임을 분석하고 있어요…'), 'note');
    const positions = [G.hist[0].st, ...G.hist.map(h => h.after)];
    const data = [];
    for (let i = 0; i < positions.length; i++) {
      const st = positions[i], s = R.status(st);
      let a;
      if (s === 'mate') a = { score: -30000, move: null }; else if (s === 'stalemate') a = { score: 0, move: null };
      else a = await AI.analyse(st, 4, 260);
      if (my !== gen || !G || !G.review) return;
      data.push({ score: Math.max(-1500, Math.min(1500, a.score)), raw: a.score, move: a.move, turn: st.turn });
      $('reviewProg').style.width = (100 * (i + 1) / positions.length) + '%';
      if (i > 0) markPly(i - 1, data);
      G.review.data = data;
      if (G.review.at === i) drawEval();
    }
    G.review.done = true;
    // key moments: the three biggest drops
    const drops = G.hist.map((h, i) => ({ i, loss: lossAt(i, data) })).filter(x => x.loss >= 70).sort((a, b) => b.loss - a.loss).slice(0, 3).sort((a, b) => a.i - b.i);
    if (!drops.length) coach(P('No big mistakes. A clean game!', '큰 실수가 없어요. 깔끔한 게임이에요!'), 'end');
    else coach(P('Key moments: click one to see it on the board.', '결정적인 순간들이에요. 누르면 판에서 볼 수 있어요.'), 'end', drops.map(d => ({ t: momentLabel(d.i, data), fn: () => { goReview(d.i + 1); explain(d.i, data); } })));
    renderSheet();
  }
  function lossAt(i, data) {
    const a = data[i], b = data[i + 1]; if (!a || !b) return 0;
    return Math.max(0, a.score + b.score);   // best for the mover minus what the move left
  }
  function markPly(i, data) {
    const loss = lossAt(i, data), h = G.hist[i];
    const best = data[i].move && data[i].move.from === h.m.from && data[i].move.to === h.m.to;
    G.review.marks[i] = loss >= 300 ? { sym: '??', cls: 'blunder' } : loss >= 150 ? { sym: '?', cls: 'mistake' } : loss >= 70 ? { sym: '?!', cls: 'dubious' } : best ? { sym: '✓', cls: 'best' } : null;
    if (i % 4 === 3) renderSheet();
  }
  function momentLabel(i, data) { const h = G.hist[i], no = Math.floor(i / 2) + 1; return P(`${no}${h.by === 'w' ? '.' : '...'} ${h.san}${G.review.marks[i] ? G.review.marks[i].sym : ''}`, `${no}${h.by === 'w' ? '.' : '...'} ${h.san}${G.review.marks[i] ? G.review.marks[i].sym : ''}`); }
  function explain(i, data) {
    const h = G.hist[i], d = data[i], loss = lossAt(i, data), no = `${Math.floor(i / 2) + 1}${h.by === 'w' ? '.' : '...'}`;
    const bestSan = d.move ? R.san(h.st, R.legal(h.st, d.move.from).find(x => x.to === d.move.to) || h.m) : '';
    const rep = data[i + 1] && data[i + 1].move ? R.san(h.after, R.legal(h.after, data[i + 1].move.from).find(x => x.to === data[i + 1].move.to) || {}) : '';
    coach(P(`${no} ${h.san} lost about ${(loss / 100).toFixed(1)} points.${rep ? ` After it, ${rep} is strong.` : ''} Better was ${bestSan}.`,
      `${no} ${h.san}은(는) 약 ${(loss / 100).toFixed(1)}점 손해였어요.${rep ? ` 이 수 다음에는 ${rep}이(가) 강해요.` : ''} 더 좋은 수는 ${bestSan}이었어요.`), 'note');
  }
  function goReview(at) {
    if (!G || !G.review) return;
    at = Math.max(0, Math.min(G.hist.length, at)); G.review.at = at;
    const st = at > 0 ? G.hist[at - 1].after : G.hist[0].st;
    view.set(st.pos); refreshMarks();
    const d = G.review.data;
    const arrows = [];
    if (at > 0) { const h = G.hist[at - 1]; arrows.push({ from: h.m.from, to: h.m.to, kind: 'mine' }); const b = d[at - 1] && d[at - 1].move; if (b && (b.from !== h.m.from || b.to !== h.m.to) && lossAt(at - 1, d) >= 70) arrows.push({ from: b.from, to: b.to, kind: 'best' }); }
    view.arrows(arrows);
    drawEval(); renderSheet();
    $('revLabel').textContent = at === 0 ? L(P('Start', '시작')) : `${Math.floor((at - 1) / 2) + 1}${G.hist[at - 1].by === 'w' ? '.' : '...'} ${G.hist[at - 1].san}`;
  }
  function drawEval() {
    const d = G.review && G.review.data[G.review.at]; if (!d) return;
    const e = d.turn === 'w' ? d.score : -d.score, mate = Math.abs(d.raw) > 20000;
    const pct = 50 + 50 * Math.tanh(e / 450);
    $('evalFill').style.height = pct + '%';
    $('evalNum').textContent = mate ? 'M' : (e > 0 ? '+' : '') + (e / 100).toFixed(1);
  }
  $('revFirst').addEventListener('click', () => goReview(0));
  $('revPrev').addEventListener('click', () => goReview(G.review.at - 1));
  $('revNext').addEventListener('click', () => goReview(G.review.at + 1));
  $('revLast').addEventListener('click', () => goReview(G.hist.length));
  addEventListener('keydown', e => { if (!G || !G.review || e.target.closest('input')) return; if (e.key === 'ArrowLeft') goReview(G.review.at - 1); if (e.key === 'ArrowRight') goReview(G.review.at + 1); });

  // ===================== what Pawn can read =====================
  window.FG_PLAY = {
    active: () => !!G,
    context() {
      if (!G) return { page: 'play', view: 'setup', options: cfg };
      const rv = G.review, at = rv ? rv.at : G.hist.length;
      const ctx = { page: 'play', mode: G.mode, youPlay: G.mode === 'two' ? 'both' : G.you === 'w' ? 'white' : 'black', level: G.mode === 'ai' ? G.level : null,
        moves: G.hist.map((h, i) => (i % 2 === 0 ? `${i / 2 + 1}. ` : '') + h.san).join(' '),
        toMove: G.st.turn === 'w' ? 'white' : 'black', position: Object.entries(G.st.pos).map(([s, p]) => p + s).join(' '),
        result: G.over ? `${G.over.result} (${G.over.why.en})` : null, legend: G.leg ? G.leg.title.en : null };
      if (rv && at > 0 && rv.data[at - 1]) {
        const h = G.hist[at - 1], d = rv.data[at - 1];
        ctx.reviewing = { move: `${Math.floor((at - 1) / 2) + 1}${h.by === 'w' ? '.' : '...'} ${h.san}`, pointsLost: (lossAt(at - 1, rv.data) / 100).toFixed(1), engineBest: d.move ? `${d.move.from}-${d.move.to}` : null };
      }
      ctx.note = 'Explain to a beginner. If they ask what to play, suggest an idea or a piece rather than giving the exact move, unless they insist.';
      return ctx;
    },
    async hint(l) {
      if (G && G.tour && !G.over) return l === 'ko' ? '토너먼트 규칙이라 대국 중에는 도와드릴 수 없어요. 게임이 끝나면 복기에서 함께 봐요.' : 'Tournament rules: no help during the game. Ask me again in the review.';
      if (!G || G.over || G.mode === 'two' || G.st.turn !== G.you) return l === 'ko' ? '지금은 힌트를 드릴 차례가 아니에요.' : 'There is nothing to hint right now.';
      const r = await AI.analyse(G.st, 4, 600);
      if (!r.move || !G) return l === 'ko' ? '잘 모르겠어요.' : 'I am not sure.';
      const pc = G.st.pos[r.move.from][1];
      G.legHint = r.move.from; refreshMarks(); setTimeout(() => { if (G) { G.legHint = null; refreshMarks(); } }, 4000);
      return l === 'ko' ? `${r.move.from}의 ${PIECE[pc].ko}을(를) 살펴보세요. 거기에 좋은 수가 있어요.` : `Look at your ${PIECE[pc].en} on ${r.move.from}. There is a good move with it.`;
    }
  };

  renderSetup();
  if (location.hash === '#game') history.replaceState(null, '', location.pathname);
})();
