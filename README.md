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

## Connecting Pawn to a real AI model (free)

Pawn answers on its own out of the box. `worker/worker.js` is a Cloudflare Worker that forwards questions to Google Gemini, keeping the API key secret. Both run on free plans with no card: Cloudflare Workers Free allows 100,000 requests a day, and Gemini's free tier has its own per-minute and per-day limits (free-tier prompts may be used by Google to improve its products).

1. Get a Gemini API key at aistudio.google.com (Get API key).
2. At dash.cloudflare.com: Workers & Pages, Create, start from "Hello World", deploy, then Edit code, paste `worker/worker.js` over everything and Deploy.
3. In the Worker: Settings, Variables and Secrets, add a Secret named `GEMINI_API_KEY` with the key.
4. Copy the Worker's address (`https://...workers.dev`) into `js/config.js`, commit and push.
5. Backup for regions Google refuses ("User location is not supported"): in the Worker, Settings, Bindings, Add, Workers AI, variable name `AI`, Deploy. Pawn then answers with Cloudflare's own free models (10,000 Neurons a day) whenever Gemini can't. Open the Worker's address in a browser to see a status check.

Pawn sends `POST {question, lang, context}`, where `context` holds the section the visitor is on, every piece's home square, current square and whether it has fallen, and Pawn's own analysis. The Worker replies `{"reply": "..."}`. If the request fails, Pawn falls back to its own answer. Only `https://mz6630.github.io` may call the Worker. Never put the API key in this repository: it is public.
