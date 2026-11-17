// Pawn, the AI tutor: a small pawn in the bottom-right corner. Click it, type a question,
// and it reads the situation (which part of the page you are on, what is on the board,
// which pieces you moved or knocked over) and answers in English or Korean.
// If window.FG_TUTOR_ENDPOINT is set, questions go to that AI endpoint first
// (POST {question, lang, context} -> {reply}); otherwise, or if it fails, Pawn answers on its own.
{
  const PAWN = 'M31.0,0.0L30.5,0.4L28.2,1.0L26.1,2.0L24.1,3.4L21.8,5.8L20.4,7.8L19.6,9.2L18.9,11.4L18.4,14.0L18.5,17.9L18.9,19.6L19.6,21.8L20.4,23.2L21.8,25.2L24.1,27.6L26.8,29.4L26.9,29.6L26.9,33.6L26.5,34.0L21.4,34.0L19.6,34.9L16.4,35.0L15.2,35.2L13.2,35.4L11.2,36.4L10.5,37.2L9.8,38.9L9.6,44.8L9.9,45.6L10.8,47.2L12.4,48.8L15.0,49.6L17.1,49.9L21.2,49.9L21.6,50.0L22.1,50.5L22.1,51.2L20.5,56.4L19.9,57.6L19.5,59.1L17.8,63.4L17.4,64.8L16.8,65.9L14.6,71.2L13.8,72.8L13.6,73.4L12.6,75.4L10.9,78.0L9.6,78.8L7.8,78.9L7.0,79.2L6.2,79.9L5.8,80.8L5.5,81.5L5.6,82.8L6.5,83.8L7.8,84.8L8.0,85.4L7.8,85.9L5.4,88.4L3.2,91.0L1.6,93.5L0.5,96.2L0.0,96.9L0.0,101.0L0.4,101.5L0.9,103.4L2.4,105.9L4.0,107.4L5.2,108.1L5.6,108.6L5.5,109.4L5.0,109.8L2.8,110.2L1.6,111.1L1.1,112.4L1.2,113.1L1.8,114.1L2.6,115.1L2.6,115.4L64.9,115.4L65.8,114.4L66.2,113.5L66.4,112.6L66.2,111.4L65.4,110.5L64.6,110.1L62.5,109.6L62.1,109.2L62.1,108.8L62.9,107.9L64.2,106.9L65.4,105.8L66.8,103.5L67.2,101.6L67.6,101.1L67.6,97.2L67.2,96.8L67.1,95.9L66.5,94.4L65.4,92.4L63.2,89.5L59.8,85.6L59.8,85.0L61.5,83.5L62.0,82.5L62.1,81.6L61.9,80.6L61.0,79.5L60.1,79.0L59.1,78.8L58.0,78.8L57.0,78.2L55.0,75.4L50.5,65.1L49.6,62.9L49.4,61.8L48.8,60.6L48.1,58.5L46.6,54.9L45.5,51.2L45.8,50.4L46.2,50.0L53.0,49.8L55.5,48.6L57.1,46.9L58.1,44.1L58.2,39.6L57.6,37.9L57.1,37.0L56.6,36.5L55.1,35.6L53.1,35.1L50.5,35.1L50.4,35.0L47.9,34.9L46.9,34.5L46.2,34.0L41.1,34.0L40.8,33.6L40.8,29.8L40.9,29.5L43.6,27.6L46.0,25.2L47.4,23.2L48.4,21.1L49.1,18.6L49.4,17.0L49.4,14.0L48.9,11.4L48.1,9.2L46.4,6.2L43.6,3.4L42.6,2.6L40.1,1.2L37.2,0.4L36.8,0.0Z';
  const $ = id => document.getElementById(id);
  const ko = s => /[ㄱ-힝]/.test(s);
  const T = (lang, en, k) => lang === 'ko' ? k : en;
  const store = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };

  // ---------- markup ----------
  const svgPawn = cls => `<svg class="${cls}" viewBox="0 0 67.8 115.5" aria-hidden="true"><path d="${PAWN}"/><g class="eyes"><circle cx="29.4" cy="15.5" r="2.7"/><circle cx="38.6" cy="15.5" r="2.7"/></g></svg>`;
  document.body.insertAdjacentHTML('beforeend', `
<div class="tutor" id="tutor">
  <p class="t-hint" id="tHint" hidden>Stuck? Ask me anything.</p>
  <section class="t-panel" id="tPanel" role="dialog" aria-label="Pawn, your chess tutor" hidden>
    <header class="t-head">${svgPawn('t-mini')}<div><p class="t-name">Pawn</p><p class="t-role">Your chess tutor</p></div>
      <button class="t-x" id="tClose" type="button" aria-label="Close the tutor">×</button></header>
    <div class="t-log" id="tLog" aria-live="polite"></div>
    <div class="t-chips" id="tChips"></div>
    <form class="t-form" id="tForm" autocomplete="off">
      <label class="sr" for="tIn">Ask Pawn</label>
      <input id="tIn" type="text" placeholder="Ask about a move, a rule, the board…" maxlength="400">
      <button class="t-send" type="submit" aria-label="Send">↑</button>
    </form>
  </section>
  <button class="t-btn" id="tBtn" type="button" aria-label="Open Pawn, your chess tutor" aria-expanded="false">${svgPawn('t-pawn')}</button>
</div>`);
  const panel = $('tPanel'), log = $('tLog'), input = $('tIn'), btn = $('tBtn'), chips = $('tChips'), hint = $('tHint');

  // ---------- chess knowledge ----------
  const NAMES = { pawn: ['pawn', '폰'], knight: ['knight', '나이트'], bishop: ['bishop', '비숍'], rook: ['rook', '룩'], queen: ['queen', '퀸'], king: ['king', '킹'] };
  const VALUE = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
  const nm = (lang, t) => NAMES[t][lang === 'ko' ? 1 : 0];
  const side = (lang, w) => w ? T(lang, 'white', '백') : T(lang, 'black', '흑');
  const PIECE = {
    pawn: ['The pawn moves one square straight forward, or two on its very first move. It captures one square diagonally forward. Reach the last rank and it becomes a queen (or a rook, bishop or knight). Worth 1 point.',
      '폰은 앞으로 한 칸 직진해요. 처음 움직일 때만 두 칸까지 갈 수 있어요. 잡을 때는 대각선 앞 한 칸으로 잡아요. 끝 줄에 닿으면 퀸(또는 룩·비숍·나이트)으로 바뀌어요. 가치는 1점이에요.'],
    knight: ['The knight jumps in an L: two squares one way, then one square to the side. It is the only piece that can leap over others. Worth 3 points.',
      '나이트는 L자로 뛰어요. 한 방향으로 두 칸, 옆으로 한 칸이에요. 다른 기물을 뛰어넘을 수 있는 유일한 기물이에요. 가치는 3점이에요.'],
    bishop: ['The bishop moves any distance diagonally, so it stays on one colour of square for the whole game. Worth 3 points.',
      '비숍은 대각선으로 원하는 만큼 움직여요. 그래서 게임 내내 처음 칸과 같은 색 칸에만 있어요. 가치는 3점이에요.'],
    rook: ['The rook moves any distance in a straight line along a rank or a file. Worth 5 points, and it also castles with the king.',
      '룩은 가로나 세로로 원하는 만큼 직진해요. 가치는 5점이고, 킹과 함께 캐슬링을 할 수 있어요.'],
    queen: ['The queen moves any distance in a straight line or diagonally: a rook and a bishop in one. Worth 9 points, so guard her well.',
      '퀸은 가로·세로·대각선 어느 방향으로든 원하는 만큼 움직여요. 룩과 비숍을 합친 셈이에요. 가치는 9점이라 잘 지켜야 해요.'],
    king: ['The king moves one square in any direction and may never step into check. Lose the king to checkmate and the game is over, so keep him safe, usually by castling early.',
      '킹은 어느 방향으로든 한 칸씩 움직이고, 체크당하는 칸으로는 갈 수 없어요. 체크메이트당하면 게임이 끝나니까, 보통 일찍 캐슬링해서 안전하게 지켜요.']
  };
  const LATE = [
    [/how.*(use|move|drag|play)|drag|사용법|어떻게.*(옮|움직|조작)|드래그|넘어뜨/i, ['Scroll to the end of the page so the set lands. Then drag a piece to move it; it settles on the nearest square. Swipe fast into others to knock them over, and double-click to set everything back up. I can check your move: just ask “analyse the board”.',
      '페이지 끝까지 스크롤하면 기물이 체스판에 놓여요. 그다음 기물을 끌어서 옮기면 가장 가까운 칸에 내려앉아요. 빠르게 쓸면 다른 기물이 쓰러지고, 더블클릭하면 모두 제자리로 돌아가요. 둔 수가 맞는지 보고 싶으면 “보드 분석해줘”라고 물어보세요.']],
    [/intro|logo|인트로|로고/i, ['Click the First Gambit logo at the top left to watch the intro again.',
      '왼쪽 위 First Gambit 로고를 누르면 인트로를 다시 볼 수 있어요.']]
  ];
  const TOPICS = [
    [/\bfiles?\b|파일|세로줄/i, ['A file is a column of squares going up the board. There are eight, named a to h from left to right.',
      '파일은 위아래로 이어진 세로줄이에요. 왼쪽부터 a~h까지 8개가 있어요.']],
    [/\branks?\b|랭크|가로줄/i, ['A rank is a row of squares going across the board. There are eight, numbered 1 to 8 from White’s side.',
      '랭크는 가로로 이어진 줄이에요. 백 쪽부터 1~8까지 8개가 있어요.']],
    [/diagonal|대각선/i, ['A diagonal is a slanting line of squares that touch at their corners. Every square on it has the same colour.',
      '대각선은 모서리끼리 닿으며 비스듬히 이어진 칸들이에요. 대각선 위의 칸은 모두 같은 색이에요.']],
    [/square.*name|name.*square|coordinat|칸.*이름|좌표/i, ['Each square is named by its file letter, then its rank number. The e-file meets rank 4 at e4.',
      '칸 이름은 파일 알파벳을 먼저, 랭크 숫자를 나중에 읽어요. e 파일과 4 랭크가 만나는 칸이 e4예요.']],
    [/light on the right|which way|turn the board|방향|어떻게 놓|돌려/i, ['Turn the board so the corner square on your right is light: “light on the right”.',
      '오른쪽 구석 칸이 밝은 칸이 되게 놓아요. “오른쪽 구석은 밝은 칸”으로 외우면 쉬워요.']],
    [/how many (pieces|squares)|몇 ?개|개수/i, ['The board has 64 squares. Each player has 16 pieces: 8 pawns, 2 rooks, 2 knights, 2 bishops, 1 queen and 1 king.',
      '체스판은 64칸이에요. 각자 기물 16개를 가져요. 폰 8, 룩 2, 나이트 2, 비숍 2, 퀸 1, 킹 1개예요.']],
    [/set ?up|starting position|start position|시작 ?자리|배치|어디에 놓/i, ['Pawns on the second rank. Behind them, from the corners in: rook, knight, bishop, then the queen on her own colour (d1 or d8) and the king beside her.',
      '폰은 두 번째 줄에 서요. 그 뒤로 구석부터 룩, 나이트, 비숍, 그리고 퀸은 자기 색 칸(d1이나 d8)에, 킹은 그 옆에 서요.']],
    [/who (moves|goes|plays|starts)|moves? first|goes first|whose turn|먼저 (두|해|움직|시작)|누가 먼저|누구 차례|차례/i, ['White always moves first. Then the players take turns, one move each.',
      '항상 백이 먼저 둬요. 그다음부터 한 수씩 번갈아 둬요.']],
    [/why.*(matter|important)|왜 중요/i, ['Everything later builds on this. Square names let you read moves, and the lines are the roads every piece travels.',
      '앞으로 배울 모든 것이 여기서 시작해요. 칸 이름을 알아야 수를 읽을 수 있고, 줄들은 모든 기물이 다니는 길이에요.']],
    [/castl|캐슬링/i, ['Castling moves the king two squares toward a rook, and the rook jumps to the square the king crossed. Neither may have moved before, the squares between must be empty, and the king may not be in, pass through, or land in check.',
      '캐슬링은 킹을 룩 쪽으로 두 칸 옮기고, 룩을 킹이 지나간 칸으로 넘기는 수예요. 킹과 룩 모두 한 번도 움직이지 않았어야 하고, 사이 칸이 비어 있어야 해요. 킹이 체크 상태이거나 체크당하는 칸을 지나가거나 그런 칸에 도착해도 안 돼요.']],
    [/en passant|앙파상/i, ['En passant: if a pawn moves two squares and lands right beside your pawn, you may capture it as if it had moved only one square. You must do it on the very next move or lose the chance.',
      '앙파상: 상대 폰이 두 칸 전진해서 내 폰 바로 옆에 서면, 한 칸만 움직인 것처럼 대각선으로 잡을 수 있어요. 바로 다음 수에 잡지 않으면 기회가 사라져요.']],
    [/promot|프로모션|승진/i, ['Promotion: a pawn that reaches the far rank must become a queen, rook, bishop or knight. Almost everyone picks the queen.',
      '프로모션: 폰이 상대 끝 줄에 닿으면 퀸·룩·비숍·나이트 중 하나로 바뀌어요. 거의 항상 퀸을 골라요.']],
    [/stalemate|스테일메이트/i, ['Stalemate: the player to move is not in check but has no legal move. The game is a draw, so when you are winning, leave the losing king a square to breathe.',
      '스테일메이트: 둘 차례인 쪽이 체크는 아닌데 둘 수 있는 수가 하나도 없는 상태예요. 무승부가 되니까, 이기고 있을 때는 상대 킹이 움직일 칸을 남겨 두세요.']],
    [/checkmate|mate|체크메이트|외통/i, ['Checkmate: the king is attacked and has no way out. It cannot move, the attacker cannot be captured, and nothing can block. That ends the game.',
      '체크메이트: 킹이 공격받는데 빠져나갈 방법이 없는 상태예요. 피할 칸도, 공격한 기물을 잡을 방법도, 막을 기물도 없으면 게임이 끝나요.']],
    [/\bcheck\b|체크/i, ['Check means the king is under attack. You must answer it at once: move the king, capture the attacker, or put a piece in between.',
      '체크는 킹이 공격받는 상태예요. 바로 대응해야 해요: 킹을 피하거나, 공격한 기물을 잡거나, 사이를 막으세요.']],
    [/fork|포크/i, ['A fork is one piece attacking two at once. Knights are famous for it: a knight landing next to the king and queen wins the queen.',
      '포크는 기물 하나가 두 기물을 동시에 공격하는 거예요. 나이트가 특히 잘해요. 킹과 퀸을 동시에 노리면 퀸을 얻을 수 있어요.']],
    [/skewer|스큐어/i, ['A skewer is a pin in reverse: you attack a valuable piece, it steps aside, and you take the piece behind it.',
      '스큐어는 핀의 반대예요. 비싼 기물을 공격해서 비키게 만들고, 그 뒤에 있는 기물을 잡아요.']],
    [/\bpin\b|핀/i, ['A pin traps a piece in front of a more valuable one. If it moves, the piece behind it is lost (or, behind a king, it may not move at all).',
      '핀은 기물이 더 비싼 기물 앞에 묶인 상태예요. 움직이면 뒤의 기물을 잃어요. 뒤에 킹이 있으면 아예 움직일 수 없어요.']],
    [/accepted|qga|받아/i, ['Queen’s Gambit Accepted (2…dxc4): Black takes the pawn. White usually plays e3 or e4 and wins it back later with Bxc4, gaining the centre.',
      '퀸스 갬빗 수락(2…dxc4): 흑이 폰을 받아 잡아요. 백은 보통 e3나 e4를 두고 나중에 Bxc4로 폰을 되찾으면서 중앙을 차지해요.']],
    [/declined|qgd|거절/i, ['Queen’s Gambit Declined (2…e6): Black keeps the d5 pawn protected and develops calmly. It is solid and a great first defence to learn.',
      '퀸스 갬빗 거절(2…e6): 흑이 d5 폰을 지키면서 차분하게 전개해요. 탄탄해서 처음 배우기 좋은 방어예요.']],
    [/gambit|갬빗/i, ['The Queen’s Gambit is 1. d4 d5 2. c4. White offers the c-pawn to pull Black’s d-pawn away from the centre. Black can take it (2…dxc4, Accepted), defend with 2…e6 (Declined) or 2…c6 (the Slav). It is exactly what is on the board below.',
      '퀸스 갬빗은 1. d4 d5 2. c4예요. 백이 c폰을 내주는 대신 흑의 d폰을 중앙에서 끌어내려는 오프닝이에요. 흑은 2…dxc4로 받거나(수락), 2…e6(거절)이나 2…c6(슬라브)로 지킬 수 있어요. 아래 체스판에 놓인 바로 그 장면이에요.']],
    [/italian|이탈리안/i, ['The Italian Game is 1. e4 e5 2. Nf3 Nc6 3. Bc4. The bishop aims at f7, Black’s weakest square early on.',
      '이탈리안 게임은 1. e4 e5 2. Nf3 Nc6 3. Bc4예요. 비숍이 초반 흑의 가장 약한 칸인 f7을 노려요.']],
    [/opening|오프닝|시작.*어떻게|첫 ?수/i, ['Three opening rules: take the centre with a pawn (e4 or d4), bring out knights and bishops before moving the queen, and castle early to keep the king safe.',
      '오프닝 3원칙: 폰으로 중앙을 차지하고(e4나 d4), 퀸보다 나이트와 비숍을 먼저 꺼내고, 일찍 캐슬링해서 킹을 지키세요.']],
    [/value|worth|point|점수|가치/i, ['Rough values: pawn 1, knight 3, bishop 3, rook 5, queen 9. The king is priceless. Count them before every trade.',
      '대략적인 가치: 폰 1, 나이트 3, 비숍 3, 룩 5, 퀸 9예요. 킹은 값을 매길 수 없어요. 교환하기 전에 꼭 세어 보세요.']],
    [/reset|undo|되돌|초기화|원래대로|다시 세/i, ['Double-click the board and every piece goes back to the Queen’s Gambit position.',
      '체스판을 더블클릭하면 모든 기물이 퀸스 갬빗 자리로 돌아가요.']],
  ];

  // ---------- reading the board ----------
  const sqXY = s => ['abcdefgh'.indexOf(s[0]), +s[1]];
  function legalShape(p, from, to, occ) {
    const [f0, r0] = sqXY(from), [f1, r1] = sqXY(to), df = f1 - f0, dr = r1 - r0, adf = Math.abs(df), adr = Math.abs(dr);
    const target = occ[to], capture = target && target.white !== p.white;
    if (target && target.white === p.white && target !== p) return false;
    const clear = () => { const sf = Math.sign(df), sr = Math.sign(dr); for (let f = f0 + sf, r = r0 + sr; f !== f1 || r !== r1; f += sf, r += sr) if (occ['abcdefgh'[f] + r]) return false; return true; };
    switch (p.type) {
      case 'pawn': { const dir = p.white ? 1 : -1, start = p.white ? 2 : 7;
        if (df === 0 && !target) return dr === dir || (dr === 2 * dir && r0 === start && !occ['abcdefgh'[f0] + (r0 + dir)]);
        return adf === 1 && dr === dir && capture; }
      case 'knight': return (adf === 1 && adr === 2) || (adf === 2 && adr === 1);
      case 'bishop': return adf === adr && adf > 0 && clear();
      case 'rook': return (df === 0) !== (dr === 0) && clear();
      case 'queen': return ((adf === adr && adf > 0) || ((df === 0) !== (dr === 0))) && clear();
      case 'king': return Math.max(adf, adr) === 1;
    }
    return false;
  }
  function analyse(lang) {
    const B = window.FG_BOARD;
    if (!B || !B.isLive()) return T(lang,
      'The board is still being set up. Scroll to the very end of the page, let the pieces land, then move a few and ask me again. I’ll check every move.',
      '아직 기물이 체스판에 다 놓이지 않았어요. 페이지 끝까지 스크롤해서 기물이 모두 내려앉으면, 몇 개 움직여 본 뒤 다시 물어보세요. 둔 수를 하나하나 확인해 드릴게요.');
    const ps = B.pieces(), occ = {};
    ps.forEach(p => { if (p.home && !p.fallen) occ[p.home] = p; });
    const moved = ps.filter(p => !p.fallen && p.square !== p.home), down = ps.filter(p => p.fallen);
    const lines = [];
    if (!moved.length && !down.length) {
      return T(lang,
        'This is the Queen’s Gambit: 1. d4 d5 2. c4. White offers the c4 pawn. As Black, the calm answer is 2…e6, protecting d5. Taking with 2…dxc4 is fine too, but don’t try to hang on to that pawn. As White, after 2…e6 bring the knight out with 3. Nc3. Drag a piece to try a move and I’ll check it.',
        '지금은 퀸스 갬빗 장면이에요: 1. d4 d5 2. c4. 백이 c4 폰을 내준 상태예요. 흑이라면 2…e6으로 d5를 지키는 게 가장 차분한 대응이에요. 2…dxc4로 받아도 괜찮지만, 그 폰을 끝까지 지키려고 무리하지는 마세요. 백이라면 2…e6 다음에 3. Nc3으로 나이트를 꺼내세요. 기물을 끌어서 수를 두면 맞는지 봐 드릴게요.');
    }
    for (const p of moved.slice(0, 4)) {
      const ok = legalShape(p, p.home, p.square, occ);
      const who = `${side(lang, p.white)} ${nm(lang, p.type)}`;
      const mate = occ[p.square];
      if (mate && mate !== p && mate.white === p.white) { lines.push(T(lang,
        `• ${who} ${p.home} → ${p.square}: that square belongs to your own ${nm(lang, mate.type)}. You can never capture your own piece.`,
        `• ${who} ${p.home} → ${p.square}: 그 칸에는 같은 편 ${nm(lang, mate.type)}이(가) 있어요. 자기 편 기물은 잡을 수 없어요.`)); continue; }
      lines.push(T(lang,
        `• ${who} ${p.home} → ${p.square}: ${ok ? 'a legal move.' : `not a legal move for a ${nm(lang, p.type)}. ${PIECE[p.type][0].split('.')[0]}.`}`,
        `• ${who} ${p.home} → ${p.square}: ${ok ? '규칙에 맞는 수예요.' : `${nm(lang, p.type)}은(는) 이렇게 움직일 수 없어요. ${PIECE[p.type][1].split('.')[0]}.`}`));
    }
    if (moved.length > 4) lines.push(T(lang, `…and ${moved.length - 4} more pieces moved.`, `…그 밖에 ${moved.length - 4}개가 더 움직였어요.`));
    if (down.length) {
      const pts = w => down.filter(p => p.white === w).reduce((a, p) => a + VALUE[p.type], 0);
      const kings = down.filter(p => p.type === 'king');
      lines.push(T(lang,
        `• ${down.length} piece${down.length > 1 ? 's are' : ' is'} knocked over: White has lost ${pts(true)} point${pts(true) === 1 ? '' : 's'}, Black ${pts(false)}.`,
        `• 쓰러진 기물이 ${down.length}개예요: 백은 ${pts(true)}점, 흑은 ${pts(false)}점을 잃은 셈이에요.`));
      if (kings.length) lines.push(T(lang, '• A king is down! In a real game you can never capture a king; the game ends at checkmate.', '• 킹이 쓰러졌어요! 실제 게임에서는 킹을 잡을 수 없고, 체크메이트가 되면 게임이 끝나요.'));
    }
    const wq = ps.find(p => p.type === 'queen' && p.white && !p.fallen);
    if (wq && moved.includes(wq) && sqXY(wq.square)[1] > 3)
      lines.push(T(lang, 'Tip: bringing the queen out early lets Black chase her with tempo. Develop knights and bishops first.', '팁: 퀸을 일찍 꺼내면 흑이 퀸을 쫓으며 박자를 벌어요. 나이트와 비숍을 먼저 꺼내세요.'));
    lines.push(T(lang, 'Double-click the board any time to reset.', '언제든 체스판을 더블클릭하면 처음 자리로 돌아가요.'));
    return lines.join('\n');
  }

  function where() {
    if (window.FG_LEARN) return window.FG_LEARN.active() ? 'lesson' : 'course';
    const s = document.getElementById('setup');
    if (document.body.classList.contains('intro-on')) return 'intro';
    if (s && s.getBoundingClientRect().top < innerHeight * .5) return 'board';
    return 'landing';
  }

  function localAnswer(q, lang) {
    const t = q.trim();
    const W = where();
    if (window.FG_LEARN && /hint|help|stuck|don.?t (get|know|understand)|how do i|what do i|힌트|도와|모르겠|막혔|어떻게 해|뭘 해/i.test(t)) return window.FG_LEARN.hint(lang);
    if (window.FG_LEARN && /again|explain|repeat|다시|설명/i.test(t)) return window.FG_LEARN.explain(lang);
    if (W === 'course' && /start|begin|where|what.*learn|어디|시작|뭘 배|무엇을 배/i.test(t)) return window.FG_LEARN.hint(lang) + '\n\n' + window.FG_LEARN.explain(lang);
    if (/^(hi|hello|hey)\b|안녕|하이/i.test(t)) return T(lang,
      'Hi, I’m Pawn! Ask me how a piece moves, what a rule means, or say “analyse the board” after you move pieces below.',
      '안녕하세요, 저는 폰이에요! 기물이 어떻게 움직이는지, 규칙이 무슨 뜻인지 물어보세요. 아래 체스판에서 기물을 옮긴 뒤 “보드 분석해줘”라고 하면 상황을 봐 드려요.');
    if (!window.FG_LEARN && /analy|board|position|next|best|what should|suggest|분석|상황|보드|다음|뭐.*(둬|두|해)|어떻게.*둬|추천|봐줘|조언/i.test(t)) return analyse(lang);
    for (const [re, a] of TOPICS) if (re.test(t)) return a[lang === 'ko' ? 1 : 0];
    for (const k of Object.keys(NAMES)) if (new RegExp(`${NAMES[k][0]}|${NAMES[k][1]}`, 'i').test(t)) return PIECE[k][lang === 'ko' ? 1 : 0];
    for (const [re, a] of LATE) if (re.test(t)) return a[lang === 'ko' ? 1 : 0];
    if (where() === 'board' && window.FG_BOARD && window.FG_BOARD.isLive()) return analyse(lang);
    return T(lang,
      'I’m not sure about that one yet. Try asking how a piece moves, about castling, check or the Queen’s Gambit, or move pieces on the board below and say “analyse the board”.',
      '그 질문은 아직 잘 모르겠어요. 기물이 움직이는 법, 캐슬링, 체크, 퀸스 갬빗 같은 걸 물어보세요. 아니면 아래 체스판에서 기물을 옮기고 “보드 분석해줘”라고 해 보세요.');
  }

  async function answer(q) {
    const lang = ko(q) ? 'ko' : 'en';
    const ep = window.FG_TUTOR_ENDPOINT;
    if (ep) {
      try {
        const ctx = window.FG_LEARN ? { section: where(), lesson: window.FG_LEARN.context() }
          : { section: where(), board: window.FG_BOARD && window.FG_BOARD.pieces ? window.FG_BOARD.pieces() : null, analysis: analyse(lang) };
        const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, lang, context: ctx }) });
        const j = await r.json().catch(() => null);
        if (r.ok && j && j.reply) return j.reply;
        aiNote(`HTTP ${r.status}${j && j.error ? ' · ' + j.error : ''}${j && j.tried ? ' · ' + j.tried.join(', ') : ''}`);
      } catch (e) { aiNote(String(e && e.message || e)); }
    }
    return localAnswer(q, lang);
  }

  // When the AI endpoint fails, say why once (small grey line), then answer locally.
  let noted = false;
  function aiNote(why) {
    console.warn('Pawn AI endpoint failed:', why);
    if (noted) return; noted = true;
    const p = document.createElement('p'); p.className = 't-msg note';
    p.textContent = 'AI offline (' + why + '). Answering on my own for now.';
    log.appendChild(p);
  }

  // ---------- conversation ----------
  const say = (text, who) => {
    const p = document.createElement('p'); p.className = 't-msg ' + who; p.textContent = text;
    log.appendChild(p); log.scrollTop = log.scrollHeight; return p;
  };
  const CHIPS = {
    landing: [['How does the knight move?', '나이트는 어떻게 움직여?'], ['What is the Queen’s Gambit?', '퀸스 갬빗이 뭐야?'], ['Opening tips', '오프닝 팁']],
    board: [['Analyse the board', '보드 분석해줘'], ['What should Black play?', '흑은 뭘 둬야 해?'], ['How do I move pieces?', '기물은 어떻게 옮겨?']],
    intro: [['What is this site?', '이 사이트는 뭐야?']],
    lesson: [['Give me a hint', '힌트 줘'], ['Explain it again', '다시 설명해줘'], ['Why does this matter?', '이게 왜 중요해?']],
    course: [['Where do I start?', '어디서부터 시작해?'], ['What is a rank?', '랭크가 뭐야?'], ['How many pieces are there?', '기물은 몇 개야?']]
  };
  let lang = (navigator.language || '').startsWith('ko') ? 'ko' : 'en';
  function renderChips() {
    const list = CHIPS[where()] || CHIPS.landing;
    chips.innerHTML = list.map(c => `<button type="button" class="t-chip">${c[lang === 'ko' ? 1 : 0]}</button>`).join('');
  }
  chips.addEventListener('click', e => { const b = e.target.closest('.t-chip'); if (b) ask(b.textContent); });

  let busy = false;
  async function ask(q) {
    q = q.trim(); if (!q || busy) return;
    busy = true; lang = ko(q) ? 'ko' : 'en';
    say(q, 'me'); input.value = '';
    const dots = say('…', 'ai typing');
    const [a] = await Promise.all([answer(q), new Promise(r => setTimeout(r, 550))]);
    dots.remove(); say(a, 'ai'); renderChips(); busy = false;
  }
  $('tForm').addEventListener('submit', e => { e.preventDefault(); ask(input.value); });

  function open() {
    panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); hint.hidden = true; store.set('fgHint', '1');
    if (!log.childElementCount && window.FG_LEARN) say(T(lang,
      'Hi, I’m Pawn, your chess tutor. Stuck on a step? Ask me for a hint, or ask anything about chess.',
      '안녕하세요, 저는 체스 튜터 폰이에요. 막히는 단계가 있으면 힌트를 달라고 하거나, 체스에 대해 무엇이든 물어보세요.'), 'ai');
    if (!log.childElementCount) say(T(lang,
      'Hi, I’m Pawn, your chess tutor. Ask me about any rule or move. When the pieces have landed on the board below, I can also look at what you played.',
      '안녕하세요, 저는 체스 튜터 폰이에요. 규칙이나 수에 대해 무엇이든 물어보세요. 아래 체스판에 기물이 다 놓이면, 둔 수도 함께 봐 드릴게요.'), 'ai');
    renderChips(); setTimeout(() => input.focus(), 50);
  }
  function close() { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
  btn.addEventListener('click', () => (panel.hidden ? open() : close()));
  $('tClose').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });

  // a gentle nudge the first time the landing settles
  if (!store.get('fgHint')) {
    const wait = setInterval(() => {
      if (document.body.classList.contains('intro-on') || document.body.classList.contains('pre')) return;
      clearInterval(wait);
      setTimeout(() => { if (panel.hidden) { hint.hidden = false; setTimeout(() => { hint.hidden = true; }, 6000); } }, 1800);
    }, 500);
  }
}
