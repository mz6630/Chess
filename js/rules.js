// The rules of chess, small enough for lessons: legal moves, check, checkmate, stalemate,
// castling, en passant and promotion. A position is a map of squares to pieces, e.g. { e1: 'wK', e8: 'bK' }.
// A game state is { pos, turn: 'w' | 'b', castle: 'KQkq', ep: square or null }.
// Positions without kings are allowed (a lone rook chasing stars), so "in check" means "has a king that is attacked".
window.FG_RULES = (() => {
  const FILES = 'abcdefgh';
  const fr = s => [FILES.indexOf(s[0]), +s[1] - 1];
  const sq = (f, r) => (f >= 0 && f < 8 && r >= 0 && r < 8) ? FILES[f] + (r + 1) : null;
  const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]], BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const ALL = ROOK.concat(BISHOP);
  const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  const other = c => (c === 'w' ? 'b' : 'w');

  // squares a piece attacks (pawns: only their diagonal captures)
  function attacks(pos, from) {
    const p = pos[from]; if (!p) return [];
    const [f, r] = fr(from), c = p[0], t = p[1], out = [];
    const ray = dirs => { for (const [df, dr] of dirs) for (let k = 1; k < 8; k++) { const s = sq(f + df * k, r + dr * k); if (!s) break; out.push(s); if (pos[s]) break; } };
    const step = dirs => { for (const [df, dr] of dirs) { const s = sq(f + df, r + dr); if (s) out.push(s); } };
    if (t === 'P') step([[-1, c === 'w' ? 1 : -1], [1, c === 'w' ? 1 : -1]]);
    else if (t === 'N') step(KNIGHT);
    else if (t === 'K') step(ALL);
    else if (t === 'R') ray(ROOK);
    else if (t === 'B') ray(BISHOP);
    else if (t === 'Q') ray(ALL);
    return out;
  }
  const attacked = (pos, s, by) => Object.keys(pos).some(from => pos[from][0] === by && attacks(pos, from).includes(s));
  const kingOf = (pos, c) => Object.keys(pos).find(s => pos[s] === c + 'K');
  const inCheck = (pos, c) => { const k = kingOf(pos, c); return !!k && attacked(pos, k, other(c)); };
  const checkers = (pos, c) => { const k = kingOf(pos, c); return k ? Object.keys(pos).filter(s => pos[s][0] === other(c) && attacks(pos, s).includes(k)) : []; };

  function pseudo(st, from) {
    const pos = st.pos, p = pos[from]; if (!p) return [];
    const [f, r] = fr(from), c = p[0], t = p[1], out = [];
    const add = (to, extra = {}) => out.push(Object.assign({ from, to, piece: p, capture: pos[to] || null }, extra));
    if (t === 'P') {
      const d = c === 'w' ? 1 : -1, last = c === 'w' ? 7 : 0;
      const promo = to => fr(to)[1] === last;
      const one = sq(f, r + d);
      if (one && !pos[one]) {
        add(one, promo(one) ? { promo: true } : {});
        const two = sq(f, r + 2 * d);
        if (r === (c === 'w' ? 1 : 6) && two && !pos[two]) add(two, { double: true });
      }
      for (const df of [-1, 1]) {
        const to = sq(f + df, r + d); if (!to) continue;
        if (pos[to] && pos[to][0] !== c) add(to, promo(to) ? { promo: true } : {});
        else if (to === st.ep && !pos[to]) add(to, { ep: sq(f + df, r), capture: pos[sq(f + df, r)] || null });
      }
    } else {
      for (const to of attacks(pos, from)) if (!pos[to] || pos[to][0] !== c) add(to);
      if (t === 'K' && st.castle) {
        const home = c === 'w' ? '1' : '8';
        if (from === 'e' + home && !inCheck(pos, c)) {
          const can = (right, rook, between, pass) =>
            st.castle.includes(right) && pos[rook] === c + 'R' && between.every(s => !pos[s + home]) && pass.every(s => !attacked(pos, s + home, other(c)));
          if (can(c === 'w' ? 'K' : 'k', 'h' + home, ['f', 'g'], ['f', 'g'])) add('g' + home, { castle: 'K', rook: ['h' + home, 'f' + home] });
          if (can(c === 'w' ? 'Q' : 'q', 'a' + home, ['b', 'c', 'd'], ['d', 'c'])) add('c' + home, { castle: 'Q', rook: ['a' + home, 'd' + home] });
        }
      }
    }
    return out;
  }

  function apply(st, m, o = {}) {
    const pos = Object.assign({}, st.pos), c = m.piece[0];
    delete pos[m.from];
    if (m.ep) delete pos[m.ep];
    pos[m.to] = m.promo ? c + (m.promoTo || 'Q') : m.piece;
    if (m.rook) { pos[m.rook[1]] = pos[m.rook[0]]; delete pos[m.rook[0]]; }
    let castle = st.castle || '';
    const drop = s => { castle = castle.replace(s, ''); };
    if (m.piece[1] === 'K') { if (c === 'w') { drop('K'); drop('Q'); } else { drop('k'); drop('q'); } }
    for (const [s, right] of [['h1', 'K'], ['a1', 'Q'], ['h8', 'k'], ['a8', 'q']]) if (m.from === s || m.to === s) drop(right);
    const [f, r] = fr(m.from);
    return { pos, turn: o.keepTurn ? st.turn : other(st.turn), castle, ep: m.double ? sq(f, (r + fr(m.to)[1]) / 2) : null };
  }

  const legal = (st, from) => pseudo(st, from).filter(m => !inCheck(apply(st, m).pos, m.piece[0]));
  const allLegal = st => Object.keys(st.pos).filter(s => st.pos[s][0] === st.turn).flatMap(s => legal(st, s));
  function status(st) {
    const check = inCheck(st.pos, st.turn), none = allLegal(st).length === 0;
    return none ? (check ? 'mate' : 'stalemate') : (check ? 'check' : '');
  }
  // a position from a short string: "wKe1 wRa1 bKe8"
  const parse = s => Object.fromEntries(s.trim().split(/\s+/).map(t => [t.slice(2), t.slice(0, 2)]));
  const state = (pos, o = {}) => ({ pos: typeof pos === 'string' ? parse(pos) : Object.assign({}, pos), turn: o.turn || 'w', castle: o.castle || '', ep: o.ep || null });

  // short algebraic notation for a move, e.g. Nf3, exd5, O-O, e8=Q#
  function san(st, m) {
    if (m.castle) return m.castle === 'K' ? 'O-O' : 'O-O-O';
    const t = m.piece[1];
    let s = '';
    if (t === 'P') s = (m.capture ? m.from[0] + 'x' : '') + m.to + (m.promo ? '=' + (m.promoTo || 'Q') : '');
    else {
      const twins = Object.keys(st.pos).filter(x => x !== m.from && st.pos[x] === m.piece && legal(st, x).some(o => o.to === m.to));
      let dis = '';
      if (twins.length) dis = twins.some(x => x[0] === m.from[0]) ? (twins.some(x => x[1] === m.from[1]) ? m.from : m.from[1]) : m.from[0];
      s = t + dis + (m.capture ? 'x' : '') + m.to;
    }
    const after = status(apply(st, m));
    return s + (after === 'mate' ? '#' : after === 'check' ? '+' : '');
  }

  return { fr, sq, attacks, attacked, inCheck, checkers, kingOf, pseudo, legal, allLegal, apply, status, parse, state, san, other };
})();
