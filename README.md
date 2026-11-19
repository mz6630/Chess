# First Gambit

A chess school for your very first move: learn the basics, play against an AI, and ask a coach why.

넷플릭스 〈퀸스 갬빗〉을 보고 체스를 배우고 싶어진 사람을 위한 체스 학습 웹사이트입니다.

## What is here

- **Intro**: a wordless 3D loading scene. Six black lacquer pieces (pawn, knight, queen, king, bishop, rook) rise from a white studio floor one by one, a slow key light swings their shadows round, then the king alone is framed and night falls over it.
- **Landing**: a black-and-white editorial cover. A white king stands on the horizon over its black reflection, with *First* above the line and *Gambit* below it.
- **Scroll scene**: scroll down and the black and white pieces appear in the air, tumble, and land on a marble board in the starting position; the last stretch of scroll plays the Queen’s Gambit (1. d4 d5 2. c4). Once the set has landed, drag a piece to move it (it settles on the nearest square); swipe fast through the others to knock them over, and falling pieces topple whatever is in their way. Double-click the board to set the pieces back up.
- **Pawn, the AI tutor**: the little pawn in the bottom-right corner. Click it and ask in English or Korean. It explains pieces, rules (castling, en passant, check, stalemate), tactics and openings, and once the set has landed it reads the board: which pieces you moved, whether each move was legal, what was knocked over and the material count.

Click anywhere or press any key to skip the intro. Click the *First Gambit* logo to play it again.

## Files

| Path | What it does |
| --- | --- |
| `index.html` | Page markup and the flat king used on the landing |
| `css/style.css` | All styles, including the phone layout below 900px |
| `js/pieces.js` | Build data for the 3D pieces (lathe profiles, knight head and king cross outlines, rook battlements) |
| `js/engine.js` | Shared WebGL2 renderer: piece and board geometry, black and white lacquer, marble squares, studio lighting, soft shadows, floor reflections |
| `js/intro.js` | The intro timeline and the hand-over to the landing |
| `js/board.js` | The scroll scene: each piece's flight, spin and landing, driven by scroll position |
| `js/tutor.js` | Pawn, the tutor: the corner button, the chat panel, chess answers and board analysis |

No build step and no libraries: open `index.html` in a browser, or serve the folder with GitHub Pages. Fonts (Bodoni Moda, Jost) load from Google Fonts. Browsers without WebGL2, or with reduced motion turned on, skip straight to the landing.

## Play page (`play.html`)

- **Computer** (`js/ai.js`): a small engine in a Web Worker (0x88 board, alpha-beta, quiescence, transposition table). Five levels; each beat the one below in test matches. Beginner mode warns before a blunder ("after Qd5, Rxd5 wins your queen") and allows takebacks. Start from the normal position or the Queen's Gambit.
- **Two players** on one device, and **Legends** (`js/legends.js`): the Opera Game (1858), the Immortal Game (1851), the Game of the Century (1956) and Harmon vs Borgov from the series. You play the winner and guess each move: a hint after one miss, the real move after two, notes at the key moments, and a score at the end. Every score is checked move by move with `js/rules.js`.
- **Chess clock**: blitz 5, rapid 15+10, classical 90+30. Choose "I press it" (press your side after each move, or Space; until you do, your time runs and the opponent waits) or "Switches by itself". This is independent of the scoresheet choice, and can be changed mid-game with the switch under the clock.
- **Scoresheet**: moves appear in handwriting; or write them yourself (before your next move). Save it as a PNG with signatures, download the PGN, or save a blank scoresheet to print and fill in on real paper.
- **Tournament rules** (on automatically at levels 4 and 5): no helpers. No reminders or low-time beeps (you watch your own time), no answers shown on the scoresheet, no move dots, hints, takebacks or warnings. Pressing the clock and writing the moves start switched on but stay separate choices.
- **3D or 2D** (`js/board3d.js`, `js/board2d.js`), switchable mid-game; click or drag. **Ceiling mode** hides the pieces, with three two-second peeks.
- **Review**: every position is analysed; moves get ??, ?, ?! marks, an evaluation bar follows the game, and the three key moments explain what was better. Pawn reads the game and gives engine-backed hints (not under tournament rules).

## Sound (`js/sound.js`)

Every sound is synthesised with Web Audio, no audio files: wood knocks for pieces, a felt-piano phrase for the intro (one note per rising piece, a ripple for the wave, low notes as they sink, air for the curtain, a chord as the landing appears), chimes for right and wrong answers, a ping for stars, a bell for check and an arpeggio for promotion and finished lessons. Every button and link ticks; Pawn pops open and closed. The speaker button above Pawn mutes everything (remembered in the browser). Browsers only allow sound after a click or key press, so the very first intro on a fresh visit is silent; clicking the logo replays it with sound.

## Learn page (`learn.html`)

A course for people who have never played: 6 chapters, 23 lessons, all built.

1. **The board**: meet the board, names of the squares, ranks, files and diagonals
2. **The pieces**: six pieces, the starting position, taking turns
3. **How pieces move**: rook, bishop, queen, king, knight, pawn (each with a star-hunt game)
4. **The goal of the game**: piece values, check, checkmate, stalemate and draws
5. **Special moves**: castling, promotion, en passant
6. **Your first game**: three opening rules, basic checkmates, reading notation, the Queen's Gambit

Each lesson is a few short steps with a task: click squares, move pieces (click a piece, then a dot), answer a question, find a checkmate. Wrong moves are explained and taken back. The board is drawn flat with the set's own silhouettes (`js/flat.js`), and `js/rules.js` knows the full rules of chess (legal moves, check, mate, stalemate, castling, en passant, promotion, notation). Lessons can be read in English or Korean, progress is kept in the browser, and Pawn reads the current step to give hints. `learn.html#/14/3` opens lesson 14 at step 3. `index.html#main` opens the home page without the intro.

## Connecting Pawn to a real AI model (free)

Pawn answers on its own out of the box. `worker/worker.js` is a Cloudflare Worker that forwards questions to Google Gemini, keeping the API key secret. Both run on free plans with no card: Cloudflare Workers Free allows 100,000 requests a day, and Gemini's free tier has its own per-minute and per-day limits (free-tier prompts may be used by Google to improve its products).

1. Get a Gemini API key at aistudio.google.com (Get API key).
2. At dash.cloudflare.com: Workers & Pages, Create, start from "Hello World", deploy, then Edit code, paste `worker/worker.js` over everything and Deploy.
3. In the Worker: Settings, Variables and Secrets, add a Secret named `GEMINI_API_KEY` with the key.
4. Copy the Worker's address (`https://...workers.dev`) into `js/config.js`, commit and push.
5. Backup for regions Google refuses ("User location is not supported"): in the Worker, Settings, Bindings, Add, Workers AI, variable name `AI`, Deploy. Pawn then answers with Cloudflare's own free models (10,000 Neurons a day) whenever Gemini can't. Open the Worker's address in a browser to see a status check.

Pawn sends `POST {question, lang, context}`, where `context` holds the section the visitor is on, every piece's home square, current square and whether it has fallen, and Pawn's own analysis. The Worker replies `{"reply": "..."}`. If the request fails, Pawn falls back to its own answer. Only `https://mz6630.github.io` may call the Worker. Never put the API key in this repository: it is public.
