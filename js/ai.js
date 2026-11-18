// The computer opponent. A small chess engine: 0x88 board, legal move generation, a material +
// piece-square evaluation, and an alpha-beta search with quiescence, iterative deepening, a
// transposition table and killer moves. It runs in a Web Worker so the page never freezes; if a
// worker can't start it runs on the page instead.
// Five levels: 1 (just learned the rules) to 5 (a solid club player on a phone's time budget).
function FG_AI_CORE() {
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const VAL = [0, 100, 320, 330, 500, 900, 0];
  const FILES = 'abcdefgh';
  const idx = s => (+s[1] - 1) * 16 + FILES.indexOf(s[0]);
  const nameOf = i => FILES[i & 7] + ((i >> 4) + 1);
  const TYPE = { P, N, B, R, Q, K }, LETTER = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];
  const KN = [33, 31, 18, 14, -33, -31, -18, -14], KG = [1, -1, 16, -16, 17, 15, -17, -15];
  const DB = [17, 15, -17, -15], DR = [1, -1, 16, -16];

  // piece-square tables (Tomasz Michniewski's "simplified evaluation"), written from White's side, a8 first
  const T = {
    1: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    2: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    3: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    4: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    5: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    6: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
    7: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50]
  };
  // PST lookup for 0x88 square and colour
  const pst = (t, i, white, end) => { const f = i & 7, r = i >> 4, row = white ? 7 - r : r; return T[t === K && end ? 7 : t][row * 8 + f]; };

  // ---------- state ----------
  const bd = new Int8Array(128);
  let side = 1, castle = 0, ep = -1, kings = [0, 0];   // kings[0] white, kings[1] black
  const stack = [];
  // Zobrist keys (two 31-bit halves)
  let seed = 1234567;
  const rnd = () => (seed = (seed * 16807) % 2147483647);
  const Z = []; for (let i = 0; i < 13 * 128; i++) Z.push([rnd(), rnd()]);
  const ZS = [rnd(), rnd()], ZC = Array.from({ length: 16 }, () => [rnd(), rnd()]), ZE = Array.from({ length: 128 }, () => [rnd(), rnd()]);
  let h1 = 0, h2 = 0;
  const zp = (p, i) => Z[(p + 6) * 128 + i];
  function rehash() {
    h1 = 0; h2 = 0;
    for (let i = 0; i < 128; i++) if (!(i & 0x88) && bd[i]) { const z = zp(bd[i], i); h1 ^= z[0]; h2 ^= z[1]; }
    if (side < 0) { h1 ^= ZS[0]; h2 ^= ZS[1]; }
    h1 ^= ZC[castle][0]; h2 ^= ZC[castle][1];
    if (ep >= 0) { h1 ^= ZE[ep][0]; h2 ^= ZE[ep][1]; }
  }
  function load(st) {
    bd.fill(0);
    for (const s in st.pos) { const c = st.pos[s], i = idx(s); bd[i] = TYPE[c[1]] * (c[0] === 'w' ? 1 : -1); if (c[1] === 'K') kings[c[0] === 'w' ? 0 : 1] = i; }
    side = st.turn === 'w' ? 1 : -1;
    castle = (st.castle || '').split('').reduce((a, ch) => a | ({ K: 1, Q: 2, k: 4, q: 8 }[ch] || 0), 0);
    ep = st.ep ? idx(st.ep) : -1;
    stack.length = 0; rehash();
  }

  function attacked(i, by) {        // is square i attacked by side `by` (1 or -1)?
    const pr = by > 0 ? -16 : 16;   // pawns attack from one rank behind (from the defender's view)
    for (const d of [pr - 1, pr + 1]) { const j = i + d; if (!(j & 0x88) && bd[j] === P * by) return true; }
    for (const d of KN) { const j = i + d; if (!(j & 0x88) && bd[j] === N * by) return true; }
    for (const d of KG) { const j = i + d; if (!(j & 0x88) && bd[j] === K * by) return true; }
    for (const d of DB) for (let j = i + d; !(j & 0x88); j += d) { const p = bd[j]; if (p) { if (p === B * by || p === Q * by) return true; break; } }
    for (const d of DR) for (let j = i + d; !(j & 0x88); j += d) { const p = bd[j]; if (p) { if (p === R * by || p === Q * by) return true; break; } }
    return false;
  }
  const inCheck = s => attacked(kings[s > 0 ? 0 : 1], -s);

  // move = from | to << 7 | promo << 14 | flag << 17   (flags: 1 double, 2 ep, 4 castle)
  const mk = (f, t, pr = 0, fl = 0) => f | (t << 7) | (pr << 14) | (fl << 17);
  const mFrom = m => m & 127, mTo = m => (m >> 7) & 127, mPro = m => (m >> 14) & 7, mFl = m => (m >> 17) & 7;

  function gen(list, capsOnly) {
    const s = side;
    for (let i = 0; i < 128; i++) {
      if (i & 0x88) { i += 7; continue; }
      const p = bd[i]; if (!p || (p > 0) !== (s > 0)) continue;
      const t = p * s;
      if (t === P) {
        const d = 16 * s, last = s > 0 ? 7 : 0, start = s > 0 ? 1 : 6, j = i + d;
        const push = (to, fl) => { if ((to >> 4) === last) { for (const pr of [Q, N, R, B]) list.push(mk(i, to, pr, fl)); } else list.push(mk(i, to, 0, fl)); };
        if (!capsOnly || (j >> 4) === last) if (!(j & 0x88) && !bd[j]) { push(j, 0); if (!capsOnly && (i >> 4) === start && !bd[j + d]) list.push(mk(i, j + d, 0, 1)); }
        for (const dc of [d - 1, d + 1]) { const c = i + dc; if (c & 0x88) continue; if (bd[c] && (bd[c] > 0) !== (s > 0)) push(c, 0); else if (c === ep) list.push(mk(i, c, 0, 2)); }
      } else if (t === N || t === K) {
        for (const d of (t === N ? KN : KG)) { const j = i + d; if (j & 0x88) continue; const q = bd[j]; if (!q) { if (!capsOnly) list.push(mk(i, j)); } else if ((q > 0) !== (s > 0)) list.push(mk(i, j)); }
        if (t === K && !capsOnly) {
          const home = s > 0 ? 4 : 116, kr = s > 0 ? 1 : 4, qr = s > 0 ? 2 : 8;
          if (i === home && !attacked(i, -s)) {
            if ((castle & kr) && !bd[i + 1] && !bd[i + 2] && bd[i + 3] === R * s && !attacked(i + 1, -s) && !attacked(i + 2, -s)) list.push(mk(i, i + 2, 0, 4));
            if ((castle & qr) && !bd[i - 1] && !bd[i - 2] && !bd[i - 3] && bd[i - 4] === R * s && !attacked(i - 1, -s) && !attacked(i - 2, -s)) list.push(mk(i, i - 2, 0, 4));
          }
        }
      } else {
        const dirs = t === B ? DB : t === R ? DR : KG;
        for (const d of dirs) for (let j = i + d; !(j & 0x88); j += d) { const q = bd[j]; if (!q) { if (!capsOnly) list.push(mk(i, j)); } else { if ((q > 0) !== (s > 0)) list.push(mk(i, j)); break; } }
      }
    }
    return list;
  }

  const CR = new Uint8Array(128).fill(15);
  CR[0] = 15 & ~2; CR[7] = 15 & ~1; CR[4] = 15 & ~3; CR[112] = 15 & ~8; CR[119] = 15 & ~4; CR[116] = 15 & ~12;
  function make(m) {
    const f = mFrom(m), t = mTo(m), pr = mPro(m), fl = mFl(m), p = bd[f], s = side;
    let cap = bd[t], capSq = t;
    if (fl === 2) { capSq = t - 16 * s; cap = bd[capSq]; }
    stack.push([m, cap, capSq, castle, ep, h1, h2]);
    const x = (pc, i) => { const z = zp(pc, i); h1 ^= z[0]; h2 ^= z[1]; };
    if (cap) { x(cap, capSq); bd[capSq] = 0; }
    x(p, f); bd[f] = 0;
    const np = pr ? pr * s : p; bd[t] = np; x(np, t);
    if (fl === 4) { const rf = t > f ? f + 3 : f - 4, rt = t > f ? f + 1 : f - 1; x(bd[rf], rf); bd[rt] = bd[rf]; bd[rf] = 0; x(bd[rt], rt); }
    if (p * s === K) kings[s > 0 ? 0 : 1] = t;
    h1 ^= ZC[castle][0]; h2 ^= ZC[castle][1]; castle &= CR[f] & CR[t]; h1 ^= ZC[castle][0]; h2 ^= ZC[castle][1];
    if (ep >= 0) { h1 ^= ZE[ep][0]; h2 ^= ZE[ep][1]; }
    ep = fl === 1 ? f + 16 * s : -1;
    if (ep >= 0) { h1 ^= ZE[ep][0]; h2 ^= ZE[ep][1]; }
    side = -s; h1 ^= ZS[0]; h2 ^= ZS[1];
  }
  function unmake() {
    const [m, cap, capSq, c0, e0, a1, a2] = stack.pop();
    const f = mFrom(m), t = mTo(m), pr = mPro(m), fl = mFl(m);
    side = -side; const s = side;
    const p = pr ? P * s : bd[t];
    bd[f] = p; bd[t] = 0; if (cap) bd[capSq] = cap;
    if (fl === 4) { const rf = t > f ? f + 3 : f - 4, rt = t > f ? f + 1 : f - 1; bd[rf] = bd[rt]; bd[rt] = 0; }
    if (p * s === K) kings[s > 0 ? 0 : 1] = f;
    castle = c0; ep = e0; h1 = a1; h2 = a2;
  }
  function legal() {
    const out = [], list = gen([], false), s = side;
    for (const m of list) { make(m); if (!inCheck(s)) out.push(m); unmake(); }
    return out;
  }

  // ---------- evaluation (centipawns, from the side to move) ----------
  function evaluate() {
    let mg = 0, phase = 0, wb = 0, bb = 0;
    for (let i = 0; i < 128; i++) {
      if (i & 0x88) { i += 7; continue; }
      const p = bd[i]; if (!p) continue;
      const t = p > 0 ? p : -p, w = p > 0;
      if (t === N || t === B) phase += 1; else if (t === R) phase += 2; else if (t === Q) phase += 4;
      if (t === B) { if (w) wb++; else bb++; }
    }
    const end = phase <= 6;
    for (let i = 0; i < 128; i++) {
      if (i & 0x88) { i += 7; continue; }
      const p = bd[i]; if (!p) continue;
      const t = p > 0 ? p : -p, w = p > 0;
      const v = VAL[t] + pst(t, i, w, end);
      mg += w ? v : -v;
    }
    if (wb >= 2) mg += 30; if (bb >= 2) mg -= 30;
    return mg * side;
  }

  // ---------- search ----------
  const MATE = 30000, TT_SIZE = 1 << 18;
  const ttKey = new Int32Array(TT_SIZE), ttMove = new Int32Array(TT_SIZE), ttDepth = new Int8Array(TT_SIZE), ttScore = new Int32Array(TT_SIZE), ttFlag = new Int8Array(TT_SIZE);
  let nodes = 0, stopAt = 0, stopped = false;
  const killers = Array.from({ length: 64 }, () => [0, 0]);
  const hist = [];   // positions in this line, for repetition
  function order(list, ply, ttm) {
    const sc = list.map(m => {
      if (m === ttm) return 1e6;
      const cap = mFl(m) === 2 ? P : Math.abs(bd[mTo(m)]);
      if (cap) return 1e5 + VAL[cap] * 10 - VAL[Math.abs(bd[mFrom(m)])] / 10;
      if (mPro(m)) return 9e4;
      if (killers[ply] && (killers[ply][0] === m || killers[ply][1] === m)) return 8e4;
      return 0;
    });
    const ix = list.map((_, i) => i).sort((a, b) => sc[b] - sc[a]);
    return ix.map(i => list[i]);
  }
  function quiesce(alpha, beta, ply) {
    if ((++nodes & 2047) === 0 && Date.now() > stopAt) stopped = true;
    if (stopped) return 0;
    const stand = evaluate();
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    const s = side;
    for (const m of order(gen([], true), 63, 0)) {
      make(m);
      if (inCheck(s)) { unmake(); continue; }
      const v = -quiesce(-beta, -alpha, ply + 1);
      unmake();
      if (v >= beta) return beta;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function search(depth, alpha, beta, ply) {
    if ((++nodes & 2047) === 0 && Date.now() > stopAt) stopped = true;
    if (stopped) return 0;
    const key = h1, slot = h2 & (TT_SIZE - 1);
    if (ply && hist.includes(key ^ h2 * 7)) return 0;   // repetition: a draw
    const check = inCheck(side);
    if (check) depth++;
    if (depth <= 0) return quiesce(alpha, beta, ply);
    let ttm = 0;
    if (ttKey[slot] === key) {
      ttm = ttMove[slot];
      if (ply && ttDepth[slot] >= depth) {
        const v = ttScore[slot], fl = ttFlag[slot];
        if (fl === 0) return v; if (fl === 1 && v >= beta) return v; if (fl === 2 && v <= alpha) return v;
      }
    }
    const s = side, a0 = alpha;
    let best = -MATE - 1, bestM = 0, any = false;
    hist.push(key ^ h2 * 7);
    for (const m of order(gen([], false), ply, ttm)) {
      make(m);
      if (inCheck(s)) { unmake(); continue; }
      any = true;
      const v = -search(depth - 1, -beta, -alpha, ply + 1);
      unmake();
      if (stopped) { hist.pop(); return 0; }
      if (v > best) { best = v; bestM = m; }
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        if (!bd[mTo(m)] && killers[ply]) { killers[ply][1] = killers[ply][0]; killers[ply][0] = m; }
        break;
      }
    }
    hist.pop();
    if (!any) return check ? -MATE + ply : 0;
    ttKey[slot] = key; ttMove[slot] = bestM; ttDepth[slot] = depth; ttScore[slot] = best; ttFlag[slot] = best <= a0 ? 2 : best >= beta ? 1 : 0;
    return best;
  }
  // score every root move exactly (used by the weaker levels and by the blunder check)
  function rootScores(depth, ms) {
    stopAt = Date.now() + ms; stopped = false; nodes = 0;
    const out = [], s = side;
    for (const m of legal()) {
      make(m);
      const v = -search(depth - 1, -MATE - 1, MATE + 1, 1);
      unmake();
      out.push([m, v]);
      if (stopped) break;
    }
    return out;
  }
  function think(maxDepth, ms) {
    stopAt = Date.now() + ms; stopped = false; nodes = 0;
    let bestM = 0, bestV = 0;
    const root = legal();
    if (!root.length) return { move: 0, score: inCheck(side) ? -MATE : 0, depth: 0 };
    for (let d = 1; d <= maxDepth; d++) {
      let alpha = -MATE - 1, cur = 0, curV = -MATE - 1;
      const ordered = bestM ? [bestM, ...root.filter(m => m !== bestM)] : order(root, 0, 0);
      for (const m of ordered) {
        make(m);
        const v = -search(d - 1, -MATE - 1, -alpha, 1);
        unmake();
        if (stopped) break;
        if (v > curV) { curV = v; cur = m; }
        if (v > alpha) alpha = v;
      }
      if (stopped && !cur) break;
      if (cur) { bestM = cur; bestV = curV; }
      if (stopped || Math.abs(bestV) > MATE - 100) { if (!stopped) return { move: bestM, score: bestV, depth: d }; break; }
    }
    return { move: bestM, score: bestV, depth: maxDepth };
  }

  const LEVELS = {
    1: { depth: 1, noise: 260, random: .25, ms: 300 },
    2: { depth: 2, noise: 120, random: .08, ms: 500 },
    3: { depth: 3, noise: 22, random: 0, ms: 800 },
    4: { depth: 4, noise: 6, random: 0, ms: 1200 },
    5: { depth: 8, noise: 0, random: 0, ms: 2200 }
  };
  const toObj = m => m ? { from: nameOf(mFrom(m)), to: nameOf(mTo(m)), promo: mPro(m) ? LETTER[mPro(m)] : null } : null;
  const fromObj = o => legal().find(m => nameOf(mFrom(m)) === o.from && nameOf(mTo(m)) === o.to && (!mPro(m) || LETTER[mPro(m)] === (o.promo || 'Q')));

  function bestMove(st, level) {
    load(st);
    const L = LEVELS[level] || LEVELS[3];
    if (L.noise === 0) { const r = think(L.depth, L.ms); return { move: toObj(r.move), score: r.score }; }
    let sc = rootScores(L.depth, L.ms);
    if (!sc.length) return { move: null, score: 0 };
    // mates are never blurred away; everything else gets a little human noise
    const top = Math.max(...sc.map(x => x[1]));
    if (top > MATE - 100) { const m = sc.find(x => x[1] === top); return { move: toObj(m[0]), score: top }; }
    if (Math.random() < L.random) { const m = sc[Math.floor(Math.random() * sc.length)]; return { move: toObj(m[0]), score: m[1] }; }
    sc = sc.map(([m, v]) => [m, v + (Math.random() * 2 - 1) * L.noise]);
    sc.sort((a, b) => b[1] - a[1]);
    return { move: toObj(sc[0][0]), score: sc[0][1] };
  }
  // best move and score at a fixed budget (for hints and review)
  function analyse(st, depth = 4, ms = 600) {
    load(st);
    const r = think(depth, ms);
    return { move: toObj(r.move), score: r.score };
  }
  // how much a candidate move loses compared with the best one, and what the opponent wins after it
  function checkMove(st, mv, depth = 3, ms = 700) {
    load(st);
    const m = fromObj(mv); if (!m) return null;
    const all = rootScores(depth, ms);
    const best = all.reduce((a, b) => (b[1] > a[1] ? b : a), all[0]);
    const mine = all.find(x => x[0] === m) || [m, best[1]];
    // the reply that punishes it
    make(m); const rep = think(Math.max(1, depth - 1), Math.max(150, ms / 3)); unmake();
    return { best: toObj(best[0]), bestScore: best[1], score: mine[1], loss: best[1] - mine[1], reply: toObj(rep.move) };
  }
  function perft(st, d) { load(st); const go = n => { if (!n) return 1; let c = 0; for (const m of legal()) { make(m); c += go(n - 1); unmake(); } return c; }; return go(d); }

  return { bestMove, analyse, checkMove, perft, MATE };
}

// ---------- the page side: a worker when possible, otherwise direct calls ----------
(function () {
  if (typeof window === 'undefined') return;   // inside the worker this file isn't loaded
  let worker = null, seq = 0;
  const wait = new Map();
  let core = null;
  try {
    const src = `const core = (${FG_AI_CORE.toString()})();
      onmessage = e => { const { id, fn, args } = e.data; let out = null; try { out = core[fn](...args); } catch (err) { out = { error: String(err) }; } postMessage({ id, out }); };`;
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = e => { const w = wait.get(e.data.id); if (w) { wait.delete(e.data.id); w(e.data.out); } };
    worker.onerror = () => { worker = null; };
  } catch (e) { worker = null; }
  const call = (fn, ...args) => new Promise(res => {
    if (worker) { const id = ++seq; wait.set(id, res); worker.postMessage({ id, fn, args }); }
    else setTimeout(() => { core = core || FG_AI_CORE(); res(core[fn](...args)); }, 0);
  });
  const plain = st => ({ pos: st.pos, turn: st.turn, castle: st.castle || '', ep: st.ep || null });
  window.FG_AI = {
    move: (st, level) => call('bestMove', plain(st), level),
    analyse: (st, depth, ms) => call('analyse', plain(st), depth, ms),
    check: (st, mv, depth, ms) => call('checkMove', plain(st), mv, depth, ms),
    perft: (st, d) => call('perft', plain(st), d)
  };
})();
