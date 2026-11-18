// Famous games for "Play like the legends": you take the winner's side and guess each move.
// Move lists are the standard published scores; every list is checked move by move by js/rules.js.
// notes: { ply index (0 = White's first move): { en, ko } }
window.FG_LEGENDS = [
  {
    id: 'opera', title: { en: 'The Opera Game', ko: '오페라 게임' }, year: 1858, place: { en: 'Paris', ko: '파리' },
    white: 'Paul Morphy', black: 'Duke of Brunswick & Count Isouard', winner: 'w', hero: { en: 'Morphy', ko: '모피' },
    story: {
      en: 'Paul Morphy played this in a box at the Paris Opera, against the Duke of Brunswick and Count Isouard deciding Black’s moves together. Seventeen moves, and a lesson in fast development that teachers still use.',
      ko: '폴 모피가 파리 오페라 극장의 관람석에서 브라운슈바이크 공작과 이수아르 백작을 상대로 둔 게임이에요. 두 사람이 의논해서 흑을 뒀어요. 17수 만에 끝난, 빠른 전개의 교과서 같은 게임이에요.'
    },
    moves: 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#',
    notes: {
      5: { en: 'Black pins the knight, but will soon have to give the bishop for it.', ko: '흑이 나이트를 묶지만, 곧 이 비숍을 나이트와 바꿔야 해요.' },
      12: { en: 'Two attacks at once: on f7 and on b7.', ko: '한 번에 두 곳을 공격해요. f7과 b7이에요.' },
      18: { en: 'Morphy gives a knight to tear open the lines to the black king.', ko: '모피는 흑 킹으로 가는 길을 열려고 나이트를 내줘요.' },
      24: { en: 'Another sacrifice: the rook takes on d7.', ko: '또 한 번의 희생. 룩이 d7을 잡아요.' },
      30: { en: 'The queen sacrifice. Black must take, and the rook mates.', ko: '퀸 희생! 흑은 잡을 수밖에 없고, 그러면 룩이 메이트해요.' },
      32: { en: 'Checkmate with the last two pieces Morphy had in play.', ko: '모피가 남긴 마지막 두 기물로 체크메이트.' }
    }
  },
  {
    id: 'immortal', title: { en: 'The Immortal Game', ko: '불멸의 게임' }, year: 1851, place: { en: 'London', ko: '런던' },
    white: 'Adolf Anderssen', black: 'Lionel Kieseritzky', winner: 'w', hero: { en: 'Anderssen', ko: '안데르센' },
    story: {
      en: 'A friendly game played in London in 1851, during a break in the first international tournament. Anderssen gave up a bishop, both rooks and his queen, and still delivered mate.',
      ko: '1851년 런던, 첫 국제 토너먼트 중 쉬는 시간에 둔 친선 게임이에요. 안데르센은 비숍, 룩 두 개, 퀸까지 내주고도 체크메이트했어요.'
    },
    moves: 'e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5 Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5 Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#',
    notes: {
      2: { en: 'The King’s Gambit: a pawn offered for a quick attack.', ko: '킹스 갬빗이에요. 빠른 공격을 위해 폰을 내줘요.' },
      6: { en: 'The king steps aside. No castling now, but Black’s queen will lose time.', ko: '킹이 비켜요. 캐슬링은 못 하지만, 흑 퀸이 시간을 낭비하게 돼요.' },
      20: { en: 'Anderssen leaves his bishop hanging to keep the attack going.', ko: '안데르센은 공격을 이어 가려고 비숍을 그냥 내줘요.' },
      34: { en: 'He offers both rooks.', ko: '룩 두 개를 모두 내줘요.' },
      42: { en: 'And now the queen. The bishop mates next.', ko: '이번에는 퀸까지. 다음 수에 비숍이 메이트해요.' },
      44: { en: 'Checkmate by three minor pieces, a queen and two rooks down.', ko: '퀸과 룩 두 개가 없는 상태에서, 작은 기물 세 개로 체크메이트.' }
    }
  },
  {
    id: 'century', title: { en: 'The Game of the Century', ko: '세기의 게임' }, year: 1956, place: { en: 'New York', ko: '뉴욕' },
    white: 'Donald Byrne', black: 'Bobby Fischer', winner: 'b', hero: { en: 'Fischer', ko: '피셔' },
    story: {
      en: 'New York, 17 October 1956. Thirteen-year-old Bobby Fischer, playing Black against Donald Byrne, gave up his queen on move 17 for an attack that won the game. You play Fischer.',
      ko: '1956년 10월 17일 뉴욕. 13살 바비 피셔가 흑을 잡고 도널드 번을 상대로 17수에 퀸을 내주고 공격해서 이겼어요. 내가 피셔가 되어 둬요.'
    },
    moves: 'Nf3 Nf6 c4 g6 Nc3 Bg7 d4 O-O Bf4 d5 Qb3 dxc4 Qxc4 c6 e4 Nbd7 Rd1 Nb6 Qc5 Bg4 Bg5 Na4 Qa3 Nxc3 bxc3 Nxe4 Bxe7 Qb6 Bc4 Nxc3 Bc5 Rfe8+ Kf1 Be6 Bxb6 Bxc4+ Kg1 Ne2+ Kf1 Nxd4+ Kg1 Ne2+ Kf1 Nc3+ Kg1 axb6 Qb4 Ra4 Qxb6 Nxd1 h3 Rxa2 Kh2 Nxf2 Re1 Rxe1 Qd8+ Bf8 Nxe1 Bd5 Nf3 Ne4 Qb8 b5 h4 h5 Ne5 Kg7 Kg1 Bc5+ Kf1 Ng3+ Ke1 Bb4+ Kd1 Bb3+ Kc1 Ne2+ Kb1 Nc3+ Kc1 Rc2#',
    notes: {
      21: { en: 'A knight offered on a4, to break open White’s position.', ko: 'a4에 나이트를 내줘서 백의 진영을 흔들어요.' },
      33: { en: 'The famous move: Fischer leaves his queen to be taken and attacks instead.', ko: '가장 유명한 수예요. 피셔는 퀸을 내주고 대신 공격해요.' },
      35: { en: 'A “windmill” of checks begins, picking up material each time.', ko: '연속 체크가 시작돼요. 체크할 때마다 기물을 챙겨요.' },
      81: { en: 'Checkmate, with the black pieces working together across the board.', ko: '흑 기물들이 판 전체에서 함께 움직여 체크메이트.' }
    }
  },
  {
    id: 'harmon', title: { en: 'Harmon vs Borgov', ko: '하먼 대 보르고프' }, year: 1968, place: { en: 'Moscow, in the series', ko: '모스크바 (드라마 속)' },
    white: 'Elizabeth Harmon', black: 'Vasily Borgov', winner: 'w', hero: { en: 'Harmon', ko: '하먼' },
    story: {
      en: 'The final game of The Queen’s Gambit. It follows a real game, Ivanchuk–Wolff from Biel 1993, until move 37, where the real game went 37.g4. The ending was created for the show with Garry Kasparov’s help.',
      ko: '드라마 「퀸스 갬빗」의 마지막 게임이에요. 37수까지는 실제 게임인 1993년 비엘의 이반추크–볼프 게임을 따라가요. 실제 게임은 37.g4를 뒀고, 이후 결말은 가리 카스파로프의 도움으로 드라마를 위해 만들어졌어요.'
    },
    moves: 'd4 d5 c4 dxc4 e4 Nc6 Be3 Nf6 Nc3 e5 d5 Ne7 Bxc4 Ng6 f3 Bd6 Qd2 Bd7 Nge2 a6 Bb3 b5 a4 O-O O-O Qe7 Rac1 Nh5 g3 h6 Bc2 Rab8 axb5 axb5 Ra1 Ra8 Bd3 Bb4 Rxa8 Rxa8 Qc2 Bc5 Nd1 Bd6 Nf2 Nhf4 Rc1 Qg5 Kh1 Qh5 Ng1 Nxd3 Nxd3 f5 Nc5 Bc8 Rf1 Ne7 Qd3 fxe4 fxe4 Qg6 Kg2 Kh7 Nf3 Ng8 Nh4 Qg4 Nf5 Nf6 h3 Qg6 Ne6 Ra4 b3 Rxe4 Nxd6 Bxe6 dxe6 cxd6 e7 d5 Bc5 Qe8 Qf3 Qc6 b4 Qe8 Qf5+ Kh8 Qxf6 gxf6 Rxf6 Qh5 Rf8+ Kg7 e8=Q Re2+ Kf1 Qxh3+ Kxe2 Qg2+ Rf2 Qe4+ Kd2',
    notes: {
      2: { en: 'The Queen’s Gambit, the opening the series is named after.', ko: '드라마 제목이기도 한 퀸스 갬빗이에요.' },
      72: { en: 'Here the real game went 37.g4. From this move on, the show writes its own ending.', ko: '실제 게임은 여기서 37.g4를 뒀어요. 이 수부터 드라마만의 결말이 시작돼요.' },
      90: { en: 'The queen sacrifice that decides the game.', ko: '승부를 가르는 퀸 희생이에요.' },
      96: { en: 'The e-pawn becomes a new queen.', ko: 'e 폰이 새 퀸이 돼요.' },
      104: { en: 'Borgov has no more safe checks, and mate is coming. He resigns.', ko: '보르고프는 더 이상 안전한 체크가 없고 메이트를 피할 수 없어요. 기권해요.' }
    }
  }
];
